import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    people: [],
    slots: [],
    cells: [],
    reportFlags: [],
    scheduleDate: null,
    reportTime: null,
    taskResetTime: null,
  });
}
