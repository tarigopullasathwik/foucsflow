import { useState } from 'react';
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

interface SidebarProps {
  onOpenCoach: () => void;
}

export default function Sidebar({ onOpenCoach }: SidebarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

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
    setIsOpen(false);
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (e) {
      console.error("Failed to log out", e);
    }
  };

  return (
    <>
      {/* Mobile Toggle Button */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-100 focus:outline-none"
        >
          {isOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Sidebar container */}
      <aside className={`
        fixed top-0 bottom-0 left-0 z-40 w-64 bg-zinc-950/80 backdrop-blur-md border-r border-zinc-900
        flex flex-col justify-between py-6 px-4 transition-transform duration-300 ease-in-out
        lg:translate-x-0 lg:static
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div>
          {/* Logo */}
          <div className="flex items-center gap-3 px-3 mb-8 cursor-pointer" onClick={() => handleNavigate('/dashboard')}>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-primary-600 to-accent-cyan flex items-center justify-center shadow-lg shadow-primary-500/20">
              <span className="text-white font-extrabold text-lg">⚡</span>
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white font-sans flex items-center gap-1.5">
                FocusFlow <span className="text-[10px] bg-primary-500/20 text-primary-400 font-medium px-1.5 py-0.5 rounded-full border border-primary-500/30">AI</span>
              </h1>
              <p className="text-[10px] text-zinc-500">Productivity Companion</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1.5">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <button
                  key={item.name}
                  onClick={() => handleNavigate(item.path)}
                  className={`
                    w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
                    ${isActive 
                      ? 'bg-primary-600/10 text-primary-400 border border-primary-500/20 shadow-inner' 
                      : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900/50 border border-transparent'
                    }
                  `}
                >
                  <Icon size={18} className={isActive ? 'text-primary-400' : 'text-zinc-500'} />
                  {item.name}
                </button>
              );
            })}

            {/* Quick AI Coach Trigger */}
            <button
              onClick={() => {
                onOpenCoach();
                setIsOpen(false);
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium bg-gradient-to-r from-primary-950/40 to-accent-violet/10 text-accent-violet border border-accent-violet/30 hover:from-primary-950/60 hover:to-accent-violet/20 hover:border-accent-violet/40 transition-all duration-200 shadow-sm mt-4"
            >
              <Bot size={18} />
              AI Coach
            </button>
          </nav>
        </div>

        {/* User Profile Summary */}
        <div className="border-t border-zinc-900 pt-4 px-2">
          {user && (
            <div className="flex items-center gap-3 mb-4">
              <img 
                src={user.photoURL} 
                alt={user.displayName}
                className="w-10 h-10 rounded-full border border-zinc-800 object-cover" 
              />
              <div className="overflow-hidden">
                <p className="text-xs font-semibold text-zinc-200 truncate">{user.displayName}</p>
                <p className="text-[10px] text-zinc-500 truncate">{user.email}</p>
              </div>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-zinc-500 hover:text-rose-400 hover:bg-rose-500/5 border border-transparent transition-all duration-200"
          >
            <LogOut size={14} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Backdrop overlay for mobile */}
      {isOpen && (
        <div 
          onClick={() => setIsOpen(false)}
          className="lg:hidden fixed inset-0 z-30 bg-black/60 backdrop-blur-sm"
        />
      )}
    </>
  );
}
