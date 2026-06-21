import { NavLink } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import {
  LayoutDashboard,
  Calendar,
  Users,
  MapPin,
  Clock,
  UserPlus,
  BarChart3,
  Settings,
  Columns3,
  BookOpen,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const managerLinks = [
  { to: '/manager/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/manager/dispatch', label: 'Dispatch Board', icon: Columns3 },
  { to: '/manager/calendar', label: 'Calendar', icon: Calendar },
  { to: '/manager/technicians', label: 'Technicians', icon: Users },
  { to: '/manager/schedulers', label: 'Schedulers', icon: UserPlus },
  { to: '/manager/customers', label: 'Customers', icon: BookOpen },
  { to: '/manager/reports', label: 'Reports', icon: BarChart3 },
  { to: '/manager/settings', label: 'Settings', icon: Settings },
];

const schedulerLinks = [
  { to: '/scheduler/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/scheduler/booking', label: 'Create Booking', icon: UserPlus },
  { to: '/scheduler/calendar', label: 'Calendar', icon: Calendar },
  { to: '/scheduler/customers', label: 'Customers', icon: BookOpen },
];

const technicianLinks = [
  { to: '/technician/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/technician/calendar', label: 'Calendar', icon: Calendar },
  { to: '/technician/route', label: 'Route Map', icon: MapPin },
  { to: '/technician/availability', label: 'Availability', icon: Clock },
];

export function Sidebar() {
  const { profile, signOut } = useAuthStore();
  const [mobileOpen, setMobileOpen] = useState(false);

  const links =
    profile?.role === 'manager'
      ? managerLinks
      : profile?.role === 'scheduler'
        ? schedulerLinks
        : technicianLinks;

  const navContent = (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b">
        <h1 className="text-xl font-bold text-primary">Summit Scheduler</h1>
        <p className="text-xs text-muted-foreground mt-1 capitalize">{profile?.role} Portal</p>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )
            }
          >
            <link.icon className="h-4 w-4" />
            {link.label}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t">
        <div className="flex items-center gap-3 px-3 py-2 mb-2">
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-sm font-medium text-primary">
              {profile?.name?.charAt(0)?.toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{profile?.name}</p>
            <p className="text-xs text-muted-foreground truncate">{profile?.email}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-muted-foreground"
          onClick={signOut}
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 left-4 z-50 lg:hidden"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-0 h-full w-64 bg-white border-r z-40 transition-transform lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {navContent}
      </aside>
    </>
  );
}
