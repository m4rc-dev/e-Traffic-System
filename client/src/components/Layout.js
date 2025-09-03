import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Logo from './Logo';
import {
  Menu,
  X,
  Home,
  FileText,
  Users,
  BarChart3,
  Settings,
  User,
  LogOut,
  Bell,
} from 'lucide-react';

const Layout = ({ children }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);



  const adminNavItems = [
    { name: 'Dashboard', href: '/dashboard', icon: Home },
    { name: 'Violations', href: '/violations', icon: FileText },
    { name: 'Enforcers', href: '/enforcers', icon: Users },
    { name: 'Reports', href: '/reports', icon: BarChart3 },
    { name: 'Settings', href: '/settings', icon: Settings },
  ];

  // Only admin navigation is needed since enforcers use IoT devices
  const navItems = adminNavItems;

  const handleLogout = async () => {
    await logout();
  };

  return (
    <div className="min-h-screen w-full overflow-x-hidden" style={{ backgroundColor: '#F9F9F9' }}>
      {/* Sidebar */}
      <div className={`sidebar mobile-sidebar ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'} lg:translate-x-0`}>
        <div className="flex items-center justify-between h-16 px-4 sm:px-6 border-b border-gray-200">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Logo size="default" />
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 touch-target"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <nav className="mt-6 px-3">
          <div className="space-y-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`group flex items-center px-3 py-3 sm:py-2 text-sm font-medium rounded-md transition-all duration-200 ease-in-out transform hover:scale-105 touch-target ${
                    isActive
                      ? 'bg-primary-100 text-primary-700 shadow-sm'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 hover:shadow-sm'
                  }`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <item.icon
                    className={`mr-3 h-5 w-5 transition-all duration-200 ${
                      isActive ? 'text-primary-500 scale-110' : 'text-gray-400 group-hover:text-gray-500 group-hover:scale-110'
                    }`}
                  />
                  <span className="transition-all duration-200 responsive-text-sm">{item.name}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center min-w-0 flex-1">
              <div className="flex-shrink-0">
                <div className="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center">
                  <User className="h-4 w-4 text-primary-600" />
                </div>
              </div>
              <div className="ml-3 min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-700 truncate">{user?.full_name}</p>
                <p className="text-xs text-gray-500 capitalize truncate">{user?.role}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 text-gray-400 hover:text-gray-500 hover:bg-gray-100 rounded-md touch-target flex-shrink-0"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Overlay */}
      {sidebarOpen && (
        <div
          className="sidebar-overlay sidebar-overlay-open lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <div className="lg:pl-80 min-w-0 flex-1">
        {/* Top bar */}
        <div className="sticky top-0 z-40 flex items-center gap-x-4 sm:gap-x-6 bg-white px-4 py-3 sm:py-4 shadow-sm sm:px-6 lg:hidden">
          <button
            type="button"
            className="-m-2.5 p-2.5 text-gray-700 lg:hidden touch-target"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-6 w-6" />
          </button>
          <div className="flex-1 flex items-center justify-center min-w-0">
            <Logo size="small" />
          </div>
          <div className="flex items-center gap-x-2 sm:gap-x-4">
            <button className="p-2 text-gray-400 hover:text-gray-500 touch-target">
              <Bell className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-x-2 min-w-0">
              <div className="h-6 w-6 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                <User className="h-3 w-3 text-primary-600" />
              </div>
              <span className="text-sm font-medium text-gray-700 truncate hidden sm:block">{user?.full_name}</span>
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="pt-4 pb-6 lg:pt-6 lg:pb-8">
          <div className="px-4 sm:px-6 lg:px-8 w-full max-w-none">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
