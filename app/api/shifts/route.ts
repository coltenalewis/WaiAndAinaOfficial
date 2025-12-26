import { NextResponse } from "next/server";
import { supabaseRequest } from "@/lib/supabase";

export async function GET() {
  try {
    const data = await supabaseRequest<any[]>("shifts", {
      query: { select: "id,label,time_range,order_index", order: "order_index.asc" },
    });
    const shifts = (data || []).map((shift) => ({
      id: shift.id,
      label: shift.label,
      timeRange: shift.time_range || "",
    }));
    return NextResponse.json({ shifts });
  } catch (err) {
    console.error("Failed to load shifts:", err);
    return NextResponse.json({ shifts: [] });
  }
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const { label, timeRange } = body || {};
  if (!label) {
    return NextResponse.json({ error: "Missing label" }, { status: 400 });
  }

  try {
    const existing = await supabaseRequest<any[]>("shifts", {
      query: { select: "order_index", order: "order_index.desc", limit: 1 },
    });
    const nextOrder = (existing?.[0]?.order_index ?? 0) + 1;
    await supabaseRequest("shifts", {
      method: "POST",
      body: {
        label: String(label).trim(),
        time_range: timeRange ? String(timeRange).trim() : null,
        order_index: nextOrder,
      },
    });

    const data = await supabaseRequest<any[]>("shifts", {
      query: { select: "id,label,time_range,order_index", order: "order_index.asc" },
    });
    const shifts = (data || []).map((shift) => ({
      id: shift.id,
      label: shift.label,
      timeRange: shift.time_range || "",
    }));
    return NextResponse.json({ shifts });
  } catch (err) {
    console.error("Failed to create shift:", err);
    return NextResponse.json({ error: "Unable to create shift" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const body = await req.json().catch(() => null);
  const { shifts } = body || {};
  if (!Array.isArray(shifts)) {
    return NextResponse.json({ error: "Missing shifts" }, { status: 400 });
  }

  try {
    await Promise.all(
      shifts.map((shift: any, index: number) =>
        supabaseRequest("shifts", {
          method: "PATCH",
          query: { id: `eq.${shift.id}` },
          body: {
            label: shift.label,
            time_range: shift.timeRange || null,
            order_index: index + 1,
          },
        })
      )
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to update shifts:", err);
    return NextResponse.json({ error: "Unable to update shifts" }, { status: 500 });
  }
}
