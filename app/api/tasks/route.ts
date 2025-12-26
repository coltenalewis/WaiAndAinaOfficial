import { NextResponse } from "next/server";
import { supabaseRequest } from "@/lib/supabase";

function buildRangeFilter(start?: string, end?: string) {
  if (!start && !end) return {};
  const filter: Record<string, string> = {};
  if (start) filter.occurrence_date = `gte.${start}`;
  if (end) filter.occurrence_date = `lte.${end}`;
  return filter;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") || "";
  const type = searchParams.get("type") || "";
  const priority = searchParams.get("priority") || "";
  const recurring = searchParams.get("recurring") || "";
  const search = searchParams.get("search") || "";
  const start = searchParams.get("start") || "";
  const end = searchParams.get("end") || "";
  const includeOccurrences = searchParams.get("includeOccurrences") === "true";

  const query: Record<string, string> = {
    select:
      "id,name,description,status,priority,estimated_time,recurring,recurrence_interval,recurrence_unit,recurrence_until,origin_date,occurrence_date,person_count,links,photos,time_slots,extra_notes,task_type:task_types(id,name,color)",
    order: "created_at.desc",
    ...buildRangeFilter(start, end),
  };

  if (status) query.status = `eq.${status}`;
  if (priority) query.priority = `eq.${priority}`;
  if (type) query["task_type_id"] = `eq.${type}`;
  if (recurring) query.recurring = `eq.${recurring === "true" ? "true" : "false"}`;
  if (search) query.name = `ilike.%${search}%`;
  if (!includeOccurrences) query.parent_task_id = "is.null";

  try {
    const data = await supabaseRequest<any[]>("tasks", { query });
    return NextResponse.json({ tasks: data || [] });
  } catch (err) {
    console.error("Failed to load tasks:", err);
    return NextResponse.json({ tasks: [] });
  }
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body?.name) {
    return NextResponse.json({ error: "Missing name" }, { status: 400 });
  }

  try {
    const isRecurring = Boolean(body.recurring);
    const originDate = body.origin_date || body.occurrence_date;
    const interval = Number(body.recurrence_interval || 1);
    const unit = body.recurrence_unit;
    const until = body.recurrence_until;

    const [parent] = await supabaseRequest<any[]>("tasks", {
      method: "POST",
      prefer: "return=representation",
      query: { select: "*" },
      body: {
        ...body,
        origin_date: originDate,
        occurrence_date: originDate,
        recurring: isRecurring,
      },
    });

    if (parent && isRecurring && originDate && until && interval > 0 && unit) {
      const occurrences: Record<string, unknown>[] = [];
      const startDate = new Date(originDate);
      const endDate = new Date(until);
      const nextDate = new Date(startDate);

      while (true) {
        if (unit === "day") {
          nextDate.setDate(nextDate.getDate() + interval);
        } else if (unit === "month") {
          nextDate.setMonth(nextDate.getMonth() + interval);
        } else if (unit === "year") {
          nextDate.setFullYear(nextDate.getFullYear() + interval);
        }

        if (nextDate > endDate) break;

        occurrences.push({
          ...body,
          origin_date: originDate,
          occurrence_date: nextDate.toISOString().slice(0, 10),
          parent_task_id: parent.id,
          recurring: true,
        });
      }

      if (occurrences.length) {
        await supabaseRequest("tasks", {
          method: "POST",
          prefer: "return=minimal",
          body: occurrences,
        });
      }
    }

    return NextResponse.json({ task: parent });
  } catch (err) {
    console.error("Failed to create task:", err);
    return NextResponse.json({ error: "Unable to create task" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const body = await req.json().catch(() => null);
  const { id, applyTo = "single", occurrenceDate } = body || {};

  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const updates = { ...body };
  delete updates.id;
  delete updates.applyTo;
  delete updates.occurrenceDate;

  try {
    if (applyTo === "single") {
      await supabaseRequest("tasks", {
        method: "PATCH",
        query: { id: `eq.${id}` },
        body: updates,
      });
      return NextResponse.json({ ok: true });
    }

    const seriesData = await supabaseRequest<any[]>("tasks", {
      query: { select: "id,parent_task_id,occurrence_date", id: `eq.${id}`, limit: 1 },
    });
    const target = seriesData?.[0];
    if (!target) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const seriesRoot = target.parent_task_id || target.id;
    const compareDate = occurrenceDate || target.occurrence_date;

    const filters: Record<string, string> = {};
    if (applyTo === "all") {
      filters.or = `id.eq.${seriesRoot},parent_task_id.eq.${seriesRoot}`;
    } else if (applyTo === "future") {
      filters.or = `id.eq.${seriesRoot},parent_task_id.eq.${seriesRoot}`;
      if (compareDate) {
        filters.occurrence_date = `gte.${compareDate}`;
      }
    } else {
      filters.id = `eq.${id}`;
    }

    await supabaseRequest("tasks", {
      method: "PATCH",
      query: filters,
      body: updates,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to update task:", err);
    return NextResponse.json({ error: "Unable to update task" }, { status: 500 });
  }
}
