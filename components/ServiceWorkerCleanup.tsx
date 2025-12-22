"use client";

import { useEffect, useRef } from "react";

export function ServiceWorkerCleanup() {
  const didRunRef = useRef(false);

  useEffect(() => {
    if (didRunRef.current) return;
    didRunRef.current = true;

    const cleanup = async () => {
      if (typeof window === "undefined") return;

      if ("serviceWorker" in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.unregister()));
      }

      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      }
    };

    void cleanup();
  }, []);

  return null;
}
