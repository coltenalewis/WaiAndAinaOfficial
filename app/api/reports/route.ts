import { NextResponse } from "next/server";
import {
  createPageInDatabase,
  createPageUnderPage,
  queryDatabase,
  retrieveComments,
  retrieveDatabase,
  retrievePage,
} from "@/lib/notion";
import { loadScheduleData, Slot } from "@/lib/schedule-loader";

const REPORTS_DB_ID = process.env.NOTION_REPORTS_DATABASE_ID!;
const TASKS_DB_ID = process.env.NOTION_TASKS_DATABASE_ID!;

const TASK_NAME_PROPERTY_KEY = "Name";
const TASK_STATUS_PROPERTY_KEY = "Status";
const TASK_DESC_PROPERTY_KEY = "Description";
const TASK_NOTES_PROPERTY_KEY = "Extra Notes";

function getPlainText(prop: any): string {
  if (!prop) return "";

  if (Array.isArray(prop)) {
    return prop
      .map((t: any) => t.plain_text || "")
      .join("")
      .trim();
  }

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
    default:
      return "";
  }
}

function getTitlePropertyKey(meta: any): string {
  const props = meta?.properties || {};
  for (const [key, value] of Object.entries(props)) {
    if ((value as any)?.type === "title") return key;
  }
  return "Name";
}

function getDatePropertyKey(meta: any): string | null {
  const props = meta?.properties || {};
  for (const [key, value] of Object.entries(props)) {
    if ((value as any)?.type === "date") return key;
  }
  return null;
}

function baseTaskName(task: string) {
  return (task || "").split("\n")[0].trim();
}

function toIso(dateLabel?: string) {
  if (!dateLabel) return new Date().toISOString();
  const [month, day, year] = dateLabel.split("/").map((v) => Number(v));
  if (month && day && year) {
    const dt = new Date(year, month - 1, day);
    return dt.toISOString();
  }
  const parsed = new Date(dateLabel);
  return parsed.toISOString();
}

type TaskDetail = {
  name: string;
  status: string;
  description: string;
  extraNotes: string;
  comments: { author: string; text: string; createdTime: string }[];
};

async function fetchTaskDetail(name: string): Promise<TaskDetail | null> {
  if (!name) return null;

  const data = await queryDatabase(TASKS_DB_ID, {
    page_size: 1,
    filter: {
      property: TASK_NAME_PROPERTY_KEY,
      title: {
        equals: name,
      },
    },
  });

  const page = data.results?.[0];
  if (!page) return null;

  const props = page.properties || {};
  const status = getPlainText(props[TASK_STATUS_PROPERTY_KEY]);
  const description = getPlainText(props[TASK_DESC_PROPERTY_KEY]);
  const extraNotes = getPlainText(props[TASK_NOTES_PROPERTY_KEY]);
  const commentsRaw = await retrieveComments(page.id);
  const comments = (commentsRaw.results || []).map((c: any) => {
    const rawText = getPlainText(c.rich_text) || "";
    const colonIndex = rawText.indexOf(":");
    const parsedAuthor =
      colonIndex > -1 ? rawText.slice(0, colonIndex).trim() : "";
    const parsedMessage =
      colonIndex > -1 ? rawText.slice(colonIndex + 1).trim() : rawText;

    return {
      id: c.id,
      text: parsedMessage,
      createdTime: c.created_time,
      author: parsedAuthor || c.created_by?.name || "Unknown",
    };
  });

  return {
    name,
    status: status || "",
    description: description || "",
    extraNotes: extraNotes || "",
    comments,
  };
}

type Assignment = {
  person: string;
  slot: Slot;
  taskName: string;
};

function buildAssignments(
  people: string[],
  slots: Slot[],
  cells: string[][]
): Assignment[] {
  const items: Assignment[] = [];

  people.forEach((person, rowIdx) => {
    const row = cells[rowIdx] || [];

    slots.forEach((slot, colIdx) => {
      const raw = row[colIdx] || "";
      if (!raw) return;

      const splitTasks = raw
        .split(/,|\n/)
        .map((t) => t.trim())
        .filter(Boolean);

      splitTasks.forEach((task) => {
        items.push({ person, slot, taskName: task });
      });
    });
  });

  return items;
}

function paragraph(content: string) {
  return {
    object: "block",
    type: "paragraph",
    paragraph: {
      rich_text: [
        {
          type: "text",
          text: { content },
        },
      ],
    },
  };
}

function heading(content: string, level: 2 | 3 = 2) {
  return {
    object: "block",
    type: level === 2 ? "heading_2" : "heading_3",
    [level === 2 ? "heading_2" : "heading_3"]: {
      rich_text: [
        {
          type: "text",
          text: { content },
        },
      ],
    },
  };
}

function bullet(content: string, children: any[] = []) {
  return {
    object: "block",
    type: "bulleted_list_item",
    bulleted_list_item: {
      rich_text: [
        {
          type: "text",
          text: { content },
        },
      ],
      ...(children.length ? { children } : {}),
    },
  };
}

export async function POST() {
  if (!REPORTS_DB_ID || !TASKS_DB_ID) {
    return NextResponse.json(
      { error: "Reports or Tasks database ID is not configured" },
      { status: 500 }
    );
  }

  let schedule;
  try {
    schedule = await loadScheduleData();
  } catch (err) {
    console.error("Failed to load schedule for report:", err);
    return NextResponse.json(
      { error: "Unable to load schedule for reporting" },
      { status: 500 }
    );
  }
  if (!schedule.people.length || !schedule.slots.length) {
    return NextResponse.json(
      { error: "No schedule has been assigned yet" },
      { status: 400 }
    );
  }

  const assignments = buildAssignments(
    schedule.people,
    schedule.slots,
    schedule.cells
  );

  const uniqueTasks = Array.from(
    new Set(assignments.map((a) => baseTaskName(a.taskName)).filter(Boolean))
  );

  const taskDetails = new Map<string, TaskDetail | null>();
  for (const taskName of uniqueTasks) {
    try {
      const detail = await fetchTaskDetail(taskName);
      taskDetails.set(taskName, detail);
    } catch (err) {
      console.error(`Failed to load task detail for ${taskName}:`, err);
      taskDetails.set(taskName, null);
    }
  }

  let guideMeta: any | null = null;
  let isDatabase = true;
  let titleKey = "Name";
  let dateKey: string | null = null;

  try {
    guideMeta = await retrieveDatabase(REPORTS_DB_ID);
    titleKey = getTitlePropertyKey(guideMeta);
    dateKey = getDatePropertyKey(guideMeta);
  } catch (err) {
    console.warn(
      "Reports parent is not a database, falling back to child page creation:",
      err
    );
    isDatabase = false;
    try {
      await retrievePage(REPORTS_DB_ID);
    } catch (pageErr) {
      console.error("Reports parent page lookup failed:", pageErr);
      return NextResponse.json(
        { error: "Reports parent page is not accessible" },
        { status: 500 }
      );
    }
  }
  const scheduleLabel = schedule.scheduleDate || new Date().toLocaleDateString();
  const isoDate = toIso(schedule.scheduleDate);

  const children: any[] = [
    heading(`Daily Report — ${scheduleLabel}`, 2),
    paragraph(
      `Generated ${new Date().toLocaleString()} with ${assignments.length} assignments.`
    ),
  ];

  if (assignments.length === 0) {
    children.push(paragraph("No assignments were recorded for this schedule."));
  } else {
    schedule.slots.forEach((slot) => {
      const slotAssignments = assignments.filter((a) => a.slot.id === slot.id);
      if (!slotAssignments.length) return;

      children.push(
        heading(
          `${slot.label}${slot.timeRange ? ` (${slot.timeRange})` : ""}`,
          3
        )
      );

      slotAssignments.forEach((assignment) => {
        const baseName = baseTaskName(assignment.taskName);
        const detail = (baseName && taskDetails.get(baseName)) || null;
        const statusLabel = detail?.status ? ` [${detail.status}]` : "";
        const description = detail?.description;
        const notes = detail?.extraNotes;
        const comments = detail?.comments || [];

        const detailChildren: any[] = [];
        if (description) {
          detailChildren.push(paragraph(`Description: ${description}`));
        }
        if (notes) {
          detailChildren.push(paragraph(`Extra notes: ${notes}`));
        }
        if (comments.length) {
          const commentBullets = comments.map((c) =>
            bullet(
              `${c.author}: ${c.text} (${new Date(c.createdTime).toLocaleString()})`
            )
          );
          detailChildren.push(bullet("Comments:", commentBullets));
        }

        children.push(
          bullet(
            `${assignment.person}: ${assignment.taskName}${statusLabel}`,
            detailChildren
          )
        );
      });
    });
  }

  const properties: any = isDatabase
    ? {
        [titleKey]: {
          title: [
            {
              type: "text",
              text: { content: `Daily Report — ${scheduleLabel}` },
            },
          ],
        },
      }
    : {
        title: [
          {
            type: "text",
            text: { content: `Daily Report — ${scheduleLabel}` },
          },
        ],
      };

  if (isDatabase && dateKey) {
    properties[dateKey] = {
      date: { start: isoDate },
    };
  }

  const page = isDatabase
    ? await createPageInDatabase(REPORTS_DB_ID, properties, children)
    : await createPageUnderPage(REPORTS_DB_ID, properties, children);

  return NextResponse.json({ success: true, pageId: page.id });
}
