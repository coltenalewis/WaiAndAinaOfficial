"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { loadSession, saveSession } from "@/lib/session";

export default function LoginPage() {
  const router = useRouter();

  // Users from Notion (names only)
  const [users, setUsers] = useState<string[]>([]);
  const [usersLoading, setUsersLoading] = useState<boolean>(true);
  const [usersError, setUsersError] = useState<string | null>(null);

  // Selected user + login form
  const [selectedName, setSelectedName] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- On mount: if a session exists, skip login and go straight to hub ---
  useEffect(() => {
    const existing = loadSession();
    if (existing && existing.name) {
      router.replace("/hub");
    }
  }, [router]);

  // --- Fetch users from /api/users (Notion-backed) ---
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
        setUsers(data.users || []);
      } catch (err) {
        console.error("Failed to load users:", err);
        setUsersError(
          "Unable to load users. Please refresh or try again later."
        );
      } finally {
        setUsersLoading(false);
      }
    }

    loadUsersList();
  }, []);

  // --- Login handler (name + password) ---
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedName || !password) return;

    setIsSubmitting(true);
    setLoginError(null);

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: selectedName,
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

      // Save session locally so refresh keeps them logged in
      saveSession({ name: selectedName });

      // Tween step: first go to welcome screen
      router.push("/welcome");
    } catch (err) {
      console.error("Login error:", err);
      setLoginError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen flex flex-col bg-[#f8f4e3] text-[#3b4224]">
      {/* Top gradient header with logo */}
      <header className="w-full h-52 bg-gradient-to-b from-[#0e4fb1] via-[#3f7fd3] to-[#a6c3e9] flex flex-col items-center justify-center">
        <div className="flex flex-col items-center">
          <img src="/logo.png" alt="Wai & Aina" className="h-24 w-auto" />
          <span className="mt-3 text-sm tracking-[0.25em] text-[#f5f7fb] uppercase">
            Wai & Aina Homeapp
          </span>
        </div>
      </header>

      {/* Main content */}
      <section className="flex-1 flex flex-col items-center pt-10 px-4 pb-12">
        <div className="w-full max-w-4xl">
          {/* Title bar */}
          <div className="w-full rounded-t-lg bg-[#dde0b8] py-3 text-center shadow-sm">
            <h1 className="text-lg font-semibold tracking-wide text-[#5d7f3b] uppercase">
              Who are you today?
            </h1>
          </div>

          {/* Form container */}
          <div className="w-full bg-[#d3d6b0] rounded-b-lg px-6 py-6 shadow-sm border-t border-white/60">
            <form
              onSubmit={handleLogin}
              className="max-w-xl mx-auto flex flex-col gap-4"
            >
              {/* Name select */}
              <div className="flex flex-col gap-2">
                <label
                  htmlFor="name"
                  className="text-sm font-medium text-[#4f5730]"
                >
                  Select your name
                </label>

                <div className="relative">
                  <select
                    id="name"
                    value={selectedName}
                    onChange={(e) => setSelectedName(e.target.value)}
                    disabled={
                      usersLoading || !!usersError || users.length === 0
                    }
                    className="w-full appearance-none rounded-md border border-[#c8cba0] bg-[#dfe2bd] px-4 py-3 text-sm font-medium text-[#3b4224] shadow-inner focus:outline-none focus:ring-2 focus:ring-[#8fae4c] focus:border-[#8fae4c] cursor-pointer disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {usersLoading && <option value="">Loading users...</option>}

                    {!usersLoading && usersError && (
                      <option value="">Error loading users</option>
                    )}

                    {!usersLoading && !usersError && users.length === 0 && (
                      <option value="">No users found</option>
                    )}

                    {!usersLoading &&
                      !usersError &&
                      users.length > 0 && (
                        <>
                          <option value="">Choose an option...</option>
                          {users.map((name) => (
                            <option key={name} value={name}>
                              {name}
                            </option>
                          ))}
                        </>
                      )}
                  </select>

                  {/* Dropdown arrow */}
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4">
                    <svg
                      className="h-4 w-4 text-[#6a7240]"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M5.23 7.21a.75.75 0 011.06.02L10 11.084l3.71-3.854a.75.75 0 111.08 1.04l-4.24 4.4a.75.75 0 01-1.08 0l-4.24-4.4a.75.75 0 01.02-1.06z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Passcode */}
              <div className="flex flex-col gap-2">
                <label
                  htmlFor="password"
                  className="text-sm font-medium text-[#4f5730]"
                >
                  Passcode
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-md border border-[#c8cba0] bg-[#f1edd8] px-3 py-2 text-sm text-[#3b4224] shadow-inner focus:outline-none focus:ring-2 focus:ring-[#8fae4c] focus:border-[#8fae4c]"
                  placeholder="Enter your passcode"
                />
                <p className="text-[11px] text-[#7a7f54]">
                  Your passcode is set in the Wai &amp; Aina guest list.
                </p>
              </div>

              {usersError && (
                <p className="text-xs text-red-700">{usersError}</p>
              )}

              {loginError && (
                <div className="rounded-md border border-red-500/80 bg-red-500/10 px-3 py-2 text-xs text-red-800">
                  {loginError}
                </div>
              )}

              {/* Login button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={
                    !selectedName ||
                    !password ||
                    isSubmitting ||
                    usersLoading ||
                    !!usersError
                  }
                  className="w-full rounded-md bg-[#a0b764] py-3 text-center text-sm font-semibold tracking-wide text-[#f9f9ec] uppercase shadow-md hover:bg-[#95ad5e] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                  {isSubmitting ? "Logging in..." : "Login"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}
