import { StudyPlan, User, UserStats, MockTest, FullSyllabusTestRequest, SyllabusParseResult } from "@/types";
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

export function getLocalAiApiKey(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    return localStorage.getItem('studypilot.ai_api_key') || undefined;
  } catch (e) {
    return undefined;
  }
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
    role?: 'student' | 'competitive_exam' | 'professional';
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

  async verifyResetToken(token: string): Promise<{ valid: boolean; reason?: string; message?: string; email?: string; name?: string }> {
    return request(`/api/auth/verify-reset-token?token=${encodeURIComponent(token)}`, {
      method: 'GET'
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
    const finalPayload = {
      api_key: payload.api_key || getLocalAiApiKey(),
      ...payload
    };
    return request('/api/ai/plan-schedule', {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: JSON.stringify(finalPayload)
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
    const finalPayload = {
      api_key: payload.api_key || getLocalAiApiKey(),
      ...payload
    };
    return request('/api/ai/mock-test', {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: JSON.stringify(finalPayload)
    });
  },

  async extractImportantTopics(payload: {
    syllabus: any[];
    exam_name?: string;
    exam_date?: string;
    api_key?: string;
  }, token?: string) {
    const finalPayload = {
      api_key: payload.api_key || getLocalAiApiKey(),
      ...payload
    };
    return request('/api/ai/extract-important-topics', {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: JSON.stringify(finalPayload)
    });
  },

  async getAiKeyStatus(token: string) {
    return request('/api/settings/ai-key', {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` }
    });
  },

  async saveAiKey(apiKey: string, token: string) {
    return request('/api/settings/ai-key', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ api_key: apiKey })
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
  },

  async parseAndPlanSyllabus(
    file: File,
    meta?: {
      exam_name?: string;
      exam_date?: string;
      sitting_capacity_mins?: number;
      daily_goal_mins?: number;
      api_key?: string;
    },
    token?: string
  ): Promise<SyllabusParseResult> {
    const formData = new FormData();
    formData.append('file', file);
    if (meta?.exam_name) formData.append('exam_name', meta.exam_name);
    if (meta?.exam_date) formData.append('exam_date', meta.exam_date);
    if (meta?.sitting_capacity_mins) formData.append('sitting_capacity_mins', String(meta.sitting_capacity_mins));
    if (meta?.daily_goal_mins) formData.append('daily_goal_mins', String(meta.daily_goal_mins));
    if (meta?.api_key) formData.append('api_key', meta.api_key);

    const url = `${API_BASE}/api/syllabus/parse-and-plan`;
    const res = await fetch(url, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.detail || data.message || 'Failed to parse syllabus file');
    }
    return data;
  },

  async generateFullSyllabusTest(payload: FullSyllabusTestRequest, token?: string): Promise<MockTest> {
    return request('/api/ai/full-syllabus-test', {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: JSON.stringify(payload)
    });
  },

  // ----------------- Relational Core APIs -----------------

  async getExams(token: string) {
    return request('/api/exams', {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` }
    });
  },

  async createExam(token: string, payload: {
    exam_name: string;
    exam_category?: string;
    education_level?: string;
    exam_date?: string;
    target_score?: number;
    learning_preferences?: any;
    initial_subjects?: string[];
    daily_study_mins?: number;
    sitting_capacity_mins?: number;
    preparation_level?: string;
  }) {
    return request('/api/exams', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload)
    });
  },

  async createExamWithSyllabus(token: string, formData: FormData) {
    const res = await fetch('/api/exams/create-with-syllabus', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to create examination');
    }
    return res.json();
  },

  async getExamDetails(token: string, examId: string) {
    return request(`/api/exams/${examId}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` }
    });
  },

  async updateExam(token: string, examId: string, payload: any) {
    return request(`/api/exams/${examId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload)
    });
  },

  async deleteExam(token: string, examId: string) {
    return request(`/api/exams/${examId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
  },

  async uploadSyllabusPreview(
    token: string,
    file: File,
    params?: {
      exam_id?: string;
      exam_name?: string;
      scope?: string;
      subject_name?: string;
      column_mapping?: Record<string, string>;
    }
  ) {
    const formData = new FormData();
    formData.append('file', file);
    if (params?.exam_id) formData.append('exam_id', params.exam_id);
    if (params?.exam_name) formData.append('exam_name', params.exam_name);
    if (params?.scope) formData.append('scope', params.scope);
    if (params?.subject_name) formData.append('subject_name', params.subject_name);
    if (params?.column_mapping) formData.append('column_mapping', JSON.stringify(params.column_mapping));

    const url = `${API_BASE}/api/syllabus/upload-preview`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.detail || data.message || 'Failed to upload and preview syllabus');
    }
    return data;
  },

  async pasteSyllabusPreview(
    token: string,
    payload: {
      raw_text: string;
      exam_id?: string;
      exam_name?: string;
      scope?: string;
      subject_name?: string;
    }
  ) {
    return request('/api/syllabus/paste-preview', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload)
    });
  },

  async confirmSyllabusImport(token: string, payload: {
    exam_id: string;
    file_name: string;
    file_format: string;
    rows: any[];
  }) {
    return request('/api/syllabus/confirm-import', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload)
    });
  },

  async getSyllabusUploads(token: string, examId: string) {
    return request(`/api/syllabus/uploads/${examId}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` }
    });
  },

  async getSyllabusHierarchy(token: string, examId: string) {
    return request(`/api/syllabus/hierarchy/${examId}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` }
    });
  },

  async createSubject(token: string, payload: { exam_id: string; subject_name: string; description?: string; color?: string }) {
    return request('/api/syllabus/subjects', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload)
    });
  },

  async deleteSubject(token: string, subjectId: string) {
    return request(`/api/syllabus/subjects/${subjectId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
  },

  async createTopic(token: string, payload: {
    subject_id: string;
    unit_id?: string;
    chapter_id?: string;
    topic_name: string;
    subtopic_name?: string;
    difficulty?: string;
    estimated_minutes?: number;
    importance?: string;
  }) {
    return request('/api/syllabus/topics', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload)
    });
  },

  async deleteTopic(token: string, topicId: string) {
    return request(`/api/syllabus/topics/${topicId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
  },

  async getTopicProgress(token: string, examId: string) {
    return request(`/api/progress/${examId}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` }
    });
  },

  async updateTopicProgress(token: string, topicId: string, payload: { stage?: number; completion_percentage?: number; status?: string }) {
    return request(`/api/progress/${topicId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload)
    });
  },

  async getStudyPlan(token: string, examId: string) {
    return request(`/api/study-plans/${examId}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` }
    });
  },

  async toggleStudyTask(token: string, taskId: string) {
    return request(`/api/study-plans/tasks/${taskId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` }
    });
  },

  async updateTaskDetails(token: string, taskId: string, updates: {
    scheduled_date?: string;
    start_time?: string;
    end_time?: string;
    title?: string;
    notes?: string;
    priority?: string;
    estimated_minutes?: number;
    activity_type?: string;
  }) {
    return request(`/api/study-plans/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(updates)
    });
  },

  async addCustomStudyTask(token: string, payload: {
    exam_id: string;
    topic_id?: string;
    title: string;
    scheduled_date: string;
    start_time?: string;
    end_time?: string;
    activity_type?: string;
    estimated_minutes?: number;
    priority?: string;
    notes?: string;
  }) {
    return request('/api/study-plans/custom-task', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload)
    });
  },

  async deleteStudyTask(token: string, taskId: string) {
    return request(`/api/study-plans/tasks/${taskId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
  },

  async getDueRevisions(token: string, examId: string) {
    return request(`/api/revision/due/${examId}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` }
    });
  },

  async startRevisionSession(token: string, payload: { exam_id: string; topic_id?: string; topic_ids?: string[] }) {
    return request('/api/revision/sessions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload)
    });
  },

  async completeRevisionSession(token: string, sessionId: string, score: number = 100) {
    return request(`/api/revision/sessions/${sessionId}/complete?score=${score}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` }
    });
  },

  async getAvailableTests(token: string, examId: string) {
    return request(`/api/tests/available/${examId}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` }
    });
  },

  async configureMockTest(token: string, payload: {
    exam_id: string;
    test_name: string;
    test_type?: string;
    subject_id?: string;
    topic_ids?: string[];
    duration_minutes?: number;
    num_questions?: number;
    difficulty?: string;
    negative_marking_enabled?: boolean;
  }) {
    return request('/api/tests/configure', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload)
    });
  },

  async startCBTTest(token: string, testId: string) {
    return request(`/api/tests/${testId}/start`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` }
    });
  },

  async submitCBTTest(token: string, testId: string, payload: {
    attempt_id: string;
    user_answers: Record<string, any>;
    time_taken_seconds?: number;
  }) {
    return request(`/api/tests/${testId}/submit`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload)
    });
  },

  async getAttemptReview(token: string, attemptId: string) {
    return request(`/api/tests/attempts/${attemptId}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` }
    });
  },

  async getExamTestsHistory(token: string, examId: string) {
    return request(`/api/tests/history/${examId}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` }
    });
  },

  async getExamAnalytics(token: string, examId: string) {
    return request(`/api/analytics/${examId}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` }
    });
  },

  async triggerAdminSeed() {
    return request('/api/admin/seed', {
      method: 'POST'
    });
  },

  // ----------------- Phase 1: Core Learning & Interactive Studio -----------------
  async getTopicVideo(token: string, topicId: string) {
    return request(`/api/learning/topic/${topicId}/video`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` }
    });
  },

  async generateTopicVideo(token: string, topicId: string, engine: string = 'remotion') {
    return request(`/api/learning/topic/${topicId}/video/generate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ engine })
    });
  },

  async regenerateTopicVideo(token: string, topicId: string, engine: string = 'remotion') {
    return request(`/api/learning/topic/${topicId}/video/regenerate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ engine })
    });
  },

  async getAIProviders(token: string) {
    return request('/api/ai/providers', {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` }
    });
  },
  async getInteractiveTopicStudio(token: string, topicId: string) {
    return request(`/api/learning/topic/${topicId}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` }
    });
  },

  async updateTopicInteraction(token: string, topicId: string, payload: {
    mark_mastered?: boolean;
    comprehension_score?: number;
    sections_completed?: string[];
    flashcards_reviewed?: number;
    quiz_attempts?: number;
  }) {
    return request(`/api/learning/topic/${topicId}/interaction`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload)
    });
  },

  async chatWithTopicTutor(token: string, topicId: string, message: string, history: Array<{ role: string; message?: string; content?: string }>) {
    return request(`/api/learning/topic/${topicId}/chat`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ message, history })
    });
  },

  async getTopicChatHistory(token: string, topicId: string) {
    return request(`/api/learning/topic/${topicId}/chat-history`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` }
    });
  },

  async getTopicPracticeQuestions(token: string, topicId: string, difficulty: string = 'intermediate') {
    return request(`/api/learning/topic/${topicId}/practice?difficulty=${encodeURIComponent(difficulty)}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` }
    });
  },

  async submitTopicPracticeAnswer(token: string, topicId: string, payload: {
    question_id: string;
    question_text: string;
    user_answer: string;
    correct_answer: string;
    difficulty?: string;
    used_hint?: boolean;
    explanation?: string;
  }) {
    return request(`/api/learning/topic/${topicId}/practice/submit`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload)
    });
  },

  // ----------------- Phase 2: Adaptive Study Planning & Smart Recovery -----------------
  async createAdaptivePlan(token: string, payload: {
    exam_id: string;
    exam_date?: string;
    daily_study_hours?: number;
    available_days?: string[];
    sitting_times?: string[];
    learning_pace?: string;
    buffer_days?: number;
  }) {
    return request('/api/planner/adaptive-create', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload)
    });
  },

  async getAdaptivePlan(token: string, examId: string) {
    return request(`/api/planner/adaptive-plan/${examId}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` }
    });
  },

  async analyzeSmartRecovery(token: string, examId: string) {
    return request(`/api/planner/recovery/analyze/${examId}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` }
    });
  },

  async applySmartRecovery(token: string, recoveryId: string, payload: {
    plan_id: string;
    apply_mode?: string;
  }) {
    return request(`/api/planner/recovery/apply/${recoveryId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload)
    });
  },

  // ----------------- Phase 3 & 4: PYP Library, Exam Trends & Predicted Papers -----------------
  async getPreviousYearPapers(token: string, examId: string, filters?: {
    year?: number;
    subject?: string;
    paper_type?: string;
    verification_status?: string;
  }) {
    const params = new URLSearchParams();
    if (filters?.year) params.append('year', String(filters.year));
    if (filters?.subject) params.append('subject', filters.subject);
    if (filters?.paper_type) params.append('paper_type', filters.paper_type);
    if (filters?.verification_status) params.append('verification_status', filters.verification_status);

    const qs = params.toString() ? `?${params.toString()}` : '';
    return request(`/api/pyp/papers/${examId}${qs}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` }
    });
  },

  async createPreviousYearPaper(token: string, payload: {
    exam_id: string;
    title: string;
    year: number;
    subject?: string;
    paper_type?: string;
    duration_minutes?: number;
    total_questions?: number;
    total_marks?: number;
    source?: string;
    verification_status?: string;
    questions?: any[];
  }) {
    return request('/api/pyp/papers', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload)
    });
  },

  async getPreviousYearPaperDetail(token: string, paperId: string) {
    return request(`/api/pyp/papers/detail/${paperId}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` }
    });
  },

  async getPypTrendAnalysis(token: string, examId: string, refresh: boolean = false) {
    return request(`/api/pyp/trends/${examId}?refresh=${refresh}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` }
    });
  },

  async generatePredictedPaper(token: string, payload: {
    exam_id: string;
    generation_mode?: string;
    subject_name?: string;
    num_questions?: number;
    target_date?: string;
    time_limit_mins?: number;
  }) {
    return request('/api/predicted-paper/generate', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload)
    });
  },

  async getPredictedPaperDetail(token: string, paperId: string) {
    return request(`/api/predicted-paper/${paperId}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` }
    });
  },

  async listPredictedPapers(token: string, examId: string) {
    return request(`/api/predicted-paper/list/${examId}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` }
    });
  }
};
