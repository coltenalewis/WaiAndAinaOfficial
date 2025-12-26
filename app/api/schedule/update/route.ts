import { NextResponse } from "next/server";
import { supabaseRequest } from "@/lib/supabase";

type ScheduleRow = { id: string };
type SchedulePersonRow = { id: string; name: string };
type ScheduleCellRow = { id: string };
type UserRow = {
  display_name: string;
  active: boolean;
  user_role?: { name?: string | null };
};

function toIsoDate(label?: string | null) {
  if (!label) return null;
  if (label.includes("-")) return label;
  const [month, day, year] = label.split("/");
  if (!month || !day || !year) return null;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function parseCell(value?: string | null) {
  if (!value?.trim()) return { tasks: [] as string[], note: "" };
  const [firstLine, ...rest] = value.split("\n");
  const tasks = firstLine
    .split(",")
    .map((task) => task.trim())
    .filter(Boolean);
  const note = rest.join("\n").trim();
  return { tasks, note };
}

async function fetchVolunteers() {
  const users = await supabaseRequest<UserRow[]>("users", {
    query: {
      select: "display_name,active,user_role:user_roles(name)",
      order: "display_name.asc",
    },
  });

  return (
    users
      ?.filter(
        (user) =>
          user.active &&
          (user.user_role?.name || "")
            .toLowerCase()
            .includes("volunteer")
      )
      .map((user) => user.display_name) || []
  );
}

async function ensureSchedulePeople(scheduleId: string, volunteers: string[]) {
  const people = await supabaseRequest<SchedulePersonRow[]>("schedule_people", {
    query: {
      select: "id,name",
      schedule_id: `eq.${scheduleId}`,
      order: "order_index.asc",
    },
  });
  const existing = new Map(people.map((person) => [person.name, person.id]));
  const missing = volunteers.filter((name) => !existing.has(name));

  if (missing.length) {
    await supabaseRequest("schedule_people", {
      method: "POST",
      body: missing.map((name) => ({
        schedule_id: scheduleId,
        name,
        order_index: volunteers.indexOf(name) + 1,
      })),
    });
  }

  const refreshed = await supabaseRequest<SchedulePersonRow[]>(
    "schedule_people",
    {
      query: {
        select: "id,name",
        schedule_id: `eq.${scheduleId}`,
        order: "order_index.asc",
      },
    }
  );

  return refreshed;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const { person, slotId, replaceValue, dateLabel } = body || {};

  if (!person || !slotId) {
    return NextResponse.json(
      { error: "Missing person or slot." },
      { status: 400 }
    );
  }

  const isoDate = toIsoDate(dateLabel);
  if (!isoDate) {
    return NextResponse.json(
      { error: "Missing schedule date." },
      { status: 400 }
    );
  }

  try {
    const { tasks, note } = parseCell(replaceValue || "");
    const hasContent = tasks.length > 0 || note.trim().length > 0;

    let scheduleRows = await supabaseRequest<ScheduleRow[]>("schedules", {
      query: {
        select: "id",
        schedule_date: `eq.${isoDate}`,
        state: "eq.staging",
        limit: 1,
      },
    });

    let scheduleId = scheduleRows?.[0]?.id || null;

    if (!scheduleId && !hasContent) {
      return NextResponse.json({ ok: true });
    }

    if (!scheduleId) {
      const created = await supabaseRequest<ScheduleRow[]>("schedules", {
        method: "POST",
        prefer: "return=representation",
        body: {
          schedule_date: isoDate,
          state: "staging",
        },
      });
      scheduleId = created?.[0]?.id || null;
    }

    if (!scheduleId) {
      return NextResponse.json(
        { error: "Unable to create schedule." },
        { status: 500 }
      );
    }

    const volunteers = await fetchVolunteers();
    const people = await ensureSchedulePeople(scheduleId, volunteers);
    const personEntry = people.find((entry) => entry.name === person);

    if (!personEntry) {
      return NextResponse.json(
        { error: "Person not found in schedule." },
        { status: 400 }
      );
    }

    if (!hasContent) {
      await supabaseRequest("schedule_cells", {
        method: "DELETE",
        query: {
          schedule_id: `eq.${scheduleId}`,
          person_id: `eq.${personEntry.id}`,
          shift_id: `eq.${slotId}`,
        },
      });

      const remaining = await supabaseRequest<ScheduleCellRow[]>(
        "schedule_cells",
        {
          query: {
            select: "id",
            schedule_id: `eq.${scheduleId}`,
            limit: 1,
          },
        }
      );

      if (!remaining.length) {
        await supabaseRequest("schedules", {
          method: "DELETE",
          query: { id: `eq.${scheduleId}` },
        });
      }

      return NextResponse.json({ ok: true });
    }

    await supabaseRequest("schedule_cells", {
      method: "POST",
      prefer: "resolution=merge-duplicates,return=representation",
      query: {
        on_conflict: "schedule_id,person_id,shift_id",
      },
      body: {
        schedule_id: scheduleId,
        person_id: personEntry.id,
        shift_id: slotId,
        tasks,
        note: note.trim() || null,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to update schedule", err);
    return NextResponse.json(
      { error: "Unable to update schedule." },
      { status: 500 }
    );
  }
}
