import { useState, useEffect } from 'react';
import { X, Calendar, Clock, Plus, Tag, FileText, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../firebase';
import { api } from '../api';

interface TaskModalProps {
  isOpen: boolean;
  task: any | null; // if null, we are creating a task
  onClose: () => void;
  onSave: () => void;
}

export default function TaskModal({ isOpen, task, onClose, onSave }: TaskModalProps) {
  const { user } = useAuth();
  
  // Form fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [deadline, setDeadline] = useState('');
  const [estimatedDuration, setEstimatedDuration] = useState(60);
  const [difficulty, setDifficulty] = useState('Medium');
  const [importance, setImportance] = useState('Medium');
  const [category, setCategory] = useState('Work');
  const [status, setStatus] = useState('Pending');
  const [progress, setProgress] = useState(0);
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Sync state if task changes
  useEffect(() => {
    if (task) {
      setTitle(task.title || '');
      setDescription(task.description || '');
      // Format deadline to yyyy-MM-ddThh:mm
      if (task.deadline) {
        try {
          const d = new Date(task.deadline);
          // format to local ISO time
          const offset = d.getTimezoneOffset();
          const localDate = new Date(d.getTime() - offset * 60000);
          setDeadline(localDate.toISOString().slice(0, 16));
        } catch {
          setDeadline('');
        }
      } else {
        setDeadline('');
      }
      setEstimatedDuration(task.estimated_duration || 60);
      setDifficulty(task.difficulty || 'Medium');
      setImportance(task.importance || 'Medium');
      setCategory(task.category || 'Work');
      setStatus(task.status || 'Pending');
      setProgress(task.progress || 0);
      setTags(task.tags || []);
      setNotes(task.notes || '');
    } else {
      // Clear forms for new task
      setTitle('');
      setDescription('');
      // Default deadline to tomorrow at 18:00
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(18, 0, 0, 0);
      const offset = tomorrow.getTimezoneOffset();
      const localDate = new Date(tomorrow.getTime() - offset * 60000);
      setDeadline(localDate.toISOString().slice(0, 16));
      setEstimatedDuration(60);
      setDifficulty('Medium');
      setImportance('Medium');
      setCategory('Work');
      setStatus('Pending');
      setProgress(0);
      setTags([]);
      setNotes('');
    }
  }, [task, isOpen]);

  if (!isOpen) return null;

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (t: string) => {
    setTags(tags.filter(item => item !== t));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || isSaving) return;

    setIsSaving(true);
    // Parse to UTC ISO String
    let isoDeadline = '';
    if (deadline) {
      isoDeadline = new Date(deadline).toISOString();
    }

    const taskData = {
      title,
      description,
      deadline: isoDeadline,
      estimated_duration: Number(estimatedDuration),
      difficulty,
      importance,
      category,
      status,
      progress: Number(progress),
      tags,
      notes
    };

    try {
      if (task) {
        await api.updateTask(user, task.id, taskData);
      } else {
        await api.createTask(user, taskData);
      }
      onSave();
      onClose();
    } catch (e) {
      console.error("Failed to save task", e);
      alert("Failed to save task. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const categories = ['Coding', 'Study', 'Work', 'Personal', 'Research', 'Job Application', 'Finances', 'Health'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-zinc-950 border border-zinc-900 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-5 border-b border-zinc-900 flex items-center justify-between bg-zinc-950">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-primary-500 animate-pulse" />
            {task ? 'Edit Task' : 'Create New Task'}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-zinc-900 rounded-xl text-zinc-400 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Title */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-400">Task Title *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Prepare deck for hackathon demo"
              className="w-full bg-zinc-900/60 border border-zinc-800 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none rounded-xl py-3 px-4 text-sm text-white placeholder-zinc-600 transition-all duration-200"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-400">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide context or a breakdown of steps needed..."
              rows={3}
              className="w-full bg-zinc-900/60 border border-zinc-800 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none rounded-xl py-3 px-4 text-sm text-white placeholder-zinc-600 transition-all duration-200 resize-none"
            />
          </div>

          {/* Details Row 1 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Deadline */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-400 flex items-center gap-1.5">
                <Calendar size={13} className="text-zinc-500" />
                Deadline
              </label>
              <input
                type="datetime-local"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full bg-zinc-900/60 border border-zinc-800 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none rounded-xl py-3 px-4 text-sm text-white placeholder-zinc-650 transition-all duration-200"
              />
            </div>

            {/* Estimated Duration */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-400 flex items-center gap-1.5">
                <Clock size={13} className="text-zinc-500" />
                Estimated Duration (mins)
              </label>
              <input
                type="number"
                min={5}
                max={480}
                required
                value={estimatedDuration}
                onChange={(e) => setEstimatedDuration(Number(e.target.value))}
                className="w-full bg-zinc-900/60 border border-zinc-800 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none rounded-xl py-3 px-4 text-sm text-white placeholder-zinc-600 transition-all duration-200"
              />
            </div>
          </div>

          {/* Details Row 2 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Category */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-400">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-zinc-900/60 border border-zinc-800 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none rounded-xl py-3 px-4 text-sm text-white transition-all duration-200"
              >
                {categories.map((c) => (
                  <option key={c} value={c} className="bg-zinc-950">{c}</option>
                ))}
              </select>
            </div>

            {/* Importance */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-400">Importance</label>
              <select
                value={importance}
                onChange={(e) => setImportance(e.target.value)}
                className="w-full bg-zinc-900/60 border border-zinc-800 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none rounded-xl py-3 px-4 text-sm text-white transition-all duration-200"
              >
                <option value="Low" className="bg-zinc-950">Low</option>
                <option value="Medium" className="bg-zinc-950">Medium</option>
                <option value="High" className="bg-zinc-950">High</option>
              </select>
            </div>

            {/* Difficulty */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-400">Difficulty</label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                className="w-full bg-zinc-900/60 border border-zinc-800 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none rounded-xl py-3 px-4 text-sm text-white transition-all duration-200"
              >
                <option value="Easy" className="bg-zinc-950">Easy</option>
                <option value="Medium" className="bg-zinc-950">Medium</option>
                <option value="Hard" className="bg-zinc-950">Hard</option>
              </select>
            </div>
          </div>

          {/* Details Row 3 (Status & Progress) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Status */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-400">Status</label>
              <div className="flex gap-4 pt-1.5">
                <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
                  <input
                    type="radio"
                    name="status"
                    value="Pending"
                    checked={status === 'Pending'}
                    onChange={() => {
                      setStatus('Pending');
                      if (progress === 100) setProgress(50);
                    }}
                    className="accent-primary-500"
                  />
                  Pending
                </label>
                <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
                  <input
                    type="radio"
                    name="status"
                    value="Completed"
                    checked={status === 'Completed'}
                    onChange={() => {
                      setStatus('Completed');
                      setProgress(100);
                    }}
                    className="accent-primary-500"
                  />
                  Completed
                </label>
              </div>
            </div>

            {/* Progress Slider */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-semibold text-zinc-400">
                <span>Progress</span>
                <span className="text-primary-400">{progress}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={progress}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setProgress(val);
                  if (val === 100) setStatus('Completed');
                  else setStatus('Pending');
                }}
                className="w-full accent-primary-500"
              />
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-400 flex items-center gap-1.5">
              <Tag size={13} className="text-zinc-500" />
              Tags
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
                placeholder="Type tag and press Enter"
                className="flex-1 bg-zinc-900/60 border border-zinc-800 focus:border-primary-500 focus:outline-none rounded-xl py-2 px-3 text-xs text-white placeholder-zinc-600 transition-all duration-200"
              />
              <button
                type="button"
                onClick={handleAddTag}
                className="px-3 bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white rounded-xl text-xs flex items-center gap-1.5 transition-colors"
              >
                <Plus size={12} /> Add
              </button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {tags.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary-950/40 text-primary-400 border border-primary-500/20 rounded-full text-[10px] font-medium"
                  >
                    {t}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(t)}
                      className="hover:text-rose-400 font-bold ml-0.5"
                    >
                      &times;
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-400 flex items-center gap-1.5">
              <FileText size={13} className="text-zinc-500" />
              Developer/Personal Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Reference URLs, links, or draft notes..."
              rows={2}
              className="w-full bg-zinc-900/60 border border-zinc-800 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none rounded-xl py-3 px-4 text-sm text-white placeholder-zinc-600 transition-all duration-200 resize-none"
            />
          </div>
        </form>

        {/* Footer Actions */}
        <div className="p-5 border-t border-zinc-900 flex justify-end gap-3 bg-zinc-950">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-transparent border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white transition-all duration-200"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            type="submit"
            disabled={!title.trim() || isSaving}
            className="px-6 py-2.5 bg-gradient-to-r from-primary-600 to-accent-violet hover:from-primary-500 hover:to-accent-violet/90 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-lg shadow-primary-500/20 transition-all duration-200"
          >
            {isSaving ? 'Saving...' : (
              <>
                <CheckCircle2 size={14} />
                {task ? 'Update Task' : 'Create Task'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
