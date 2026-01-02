/*
 * Aperion web service worker (production enabled).
 *
 * Intentionally minimal: no fetch interception/caching yet.
 * This establishes a stable SW lifecycle baseline without risking
 * auth redirects or cache-related drift.
 */

self.addEventListener("install", (event) => {
  // Activate quickly; the app controls any future caching strategy.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
