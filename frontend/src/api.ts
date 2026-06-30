import type { AuthUser } from './firebase';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// Helper to construct headers with auth info
const getHeaders = (user: AuthUser | null) => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  if (user) {
    if (user.token) {
      headers['Authorization'] = `Bearer ${user.token}`;
    }
    // Always pass user ID directly for backend ease (mock fallback compatibility)
    headers['X-User-Id'] = user.uid;
  }
  
  return headers;
};

// API Services object
export const api = {
  // Authentication Sync
  async syncUser(user: AuthUser): Promise<any> {
    const res = await fetch(`${API_BASE_URL}/api/auth/sync-user`, {
      method: 'POST',
      headers: getHeaders(user),
      body: JSON.stringify({
        email: user.email,
        name: user.displayName,
        picture: user.photoURL
      })
    });
    if (!res.ok) throw new Error('Failed to sync user context');
    return res.json();
  },

  // Task CRUD
  async fetchTasks(user: AuthUser | null): Promise<any[]> {
    const res = await fetch(`${API_BASE_URL}/api/tasks`, {
      headers: getHeaders(user)
    });
    if (!res.ok) throw new Error('Failed to fetch tasks');
    return res.json();
  },

  async fetchTask(user: AuthUser | null, id: string): Promise<any> {
    const res = await fetch(`${API_BASE_URL}/api/tasks/${id}`, {
      headers: getHeaders(user)
    });
    if (!res.ok) throw new Error('Failed to fetch task');
    return res.json();
  },

  async createTask(user: AuthUser | null, taskData: any): Promise<any> {
    const res = await fetch(`${API_BASE_URL}/api/tasks`, {
      method: 'POST',
      headers: getHeaders(user),
      body: JSON.stringify(taskData)
    });
    if (!res.ok) throw new Error('Failed to create task');
    return res.json();
  },

  async updateTask(user: AuthUser | null, id: string, taskData: any): Promise<any> {
    const res = await fetch(`${API_BASE_URL}/api/tasks/${id}`, {
      method: 'PUT',
      headers: getHeaders(user),
      body: JSON.stringify(taskData)
    });
    if (!res.ok) throw new Error('Failed to update task');
    return res.json();
  },

  async deleteTask(user: AuthUser | null, id: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/tasks/${id}`, {
      method: 'DELETE',
      headers: getHeaders(user)
    });
    if (!res.ok) throw new Error('Failed to delete task');
  },

  // AI Planner
  async generateSchedule(user: AuthUser | null): Promise<{ date: string; schedule: any[] }> {
    const res = await fetch(`${API_BASE_URL}/api/ai/schedule`, {
      method: 'POST',
      headers: getHeaders(user),
      body: JSON.stringify({ regenerate: true })
    });
    if (!res.ok) throw new Error('Failed to generate daily schedule');
    return res.json();
  },

  // AI Priority Engine
  async prioritizeTasks(user: AuthUser | null): Promise<{ status: string; tasks: any[] }> {
    const res = await fetch(`${API_BASE_URL}/api/ai/prioritize`, {
      method: 'POST',
      headers: getHeaders(user)
    });
    if (!res.ok) throw new Error('Failed to calculate priorities');
    return res.json();
  },

  // AI Risk Predictor
  async predictRisk(user: AuthUser | null): Promise<{ status: string; tasks: any[] }> {
    const res = await fetch(`${API_BASE_URL}/api/ai/risk-analysis`, {
      method: 'POST',
      headers: getHeaders(user)
    });
    if (!res.ok) throw new Error('Failed to run deadline risk analysis');
    return res.json();
  },

  // AI Coach Chat
  async fetchChatHistory(user: AuthUser | null): Promise<any[]> {
    const res = await fetch(`${API_BASE_URL}/api/ai/chat/history`, {
      headers: getHeaders(user)
    });
    if (!res.ok) throw new Error('Failed to fetch chat history');
    return res.json();
  },

  async sendChatMessage(user: AuthUser | null, message: string): Promise<{ user_message: any; ai_response: any }> {
    const res = await fetch(`${API_BASE_URL}/api/ai/chat`, {
      method: 'POST',
      headers: getHeaders(user),
      body: JSON.stringify({ message })
    });
    if (!res.ok) throw new Error('Failed to send message');
    return res.json();
  },

  async clearChatHistory(user: AuthUser | null): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/ai/chat/history`, {
      method: 'DELETE',
      headers: getHeaders(user)
    });
    if (!res.ok) throw new Error('Failed to clear chat history');
  },

  // Google Calendar Integration
  async fetchCalendarEvents(user: AuthUser | null): Promise<any[]> {
    const res = await fetch(`${API_BASE_URL}/api/calendar/events`, {
      headers: getHeaders(user)
    });
    if (!res.ok) throw new Error('Failed to fetch calendar events');
    return res.json();
  },

  async addCalendarEvent(user: AuthUser | null, eventData: any): Promise<any> {
    const res = await fetch(`${API_BASE_URL}/api/calendar/events`, {
      method: 'POST',
      headers: getHeaders(user),
      body: JSON.stringify(eventData)
    });
    if (!res.ok) throw new Error('Failed to add calendar event');
    return res.json();
  },

  async deleteCalendarEvent(user: AuthUser | null, id: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/calendar/events/${id}`, {
      method: 'DELETE',
      headers: getHeaders(user)
    });
    if (!res.ok) throw new Error('Failed to delete event');
  },

  async importGoogleCalendar(user: AuthUser | null): Promise<{ status: string; events: any[] }> {
    const res = await fetch(`${API_BASE_URL}/api/calendar/import`, {
      method: 'POST',
      headers: getHeaders(user)
    });
    if (!res.ok) throw new Error('Failed to import Google Calendar events');
    return res.json();
  },

  async exportScheduleToCalendar(user: AuthUser | null): Promise<{ status: string; exported_count: number }> {
    const res = await fetch(`${API_BASE_URL}/api/calendar/export`, {
      method: 'POST',
      headers: getHeaders(user)
    });
    if (!res.ok) throw new Error('Failed to export schedule to calendar');
    return res.json();
  },

  // Analytics
  async fetchAnalytics(user: AuthUser | null): Promise<any[]> {
    const res = await fetch(`${API_BASE_URL}/api/analytics`, {
      headers: getHeaders(user)
    });
    if (!res.ok) throw new Error('Failed to fetch analytics');
    return res.json();
  },

  async snapshotAnalytics(user: AuthUser | null): Promise<any> {
    const res = await fetch(`${API_BASE_URL}/api/analytics/snapshot`, {
      method: 'POST',
      headers: getHeaders(user)
    });
    if (!res.ok) throw new Error('Failed to trigger analytics snapshot');
    return res.json();
  },

  // User Preferences
  async fetchPreferences(user: AuthUser | null): Promise<any> {
    const res = await fetch(`${API_BASE_URL}/api/preferences`, {
      headers: getHeaders(user)
    });
    if (!res.ok) throw new Error('Failed to fetch user preferences');
    return res.json();
  },

  async updatePreferences(user: AuthUser | null, prefsData: any): Promise<any> {
    const res = await fetch(`${API_BASE_URL}/api/preferences`, {
      method: 'PUT',
      headers: getHeaders(user),
      body: JSON.stringify(prefsData)
    });
    if (!res.ok) throw new Error('Failed to update preferences');
    return res.json();
  },

  // Notifications
  async fetchNotifications(user: AuthUser | null): Promise<any[]> {
    const res = await fetch(`${API_BASE_URL}/api/notifications`, {
      headers: getHeaders(user)
    });
    if (!res.ok) throw new Error('Failed to fetch notifications');
    return res.json();
  },

  async markNotificationsAsRead(user: AuthUser | null): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/notifications/read`, {
      method: 'POST',
      headers: getHeaders(user)
    });
    if (!res.ok) throw new Error('Failed to mark notifications as read');
  }
};
