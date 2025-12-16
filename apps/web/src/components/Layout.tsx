import { clsx } from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  Brain,
  FileText,
  Menu,
  MessageSquare,
  Settings,
  Shield,
  User,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";

export function Layout() {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Enable global keyboard shortcuts
  useKeyboardShortcuts();

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  const navItems = [
    { path: "/chat", label: "Chat", icon: MessageSquare },
    { path: "/memory", label: "Memory", icon: Brain },
    { path: "/identity", label: "Identity", icon: User },
    { path: "/receipts", label: "Receipts", icon: FileText },
    { path: "/status", label: "System Status", icon: AlertTriangle },
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
    <div className="flex h-screen overflow-hidden bg-transparent">
      {/* Desktop Sidebar (Hidden on Mobile) */}
      <aside
        className="hidden md:flex w-64 glass-dark border-r border-white/5 flex-col z-20"
        role="navigation"
        aria-label="Main navigation"
      >
        <SidebarContent />
      </aside>

      {/* Mobile Header (Visible on Mobile) */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 glass-dark border-b border-white/5 z-30 flex items-center justify-between px-4 pt-[env(safe-area-inset-top)]">
        <div className="flex items-center gap-2">
          <Shield className="w-6 h-6 text-emerald-500" />
          <span className="font-bold text-xl tracking-tight text-white">
            Aperion
          </span>
        </div>
        <button
          onClick={() => {
            handleVibrate();
            setIsMobileMenuOpen(true);
          }}
          className="p-2 text-gray-300 active:text-white transition-colors"
        >
          <Menu className="w-6 h-6" />
        </button>
      </div>

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
      <main className="flex-1 flex flex-col relative z-10 pt-16 md:pt-0">
        {/* We add top padding on mobile to account for the fixed header */}
        <div className="flex-1 overflow-y-auto no-scrollbar p-0">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
