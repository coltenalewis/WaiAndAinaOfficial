"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { loadSession } from "@/lib/session";

type ReportPayload = {
  id: string;
  report_date: string;
  date_label: string;
  data: {
    scheduleDate: string;
    people: string[];
    slots: { id: string; label: string; timeRange?: string | null }[];
    cells: Array<{ tasks: { id?: string; name: string }[]; note: string }[] | string[]>;
    peopleSummary?: {
      person: string;
      taskCount: number;
      tasks: { id?: string; name: string }[];
      notes: string[];
    }[];
    shiftSummary?: {
      slot: string;
      timeRange?: string | null;
      taskCount: number;
      tasks: { id?: string; name: string }[];
    }[];
    notes?: string[];
  };
  created_at: string;
  created_by?: string | null;
};

export default function AnalyticsReportPage() {
  const params = useParams<{ reportId: string }>();
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [report, setReport] = useState<ReportPayload | null>(null);

  useEffect(() => {
    const session = loadSession();
    if (!session?.name) {
      router.replace("/");
      return;
    }
    const isAdmin = (session.userType || "").toLowerCase() === "admin";
    if (!isAdmin) {
      setMessage("Admin access required.");
      return;
    }
    setAuthorized(true);
  }, [router]);

  useEffect(() => {
    if (!authorized) return;
    const loadReport = async () => {
      try {
        const res = await fetch(`/api/reports?id=${params.reportId}`);
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error || "Unable to load report.");
        }
        setReport(json.report);
      } catch (err: any) {
        console.error("Failed to load report", err);
        setMessage(err?.message || "Unable to load report.");
      }
    };
    loadReport();
  }, [authorized, params.reportId]);

  if (!authorized) {
    return (
      <div className="mx-auto max-w-4xl p-6 text-sm text-[#7a7f54]">
        {message || "Checking access..."}
      </div>
    );
  }

  if (!report) {
    return (
      <div className="mx-auto max-w-4xl p-6 text-sm text-[#7a7f54]">
        {message || "Loading report..."}
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6">
      <div className="rounded-3xl border border-[#d0c9a4] bg-white/80 p-6 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-[#7a7f54]">Report</p>
            <h1 className="text-2xl font-semibold text-[#314123]">
              Day Snapshot · {report.date_label}
            </h1>
            <p className="text-sm text-[#5f5a3b]">
              Created {new Date(report.created_at).toLocaleString()}
              {report.created_by ? ` by ${report.created_by}` : ""}.
            </p>
          </div>
          <Link
            href="/hub/admin/analytics"
            className="rounded-md border border-[#d0c9a4] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-[#314123] shadow-sm transition hover:bg-[#f1edd8]"
          >
            Back to analytics
          </Link>
        </div>
      </div>

      <div className="rounded-2xl border border-[#d0c9a4] bg-white/80 p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-[#314123]">People summary</h2>
        <div className="mt-4 space-y-3">
          {(report.data.peopleSummary || []).map((person) => (
            <div
              key={person.person}
              className="rounded-xl border border-[#e2d7b5] bg-white/80 px-4 py-3"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[#314123]">{person.person}</span>
                <span className="text-xs text-[#6a6c4d]">
                  {person.taskCount} tasks
                </span>
              </div>
              {person.tasks.length > 0 && (
                <p className="mt-2 text-xs text-[#4b5133]">
                  {person.tasks.map((task) => task.name).join(", ")}
                </p>
              )}
              {person.notes.length > 0 && (
                <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-[#4b5133]">
                  {person.notes.map((note, idx) => (
                    <li key={`${person.person}-note-${idx}`}>{note}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-[#d0c9a4] bg-white/80 p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-[#314123]">Shift summary</h2>
        <div className="mt-4 space-y-3">
          {(report.data.shiftSummary || []).map((shift) => (
            <div
              key={shift.slot}
              className="rounded-xl border border-[#e2d7b5] bg-white/80 px-4 py-3"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[#314123]">{shift.slot}</span>
                <span className="text-xs text-[#6a6c4d]">{shift.taskCount} tasks</span>
              </div>
              {shift.timeRange && (
                <p className="mt-1 text-xs text-[#6a6c4d]">{shift.timeRange}</p>
              )}
              {shift.tasks.length > 0 && (
                <p className="mt-2 text-xs text-[#4b5133]">
                  {shift.tasks.map((task) => task.name).join(", ")}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
