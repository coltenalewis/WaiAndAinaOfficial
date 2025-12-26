import { NextResponse } from "next/server";
import { supabaseRequest } from "@/lib/supabase";

type ScheduleRow = {
  id: string;
  schedule_date: string;
  state: string;
};

function toLabel(date: string) {
  const [year, month, day] = date.split("-");
  if (!year || !month || !day) return date;
  return `${month}/${day}/${year}`;
}

export async function GET() {
  try {
    const rows = await supabaseRequest<ScheduleRow[]>("schedules", {
      query: {
        select: "id,schedule_date,state",
        order: "schedule_date.asc",
      },
    });

    const grouped = new Map<
      string,
      { dateLabel: string; liveId?: string; stagingId?: string }
    >();

    rows.forEach((row) => {
      const label = toLabel(row.schedule_date);
      const entry = grouped.get(row.schedule_date) || {
        dateLabel: label,
      };
      if (row.state === "live") {
        entry.liveId = row.id;
      } else {
        entry.stagingId = row.id;
      }
      grouped.set(row.schedule_date, entry);
    });

    const schedules = Array.from(grouped.values());
    const selectedDate = schedules.length
      ? schedules[schedules.length - 1].dateLabel
      : toLabel(new Date().toISOString().slice(0, 10));

    return NextResponse.json({
      schedules,
      selectedDate,
      mode: "page",
    });
  } catch (err) {
    console.error("Failed to load schedule list", err);
    return NextResponse.json(
      { error: "Unable to load schedules" },
      { status: 500 }
    );
  }
}
