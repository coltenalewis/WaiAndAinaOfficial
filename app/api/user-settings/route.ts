import { NextResponse } from "next/server";
import { Client } from "@notionhq/client";
import { queryDatabase } from "@/lib/notion";

const USERS_DB_ID = process.env.NOTION_USERS_DATABASE_ID!;
const NOTION_TOKEN = process.env.NOTION_TOKEN!;

// Notion property names in your Users DB
const NAME_PROPERTY_KEY = "Name";    // title
const PASSWORD_PROPERTY_KEY = "Password"; // rich_text
const PHONE_PROPERTY_KEY = "Phone";    // phone_number

const notion = new Client({ auth: NOTION_TOKEN });

function getPlainText(prop: any): string {
  if (!prop) return "";
  switch (prop.type) {
    case "title":
      return (prop.title || [])
        .map((t: any) => t.plain_text || "")
        .join("")
        .trim();
    case "rich_text":
      return (prop.rich_text || [])
        .map((t: any) => t.plain_text || "")
        .join("")
        .trim();
    case "select":
      return prop.select?.name || "";
    case "multi_select":
      return (prop.multi_select || [])
        .map((s: any) => s.name || "")
        .join(", ")
        .trim();
    case "phone_number":
      return prop.phone_number || "";
    default:
      return "";
  }
}

export async function POST(req: Request) {
  if (!USERS_DB_ID || !NOTION_TOKEN) {
    return NextResponse.json(
      { error: "Notion configuration missing" },
      { status: 500 }
    );
  }

  let body: {
    name?: string;
    currentPassword?: string;
    newPassword?: string | null;
    phone?: string | null;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const { name, currentPassword, newPassword, phone } = body;

  if (!name || !currentPassword) {
    return NextResponse.json(
      { error: "Missing name or currentPassword" },
      { status: 400 }
    );
  }

  try {
    const data = await queryDatabase(USERS_DB_ID);
    const pages = data.results || [];

    const targetName = name.trim().toLowerCase();
    const targetPass = currentPassword.trim();

    let matchedPage: any = null;

    for (const page of pages) {
      const props = page.properties || {};
      const pageName = getPlainText(props[NAME_PROPERTY_KEY]);
      const pagePass = getPlainText(props[PASSWORD_PROPERTY_KEY]);

      if (
        pageName.trim().toLowerCase() === targetName &&
        pagePass === targetPass
      ) {
        matchedPage = page;
        break;
      }
    }

    if (!matchedPage) {
      return NextResponse.json(
        { error: "Current passcode incorrect" },
        { status: 401 }
      );
    }

    const pageId = matchedPage.id as string;

    // Build properties update
    const properties: Record<string, any> = {};

    if (newPassword && newPassword.trim().length > 0) {
      properties[PASSWORD_PROPERTY_KEY] = {
        rich_text: [
          {
            type: "text",
            text: { content: newPassword.trim() },
          },
        ],
      };
    }

    if (typeof phone === "string") {
      properties[PHONE_PROPERTY_KEY] = {
        phone_number: phone.trim() || null,
      };
    }

    if (Object.keys(properties).length === 0) {
      // Nothing to update
      return NextResponse.json({ ok: true });
    }

    await notion.pages.update({
      page_id: pageId,
      properties,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to update user settings:", err);
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 }
    );
  }
}
