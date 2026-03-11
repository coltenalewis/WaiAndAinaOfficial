"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { loadSession } from "@/lib/session";

export default function AdminPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [capabilities, setCapabilities] = useState<Array<{ id: string; name: string }>>([]);
  const [capabilityName, setCapabilityName] = useState("");
  const [capabilityMessage, setCapabilityMessage] = useState<string | null>(null);

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
      setMessage("You need admin access to view admin tools.");
    }
  }, [router]);

  useEffect(() => {
    if (!authorized) return;
    const loadCapabilities = async () => {
      try {
        const res = await fetch("/api/capabilities");
        const json = await res.json();
        setCapabilities(json.capabilities || []);
      } catch (err) {
        console.error("Failed to load capabilities", err);
      }
    };
    loadCapabilities();
  }, [authorized]);

  const handleCreateCapability = async () => {
    const trimmed = capabilityName.trim();
    if (!trimmed) return;
    setCapabilityMessage(null);
    try {
      const res = await fetch("/api/capabilities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) throw new Error("Failed to add capability");
      setCapabilityName("");
      const refreshed = await fetch("/api/capabilities");
      const json = await refreshed.json();
      setCapabilities(json.capabilities || []);
      setCapabilityMessage("Capability added.");
    } catch (err: any) {
      console.error("Failed to add capability", err);
      setCapabilityMessage(err?.message || "Could not add capability.");
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <div className="farm-card rounded-3xl p-6 sm:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="farm-label">Admin hub</p>
            <h1 className="text-2xl sm:text-3xl font-bold farm-heading mt-1">Admin Control Room</h1>
            <p className="text-sm text-[var(--farm-text-muted)] mt-1">
              Jump into schedules, tasks, and user management from one place.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/hub" className="farm-btn farm-btn-outline">
              View live schedule
            </Link>
            <Link href="/hub/admin/milk-production" className="farm-btn farm-btn-primary">
              Milk production
            </Link>
          </div>
        </div>

        {message ? (
          <p className="mt-4 text-sm font-semibold text-[var(--farm-text)]">{message}</p>
        ) : null}

        {!authorized && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Only administrators can access admin tools. If you need access, please contact a site admin.
          </div>
        )}
      </div>

      {authorized && (
        <>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {[
              {
                label: "Schedule",
                title: "Admin schedule",
                description: "Edit the staging schedule, drag tasks, and publish updates.",
                href: "/hub/admin/schedule",
                btnLabel: "Open schedule editor",
                primary: true,
                icon: "📋",
              },
              {
                label: "Shifts",
                title: "Shift editor",
                description: "Update shift names, times, and ordering in one place.",
                href: "/hub/admin/shifts",
                btnLabel: "Open shift editor",
                primary: false,
                icon: "🕐",
              },
              {
                label: "Tasks",
                title: "Task editor",
                description: "Organize recurring tasks, update statuses, and tune task types.",
                href: "/hub/admin/tasks",
                btnLabel: "Open task editor",
                primary: true,
                icon: "📝",
              },
              {
                label: "People",
                title: "User management",
                description: "Add new teammates, edit roles, and manage access in one view.",
                href: "/hub/admin/users",
                btnLabel: "Open user management",
                primary: false,
                icon: "👥",
              },
              {
                label: "Analytics",
                title: "Admin analytics",
                description: "Review daily and weekly workload trends across the farm.",
                href: "/hub/admin/analytics",
                btnLabel: "Open analytics",
                primary: true,
                icon: "📊",
              },
              {
                label: "Milk production",
                title: "Milk reporting",
                description: "Log milk yields and track distribution plans in one place.",
                href: "/hub/admin/milk-production",
                btnLabel: "Open milk production",
                primary: true,
                icon: "🥛",
              },
            ].map((card) => (
              <div key={card.href} className="farm-card group hover:-translate-y-0.5 transition-all duration-200">
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-9 w-9 rounded-xl bg-[var(--farm-bg-highlight)] flex items-center justify-center text-lg shadow-sm">
                    {card.icon}
                  </div>
                  <div>
                    <p className="farm-label text-[10px]">{card.label}</p>
                    <h2 className="text-base font-bold farm-heading">{card.title}</h2>
                  </div>
                </div>
                <p className="text-sm text-[var(--farm-text-muted)] mt-1 mb-4">
                  {card.description}
                </p>
                <Link
                  href={card.href}
                  className={`farm-btn ${card.primary ? "farm-btn-primary" : "farm-btn-outline"} text-[11px]`}
                >
                  {card.btnLabel}
                </Link>
              </div>
            ))}
          </div>

          <div className="farm-card">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="farm-label">Tags</p>
                <h2 className="text-lg font-bold farm-heading mt-0.5">Capability tags</h2>
                <p className="text-sm text-[var(--farm-text-muted)]">
                  Add and review shared capability tags for tasks and users.
                </p>
              </div>
            </div>
            {capabilityMessage && (
              <p className="mt-3 text-sm font-semibold text-[var(--farm-text)]">{capabilityMessage}</p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <input
                value={capabilityName}
                onChange={(e) => setCapabilityName(e.target.value)}
                className="farm-input flex-1"
                placeholder="Add new capability"
              />
              <button
                type="button"
                onClick={handleCreateCapability}
                className="farm-btn farm-btn-primary"
              >
                Add tag
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {capabilities.length ? (
                capabilities.map((capability) => (
                  <span
                    key={capability.id}
                    className="rounded-full border border-[var(--farm-border)] bg-[var(--farm-bg-highlight)] px-3 py-1 text-[11px] font-semibold text-[var(--farm-text-label)]"
                  >
                    {capability.name}
                  </span>
                ))
              ) : (
                <span className="text-xs text-[var(--farm-text-muted)]">No capability tags yet.</span>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
