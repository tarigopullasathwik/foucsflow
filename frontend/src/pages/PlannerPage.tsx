import { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Clock, 
  Check, 
  RefreshCw, 
  CalendarCheck, 
  Edit2, 
  Trash2, 
  Bot
} from 'lucide-react';
import { useAuth } from '../firebase';
import { api } from '../api';

export default function PlannerPage() {
  const { user } = useAuth();
  
  const [schedule, setSchedule] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDuration, setEditDuration] = useState(30);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (user) {
      loadSchedule();
    }
  }, [user]);

  const loadSchedule = async () => {
    setLoading(true);
    try {
      // Fetch latest schedule
      const res = await fetch(`http://localhost:5000/api/ai/schedule`, {
        method: 'POST',
        headers: { 'X-User-Id': user!.uid, 'Content-Type': 'application/json' }
      });
      if (res.ok) {
        const data = await res.json();
        setSchedule(data.schedule || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePlan = async () => {
    setActionLoading('generate');
    try {
      const result = await api.generateSchedule(user);
      setSchedule(result.schedule);
    } catch (e) {
      console.error(e);
      alert("Failed to compile schedule via AI.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleExportToGoogleCalendar = async () => {
    setActionLoading('export');
    try {
      const result = await api.exportScheduleToCalendar(user);
      alert(`Export Complete! Successfully synced ${result.exported_count} focus blocks to your Google Calendar.`);
    } catch (e) {
      console.error(e);
      alert("Calendar sync failed. Make sure mock credentials synced.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleEditBlock = (idx: number, currentBlock: any) => {
    setEditingIndex(idx);
    setEditTitle(currentBlock.task_title);
    setEditDuration(currentBlock.duration);
  };

  const handleSaveBlock = (idx: number) => {
    setSchedule(prev => {
      const copy = [...prev];
      copy[idx] = {
        ...copy[idx],
        task_title: editTitle,
        duration: Number(editDuration)
      };
      return copy;
    });
    setEditingIndex(null);
  };

  const handleDeleteBlock = (idx: number) => {
    if (window.confirm("Remove this time block from today's plan?")) {
      setSchedule(prev => prev.filter((_, i) => i !== idx));
    }
  };

  const handleSavePlan = async () => {
    setActionLoading('save');
    try {
      await api.updatePreferences(user, { sync_calendar: 1 });
      // Call custom save schedule endpoint
      const response = await fetch(`http://localhost:5000/api/ai/schedule`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': user!.uid
        },
        body: JSON.stringify({ schedule })
      });
      if (response.ok) {
        alert("Daily plan successfully locked in. Keep following your flow!");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(null);
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
    <div className="flex-1 p-6 space-y-6 max-w-5xl mx-auto overflow-y-auto">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-900 pb-5">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            AI Smart Planner <Sparkles className="text-primary-400" size={20} />
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">Let Gemini construct your hourly timeline around calendar barriers and workload priorities.</p>
        </div>

        {schedule.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleGeneratePlan}
              disabled={actionLoading !== null}
              className="flex items-center gap-1.5 px-3 py-2 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-850 rounded-xl text-xs text-zinc-300 hover:text-white transition-colors"
            >
              <RefreshCw size={13} className={actionLoading === 'generate' ? 'animate-spin' : ''} />
              Regenerate
            </button>
            <button
              onClick={handleExportToGoogleCalendar}
              disabled={actionLoading !== null}
              className="flex items-center gap-1.5 px-3 py-2 bg-zinc-900 border border-zinc-850 hover:border-zinc-700 hover:bg-zinc-850 rounded-xl text-xs text-zinc-300 hover:text-white transition-colors"
            >
              <CalendarCheck size={14} className="text-accent-cyan" />
              Export GCal
            </button>
            <button
              onClick={handleSavePlan}
              disabled={actionLoading !== null}
              className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-primary-600 to-accent-violet hover:from-primary-500 hover:to-accent-violet/90 text-white rounded-xl text-xs font-semibold shadow-lg shadow-primary-500/10 transition-colors"
            >
              <Check size={13} />
              Lock Schedule
            </button>
          </div>
        )}
      </div>

      {/* Main planner display */}
      {schedule.length === 0 ? (
        <div className="py-24 text-center max-w-md mx-auto space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto text-zinc-500 shadow-xl">
            <Sparkles size={32} className="text-primary-500 animate-pulse" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Unlock Your Optimal Daily Flow</h3>
            <p className="text-xs text-zinc-500 mt-2 leading-relaxed">
              Our AI Smart Planner will group similar tasks, insert short cognitive breaks, and coordinate around your pre-existing meetings, all within your preferred work hours.
            </p>
          </div>
          <button
            onClick={handleGeneratePlan}
            disabled={actionLoading !== null}
            className="w-full py-3 bg-gradient-to-r from-primary-600 to-accent-violet hover:from-primary-500 hover:to-accent-violet/90 text-white font-bold text-xs rounded-xl shadow-xl shadow-primary-500/20 transition-all duration-200"
          >
            {actionLoading === 'generate' ? 'Structuring Your Day...' : 'Plan My Day Now'}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Timeline Schedule Grid */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-zinc-950 p-4 border border-zinc-900 rounded-2xl">
              <span className="text-[10px] text-zinc-500 font-mono block">DATE ACTIVE</span>
              <span className="text-xs font-bold text-white block mt-0.5">
                {new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </span>
            </div>

            <div className="relative border-l border-zinc-850 pl-6 ml-3 space-y-4 py-2">
              {schedule.map((block, idx) => {
                const isWork = block.type === 'work';
                const isBreak = block.type === 'break';
                const isEditing = editingIndex === idx;

                return (
                  <div key={idx} className="relative group">
                    
                    {/* Time block connector dot */}
                    <div className={`absolute -left-[29px] top-4 w-3.5 h-3.5 rounded-full border-4 bg-background ${
                      isWork ? 'border-primary-500' : (isBreak ? 'border-accent-emerald' : 'border-zinc-500')
                    }`} />

                    <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-zinc-950/60 border rounded-2xl transition-all duration-200 ${
                      isWork ? 'border-zinc-900 hover:border-zinc-800' : (isBreak ? 'border-accent-emerald/10 bg-accent-emerald/5' : 'border-zinc-900/40 opacity-70')
                    }`}>
                      <div className="space-y-1 overflow-hidden flex-1">
                        <span className="text-[10px] font-mono text-zinc-500 block">{block.time_slot}</span>
                        
                        {isEditing ? (
                          <div className="flex gap-2 items-center py-1">
                            <input
                              type="text"
                              value={editTitle}
                              onChange={(e) => setEditTitle(e.target.value)}
                              className="bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1 text-xs text-white focus:outline-none"
                            />
                            <input
                              type="number"
                              value={editDuration}
                              onChange={(e) => setEditDuration(Number(e.target.value))}
                              className="w-16 bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1 text-xs text-white focus:outline-none"
                            />
                            <button
                              onClick={() => handleSaveBlock(idx)}
                              className="text-xs text-accent-emerald font-bold px-2 py-1 bg-zinc-900 border border-zinc-800 rounded-lg"
                            >
                              Save
                            </button>
                          </div>
                        ) : (
                          <h4 className={`text-xs font-bold text-zinc-200 ${isBreak ? 'text-accent-emerald' : ''}`}>
                            {block.task_title}
                          </h4>
                        )}
                        <p className="text-[10px] text-zinc-500 leading-normal">{block.reason}</p>
                      </div>

                      {/* Controls */}
                      <div className="flex items-center gap-3 shrink-0">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${
                          isWork ? 'bg-primary-950/40 text-primary-400 border border-primary-500/20' : (isBreak ? 'bg-accent-emerald/20 text-accent-emerald' : 'bg-zinc-900 text-zinc-500')
                        }`}>
                          {block.duration} mins
                        </span>

                        {!isEditing && (
                          <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => handleEditBlock(idx, block)}
                              className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors"
                              title="Edit Time Block"
                            >
                              <Edit2 size={12} />
                            </button>
                            <button 
                              onClick={() => handleDeleteBlock(idx)}
                              className="p-1 text-zinc-500 hover:text-rose-400 transition-colors"
                              title="Remove block"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: AI Insights & Calendar blocks */}
          <div className="space-y-6">
            {/* Planner Stats panel */}
            <div className="glass-panel p-5 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Clock size={15} className="text-primary-400" />
                Schedule Statistics
              </h3>
              
              <div className="divide-y divide-zinc-900 space-y-3 text-xs text-zinc-400">
                <div className="flex justify-between items-center py-2.5">
                  <span>Total Duration:</span>
                  <span className="font-mono text-zinc-200">
                    {schedule.reduce((acc, curr) => acc + curr.duration, 0)} minutes
                  </span>
                </div>
                <div className="flex justify-between items-center py-2.5">
                  <span>Focus Sessions:</span>
                  <span className="font-mono text-zinc-200">
                    {schedule.filter(s => s.type === 'work').length} blocks
                  </span>
                </div>
                <div className="flex justify-between items-center py-2.5">
                  <span>Recharge Breaks:</span>
                  <span className="font-mono text-zinc-200">
                    {schedule.filter(s => s.type === 'break').length} slots
                  </span>
                </div>
              </div>
            </div>

            {/* Smart Tips */}
            <div className="glass-panel p-5 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Bot size={15} className="text-accent-violet animate-pulse" />
                Coach Coach Advice
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                This schedule starts with your highest priority tasks to make sure you use your peak willpower early. Breaks are positioned at 90-minute thresholds to stave off brain fatigue. Keep this tab open as your live map.
              </p>
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
