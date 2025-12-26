"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { loadSession } from "@/lib/session";

type TaskType = { id: string; name: string; color: string };
type TaskItem = {
  id: string;
  name: string;
  description?: string | null;
  status: string;
  priority: string;
  estimated_time?: string | null;
  recurring: boolean;
  recurrence_interval?: number | null;
  recurrence_unit?: string | null;
  recurrence_until?: string | null;
  origin_date?: string | null;
  occurrence_date?: string | null;
  person_count?: number | null;
  links?: string[] | null;
  photos?: string[] | null;
  time_slots?: string[] | null;
  extra_notes?: string[] | null;
  task_type?: TaskType | null;
  task_type_id?: string | null;
};

const STATUS_OPTIONS = ["Not Started", "In Progress", "Completed"];
const PRIORITY_OPTIONS = ["Low", "Medium", "High"];
const RECURRENCE_UNITS = ["day", "month", "year"];
const COLOR_OPTIONS = [
  "default",
  "gray",
  "brown",
  "orange",
  "yellow",
  "green",
  "blue",
  "purple",
  "pink",
  "red",
  "emerald",
];

export default function TaskEditorPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [types, setTypes] = useState<TaskType[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [filters, setFilters] = useState({
    search: "",
    status: "",
    type: "",
    priority: "",
    recurring: "",
    start: "",
    end: "",
    includeOccurrences: "",
  });

  const [editorOpen, setEditorOpen] = useState(false);
  const [applyTo, setApplyTo] = useState<"single" | "future" | "all">("single");
  const [editing, setEditing] = useState<TaskItem | null>(null);
  const [draft, setDraft] = useState<TaskItem>({
    id: "",
    name: "",
    description: "",
    status: "Not Started",
    priority: "Medium",
    estimated_time: "",
    recurring: false,
    recurrence_interval: null,
    recurrence_unit: "day",
    recurrence_until: "",
    origin_date: "",
    occurrence_date: "",
    person_count: null,
    links: [],
    photos: [],
    time_slots: [],
    extra_notes: [],
    task_type_id: "",
  });

  const [typeEditor, setTypeEditor] = useState({ name: "", color: "default" });

  useEffect(() => {
    const session = loadSession();
    if (!session?.name) {
      router.replace("/");
      return;
    }
    const isAdmin = (session.userType || "").toLowerCase() === "admin";
    if (!isAdmin) {
      setMessage("Admin access required to edit tasks.");
      return;
    }
    setAuthorized(true);
  }, [router]);

  async function loadTaskTypes() {
    try {
      const res = await fetch("/api/task-types");
      const json = await res.json();
      setTypes(json.types || []);
    } catch (err) {
      console.error("Failed to load task types", err);
    }
  }

  async function loadTasks() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.set(key, value);
      });
      const res = await fetch(`/api/tasks?${params.toString()}`);
      const json = await res.json();
      setTasks(json.tasks || []);
    } catch (err) {
      console.error("Failed to load tasks", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!authorized) return;
    loadTaskTypes();
    loadTasks();
  }, [authorized]);

  useEffect(() => {
    if (!authorized) return;
    const timeout = setTimeout(() => loadTasks(), 200);
    return () => clearTimeout(timeout);
  }, [filters, authorized]);

  function openEditor(task?: TaskItem) {
    if (task) {
      setEditing(task);
      setDraft({
        ...task,
        task_type_id: task.task_type?.id || task.task_type_id || "",
        recurrence_interval: task.recurrence_interval ?? null,
        recurrence_unit: task.recurrence_unit ?? "day",
      });
    } else {
      setEditing(null);
      setDraft({
        id: "",
        name: "",
        description: "",
        status: "Not Started",
        priority: "Medium",
        estimated_time: "",
        recurring: false,
        recurrence_interval: null,
        recurrence_unit: "day",
        recurrence_until: "",
        origin_date: "",
        occurrence_date: "",
        person_count: null,
        links: [],
        photos: [],
        time_slots: [],
        extra_notes: [],
        task_type_id: "",
      });
    }
    setApplyTo("single");
    setEditorOpen(true);
  }

  async function handleSave() {
    if (!draft.name.trim()) {
      setMessage("Task name is required.");
      return;
    }
    setSaving(true);
    setMessage(null);

    const payload: Record<string, unknown> = {
      name: draft.name.trim(),
      description: draft.description || null,
      status: draft.status,
      priority: draft.priority,
      task_type_id: draft.task_type_id || null,
      estimated_time: draft.estimated_time || null,
      recurring: draft.recurring,
      recurrence_interval: draft.recurring ? Number(draft.recurrence_interval || 1) : null,
      recurrence_unit: draft.recurring ? draft.recurrence_unit || "day" : null,
      recurrence_until: draft.recurring ? draft.recurrence_until || null : null,
      origin_date: draft.origin_date || null,
      occurrence_date: draft.occurrence_date || null,
      person_count: draft.person_count ?? null,
      links: draft.links || [],
      photos: draft.photos || [],
      time_slots: draft.time_slots || [],
      extra_notes: draft.extra_notes || [],
    };

    try {
      if (editing?.id) {
        await fetch("/api/tasks", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editing.id,
            applyTo,
            occurrenceDate: editing.occurrence_date,
            ...payload,
          }),
        });
        setMessage("Task updated.");
      } else {
        await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        setMessage("Task created.");
      }
      setEditorOpen(false);
      await loadTasks();
    } catch (err) {
      console.error("Failed to save task", err);
      setMessage("Unable to save task.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateType() {
    if (!typeEditor.name.trim()) return;
    try {
      await fetch("/api/task-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(typeEditor),
      });
      setTypeEditor({ name: "", color: "default" });
      await loadTaskTypes();
    } catch (err) {
      console.error("Failed to create type", err);
    }
  }

  async function handleUpdateType(type: TaskType) {
    try {
      await fetch("/api/task-types", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(type),
      });
      await loadTaskTypes();
    } catch (err) {
      console.error("Failed to update type", err);
    }
  }

  const filteredTasks = useMemo(() => tasks, [tasks]);

  if (!authorized) {
    return (
      <div className="mx-auto max-w-3xl p-6 text-sm text-[#7a7f54]">
        {message || "Checking access..."}
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6">
      <div className="rounded-2xl border border-[#d0c9a4] bg-white/70 p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-[#7a7f54]">Admin</p>
            <h1 className="text-2xl font-semibold text-[#314123]">Task Editor</h1>
            <p className="text-sm text-[#5f5a3b]">
              Manage tasks, recurrence rules, and task types for the schedule system.
            </p>
          </div>
          <button
            type="button"
            onClick={() => openEditor()}
            className="rounded-md bg-[#8fae4c] px-4 py-2 text-sm font-semibold uppercase tracking-[0.12em] text-[#f9f9ec] shadow-md transition hover:bg-[#7e9c44]"
          >
            New task
          </button>
        </div>

        {message && <p className="mt-3 text-sm font-semibold text-[#4b5133]">{message}</p>}
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-2xl border border-[#d0c9a4] bg-white/70 p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-[#314123]">Filters</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <input
              value={filters.search}
              onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
              className="w-full rounded-md border border-[#d0c9a4] px-3 py-2 text-sm"
              placeholder="Search tasks"
            />
            <select
              value={filters.status}
              onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
              className="w-full rounded-md border border-[#d0c9a4] px-3 py-2 text-sm"
            >
              <option value="">All statuses</option>
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
            <select
              value={filters.type}
              onChange={(e) => setFilters((prev) => ({ ...prev, type: e.target.value }))}
              className="w-full rounded-md border border-[#d0c9a4] px-3 py-2 text-sm"
            >
              <option value="">All types</option>
              {types.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </select>
            <select
              value={filters.priority}
              onChange={(e) => setFilters((prev) => ({ ...prev, priority: e.target.value }))}
              className="w-full rounded-md border border-[#d0c9a4] px-3 py-2 text-sm"
            >
              <option value="">All priorities</option>
              {PRIORITY_OPTIONS.map((priority) => (
                <option key={priority} value={priority}>
                  {priority}
                </option>
              ))}
            </select>
            <select
              value={filters.recurring}
              onChange={(e) => setFilters((prev) => ({ ...prev, recurring: e.target.value }))}
              className="w-full rounded-md border border-[#d0c9a4] px-3 py-2 text-sm"
            >
              <option value="">Any recurrence</option>
              <option value="true">Recurring only</option>
              <option value="false">One-off only</option>
            </select>
            <select
              value={filters.includeOccurrences}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, includeOccurrences: e.target.value }))
              }
              className="w-full rounded-md border border-[#d0c9a4] px-3 py-2 text-sm"
            >
              <option value="">Hide occurrences</option>
              <option value="true">Show occurrences</option>
            </select>
            <div className="flex gap-2">
              <input
                type="date"
                value={filters.start}
                onChange={(e) => setFilters((prev) => ({ ...prev, start: e.target.value }))}
                className="w-full rounded-md border border-[#d0c9a4] px-3 py-2 text-sm"
              />
              <input
                type="date"
                value={filters.end}
                onChange={(e) => setFilters((prev) => ({ ...prev, end: e.target.value }))}
                className="w-full rounded-md border border-[#d0c9a4] px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="mt-4">
            {loading ? (
              <p className="text-sm text-[#7a7f54]">Loading tasks…</p>
            ) : (
              <div className="space-y-2">
                {filteredTasks.map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => openEditor(task)}
                    className="w-full rounded-lg border border-[#e2d7b5] bg-white/80 px-4 py-3 text-left shadow-sm transition hover:bg-[#f7f3df]"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-[#314123]">{task.name}</h3>
                        <p className="text-[11px] text-[#6b6d4b]">
                          {task.task_type?.name || "Unassigned"} · {task.status} · {task.priority}
                        </p>
                      </div>
                      {task.recurring && (
                        <span className="rounded-full bg-[#e2f0c8] px-2 py-1 text-[10px] font-semibold uppercase text-[#476524]">
                          Recurring
                        </span>
                      )}
                    </div>
                  </button>
                ))}
                {!filteredTasks.length && (
                  <p className="text-sm text-[#7a7f54]">No tasks found.</p>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-[#d0c9a4] bg-white/70 p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-[#314123]">Task type editor</h2>
          <div className="mt-3 space-y-3">
            {types.map((type) => (
              <div key={type.id} className="flex items-center gap-2">
                <input
                  value={type.name}
                  onChange={(e) =>
                    setTypes((prev) =>
                      prev.map((t) => (t.id === type.id ? { ...t, name: e.target.value } : t))
                    )
                  }
                  className="flex-1 rounded-md border border-[#d0c9a4] px-3 py-2 text-sm"
                />
                <select
                  value={type.color}
                  onChange={(e) =>
                    setTypes((prev) =>
                      prev.map((t) => (t.id === type.id ? { ...t, color: e.target.value } : t))
                    )
                  }
                  className="rounded-md border border-[#d0c9a4] px-2 py-2 text-sm"
                >
                  {COLOR_OPTIONS.map((color) => (
                    <option key={color} value={color}>
                      {color}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => handleUpdateType(type)}
                  className="rounded-md bg-[#a0b764] px-3 py-2 text-xs font-semibold uppercase text-white"
                >
                  Save
                </button>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-lg border border-[#e2d7b5] bg-[#f9f6e7] p-4">
            <h3 className="text-sm font-semibold text-[#314123]">Add new type</h3>
            <div className="mt-2 flex gap-2">
              <input
                value={typeEditor.name}
                onChange={(e) => setTypeEditor((prev) => ({ ...prev, name: e.target.value }))}
                className="flex-1 rounded-md border border-[#d0c9a4] px-3 py-2 text-sm"
                placeholder="Type name"
              />
              <select
                value={typeEditor.color}
                onChange={(e) => setTypeEditor((prev) => ({ ...prev, color: e.target.value }))}
                className="rounded-md border border-[#d0c9a4] px-2 py-2 text-sm"
              >
                {COLOR_OPTIONS.map((color) => (
                  <option key={color} value={color}>
                    {color}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleCreateType}
                className="rounded-md bg-[#8fae4c] px-3 py-2 text-xs font-semibold uppercase text-white"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      </div>

      {editorOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4 py-6">
          <div className="w-full max-w-3xl rounded-2xl border border-[#d0c9a4] bg-[#fdfaf1] p-5 shadow-xl">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-[#314123]">
                {editing ? "Edit task" : "New task"}
              </h2>
              <button
                type="button"
                onClick={() => setEditorOpen(false)}
                className="text-sm font-semibold text-[#4b5133]"
              >
                Close
              </button>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase text-[#6b6f4c]">Task name</label>
                <input
                  value={draft.name}
                  onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full rounded-md border border-[#d0c9a4] px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase text-[#6b6f4c]">Task type</label>
                <select
                  value={draft.task_type_id || ""}
                  onChange={(e) => setDraft((prev) => ({ ...prev, task_type_id: e.target.value }))}
                  className="w-full rounded-md border border-[#d0c9a4] px-3 py-2 text-sm"
                >
                  <option value="">Unassigned</option>
                  {types.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase text-[#6b6f4c]">Status</label>
                <select
                  value={draft.status}
                  onChange={(e) => setDraft((prev) => ({ ...prev, status: e.target.value }))}
                  className="w-full rounded-md border border-[#d0c9a4] px-3 py-2 text-sm"
                >
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase text-[#6b6f4c]">Priority</label>
                <select
                  value={draft.priority}
                  onChange={(e) => setDraft((prev) => ({ ...prev, priority: e.target.value }))}
                  className="w-full rounded-md border border-[#d0c9a4] px-3 py-2 text-sm"
                >
                  {PRIORITY_OPTIONS.map((priority) => (
                    <option key={priority} value={priority}>
                      {priority}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase text-[#6b6f4c]">Estimated time</label>
                <input
                  value={draft.estimated_time || ""}
                  onChange={(e) => setDraft((prev) => ({ ...prev, estimated_time: e.target.value }))}
                  className="w-full rounded-md border border-[#d0c9a4] px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase text-[#6b6f4c]">People needed</label>
                <input
                  type="number"
                  value={draft.person_count ?? ""}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      person_count: e.target.value ? Number(e.target.value) : null,
                    }))
                  }
                  className="w-full rounded-md border border-[#d0c9a4] px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <label className="text-xs font-semibold uppercase text-[#6b6f4c]">Description</label>
              <textarea
                value={draft.description || ""}
                onChange={(e) => setDraft((prev) => ({ ...prev, description: e.target.value }))}
                className="w-full rounded-md border border-[#d0c9a4] px-3 py-2 text-sm"
                rows={3}
              />
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase text-[#6b6f4c]">Origin date</label>
                <input
                  type="date"
                  value={draft.origin_date || ""}
                  onChange={(e) => setDraft((prev) => ({ ...prev, origin_date: e.target.value }))}
                  className="w-full rounded-md border border-[#d0c9a4] px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase text-[#6b6f4c]">Occurrence date</label>
                <input
                  type="date"
                  value={draft.occurrence_date || ""}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, occurrence_date: e.target.value }))
                  }
                  className="w-full rounded-md border border-[#d0c9a4] px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-[#e2d7b5] bg-[#f9f6e7] p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase text-[#6b6f4c]">Recurrence</p>
                  <p className="text-[11px] text-[#6f754f]">
                    Set repeating tasks similar to Google Calendar rules.
                  </p>
                </div>
                <label className="flex items-center gap-2 text-sm font-semibold text-[#4b5133]">
                  <input
                    type="checkbox"
                    checked={draft.recurring}
                    onChange={(e) => setDraft((prev) => ({ ...prev, recurring: e.target.checked }))}
                  />
                  Recurring
                </label>
              </div>
              {draft.recurring && (
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <div className="space-y-1">
                    <label className="text-[11px] uppercase text-[#6b6f4c]">Every</label>
                    <input
                      type="number"
                      min={1}
                      value={draft.recurrence_interval ?? 1}
                      onChange={(e) =>
                        setDraft((prev) => ({
                          ...prev,
                          recurrence_interval: Number(e.target.value),
                        }))
                      }
                      className="w-full rounded-md border border-[#d0c9a4] px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] uppercase text-[#6b6f4c]">Unit</label>
                    <select
                      value={draft.recurrence_unit || "day"}
                      onChange={(e) =>
                        setDraft((prev) => ({ ...prev, recurrence_unit: e.target.value }))
                      }
                      className="w-full rounded-md border border-[#d0c9a4] px-3 py-2 text-sm"
                    >
                      {RECURRENCE_UNITS.map((unit) => (
                        <option key={unit} value={unit}>
                          {unit}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] uppercase text-[#6b6f4c]">Until</label>
                    <input
                      type="date"
                      value={draft.recurrence_until || ""}
                      onChange={(e) =>
                        setDraft((prev) => ({ ...prev, recurrence_until: e.target.value }))
                      }
                      className="w-full rounded-md border border-[#d0c9a4] px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              )}
            </div>

            {editing?.recurring && (
              <div className="mt-4 rounded-lg border border-[#d0c9a4] bg-white px-4 py-3">
                <p className="text-xs font-semibold uppercase text-[#6b6f4c]">
                  Apply edits to
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {["single", "future", "all"].map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setApplyTo(option as "single" | "future" | "all")}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                        applyTo === option
                          ? "border-[#8fae4c] bg-[#a0b764] text-white"
                          : "border-[#d0c9a4] bg-white text-[#4f5730]"
                      }`}
                    >
                      {option === "single"
                        ? "Just this task"
                        : option === "future"
                          ? "This + future"
                          : "All in series"}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase text-[#6b6f4c]">Time slots</label>
                <input
                  value={(draft.time_slots || []).join(", ")}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      time_slots: e.target.value
                        .split(",")
                        .map((slot) => slot.trim())
                        .filter(Boolean),
                    }))
                  }
                  className="w-full rounded-md border border-[#d0c9a4] px-3 py-2 text-sm"
                  placeholder="Morning, Afternoon"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase text-[#6b6f4c]">Links</label>
                <input
                  value={(draft.links || []).join(", ")}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      links: e.target.value
                        .split(",")
                        .map((link) => link.trim())
                        .filter(Boolean),
                    }))
                  }
                  className="w-full rounded-md border border-[#d0c9a4] px-3 py-2 text-sm"
                  placeholder="https://example.com"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase text-[#6b6f4c]">Extra notes</label>
                <input
                  value={(draft.extra_notes || []).join(", ")}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      extra_notes: e.target.value
                        .split(",")
                        .map((note) => note.trim())
                        .filter(Boolean),
                    }))
                  }
                  className="w-full rounded-md border border-[#d0c9a4] px-3 py-2 text-sm"
                  placeholder="Bring gloves, water"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase text-[#6b6f4c]">Photos</label>
                <input
                  value={(draft.photos || []).join(", ")}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      photos: e.target.value
                        .split(",")
                        .map((photo) => photo.trim())
                        .filter(Boolean),
                    }))
                  }
                  className="w-full rounded-md border border-[#d0c9a4] px-3 py-2 text-sm"
                  placeholder="Image URLs"
                />
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditorOpen(false)}
                className="rounded-md border border-[#d0c9a4] bg-white px-4 py-2 text-xs font-semibold uppercase text-[#4f5730]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="rounded-md bg-[#8fae4c] px-4 py-2 text-xs font-semibold uppercase text-white disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save task"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
