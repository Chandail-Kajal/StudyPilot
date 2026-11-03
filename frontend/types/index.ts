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

export type UserRole = 'student' | 'competitive_exam' | 'professional';

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
  role?: UserRole;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role?: UserRole;
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

// ----------------- Relational Database Models & CBT Engine -----------------

export interface Exam {
  id: string;
  user_id?: string;
  exam_name: string;
  exam_category: 'competitive' | 'recruitment' | 'academic' | string;
  exam_date?: string | null;
  target_score?: number | null;
  status: 'active' | 'archived' | 'completed' | string;
  education_level?: EducationLevel;
  learning_preferences?: LearningPreferences | string;
  subjects_count?: number;
  topics_count?: number;
  mastered_count?: number;
  in_progress_count?: number;
  readiness_percent?: number;
  created_at?: string;
  updated_at?: string;
}

export interface SyllabusUpload {
  id: string;
  exam_id: string;
  user_id: string;
  file_name: string;
  file_format: string;
  file_path?: string;
  upload_status: string;
  processing_status: string;
  uploaded_at: string;
  processed_at?: string;
  error_message?: string;
}

export interface SyllabusRowPreview {
  id: string;
  exam_name: string;
  subject_name: string;
  unit_name: string;
  chapter_name: string;
  topic_name: string;
  subtopic_name?: string;
  difficulty: 'easy' | 'medium' | 'hard' | string;
  estimated_minutes: number;
  importance: 'low' | 'medium' | 'high' | 'very_high' | string;
  status: 'valid' | 'duplicate' | 'needs_correction';
  status_message: string;
}

export interface SyllabusPreviewSummary {
  total_rows: number;
  subjects_count: number;
  units_count: number;
  chapters_count: number;
  topics_count: number;
  valid_rows: number;
  duplicate_rows: number;
  correction_rows: number;
}

export interface SyllabusPreviewResponse {
  success: boolean;
  filename: string;
  analysis_source?: 'live_ai' | 'heuristic' | 'structured_file' | string;
  detected_headers: string[];
  canonical_columns: string[];
  subjects: string[];
  summary: SyllabusPreviewSummary;
  rows: SyllabusRowPreview[];
}

export interface HierarchyTopic {
  id: string;
  subject_id: string;
  unit_id?: string;
  chapter_id?: string;
  topic_name: string;
  subtopic_name?: string;
  difficulty?: string;
  estimated_minutes?: number;
  importance?: string;
  display_order?: number;
  progress_status?: 'not_started' | 'learning' | 'reviewing' | 'mastered';
  completion_percentage?: number;
  stage?: number;
  next_revision_date?: string;
  last_studied_at?: string;
}

export interface HierarchyChapter {
  id: string;
  unit_id: string;
  chapter_name: string;
  display_order?: number;
  topics: HierarchyTopic[];
}

export interface HierarchyUnit {
  id: string;
  subject_id: string;
  unit_name: string;
  display_order?: number;
  chapters: HierarchyChapter[];
}

export interface HierarchySubject {
  id: string;
  exam_id: string;
  subject_name: string;
  description?: string;
  color: string;
  display_order?: number;
  units: HierarchyUnit[];
}

export interface TopicProgressItem {
  topic_id: string;
  topic_name: string;
  subtopic_name?: string;
  difficulty: string;
  importance: string;
  subject_id: string;
  subject_name: string;
  subject_color: string;
  unit_name?: string;
  chapter_name?: string;
  status: 'not_started' | 'learning' | 'reviewing' | 'mastered';
  completion_percentage: number;
  stage: number;
  next_revision_date?: string;
  last_studied_at?: string;
  last_revised_at?: string;
}

export interface ExamAnalytics {
  exam_id: string;
  exam_name: string;
  exam_date?: string;
  readiness_percent: number;
  readiness_index?: number;
  total_topics: number;
  mastered_topics?: number;
  reviewing_topics?: number;
  unstarted_topics?: number;
  distribution?: {
    mastered: number;
    reviewing: number;
    learning: number;
    not_started: number;
  };
  subjects?: Array<{
    subject_id: string;
    subject_name: string;
    color: string;
    topic_count: number;
    mastered_topics: number;
    proficiency_percent: number;
    avg_completion: number;
  }>;
  subject_proficiency?: Array<{
    subject_name: string;
    total_topics: number;
    mastered_topics: number;
    proficiency_percentage: number;
  }>;
  trajectory?: Array<{
    id: string;
    score: number;
    started_at: string;
    test_name: string;
    total_marks: number;
  }>;
  test_stats?: {
    total_attempts: number;
    avg_score_pct: number;
    total_questions_solved: number;
    overall_accuracy_pct: number;
  };
  weak_topics?: Array<{
    id?: string;
    topic_name: string;
    difficulty?: string;
    importance?: string;
    subject_name?: string;
    stage?: number;
    completion_percentage?: number;
    incorrect_count?: number;
  }>;
}

export interface CBTQuestion {
  id: string;
  question: string;
  options: string[];
  topic: string;
  subject: string;
  difficulty: string;
  marks: number;
  negative_marks: number;
}

export interface CBTTestStartResponse {
  success: boolean;
  attempt_id: string;
  test: {
    id: string;
    test_name: string;
    duration_minutes: number;
    total_questions: number;
    negative_marking_enabled: boolean;
  };
  questions: CBTQuestion[];
}

export interface CBTTestSubmitResponse {
  success: boolean;
  attempt_id: string;
  test_name?: string;
  score: number;
  total_marks: number;
  correct_count: number;
  incorrect_count: number;
  unanswered_count: number;
  accuracy_percent?: number;
  passed?: boolean;
  time_taken_seconds: number;
  weak_topics_count?: number;
  negative_marks_deducted?: number;
  weak_topics?: string[];
  question_breakdown?: Array<{
    question_id: string;
    question_text?: string;
    question?: string;
    options: string[];
    selected_option?: number | null;
    user_answer?: number | string | null;
    correct_option?: number;
    correct_answer?: string;
    is_correct: boolean | null;
    marks_awarded: number;
    explanation?: string;
    topic_name?: string;
  }>;
  breakdown?: Array<{
    question_id: string;
    question: string;
    options: string[];
    user_answer: number | string | null;
    correct_answer: string;
    is_correct: boolean | null;
    marks_awarded: number;
    explanation: string;
  }>;
  attempt?: any;
  answers?: any[];
}

export interface TestAttemptSummary {
  id: string;
  mock_test_id: string;
  test_name: string;
  test_type: string;
  started_at: string;
  submitted_at?: string;
  score?: number;
  max_marks?: number;
  total_questions: number;
  correct_count: number;
  incorrect_count: number;
  unanswered_count: number;
  time_taken_seconds: number;
  status: string;
}

export interface DueRevisionTopic {
  topic_id: string;
  topic_name: string;
  difficulty: string;
  importance: string;
  subject_name: string;
  subject_color: string;
  stage: number;
  status: string;
  next_revision_date: string;
  last_studied_at?: string;
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
  marking_correct?: number;
  marking_incorrect?: number;
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
  duration_mins?: number;
  difficulty?: 'easy' | 'moderate' | 'difficult' | string;
  test_type?: 'standard' | 'full_syllabus' | 'subject_paper';
  test_number?: number;
  subjects?: string[];
  total_questions?: number;
  questions: MockQuestion[];
  created_at: string;
  source?: 'live_ai' | 'heuristic_ai';
  role?: UserRole;
  marking_scheme?: {
    correct: number;
    incorrect: number;
    type: string;
    label: string;
  };
}

export interface TestBreakdownItem {
  question_index: number;
  topic: string;
  subject?: string;
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
  duration_mins?: number;
  difficulty?: string;
  test_number?: number;
  time_taken_seconds?: number;
  raw_score?: number;
  max_marks?: number;
  negative_deduction?: number;
  role?: UserRole;
  subject_filter?: string;
  marking_scheme?: {
    correct: number;
    incorrect: number;
    type: string;
    label: string;
  };
  subject_scores?: Record<string, { correct: number; total: number; percentage: number }>;
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

export interface FullSyllabusTestRequest {
  syllabus: Subject[];
  duration_mins: 60 | 180;
  difficulty: 'easy' | 'moderate' | 'difficult';
  test_number: number;
  num_questions?: number;
  subject_id?: string;
  subject_name?: string;
  role?: UserRole;
  api_key?: string;
}

export interface SyllabusParseResult {
  success: boolean;
  filename: string;
  plan: StudyPlan;
  summary: string;
  subjects_count: number;
  topics_count: number;
  tasks_count: number;
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

// ============================================================================
// Phase 1-4 Intelligent Learning & Examination Architecture Types
// ============================================================================

export type EducationLevel =
  | 'class_6_8'
  | 'class_9_10'
  | 'class_11_12'
  | 'undergraduate'
  | 'postgraduate'
  | 'research'
  | 'competitive_exam'
  | 'custom';

export interface LearningPreferences {
  explanation_depth?: 'intuitive' | 'balanced' | 'rigorous' | 'exam_focused';
  examples_style?: 'real_life' | 'mathematical' | 'case_study' | 'code_practical';
  language_style?: 'simple' | 'academic' | 'bilingual';
  preferred_activities?: string[];
}

export interface TopicSection {
  title: string;
  concept: string;
  key_points: string[];
}

export interface Flashcard {
  id: string;
  front: string;
  back: string;
  category?: string;
}

export interface Flipcard {
  id: string;
  question: string;
  answer: string;
  hint?: string;
}

export interface MiniQuizQuestion {
  id: string;
  question: string;
  options: string[];
  correct_index: number;
  explanation: string;
}

export interface MatchingPair {
  term: string;
  match: string;
}

export interface WorkedExample {
  problem: string;
  solution_steps: string[];
  final_answer: string;
}

export interface TopicStudioContent {
  id?: string;
  topic_id: string;
  topic_name: string;
  subject_name?: string;
  unit_name?: string;
  education_level: EducationLevel;
  prerequisites: string[];
  sections: TopicSection[];
  analogies: string[];
  flashcards: Flashcard[];
  flipcards: Flipcard[];
  mini_quiz: MiniQuizQuestion[];
  matching_pairs?: MatchingPair[];
  worked_examples?: WorkedExample[];
  mnemonics?: string[];
  code_examples?: { language: string; code: string; explanation: string }[];
  summary_key_takeaways: string[];
  user_interaction?: {
    has_studied: boolean;
    has_mastered: boolean;
    comprehension_score: number;
    completed_sections: string[];
  };
}

export interface TopicPracticeQuestion {
  id: string;
  topic_id?: string;
  question: string;
  question_type: 'mcq' | 'short_answer' | 'numerical' | 'conceptual';
  difficulty: 'beginner' | 'easy' | 'intermediate' | 'advanced' | 'exam_level';
  options?: string[];
  correct_answer?: string;
  hint?: string;
  explanation?: string;
  prerequisite_recommendation?: string;
}

export interface PracticeEvaluation {
  is_correct: boolean;
  score: number;
  correct_answer: string;
  explanation: string;
  mistake_breakdown: string;
  hint_or_next_step: string;
  recommended_concept?: string;
  demonstrated_mastery?: boolean;
}

export interface AdaptivePlanTask {
  id: string;
  task_title: string;
  subject_name: string;
  unit_name?: string;
  topic_name?: string;
  scheduled_date: string;
  duration_minutes: number;
  activity_type: 'learn' | 'practice' | 'revision' | 'mock_test';
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'completed' | 'missed' | 'rescheduled';
}

export interface AdaptivePlan {
  id: string;
  exam_id: string;
  plan_name: string;
  total_study_days: number;
  daily_hours: number;
  feasibility_status: 'feasible' | 'tight' | 'critical_overload';
  explanation: string;
  tasks: AdaptivePlanTask[];
}

export interface RecoveryProposal {
  recovery_id: string;
  exam_id: string;
  missed_tasks_count: number;
  days_remaining: number;
  remaining_study_hours: number;
  feasibility_status: 'feasible' | 'tight' | 'critical_overload';
  explanation: string;
  proposed_schedule: AdaptivePlanTask[];
  preserved_completed_count: number;
}

export interface PreviousYearPaper {
  id: string;
  exam_id: string;
  paper_title: string;
  year: number;
  session?: string;
  source: string;
  source_url?: string;
  verification_status: 'verified_official' | 'community_contributed' | 'unverified';
  answer_key_source?: string;
  total_questions: number;
  time_allowed_minutes: number;
  max_marks?: number;
  questions_count?: number;
  created_at?: string;
}

export interface PYPQuestion {
  id: string;
  paper_id: string;
  question_number: number;
  subject_name: string;
  unit_name?: string;
  topic_name?: string;
  question_text: string;
  question_type: string;
  options?: string[];
  correct_answer?: string;
  explanation?: string;
  marks?: number;
  difficulty?: string;
}

export interface TopicTrendItem {
  id?: string;
  exam_id: string;
  subject_name: string;
  topic_name: string;
  frequency_count: number;
  importance_category:
    | 'high_historical_frequency'
    | 'moderate_historical_frequency'
    | 'lower_historical_frequency'
    | 'important_syllabus_fundamentals'
    | 'weak_areas_for_current_user'
    | 'topics_requiring_revision'
    | 'insufficient_historical_data';
  evidence_notes: string;
  years_appeared: number[];
  recommendation_action: string;
}

export interface ExamTrendSummary {
  exam_id: string;
  exam_name: string;
  total_papers_analyzed: number;
  years_covered: number[];
  trends: TopicTrendItem[];
  high_priority_count: number;
  moderate_priority_count: number;
  user_weak_count: number;
}

export interface PredictedPaperQuestion {
  id: string;
  question_number: number;
  subject_name: string;
  topic_name: string;
  question_text: string;
  options: string[];
  correct_answer: string;
  explanation: string;
  marks: number;
  predicted_reasoning?: string;
}

export interface PredictedPaper {
  id: string;
  exam_id: string;
  title: string;
  generation_mode:
    | 'exam_pattern'
    | 'high_priority'
    | 'full_syllabus'
    | 'weak_areas'
    | 'revision_paper'
    | 'last_minute';
  total_questions: number;
  duration_minutes: number;
  disclaimer: string;
  questions: PredictedPaperQuestion[];
  created_at?: string;
}
