'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { 
  Home, 
  Users, 
  Briefcase, 
  Clock, 
  FolderOpen, 
  Settings, 
  LogOut,
  Menu,
  X
} from 'lucide-react';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: Array<'admin' | 'project_manager' | 'developer'>;
}

const navigation: NavItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: Home },
  { name: 'Clients', href: '/clients', icon: Briefcase, roles: ['admin'] },
  { name: 'Projects', href: '/projects', icon: FolderOpen },
  { name: 'Users', href: '/users', icon: Users, roles: ['admin'] },
  { name: 'Settings', href: '/settings', icon: Settings, roles: ['admin'] },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { userProfile, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  const filteredNavigation = navigation.filter(item => {
    if (!item.roles) return true;
    return item.roles.includes(userProfile?.role || 'developer');
  }) || [];

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-background">
      {/* Mobile sidebar */}
      <div className={`fixed inset-0 flex z-40 md:hidden ${sidebarOpen ? '' : 'hidden'}`}>
        <div className="fixed inset-0 bg-gray-600 dark:bg-gray-900 bg-opacity-75 dark:bg-opacity-75" onClick={() => setSidebarOpen(false)} />
        <div className="relative flex-1 flex flex-col max-w-xs w-full bg-white dark:bg-sidebar-bg">
          <div className="absolute top-0 right-0 -mr-12 pt-2">
            <button
              type="button"
              className="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
              onClick={() => setSidebarOpen(false)}
            >
              <span className="sr-only">Close sidebar</span>
              <X className="h-6 w-6 text-white" />
            </button>
          </div>
          <div className="flex-1 h-0 pt-5 pb-4 overflow-y-auto">
            <div className="flex-shrink-0 flex items-center justify-center px-4">
              {/* Light mode logo */}
              <img 
                src="/timebank_logo_light.png" 
                alt="Timebank Logo" 
                className="w-4/5 h-auto dark:hidden"
              />
              {/* Dark mode logo */}
              <img 
                src="/timebank_logo_dark.png" 
                alt="Timebank Logo" 
                className="w-4/5 h-auto hidden dark:block"
              />
            </div>
            <nav className="mt-5 px-2 space-y-1">
              {filteredNavigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`group flex items-center px-2 py-2 text-base font-medium rounded-md ${
                    pathname === item.href
                      ? 'bg-gray-900 dark:bg-primary text-white'
                      : 'text-gray-600 dark:text-sidebar-text hover:bg-gray-50 dark:hover:bg-sidebar-hover hover:text-gray-900 dark:hover:text-foreground'
                  }`}
                >
                  <item.icon className={`mr-4 h-6 w-6 ${
                    pathname === item.href ? 'text-white' : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-500 dark:group-hover:text-gray-400'
                  }`} />
                  {item.name}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex-shrink-0 flex bg-gray-50 dark:bg-gray-800 p-4">
            <div className="flex items-center">
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-foreground">{userProfile?.name}</p>
                <p className="text-xs font-medium text-gray-500 dark:text-muted-foreground capitalize">{userProfile?.role?.replace('_', ' ')}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Static sidebar for desktop */}
      <div className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0">
        <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-sidebar-bg border-r border-gray-200 dark:border-sidebar-border">
          <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
            <div className="flex items-center justify-center flex-shrink-0 px-4">
              {/* Light mode logo */}
              <img 
                src="/timebank_logo_light.png" 
                alt="Timebank Logo" 
                className="w-4/5 h-auto dark:hidden"
              />
              {/* Dark mode logo */}
              <img 
                src="/timebank_logo_dark.png" 
                alt="Timebank Logo" 
                className="w-4/5 h-auto hidden dark:block"
              />
            </div>
            <nav className="mt-5 flex-1 px-2 space-y-1">
              {filteredNavigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md ${
                    pathname === item.href
                      ? 'bg-gray-900 dark:bg-primary text-white'
                      : 'text-gray-600 dark:text-sidebar-text hover:bg-gray-50 dark:hover:bg-sidebar-hover hover:text-gray-900 dark:hover:text-foreground'
                  }`}
                >
                  <item.icon className={`mr-3 h-5 w-5 ${
                    pathname === item.href ? 'text-white' : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-500 dark:group-hover:text-gray-400'
                  }`} />
                  {item.name}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex-shrink-0 flex bg-gray-50 dark:bg-gray-800 p-4">
            <div className="w-full flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-700 dark:text-foreground">{userProfile?.name}</p>
                <p className="text-xs font-medium text-gray-500 dark:text-muted-foreground capitalize">{userProfile?.role?.replace('_', ' ')}</p>
              </div>
              <button
                onClick={handleLogout}
                className="ml-3 p-1 rounded-full text-gray-400 dark:text-gray-500 hover:text-gray-500 dark:hover:text-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-sidebar-bg focus:ring-studio-x"
              >
                <span className="sr-only">Logout</span>
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile header */}
      <div className="md:hidden">
        <div className="flex items-center justify-between bg-white dark:bg-card shadow-sm dark:shadow-gray-800 px-4 py-2">
          {/* Light mode logo */}
          <img 
            src="/timebank_logo_light.png" 
            alt="Timebank Logo" 
            className="h-6 w-auto dark:hidden"
          />
          {/* Dark mode logo */}
          <img 
            src="/timebank_logo_dark.png" 
            alt="Timebank Logo" 
            className="h-6 w-auto hidden dark:block"
          />
          <button
            type="button"
            className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-studio-x"
            onClick={() => setSidebarOpen(true)}
          >
            <span className="sr-only">Open sidebar</span>
            <Menu className="h-6 w-6" />
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="md:pl-64 flex flex-col flex-1">
        <main className="flex-1">
          <div className="py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}