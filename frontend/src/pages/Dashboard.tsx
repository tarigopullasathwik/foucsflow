import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { 
  Sparkles, 
  Plus, 
  Zap, 
  AlertTriangle, 
  Calendar, 
  CheckCircle2, 
  Clock,
  ArrowRight,
  TrendingUp,
  Brain,
  ChevronRight,
  RotateCw,
  Trash2
} from 'lucide-react';
import { useAuth } from '../firebase';
import { api } from '../api';
import { useToast } from '../hooks/useToast';
import TaskModal from '../components/TaskModal';

interface OutletCtx {
  onOpenCoach: () => void;
}

export default function Dashboard() {
  const { onOpenCoach } = useOutletContext<OutletCtx>();
  const { user } = useAuth();
  const toast = useToast();
  
  const [tasks, setTasks] = useState<any[]>([]);
  const [schedule, setSchedule] = useState<any[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any | null>(null);
  const [analyticsHistory, setAnalyticsHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  
  // Modal controllers
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any | null>(null);

  useEffect(() => {
    if (user) {
      loadDashboardData();
    }
  }, [user]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // Fetch user profile sync
      await api.syncUser(user!);
      
      // Fetch all collections in parallel
      const [tasksData, calData, analData] = await Promise.all([
        api.fetchTasks(user),
        api.fetchCalendarEvents(user),
        api.fetchAnalytics(user)
      ]);

      setTasks(tasksData);
      setCalendarEvents(calData);
      setAnalyticsHistory(analData || []);

      // Extract latest analytics snapshot (real data only)
      if (analData && analData.length > 0) {
        setAnalytics(analData[0]);
      } else {
        // Compute a fresh snapshot from the user's CURRENT real tasks.
        // For a brand-new user with no tasks this honestly returns score 0.
        const freshSnap = await api.snapshotAnalytics(user);
        setAnalytics(freshSnap);
      }
      
      // Try to load latest saved schedule via Flask endpoint proxy
      // Bug fix: use api.getSchedule so the real Bearer token is sent
      const sData = await api.getSchedule(user);
      setSchedule(sData.schedule || []);
    } catch (e) {
      console.error("Failed to load dashboard data", e);
      toast.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  const handlePlanDay = async () => {
    setActionLoading('plan');
    try {
      const result = await api.generateSchedule(user);
      setSchedule(result.schedule);
      await loadDashboardData();
      toast.success("Daily plan generated successfully!");
    } catch (e) {
      console.error(e);
      toast.error("Failed to compile schedule. Check connection.");
    } finally {
      setActionLoading(null);
    }
  };

  const handlePrioritize = async () => {
    setActionLoading('prioritize');
    try {
      await api.prioritizeTasks(user);
      await loadDashboardData();
      toast.success("Tasks prioritized successfully!");
    } catch (e) {
      console.error(e);
      toast.error("Failed to prioritize tasks");
    } finally {
      setActionLoading(null);
    }
  };

  const handlePredictRisks = async () => {
    setActionLoading('risks');
    try {
      await api.predictRisk(user);
      await loadDashboardData();
      toast.success("Risk analysis completed!");
    } catch (e) {
      console.error(e);
      toast.error("Failed to analyze risks");
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleComplete = async (task: any) => {
    const nextStatus = task.status === 'Completed' ? 'Pending' : 'Completed';
    const nextProgress = nextStatus === 'Completed' ? 100 : 0;
    try {
      await api.updateTask(user, task.id, {
        status: nextStatus,
        progress: nextProgress
      });
      await loadDashboardData();
    } catch (e) {
      console.error(e);
      toast.error("Failed to update task status");
    }
  };

  const activeTasks = tasks.filter(t => t.status !== 'Completed');
  const completedTasks = tasks.filter(t => t.status === 'Completed');
  
  // Sort tasks by priority score for priority section
  const prioritizedList = [...activeTasks].sort((a, b) => (b.priority_score || 50) - (a.priority_score || 50));
  
  // Tasks at risk list (risk > 35%)
  const atRiskList = [...activeTasks]
    .filter(t => (t.risk_percentage || 0) > 35)
    .sort((a, b) => (b.risk_percentage || 0) - (a.risk_percentage || 0));
  
  // AI recommendations generator based on state
  const getAIRecommendations = () => {
    const recs = [];
    if (atRiskList.length > 0) {
      recs.push({
        text: `You have ${atRiskList.length} tasks with high deadline risks. Focus on '${atRiskList[0].title}' first.`,
        type: 'warning'
      });
    }
    if (activeTasks.length > 3) {
      const difficultOnes = activeTasks.filter(t => t.difficulty === 'Hard');
      if (difficultOnes.length > 0) {
        recs.push({
          text: `You have ${difficultOnes.length} Hard tasks pending. Schedule these during your peak morning energy.`,
          type: 'info'
        });
      }
    }
    if (schedule.length === 0) {
      recs.push({
        text: "You haven't planned your day yet. Click 'Plan My Day' to get an optimized timeline.",
        type: 'action'
      });
    } else {
      recs.push({
        text: "Your daily plan is synced. Remember to take short breaks to keep focus high.",
        type: 'success'
      });
    }
    return recs;
  };

  const aiRecs = getAIRecommendations();

  // ---------- Real, honest metrics ----------
  const totalTasks = activeTasks.length + completedTasks.length;
  const hasAnyData = totalTasks > 0 || (analyticsHistory?.length ?? 0) > 0;
  // Score is read with ?? so a real 0 shows as 0 (not swapped for a fake 72).
  const score = analytics?.score ?? 0;

  // Real day-over-day delta computed from real history (no hardcoded +4%).
  // Bug fix: use LOCAL date (not UTC) to match the backend's local snapshot date.
  const nowDate = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;
  const todaySnap =
    analyticsHistory.find(a => a.date === nowDate) || analytics || { score: 0 };
  const prevSnap = analyticsHistory.find(a => a.date !== nowDate);
  let deltaText = '';
  let deltaIsUp = true;
  if (prevSnap && typeof prevSnap.score === 'number') {
    const diff = todaySnap.score - prevSnap.score;
    deltaIsUp = diff >= 0;
    deltaText = `${diff >= 0 ? '+' : ''}${diff}% vs yesterday`;
  } else {
    // No prior day exists: be honest rather than inventing a trend.
    deltaText = null as any;
  }

  if (loading) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center h-full p-8 space-y-4">
        <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-zinc-500 text-xs font-mono">Loading your productivity data...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 space-y-6 max-w-7xl mx-auto overflow-y-auto">
      
      {/* Welcome Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-900 pb-5">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white font-sans flex items-center gap-2">
            Hey, {user?.displayName || 'Productive User'} <Sparkles className="text-primary-400 animate-pulse" size={20} />
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            FocusFlow has calculated your schedules. Let's finish your work today.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap gap-2.5">
          <button
            onClick={() => {
              setSelectedTask(null);
              setIsTaskModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-2 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-850 rounded-xl text-xs text-zinc-200 hover:text-white transition-all duration-200"
          >
            <Plus size={14} /> Add Task
          </button>
          
          <button
            onClick={handlePrioritize}
            disabled={actionLoading !== null}
            className="flex items-center gap-1.5 px-3 py-2 bg-zinc-900 border border-zinc-850 hover:border-zinc-700 hover:bg-zinc-850 rounded-xl text-xs text-zinc-300 hover:text-white disabled:text-zinc-650 disabled:border-zinc-900 transition-all duration-200"
          >
            {actionLoading === 'prioritize' ? <RotateCw className="animate-spin" size={13} /> : <Zap size={13} className="text-primary-400" />}
            AI Priority Score
          </button>

          <button
            onClick={handlePredictRisks}
            disabled={actionLoading !== null}
            className="flex items-center gap-1.5 px-3 py-2 bg-zinc-900 border border-zinc-850 hover:border-zinc-700 hover:bg-zinc-850 rounded-xl text-xs text-zinc-300 hover:text-white disabled:text-zinc-650 disabled:border-zinc-900 transition-all duration-200"
          >
            {actionLoading === 'risks' ? <RotateCw className="animate-spin" size={13} /> : <AlertTriangle size={13} className="text-rose-400" />}
            AI Risk Predictor
          </button>

          <button
            onClick={handlePlanDay}
            disabled={actionLoading !== null}
            className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-primary-600 to-accent-violet hover:from-primary-500 hover:to-accent-violet/90 text-white rounded-xl text-xs font-semibold shadow-lg shadow-primary-500/10 transition-all duration-200 disabled:opacity-50"
          >
            {actionLoading === 'plan' ? <RotateCw className="animate-spin" size={13} /> : <Sparkles size={13} />}
            Plan My Day
          </button>
        </div>
      </div>

      {/* Highlights Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Productivity Score (REAL data only) */}
        <div className="glass-panel p-5 space-y-2 flex flex-col justify-between">
          <div className="flex justify-between items-center text-xs text-zinc-500 font-semibold">
            <span>Productivity Score</span>
            <TrendingUp size={14} className={score > 0 ? 'text-primary-400' : 'text-zinc-600'} />
          </div>
          {hasAnyData ? (
            <>
              <div className="flex items-baseline gap-2 pt-2">
                <span className="text-3xl font-extrabold text-white">{score}</span>
                {deltaText ? (
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md border ${
                    deltaIsUp
                      ? 'text-accent-emerald bg-accent-emerald/10 border-accent-emerald/20'
                      : 'text-rose-400 bg-rose-500/10 border-rose-500/20'
                  }`}>{deltaText}</span>
                ) : (
                  <span className="text-[10px] text-zinc-500 font-semibold bg-zinc-900 px-1.5 py-0.5 rounded-md border border-zinc-800">First day</span>
                )}
              </div>
              <div className="w-full bg-zinc-900 h-1.5 rounded-full overflow-hidden">
                <div className="bg-gradient-to-r from-primary-500 to-accent-violet h-full transition-all duration-500" style={{ width: `${score}%` }} />
              </div>
            </>
          ) : (
            <div className="pt-2 pb-1 w-full">
              <span className="text-2xl font-extrabold text-zinc-600">—</span>
              <p className="text-[10px] text-zinc-500 mt-1 leading-snug">
                No data yet. Add your first task and complete it to start tracking a real score.
              </p>
            </div>
          )}
        </div>

        {/* Incomplete Tasks */}
        <div className="glass-panel p-5 space-y-2 flex flex-col justify-between">
          <div className="flex justify-between items-center text-xs text-zinc-500 font-semibold">
            <span>Pending workload</span>
            <Clock size={14} className="text-accent-cyan" />
          </div>
          <div className="flex items-baseline gap-1.5 pt-2">
            <span className="text-3xl font-extrabold text-white">{activeTasks.length}</span>
            <span className="text-xs text-zinc-500">active tasks</span>
          </div>
          <div className="text-[10px] text-zinc-400">
            {completedTasks.length} tasks completed today
          </div>
        </div>

        {/* Active Schedule Session */}
        <div className="glass-panel p-5 space-y-2 flex flex-col justify-between">
          <div className="flex justify-between items-center text-xs text-zinc-500 font-semibold">
            <span>Current Schedule Slot</span>
            <Sparkles size={14} className="text-accent-violet animate-pulse" />
          </div>
          <div className="pt-2 overflow-hidden">
            <span className="text-sm font-bold text-white block truncate">
              {schedule.length > 0 ? schedule.find(s => s.type === 'work')?.task_title || 'Buffer Period' : 'No Active Plan'}
            </span>
            <span className="text-[10px] text-zinc-500 flex items-center gap-1 mt-1">
              <Clock size={10} />
              {schedule.length > 0 ? schedule[0].time_slot : '00:00 - 00:00'}
            </span>
          </div>
          <div className="text-[10px] text-primary-400 hover:underline cursor-pointer" onClick={handlePlanDay}>
            View full smart timeline
          </div>
        </div>

        {/* Risk Alerts */}
        <div className="glass-panel p-5 space-y-2 flex flex-col justify-between">
          <div className="flex justify-between items-center text-xs text-zinc-500 font-semibold">
            <span>Deadlines At Risk</span>
            <AlertTriangle size={14} className="text-rose-400 animate-bounce" />
          </div>
          <div className="flex items-baseline gap-1.5 pt-2">
            <span className="text-3xl font-extrabold text-white">
              {activeTasks.filter(t => (t.risk_percentage || 0) > 70).length}
            </span>
            <span className="text-xs text-zinc-500">critical risks</span>
          </div>
          <div className="text-[10px] text-zinc-500">
            Total {atRiskList.length} total monitored items
          </div>
        </div>
      </div>

      {/* Main Core Dashboard Split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT COLUMN: SCHEDULE & COACH INSIGHTS (Span 2) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Today's Schedule Timeline */}
          <div className="glass-panel p-5 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Calendar size={15} className="text-primary-400" />
                Today's Work Timeline
              </h3>
              <button 
                onClick={handlePlanDay}
                className="text-[10px] bg-zinc-900 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-850 text-zinc-400 hover:text-white px-2.5 py-1 rounded-lg transition-colors"
              >
                Re-plan
              </button>
            </div>

            {schedule.length === 0 ? (
              <div className="py-12 text-center space-y-3">
                <div className="w-10 h-10 rounded-full bg-zinc-900 flex items-center justify-center mx-auto text-zinc-500">
                  <Clock size={18} />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-zinc-400">Timeline Empty</h4>
                  <p className="text-[10px] text-zinc-500 max-w-xs mx-auto mt-0.5">
                    Click 'Plan My Day' above to let the AI build your hourly layout.
                  </p>
                </div>
              </div>
            ) : (
              <div className="relative border-l border-zinc-800 pl-4 ml-2 space-y-4 py-2">
                {schedule.slice(0, 4).map((slot, idx) => (
                  <div key={idx} className="relative group">
                    {/* Node Dot */}
                    <div className={`absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full border-2 bg-background ${
                      slot.type === 'work' ? 'border-primary-500' : (slot.type === 'break' ? 'border-accent-emerald' : 'border-zinc-500')
                    }`} />
                    
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 p-3.5 bg-zinc-950 border border-zinc-900 rounded-xl hover:border-zinc-800 transition-all duration-200">
                      <div>
                        <span className="text-[10px] font-mono text-zinc-500 block">{slot.time_slot}</span>
                        <h4 className={`text-xs font-bold text-zinc-200 mt-0.5 ${slot.type === 'break' ? 'text-accent-emerald' : ''}`}>
                          {slot.task_title}
                        </h4>
                        <p className="text-[10px] text-zinc-500 mt-1 max-w-md">{slot.reason}</p>
                      </div>
                      <span className="text-[10px] bg-zinc-900 border border-zinc-850 px-2 py-0.5 rounded-md text-zinc-400 shrink-0 self-start sm:self-center">
                        {slot.duration}m
                      </span>
                    </div>
                  </div>
                ))}
                {schedule.length > 4 && (
                  <div className="text-center pt-2">
                    <button 
                      onClick={() => window.location.href = '/planner'}
                      className="text-[10px] text-primary-400 hover:text-primary-300 font-semibold inline-flex items-center gap-1"
                    >
                      View remaining {schedule.length - 4} schedule blocks <ArrowRight size={10} />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* AI Coach Insights & Recommendations */}
          <div className="glass-panel p-5 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Brain size={15} className="text-accent-violet" />
              FocusFlow AI Coach Insights
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {aiRecs.map((rec, idx) => (
                <div key={idx} className={`p-4 rounded-2xl border text-xs leading-relaxed flex items-start gap-3 ${
                  rec.type === 'warning' 
                    ? 'bg-rose-950/20 border-rose-500/20 text-rose-300' 
                    : (rec.type === 'success' ? 'bg-accent-emerald/10 border-accent-emerald/20 text-accent-emerald' : 'bg-zinc-900/50 border-zinc-800 text-zinc-400')
                }`}>
                  <div className="w-1.5 h-1.5 rounded-full bg-current mt-1.5 shrink-0" />
                  <p>{rec.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: AI PRIORITY, RISKS & CALENDAR (Span 1) */}
        <div className="space-y-6">
          
          {/* Priority Task Rankings */}
          <div className="glass-panel p-5 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Zap size={14} className="text-primary-400" />
                Priority Rank Engine
              </h3>
              <span className="text-[10px] text-zinc-500 font-mono">Sorted by score</span>
            </div>

            {prioritizedList.length === 0 ? (
              <p className="text-xs text-zinc-500 py-6 text-center">No active tasks pending. Great work!</p>
            ) : (
              <div className="space-y-3">
                {prioritizedList.slice(0, 3).map((task) => (
                  <div key={task.id} className="p-3 bg-zinc-950 border border-zinc-900 hover:border-zinc-800 rounded-xl transition-all duration-200 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <button
                          onClick={() => handleToggleComplete(task)}
                          className="text-zinc-600 hover:text-accent-emerald transition-colors shrink-0"
                        >
                          <CheckCircle2 size={15} />
                        </button>
                        <h4 
                          onClick={() => { setSelectedTask(task); setIsTaskModalOpen(true); }}
                          className="text-xs font-bold text-zinc-200 truncate cursor-pointer hover:text-white"
                        >
                          {task.title}
                        </h4>
                      </div>
                      
                      {/* Priority Score badge */}
                      <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-md border ${
                        (task.priority_score || 50) > 80 
                          ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' 
                          : 'bg-primary-500/10 border-primary-500/20 text-primary-400'
                      }`}>
                        {task.priority_score || 50}
                      </span>
                    </div>
                    {task.priority_reason && (
                      <p className="text-[10px] text-zinc-500 leading-normal line-clamp-2 pl-6">
                        {task.priority_reason}
                      </p>
                    )}
                  </div>
                ))}
                {prioritizedList.length > 3 && (
                  <div className="text-center pt-1.5">
                    <button 
                      onClick={() => window.location.href = '/tasks'}
                      className="text-[10px] text-zinc-400 hover:text-white flex items-center gap-1 mx-auto"
                    >
                      View all {prioritizedList.length} tasks <ChevronRight size={12} />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Deadline Risk Predictions */}
          <div className="glass-panel p-5 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <AlertTriangle size={14} className="text-rose-400 animate-pulse" />
              Deadline Risk Monitor
            </h3>

            {atRiskList.length === 0 ? (
              <p className="text-xs text-zinc-500 py-6 text-center">No immediate scheduling risks predicted.</p>
            ) : (
              <div className="space-y-3.5">
                {atRiskList.slice(0, 2).map((task) => (
                  <div key={task.id} className="p-3.5 bg-zinc-950 border border-zinc-900 rounded-xl space-y-2">
                    <div className="flex justify-between items-center text-xs font-semibold">
                      <span className="text-zinc-200 truncate pr-2">{task.title}</span>
                      <span className={`text-[10px] font-bold ${
                        task.risk_color === 'rose' ? 'text-rose-400' : 'text-amber-500'
                      }`}>
                        {task.risk_percentage}% risk
                      </span>
                    </div>
                    
                    {/* Risk progress slider */}
                    <div className="w-full bg-zinc-900 h-1 rounded-full overflow-hidden">
                      <div className={`h-full ${
                        task.risk_color === 'rose' ? 'bg-rose-500' : 'bg-amber-500'
                      }`} style={{ width: `${task.risk_percentage}%` }} />
                    </div>

                    <p className="text-[10px] text-zinc-500 leading-normal font-sans">
                      <strong className="text-zinc-400">Risk:</strong> {task.risk_reason}
                    </p>
                    <div className="text-[9px] bg-zinc-900 border border-zinc-850 p-2 rounded-lg text-zinc-400 leading-relaxed">
                      <span className="font-semibold text-primary-400 block mb-0.5">Recommendation:</span>
                      {task.risk_recommendation}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Calendar Events Summary */}
          <div className="glass-panel p-5 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Calendar size={14} className="text-accent-cyan" />
                Google Calendar Sync
              </h3>
              <span className="text-[9px] text-accent-emerald bg-accent-emerald/10 border border-accent-emerald/20 px-1.5 py-0.5 rounded font-mono">Linked</span>
            </div>

            {calendarEvents.length === 0 ? (
              <p className="text-xs text-zinc-500 py-4 text-center">No upcoming events synced.</p>
            ) : (
              <div className="space-y-2.5">
                {calendarEvents.slice(0, 3).map((event) => (
                  <div key={event.id} className="flex justify-between items-center text-xs p-2.5 bg-zinc-900/30 border border-zinc-900 rounded-xl">
                    <div className="overflow-hidden pr-2">
                      <span className="text-zinc-200 block truncate font-medium">{event.title}</span>
                      <span className="text-[9px] text-zinc-500 font-mono block mt-0.5">
                        {event.start_time ? new Date(event.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'All Day'}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className={`text-[8px] uppercase font-bold px-1.5 py-0.5 rounded ${
                        event.source === 'google' ? 'bg-primary-900/20 text-primary-400 border border-primary-500/20' : 'bg-zinc-800 text-zinc-400'
                      }`}>
                        {event.source}
                      </span>
                      <button
                        onClick={() => {
                          // In a real app, we would have a delete event function
                          console.log('Delete event:', event.id);
                        }}
                        className="p-1 text-zinc-650 hover:text-rose-450 transition-colors"
                        title="Remove Event"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Floating AI Coach Assistant Button */}
      <div className="fixed bottom-6 right-6 z-30">
        <button
          onClick={onOpenCoach}
          className="w-12 h-12 rounded-full bg-gradient-to-tr from-primary-600 to-accent-violet hover:from-primary-500 hover:to-accent-violet/90 flex items-center justify-center text-white shadow-xl shadow-primary-500/30 hover:scale-105 transition-all duration-200 cursor-pointer"
          title="Open AI Productivity Coach"
        >
          <Brain size={22} className="animate-pulse" />
        </button>
      </div>

      {/* Add Task Modal */}
      <TaskModal
        isOpen={isTaskModalOpen}
        task={selectedTask}
        onClose={() => { setSelectedTask(null); setIsTaskModalOpen(false); }}
        onSave={loadDashboardData}
      />
    </div>
  );
}