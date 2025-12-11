// src/lib/notion.ts
const NOTION_TOKEN = process.env.NOTION_TOKEN!;
const NOTION_VERSION = process.env.NOTION_VERSION || "2022-06-28";

if (!NOTION_TOKEN) {
  throw new Error("Missing NOTION_TOKEN env var");
}

const NOTION_BASE_URL = "https://api.notion.com/v1";

export async function queryDatabase(databaseId: string, body: any = {}) {
  const res = await fetch(`${NOTION_BASE_URL}/databases/${databaseId}/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${NOTION_TOKEN}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("Notion error:", res.status, text);
    throw new Error(`Failed to query Notion: ${res.status}`);
  }

  return res.json();
}
