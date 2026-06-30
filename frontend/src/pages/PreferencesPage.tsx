import { useState, useEffect } from 'react';
import { Settings, Save, Clock, Brain, Calendar } from 'lucide-react';
import { useAuth } from '../firebase';
import { api } from '../api';

export default function PreferencesPage() {
  const { user } = useAuth();
  
  // Settings States
  const [workStart, setWorkStart] = useState('09:00');
  const [workEnd, setWorkEnd] = useState('18:00');
  const [breakDuration, setBreakDuration] = useState(15);
  const [syncCalendar, setSyncCalendar] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (user) {
      loadPreferences();
    }
  }, [user]);

  const loadPreferences = async () => {
    setLoading(true);
    try {
      const prefs = await api.fetchPreferences(user);
      setWorkStart(prefs.work_start_time || '09:00');
      setWorkEnd(prefs.work_end_time || '18:00');
      setBreakDuration(prefs.daily_break_duration || 15);
      setSyncCalendar(prefs.sync_calendar === 1);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedSuccess(false);
    try {
      await api.updatePreferences(user, {
        work_start_time: workStart,
        work_end_time: workEnd,
        daily_break_duration: Number(breakDuration),
        sync_calendar: syncCalendar ? 1 : 0
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (e) {
      console.error(e);
      alert("Failed to save changes.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex justify-center items-center h-full">
        <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 space-y-6 max-w-4xl mx-auto overflow-y-auto">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-zinc-900 pb-5">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            User Preferences <Settings className="text-zinc-400" />
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">Customize daily schedule parameters, session durations, and integration defaults.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* SETTINGS CARD (Span 2) */}
        <form onSubmit={handleSave} className="lg:col-span-2 glass-panel p-6 space-y-6">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-zinc-900 pb-3">
            <Clock size={16} className="text-primary-400" />
            Plan Heuristics Configuration
          </h3>

          {savedSuccess && (
            <div className="p-3 bg-accent-emerald/10 border border-accent-emerald/20 text-accent-emerald rounded-xl text-xs font-semibold">
              Preferences successfully saved. The AI Smart Planner will now adopt these parameters.
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Work Start */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-400">Work Day Starts At</label>
              <input
                type="time"
                value={workStart}
                onChange={(e) => setWorkStart(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 focus:border-primary-500 focus:outline-none rounded-xl py-2.5 px-3 text-xs text-white"
              />
            </div>

            {/* Work End */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-400">Work Day Ends At</label>
              <input
                type="time"
                value={workEnd}
                onChange={(e) => setWorkEnd(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 focus:border-primary-500 focus:outline-none rounded-xl py-2.5 px-3 text-xs text-white"
              />
            </div>
          </div>

          {/* Break duration */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-400">Default Rest Break Duration (Minutes)</label>
            <select
              value={breakDuration}
              onChange={(e) => setBreakDuration(Number(e.target.value))}
              className="w-full bg-zinc-900 border border-zinc-800 focus:border-primary-500 focus:outline-none rounded-xl py-2.5 px-3 text-xs text-white"
            >
              <option value={10}>10 minutes</option>
              <option value={15}>15 minutes (Recommended)</option>
              <option value={20}>20 minutes</option>
              <option value={30}>30 minutes</option>
            </select>
          </div>

          <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-zinc-900 pb-3 pt-3">
            <Calendar size={16} className="text-accent-cyan" />
            Calendar Connections
          </h3>

          {/* Sync calendar check */}
          <label className="flex items-start gap-3 cursor-pointer p-1">
            <input
              type="checkbox"
              checked={syncCalendar}
              onChange={(e) => setSyncCalendar(e.target.checked)}
              className="mt-0.5 accent-primary-500 w-4 h-4"
            />
            <div>
              <span className="text-xs font-semibold text-zinc-200 block">Automatic Google Calendar Export</span>
              <span className="text-[10px] text-zinc-500 block mt-0.5 leading-relaxed">
                If checked, locking a schedule in FocusFlow will automatically create synced background events in your connected Google Calendar.
              </span>
            </div>
          </label>

          <div className="border-t border-zinc-900 pt-5 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-gradient-to-r from-primary-600 to-accent-violet hover:from-primary-500 hover:to-accent-violet/90 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-lg transition-colors"
            >
              <Save size={14} />
              {saving ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>
        </form>

        {/* DETAILS INFO COLUMN (Span 1) */}
        <div className="space-y-6">
          <div className="glass-panel p-5 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Brain size={15} className="text-accent-violet animate-pulse" />
              AI Planning Guardrails
            </h3>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Our AI planning model utilizes these thresholds to partition your workload. Adjusting your hours will squeeze or relax your daily schedule timeline, pushing non-essential tasks to tomorrow's list.
            </p>
          </div>

          <div className="glass-panel p-5 space-y-3">
            <span className="text-xs text-zinc-400 font-semibold block">FocusFlow Engine Info</span>
            <div className="space-y-1.5 text-[10px] font-mono text-zinc-550 leading-loose">
              <p>Core: Google Gemini 1.5 Flash</p>
              <p>Persistence: SQLite / Firestore</p>
              <p>Version: FocusFlow.1.0-Release</p>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
