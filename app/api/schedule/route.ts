// src/app/api/schedule/route.ts
import { NextResponse } from "next/server";
import { loadScheduleData } from "@/lib/schedule-loader";

export async function GET() {
  if (!process.env.NOTION_SCHEDULE_DATABASE_ID) {
    return NextResponse.json(
      { error: "NOTION_SCHEDULE_DATABASE_ID is not set" },
      { status: 500 }
    );
  }

  try {
    const data = await loadScheduleData();
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (err) {
    console.error("Failed to fetch schedule from Notion:", err);

    const friendly = "No schedule has been assigned yet.";
    return NextResponse.json(
      {
        people: [],
        slots: [],
        cells: [],
        message: friendly,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  }
}
