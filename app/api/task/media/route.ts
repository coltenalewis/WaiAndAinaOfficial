import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Task media uploads are currently disabled." },
    { status: 503 }
  );
}
