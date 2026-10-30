# StudyPilot AI 🚀
### Intelligent Syllabus Tracker, Spaced Repetition Engine & CBT Mock Test Platform

StudyPilot AI is an advanced, production-grade learning management and exam preparation platform. It empowers students and competitive exam aspirants to import syllabi in multiple formats (PDF, Excel `.xlsx`/`.xls`, CSV), normalize curriculum into a structured multi-level hierarchy, schedule daily study tasks, automate spaced repetition revision, and take Computer-Based Tests (CBT) with instant diagnostics.

---

## 🌟 Key Features

1. **Multi-Format Syllabus Upload**:
   - Upload syllabus files in **PDF** (`.pdf`), **Excel** (`.xlsx`, `.xls`), and **CSV** (`.csv`).
   - Separate uploads for whole exams or individual subjects.
   - Intelligent column-mapping screen for Excel/CSV headers.
   - Automatic text parsing and structure recognition for PDF documents.
   - Duplicate topic detection (within file and against existing database records).

2. **Subject-Wise Syllabus Hierarchy**:
   - Strict normalized hierarchy: `Exam → Subject → Unit → Chapter → Topic → Subtopic (optional)`.
   - Rich topic metadata: `difficulty` (easy/medium/hard), `estimated_minutes`, and `importance` (low/medium/high).
   - Interactive preview table with inline editing, deletion, and validation before committing.

3. **Production Relational Database Architecture**:
   - 18 core relational tables with foreign keys (`ON DELETE CASCADE`), indexes, constraints, and user isolation.
   - Supported on **SQLite** (default zero-configuration), **PostgreSQL** (`schema_postgres.sql`), and **MySQL** (`schema_mysql.sql`).
   - Transactional commits preventing corrupted imports or cross-exam topic pollution.

4. **14 Dedicated Frontend Views**:
   - **Dashboard**: High-level readiness index, today's tasks, revision queue, quick actions, and demo account switcher.
   - **My Exams**: Exam card grid, target score, exam dates, activation toggle, and exam creation modal.
   - **Exam Details**: Subject mastery meters, curriculum tree, and uploaded files history log.
   - **Upload Syllabus**: Drag-and-drop file uploader with column mapper and scope selector.
   - **Syllabus Import Preview**: Editable preview table with status badges (`valid`, `duplicate`, `needs_correction`).
   - **Subject & Topic Management**: Complete hierarchy manager to add/edit/delete subjects, units, chapters, and topics.
   - **Topic Progress**: 5-stage spaced repetition ladder with filters and search.
   - **Study Planner**: Daily scheduled tasks, capacity tracking, task completion toggles, and Pomodoro focus launcher.
   - **Smart Revision**: Active recall queue and interactive drill session with stage advancement.
   - **Mock Test Configuration**: Custom test builder (full syllabus, subject, unit, topic, monthly), timer, and negative marking.
   - **Test Taking Interface**: Real-time CBT interface with countdown timer, question palette, and mark for review.
   - **Test Results**: Scorecard, accuracy %, negative marks deducted, weak topic diagnostics, and question explanations.
   - **Test History**: Comprehensive log of previous test attempts and scorecard review.
   - **Performance Analytics**: Readiness index meter, subject proficiency bars, mastery distribution, and weak spots.

---

## 👥 Documented Demo Accounts

The database comes pre-seeded with 3 realistic demo accounts across distinct examination categories. All seed accounts share the same password:

| Student Name | Email Address | Password | Examination Category | Target Exam(s) |
|---|---|---|---|---|
| **Aarav Sharma** | `ugc.student@studypilot.ai` | `Password123!` | Competitive / Higher Ed | UGC NET Computer Science (Active), GATE CS |
| **Priya Verma** | `cgl.aspirant@studypilot.ai` | `Password123!` | Government Exams | SSC CGL (Tier 1 & Tier 2) |
| **Rohan Patel** | `board.student@studypilot.ai` | `Password123!` | School Boards | CBSE Class 12 Board Exam |

> **Quick Switcher**: The frontend includes a 1-click demo switcher chip in the navigation sidebar and dashboard to test different personas instantly without re-typing credentials.

---

## 📁 Sample Syllabi for Testing Uploads

Sample test files are located in the `sample_syllabi/` folder:
- `sample_syllabi/ssc_cgl_syllabus.pdf` — PDF format syllabus with structured tables.
- `sample_syllabi/board_exam_syllabus.xlsx` — Excel format syllabus with class units and chapters.
- `sample_syllabi/jee_competitive_syllabus.csv` — CSV format syllabus with column headings.

---

## 🛠️ Step-by-Step Setup Instructions

### Prerequisites
- **Python**: Version 3.10+ (tested on Python 3.14)
- **Node.js**: Version 18+ (tested on Node.js 20+)
- **npm** or **pnpm** / **yarn**

---

### Step 1: Backend Setup & Environment Variables

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Create and activate a Python virtual environment:
   - **Windows (PowerShell)**:
     ```powershell
     python -m venv .venv
     .\.venv\Scripts\Activate.ps1
     ```
   - **macOS / Linux**:
     ```bash
     python3 -m venv .venv
     source .venv/bin/activate
     ```

3. Install backend dependencies:
   ```bash
   pip install -r requirements.txt
   pip install openpyxl xlrd pypdf reportlab
   ```

4. Configure environment variables (optional):
   Create a `.env` file in `backend/` if customizing settings:
   ```env
   SECRET_KEY=studypilot_super_secret_jwt_key_2026
   ALGORITHM=HS256
   DATABASE_URL=sqlite:///studypilot.db
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

---

### Step 2: Database Creation, Migrations & Idempotent Seeding

1. **Initialize Database & Run Migrations**:
   The database automatically initializes all 18 relational tables, composite indexes, and foreign keys when `database.py` executes:
   ```bash
   python -c "import database; database.init_db(); print('Database schema ready.')"
   ```

   *(For PostgreSQL or MySQL users, apply `backend/schema_postgres.sql` or `backend/schema_mysql.sql` using `psql` or `mysql` CLI)*.

2. **Run Idempotent Data Seeder**:
   Populate the 3 demo users, 3 distinct exams, subjects, units, chapters, 36+ realistic question bank entries, mock tests, past attempts, answers, and study plans:
   ```bash
   python seed_data.py
   ```
   > **Note on Idempotency**: The seed script safely purges demo records prior to insertion, allowing you to run `python seed_data.py` repeatedly without duplicate constraint errors.

3. **Run Endpoint Test Suite** (optional verification):
   ```bash
   python test_api_endpoints.py
   ```

---

### Step 3: Start the FastAPI Backend Server

From the `backend` directory with the virtual environment activated:
```bash
uvicorn main:app --reload --port 8000
```
- API Base: `http://localhost:8000`
- Interactive Swagger Documentation: `http://localhost:8000/docs`
- ReDoc Documentation: `http://localhost:8000/redoc`

---

### Step 4: Start the Next.js Frontend

1. Open a new terminal and navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the Next.js development server:
   ```bash
   npm run dev
   ```
   The application will be accessible at: **`http://localhost:3000`**.

4. (Optional) Run production build check:
   ```bash
   npm run build
   ```

---

## 🗄️ Relational Database Schema Overview

The database adheres strictly to normalized relational design across 18 core tables:

1. `users` — Authentication credentials, role, learner category, and timestamps.
2. `exams` — Target exams linked to users with category, date, and target score.
3. `syllabus_uploads` — Multi-format upload logs (`.pdf`, `.xlsx`, `.xls`, `.csv`), file metadata, and status.
4. `subjects` — Exam subjects with display order and color coding.
5. `syllabus_units` — Structural units within each subject.
6. `chapters` — Structural chapters within each unit.
7. `topics` — Granular topics with `difficulty`, `estimated_minutes`, and `importance`.
8. `topic_progress` — User mastery stages (0–5), completion %, and spaced revision dates.
9. `study_plans` — Exam study plans and daily study targets.
10. `study_plan_tasks` — Scheduled daily topic study tasks.
11. `question_bank` — Verified questions, options (JSON), correct answer, difficulty, and marks.
12. `mock_tests` — Custom and standardized CBT tests (Topic, Unit, Subject, Full Syllabus, Monthly).
13. `mock_test_topics` — Mapping table connecting tests with syllabus topics.
14. `test_attempts` — Candidate CBT attempts with scores, accuracy, and duration.
15. `test_attempt_answers` — Detailed candidate answers, awarded marks, and time spent per question.
16. `revision_sessions` — Spaced repetition active recall drill sessions.
17. `revision_session_topics` — Topics practiced during revision drills.
18. `monthly_assessments` — Structured monthly benchmarking assessments.

---

## 🧪 Acceptance Testing Checklist

- [x] Multi-format upload parses `.pdf`, `.xlsx`, `.xls`, and `.csv`.
- [x] Column mapping allows custom headers to match syllabus fields.
- [x] Duplicate detection highlights topics already present in file or database.
- [x] Editable preview table allows inline corrections before confirming.
- [x] Confirmed syllabus commits transactionally into `subjects`, `syllabus_units`, `chapters`, and `topics`.
- [x] Mock tests filter and pull questions strictly from the active exam.
- [x] Revision sessions pull due topics based on spaced repetition intervals.
- [x] CBT test scoring calculates marks, applies negative marking, and updates analytics.
- [x] Seed data populates immediately upon launch.
- [x] Multi-user data isolation ensures users only see their own exam records.
