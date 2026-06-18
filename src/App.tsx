import { useEffect, lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { useMobileAuth } from "@/hooks/use-mobile-auth";
import ErrorBoundary from "@/components/ErrorBoundary";

import AppLayout from "@/components/layout/AppLayout";
import RoleGuard from "@/components/layout/RoleGuard";

const Landing = lazy(() => import("@/pages/Landing"));
const Auth = lazy(() => import("@/pages/Auth"));
const AuthCallback = lazy(() => import("@/pages/AuthCallback"));
const SetPassword = lazy(() => import("@/pages/SetPassword"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Contacts = lazy(() => import("@/pages/Contacts"));
const Campaigns = lazy(() => import("@/pages/Campaigns"));
const CampaignDetail = lazy(() => import("@/pages/CampaignDetail"));
const Dialer = lazy(() => import("@/pages/Dialer"));
const Imports = lazy(() => import("@/pages/Imports"));
const Callbacks = lazy(() => import("@/pages/Callbacks"));
const Recordings = lazy(() => import("@/pages/Recordings"));
const Reports = lazy(() => import("@/pages/Reports"));
const CrmSettings = lazy(() => import("@/pages/CrmSettings"));
const UserManagement = lazy(() => import("@/pages/UserManagement"));
const ClientPortal = lazy(() => import("@/pages/ClientPortal"));
const TeamDashboard = lazy(() => import("@/pages/TeamDashboard"));
const QaDashboard = lazy(() => import("@/pages/QaDashboard"));
const AgentPerformance = lazy(() => import("@/pages/AgentPerformance"));
const MyFeedback = lazy(() => import("@/pages/MyFeedback"));
const NotFound = lazy(() => import("@/pages/NotFound"));
const Appointments = lazy(() => import("@/pages/Appointments"));
const DialerScripts = lazy(() => import("@/pages/DialerScripts"));
const TrainingHub = lazy(() => import("@/pages/TrainingHub"));
const FollowUpTasks = lazy(() => import("@/pages/FollowUpTasks"));
const TechnicianCalendar = lazy(() => import("@/pages/TechnicianCalendar"));
const TechnicianDashboard = lazy(() => import("@/pages/TechnicianDashboard"));
const LeadAssignment = lazy(() => import("@/pages/LeadAssignment"));
const Clients = lazy(() => import("@/pages/Clients"));
const ClientProfile = lazy(() => import("@/pages/ClientProfile"));
const ConfirmerQueue = lazy(() => import("@/pages/ConfirmerQueue"));
const UserProfile = lazy(() => import("@/pages/UserProfile"));
const TechnicianAvailability = lazy(() => import("@/pages/TechnicianAvailability"));
const Confirmations = lazy(() => import("@/pages/Confirmations"));
const CallHistory = lazy(() => import("@/pages/CallHistory"));
n// Comparison pages
const JobNimbusComparison = lazy(() => import("@/pages/compare/JobNimbus"));
const ServiceTitanComparison = lazy(() => import("@/pages/compare/ServiceTitan"));
const HousecallProComparison = lazy(() => import("@/pages/compare/HousecallPro"));
const GoHighLevelComparison = lazy(() => import("@/pages/compare/GoHighLevel"));
const HubSpotComparison = lazy(() => import("@/pages/compare/HubSpot"));

// SolarScout UK pages
const SolarDashboard = lazy(() => import("@/pages/SolarDashboard"));
const SolarProspects = lazy(() => import("@/pages/SolarProspects"));
const SolarSettings = lazy(() => import("@/pages/SolarSettings"));
const SolarOnboarding = lazy(() => import("@/pages/SolarOnboarding"));


const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
});

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();

  // Only show spinner on *initial* load (before we ever had a session).
  // Once a session is established, keep rendering children even during
  // background token refreshes — prevents unmounting the Dialer/other pages
  // when the user switches tabs and Supabase refreshes the JWT.
  if (loading && !session) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

function RoleRedirect() {
  const { role, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Only redirect if user is on the root path
  if (location.pathname === "/") {
    if (role === "client") return <Navigate to="/client-portal" replace />;
    if (role === "confirmer") return <Navigate to="/confirmer-queue" replace />;
    if (role === "team_leader") return <Navigate to="/team-dashboard" replace />;
    if (role === "technician") return <Navigate to="/technician-dashboard" replace />;
    if (role === "manager") return <Navigate to="/team-dashboard" replace />;
    if (role === "agent") return <Navigate to="/dialer" replace />;
    // admin sees the Dashboard overview at /
    return <Dashboard />;
  }

  return <Dashboard />;
}

const LazyFallback = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

function MobileAuthHandler() {
  useMobileAuth();
  return null;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <AuthProvider>
          <MobileAuthHandler />
          <Suspense fallback={<LazyFallback />}>
            <Routes>
              {/* Public routes */}
              <Route path="/" element={<Landing />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route path="/set-password" element={<SetPassword />} />
n              {/* Comparison routes */}
              <Route path="/compare/jobnimbus" element={<JobNimbusComparison />} />
              <Route path="/compare/servicetitan" element={<ServiceTitanComparison />} />
              <Route path="/compare/housecall-pro" element={<HousecallProComparison />} />
              <Route path="/compare/gohighlevel" element={<GoHighLevelComparison />} />
              <Route path="/compare/hubspot" element={<HubSpotComparison />} />
              
              {/* Protected routes */}
              <Route
                element={
                  <AuthGuard>
                    <AppLayout />
                  </AuthGuard>
                }
              >
                <Route path="/" element={<RoleRedirect />} />

                <Route path="/contacts" element={
                  <RoleGuard allowedRoles={["admin", "agent"]}><Contacts /></RoleGuard>
                } />
                <Route path="/dialer" element={
                  <RoleGuard allowedRoles={["admin", "agent", "confirmer"]}><Dialer /></RoleGuard>
                } />
                <Route path="/callbacks" element={
                  <RoleGuard allowedRoles={["admin", "agent", "manager", "confirmer"]}><Callbacks /></RoleGuard>
                } />
                <Route path="/appointments" element={
                  <RoleGuard allowedRoles={["admin", "agent", "manager", "confirmer", "team_leader"]}><Appointments /></RoleGuard>
                } />
                <Route path="/technicians" element={
                  <RoleGuard allowedRoles={["admin", "manager", "team_leader", "agent", "client", "technician", "confirmer"]}><TechnicianCalendar /></RoleGuard>
                } />
                <Route path="/technician-calendar" element={
                  <RoleGuard allowedRoles={["admin", "manager", "technician", "team_leader"]}><TechnicianCalendar /></RoleGuard>
                } />
                <Route path="/confirmer-queue" element={
                  <RoleGuard allowedRoles={["admin", "confirmer"]}><ConfirmerQueue /></RoleGuard>
                } />
                <Route path="/technician-dashboard" element={
                  <RoleGuard allowedRoles={["admin", "manager", "technician"]}><TechnicianDashboard /></RoleGuard>
                } />
                <Route path="/tasks" element={
                  <RoleGuard allowedRoles={["admin", "agent", "team_leader"]}><FollowUpTasks /></RoleGuard>
                } />
                <Route path="/scripts" element={
                  <RoleGuard allowedRoles={["admin", "agent", "team_leader"]}><DialerScripts /></RoleGuard>
                } />
                <Route path="/training" element={
                  <RoleGuard allowedRoles={["admin", "agent", "team_leader"]}><TrainingHub /></RoleGuard>
                } />

                <Route path="/campaigns" element={
                  <RoleGuard allowedRoles={["admin"]}><Campaigns /></RoleGuard>
                } />
                <Route path="/campaigns/:id" element={
                  <RoleGuard allowedRoles={["admin"]}><CampaignDetail /></RoleGuard>
                } />
                <Route path="/imports" element={
                  <RoleGuard allowedRoles={["admin"]}><Imports /></RoleGuard>
                } />
                <Route path="/recordings" element={
                  <RoleGuard allowedRoles={["admin", "manager", "team_leader", "agent"]}><Recordings /></RoleGuard>
                } />
                <Route path="/call-history" element={
                  <RoleGuard allowedRoles={["admin", "manager", "team_leader", "agent", "confirmer"]}><CallHistory /></RoleGuard>
                } />
                <Route path="/reports" element={
                  <RoleGuard allowedRoles={["admin", "manager", "team_leader"]}><Reports /></RoleGuard>
                } />
                <Route path="/settings" element={
                  <RoleGuard allowedRoles={["admin"]}><CrmSettings /></RoleGuard>
                } />
                <Route path="/users" element={
                  <RoleGuard allowedRoles={["admin"]}><UserManagement /></RoleGuard>
                } />
                <Route path="/lead-assignment" element={
                  <RoleGuard allowedRoles={["admin"]}><LeadAssignment /></RoleGuard>
                } />
                <Route path="/clients" element={
                  <RoleGuard allowedRoles={["admin", "manager", "agent", "team_leader"]}><Clients /></RoleGuard>
                } />
                <Route path="/clients/:id" element={
                  <RoleGuard allowedRoles={["admin", "manager", "agent", "team_leader"]}><ClientProfile /></RoleGuard>
                } />
                <Route path="/team-dashboard" element={
                  <RoleGuard allowedRoles={["admin", "team_leader", "manager"]}><TeamDashboard /></RoleGuard>
                } />
                <Route path="/qa-dashboard" element={
                  <RoleGuard allowedRoles={["admin", "team_leader"]}><QaDashboard /></RoleGuard>
                } />
                <Route path="/agent-performance" element={
                  <RoleGuard allowedRoles={["admin", "team_leader"]}><AgentPerformance /></RoleGuard>
                } />
                <Route path="/my-feedback" element={
                  <RoleGuard allowedRoles={["admin", "agent", "team_leader"]}><MyFeedback /></RoleGuard>
                } />
                <Route path="/profile" element={
                  <UserProfile />
                } />
                <Route path="/technician-availability" element={
                  <RoleGuard allowedRoles={["admin", "manager", "technician"]}><TechnicianAvailability /></RoleGuard>
                } />
                <Route path="/confirmations" element={
                  <RoleGuard allowedRoles={["admin", "agent", "manager", "confirmer"]}><Confirmations /></RoleGuard>
                } />

                <Route path="/client-portal" element={
                  <RoleGuard allowedRoles={["client", "admin"]}><ClientPortal /></RoleGuard>
                } />

                {/* SolarScout UK Routes */}
                <Route path="/solar-dashboard" element={
                  <RoleGuard allowedRoles={["admin", "manager"]}><SolarDashboard /></RoleGuard>
                } />
                <Route path="/solar-prospects" element={
                  <RoleGuard allowedRoles={["admin", "manager", "agent"]}><SolarProspects /></RoleGuard>
                } />
                <Route path="/solar-settings" element={
                  <RoleGuard allowedRoles={["admin"]}><SolarSettings /></RoleGuard>
                } />
                <Route path="/solar-onboarding" element={
                  <SolarOnboarding />
                } />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
