export type Theme = "dark" | "light";

const THEME_KEY = "theme";
const THEME_EVENT = "aperion:theme";

export function getTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  return window.localStorage.getItem(THEME_KEY) === "light" ? "light" : "dark";
}

export function applyTheme(theme: Theme): void {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", theme === "dark");
}

export function setTheme(theme: Theme, opts?: { emit?: boolean }): void {
  const emit = opts?.emit !== false;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(THEME_KEY, theme);
    if (emit) {
      window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: theme }));
    }
  }
  applyTheme(theme);
}

export function toggleTheme(): Theme {
  const next: Theme = getTheme() === "dark" ? "light" : "dark";
  setTheme(next);
  return next;
}

export function onThemeChange(handler: (theme: Theme) => void): () => void {
  if (typeof window === "undefined") return () => {};

  const listener = (e: Event) => {
    const detailTheme = (e as CustomEvent).detail as Theme | undefined;
    handler(detailTheme ?? getTheme());
  };

  window.addEventListener(THEME_EVENT, listener);
  return () => window.removeEventListener(THEME_EVENT, listener);
}
