export interface Topic {
  id: string;
  name: string;
  stage: number; // 0 to 5
  next: string;  // YYYY-MM-DD
}

export interface Subject {
  id: string;
  name: string;
  color: string;
  topics: Topic[];
}

export interface Task {
  id: string;
  title: string;
  subjectId: string;
  date: string;  // YYYY-MM-DD
  mins: number;
  prio: 'high' | 'med' | 'low';
  done: boolean;
}

export interface Session {
  id: string;
  date: string; // YYYY-MM-DD
  mins: number;
  subjectId: string;
  at: number; // timestamp ms
}

export interface ExamInfo {
  name: string;
  date: string; // YYYY-MM-DD
}

export interface TimerSettings {
  focus: number;
  short: number;
  long: number;
}

export interface StudyPlan {
  v: number;
  subjects: Subject[];
  tasks: Task[];
  sessions: Session[];
  exam: ExamInfo;
  goalMins: number;
  settings: TimerSettings;
  sittingCapacityMins?: number;
  aiApiKey?: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  exam_name: string;
  exam_date: string;
  goal_mins: number;
  settings: TimerSettings;
  sitting_capacity_mins?: number;
  ai_api_key?: string;
  created_at: string;
}

export interface UserStats {
  total_study_mins: number;
  total_study_hours: number;
  completed_tasks: number;
  total_tasks: number;
  total_topics: number;
  mastered_topics: number;
  readiness_percent: number;
  last_synced: string | null;
}

export interface MockQuestion {
  id: string;
  topic?: string;
  subject?: string;
  question: string;
  options: string[];
  correct_answer: number;
  explanation: string;
  difficulty?: string;
  importance?: 'very_important' | 'important' | 'standard';
  weightage?: string;
}

export interface AnalyzedTopicItem {
  topicName: string;
  subjectName: string;
  subjectId: string;
  importance: 'very_important' | 'important' | 'standard';
  weightage: string;
  reason: string;
  key_focus_areas?: string[];
}

export interface TopicImportanceAnalysis {
  source: 'live_ai' | 'heuristic_ai';
  summary: string;
  very_important_topics: AnalyzedTopicItem[];
  important_topics: AnalyzedTopicItem[];
  standard_topics: AnalyzedTopicItem[];
  analyzed_subjects: any[];
}

export interface MockTest {
  test_id: string;
  title: string;
  subject?: string;
  topics: string[];
  time_limit_mins: number;
  questions: MockQuestion[];
  created_at: string;
  source?: 'live_ai' | 'heuristic_ai';
}

export interface TestBreakdownItem {
  question_index: number;
  topic: string;
  question: string;
  user_choice: number | null;
  correct_answer: number;
  is_correct: boolean;
  explanation: string;
}

export interface TestResult {
  success: boolean;
  test_id: string;
  score: number;
  total: number;
  percentage: number;
  passed: boolean;
  breakdown: TestBreakdownItem[];
  adjustments: {
    passed: boolean;
    score: number;
    total: number;
    percentage: number;
    topic_names: string[];
    action: string;
    recommended_message: string;
  };
}

export interface AISchedulePlan {
  source: 'live_ai' | 'heuristic_ai';
  summary: string;
  daily_routine: string;
  sitting_capacity_mins: number;
  days_to_exam: number;
  tasks: Task[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  actionType?: 'set_capacity' | 'generate_schedule' | 'start_test';
  actionPayload?: any;
}
