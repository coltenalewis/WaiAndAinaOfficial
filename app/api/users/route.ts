// src/app/api/users/route.ts
import { NextResponse } from "next/server";
import { queryDatabase } from "@/lib/notion";

const USERS_DB_ID = process.env.NOTION_USERS_DATABASE_ID!;

export async function GET() {
  if (!USERS_DB_ID) {
    return NextResponse.json(
      { error: "NOTION_USERS_DATABASE_ID is not set" },
      { status: 500 }
    );
  }

  try {
    const data = await queryDatabase(USERS_DB_ID);

    // Adjust "Name" to match the title property in your Users database.
    const users: string[] = (data.results || [])
      .map((page: any) => {
        const nameProp = page.properties?.Name; // property key in Notion
        if (!nameProp) return null;

        // Assuming Name is a "title" property
        const title = nameProp.title?.[0]?.plain_text;
        return title || null;
      })
      .filter(Boolean);

    return NextResponse.json({ users });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Failed to load users from Notion" },
      { status: 500 }
    );
  }
}
