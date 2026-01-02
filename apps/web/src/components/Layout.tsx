import { clsx } from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  BarChart3,
  Brain,
  FileText,
  Menu,
  MessageSquare,
  ScrollText,
  Settings,
  Shield,
  User,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import { api } from "../lib/api";
import { getTheme, onThemeChange, setTheme, Theme } from "../lib/theme";

export function Layout() {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Enable global keyboard shortcuts
  useKeyboardShortcuts();

  // Load theme from server preferences (fallback to localStorage), and keep server in sync.
  useEffect(() => {
    let cancelled = false;

    const isTheme = (v: unknown): v is Theme => v === "dark" || v === "light";

    (async () => {
      try {
        const pref = await api.preferences.get("theme");
        if (cancelled) return;
        if (isTheme(pref.value)) {
          setTheme(pref.value, { emit: false });
          return;
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        // If missing, backfill server from local.
        if (/not found/i.test(msg)) {
          try {
            await api.preferences.set("theme", getTheme());
          } catch {
            // ignore
          }
        }
      }
    })();

    let timer: number | undefined;
    const unsubscribe = onThemeChange((theme) => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        api.preferences.set("theme", theme).catch(() => {});
      }, 150);
    });

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
      unsubscribe();
    };
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  const navItems = [
    { path: "/chat", label: "Chat", icon: MessageSquare },
    { path: "/memory", label: "Memory", icon: Brain },
    { path: "/analytics", label: "Analytics", icon: BarChart3 },
    { path: "/knowledge", label: "Knowledge", icon: FileText },
    { path: "/insights", label: "Insights", icon: BarChart3 },
    { path: "/identity", label: "Identity", icon: User },
    { path: "/receipts", label: "Receipts", icon: FileText },
    { path: "/status", label: "System Status", icon: AlertTriangle },
    { path: "/logs", label: "Logs", icon: ScrollText },
    { path: "/settings", label: "Settings", icon: Settings },
  ];

  const mobilePrimaryNavItems = [
    { path: "/chat", label: "Chat", icon: MessageSquare },
    { path: "/memory", label: "Memory", icon: Brain },
    { path: "/knowledge", label: "Knowledge", icon: FileText },
    { path: "/settings", label: "Settings", icon: Settings },
  ];

  const handleVibrate = () => {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(10);
    }
  };

  const SidebarContent = () => (
    <>
      <div className="p-6 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-6 h-6 text-emerald-500" />
          <span className="font-bold text-xl tracking-tight text-white">
            Aperion
          </span>
        </div>
        {/* Mobile Close Button */}
        <button
          onClick={() => setIsMobileMenuOpen(false)}
          className="md:hidden p-1 text-gray-400 hover:text-white"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      <nav className="flex-1 p-4 space-y-2 overflow-y-auto no-scrollbar">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname.startsWith(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={handleVibrate}
              aria-current={isActive ? "page" : undefined}
              className={clsx(
                "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200",
                isActive
                  ? "bg-emerald-500/20 text-emerald-400 shadow-lg shadow-emerald-900/20 border border-emerald-500/10"
                  : "text-gray-400 hover:bg-white/5 hover:text-gray-200",
              )}
            >
              <Icon className="w-5 h-5" aria-hidden="true" />
              <span className="font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-white/5 text-xs text-gray-500">
        <p>Private Instance</p>
        <p className="mt-1">v0.1.0</p>
      </div>
    </>
  );

  return (
    <div className="flex h-screen h-[100dvh] overflow-hidden bg-transparent min-h-0">
      {/* Desktop Sidebar (Hidden on Mobile) */}
      <aside
        className="hidden md:flex w-64 glass-dark border-r border-white/5 flex-col z-20"
        role="navigation"
        aria-label="Main navigation"
      >
        <SidebarContent />
      </aside>

      {/* Mobile Bottom Action Rail */}
      <nav
        className={clsx(
          "md:hidden fixed bottom-0 left-0 right-0 z-30 glass-dark border-t border-white/5",
          "pb-[env(safe-area-inset-bottom)]",
        )}
        aria-label="Primary navigation"
      >
        <div className="grid grid-cols-5 h-14">
          {mobilePrimaryNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={handleVibrate}
                aria-current={isActive ? "page" : undefined}
                className={clsx(
                  "flex flex-col items-center justify-center gap-1 text-[11px]",
                  "motion-base",
                  isActive
                    ? "text-emerald-400"
                    : "text-gray-400 hover:text-gray-200",
                )}
              >
                <Icon className="w-5 h-5" aria-hidden="true" />
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}

          <button
            type="button"
            onClick={() => {
              handleVibrate();
              setIsMobileMenuOpen(true);
            }}
            className={clsx(
              "flex flex-col items-center justify-center gap-1 text-[11px]",
              "motion-base",
              isMobileMenuOpen
                ? "text-emerald-400"
                : "text-gray-400 hover:text-gray-200",
            )}
            aria-label="More"
          >
            <Menu className="w-5 h-5" aria-hidden="true" />
            <span className="font-medium">More</span>
          </button>
        </div>
      </nav>

      {/* Mobile Sidebar Drawer */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            />
            {/* Drawer */}
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", bounce: 0, duration: 0.3 }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={{ left: 0.2, right: 0.2 }}
              onDragEnd={(_, info) => {
                if (info.offset.x < -50) {
                  setIsMobileMenuOpen(false);
                }
              }}
              className="md:hidden fixed top-0 bottom-0 left-0 w-[80%] max-w-sm glass-dark border-r border-white/5 flex flex-col z-50 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
            >
              <SidebarContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative z-10 pt-[env(safe-area-inset-top)] md:pt-0 pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-0 min-w-0 min-h-0">
        <div className="flex-1 overflow-y-auto no-scrollbar p-0 min-h-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="h-full"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
