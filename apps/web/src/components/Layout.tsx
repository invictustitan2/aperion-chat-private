import React from "react";
import { Link, useLocation, Outlet } from "react-router-dom";
import {
  MessageSquare,
  Brain,
  FileText,
  Shield,
  AlertTriangle,
} from "lucide-react";
import { clsx } from "clsx";

export function Layout() {
  const location = useLocation();

  const navItems = [
    { path: "/chat", label: "Chat", icon: MessageSquare },
    { path: "/memory", label: "Memory", icon: Brain },
    { path: "/receipts", label: "Receipts", icon: FileText },
    { path: "/errors", label: "Errors", icon: AlertTriangle },
  ];

  return (
    <div className="flex h-screen bg-gray-900 text-gray-100">
      {/* Sidebar */}
      <aside className="w-64 border-r border-gray-800 flex flex-col">
        <div className="p-6 border-b border-gray-800 flex items-center gap-2">
          <Shield className="w-6 h-6 text-emerald-500" />
          <span className="font-bold text-xl tracking-tight">Aperion</span>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={clsx(
                  "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
                  isActive
                    ? "bg-emerald-500/10 text-emerald-400"
                    : "hover:bg-gray-800 text-gray-400 hover:text-gray-200",
                )}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-800 text-xs text-gray-500">
          <p>Private Instance</p>
          <p className="mt-1">v0.1.0</p>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}
