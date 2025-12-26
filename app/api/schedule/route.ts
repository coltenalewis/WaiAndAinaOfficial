import { NextResponse } from "next/server";
import { supabaseRequest } from "@/lib/supabase";

type SlotRow = {
  id: string;
  label: string;
  time_range: string | null;
};

type ScheduleRow = {
  id: string;
};

type SchedulePersonRow = {
  id: string;
  name: string;
  order_index: number;
};

type ScheduleCellRow = {
  id: string;
  person_id: string;
  shift_id: string;
  tasks: string[];
  note: string | null;
};

type UserRow = {
  display_name: string;
  active: boolean;
  user_role?: { name?: string | null };
};

type Slot = { id: string; label: string; timeRange?: string; isMeal?: boolean };

function toIsoDate(label?: string | null) {
  if (!label) return null;
  if (label.includes("-")) return label;
  const [month, day, year] = label.split("/");
  if (!month || !day || !year) return null;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function toLabel(date: string) {
  const [year, month, day] = date.split("-");
  if (!year || !month || !day) return date;
  return `${month}/${day}/${year}`;
}

function serializeCell(tasks: string[], note?: string | null) {
  const line = tasks.join(", ").trim();
  const cleanedNote = (note || "").trim();
  return [line, cleanedNote].filter(Boolean).join("\n");
}

function isMealShift(label: string) {
  const lower = label.toLowerCase();
  return ["breakfast", "lunch", "dinner"].some((item) => lower.includes(item));
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

async function fetchSlots(): Promise<Slot[]> {
  const rows = await supabaseRequest<SlotRow[]>("shifts", {
    query: {
      select: "id,label,time_range,order_index",
      order: "order_index.asc",
    },
  });

  return rows.map((slot) => ({
    id: slot.id,
    label: slot.label,
    timeRange: slot.time_range || undefined,
    isMeal: isMealShift(slot.label),
  }));
}

async function syncSchedulePeople(scheduleId: string, volunteers: string[]) {
  const people = await supabaseRequest<SchedulePersonRow[]>("schedule_people", {
    query: {
      select: "id,name,order_index",
      schedule_id: `eq.${scheduleId}`,
      order: "order_index.asc",
    },
  });

  const existingNames = new Map(
    people.map((person) => [person.name, person])
  );
  const desiredSet = new Set(volunteers);
  const missing = volunteers.filter((name) => !existingNames.has(name));
  const extra = people.filter((person) => !desiredSet.has(person.name));

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

  if (extra.length) {
    await supabaseRequest("schedule_people", {
      method: "DELETE",
      query: {
        schedule_id: `eq.${scheduleId}`,
        name: `in.(${extra.map((person) => `"${person.name}"`).join(",")})`,
      },
    });
  }

  await Promise.all(
    people.map((person) => {
      const nextIndex = volunteers.indexOf(person.name);
      if (nextIndex < 0) return Promise.resolve(null);
      if (person.order_index === nextIndex + 1) return Promise.resolve(null);
      return supabaseRequest("schedule_people", {
        method: "PATCH",
        query: { id: `eq.${person.id}` },
        body: { order_index: nextIndex + 1 },
      });
    })
  );

  return supabaseRequest<SchedulePersonRow[]>("schedule_people", {
    query: {
      select: "id,name,order_index",
      schedule_id: `eq.${scheduleId}`,
      order: "order_index.asc",
    },
  });
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const dateLabel = url.searchParams.get("date") || "";
    const isoDate = toIsoDate(dateLabel);
    if (!isoDate) {
      return NextResponse.json(
        { error: "Missing or invalid date." },
        { status: 400 }
      );
    }

    const [slots, volunteers] = await Promise.all([
      fetchSlots(),
      fetchVolunteers(),
    ]);

    const scheduleRows = await supabaseRequest<ScheduleRow[]>("schedules", {
      query: {
        select: "id",
        schedule_date: `eq.${isoDate}`,
        state: "eq.staging",
        limit: 1,
      },
    });

    const scheduleId = scheduleRows?.[0]?.id || null;

    if (!scheduleId) {
      const emptyCells = volunteers.map(() => slots.map(() => ""));
      return NextResponse.json({
        people: volunteers,
        slots,
        cells: emptyCells,
        scheduleDate: toLabel(isoDate),
      });
    }

    const schedulePeople = await syncSchedulePeople(scheduleId, volunteers);
    const cells = await supabaseRequest<ScheduleCellRow[]>("schedule_cells", {
      query: {
        select: "id,person_id,shift_id,tasks,note",
        schedule_id: `eq.${scheduleId}`,
      },
    });

    const cellMap = new Map<string, ScheduleCellRow>();
    cells.forEach((cell) => {
      cellMap.set(`${cell.person_id}-${cell.shift_id}`, cell);
    });

    const matrix = schedulePeople.map((person) =>
      slots.map((slot) => {
        const cell = cellMap.get(`${person.id}-${slot.id}`);
        if (!cell) return "";
        return serializeCell(cell.tasks || [], cell.note);
      })
    );

    return NextResponse.json({
      people: schedulePeople.map((person) => person.name),
      slots,
      cells: matrix,
      scheduleDate: toLabel(isoDate),
    });
  } catch (err) {
    console.error("Failed to load schedule", err);
    return NextResponse.json(
      { error: "Unable to load schedule" },
      { status: 500 }
    );
  }
}
