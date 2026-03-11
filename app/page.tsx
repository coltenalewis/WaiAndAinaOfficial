"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  clearSession,
  getHubLandingPath,
  loadSession,
  saveSession,
  UserSession,
} from "@/lib/session";
import { getStoredDeviceId } from "@/lib/pushClient";

const allowedWorkTypes = ["admin", "volunteer", "external volunteer"];

type HomePageContent = {
  heroTitle: string;
  heroSubtitle: string;
  aboutText: string;
};

const defaultHomePageContent: HomePageContent = {
  heroTitle: "Sustainable Living, Ag Education, Conservation",
  heroSubtitle:
    "Step into Wai & Aina’s world of regenerative farming, joyful animals, and hands-on learning. 🌿 Explore the land, peek at our guides, and hop into the work dashboard when you’re signed in.",
  aboutText:
    "We grow papaya, dragonfruit, mango, ulu, coffee, cacao, lilikoi, starfruit, rollinia, lychee, and oranges. With a focus on regenerative agriculture and wildlife friendly practices, the farm will continue to expand with sustainable projects, agroforestry, and organic orchard spaces.",
};

function formatSession(session: UserSession | null): UserSession | null {
  if (!session) return null;
  const type = session.userType?.toLowerCase();
  return {
    ...session,
    userType: type || null,
  };
}

export default function HomePage() {
  const router = useRouter();
  const [session, setSession] = useState<UserSession | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  const [users, setUsers] = useState<{ name: string; number: string }[]>([]);
  const [usersLoading, setUsersLoading] = useState<boolean>(true);
  const [usersError, setUsersError] = useState<string | null>(null);

  // Selected user + login form
  const [selectedName, setSelectedName] = useState<string>("");
  const [number, setNumber] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [homeContent, setHomeContent] = useState<HomePageContent>(defaultHomePageContent);
  const [homeContentStatus, setHomeContentStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  useEffect(() => {
    const existing = formatSession(loadSession());
    if (existing) setSession(existing);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/homepage-content');
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled && json?.content) {
          setHomeContent({
            heroTitle: String(json.content.heroTitle || defaultHomePageContent.heroTitle),
            heroSubtitle: String(json.content.heroSubtitle || defaultHomePageContent.heroSubtitle),
            aboutText: String(json.content.aboutText || defaultHomePageContent.aboutText),
          });
        }
      } catch (err) {
        console.error('Failed to load homepage content', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const canAccessWork = useMemo(() => {
    if (!session?.userType) return false;
    return allowedWorkTypes.includes(session.userType.toLowerCase());
  }, [session?.userType]);
  const shouldAutoRouteToSchedule = useMemo(() => {
    if (!session?.userType) return false;
    return ["admin", "volunteer", "external volunteer"].includes(
      session.userType.toLowerCase()
    );
  }, [session?.userType]);

  useEffect(() => {
    if (!shouldAutoRouteToSchedule) return;
    router.replace("/hub");
  }, [router, shouldAutoRouteToSchedule]);

  function handleLogout() {
    clearSession();
    const deviceId = getStoredDeviceId();
    if (deviceId) {
      fetch("/api/push/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId }),
      }).catch((err) => {
        console.error("Failed to remove push subscription", err);
      });
    }
    setSession(null);
  }

  // Fetch users for login dropdown
  useEffect(() => {
    async function loadUsersList() {
      setUsersLoading(true);
      setUsersError(null);

      try {
        const res = await fetch("/api/users");
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const data = await res.json();
        const parsed = Array.isArray(data.users)
          ? data.users
              .map((entry: any) => ({
                name: entry?.name ?? "",
                number: entry?.number ?? "",
              }))
              .filter((entry: any) => entry.name)
          : [];

        setUsers(parsed);
      } catch (err) {
        console.error("Failed to load users:", err);
        setUsersError("Unable to load users. Please refresh or try again later.");
      } finally {
        setUsersLoading(false);
      }
    }

    loadUsersList();
  }, []);

  function handleNameChange(value: string) {
    setSelectedName(value);
    if (value) setNumber("");
    if (loginError) setLoginError(null);
  }

  function handleNumberChange(value: string) {
    setNumber(value);
    if (value) setSelectedName("");
    if (loginError) setLoginError(null);
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if ((!selectedName && !number) || !password) {
      setLoginError("Please choose your name or enter your number, then enter a passcode.");
      return;
    }

    setIsSubmitting(true);
    setLoginError(null);

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: selectedName || undefined,
          number: number || undefined,
          password,
        }),
      });

      if (!res.ok) {
        if (res.status === 401) {
          setLoginError("Incorrect passcode for that user.");
        } else {
          setLoginError("Login failed. Please try again.");
        }
        return;
      }

      const data = await res.json();
      const nextSession: UserSession = {
        name: data.name || selectedName,
        userType: data.userType || null,
        userTypeColor: data.userTypeColor || null,
      };
      saveSession(nextSession);
      setSession(formatSession(nextSession));
      setShowLogin(false);
      router.push(getHubLandingPath(data.userType));
    } catch (err) {
      console.error("Login error:", err);
      setLoginError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function saveHomeContent(nextContent: HomePageContent) {
    if (session?.userType?.toLowerCase() !== 'admin') return;
    setHomeContentStatus('saving');
    try {
      const res = await fetch('/api/homepage-content', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: nextContent, userType: session.userType }),
      });
      if (!res.ok) throw new Error('Failed to save');
      setHomeContentStatus('saved');
    } catch (err) {
      console.error('Failed to save homepage content', err);
      setHomeContentStatus('error');
    }
  }

  function heroButton(label: string, href: string, primary = false) {
    return (
      <Link
        href={href}
        className={`inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition-all duration-200 shadow-sm hover:shadow-md ${
          primary
            ? "bg-[var(--farm-primary)] text-white hover:bg-[var(--farm-primary-hover)] hover:-translate-y-0.5"
            : "bg-white/80 text-[var(--farm-text-dark)] hover:bg-white hover:-translate-y-0.5"
        }`}
      >
        {label}
        <span aria-hidden className="transition-transform group-hover:translate-x-0.5">→</span>
      </Link>
    );
  }

  return (
      <main className="min-h-screen bg-[var(--farm-bg)] text-[var(--farm-text-dark)] flex flex-col">
      {/* Top navigation */}
      <header className="sticky top-0 z-20 w-full bg-white/95 backdrop-blur-md border-b border-[var(--farm-border)] shadow-sm">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              className="md:hidden inline-flex items-center justify-center rounded-xl border border-[var(--farm-border)] bg-white h-10 w-10 text-lg shadow-sm hover:bg-[var(--farm-bg-highlight)] transition-colors"
              onClick={() => setShowMobileMenu(true)}
              aria-label="Open menu"
            >
              ☰
            </button>
            <Link href="/" className="flex items-center gap-3 group">
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#f1e4b5] to-[#e8d89e] flex items-center justify-center shadow-md group-hover:shadow-lg transition-shadow">
                <span className="text-xl">🐐</span>
              </div>
              <div className="flex flex-col leading-tight">
                <span className="text-sm font-bold tracking-[0.16em] uppercase text-[var(--farm-accent)]">
                  Wai &amp; Aina
                </span>
                <span className="text-[11px] text-[var(--farm-text-muted)]">Sustainable living &amp; care</span>
              </div>
            </Link>
          </div>

          <nav className="hidden md:flex items-center gap-1 text-sm font-semibold">
            <Link href="#home" className="rounded-xl px-3 py-2 hover:bg-[var(--farm-bg-hover)] transition-colors">
              Home
            </Link>
            <Link href="#about" className="rounded-xl px-3 py-2 hover:bg-[var(--farm-bg-hover)] transition-colors">
              About Us
            </Link>
            <div className="relative group">
              <button className="rounded-xl px-3 py-2 hover:bg-[var(--farm-bg-hover)] inline-flex items-center gap-1.5 transition-colors">
                Farm Info <span className="text-[10px] opacity-60">▾</span>
              </button>
              <div className="absolute right-0 mt-1 min-w-[220px] rounded-xl bg-white border border-[var(--farm-border)] shadow-xl opacity-0 group-hover:opacity-100 group-hover:translate-y-0 translate-y-2 pointer-events-none group-hover:pointer-events-auto transition-all duration-200">
                <div className="flex flex-col p-1.5">
                  <Link href="/hub/guides/animalpedia" className="rounded-lg px-3 py-2.5 hover:bg-[var(--farm-bg-highlight)] transition-colors flex items-center gap-2">
                    <span>🐾</span> Animalpedia
                  </Link>
                  <Link href="/hub/guides/farm-map" className="rounded-lg px-3 py-2.5 hover:bg-[var(--farm-bg-highlight)] transition-colors flex items-center gap-2">
                    <span>🗺️</span> Farm Map
                  </Link>
                  <Link href="/hub/guides/how-to" className="rounded-lg px-3 py-2.5 hover:bg-[var(--farm-bg-highlight)] transition-colors flex items-center gap-2">
                    <span>📘</span> Guides
                  </Link>
                </div>
              </div>
            </div>
            {canAccessWork && (
              <Link href="/hub/dashboard" className="rounded-xl px-3 py-2 hover:bg-[var(--farm-bg-hover)] transition-colors">
                Dashboard
              </Link>
            )}
            {session && (
              <Link href="/hub/settings" className="rounded-xl px-3 py-2 hover:bg-[var(--farm-bg-hover)] transition-colors">
                Settings
              </Link>
            )}
          </nav>

          <div className="flex items-center gap-2">
            {session?.name && (
              <span className="hidden sm:inline text-xs text-[var(--farm-accent)] font-semibold">
                Hi, {session.name.split(" ")[0]}
              </span>
            )}
            <button
              onClick={() => setShowLogin(true)}
              className="inline-flex items-center rounded-xl border border-[var(--farm-border)] bg-white px-4 py-2 text-xs font-semibold hover:bg-[var(--farm-bg-warm)] shadow-sm transition-colors"
            >
              {session ? "Switch user" : "Login"}
            </button>
            {session && (
              <button
                onClick={handleLogout}
                className="inline-flex items-center rounded-xl bg-[var(--farm-bg-warm)] text-[var(--farm-text)] px-4 py-2 text-xs font-semibold shadow-sm hover:bg-[#d7d9c0] transition-colors"
              >
                Logout
              </button>
            )}
          </div>
        </div>
      </header>

      {session?.userType?.toLowerCase() === "admin" && (
        <section className="mx-auto mt-4 w-full max-w-7xl px-3 sm:px-6">
          <div className="farm-card">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm">✏️</span>
                <h2 className="farm-label">Homepage editor</h2>
              </div>
              <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${
                homeContentStatus === "saving"
                  ? "bg-amber-50 text-amber-700"
                  : homeContentStatus === "saved"
                    ? "bg-emerald-50 text-emerald-700"
                    : homeContentStatus === "error"
                      ? "bg-red-50 text-red-700"
                      : "text-[var(--farm-text-muted)]"
              }`}>
                {homeContentStatus === "saving"
                  ? "Saving…"
                  : homeContentStatus === "saved"
                    ? "Saved"
                    : homeContentStatus === "error"
                      ? "Save failed"
                      : "Ready"}
              </span>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <input
                value={homeContent.heroTitle}
                onChange={(event) => {
                  const next = { ...homeContent, heroTitle: event.target.value };
                  setHomeContent(next);
                  void saveHomeContent(next);
                }}
                className="farm-input"
                placeholder="Hero title"
              />
              <input
                value={homeContent.heroSubtitle}
                onChange={(event) => {
                  const next = { ...homeContent, heroSubtitle: event.target.value };
                  setHomeContent(next);
                  void saveHomeContent(next);
                }}
                className="farm-input"
                placeholder="Hero subtitle"
              />
              <input
                value={homeContent.aboutText}
                onChange={(event) => {
                  const next = { ...homeContent, aboutText: event.target.value };
                  setHomeContent(next);
                  void saveHomeContent(next);
                }}
                className="farm-input"
                placeholder="About text"
              />
            </div>
          </div>
        </section>
      )}

      {/* Mobile menu */}
      {showMobileMenu && (
        <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden" onClick={() => setShowMobileMenu(false)}>
          <div
            className="absolute left-0 top-0 h-full w-72 bg-[var(--farm-bg)] border-r border-[var(--farm-border)] shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-[var(--farm-border-light)]">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#f1e4b5] to-[#e8d89e] flex items-center justify-center shadow-md">
                  <span className="text-xl">🐐</span>
                </div>
                <div className="leading-tight">
                  <p className="text-sm font-bold text-[var(--farm-text-dark)]">Wai &amp; Aina</p>
                  <p className="text-[11px] text-[var(--farm-text-muted)]">Farm hub</p>
                </div>
              </div>
              <button
                className="rounded-xl bg-white h-8 w-8 flex items-center justify-center text-xs font-semibold text-[var(--farm-text)] border border-[var(--farm-border)] shadow-sm hover:bg-[var(--farm-bg-warm)] transition-colors"
                onClick={() => setShowMobileMenu(false)}
                aria-label="Close menu"
              >
                ✕
              </button>
            </div>

            <nav className="flex flex-col gap-1 p-3 text-sm font-semibold text-[var(--farm-text-dark)] flex-1 overflow-y-auto">
              <Link href="#home" onClick={() => setShowMobileMenu(false)} className="rounded-xl px-3 py-2.5 hover:bg-white transition-colors">
                Home
              </Link>
              <Link href="#about" onClick={() => setShowMobileMenu(false)} className="rounded-xl px-3 py-2.5 hover:bg-white transition-colors">
                About Us
              </Link>
              <div className="rounded-xl bg-white px-3 py-3 shadow-sm border border-[var(--farm-border-light)]">
                <p className="farm-label mb-2">Farm Information</p>
                <div className="flex flex-col gap-0.5 font-medium">
                  <Link href="/hub/guides/animalpedia" onClick={() => setShowMobileMenu(false)} className="rounded-lg px-2 py-2 hover:bg-[var(--farm-bg-highlight)] transition-colors flex items-center gap-2">
                    <span>🐾</span> Animalpedia
                  </Link>
                  <Link href="/hub/guides/farm-map" onClick={() => setShowMobileMenu(false)} className="rounded-lg px-2 py-2 hover:bg-[var(--farm-bg-highlight)] transition-colors flex items-center gap-2">
                    <span>🗺️</span> Farm Map
                  </Link>
                  <Link href="/hub/guides/how-to" onClick={() => setShowMobileMenu(false)} className="rounded-lg px-2 py-2 hover:bg-[var(--farm-bg-highlight)] transition-colors flex items-center gap-2">
                    <span>📘</span> Guides
                  </Link>
                </div>
              </div>
              {canAccessWork && (
                <Link href="/hub/dashboard" onClick={() => setShowMobileMenu(false)} className="rounded-xl px-3 py-2.5 hover:bg-white transition-colors">
                  Work Dashboard
                </Link>
              )}
              {session && (
                <Link href="/hub/settings" onClick={() => setShowMobileMenu(false)} className="rounded-xl px-3 py-2.5 hover:bg-white transition-colors">
                  Settings
                </Link>
              )}
            </nav>

            <div className="p-4 border-t border-[var(--farm-border-light)] flex items-center justify-between">
              {session?.name ? (
                <div className="text-xs text-[var(--farm-accent)] font-semibold">
                  Hi, {session.name.split(" ")[0]}
                </div>
              ) : (
                <div className="text-xs text-[var(--farm-text-muted)]">Welcome!</div>
              )}
              <button
                onClick={() => {
                  setShowMobileMenu(false);
                  setShowLogin(true);
                }}
                className="farm-btn farm-btn-outline text-[11px]"
              >
                {session ? "Switch user" : "Login"}
              </button>
            </div>
          </div>
        </div>
      )}

        {/* Hero */}
        <section
          id="home"
          className="relative w-full overflow-hidden"
          style={{
            backgroundImage:
              "linear-gradient(135deg, rgba(240,237,217,0.92), rgba(201,221,183,0.92)), url('https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1600&q=80')",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div className="pointer-events-none absolute -left-10 top-10 h-52 w-52 rounded-full bg-white/40 blur-[80px]" />
          <div className="pointer-events-none absolute right-0 bottom-0 h-64 w-64 rounded-full bg-[#b8d29b]/40 blur-[80px]" />
          <div className="max-w-7xl mx-auto px-3 sm:px-6 py-14 sm:py-20 grid md:grid-cols-2 gap-10 items-center">
            <div className="space-y-6 bg-white/75 backdrop-blur-sm rounded-3xl border border-white/60 shadow-xl p-7 sm:p-8">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.2em] text-[var(--farm-accent)] shadow-sm border border-white/60">
                🐐 Since 2023
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[#2f331d] leading-[1.15] tracking-tight">
                {homeContent.heroTitle}
              </h1>
              <p className="text-[var(--farm-text)] text-sm sm:text-base leading-relaxed max-w-lg">
                {homeContent.heroSubtitle}
              </p>
              <div className="flex flex-wrap gap-3 pt-1">
                {heroButton("Explore the Farm", "#about", true)}
                {heroButton("Open Guides", "/hub/guides/how-to")}
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl border border-white/70 bg-white/70 p-3.5 shadow-sm">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--farm-text-muted)] mb-0.5">Daily Flow</p>
                  <p className="font-semibold text-[var(--farm-text-dark)]">Community-first</p>
                </div>
                <div className="rounded-xl border border-white/70 bg-white/70 p-3.5 shadow-sm">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--farm-text-muted)] mb-0.5">Field Notes</p>
                  <p className="font-semibold text-[var(--farm-text-dark)]">Guided &amp; playful</p>
                </div>
              </div>
            </div>
            <div className="relative rounded-3xl overflow-hidden shadow-2xl border border-[var(--farm-border)] bg-white/90 backdrop-blur">
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/10 to-white/60 z-[1]" />
              <div className="h-52 sm:h-72 bg-[url('https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1200&q=80')] bg-cover bg-center" />
              <div className="p-6 sm:p-7 space-y-3 relative z-10">
                <p className="farm-label">Farm vibes</p>
                <p className="text-sm text-[var(--farm-text)] leading-relaxed">
                  Fresh milk, happy goats, and a team that cares. We craft experiences that feel wholesome and a little bit magical—perfect for volunteers, friends, and curious visitors.
                </p>
                <Link href="#about" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--farm-accent)] hover:text-[var(--farm-primary-hover)] underline underline-offset-4 transition-colors">
                  Meet the herd →
                </Link>
              </div>
            </div>
          </div>
        </section>

      {/* About */}
      <section id="about" className="max-w-7xl mx-auto px-3 sm:px-6 py-14 sm:py-16 space-y-8">
        <div className="grid md:grid-cols-2 gap-10 items-start">
          <div className="space-y-5">
            <p className="farm-label">Just starting out…</p>
            <h2 className="text-3xl sm:text-4xl font-bold farm-heading tracking-tight">Farm fresh produce</h2>
            <p className="text-sm sm:text-base text-[var(--farm-text)] leading-relaxed">
              {homeContent.aboutText}
            </p>
            <p className="text-sm sm:text-base text-[var(--farm-text)] leading-relaxed">
              Future projects include developing programs for sustainable meat, eggs, and vegetable sources for both internal and external demand.
            </p>
          </div>
          <div className="rounded-3xl border border-[var(--farm-border)] bg-white shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
            <div className="h-52 bg-[url('https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1200&q=80')] bg-cover bg-center" />
            <div className="p-6 sm:p-7 space-y-4">
              <div>
                <p className="farm-label mb-1">Get involved</p>
                <p className="text-sm text-[var(--farm-text)] leading-relaxed">
                  Visit, volunteer, and learn alongside our team. We prioritize organic practices, thoughtful animal care, and collaborative stewardship of the land.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-sm font-semibold text-[var(--farm-accent)]">
                <span className="inline-flex items-center gap-2 rounded-full bg-[var(--farm-bg-hover)] px-3.5 py-1.5 border border-[var(--farm-border-green)]/30">🌿 Conservation</span>
                <span className="inline-flex items-center gap-2 rounded-full bg-[var(--farm-bg-hover)] px-3.5 py-1.5 border border-[var(--farm-border-green)]/30">🐄 Animal care</span>
                <span className="inline-flex items-center gap-2 rounded-full bg-[var(--farm-bg-hover)] px-3.5 py-1.5 border border-[var(--farm-border-green)]/30">📚 Education</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Farm information */}
      <section className="bg-[var(--farm-bg-warm)] py-14 sm:py-16">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 space-y-8">
          <div className="flex flex-col gap-2 max-w-xl">
            <p className="farm-label">Farm information</p>
            <h3 className="text-2xl sm:text-3xl font-bold farm-heading tracking-tight">Know your way around Wai &amp; Aina</h3>
            <p className="text-sm sm:text-base text-[var(--farm-text)]">Maps, animal notes, and how-to guides to support every visitor.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {[
              {
                title: "Animalpedia",
                description: "Care tips, feeding notes, and health checks for every animal friend.",
                href: "/hub/guides/animalpedia",
                icon: "🐾",
              },
              {
                title: "Farm Map",
                description: "Navigate paddocks, orchards, gardens, and key resources at a glance.",
                href: "/hub/guides/farm-map",
                icon: "🗺️",
              },
              {
                title: "Guides",
                description: "Step-by-step walkthroughs for tasks, safety, and daily routines.",
                href: "/hub/guides/how-to",
                icon: "📘",
              },
            ].map((item) => (
              <Link
                key={item.title}
                href={item.href}
                className="group rounded-2xl border border-[var(--farm-border)] bg-white p-6 shadow-sm hover:-translate-y-1 hover:shadow-lg transition-all duration-200"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-10 w-10 rounded-xl bg-[var(--farm-bg-highlight)] flex items-center justify-center text-xl shadow-sm">
                    {item.icon}
                  </div>
                  <h4 className="text-lg font-bold farm-heading">{item.title}</h4>
                </div>
                <p className="text-sm text-[var(--farm-text)] leading-relaxed">{item.description}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[var(--farm-accent)] group-hover:gap-2 transition-all">
                  Open {item.title} <span className="transition-transform group-hover:translate-x-0.5">→</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Contact footer */}
      <footer className="bg-[var(--farm-bg-warm)] border-t border-[var(--farm-border)] py-12">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 flex flex-col md:flex-row md:items-center md:justify-between gap-8 text-sm text-[var(--farm-text)]">
          <div className="space-y-1.5">
            <p className="font-medium">543 Kualono Pl</p>
            <p>Kapaa, HI 96746</p>
            <p>(808) 555-8884</p>
            <p>waiandaina@gmail.com</p>
          </div>
          <div className="flex flex-col items-start md:items-end gap-2">
            <span className="farm-label">Since 2023</span>
            <p className="text-xl font-bold farm-heading">Wai &amp; Aina</p>
            <p className="text-xs text-[var(--farm-text-muted)]">Sustainable living · Ag education · Conservation</p>
          </div>
        </div>
      </footer>

      {/* Login modal */}
      {showLogin && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center px-4">
          <div className="w-full max-w-md rounded-3xl bg-white border border-[var(--farm-border)] shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-[var(--farm-primary)] to-[#8fae4c] text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center">
                  <span className="text-lg">🔐</span>
                </div>
                <span className="text-sm font-bold uppercase tracking-[0.18em]">Sign in</span>
              </div>
              <button
                onClick={() => setShowLogin(false)}
                className="rounded-full bg-white/20 h-7 w-7 flex items-center justify-center text-xs hover:bg-white/30 transition-colors"
                aria-label="Close login"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleLogin} className="p-6 space-y-5 text-[var(--farm-text-dark)]">
              <div className="space-y-1.5">
                <label htmlFor="name" className="text-sm font-semibold text-[var(--farm-text-label)]">
                  Select your name
                </label>
                <select
                  id="name"
                  value={selectedName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  disabled={usersLoading || !!usersError || users.length === 0}
                  className="farm-input"
                >
                  {usersLoading && <option value="">Loading users...</option>}
                  {!usersLoading && usersError && <option value="">Error loading users</option>}
                  {!usersLoading && !usersError && users.length === 0 && (
                    <option value="">No users found</option>
                  )}
                  {!usersLoading && !usersError && users.length > 0 && (
                    <>
                      <option value="">Choose an option...</option>
                      {users.map((user) => (
                        <option key={user.name} value={user.name}>
                          {user.name}
                        </option>
                      ))}
                    </>
                  )}
                </select>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="number" className="text-sm font-semibold text-[var(--farm-text-label)]">
                  Or enter your number
                </label>
                <input
                  id="number"
                  value={number}
                  onChange={(e) => handleNumberChange(e.target.value)}
                  className="farm-input"
                  placeholder="Phone or member number"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="password" className="text-sm font-semibold text-[var(--farm-text-label)]">
                  Passcode
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="farm-input bg-[var(--farm-bg-warm)]"
                  placeholder="Enter your passcode"
                />
                <p className="text-[11px] text-[var(--farm-text-muted)]">Your passcode is set by a site admin.</p>
              </div>

              {loginError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-700 font-medium">{loginError}</div>
              )}

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => setShowLogin(false)}
                  className="farm-btn farm-btn-outline"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="farm-btn farm-btn-primary rounded-full px-6"
                >
                  {isSubmitting ? "Signing in…" : "Login"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
