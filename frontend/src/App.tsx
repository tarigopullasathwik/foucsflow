import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './firebase';

// Page Imports
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import TasksPage from './pages/TasksPage';
import PlannerPage from './pages/PlannerPage';
import CalendarPage from './pages/CalendarPage';
import AnalyticsPage from './pages/AnalyticsPage';
import PreferencesPage from './pages/PreferencesPage';

// Component Imports
import Sidebar from './components/Sidebar';
import AICoachDrawer from './components/AICoachDrawer';
import NotificationBell from './components/NotificationBell';

// Protected Route Guard
function ProtectedLayout() {
  const { user, loading } = useAuth();
  const [isCoachOpen, setIsCoachOpen] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#09090b] flex flex-col justify-center items-center">
        <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-zinc-500 text-xs font-mono mt-4">Validating session security...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-[#09090b] flex flex-col lg:flex-row overflow-hidden">
      {/* Sidebar Layout */}
      <Sidebar onOpenCoach={() => setIsCoachOpen(true)} />

      {/* Main Panel Content Area */}
      <main className="flex-1 flex flex-col min-w-0 relative">
        {/* Top-right notifications bell (floating, above content) */}
        <div className="fixed top-4 right-4 z-[60]">
          <NotificationBell />
        </div>
        <Outlet context={{ onOpenCoach: () => setIsCoachOpen(true) }} />
      </main>

      {/* Slide-out AI Coach Chat Panel */}
      <AICoachDrawer isOpen={isCoachOpen} onClose={() => setIsCoachOpen(false)} />
    </div>
  );
}

function AppContent() {
  const { user } = useAuth();

  return (
    <Routes>
      {/* Public Pages */}
      <Route path="/" element={user ? <Navigate to="/dashboard" replace /> : <LandingPage />} />
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
      <Route path="/register" element={user ? <Navigate to="/dashboard" replace /> : <LoginPage />} />

      {/* Protected SaaS App Dashboard Dashboard */}
      <Route element={<ProtectedLayout />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/tasks" element={<TasksPage />} />
        <Route path="/planner" element={<PlannerPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/preferences" element={<PreferencesPage />} />
      </Route>

      {/* Fallback wildcard */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </AuthProvider>
  );
}
