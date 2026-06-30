import { useState, useEffect } from 'react';
import { 
  Calendar, 
  Plus, 
  Trash2, 
  Clock, 
  CalendarDays,
  PlusCircle,
  Globe
} from 'lucide-react';
import { useAuth } from '../firebase';
import { api } from '../api';

export default function CalendarPage() {
  const { user } = useAuth();
  
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  
  // Add Event Form State
  const [isAdding, setIsAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (user) {
      loadEvents();
    }
  }, [user]);

  const loadEvents = async () => {
    setLoading(true);
    try {
      const data = await api.fetchCalendarEvents(user);
      setEvents(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleImportGoogleCalendar = async () => {
    setSyncing(true);
    try {
      const result = await api.importGoogleCalendar(user);
      setEvents(result.events);
      alert("Successfully synced with Google Calendar. Synced upcoming meetings.");
    } catch (e) {
      console.error(e);
      alert("Calendar sync failed.");
    } finally {
      setSyncing(false);
    }
  };

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !startTime || !endTime) return;

    try {
      // Parse ISO dates
      const startIso = new Date(startTime).toISOString();
      const endIso = new Date(endTime).toISOString();

      await api.addCalendarEvent(user, {
        title,
        start_time: startIso,
        end_time: endIso,
        source: 'local'
      });
      
      // Clear and reload
      setTitle('');
      setStartTime('');
      setEndTime('');
      setIsAdding(false);
      
      // Reload
      const data = await api.fetchCalendarEvents(user);
      setEvents(data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteEvent = async (id: string) => {
    if (!window.confirm("Remove this event from your calendar?")) return;
    try {
      await api.deleteCalendarEvent(user, id);
      setEvents(prev => prev.filter(e => e.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex justify-center items-center h-full">
        <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Group events by date
  const eventsByDate: Record<string, any[]> = {};
  events.forEach(e => {
    const dateStr = e.start_time ? new Date(e.start_time).toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' }) : 'All Day';
    if (!eventsByDate[dateStr]) {
      eventsByDate[dateStr] = [];
    }
    eventsByDate[dateStr].push(e);
  });

  return (
    <div className="flex-1 p-6 space-y-6 max-w-5xl mx-auto overflow-y-auto">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-900 pb-5">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            My Calendar Sync <CalendarDays className="text-accent-cyan" size={20} />
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5 font-sans">
            Coordinate FocusFlow tasks around Google Calendar occurrences, classes, or corporate meetings.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setIsAdding(!isAdding)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-850 rounded-xl text-xs text-zinc-300 hover:text-white transition-colors"
          >
            <Plus size={14} /> Add Event
          </button>
          
          <button
            onClick={handleImportGoogleCalendar}
            disabled={syncing}
            className="flex items-center justify-center gap-2 bg-gradient-to-r from-primary-600 to-accent-cyan hover:from-primary-500 hover:to-accent-cyan/90 text-white font-semibold text-xs px-4 py-2 rounded-xl transition-all duration-200"
          >
            <Globe size={13} />
            {syncing ? 'Syncing...' : 'Sync Google Calendar'}
          </button>
        </div>
      </div>

      {/* Main Split: Adding Event Form vs Events List */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* ADD EVENT FORM DRAWER/CARD */}
        {isAdding && (
          <div className="lg:col-span-1 glass-panel p-5 space-y-4 h-fit">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <PlusCircle size={15} className="text-primary-400" />
              Add Calendar Event
            </h3>

            <form onSubmit={handleAddEvent} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-zinc-500">Event Title</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Chemistry Lab Quiz"
                  className="w-full bg-zinc-900 border border-zinc-800 focus:border-primary-500 focus:outline-none rounded-xl py-2.5 px-3 text-xs text-white placeholder-zinc-650"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-zinc-500">Starts At</label>
                <input
                  type="datetime-local"
                  required
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 focus:border-primary-500 focus:outline-none rounded-xl py-2.5 px-3 text-xs text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-zinc-500">Ends At</label>
                <input
                  type="datetime-local"
                  required
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 focus:border-primary-500 focus:outline-none rounded-xl py-2.5 px-3 text-xs text-white"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="flex-1 py-2 bg-transparent border border-zinc-800 hover:border-zinc-700 rounded-xl text-xs text-zinc-400 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-xl text-xs font-semibold shadow-lg"
                >
                  Add Block
                </button>
              </div>
            </form>
          </div>
        )}

        {/* EVENTS LIST */}
        <div className={isAdding ? 'lg:col-span-2 space-y-6' : 'lg:col-span-3 space-y-6'}>
          {events.length === 0 ? (
            <div className="py-24 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-zinc-900 flex items-center justify-center mx-auto text-zinc-550">
                <Calendar size={22} />
              </div>
              <div>
                <h4 className="font-semibold text-zinc-300 text-sm">No events synced</h4>
                <p className="text-xs text-zinc-500 max-w-xs mx-auto mt-0.5">
                  Click 'Sync Google Calendar' above to fetch meetings, or add one manually.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(eventsByDate).map(([date, dateEvents]) => (
                <div key={date} className="space-y-3">
                  <h3 className="text-xs font-bold text-primary-400 font-mono tracking-wider uppercase border-b border-zinc-900 pb-1.5">
                    {date}
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {dateEvents.map((event) => (
                      <div 
                        key={event.id}
                        className="p-4 bg-zinc-950/60 border border-zinc-900 rounded-xl flex items-center justify-between gap-4"
                      >
                        <div className="space-y-1 overflow-hidden">
                          <h4 className="text-xs font-bold text-zinc-200 truncate">{event.title}</h4>
                          <span className="text-[10px] text-zinc-500 flex items-center gap-1">
                            <Clock size={11} />
                            {event.start_time ? (
                              <>
                                {new Date(event.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {' '}
                                {new Date(event.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </>
                            ) : (
                              'All Day'
                            )}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <span className={`text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded border ${
                            event.source === 'google' 
                              ? 'bg-primary-950/40 border-primary-500/20 text-primary-400' 
                              : 'bg-zinc-900 border-zinc-800 text-zinc-500'
                          }`}>
                            {event.source}
                          </span>
                          <button
                            onClick={() => handleDeleteEvent(event.id)}
                            className="p-1 text-zinc-650 hover:text-rose-450 transition-colors"
                            title="Remove Event"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
