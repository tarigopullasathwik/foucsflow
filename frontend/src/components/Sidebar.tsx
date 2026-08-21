import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  CheckSquare, 
  CalendarDays, 
  LineChart, 
  Settings, 
  LogOut, 
  Menu, 
  X, 
  Sparkles,
  Bot
} from 'lucide-react';
import { useAuth } from '../firebase';
import { useBreakpoints } from '../hooks/useBreakpoints';

interface SidebarProps {
  onOpenCoach: () => void;
}

export default function Sidebar({ onOpenCoach }: SidebarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { isMobile, isTablet, isDesktop } = useBreakpoints();

  const menuItems = [
    { name: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
    { name: 'Task Board', icon: CheckSquare, path: '/tasks' },
    { name: 'Smart Planner', icon: Sparkles, path: '/planner' },
    { name: 'My Calendar', icon: CalendarDays, path: '/calendar' },
    { name: 'Analytics', icon: LineChart, path: '/analytics' },
    { name: 'Preferences', icon: Settings, path: '/preferences' },
  ];

  const handleNavigate = (path: string) => {
    navigate(path);
    // On mobile/tablet, close sidebar after navigation
    if (isMobile || isTablet) {
      setIsOpen(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
      if (isMobile || isTablet) setIsOpen(false);
    } catch (e) {
      console.error("Failed to log out", e);
    }
  };

  // On desktop, sidebar is always open by default
  useEffect(() => {
    if (isDesktop) {
      setIsOpen(true);
    }
  }, [isDesktop]);

  return (
    <>
      {/* Mobile/Tablet Toggle Button */}
      {!isDesktop && (
        <div className="lg:hidden fixed top-4 left-4 z-50">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="p-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-100 focus:outline-none"
          >
            {isOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      )}

      {/* Sidebar container */}
      <aside 
        className={`
          fixed 
          top-0 
          bottom-0 
          left-0 
          z-40 
          w-64 
          bg-zinc-950/80 
          backdrop-blur-md 
          border-r 
          border-zinc-900
          flex 
          flex-col 
          justify-between 
          py-6 
          px-4
          transition-transform 
          duration-300 
          ease-in-out
          ${isDesktop ? 'translate-x-0 lg:static' : isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div>
          {/* Logo */}
          <div className="flex items-center gap-3 px-3 mb-8 cursor-pointer" onClick={() => handleNavigate('/dashboard')}>
            <div className="w-9 h-9 bg-gradient-to-br from-primary-500 to-accent-violet rounded-xl flex items-center justify-center">
              <Sparkles size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white leading-tight">FocusFlow</h1>
              <p className="text-[10px] text-zinc-500 leading-tight">AI Productivity</p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <button
                  key={item.path}
                  onClick={() => handleNavigate(item.path)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-primary-500/10 text-primary-400 border border-primary-500/20'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50 border border-transparent'
                  }`}
                >
                  <Icon size={16} />
                  {item.name}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom section */}
        <div className="space-y-3">
          {/* AI Coach button */}
          <button
            onClick={onOpenCoach}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-800/50 transition-all duration-200 border border-transparent"
          >
            <Bot size={16} className="text-accent-violet" />
            AI Coach
          </button>

          {/* User info */}
          {user && (
            <div className="flex items-center gap-3 px-3 py-2">
              <img
                src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName || 'User'}&background=18181b&color=e4e4e7`}
                alt="avatar"
                className="w-8 h-8 rounded-full border border-zinc-800"
              />
              <div className="flex-1 overflow-hidden">
                <p className="text-xs font-medium text-white truncate">{user.displayName || 'User'}</p>
                <p className="text-[10px] text-zinc-500 truncate">{user.email}</p>
              </div>
            </div>
          )}

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all duration-200 border border-transparent"
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {!isDesktop && isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
