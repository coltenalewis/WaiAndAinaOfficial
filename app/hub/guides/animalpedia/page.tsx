"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";

type Animal = {
  id: string;
  name: string;
  summary: string;
  birthday?: string;
  ageLabel?: string;
  ageMonths: number | null;
  milkingMethod?: string;
  getMilked: boolean;
  type?: { name: string; color?: string };
  behaviors: string[];
  breed?: string;
  gender?: { name: string; color?: string };
  photos: { name: string; url: string }[];
};

type Filters = {
  types: { name: string; color?: string }[];
  genders: { name: string; color?: string }[];
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

export default function AnimalpediaPage() {
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [filters, setFilters] = useState<Filters>({ types: [], genders: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedType, setSelectedType] = useState("");
  const [selectedGender, setSelectedGender] = useState("");
  const [onlyMilked, setOnlyMilked] = useState(false);
  const [minAge, setMinAge] = useState<string>("");
  const [maxAge, setMaxAge] = useState<string>("");
  const [activeAnimal, setActiveAnimal] = useState<Animal | null>(null);
  const [photoIndex, setPhotoIndex] = useState(0);

  useEffect(() => {
    async function loadAnimals() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/animals");
        if (!res.ok) {
          throw new Error("Failed to fetch animals");
        }
        const data = await res.json();
        setAnimals(data.animals || []);
        setFilters(data.filters || { types: [], genders: [] });
      } catch (err) {
        setError("Could not load animal info. Please try again.");
      } finally {
        setLoading(false);
      }
    }

    loadAnimals();
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

      return true;
    });
  }, [animals, selectedType, selectedGender, onlyMilked, minAge, maxAge]);

  const handleOpen = (animal: Animal) => {
    setActiveAnimal(animal);
    setPhotoIndex(0);
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

  return (
    <div className="space-y-6">
      <header className="rounded-xl bg-[#a0b764] text-white px-4 py-4 shadow">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-white/80">Healthy herd hub</p>
            <h1 className="text-3xl font-semibold">Animalpedia</h1>
            <p className="text-sm text-white/85">Browse care notes, favorites, and quick facts for every animal.</p>
          </div>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1">
              <span className="h-2 w-2 rounded-full bg-lime-200 shadow"></span>
              Updated live from Notion
            </span>
          </div>
        </div>
      </header>

      <div className="rounded-xl border border-[#d0c9a4] bg-white/80 shadow-sm">
        <div className="grid gap-3 border-b border-[#e7e0c0] p-4 sm:grid-cols-3">
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

        <div className="divide-y divide-[#ece6c9]">
          {loading && (
            <div className="p-6 text-center text-sm text-[#7a7f54]">Loading animals…</div>
          )}
          {error && (
            <div className="p-6 text-center text-sm text-red-700">{error}</div>
          )}
          {!loading && !error && filteredAnimals.length === 0 && (
            <div className="p-6 text-center text-sm text-[#7a7f54]">No animals match these filters yet.</div>
          )}

          {!loading && !error &&
            filteredAnimals.map((animal) => {
              const photo = animal.photos?.[0];
              return (
                <button
                  key={animal.id}
                  onClick={() => handleOpen(animal)}
                  className="flex w-full items-center gap-4 bg-white/60 px-4 py-3 text-left transition hover:bg-[#f6f2de]"
                >
                  <div className="relative h-20 w-28 overflow-hidden rounded-lg border border-[#e6dfbe] bg-[#f8f4e3]">
                    {photo ? (
                      <Image
                        src={photo.url}
                        alt={photo.name || animal.name}
                        fill
                        sizes="160px"
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-2xl">🐾</div>
                    )}
                  </div>
                  <div className="flex flex-1 items-center justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold text-[#304220]">{animal.name || "Unnamed"}</p>
                      <p className="text-sm text-[#5f5a3b] line-clamp-2">{animal.summary || "No summary yet."}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
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
                        {animal.getMilked ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-[#cfe0a0] bg-[#edf5d6] px-3 py-1 font-semibold text-[#4c5c24]">
                            🥛 Gets milked
                          </span>
                        ) : null}
                        {animal.ageLabel ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-[#d9d2af] bg-[#f4f0dc] px-3 py-1 font-semibold text-[#5a5436]">
                            🎂 {animal.ageLabel}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="text-2xl text-[#9b915f]">→</div>
                  </div>
                </button>
              );
            })}
        </div>
      </div>

      {activeAnimal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
          <div className="relative max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <button
              className="absolute right-3 top-3 rounded-full bg-black/60 px-3 py-1 text-white"
              onClick={() => setActiveAnimal(null)}
            >
              Close
            </button>
            <div className="grid gap-0 overflow-y-auto md:grid-cols-[1.1fr_1fr]">
              <div className="relative min-h-[260px] bg-[#f7f3e2]">
                {activeAnimal.photos.length > 0 ? (
                  <div className="relative h-full w-full">
                    <Image
                      src={activeAnimal.photos[photoIndex]?.url || activeAnimal.photos[0].url}
                      alt={activeAnimal.photos[photoIndex]?.name || activeAnimal.name}
                      fill
                      className="object-cover"
                      sizes="600px"
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
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-[#7a7f54]">Animal</p>
                  <h2 className="text-2xl font-semibold text-[#314123]">{activeAnimal.name}</h2>
                  <p className="text-sm text-[#5f5a3b]">{activeAnimal.summary || "No summary yet."}</p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg border border-[#e6dfbe] bg-[#f9f6e7] px-3 py-2">
                    <p className="font-semibold text-[#3f4926]">Birthday</p>
                    <p className="text-[#5f5a3b]">{formatDate(activeAnimal.birthday) || "Unknown"}</p>
                    <p className="text-[#7c7755]">{activeAnimal.ageLabel || "Age not set"}</p>
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
                </div>

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
          </div>
        </div>
      ) : null}
    </div>
  );
}
