import json
import secrets
import re
from datetime import datetime
from typing import List, Dict, Any, Optional

try:
    from database import get_db, MySQLCursorWrapper
except ImportError:
    from backend.database import get_db, MySQLCursorWrapper

try:
    import ai_service
except ImportError:
    from backend import ai_service


def decompose_topic_to_lessons(
    topic_name: str,
    subject_name: str = "General",
    exam_name: str = "Target Examination",
    education_level: str = "competitive",
    api_key: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Decomposes a syllabus topic into a structured progression of 4-7 lessons.
    Each lesson represents an ordered, bite-sized conceptual step:
    Foundational concepts -> Core Mechanism -> Edge Cases/Variants -> Advanced/Exam Problems.
    """
    clean_topic = (topic_name or "Core Topic").strip()
    clean_subj = (subject_name or "Subject").strip()

    prompt = f"""
    Act as a master curriculum architect. Decompose the following syllabus topic into 4 to 6 bite-sized, logically progressive educational lessons:
    Topic: "{clean_topic}"
    Subject: "{clean_subj}"
    Exam: "{exam_name}"
    Target Level: "{education_level}"

    PEDAGOGICAL RULES:
    1. Lessons MUST be strictly progressive: Lesson 1 must teach foundations/prerequisites, middle lessons teach core mechanisms and variations, and final lessons cover edge cases, worked problems, and exam tactics.
    2. Do NOT generate generic placeholder titles like "Introduction", "Overview", or "Conclusion". Each title must specifically name the exact sub-concept (e.g. for "Database Normalization": "1. Anomalies and Functional Dependencies", "2. First Normal Form (1NF) & Atomic Domains", "3. Second Normal Form (2NF) & Partial Dependency Elimination", "4. Third Normal Form (3NF) & Transitive Dependencies", "5. Boyce-Codd Normal Form (BCNF) & Lossless Joins").
    3. Estimated minutes per lesson should be between 15 and 30 minutes.

    Return ONLY a valid JSON object matching this schema:
    {{
        "topic": "{clean_topic}",
        "lessons": [
            {{
                "lesson_order": 1,
                "title": "Specific Lesson 1 Title",
                "learning_objective": "Clear, measurable outcome for this lesson",
                "prerequisites": ["Prereq concept 1", "Prereq concept 2"],
                "key_concepts": ["Concept A", "Concept B"],
                "estimated_minutes": 20,
                "difficulty": "easy",
                "relationship": "prerequisite"
            }},
            {{
                "lesson_order": 2,
                "title": "Specific Lesson 2 Title",
                "learning_objective": "Clear, measurable outcome for this lesson",
                "prerequisites": ["Lesson 1 concepts"],
                "key_concepts": ["Concept C", "Concept D"],
                "estimated_minutes": 25,
                "difficulty": "medium",
                "relationship": "sequential"
            }}
        ]
    }}
    """

    import asyncio
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor() as pool:
                llm_output = pool.submit(
                    asyncio.run,
                    ai_service.call_llm(
                        prompt,
                        api_key=api_key,
                        system_instruction="You are a senior curriculum architect. Return valid JSON only.",
                        json_mode=True
                    )
                ).result()
        else:
            llm_output = loop.run_until_complete(
                ai_service.call_llm(
                    prompt,
                    api_key=api_key,
                    system_instruction="You are a senior curriculum architect. Return valid JSON only.",
                    json_mode=True
                )
            )

        if llm_output:
            cleaned = llm_output.strip()
            if cleaned.startswith("```json"):
                cleaned = cleaned[7:]
            if cleaned.startswith("```"):
                cleaned = cleaned[3:]
            if cleaned.endswith("```"):
                cleaned = cleaned[:-3]
            parsed = json.loads(cleaned.strip())
            if "lessons" in parsed and isinstance(parsed["lessons"], list) and len(parsed["lessons"]) >= 3:
                return parsed["lessons"]
    except Exception as e:
        print(f"[Lesson Decomposition Notice] AI decomposition used fallback: {e}")

    # Authentic topic-aware fallback generator
    return generate_topic_aware_fallback_lessons(clean_topic, clean_subj, exam_name)


def generate_topic_aware_fallback_lessons(topic_name: str, subject_name: str, exam_name: str) -> List[Dict[str, Any]]:
    """
    Generates authentic, pedagogically structured lessons based on the topic's domain.
    """
    clean_t = topic_name.strip()
    clean_s = subject_name.strip()
    lower_t = clean_t.lower()

    if "linked list" in lower_t:
        return [
            {
                "lesson_order": 1,
                "title": f"1. Node Anatomy & Pointer Fundamentals in {clean_t}",
                "learning_objective": "Understand node structure, memory allocation, and address pointers.",
                "prerequisites": ["Arrays", "Pointers / References in Memory"],
                "key_concepts": ["Data Payload", "Next Pointer", "Head Pointer", "Null Sentinel"],
                "estimated_minutes": 20,
                "difficulty": "easy",
                "relationship": "prerequisite"
            },
            {
                "lesson_order": 2,
                "title": "2. Singly Linked List: Traversal, Search & Head/Tail Insertion",
                "learning_objective": "Implement forward traversal and O(1) head insertion operations.",
                "prerequisites": ["Node Anatomy"],
                "key_concepts": ["Forward Traversal", "O(1) Prepending", "O(N) Appending"],
                "estimated_minutes": 25,
                "difficulty": "medium",
                "relationship": "sequential"
            },
            {
                "lesson_order": 3,
                "title": "3. Node Deletion & Edge Cases: Empty Lists and Single Elements",
                "learning_objective": "Safely delete target nodes without losing downstream references or memory leaks.",
                "prerequisites": ["Singly Linked List Traversal"],
                "key_concepts": ["Pointer Re-linking", "Garbage Collection / Free", "Head Deletion Edge Case"],
                "estimated_minutes": 25,
                "difficulty": "medium",
                "relationship": "sequential"
            },
            {
                "lesson_order": 4,
                "title": "4. Doubly Linked Lists: Bidirectional Pointers (Prev/Next)",
                "learning_objective": "Master bidirectional traversal, predecessor tracking, and extra pointer trade-offs.",
                "prerequisites": ["Singly Linked List Operations"],
                "key_concepts": ["Prev Pointer", "O(1) Arbitrary Deletion with Pointer", "Memory Overhead"],
                "estimated_minutes": 30,
                "difficulty": "hard",
                "relationship": "sequential"
            },
            {
                "lesson_order": 5,
                "title": f"5. Exam Traps & High-Yield Pointer Manipulation in {exam_name}",
                "learning_objective": "Solve classic entrance exam problems: cycle detection (Floyd's algorithm) and list reversal.",
                "prerequisites": ["Doubly Linked Lists"],
                "key_concepts": ["Floyd's Tortoise & Hare", "In-place List Reversal", "Time/Space Complexity"],
                "estimated_minutes": 30,
                "difficulty": "hard",
                "relationship": "mastery"
            }
        ]

    # Standard Domain-Adapted Progression (5 Structured Stages)
    return [
        {
            "lesson_order": 1,
            "title": f"1. Core Principles & Foundational Invariants of {clean_t}",
            "learning_objective": f"Define {clean_t}, understand basic governing axioms, and establish terminology.",
            "prerequisites": [f"Basic principles of {clean_s}"],
            "key_concepts": [f"Definition of {clean_t}", "System Boundaries", "Fundamental Units"],
            "estimated_minutes": 20,
            "difficulty": "easy",
            "relationship": "prerequisite"
        },
        {
            "lesson_order": 2,
            "title": f"2. Working Mechanisms & Operational Flow of {clean_t}",
            "learning_objective": "Trace the step-by-step transformation from input state to output result.",
            "prerequisites": ["Core Principles"],
            "key_concepts": ["Internal Sequence", "Transfer Rules", "Intermediate States"],
            "estimated_minutes": 25,
            "difficulty": "medium",
            "relationship": "sequential"
        },
        {
            "lesson_order": 3,
            "title": f"3. Mathematical Formulation, Derivations & Parameter Scaling",
            "learning_objective": "Analyze governing equations, variable dependencies, and dimensional consistency.",
            "prerequisites": ["Working Mechanisms"],
            "key_concepts": ["Governing Law", "Direct & Inverse Proportionality", "SI Units"],
            "estimated_minutes": 30,
            "difficulty": "medium",
            "relationship": "sequential"
        },
        {
            "lesson_order": 4,
            "title": f"4. Boundary Conditions, Edge Cases & Common Fallacies in {clean_t}",
            "learning_objective": "Identify conditions where standard equations fail and avoid frequent student pitfalls.",
            "prerequisites": ["Mathematical Formulation"],
            "key_concepts": ["Limiting Constraints", "Sign Conventions", "Distractor Elimination"],
            "estimated_minutes": 25,
            "difficulty": "hard",
            "relationship": "sequential"
        },
        {
            "lesson_order": 5,
            "title": f"5. Worked Examination Problems & Rapid Solving Shortcuts for {exam_name}",
            "learning_objective": "Solve typical multi-step examination questions using verified algorithmic routines.",
            "prerequisites": ["Boundary Conditions"],
            "key_concepts": ["Problem Decomposition", "Dimensional Verification", "Top-Percentile Strategy"],
            "estimated_minutes": 30,
            "difficulty": "hard",
            "relationship": "mastery"
        }
    ]


def get_or_create_topic_lessons(topic_id: str, api_key: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Fetches persisted lessons for a topic from `topic_lessons`.
    If no lessons exist, decomposes the topic and saves the lessons to the database.
    """
    conn = get_db()
    cursor = conn.cursor()

    # 1. Fetch existing lessons
    cursor.execute("""
        SELECT id, topic_id, lesson_order, title, learning_objective, prerequisites,
               key_concepts, estimated_minutes, difficulty, relationship, status
        FROM topic_lessons
        WHERE topic_id = ?
        ORDER BY lesson_order ASC
    """, (topic_id,))
    rows = cursor.fetchall()

    if rows:
        lessons = []
        for r in rows:
            prereqs = json.loads(r["prerequisites"]) if r["prerequisites"] and r["prerequisites"].startswith("[") else ([r["prerequisites"]] if r["prerequisites"] else [])
            concepts = json.loads(r["key_concepts"]) if r["key_concepts"] and r["key_concepts"].startswith("[") else ([r["key_concepts"]] if r["key_concepts"] else [])
            lessons.append({
                "id": r["id"],
                "topic_id": r["topic_id"],
                "lesson_order": r["lesson_order"],
                "title": r["title"],
                "learning_objective": r["learning_objective"] or "",
                "prerequisites": prereqs,
                "key_concepts": concepts,
                "estimated_minutes": r["estimated_minutes"] or 20,
                "difficulty": r["difficulty"] or "medium",
                "relationship": r["relationship"] or "sequential",
                "status": r["status"] or "pending"
            })
        conn.close()
        return lessons

    # 2. Topic metadata lookup
    cursor.execute("""
        SELECT t.id, t.topic_name, s.subject_name, e.exam_name, e.education_level
        FROM topics t
        LEFT JOIN subjects s ON t.subject_id = s.id
        LEFT JOIN exams e ON s.exam_id = e.id
        WHERE t.id = ?
    """, (topic_id,))
    t_row = cursor.fetchone()

    if not t_row:
        conn.close()
        return []

    topic_name = t_row["topic_name"]
    subject_name = t_row["subject_name"] or "General"
    exam_name = t_row["exam_name"] or "Examination"
    edu_level = t_row["education_level"] or "competitive"

    # 3. Decompose
    decomposed = decompose_topic_to_lessons(topic_name, subject_name, exam_name, edu_level, api_key)
    now = datetime.now().isoformat()
    created_lessons = []

    for l_data in decomposed:
        lesson_id = f"les_{secrets.token_hex(8)}"
        order = l_data.get("lesson_order", len(created_lessons) + 1)
        title = l_data.get("title", f"Lesson {order}")
        obj = l_data.get("learning_objective", "")
        prereqs = json.dumps(l_data.get("prerequisites", []))
        concepts = json.dumps(l_data.get("key_concepts", []))
        mins = l_data.get("estimated_minutes", 20)
        diff = l_data.get("difficulty", "medium")
        rel = l_data.get("relationship", "sequential")

        cursor.execute("""
            INSERT INTO topic_lessons
            (id, topic_id, lesson_order, title, learning_objective, prerequisites, key_concepts, estimated_minutes, difficulty, relationship, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
        """, (lesson_id, topic_id, order, title, obj, prereqs, concepts, mins, diff, rel, now, now))

        created_lessons.append({
            "id": lesson_id,
            "topic_id": topic_id,
            "lesson_order": order,
            "title": title,
            "learning_objective": obj,
            "prerequisites": l_data.get("prerequisites", []),
            "key_concepts": l_data.get("key_concepts", []),
            "estimated_minutes": mins,
            "difficulty": diff,
            "relationship": rel,
            "status": "pending"
        })

    conn.commit()
    conn.close()
    return created_lessons


def update_lesson_status(lesson_id: str, status: str) -> Optional[Dict[str, Any]]:
    """Updates lesson completion status ('completed' or 'pending')."""
    conn = get_db()
    cursor = conn.cursor()
    now = datetime.now().isoformat()
    cursor.execute("""
        UPDATE topic_lessons
        SET status = ?, updated_at = ?
        WHERE id = ?
    """, (status, now, lesson_id))
    conn.commit()

    cursor.execute("SELECT * FROM topic_lessons WHERE id = ?", (lesson_id,))
    row = cursor.fetchone()
    conn.close()
    if row:
        return dict(row)
    return None

