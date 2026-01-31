"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";
import { loadSession } from "@/lib/session";

type Animal = {
  id: string;
  name: string;
  summary: string;
  dailyCareNotes?: string;
  birthday?: string;
  ageLabel?: string;
  ageMonths: number | null;
  status?: string;
  location?: string;
  tagId?: string;
  microchipId?: string;
  arrivalDate?: string;
  healthStatus?: string;
  weightLbs?: number | null;
  milkingMethod?: string;
  getMilked: boolean;
  type?: { name: string; color?: string };
  behaviors: string[];
  breed?: string;
  gender?: { name: string; color?: string };
  sire?: { id: string; name: string } | null;
  dam?: { id: string; name: string } | null;
  photos: { name: string; url: string }[];
  stats?: Record<string, string | number | boolean>;
};

type Filters = {
  types: { name: string; color?: string }[];
  genders: { name: string; color?: string }[];
};

type AnimalsResponse = {
  animals: Animal[];
  filters?: Filters;
  hasMore?: boolean;
  nextCursor?: string | null;
};

function colorClass(color?: string) {
  switch (color) {
    case "red":
    case "pink":
      return "bg-rose-100 text-rose-700 border-rose-200";
    case "orange":
      return "bg-orange-100 text-orange-700 border-orange-200";
    case "yellow":
      return "bg-amber-100 text-amber-700 border-amber-200";
    case "green":
      return "bg-emerald-100 text-emerald-700 border-emerald-200";
    case "blue":
      return "bg-sky-100 text-sky-700 border-sky-200";
    case "purple":
      return "bg-purple-100 text-purple-700 border-purple-200";
    case "brown":
      return "bg-amber-200 text-amber-800 border-amber-300";
    case "gray":
    case "default":
    default:
      return "bg-stone-100 text-stone-700 border-stone-200";
  }
}

function formatDate(date?: string) {
  if (!date) return "";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function renderCareNotes(notes?: string): ReactNode {
  if (!notes?.trim()) {
    return <p className="text-sm text-[#6a6748]">No daily care notes yet.</p>;
  }

  const pieces: ReactNode[] = [];
  const regex = /(https?:\/\/[^\s]+)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let idx = 0;

  while ((match = regex.exec(notes)) !== null) {
    const textPart = notes.slice(lastIndex, match.index);
    if (textPart) {
      pieces.push(
        <span key={`text-${idx}`} className="whitespace-pre-wrap text-sm text-[#4b5133]">
          {textPart}
        </span>
      );
    }

    const url = match[0];
    const bareUrl = url.split("?")[0];
    const isImage = /(\.png|\.jpe?g|\.gif|\.webp|\.avif)$/i.test(bareUrl);

    pieces.push(
      isImage ? (
        <div key={`img-${idx}`} className="overflow-hidden rounded-md border border-[#e6dfbe]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="Care note" className="w-full max-h-72 object-cover" />
        </div>
      ) : (
        <a
          key={`link-${idx}`}
          href={url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-[#3f5b23] underline decoration-dotted"
        >
          {url}
        </a>
      )
    );

    lastIndex = regex.lastIndex;
    idx += 1;
  }

  const trailing = notes.slice(lastIndex);
  if (trailing) {
    pieces.push(
      <span key="text-final" className="whitespace-pre-wrap text-sm text-[#4b5133]">
        {trailing}
      </span>
    );
  }

  return <div className="space-y-2">{pieces}</div>;
}

export default function AnimalpediaPage() {
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [filters, setFilters] = useState<Filters>({ types: [], genders: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedType, setSelectedType] = useState("");
  const [selectedGender, setSelectedGender] = useState("");
  const [search, setSearch] = useState("");
  const [onlyMilked, setOnlyMilked] = useState(false);
  const [minAge, setMinAge] = useState<string>("");
  const [maxAge, setMaxAge] = useState<string>("");
  const [activeAnimal, setActiveAnimal] = useState<Animal | null>(null);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [currentUserType, setCurrentUserType] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    id: "",
    name: "",
    summary: "",
    dailyCareNotes: "",
    birthday: "",
    arrivalDate: "",
    status: "",
    location: "",
    tagId: "",
    microchipId: "",
    healthStatus: "",
    weightLbs: "",
    milkingMethod: "",
    getMilked: false,
    breed: "",
    behaviors: "",
    typeName: "",
    genderName: "",
    sireId: "",
    damId: "",
    stats: "",
  });

  const genderPresets = useMemo(() => {
    const base = ["Male", "Female", "Fixed", "Fixed Male", "Fixed Female"];
    const fromFilters = filters.genders.map((gender) => gender.name);
    const fromAnimals = animals
      .map((animal) => animal.gender?.name)
      .filter((name): name is string => Boolean(name));
    return Array.from(new Set([...base, ...fromFilters, ...fromAnimals])).sort();
  }, [animals, filters.genders]);

  const breedPresets = useMemo(() => {
    const base = ["Cow", "Goat", "Lamb"];
    const fromAnimals = animals
      .map((animal) => animal.breed)
      .filter((breed): breed is string => Boolean(breed));
    return Array.from(new Set([...base, ...fromAnimals])).sort();
  }, [animals]);

  const birthdayPresets = useMemo(() => {
    const base = ["Unknown"];
    const fromAnimals = animals
      .map((animal) => animal.birthday)
      .filter((birthday): birthday is string => Boolean(birthday));
    return Array.from(new Set([...base, ...fromAnimals])).sort();
  }, [animals]);

  const parentOptions = useMemo(() => {
    return animals
      .map((animal) => ({ id: animal.id, name: animal.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [animals]);

  const availableParents = useMemo(() => {
    if (!draft.id) return parentOptions;
    return parentOptions.filter((parent) => parent.id !== draft.id);
  }, [parentOptions, draft.id]);

  useEffect(() => {
    const session = loadSession();
    setCurrentUserType(session?.userType || null);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const initialSearch = params.get("search") || "";
    if (initialSearch) {
      setSearch(initialSearch);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadAnimals() {
      setLoading(true);
      setError(null);

      try {
        const collected: Animal[] = [];
        let nextCursor: string | null = null;
        let hasMore = true;
        let page = 0;
        let fetchedFilters: Filters | null = null;

        while (hasMore && page < 20) {
          const qs = nextCursor ? `?cursor=${encodeURIComponent(nextCursor)}` : "";
          const res = await fetch(`/api/animals${qs}`);
          if (!res.ok) throw new Error("Failed to fetch animals");

          const data: AnimalsResponse = await res.json();
          collected.push(...(data.animals || []));

          if (!fetchedFilters && data.filters) {
            fetchedFilters = data.filters;
          }

          hasMore = Boolean(data.hasMore && data.nextCursor);
          nextCursor = data.nextCursor || null;
          page += 1;
        }

        if (!cancelled) {
          setAnimals(collected);
          setFilters(fetchedFilters || { types: [], genders: [] });
        }
      } catch (err) {
        if (!cancelled) {
          setError("Could not load animal info. Please try again.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadAnimals();

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredAnimals = useMemo(() => {
    return animals.filter((animal) => {
      if (selectedType && animal.type?.name !== selectedType) return false;
      if (selectedGender && animal.gender?.name !== selectedGender) return false;
      if (onlyMilked && !animal.getMilked) return false;

      const minYears = Number(minAge);
      const maxYears = Number(maxAge);
      const ageMonths = animal.ageMonths ?? null;

      if (!Number.isNaN(minYears) && ageMonths !== null) {
        if (ageMonths < minYears * 12) return false;
      }

      if (!Number.isNaN(maxYears) && ageMonths !== null) {
        if (ageMonths > maxYears * 12) return false;
      }

      const haystack = [
        animal.name,
        animal.summary,
        animal.type?.name,
        animal.dailyCareNotes,
        animal.behaviors.join(" "),
        animal.status,
        animal.location,
        animal.tagId,
        animal.microchipId,
        animal.healthStatus,
      ]
        .join(" ")
        .toLowerCase();

      if (search.trim() && !haystack.includes(search.trim().toLowerCase())) {
        return false;
      }

      return true;
    });
  }, [
    animals,
    selectedType,
    selectedGender,
    onlyMilked,
    minAge,
    maxAge,
    search,
  ]);

  const handleOpen = (animal: Animal) => {
    setActiveAnimal(animal);
    setPhotoIndex(0);
    setUploadError(null);
    setSaveError(null);
    setEditing(false);
    setDraft({
      id: animal.id,
      name: animal.name,
      summary: animal.summary || "",
      dailyCareNotes: animal.dailyCareNotes || "",
      birthday: animal.birthday || "",
      arrivalDate: animal.arrivalDate || "",
      status: animal.status || "",
      location: animal.location || "",
      tagId: animal.tagId || "",
      microchipId: animal.microchipId || "",
      healthStatus: animal.healthStatus || "",
      weightLbs: animal.weightLbs ? String(animal.weightLbs) : "",
      milkingMethod: animal.milkingMethod || "",
      getMilked: Boolean(animal.getMilked),
      breed: animal.breed || "",
      behaviors: animal.behaviors.join(", "),
      typeName: animal.type?.name || "",
      genderName: animal.gender?.name || "",
      sireId: animal.sire?.id || "",
      damId: animal.dam?.id || "",
      stats: animal.stats
        ? Object.entries(animal.stats)
            .map(([key, value]) => `${key}: ${value}`)
            .join("\n")
        : "",
    });
  };

  const nextPhoto = () => {
    if (!activeAnimal) return;
    setPhotoIndex((prev) => (prev + 1) % Math.max(activeAnimal.photos.length, 1));
  };

  const prevPhoto = () => {
    if (!activeAnimal) return;
    setPhotoIndex((prev) => {
      if (!activeAnimal.photos.length) return 0;
      return (prev - 1 + activeAnimal.photos.length) % activeAnimal.photos.length;
    });
  };

  const handlePhotoUpload = async (file: File) => {
    if (!activeAnimal) return;
    setUploading(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("animalId", activeAnimal.id);
      formData.append("name", file.name);
      const res = await fetch("/api/animals/photos", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to upload photo.");
      }
      const nextPhoto = { name: json.name || file.name, url: json.url };
      setAnimals((prev) =>
        prev.map((animal) =>
          animal.id === activeAnimal.id
            ? { ...animal, photos: [...animal.photos, nextPhoto] }
            : animal
        )
      );
      setActiveAnimal((prev) =>
        prev ? { ...prev, photos: [...prev.photos, nextPhoto] } : prev
      );
    } catch (err: any) {
      setUploadError(err?.message || "Unable to upload photo.");
    } finally {
      setUploading(false);
    }
  };

  const isAdmin = (currentUserType || "").toLowerCase() === "admin";

  const statsEntries = useMemo(() => {
    if (!activeAnimal?.stats) return [];
    return Object.entries(activeAnimal.stats)
      .map(([key, value]) => ({
        key,
        label: key.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()),
        value: String(value),
      }))
      .filter((entry) => entry.value.trim());
  }, [activeAnimal]);

  const familyDetails = useMemo(() => {
    if (!activeAnimal) {
      return { sire: null, dam: null, offspring: [], siblings: [] };
    }
    const offspring = animals.filter(
      (animal) =>
        animal.sire?.id === activeAnimal.id || animal.dam?.id === activeAnimal.id
    );
    const siblings = animals.filter((animal) => {
      if (animal.id === activeAnimal.id) return false;
      const sameSire =
        activeAnimal.sire?.id && animal.sire?.id === activeAnimal.sire.id;
      const sameDam = activeAnimal.dam?.id && animal.dam?.id === activeAnimal.dam.id;
      return Boolean(sameSire || sameDam);
    });
    return {
      sire: activeAnimal.sire || null,
      dam: activeAnimal.dam || null,
      offspring,
      siblings,
    };
  }, [activeAnimal, animals]);

  const handleNewAnimal = () => {
    setActiveAnimal({
      id: "",
      name: "",
      summary: "",
      dailyCareNotes: "",
      birthday: "",
      ageLabel: "",
      ageMonths: null,
      arrivalDate: "",
      status: "",
      location: "",
      tagId: "",
      microchipId: "",
      healthStatus: "",
      weightLbs: null,
      milkingMethod: "",
      getMilked: false,
      type: undefined,
      behaviors: [],
      breed: "",
      gender: undefined,
      sire: null,
      dam: null,
      photos: [],
      stats: {},
    });
    setEditing(true);
    setSaveError(null);
    setDraft({
      id: "",
      name: "",
      summary: "",
      dailyCareNotes: "",
      birthday: "",
      arrivalDate: "",
      status: "",
      location: "",
      tagId: "",
      microchipId: "",
      healthStatus: "",
      weightLbs: "",
      milkingMethod: "",
      getMilked: false,
      breed: "",
      behaviors: "",
      typeName: "",
      genderName: "",
      sireId: "",
      damId: "",
      stats: "",
    });
  };

  const parseStats = (raw: string) => {
    return raw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .reduce<Record<string, string>>((acc, line) => {
        const [key, ...rest] = line.split(":");
        if (!key) return acc;
        const value = rest.join(":").trim();
        if (value) {
          acc[key.trim()] = value;
        }
        return acc;
      }, {});
  };

  const computeAge = (birthday?: string) => {
    if (!birthday) return { ageMonths: null, ageLabel: "" };
    const parsed = new Date(birthday);
    if (Number.isNaN(parsed.getTime())) return { ageMonths: null, ageLabel: "" };
    const now = new Date();
    const months =
      (now.getFullYear() - parsed.getFullYear()) * 12 + (now.getMonth() - parsed.getMonth());
    const safeMonths = Math.max(0, months);
    const years = Math.floor(safeMonths / 12);
    const remainingMonths = safeMonths % 12;
    const labelParts = [];
    if (years > 0) labelParts.push(`${years} year${years === 1 ? "" : "s"}`);
    if (remainingMonths > 0 || years === 0) {
      labelParts.push(`${remainingMonths} month${remainingMonths === 1 ? "" : "s"}`);
    }
    return { ageMonths: safeMonths, ageLabel: labelParts.join(" ") };
  };

  const handleSaveAnimal = async () => {
    if (!draft.name.trim()) {
      setSaveError("Name is required.");
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const { ageMonths, ageLabel } = computeAge(draft.birthday);
      const payload = {
        id: draft.id || undefined,
        name: draft.name.trim(),
        summary: draft.summary,
        dailyCareNotes: draft.dailyCareNotes,
        birthday: draft.birthday || null,
        arrivalDate: draft.arrivalDate || null,
        status: draft.status || null,
        location: draft.location || null,
        tagId: draft.tagId || null,
        microchipId: draft.microchipId || null,
        healthStatus: draft.healthStatus || null,
        weightLbs: Number.isFinite(Number(draft.weightLbs)) ? Number(draft.weightLbs) : null,
        ageLabel,
        ageMonths,
        milkingMethod: draft.milkingMethod,
        getMilked: draft.getMilked,
        breed: draft.breed,
        behaviors: draft.behaviors
          .split(",")
          .map((entry) => entry.trim())
          .filter(Boolean),
        typeName: draft.typeName,
        genderName: draft.genderName,
        sireId: draft.sireId || null,
        damId: draft.damId || null,
        stats: parseStats(draft.stats),
      };
      const res = await fetch("/api/animals", {
        method: draft.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Unable to save animal.");
      }
      const saved = json.animal as Animal;
      setAnimals((prev) => {
        const existing = prev.find((item) => item.id === saved.id);
        if (existing) {
          return prev.map((item) => (item.id === saved.id ? saved : item));
        }
        return [saved, ...prev];
      });
      setFilters((prev) => {
        const nextTypes = saved.type?.name
          ? prev.types.some((type) => type.name === saved.type?.name)
            ? prev.types
            : [...prev.types, saved.type]
          : prev.types;
        const nextGenders = saved.gender?.name
          ? prev.genders.some((gender) => gender.name === saved.gender?.name)
            ? prev.genders
            : [...prev.genders, saved.gender]
          : prev.genders;
        return { types: nextTypes, genders: nextGenders };
      });
      setActiveAnimal(saved);
      setEditing(false);
    } catch (err: any) {
      setSaveError(err?.message || "Unable to save animal.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen w-full space-y-6 px-4 pb-10 pt-4 lg:px-10">
      <header className="rounded-2xl bg-gradient-to-r from-[#809f3f] via-[#91ad50] to-[#a7bf62] text-white px-6 py-6 shadow-lg">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-white/80">Healthy herd hub</p>
            <h1 className="text-3xl font-semibold sm:text-4xl">Animalpedia</h1>
            <p className="text-sm text-white/90">
              Track lineage, health status, and daily care notes for every animal on the farm.
            </p>
          </div>
          {isAdmin && (
            <button
              type="button"
              onClick={handleNewAnimal}
              className="mt-3 inline-flex items-center justify-center rounded-full border border-white/60 bg-white/15 px-5 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-white/25 sm:mt-0"
            >
              New animal
            </button>
          )}
        </div>
      </header>

      <div className="rounded-2xl border border-[#d0c9a4] bg-white/90 shadow-sm">
        <div className="grid gap-3 border-b border-[#e7e0c0] p-4 sm:grid-cols-3 lg:grid-cols-4">
          <label className="flex flex-col gap-1 text-sm text-[#4b522d]">
            <span className="text-[11px] uppercase tracking-[0.18em] text-[#7a7f54]">Search</span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or notes"
              className="rounded-lg border border-[#cfd7b0] bg-white px-3 py-2 text-sm text-[#3d4425] shadow-sm focus:border-[#8fae4c] focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-[#4b522d]">
            <span className="text-[11px] uppercase tracking-[0.18em] text-[#7a7f54]">Animal type</span>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="rounded-lg border border-[#cfd7b0] bg-white px-3 py-2 text-sm text-[#3d4425] shadow-sm focus:border-[#8fae4c] focus:outline-none"
            >
              <option value="">All types</option>
              {filters.types.map((t) => (
                <option key={t.name} value={t.name}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm text-[#4b522d]">
            <span className="text-[11px] uppercase tracking-[0.18em] text-[#7a7f54]">Gender</span>
            <select
              value={selectedGender}
              onChange={(e) => setSelectedGender(e.target.value)}
              className="rounded-lg border border-[#cfd7b0] bg-white px-3 py-2 text-sm text-[#3d4425] shadow-sm focus:border-[#8fae4c] focus:outline-none"
            >
              <option value="">All</option>
              {filters.genders.map((g) => (
                <option key={g.name} value={g.name}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>

          <div className="flex flex-col gap-2 rounded-lg bg-[#f8f4e3] p-3 text-sm text-[#4b522d]">
            <label className="inline-flex items-center gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                checked={onlyMilked}
                onChange={(e) => setOnlyMilked(e.target.checked)}
                className="h-4 w-4 rounded border-[#b5bf90] text-[#5d7f3b] focus:ring-[#7a8c43]"
              />
              Gets milked
            </label>
            <div className="grid grid-cols-2 gap-2 text-xs text-[#5d6041]">
              <label className="flex flex-col gap-1">
                <span>Min age (years)</span>
                <input
                  type="number"
                  min={0}
                  value={minAge}
                  onChange={(e) => setMinAge(e.target.value)}
                  className="rounded-md border border-[#d7d1b0] bg-white px-2 py-1 focus:border-[#8fae4c] focus:outline-none"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span>Max age (years)</span>
                <input
                  type="number"
                  min={0}
                  value={maxAge}
                  onChange={(e) => setMaxAge(e.target.value)}
                  className="rounded-md border border-[#d7d1b0] bg-white px-2 py-1 focus:border-[#8fae4c] focus:outline-none"
                />
              </label>
            </div>
          </div>
        </div>

        <div className="p-4 lg:p-6">
          {loading && (
            <div className="p-6 text-center text-sm text-[#7a7f54]">Loading animals…</div>
          )}
          {error && (
            <div className="p-6 text-center text-sm text-red-700">{error}</div>
          )}
          {!loading && !error && filteredAnimals.length === 0 && (
            <div className="p-6 text-center text-sm text-[#7a7f54]">No animals match these filters yet.</div>
          )}

          {!loading && !error && (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filteredAnimals.map((animal) => {
                const photo = animal.photos?.[0];
                return (
                  <button
                    key={animal.id}
                    onClick={() => handleOpen(animal)}
                    className="group flex h-full flex-col overflow-hidden rounded-2xl border border-[#e6dfbe] bg-white/80 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#c8c49c] hover:bg-white"
                  >
                    <div className="relative h-40 w-full overflow-hidden bg-[#f8f4e3]">
                      {photo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={photo.url}
                          alt={photo.name || animal.name}
                          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-4xl text-[#c2b98d]">🐾</div>
                      )}
                    </div>
                    <div className="flex flex-1 flex-col gap-3 p-4">
                      <div>
                        <p className="text-lg font-semibold text-[#304220]">{animal.name || "Unnamed"}</p>
                        <p className="text-sm text-[#5f5a3b] line-clamp-2">
                          {animal.summary || "No summary yet."}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        {animal.type?.name ? (
                          <span
                            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 font-semibold ${colorClass(
                              animal.type?.color
                            )}`}
                          >
                            <span className="h-2 w-2 rounded-full bg-current/70" />
                            {animal.type?.name}
                          </span>
                        ) : null}
                        {animal.status ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-[#d9d2af] bg-[#f4f0dc] px-3 py-1 font-semibold text-[#5a5436]">
                            {animal.status}
                          </span>
                        ) : null}
                        {animal.healthStatus ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-[#d8e6bf] bg-[#eff6d9] px-3 py-1 font-semibold text-[#4c5c24]">
                            {animal.healthStatus}
                          </span>
                        ) : null}
                        {animal.location ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-[#cfe0a0] bg-[#edf5d6] px-3 py-1 font-semibold text-[#4c5c24]">
                            📍 {animal.location}
                          </span>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-[#6a6647]">
                        {animal.tagId ? <span>Tag: {animal.tagId}</span> : null}
                        {animal.microchipId ? <span>Chip: {animal.microchipId}</span> : null}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {activeAnimal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
          <div
            className="relative max-h-[92vh] w-full max-w-6xl overflow-hidden rounded-2xl bg-white shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-label="Animal details"
          >
            <button
              className="absolute right-3 top-3 rounded-full bg-black/60 px-3 py-1 text-white"
              onClick={() => setActiveAnimal(null)}
            >
              Close
            </button>
            <div className="grid gap-0 overflow-y-auto md:grid-cols-[1.3fr_1fr]">
              <div className="relative min-h-[260px] bg-[#f7f3e2]">
                {activeAnimal.photos.length > 0 ? (
                  <div className="relative h-full w-full">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={activeAnimal.photos[photoIndex]?.url || activeAnimal.photos[0].url}
                      alt={activeAnimal.photos[photoIndex]?.name || activeAnimal.name}
                      className="h-full w-full object-cover"
                    />
                    {activeAnimal.photos.length > 1 ? (
                      <div className="pointer-events-none absolute inset-0 flex items-center justify-between px-3">
                        <button
                          className="pointer-events-auto rounded-full bg-white/80 px-3 py-2 text-lg shadow"
                          onClick={prevPhoto}
                        >
                          ←
                        </button>
                        <button
                          className="pointer-events-auto rounded-full bg-white/80 px-3 py-2 text-lg shadow"
                          onClick={nextPhoto}
                        >
                          →
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="flex h-full items-center justify-center text-6xl text-[#c2b98d]">🐐</div>
                )}
              </div>

              <div className="space-y-4 bg-white px-5 py-4 text-sm text-[#4b5133]">
                <div className="flex items-start justify-between gap-3 md:block">
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-[#7a7f54]">Animal</p>
                    <h2 className="text-2xl font-semibold text-[#314123]">{activeAnimal.name}</h2>
                    <p className="text-sm text-[#5f5a3b]">{activeAnimal.summary || "No summary yet."}</p>
                  </div>
                  <button
                    className="rounded-full border border-[#d0c9a4] bg-white px-3 py-1 text-xs font-semibold text-[#5a5436] shadow-sm md:hidden"
                    onClick={() => setActiveAnimal(null)}
                  >
                    Close
                  </button>
                </div>

                {isAdmin && (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setEditing((prev) => !prev)}
                      className="rounded-full border border-[#d0c9a4] bg-white px-3 py-1 text-xs font-semibold text-[#5a5436] shadow-sm"
                    >
                      {editing ? "View details" : "Edit animal"}
                    </button>
                    {saveError && (
                      <span className="text-xs font-semibold text-red-700">{saveError}</span>
                    )}
                  </div>
                )}

                {editing ? (
                  <div className="max-h-[55vh] space-y-4 overflow-y-auto rounded-xl border border-[#efe7cf] bg-[#fbf9f0] p-4">
                    <div className="rounded-lg border border-[#e6dfbe] bg-white/90 p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7a7f54]">
                        Basics
                      </p>
                      <div className="mt-3 grid gap-3 text-xs sm:grid-cols-2">
                        <label className="flex flex-col gap-1">
                          <span className="uppercase tracking-[0.16em] text-[#7a7f54]">Name</span>
                          <input
                            type="text"
                            value={draft.name}
                            onChange={(event) =>
                              setDraft((prev) => ({ ...prev, name: event.target.value }))
                            }
                            className="rounded-md border border-[#d0c9a4] bg-white px-3 py-2 text-sm text-[#3d4425]"
                          />
                        </label>
                        <label className="flex flex-col gap-1">
                          <span className="uppercase tracking-[0.16em] text-[#7a7f54]">Type</span>
                          <select
                            value={draft.typeName}
                            onChange={(event) =>
                              setDraft((prev) => ({ ...prev, typeName: event.target.value }))
                            }
                            className="rounded-md border border-[#d0c9a4] bg-white px-3 py-2 text-sm text-[#3d4425]"
                          >
                            <option value="">Select type</option>
                            {filters.types.map((type) => (
                              <option key={type.name} value={type.name}>
                                {type.name}
                              </option>
                            ))}
                            {draft.typeName &&
                              !filters.types.some((type) => type.name === draft.typeName) && (
                                <option value={draft.typeName}>{draft.typeName}</option>
                              )}
                          </select>
                        </label>
                        <label className="flex flex-col gap-1">
                          <span className="uppercase tracking-[0.16em] text-[#7a7f54]">Gender</span>
                          <input
                            list="animal-gender-presets"
                            value={draft.genderName}
                            onChange={(event) =>
                              setDraft((prev) => ({ ...prev, genderName: event.target.value }))
                            }
                            placeholder="Select or type gender"
                            className="rounded-md border border-[#d0c9a4] bg-white px-3 py-2 text-sm text-[#3d4425]"
                          />
                          <datalist id="animal-gender-presets">
                            {genderPresets.map((gender) => (
                              <option key={gender} value={gender} />
                            ))}
                          </datalist>
                        </label>
                        <label className="flex flex-col gap-1">
                          <span className="uppercase tracking-[0.16em] text-[#7a7f54]">Breed</span>
                          <input
                            list="animal-breed-presets"
                            value={draft.breed}
                            onChange={(event) =>
                              setDraft((prev) => ({ ...prev, breed: event.target.value }))
                            }
                            placeholder="Select or type breed"
                            className="rounded-md border border-[#d0c9a4] bg-white px-3 py-2 text-sm text-[#3d4425]"
                          />
                          <datalist id="animal-breed-presets">
                            {breedPresets.map((breed) => (
                              <option key={breed} value={breed} />
                            ))}
                          </datalist>
                        </label>
                      </div>
                    </div>

                    <div className="rounded-lg border border-[#e6dfbe] bg-white/90 p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7a7f54]">
                        Identifiers & lineage
                      </p>
                      <div className="mt-3 grid gap-3 text-xs sm:grid-cols-2">
                        <label className="flex flex-col gap-1">
                          <span className="uppercase tracking-[0.16em] text-[#7a7f54]">Tag ID</span>
                          <input
                            type="text"
                            value={draft.tagId}
                            onChange={(event) =>
                              setDraft((prev) => ({ ...prev, tagId: event.target.value }))
                            }
                            placeholder="Ear tag or collar ID"
                            className="rounded-md border border-[#d0c9a4] bg-white px-3 py-2 text-sm text-[#3d4425]"
                          />
                        </label>
                        <label className="flex flex-col gap-1">
                          <span className="uppercase tracking-[0.16em] text-[#7a7f54]">Microchip ID</span>
                          <input
                            type="text"
                            value={draft.microchipId}
                            onChange={(event) =>
                              setDraft((prev) => ({ ...prev, microchipId: event.target.value }))
                            }
                            placeholder="Microchip ID"
                            className="rounded-md border border-[#d0c9a4] bg-white px-3 py-2 text-sm text-[#3d4425]"
                          />
                        </label>
                        <label className="flex flex-col gap-1">
                          <span className="uppercase tracking-[0.16em] text-[#7a7f54]">Sire</span>
                          <select
                            value={draft.sireId}
                            onChange={(event) =>
                              setDraft((prev) => ({ ...prev, sireId: event.target.value }))
                            }
                            className="rounded-md border border-[#d0c9a4] bg-white px-3 py-2 text-sm text-[#3d4425]"
                          >
                            <option value="">Select sire</option>
                            {availableParents.map((parent) => (
                              <option key={parent.id} value={parent.id}>
                                {parent.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="flex flex-col gap-1">
                          <span className="uppercase tracking-[0.16em] text-[#7a7f54]">Dam</span>
                          <select
                            value={draft.damId}
                            onChange={(event) =>
                              setDraft((prev) => ({ ...prev, damId: event.target.value }))
                            }
                            className="rounded-md border border-[#d0c9a4] bg-white px-3 py-2 text-sm text-[#3d4425]"
                          >
                            <option value="">Select dam</option>
                            {availableParents.map((parent) => (
                              <option key={parent.id} value={parent.id}>
                                {parent.name}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                    </div>

                    <div className="rounded-lg border border-[#e6dfbe] bg-white/90 p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7a7f54]">
                        Notes
                      </p>
                      <div className="mt-3 space-y-3">
                        <label className="flex flex-col gap-1 text-xs">
                          <span className="uppercase tracking-[0.16em] text-[#7a7f54]">
                            Summary
                          </span>
                          <textarea
                            value={draft.summary}
                            onChange={(event) =>
                              setDraft((prev) => ({ ...prev, summary: event.target.value }))
                            }
                            rows={2}
                            className="rounded-md border border-[#d0c9a4] bg-white px-3 py-2 text-sm text-[#3d4425]"
                          />
                        </label>
                        <label className="flex flex-col gap-1 text-xs">
                          <span className="uppercase tracking-[0.16em] text-[#7a7f54]">
                            Daily care notes
                          </span>
                          <textarea
                            value={draft.dailyCareNotes}
                            onChange={(event) =>
                              setDraft((prev) => ({ ...prev, dailyCareNotes: event.target.value }))
                            }
                            rows={3}
                            className="rounded-md border border-[#d0c9a4] bg-white px-3 py-2 text-sm text-[#3d4425]"
                          />
                        </label>
                      </div>
                    </div>

                    <div className="rounded-lg border border-[#e6dfbe] bg-white/90 p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7a7f54]">
                        Care details
                      </p>
                      <div className="mt-3 grid gap-3 text-xs sm:grid-cols-2">
                        <label className="flex flex-col gap-1">
                          <span className="uppercase tracking-[0.16em] text-[#7a7f54]">
                            Arrival date
                          </span>
                          <input
                            type="date"
                            value={draft.arrivalDate}
                            onChange={(event) =>
                              setDraft((prev) => ({ ...prev, arrivalDate: event.target.value }))
                            }
                            className="rounded-md border border-[#d0c9a4] bg-white px-3 py-2 text-sm text-[#3d4425]"
                          />
                        </label>
                        <label className="flex flex-col gap-1">
                          <span className="uppercase tracking-[0.16em] text-[#7a7f54]">
                            Birthday
                          </span>
                          <input
                            list="animal-birthday-presets"
                            value={draft.birthday}
                            onChange={(event) =>
                              setDraft((prev) => ({ ...prev, birthday: event.target.value }))
                            }
                            placeholder="YYYY-MM-DD or notes"
                            className="rounded-md border border-[#d0c9a4] bg-white px-3 py-2 text-sm text-[#3d4425]"
                          />
                          <datalist id="animal-birthday-presets">
                            {birthdayPresets.map((birthday) => (
                              <option key={birthday} value={birthday} />
                            ))}
                          </datalist>
                        </label>
                        <div className="flex flex-col gap-1 rounded-md border border-[#d0c9a4] bg-white px-3 py-2 text-sm text-[#3d4425]">
                          <span className="uppercase tracking-[0.16em] text-[#7a7f54]">Age</span>
                          <span className="text-sm text-[#4b5133]">
                            {computeAge(draft.birthday).ageLabel || "Based on birthday"}
                          </span>
                        </div>
                        <label className="flex flex-col gap-1">
                          <span className="uppercase tracking-[0.16em] text-[#7a7f54]">
                            Status
                          </span>
                          <input
                            type="text"
                            value={draft.status}
                            onChange={(event) =>
                              setDraft((prev) => ({ ...prev, status: event.target.value }))
                            }
                            placeholder="Active, Retired, Sold"
                            className="rounded-md border border-[#d0c9a4] bg-white px-3 py-2 text-sm text-[#3d4425]"
                          />
                        </label>
                        <label className="flex flex-col gap-1">
                          <span className="uppercase tracking-[0.16em] text-[#7a7f54]">
                            Location
                          </span>
                          <input
                            type="text"
                            value={draft.location}
                            onChange={(event) =>
                              setDraft((prev) => ({ ...prev, location: event.target.value }))
                            }
                            placeholder="Pasture name"
                            className="rounded-md border border-[#d0c9a4] bg-white px-3 py-2 text-sm text-[#3d4425]"
                          />
                        </label>
                        <label className="flex flex-col gap-1">
                          <span className="uppercase tracking-[0.16em] text-[#7a7f54]">
                            Milking method
                          </span>
                          <select
                            value={draft.milkingMethod}
                            onChange={(event) =>
                              setDraft((prev) => ({ ...prev, milkingMethod: event.target.value }))
                            }
                            className="rounded-md border border-[#d0c9a4] bg-white px-3 py-2 text-sm text-[#3d4425]"
                          >
                            <option value="">Select method</option>
                            <option value="Hand">Hand</option>
                            <option value="Machine">Machine</option>
                          </select>
                        </label>
                        <label className="flex items-center gap-2 text-xs font-semibold text-[#5a5436]">
                          <input
                            type="checkbox"
                            checked={draft.getMilked}
                            onChange={(event) =>
                              setDraft((prev) => ({ ...prev, getMilked: event.target.checked }))
                            }
                            className="h-4 w-4 rounded border-[#b5bf90] text-[#5d7f3b] focus:ring-[#7a8c43]"
                          />
                          Gets milked
                        </label>
                        <label className="flex flex-col gap-1">
                          <span className="uppercase tracking-[0.16em] text-[#7a7f54]">
                            Health status
                          </span>
                          <input
                            type="text"
                            value={draft.healthStatus}
                            onChange={(event) =>
                              setDraft((prev) => ({ ...prev, healthStatus: event.target.value }))
                            }
                            placeholder="Healthy, Monitoring, Recovery"
                            className="rounded-md border border-[#d0c9a4] bg-white px-3 py-2 text-sm text-[#3d4425]"
                          />
                        </label>
                        <label className="flex flex-col gap-1">
                          <span className="uppercase tracking-[0.16em] text-[#7a7f54]">
                            Weight (lbs)
                          </span>
                          <input
                            type="number"
                            min={0}
                            value={draft.weightLbs}
                            onChange={(event) =>
                              setDraft((prev) => ({ ...prev, weightLbs: event.target.value }))
                            }
                            placeholder="e.g. 120"
                            className="rounded-md border border-[#d0c9a4] bg-white px-3 py-2 text-sm text-[#3d4425]"
                          />
                        </label>
                      </div>
                    </div>

                    <div className="rounded-lg border border-[#e6dfbe] bg-white/90 p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7a7f54]">
                        Traits
                      </p>
                      <div className="mt-3 space-y-3">
                        <label className="flex flex-col gap-1 text-xs">
                          <span className="uppercase tracking-[0.16em] text-[#7a7f54]">
                            Behaviors
                          </span>
                          <input
                            type="text"
                            value={draft.behaviors}
                            onChange={(event) =>
                              setDraft((prev) => ({ ...prev, behaviors: event.target.value }))
                            }
                            placeholder="Friendly, Curious"
                            className="rounded-md border border-[#d0c9a4] bg-white px-3 py-2 text-sm text-[#3d4425]"
                          />
                        </label>
                        <label className="flex flex-col gap-1 text-xs">
                          <span className="uppercase tracking-[0.16em] text-[#7a7f54]">Stats</span>
                          <textarea
                            value={draft.stats}
                            onChange={(event) =>
                              setDraft((prev) => ({ ...prev, stats: event.target.value }))
                            }
                            rows={3}
                            placeholder="weight_lbs: 120"
                            className="rounded-md border border-[#d0c9a4] bg-white px-3 py-2 text-sm text-[#3d4425]"
                          />
                        </label>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={handleSaveAnimal}
                        disabled={saving}
                        className="rounded-full bg-[#6f8f3d] px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-white shadow-sm disabled:opacity-60"
                      >
                        {saving ? "Saving…" : "Save animal"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditing(false)}
                        className="rounded-full border border-[#d0c9a4] bg-white px-3 py-2 text-xs font-semibold text-[#5a5436]"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : null}

                {isAdmin && (
                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-[0.16em] text-[#7a7f54]">
                      Photo gallery
                    </p>
                    <div className="flex flex-wrap items-center gap-3">
                      <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-[#d0c9a4] bg-white px-3 py-1 text-xs font-semibold text-[#5a5436] shadow-sm">
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (file) {
                              handlePhotoUpload(file);
                              event.currentTarget.value = "";
                            }
                          }}
                          disabled={uploading || !activeAnimal.id}
                        />
                        {uploading ? "Uploading…" : "Upload photo"}
                      </label>
                      <span className="text-[11px] text-[#7a7f54]">
                        {activeAnimal.id ? "JPG/PNG/WebP up to 300kb." : "Save animal first."}
                      </span>
                    </div>
                    {uploadError && (
                      <p className="text-xs font-semibold text-red-700">{uploadError}</p>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.16em] text-[#7a7f54]">Daily care notes</p>
                  <div className="rounded-lg border border-[#e6dfbe] bg-[#f9f6e7] px-3 py-2">
                    {renderCareNotes(activeAnimal.dailyCareNotes)}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg border border-[#e6dfbe] bg-[#f9f6e7] px-3 py-2">
                    <p className="font-semibold text-[#3f4926]">Birthday</p>
                    <p className="text-[#5f5a3b]">{formatDate(activeAnimal.birthday) || "Unknown"}</p>
                    <p className="text-[#7c7755]">
                      {computeAge(activeAnimal.birthday).ageLabel || "Age not set"}
                    </p>
                  </div>
                  <div className="rounded-lg border border-[#e6dfbe] bg-[#f9f6e7] px-3 py-2">
                    <p className="font-semibold text-[#3f4926]">Arrival</p>
                    <p className="text-[#5f5a3b]">{formatDate(activeAnimal.arrivalDate) || "Unknown"}</p>
                    <p className="text-[#7c7755]">{activeAnimal.status || "Status not set"}</p>
                  </div>
                  <div className="rounded-lg border border-[#e6dfbe] bg-[#f9f6e7] px-3 py-2">
                    <p className="font-semibold text-[#3f4926]">Type</p>
                    <p className="text-[#5f5a3b]">{activeAnimal.type?.name || "Unspecified"}</p>
                    {activeAnimal.gender?.name ? (
                      <p className="text-[#7c7755]">Gender: {activeAnimal.gender.name}</p>
                    ) : null}
                  </div>
                  <div className="rounded-lg border border-[#e6dfbe] bg-[#f9f6e7] px-3 py-2">
                    <p className="font-semibold text-[#3f4926]">Breed</p>
                    <p className="text-[#5f5a3b]">{activeAnimal.breed || "Unknown"}</p>
                  </div>
                  <div className="rounded-lg border border-[#e6dfbe] bg-[#f9f6e7] px-3 py-2">
                    <p className="font-semibold text-[#3f4926]">Milking</p>
                    <p className="text-[#5f5a3b]">{activeAnimal.milkingMethod || "—"}</p>
                    <p className="text-[#7c7755]">{activeAnimal.getMilked ? "Gets milked" : "Does not get milked"}</p>
                  </div>
                  <div className="rounded-lg border border-[#e6dfbe] bg-[#f9f6e7] px-3 py-2">
                    <p className="font-semibold text-[#3f4926]">Location</p>
                    <p className="text-[#5f5a3b]">{activeAnimal.location || "Not set"}</p>
                    <p className="text-[#7c7755]">{activeAnimal.healthStatus || "Health not set"}</p>
                  </div>
                  <div className="rounded-lg border border-[#e6dfbe] bg-[#f9f6e7] px-3 py-2">
                    <p className="font-semibold text-[#3f4926]">Identifiers</p>
                    <p className="text-[#5f5a3b]">Tag: {activeAnimal.tagId || "—"}</p>
                    <p className="text-[#7c7755]">Chip: {activeAnimal.microchipId || "—"}</p>
                  </div>
                  <div className="rounded-lg border border-[#e6dfbe] bg-[#f9f6e7] px-3 py-2">
                    <p className="font-semibold text-[#3f4926]">Weight</p>
                    <p className="text-[#5f5a3b]">
                      {activeAnimal.weightLbs ? `${activeAnimal.weightLbs} lbs` : "Not recorded"}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.16em] text-[#7a7f54]">Family tree</p>
                  <div className="rounded-lg border border-[#e6dfbe] bg-[#f9f6e7] px-3 py-2 text-xs text-[#4b5133]">
                    <div className="grid gap-2 md:grid-cols-2">
                      <div>
                        <p className="font-semibold text-[#3f4926]">Parents</p>
                        <div className="mt-2 space-y-1">
                          <p>Sire: {familyDetails.sire?.name || "Not recorded"}</p>
                          <p>Dam: {familyDetails.dam?.name || "Not recorded"}</p>
                        </div>
                      </div>
                      <div>
                        <p className="font-semibold text-[#3f4926]">Offspring</p>
                        {familyDetails.offspring.length ? (
                          <ul className="mt-2 list-disc space-y-1 pl-4">
                            {familyDetails.offspring.map((animal) => (
                              <li key={animal.id}>{animal.name}</li>
                            ))}
                          </ul>
                        ) : (
                          <p className="mt-2 text-[#7a7f54]">No offspring recorded yet.</p>
                        )}
                      </div>
                    </div>
                    <div className="mt-3">
                      <p className="font-semibold text-[#3f4926]">Siblings</p>
                      {familyDetails.siblings.length ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {familyDetails.siblings.map((animal) => (
                            <span
                              key={animal.id}
                              className="rounded-full border border-[#d9d2af] bg-white px-3 py-1 text-[11px] font-semibold text-[#5a5436]"
                            >
                              {animal.name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-2 text-[#7a7f54]">No siblings recorded yet.</p>
                      )}
                    </div>
                  </div>
                </div>

                {statsEntries.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-[0.16em] text-[#7a7f54]">Stats</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {statsEntries.map((entry) => (
                        <div
                          key={entry.key}
                          className="rounded-lg border border-[#e6dfbe] bg-[#f9f6e7] px-3 py-2"
                        >
                          <p className="font-semibold text-[#3f4926]">{entry.label}</p>
                          <p className="text-[#5f5a3b]">{entry.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeAnimal.behaviors.length ? (
                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-[0.16em] text-[#7a7f54]">Behaviors</p>
                    <div className="flex flex-wrap gap-2">
                      {activeAnimal.behaviors.map((behavior) => (
                        <span
                          key={behavior}
                          className="inline-flex items-center rounded-full bg-[#eef3d9] px-3 py-1 text-[12px] font-semibold text-[#4c5c24]"
                        >
                          {behavior}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-[#e6dfbe] bg-white px-4 py-3 md:hidden">
              <button
                type="button"
                onClick={() => setActiveAnimal(null)}
                className="w-full rounded-md border border-[#d0c9a4] bg-[#f6f2de] px-4 py-2 text-sm font-semibold text-[#4b5133] shadow-sm"
              >
                Close details
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
