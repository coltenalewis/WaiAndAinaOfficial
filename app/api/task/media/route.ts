import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { queryDatabase, updatePage } from "@/lib/notion";

const TASKS_DB_ID = process.env.NOTION_TASKS_DATABASE_ID!;
const TASK_NAME_PROPERTY_KEY = "Name";
const TASK_PHOTOS_PROPERTY_KEY = "Photos";

const DRIVE_CLIENT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const DRIVE_PRIVATE_KEY = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n");
const DRIVE_MEDIA_FOLDER_ID = process.env.GOOGLE_DRIVE_MEDIA_FOLDER_ID;

function base64Url(input: Buffer | string) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

async function getAccessToken() {
  if (!DRIVE_CLIENT_EMAIL || !DRIVE_PRIVATE_KEY) {
    throw new Error("Google Drive credentials are missing");
  }

  const header = base64Url(
    JSON.stringify({
      alg: "RS256",
      typ: "JWT",
    })
  );

  const now = Math.floor(Date.now() / 1000);
  const payload = base64Url(
    JSON.stringify({
      iss: DRIVE_CLIENT_EMAIL,
      scope: "https://www.googleapis.com/auth/drive.file",
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now,
    })
  );

  const unsigned = `${header}.${payload}`;
  const sign = crypto.createSign("RSA-SHA256");
  sign.update(unsigned);
  const signature = base64Url(sign.sign(DRIVE_PRIVATE_KEY));
  const assertion = `${unsigned}.${signature}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to fetch token: ${text}`);
  }

  const data = await res.json();
  return data.access_token as string;
}

async function findTaskPageByName(name: string) {
  const normalized = name.trim();
  if (!normalized) return null;

  const data = await queryDatabase(TASKS_DB_ID, {
    filter: {
      property: TASK_NAME_PROPERTY_KEY,
      title: {
        equals: normalized,
      },
    },
  });

  if (data.results?.length) {
    return data.results[0];
  }

  const fallback = await queryDatabase(TASKS_DB_ID, { page_size: 1 });
  return fallback.results?.[0] ?? null;
}

function detectKind(filename: string) {
  const lower = filename.toLowerCase();
  if (/(\.mp4|\.mov|\.m4v)$/i.test(lower)) return "video" as const;
  if (/(\.mp3|\.wav|\.m4a)$/i.test(lower)) return "audio" as const;
  if (/(\.png|\.jpe?g|\.gif|\.webp|\.avif)$/i.test(lower)) return "image" as const;
  return "file" as const;
}

async function uploadToDrive(file: File, accessToken: string) {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const boundary = `-------waiandaina-${Date.now()}`;

  const metadata = {
    name: file.name || `Upload-${Date.now()}`,
    parents: DRIVE_MEDIA_FOLDER_ID ? [DRIVE_MEDIA_FOLDER_ID] : undefined,
  };

  const preamble = Buffer.from(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(
      metadata
    )}\r\n--${boundary}\r\nContent-Type: ${file.type || "application/octet-stream"}\r\nContent-Transfer-Encoding: binary\r\n\r\n`
  );
  const closing = Buffer.from(`\r\n--${boundary}--`);

  const body = Buffer.concat([preamble, buffer, closing]);

  const res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
      "Content-Length": body.length.toString(),
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to upload to Drive: ${text}`);
  }

  const data = await res.json();
  return data.id as string;
}

async function makePublic(fileId: string, accessToken: string) {
  await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ role: "reader", type: "anyone" }),
  });
}

async function getShareableLink(fileId: string, accessToken: string) {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=webViewLink,webContentLink`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error("Failed to retrieve share link");
  }
  const data = await res.json();
  return data.webContentLink || data.webViewLink || `https://drive.google.com/file/d/${fileId}/view?usp=sharing`;
}

export async function POST(req: Request) {
  if (!TASKS_DB_ID) {
    return NextResponse.json({ error: "NOTION_TASKS_DATABASE_ID is not set" }, { status: 500 });
  }
  if (!DRIVE_CLIENT_EMAIL || !DRIVE_PRIVATE_KEY) {
    return NextResponse.json({ error: "Google Drive credentials are not configured" }, { status: 500 });
  }

  const formData = await req.formData().catch(() => null);
  const name = formData?.get("name")?.toString() || "";
  const file = formData?.get("file");

  if (!name || !file || !(file instanceof File)) {
    return NextResponse.json({ error: "Missing task name or file" }, { status: 400 });
  }

  try {
    const accessToken = await getAccessToken();
    const page = await findTaskPageByName(name);
    if (!page) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const fileId = await uploadToDrive(file, accessToken);
    await makePublic(fileId, accessToken);
    const shareUrl = await getShareableLink(fileId, accessToken);

    const existingFiles = (page.properties?.[TASK_PHOTOS_PROPERTY_KEY]?.files || [])
      .map((f: any) => {
        const url = f?.external?.url || f?.file?.url;
        if (!url) return null;
        return {
          name: f.name || "Attachment",
          external: { url },
        };
      })
      .filter(Boolean);

    await updatePage(page.id, {
      [TASK_PHOTOS_PROPERTY_KEY]: {
        files: [
          ...existingFiles,
          {
            name: file.name || "Upload",
            external: { url: shareUrl },
          },
        ],
      },
    });

    return NextResponse.json({
      success: true,
      media: {
        name: file.name || "Upload",
        url: shareUrl,
        kind: detectKind(file.name || ""),
      },
    });
  } catch (err) {
    console.error("Failed to upload media:", err);
    return NextResponse.json({ error: "Failed to upload media" }, { status: 500 });
  }
}
