import { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Trash2, 
  Edit3, 
  Copy, 
  CheckCircle, 
  Clock, 
  AlertTriangle
} from 'lucide-react';
import { useAuth } from '../firebase';
import { api } from '../api';
import TaskModal from '../components/TaskModal';

export default function TasksPage() {
  const { user } = useAuth();
  
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Search, Filter, Sort States
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sortBy, setSortBy] = useState('priority_score'); // 'priority_score', 'deadline', 'estimated_duration'

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any | null>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (user) {
      loadTasks();
    }
  }, [user]);

  const loadTasks = async () => {
    setLoading(true);
    try {
      const data = await api.fetchTasks(user);
      setTasks(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
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
      await loadTasks();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this task?")) return;
    try {
      await api.deleteTask(user, id);
      await loadTasks();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDuplicate = async (task: any) => {
    const dupe = {
      title: `${task.title} (Copy)`,
      description: task.description || '',
      deadline: task.deadline || '',
      estimated_duration: Number(task.estimated_duration || 60),
      difficulty: task.difficulty || 'Medium',
      importance: task.importance || 'Medium',
      category: task.category || 'Work',
      status: 'Pending',
      progress: 0,
      tags: task.tags || [],
      notes: task.notes || ''
    };
    try {
      await api.createTask(user, dupe);
      await loadTasks();
    } catch (e) {
      console.error(e);
    }
  };

  // Filter & Sort Logic
  const filteredTasks = tasks
    .filter(task => {
      const matchesSearch = (task.title || '').toLowerCase().includes(search.toLowerCase()) || 
                            (task.description || '').toLowerCase().includes(search.toLowerCase());
      const matchesCategory = categoryFilter === 'All' || task.category === categoryFilter;
      const matchesStatus = statusFilter === 'All' || task.status === statusFilter;
      return matchesSearch && matchesCategory && matchesStatus;
    })
    .sort((a, b) => {
      if (sortBy === 'priority_score') {
        return (b.priority_score || 50) - (a.priority_score || 50);
      } else if (sortBy === 'deadline') {
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      } else if (sortBy === 'estimated_duration') {
        return b.estimated_duration - a.estimated_duration;
      }
      return 0;
    });

  const categories = ['All', 'Coding', 'Study', 'Work', 'Personal', 'Research', 'Job Application', 'Finances', 'Health'];

  if (loading) {
    return (
      <div className="flex-1 flex justify-center items-center h-full">
        <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 space-y-6 max-w-7xl mx-auto overflow-y-auto">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-zinc-900 pb-5">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white">Task Management Board</h2>
          <p className="text-xs text-zinc-550 mt-0.5">Manage, track, duplicate, and prioritize your upcoming milestones.</p>
        </div>
        <button
          onClick={() => {
            setSelectedTask(null);
            setIsModalOpen(true);
          }}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-primary-600 to-accent-violet hover:from-primary-500 hover:to-accent-violet/90 text-white rounded-xl text-xs font-semibold shadow-lg shadow-primary-500/10 transition-all duration-200"
        >
          <Plus size={14} /> Add New Task
        </button>
      </div>

      {/* Search & Filter Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 bg-zinc-950 p-4 border border-zinc-900 rounded-2xl">
        {/* Search */}
        <div className="relative sm:col-span-2">
          <Search className="absolute left-3.5 top-3 text-zinc-550" size={15} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks by title or details..."
            className="w-full bg-zinc-900 border border-zinc-850 hover:border-zinc-800 focus:border-primary-500 focus:outline-none rounded-xl py-2 pl-10 pr-4 text-xs text-white placeholder-zinc-650 transition-colors"
          />
        </div>

        {/* Category */}
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="bg-zinc-900 border border-zinc-850 hover:border-zinc-800 rounded-xl py-2 px-3 text-xs text-zinc-300 focus:border-primary-500 focus:outline-none transition-colors"
        >
          {categories.map((c) => (
            <option key={c} value={c}>{c === 'All' ? 'Filter: All Categories' : c}</option>
          ))}
        </select>

        {/* Status */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-zinc-900 border border-zinc-850 hover:border-zinc-800 rounded-xl py-2 px-3 text-xs text-zinc-300 focus:border-primary-500 focus:outline-none transition-colors"
        >
          <option value="All">Filter: All Statuses</option>
          <option value="Pending">Pending Only</option>
          <option value="Completed">Completed Only</option>
        </select>

        {/* Sort */}
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="bg-zinc-900 border border-zinc-850 hover:border-zinc-800 rounded-xl py-2 px-3 text-xs text-zinc-300 focus:border-primary-500 focus:outline-none transition-colors"
        >
          <option value="priority_score">Sort: AI Priority Score</option>
          <option value="deadline">Sort: Due Date (Deadline)</option>
          <option value="estimated_duration">Sort: Work Duration</option>
        </select>
      </div>

      {/* Task List Grid */}
      {filteredTasks.length === 0 ? (
        <div className="py-20 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-zinc-900 flex items-center justify-center mx-auto text-zinc-500">
            <Search size={22} />
          </div>
          <div>
            <h4 className="font-semibold text-zinc-300 text-sm">No tasks matched criteria</h4>
            <p className="text-xs text-zinc-500 max-w-xs mx-auto mt-0.5">Try resetting your filter, typing another query, or click 'Add Task' to create new items.</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTasks.map((task) => (
            <div 
              key={task.id} 
              className={`p-5 bg-zinc-950 border rounded-2xl flex flex-col justify-between space-y-4 transition-all duration-300 ${
                task.status === 'Completed' ? 'border-zinc-950 opacity-60' : 'border-zinc-900 hover:border-zinc-800'
              }`}
            >
              <div className="space-y-2">
                {/* Title & Status */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5 overflow-hidden">
                    <button
                      onClick={() => handleToggleComplete(task)}
                      className={`mt-0.5 shrink-0 transition-colors ${
                        task.status === 'Completed' ? 'text-accent-emerald' : 'text-zinc-600 hover:text-zinc-400'
                      }`}
                    >
                      <CheckCircle size={17} className={task.status === 'Completed' ? 'fill-accent-emerald/10' : ''} />
                    </button>
                    <h3 className={`font-semibold text-zinc-100 text-sm leading-snug truncate cursor-pointer hover:underline ${
                      task.status === 'Completed' ? 'line-through text-zinc-500' : ''
                    }`}
                      onClick={() => {
                        setSelectedTask(task);
                        setIsModalOpen(true);
                      }}
                    >
                      {task.title}
                    </h3>
                  </div>

                  {/* Priority Badge */}
                  <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full border shrink-0 ${
                    task.status === 'Completed' ? 'bg-zinc-900 border-zinc-800 text-zinc-650' : (
                      (task.priority_score || 50) > 80 
                        ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' 
                        : 'bg-primary-500/10 border-primary-500/20 text-primary-400'
                    )
                  }`}>
                    P: {task.priority_score || 50}
                  </span>
                </div>

                {/* Description */}
                {task.description && (
                  <p className="text-xs text-zinc-500 leading-relaxed line-clamp-2 pl-7">{task.description}</p>
                )}
              </div>

              {/* Task Metadata Footer */}
              <div className="space-y-3 pt-2">
                {/* Risk Warning Indicator */}
                {task.status !== 'Completed' && (task.risk_percentage || 0) > 35 && (
                  <div className={`p-2 rounded-xl text-[10px] border flex items-center gap-2 ${
                    task.risk_color === 'rose' 
                      ? 'bg-rose-950/20 border-rose-500/10 text-rose-350' 
                      : 'bg-amber-500/5 border-amber-500/10 text-amber-500'
                  }`}>
                    <AlertTriangle size={12} className="shrink-0" />
                    <span className="truncate">
                      <strong>{task.risk_percentage}% Risk:</strong> {task.risk_reason}
                    </span>
                  </div>
                )}

                {/* Badges row */}
                <div className="flex flex-wrap gap-1.5 text-[9px] font-medium pl-7">
                  <span className="bg-zinc-900 border border-zinc-850 px-2 py-0.5 rounded-md text-zinc-400 flex items-center gap-1">
                    <Clock size={9} /> {task.estimated_duration}m
                  </span>
                  <span className="bg-zinc-900 border border-zinc-850 px-2 py-0.5 rounded-md text-zinc-400">
                    {task.category}
                  </span>
                  {task.deadline && (
                    <span className="bg-zinc-900 border border-zinc-850 px-2 py-0.5 rounded-md text-zinc-400">
                      Due {new Date(task.deadline).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                    </span>
                  )}
                </div>

                {/* Action Controls */}
                <div className="flex justify-between items-center pt-2 border-t border-zinc-900/60 pl-7 text-[10px]">
                  {/* Progress info */}
                  <span className="text-zinc-500 font-mono">Progress: {task.progress}%</span>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDuplicate(task)}
                      className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors"
                      title="Duplicate Task"
                    >
                      <Copy size={13} />
                    </button>
                    <button
                      onClick={() => {
                        setSelectedTask(task);
                        setIsModalOpen(true);
                      }}
                      className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors"
                      title="Edit Task"
                    >
                      <Edit3 size={13} />
                    </button>
                    <button
                      onClick={() => handleDelete(task.id)}
                      className="p-1 text-zinc-500 hover:text-rose-400 transition-colors"
                      title="Delete Task"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>

            </div>
          ))}
        </div>
      )}

      {/* Task Modal */}
      <TaskModal
        isOpen={isModalOpen}
        task={selectedTask}
        onClose={() => { setSelectedTask(null); setIsModalOpen(false); }}
        onSave={loadTasks}
      />
    </div>
  );
}
