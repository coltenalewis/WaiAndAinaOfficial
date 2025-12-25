import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const listOnly = searchParams.get("list");
  const name = searchParams.get("name") || "";

  if (listOnly) {
    return NextResponse.json({ tasks: [] });
  }

  if (!name.trim()) {
    return NextResponse.json({ error: "Missing task name" }, { status: 400 });
  }

  return NextResponse.json({
    name,
    description: "",
    extraNotes: "",
    status: "",
    comments: [],
    media: [],
    links: [],
    taskType: { name: "", color: "default" },
    estimatedTime: "",
    properties: [],
  });
}

export async function PATCH() {
  return NextResponse.json({ success: true });
}

export async function POST() {
  return NextResponse.json({ success: true });
}
