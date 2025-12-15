import { NextResponse } from "next/server";
import {
  createComment,
  queryAllDatabasePages,
  queryDatabase,
  retrieveComments,
  updatePage,
} from "@/lib/notion";

const TASKS_DB_ID = process.env.NOTION_TASKS_DATABASE_ID as string | undefined;

// ─────────────────────────────────────────────
// Notion property keys
// ─────────────────────────────────────────────
const TASK_NAME_PROPERTY_KEY = "Name"; // title
const TASK_DESC_PROPERTY_KEY = "Description"; // rich_text
const TASK_STATUS_PROPERTY_KEY = "Status"; // select
const TASK_PHOTOS_PROPERTY_KEY = "Photos"; // files
const TASK_TYPE_PROPERTY_KEY = "Task Type"; // select
const TASK_LINKS_PROPERTY_KEY = "Links"; // rich_text or url
const TASK_ESTIMATE_PROPERTY_KEY = "Estimated Time"; // rich_text or text
const TASK_NOTES_PROPERTY_KEY = "Extra Notes"; // rich_text or text

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function getPlainText(prop: any): string {
  if (!prop) return "";

  if (Array.isArray(prop)) {
    return prop
      .map((t: any) => t?.plain_text || "")
      .join("")
      .trim();
  }

  switch (prop.type) {
    case "title":
      return (prop.title || [])
        .map((t: any) => t?.plain_text || "")
        .join("")
        .trim();
    case "rich_text":
      return (prop.rich_text || [])
        .map((t: any) => t?.plain_text || "")
        .join("")
        .trim();
    case "select":
      return prop.select?.name || "";
    case "multi_select":
      return (prop.multi_select || [])
        .map((s: any) => s?.name || "")
        .join(", ")
        .trim();
    case "url":
      return prop.url || "";
    case "files":
      return (prop.files || [])
        .map((f: any) => f?.name || "")
        .join(", ")
        .trim();
    default:
      if (Array.isArray(prop.rich_text)) {
        return prop.rich_text
          .map((t: any) => t?.plain_text || "")
          .join("")
          .trim();
      }
      return "";
  }
}

function parseLinks(prop: any): { label: string; url: string }[] {
  if (!prop) return [];

  const parsePlainEntry = (entry: string) => {
    const trimmed = entry.trim();
    if (!trimmed) return null;

    // Format: [Label] https://url
    const bracketMatch = trimmed.match(/^\[([^\]]+)\]\s*(.+)$/);
    if (bracketMatch) {
      const [, label, url] = bracketMatch;
      return { label: label.trim(), url: url.trim() };
    }

    // Fallback: treat as raw URL/label
    return { label: trimmed, url: trimmed };
  };

  // Notion rich_text can include href/link urls
  if (prop.type === "rich_text" && Array.isArray(prop.rich_text)) {
    return prop.rich_text
      .map((t: any) => {
        const content = (t?.plain_text || "").trim();
        const url = t?.href || t?.text?.link?.url || "";
        if (!content && !url) return null;

        const bracketParsed = content ? parsePlainEntry(content) : null;
        if (bracketParsed && !url) return bracketParsed;

        return { label: content || url, url: url || content };
      })
      .filter(Boolean) as { label: string; url: string }[];
  }

  if (prop.type === "url" && prop.url) {
    return [{ label: prop.url, url: prop.url }];
  }

  const plain = getPlainText(prop).trim();
  if (!plain) return [];

  return plain
    .split(/,|\n/)
    .map((entry) => parsePlainEntry(entry))
    .filter(Boolean) as { label: string; url: string }[];
}

function parseMedia(filesProp: any): { name: string; url: string; kind: "image" | "video" | "audio" | "file" }[] {
  if (!filesProp || filesProp.type !== "files") return [];

  return (filesProp.files || []).map((file: any) => {
    const fname = file?.name || "Attachment";
    const url = file?.external?.url || file?.file?.url || "";
    const lower = fname.toLowerCase();

    let kind: "image" | "video" | "audio" | "file" = "file";
    if (/(\.png|\.jpe?g|\.gif|\.webp|\.avif)$/i.test(lower)) kind = "image";
    else if (/(\.mp4|\.mov|\.m4v|\.webm)$/i.test(lower)) kind = "video";
    else if (/(\.mp3|\.wav|\.m4a|\.aac|\.ogg)$/i.test(lower)) kind = "audio";

    return { name: fname, url, kind };
  });
}

async function findTaskPageByName(name: string) {
  if (!TASKS_DB_ID) return null;

  const normalized = name.trim();
  if (!normalized) return null;

  const data = await queryDatabase(TASKS_DB_ID, {
    filter: {
      property: TASK_NAME_PROPERTY_KEY,
      title: { equals: normalized },
    },
  });

  if (data.results?.length) return data.results[0];

  // Fallback: return the first page if no exact match
  const fallback = await queryDatabase(TASKS_DB_ID, { page_size: 1 });
  return fallback.results?.[0] ?? null;
}

async function buildTaskPayload(page: any, fallbackName: string) {
  const props = page?.properties || {};

  const pageName = getPlainText(props[TASK_NAME_PROPERTY_KEY]) || fallbackName;
  const description = getPlainText(props[TASK_DESC_PROPERTY_KEY]) || "";
  const extraNotes = getPlainText(props[TASK_NOTES_PROPERTY_KEY]) || "";
  const status = getPlainText(props[TASK_STATUS_PROPERTY_KEY]) || "";
  const estimatedTime = getPlainText(props[TASK_ESTIMATE_PROPERTY_KEY]) || "";

  const links = parseLinks(props[TASK_LINKS_PROPERTY_KEY]);

  const typeProp = props[TASK_TYPE_PROPERTY_KEY];
  const taskType =
    typeProp?.type === "select"
      ? {
          name: typeProp.select?.name || "",
          color: typeProp.select?.color || "default",
        }
      : { name: "", color: "default" };

  const media = parseMedia(props[TASK_PHOTOS_PROPERTY_KEY]);

  const commentsRaw = await retrieveComments(page.id);
  const comments = (commentsRaw.results || []).map((c: any) => {
    const rawText = getPlainText(c?.rich_text) || "";
    const colonIndex = rawText.indexOf(":");

    const parsedAuthor = colonIndex > -1 ? rawText.slice(0, colonIndex).trim() : "";
    const parsedMessage = colonIndex > -1 ? rawText.slice(colonIndex + 1).trim() : rawText;

    return {
      id: c.id,
      text: parsedMessage,
      createdTime: c.created_time,
      author: parsedAuthor || c.created_by?.name || "Unknown",
    };
  });

  return {
    id: page.id,
    name: pageName,
    description,
    extraNotes,
    status,
    links,
    taskType,
    media,
    estimatedTime,
    comments,
  };
}

// ─────────────────────────────────────────────
// GET — list tasks or fetch task details by name
// ─────────────────────────────────────────────
export async function GET(req: Request) {
  if (!TASKS_DB_ID) {
    return NextResponse.json({ error: "NOTION_TASKS_DATABASE_ID is not set" }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const listOnly = searchParams.get("list");
  const name = searchParams.get("name");

  if (listOnly) {
    try {
      const data = await queryAllDatabasePages(TASKS_DB_ID, {
        sorts: [{ property: TASK_NAME_PROPERTY_KEY, direction: "ascending" }],
      });

      const tasks = (data.results || []).map((page: any) => {
        const props = page?.properties || {};
        const nameProp = getPlainText(props[TASK_NAME_PROPERTY_KEY]);

        const typeProp = props[TASK_TYPE_PROPERTY_KEY];
        const statusProp = props[TASK_STATUS_PROPERTY_KEY];

        return {
          id: page.id,
          name: nameProp,
          type: typeProp?.select?.name || "",
          typeColor: typeProp?.select?.color || "default",
          status: statusProp?.select?.name || "",
        };
      });

      return NextResponse.json({ tasks });
    } catch (err) {
      console.error("Failed to list tasks:", err);
      return NextResponse.json({ error: "Unable to load tasks" }, { status: 500 });
    }
  }

  if (!name) {
    return NextResponse.json({ error: "Missing task name" }, { status: 400 });
  }

  try {
    const page = await findTaskPageByName(name);
    if (!page) return NextResponse.json({ error: "Task not found" }, { status: 404 });

    const payload = await buildTaskPayload(page, name);
    return NextResponse.json(payload);
  } catch (err) {
    console.error("GET /task failed:", err);
    return NextResponse.json({ error: "Failed to fetch task" }, { status: 500 });
  }
}

// ─────────────────────────────────────────────
// PATCH — update task fields (status/description/type/extraNotes/links/estimatedTime)
// ─────────────────────────────────────────────
export async function PATCH(req: Request) {
  if (!TASKS_DB_ID) {
    return NextResponse.json({ error: "NOTION_TASKS_DATABASE_ID is not set" }, { status: 500 });
  }

  const body = await req.json().catch(() => null);
  const {
    name,
    status,
    description,
    taskType,
    extraNotes,
    links,
    estimatedTime,
  }: {
    name?: string;
    status?: string | null;
    description?: string | null;
    taskType?: string | null;
    extraNotes?: string | null;
    links?: string | null;
    estimatedTime?: string | null;
  } = body || {};

  if (!name) {
    return NextResponse.json({ error: "Missing task name" }, { status: 400 });
  }

  const hasAnyUpdate =
    status !== undefined ||
    description !== undefined ||
    taskType !== undefined ||
    extraNotes !== undefined ||
    links !== undefined ||
    estimatedTime !== undefined;

  if (!hasAnyUpdate) {
    return NextResponse.json({ error: "No updates provided for this task" }, { status: 400 });
  }

  try {
    const page = await findTaskPageByName(name);
    if (!page) return NextResponse.json({ error: "Task not found" }, { status: 404 });

    const properties: Record<string, any> = {};

    if (status !== undefined) {
      properties[TASK_STATUS_PROPERTY_KEY] = status
        ? { select: { name: status } }
        : { select: null };
    }

    if (description !== undefined) {
      properties[TASK_DESC_PROPERTY_KEY] = {
        rich_text: description
          ? [{ type: "text", text: { content: description } }]
          : [],
      };
    }

    if (taskType !== undefined) {
      properties[TASK_TYPE_PROPERTY_KEY] = taskType
        ? { select: { name: taskType } }
        : { select: null };
    }

    if (extraNotes !== undefined) {
      properties[TASK_NOTES_PROPERTY_KEY] = {
        rich_text: extraNotes
          ? [{ type: "text", text: { content: extraNotes } }]
          : [],
      };
    }

    if (links !== undefined) {
      // Store links as rich_text so you can paste multiple lines/commas/etc.
      properties[TASK_LINKS_PROPERTY_KEY] = {
        rich_text: links ? [{ type: "text", text: { content: links } }] : [],
      };
    }

    if (estimatedTime !== undefined) {
      properties[TASK_ESTIMATE_PROPERTY_KEY] = {
        rich_text: estimatedTime
          ? [{ type: "text", text: { content: estimatedTime } }]
          : [],
      };
    }

    await updatePage(page.id, properties);

    // Return updated task details (useful for your UI)
    const refreshed = await findTaskPageByName(name);
    const payload = refreshed ? await buildTaskPayload(refreshed, name) : { success: true };

    return NextResponse.json(payload);
  } catch (err) {
    console.error("PATCH /task failed:", err);
    return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
  }
}

// ─────────────────────────────────────────────
// POST — add a comment to a task
// ─────────────────────────────────────────────
export async function POST(req: Request) {
  if (!TASKS_DB_ID) {
    return NextResponse.json({ error: "NOTION_TASKS_DATABASE_ID is not set" }, { status: 500 });
  }

  const body = await req.json().catch(() => null);
  const { name, comment } = body || {};

  if (!name || !comment) {
    return NextResponse.json({ error: "Missing task name or comment" }, { status: 400 });
  }

  try {
    const page = await findTaskPageByName(name);
    if (!page) return NextResponse.json({ error: "Task not found" }, { status: 404 });

    await createComment(page.id, [{ type: "text", text: { content: comment } }]);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("POST /task failed:", err);
    return NextResponse.json({ error: "Failed to add comment" }, { status: 500 });
  }
}
