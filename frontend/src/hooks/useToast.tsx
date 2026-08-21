import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { X, CheckCircle2, AlertTriangle, Info, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastContextValue {
  toasts: Toast[];
  showToast: (toast: Omit<Toast, 'id'>) => string;
  dismissToast: (id: string) => void;
  success: (title: string, message?: string) => string;
  error: (title: string, message?: string) => string;
  warning: (title: string, message?: string) => string;
  info: (title: string, message?: string) => string;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TOAST_ICONS: Record<ToastType, { icon: typeof CheckCircle2; color: string }> = {
  success: { icon: CheckCircle2, color: 'text-accent-emerald' },
  error: { icon: AlertCircle, color: 'text-rose-400' },
  warning: { icon: AlertTriangle, color: 'text-amber-500' },
  info: { icon: Info, color: 'text-accent-cyan' },
};

const TOAST_BG: Record<ToastType, string> = {
  success: 'bg-accent-emerald/10 border-accent-emerald/20',
  error: 'bg-rose-500/10 border-rose-500/20',
  warning: 'bg-amber-500/10 border-amber-500/20',
  info: 'bg-accent-cyan/10 border-accent-cyan/20',
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const { icon: Icon, color } = TOAST_ICONS[toast.type];
  const bgClass = TOAST_BG[toast.type];

  return (
    <motion.div
      initial={{ opacity: 0, x: 40, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 40, scale: 0.95 }}
      transition={{ type: 'spring', damping: 20, stiffness: 100 }}
      className={`${bgClass} border rounded-2xl p-4 shadow-strong flex gap-3 min-w-[320px] max-w-md`}
      role="alert"
      aria-live="polite"
    >
      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${color} bg-current/10`}>
        <Icon size={16} />
      </div>
      
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-zinc-100 text-sm">{toast.title}</p>
        {toast.message && (
          <p className="text-zinc-400 text-xs mt-0.5 leading-relaxed">{toast.message}</p>
        )}
        {toast.action && (
          <button
            onClick={() => { toast.action!.onClick(); onDismiss(toast.id); }}
            className="mt-2 text-xs font-semibold text-primary-400 hover:text-primary-300 underline"
          >
            {toast.action.label}
          </button>
        )}
      </div>

      <button
        onClick={() => onDismiss(toast.id)}
        className="flex-shrink-0 p-1 text-zinc-500 hover:text-zinc-300 rounded-lg hover:bg-zinc-800/50 transition-colors"
        aria-label="Dismiss notification"
      >
        <X size={14} />
      </button>
    </motion.div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const showToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).slice(2, 9);
    const newToast = { ...toast, id };
    
    setToasts(prev => [...prev, newToast]);
    
    const duration = toast.duration ?? (toast.type === 'error' ? 6000 : 4000);
    if (duration > 0) {
      setTimeout(() => dismissToast(id), duration);
    }
    
    return id;
  }, [dismissToast]);

  const helpers = {
    success: (title: string, message?: string) => showToast({ type: 'success', title, message }),
    error: (title: string, message?: string) => showToast({ type: 'error', title, message, duration: 6000 }),
    warning: (title: string, message?: string) => showToast({ type: 'warning', title, message, duration: 5000 }),
    info: (title: string, message?: string) => showToast({ type: 'info', title, message }),
  };

  return (
    <ToastContext.Provider value={{ toasts, showToast, dismissToast, ...helpers }}>
      {children}
      <AnimatePresence>
        <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3 pointer-events-none" aria-live="polite">
          {toasts.map(toast => (
            <ToastItem key={toast.id} toast={toast} onDismiss={dismissToast} />
          ))}
        </div>
      </AnimatePresence>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}