import { NextResponse } from "next/server";
import { queryDatabase } from "@/lib/notion";

const TASKS_DB_ID = process.env.NOTION_TASKS_DATABASE_ID!;

// Notion property names in your Tasks DB
const TASK_NAME_PROPERTY_KEY = "Name";        // title
const TASK_DESC_PROPERTY_KEY = "Description"; // rich_text

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
    default:
      return "";
  }
}

export async function GET(req: Request) {
  if (!TASKS_DB_ID) {
    return NextResponse.json(
      { error: "NOTION_TASKS_DATABASE_ID is not set" },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(req.url);
  const name = searchParams.get("name");
  if (!name) {
    return NextResponse.json(
      { error: "Missing task name" },
      { status: 400 }
    );
  }

  const target = name.trim().toLowerCase();

  try {
    // You can add a filter here, but for now just query all and match in code
    const data = await queryDatabase(TASKS_DB_ID);

    let bestDescription = "";
    let bestName = "";

    for (const page of data.results || []) {
      const props = page.properties || {};
      const pageName = getPlainText(props[TASK_NAME_PROPERTY_KEY]);
      const pageDesc = getPlainText(props[TASK_DESC_PROPERTY_KEY]);

      if (!pageName) continue;

      const normalized = pageName.trim().toLowerCase();

      if (normalized === target) {
        // exact match – take it and stop
        bestName = pageName;
        bestDescription = pageDesc;
        break;
      }

      // fallback: first partial/any match
      if (!bestName) {
        bestName = pageName;
        bestDescription = pageDesc;
      }
    }

    return NextResponse.json({
      name: bestName || name,
      description: bestDescription || "",
    });
  } catch (err) {
    console.error("Failed to fetch task details from Notion:", err);
    return NextResponse.json(
      { error: "Failed to fetch task details" },
      { status: 500 }
    );
  }
}
