import React from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { MessageSquare, Database, FileText } from 'lucide-react';
import clsx from 'clsx';

export function Layout() {
  const location = useLocation();

  const navItems = [
    { path: '/', icon: MessageSquare, label: 'Chat' },
    { path: '/memory', icon: Database, label: 'Memory' },
    { path: '/receipts', icon: FileText, label: 'Receipts' },
  ];

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex">
      <nav className="w-64 bg-gray-800 border-r border-gray-700 p-4 flex flex-col">
        <h1 className="text-xl font-bold mb-8 text-blue-400">Aperion Chat</h1>
        <div className="space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={clsx(
                  'flex items-center gap-3 px-4 py-2 rounded-lg transition-colors',
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:bg-gray-700 hover:text-white'
                )}
              >
                <Icon size={20} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
      <main className="flex-1 p-8 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
