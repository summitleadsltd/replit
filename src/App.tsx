import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { useAuthStore } from '@/stores/authStore';
import { AuthGuard } from '@/components/shared/AuthGuard';
import { AppLayout } from '@/components/layout/AppLayout';

// Auth
import { LoginPage } from '@/pages/auth/LoginPage';

// Technician
import { TechnicianDashboard } from '@/pages/technician/TechnicianDashboard';
import { TechnicianCalendar } from '@/pages/technician/TechnicianCalendar';
import { TechnicianRouteMap } from '@/pages/technician/TechnicianRouteMap';
import { TechnicianAvailability } from '@/pages/technician/TechnicianAvailability';

// Scheduler
import { SchedulerDashboard } from '@/pages/scheduler/SchedulerDashboard';
import { CreateBooking } from '@/pages/scheduler/CreateBooking';
import { SchedulerCalendar } from '@/pages/scheduler/SchedulerCalendar';
import { CustomersPage } from '@/pages/scheduler/CustomersPage';

// Manager
import { ManagerDashboard } from '@/pages/manager/ManagerDashboard';
import { DispatchBoard } from '@/pages/manager/DispatchBoard';
import { ManagerCalendar } from '@/pages/manager/ManagerCalendar';
import { TechnicianManagement } from '@/pages/manager/TechnicianManagement';
import { SchedulerManagement } from '@/pages/manager/SchedulerManagement';
import { ReportsPage } from '@/pages/manager/ReportsPage';
import { SettingsPage } from '@/pages/manager/SettingsPage';

function AppRoutes() {
  const { profile } = useAuthStore();

  const defaultRoute = profile
    ? profile.role === 'manager'
      ? '/manager/dashboard'
      : profile.role === 'scheduler'
        ? '/scheduler/dashboard'
        : '/technician/dashboard'
    : '/login';

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      {/* Technician Portal */}
      <Route
        element={
          <AuthGuard allowedRoles={['technician']}>
            <AppLayout />
          </AuthGuard>
        }
      >
        <Route path="/technician/dashboard" element={<TechnicianDashboard />} />
        <Route path="/technician/calendar" element={<TechnicianCalendar />} />
        <Route path="/technician/route" element={<TechnicianRouteMap />} />
        <Route path="/technician/availability" element={<TechnicianAvailability />} />
      </Route>

      {/* Scheduler Portal */}
      <Route
        element={
          <AuthGuard allowedRoles={['scheduler']}>
            <AppLayout />
          </AuthGuard>
        }
      >
        <Route path="/scheduler/dashboard" element={<SchedulerDashboard />} />
        <Route path="/scheduler/booking" element={<CreateBooking />} />
        <Route path="/scheduler/calendar" element={<SchedulerCalendar />} />
        <Route path="/scheduler/customers" element={<CustomersPage />} />
      </Route>

      {/* Manager Portal */}
      <Route
        element={
          <AuthGuard allowedRoles={['manager']}>
            <AppLayout />
          </AuthGuard>
        }
      >
        <Route path="/manager/dashboard" element={<ManagerDashboard />} />
        <Route path="/manager/dispatch" element={<DispatchBoard />} />
        <Route path="/manager/calendar" element={<ManagerCalendar />} />
        <Route path="/manager/technicians" element={<TechnicianManagement />} />
        <Route path="/manager/schedulers" element={<SchedulerManagement />} />
        <Route path="/manager/customers" element={<CustomersPage />} />
        <Route path="/manager/reports" element={<ReportsPage />} />
        <Route path="/manager/settings" element={<SettingsPage />} />
      </Route>

      <Route path="*" element={<Navigate to={defaultRoute} replace />} />
    </Routes>
  );
}

export default function App() {
  const { initialize, initialized } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  if (!initialized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
          <p className="text-muted-foreground">Loading Summit Scheduler...</p>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <AppRoutes />
      <Toaster />
    </BrowserRouter>
  );
}
