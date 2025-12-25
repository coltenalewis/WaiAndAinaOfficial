import { NextResponse } from "next/server";

type TaskTypeOption = { name: string; color: string };
type StatusOption = { name: string; color: string };

const FALLBACK_TYPES: TaskTypeOption[] = [
  { name: "General", color: "default" },
  { name: "Animal Care", color: "green" },
  { name: "Field Work", color: "orange" },
  { name: "Maintenance", color: "blue" },
];

export async function GET() {
  return NextResponse.json({
    types: FALLBACK_TYPES,
    statuses: [
      { name: "Not Started", color: "gray" },
      { name: "In Progress", color: "blue" },
      { name: "Completed", color: "green" },
    ],
  });
}
