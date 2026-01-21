"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { loadSession } from "@/lib/session";

type ReportPayload = {
  id: string;
  report_date: string;
  date_label: string;
  report_title?: string | null;
  summary?: {
    reportTitle?: string;
    scheduleDate?: string;
    peopleCount?: number;
    shiftsCount?: number;
    totalTasks?: number;
    totalNotes?: number;
  } | null;
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
  const [downloading, setDownloading] = useState(false);

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

  const handleDownloadPdf = () => {
    if (typeof window === "undefined") return;
    setDownloading(true);
    window.requestAnimationFrame(() => {
      window.print();
      setDownloading(false);
    });
  };

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

  const reportTitle =
    report.report_title || report.summary?.reportTitle || "Daily Operations Report";
  const totalTasks =
    report.summary?.totalTasks ??
    (report.data.shiftSummary || []).reduce((sum, shift) => sum + shift.taskCount, 0);
  const totalNotes = report.summary?.totalNotes ?? (report.data.notes || []).length;
  const peopleCount = report.summary?.peopleCount ?? report.data.people.length;
  const shiftsCount = report.summary?.shiftsCount ?? report.data.slots.length;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6">
      <div className="rounded-3xl border border-[#d0c9a4] bg-white/80 p-6 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-[#7a7f54]">Report</p>
            <h1 className="text-2xl font-semibold text-[#314123]">{reportTitle}</h1>
            <p className="text-sm text-[#5f5a3b]">
              {report.date_label} · Created {new Date(report.created_at).toLocaleString()}
              {report.created_by ? ` by ${report.created_by}` : ""}.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 print-hidden">
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={downloading}
              className="rounded-md bg-[#314123] px-4 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-white shadow-sm transition hover:bg-[#2a371f] disabled:opacity-60"
            >
              {downloading ? "Preparing PDF…" : "Download PDF"}
            </button>
            <Link
              href="/hub/admin/analytics"
              className="rounded-md border border-[#d0c9a4] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-[#314123] shadow-sm transition hover:bg-[#f1edd8]"
            >
              Back to analytics
            </Link>
            <span className="text-[11px] uppercase tracking-[0.12em] text-[#7a7f54]">
              Save as PDF in the print dialog
            </span>
          </div>
        </div>
      </div>

      <div className="print-page rounded-[32px] border border-[#e1d8b6] bg-white p-8 shadow-[0_20px_60px_rgba(49,65,35,0.12)]">
        <div className="flex flex-col gap-6 border-b border-[#ece3c4] pb-6">
          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.26em] text-[#7a7f54]">
                Wai & Aina · Admin Report
              </p>
              <h2 className="text-3xl font-semibold text-[#314123]">{reportTitle}</h2>
              <p className="text-sm text-[#5f5a3b]">
                Report date: {report.date_label}
              </p>
            </div>
            <div className="rounded-2xl border border-[#e2d7b5] bg-[#f9f6e7] px-4 py-3 text-xs text-[#4b5133]">
              <div className="font-semibold uppercase tracking-[0.12em] text-[#7a7f54]">
                Prepared
              </div>
              <div>{new Date(report.created_at).toLocaleDateString()}</div>
              {report.created_by && <div>by {report.created_by}</div>}
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-4">
            {[
              { label: "People", value: peopleCount },
              { label: "Shifts", value: shiftsCount },
              { label: "Tasks", value: totalTasks },
              { label: "Notes", value: totalNotes },
            ].map((metric) => (
              <div
                key={metric.label}
                className="rounded-2xl border border-[#e2d7b5] bg-white px-4 py-3"
              >
                <div className="text-[11px] uppercase tracking-[0.18em] text-[#7a7f54]">
                  {metric.label}
                </div>
                <div className="text-2xl font-semibold text-[#314123]">{metric.value}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <div className="rounded-2xl border border-[#e2d7b5] bg-[#faf8ee] p-5">
            <h3 className="text-lg font-semibold text-[#314123]">Executive summary</h3>
            <p className="mt-2 text-sm text-[#4b5133]">
              This report captures the staging schedule for {report.date_label},
              detailing assigned tasks per person and shift, along with operational notes.
              Use this snapshot for staffing reviews, workload balance, and record keeping.
            </p>
            <div className="mt-4 grid gap-3 text-xs text-[#4b5133]">
              <div className="flex items-center justify-between border-b border-[#e2d7b5] pb-2">
                <span className="uppercase tracking-[0.12em] text-[#7a7f54]">
                  Schedule Date
                </span>
                <span className="font-semibold">{report.data.scheduleDate}</span>
              </div>
              <div className="flex items-center justify-between border-b border-[#e2d7b5] pb-2">
                <span className="uppercase tracking-[0.12em] text-[#7a7f54]">
                  Total Tasks
                </span>
                <span className="font-semibold">{totalTasks}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="uppercase tracking-[0.12em] text-[#7a7f54]">
                  Notes Captured
                </span>
                <span className="font-semibold">{totalNotes}</span>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-[#e2d7b5] bg-white p-5">
            <h3 className="text-lg font-semibold text-[#314123]">Highlights</h3>
            <ul className="mt-3 space-y-3 text-sm text-[#4b5133]">
              <li className="rounded-lg border border-[#e2d7b5] bg-[#fdfcf8] px-3 py-2">
                Staffing coverage across {shiftsCount} shifts for {peopleCount} people.
              </li>
              <li className="rounded-lg border border-[#e2d7b5] bg-[#fdfcf8] px-3 py-2">
                {totalTasks} tasks assigned with {totalNotes} operational notes recorded.
              </li>
              <li className="rounded-lg border border-[#e2d7b5] bg-[#fdfcf8] px-3 py-2">
                Snapshot stored for historical reference and sharing.
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8">
          <h3 className="text-lg font-semibold text-[#314123]">People summary</h3>
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

        <div className="mt-8">
          <h3 className="text-lg font-semibold text-[#314123]">Shift summary</h3>
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

        {report.data.notes && report.data.notes.length > 0 && (
          <div className="mt-8 rounded-2xl border border-[#e2d7b5] bg-[#fdfcf8] p-5">
            <h3 className="text-lg font-semibold text-[#314123]">Notes log</h3>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-[#4b5133]">
              {report.data.notes.map((note, idx) => (
                <li key={`report-note-${idx}`}>{note}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
