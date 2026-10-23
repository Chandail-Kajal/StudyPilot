import { StudyPlan, User, UserStats } from "@/types";
import { AUTH_KEY, PLAN_KEY } from "./seed";

const API_BASE = typeof window !== 'undefined' ? '' : 'http://127.0.0.1:8000';

export interface StoredAuth {
  token: string;
  user: User;
}

export function getStoredAuth(): StoredAuth | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

export function setStoredAuth(token: string, user: User) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(AUTH_KEY, JSON.stringify({ token, user }));
  } catch (e) {}
}

export function clearStoredAuth() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(AUTH_KEY);
  } catch (e) {}
}

export function getStoredPlan(): StudyPlan | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(PLAN_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (p && p.v === 1 && Array.isArray(p.subjects) && Array.isArray(p.tasks)) {
      return p;
    }
  } catch (e) {}
  return null;
}

export function setStoredPlan(plan: StudyPlan) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PLAN_KEY, JSON.stringify(plan));
  } catch (e) {}
}

async function request(endpoint: string, options: RequestInit = {}) {
  const url = `${API_BASE}${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const errorMsg = data.detail || data.message || `Request failed with status ${res.status}`;
    throw new Error(errorMsg);
  }

  return data;
}

export const api = {
  async register(payload: {
    email: string;
    password: string;
    name: string;
    exam_name?: string;
    exam_date?: string;
    goal_mins?: number;
    prototype_data?: any;
  }) {
    return request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async login(payload: { email: string; password: string }) {
    return request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async logout(token?: string) {
    if (!token) return { success: true };
    return request('/api/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    });
  },

  async forgotPassword(email: string) {
    return request('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email })
    });
  },

  async resetPassword(token: string, new_password: string) {
    return request('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, new_password })
    });
  },

  async getMe(token: string): Promise<{ user: User; stats: UserStats }> {
    return request('/api/auth/me', {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` }
    });
  },

  async updateProfile(token: string, payload: Partial<User>) {
    return request('/api/auth/profile', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload)
    });
  },

  async changePassword(token: string, payload: { current_password: string; new_password: string }) {
    return request('/api/auth/change-password', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload)
    });
  },

  async getSyncPlan(token: string): Promise<{ plan: StudyPlan; updated_at: string; version: number }> {
    return request('/api/sync', {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` }
    });
  },

  async saveSyncPlan(token: string, plan: StudyPlan): Promise<{ success: boolean; updated_at: string }> {
    return request('/api/sync', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ plan })
    });
  },

  async importPrototypePlan(token: string, plan: StudyPlan) {
    return request('/api/import', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ plan })
    });
  },

  async exportStudyData(token: string) {
    return request('/api/export', {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` }
    });
  },

  // AI Syllabus Scheduling & Mock Testing API
  async planSchedule(payload: {
    syllabus: any[];
    exam_name?: string;
    exam_date?: string;
    sitting_capacity_mins?: number;
    daily_goal_mins?: number;
    yesterday_topics?: any[];
    api_key?: string;
  }, token?: string) {
    return request('/api/ai/plan-schedule', {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: JSON.stringify(payload)
    });
  },

  async generateMockTest(payload: {
    topics: Array<{ name: string; id?: string }>;
    subject_name?: string;
    num_questions?: number;
    difficulty?: string;
    importance_filter?: string;
    extract_maximum?: boolean;
    api_key?: string;
  }, token?: string) {
    return request('/api/ai/mock-test', {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: JSON.stringify(payload)
    });
  },

  async extractImportantTopics(payload: {
    syllabus: any[];
    exam_name?: string;
    exam_date?: string;
    api_key?: string;
  }, token?: string) {
    return request('/api/ai/extract-important-topics', {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: JSON.stringify(payload)
    });
  },

  async submitMockTest(payload: {
    test_id: string;
    title: string;
    subject?: string;
    topics: any[];
    questions: any[];
    user_answers: Record<string, number>;
    time_taken_seconds?: number;
  }, token?: string) {
    return request('/api/ai/submit-test', {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: JSON.stringify(payload)
    });
  },

  async chatWithAI(payload: {
    message: string;
    history: Array<{ role: 'user' | 'assistant'; content: string }>;
    syllabus: any[];
    exam_name?: string;
    exam_date?: string;
    yesterday_topics?: any[];
    current_sitting_capacity?: number;
    api_key?: string;
  }, token?: string) {
    return request('/api/ai/chat', {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: JSON.stringify(payload)
    });
  },

  async getMockTestsHistory(token: string) {
    return request('/api/ai/tests-history', {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` }
    });
  }
};
