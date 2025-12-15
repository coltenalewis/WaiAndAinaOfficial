"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { loadSession } from "@/lib/session";

export default function AdminPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const session = loadSession();
    if (!session || !session.name) {
      router.replace("/");
      return;
    }

    const userType = (session.userType || "").toLowerCase();
    if (userType === "admin") {
      setAuthorized(true);
    } else {
      setMessage("You need admin access to generate reports.");
    }
  }, [router]);

  async function handleCreateReport() {
    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch("/api/reports", { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to create report");
      }
      setMessage("Daily report created successfully. Check Notion to review it.");
    } catch (err: any) {
      setMessage(err?.message || "Failed to create report.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6">
      <div className="rounded-2xl border border-[#d0c9a4] bg-white/70 p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-[#7a7f54]">
              Reports
            </p>
            <h1 className="text-2xl font-semibold text-[#314123]">
              Daily Report Builder
            </h1>
            <p className="text-sm text-[#5f5a3b]">
              Create a Notion report for the currently selected schedule, including
              task assignments, notes, statuses, and comments.
            </p>
          </div>
          <button
            type="button"
            disabled={!authorized || loading}
            onClick={handleCreateReport}
            className="rounded-md bg-[#a0b764] px-4 py-2 text-sm font-semibold uppercase tracking-[0.12em] text-[#f9f9ec] shadow-md transition hover:bg-[#93a95d] disabled:opacity-50"
          >
            {loading ? "Creating…" : "Create Daily Report"}
          </button>
        </div>
        <div className="mt-4 rounded-lg bg-[#f6f1dd] p-4 text-sm text-[#4b5133]">
          <ul className="list-disc space-y-1 pl-5">
            <li>Uses the schedule date configured in Notion Settings.</li>
            <li>Captures every assignment, status, description, extra notes, and comments.</li>
            <li>Saves the report under the Reports database as a dated entry.</li>
          </ul>
        </div>
        {message ? (
          <p className="mt-3 text-sm font-semibold text-[#4b5133]">{message}</p>
        ) : null}
      </div>
      {!authorized ? (
        <div className="rounded-xl border border-[#e2d7b5] bg-[#f9f6e7] p-4 text-sm text-[#7a7f54]">
          Only administrators can create reports. If you need access, please contact a site admin.
        </div>
      ) : null}
    </div>
  );
}
