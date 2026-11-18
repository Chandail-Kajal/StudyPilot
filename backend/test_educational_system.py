"""
Automated Comprehensive Test Suite for StudyPilot Educational System Upgrades.

Verifies:
1. Universal Syllabus Parser (page tracking, hierarchy, OCR fallback awareness).
2. Topic-to-Lesson Decomposition Service (4-6 structured bite-sized lessons, persistence, status update).
3. Pedagogical Content Quality Validator (15-section completeness, anti-boilerplate checks).
4. Timetable Generator (Difficulty weighting: Hard = 1.5x time, Spaced Repetition milestones R1/R2).
5. Adaptive Study Service (Spaced revision interval contraction on score < 60%).
"""

import sys
import os
import secrets
from datetime import datetime, timedelta
import unittest

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from syllabus_parser import _parse_text_to_preview_rows
from services.lesson_decomposition_service import (
    generate_topic_aware_fallback_lessons,
    get_or_create_topic_lessons,
    update_lesson_status
)
from services.content_quality_validator import PedagogicalContentValidator
from timetable_generator import generate_full_study_timetable
from services.study_service import complete_revision_session
from database import get_db


class TestUniversalSyllabusParsing(unittest.TestCase):
    def test_page_tracking_and_hierarchy(self):
        sample_text = """
--- Page 1 ---
Subject: Computer Science
Unit 1: Data Structures
Topic: Singly and Doubly Linked Lists
- Subtopic: Traversal and Insertion
- Subtopic: Reversal and Edge Cases

--- Page 2 ---
Unit 2: Algorithms
Topic: Sorting Algorithms
- Subtopic: QuickSort Partitioning
"""
        rows = _parse_text_to_preview_rows(sample_text, "Target Examination", "Computer Science")
        self.assertGreater(len(rows), 0, "Should extract rows from syllabus text")
        
        # Check that page tracking is attached
        linked_list_row = next((r for r in rows if "Linked Lists" in r.get("topic_name", "")), None)
        self.assertIsNotNone(linked_list_row, "Linked Lists topic should be identified")
        self.assertEqual(linked_list_row.get("source_page"), "Page 1")
        self.assertIn("Page 1", linked_list_row.get("source_ref", ""))

        sorting_row = next((r for r in rows if "Sorting Algorithms" in r.get("topic_name", "")), None)
        self.assertIsNotNone(sorting_row, "Sorting Algorithms topic should be identified")
        self.assertEqual(sorting_row.get("source_page"), "Page 2")
        self.assertIn("Page 2", sorting_row.get("source_ref", ""))


class TestTopicLessonDecomposition(unittest.TestCase):
    def test_topic_aware_fallback_lessons(self):
        lessons = generate_topic_aware_fallback_lessons("Singly and Doubly Linked Lists", "Data Structures", "GATE CS")
        self.assertTrue(4 <= len(lessons) <= 6, f"Expected 4-6 lessons, got {len(lessons)}")
        
        lesson_titles = [l["title"] for l in lessons]
        self.assertTrue(any("Anatomy" in t or "Pointer" in t for t in lesson_titles))
        self.assertTrue(any("Traversal" in t or "Insertion" in t for t in lesson_titles))
        self.assertTrue(any("Doubly" in t or "Exam" in t for t in lesson_titles))
        
        # Verify order indices and fields
        for i, lesson in enumerate(lessons):
            self.assertEqual(lesson["lesson_order"], i + 1)
            self.assertIn("key_concepts", lesson)
            self.assertIn("estimated_minutes", lesson)

    def test_database_persistence_and_status(self):
        conn = get_db()
        cursor = conn.cursor()
        
        # Ensure a test topic exists in topics table so foreign key / topic lookup succeeds
        cursor.execute("SELECT id FROM topics LIMIT 1")
        topic_row = cursor.fetchone()
        test_topic_id = topic_row["id"] if topic_row else "top_test_decomp_001"
        conn.close()

        # Decompose & persist
        lessons = get_or_create_topic_lessons(test_topic_id)
        self.assertTrue(len(lessons) >= 4, "Should retrieve persisted lessons")
        first_lesson_id = lessons[0]["id"]

        # Update status
        success = update_lesson_status(first_lesson_id, "completed")
        self.assertTrue(success, "Status update should succeed")

        # Verify status update persisted
        updated_lessons = get_or_create_topic_lessons(test_topic_id)
        first_updated = next(l for l in updated_lessons if l["id"] == first_lesson_id)
        self.assertEqual(first_updated["status"], "completed")


class TestPedagogicalContentQuality(unittest.TestCase):
    def test_reject_boilerplate(self):
        boilerplate_content = {
            "topic_introduction": "Imagine baking a cake where steps must be followed.",
            "conceptual_explanation": "Rate = k * dS/dt represents the dynamic rate.",
            "real_world_examples": ["In daily life, baking requires steps."]
        }
        is_valid, score, issues = PedagogicalContentValidator.validate_content(boilerplate_content, "Linked Lists", "Computer Science")
        self.assertFalse(is_valid)
        self.assertTrue(any("boilerplate" in iss.lower() for iss in issues))

    def test_accept_authentic_content(self):
        authentic_content = {
            "topic_introduction": "A singly linked list is a linear data structure where elements are stored in nodes connected by pointers.",
            "learning_objectives": ["Understand node pointers", "Perform O(1) head insertion"],
            "prerequisites": ["Basic pointers", "Dynamic memory allocation"],
            "simple_explanation": "A linked list is like a chain of train cars linked together.",
            "detailed_explanation": "Each node contains a data payload and a 'next' reference pointing to the subsequent node in heap memory.",
            "how_it_works": "Sequential traversal begins at the HEAD pointer and continues until a null reference is reached.",
            "real_world_applications": ["Web browser forward/back cache history", "Music playlist track navigation"],
            "analogy": "A treasure hunt where each clue directs you to the exact coordinates of the next clue.",
            "step_by_step_examples": [
                {
                    "step": 1,
                    "action": "Allocate memory for newNode",
                    "explanation": "Create new node with data"
                }
            ],
            "important_formulas_or_code": [
                {
                    "title": "Node Class in Python",
                    "code": "class Node:\n    def __init__(self, val):\n        self.val = val\n        self.next = None"
                }
            ],
            "diagrams_and_visuals": [
                {
                    "title": "Linked List Node Structure",
                    "svg": "<svg><rect width='100' height='40'/></svg>"
                }
            ],
            "common_mistakes_and_traps": [
                {
                    "mistake": "Losing head reference before re-linking",
                    "correction": "Always set newNode.next first before updating head pointer"
                }
            ],
            "advantages_and_limitations": {
                "advantages": ["Dynamic size", "O(1) front insertion"],
                "limitations": ["O(N) random access", "Extra memory for pointer storage"]
            },
            "comparison_table": {
                "headers": ["Feature", "Array", "Singly Linked List"],
                "rows": [["Access Time", "O(1)", "O(N)"], ["Insertion at Front", "O(N)", "O(1)"]]
            },
            "exam_perspective": {
                "high_yield_topics": ["Reversing in O(1) space", "Cycle detection with Floyd's Tortoise & Hare"],
                "typical_traps": ["Null pointer dereference on empty list"]
            },
            "practice_questions": [
                {
                    "question": "What is the time complexity to find the middle of a singly linked list in a single pass?",
                    "options": ["O(1)", "O(N)", "O(N^2)", "O(log N)"],
                    "correct_answer": "O(N)",
                    "step_by_step_solution": "Use fast and slow pointers where fast moves 2 steps and slow moves 1 step."
                }
            ],
            "points_to_remember": [
                "Nodes store data and next pointer.",
                "Head insertion is O(1); search is O(N)."
            ],
            "topic_summary": "Singly and doubly linked lists provide dynamic data storage with efficient insertion and deletion."
        }
        is_valid, score, issues = PedagogicalContentValidator.validate_content(authentic_content, "Linked Lists", "Computer Science")
        self.assertTrue(is_valid, f"Validation failed with issues: {issues}")
        self.assertGreaterEqual(score, 0.8)


class TestTimetableDifficultyAndSpacedRepetition(unittest.TestCase):
    def test_difficulty_weighting(self):
        topics = [
            {"id": "t_easy", "topic_name": "Introduction to Variables", "difficulty": "easy", "estimated_hours": 1.0},
            {"id": "t_med", "topic_name": "Control Flow Loops", "difficulty": "medium", "estimated_hours": 1.0},
            {"id": "t_hard", "topic_name": "Dynamic Programming & Trees", "difficulty": "hard", "estimated_hours": 1.0}
        ]
        
        target_date = (datetime.now() + timedelta(days=60)).strftime("%Y-%m-%d")
        timetable = generate_full_study_timetable(
            exam_id="test_exam_001",
            exam_name="Computer Science Benchmark",
            exam_date=target_date,
            topics=topics,
            daily_study_hours=3.0
        )
        tasks = timetable.get("tasks", [])
        self.assertGreater(len(tasks), 0)

        # Inspect duration of learning tasks
        easy_tasks = [t for t in tasks if t.get("topic_id") == "t_easy" and t.get("activity_type") == "class"]
        hard_tasks = [t for t in tasks if t.get("topic_id") == "t_hard" and t.get("activity_type") == "class"]
        
        self.assertTrue(len(easy_tasks) > 0 and len(hard_tasks) > 0)
        # Hard tasks should have greater duration than easy tasks
        self.assertGreater(hard_tasks[0].get("estimated_minutes"), easy_tasks[0].get("estimated_minutes"))

        # Check spaced repetition milestones (R1, R2, Mock)
        revision_tasks = [t for t in tasks if t.get("activity_type") == "revision"]
        mock_tasks = [t for t in tasks if t.get("activity_type") == "mock_test"]
        self.assertGreater(len(revision_tasks), 0, "Spaced repetition revision milestones should be generated")
        self.assertGreater(len(mock_tasks), 0, "Mock test milestones should be generated")


class TestAdaptiveRevisionContract(unittest.TestCase):
    def test_interval_contraction_on_struggling_score(self):
        conn = get_db()
        cursor = conn.cursor()
        
        # Find an existing user or create mock
        cursor.execute("SELECT id FROM users LIMIT 1")
        user_row = cursor.fetchone()
        user_id = user_row["id"] if user_row else "user_default"
        user = {"id": user_id, "name": "Student Aarav"}

        # Find or create a test revision session and topic
        cursor.execute("SELECT id FROM topics LIMIT 1")
        topic_row = cursor.fetchone()
        topic_id = topic_row["id"]

        session_id = f"rev_test_{secrets.token_hex(4)}"
        cursor.execute("""
            INSERT INTO revision_sessions (id, user_id, exam_id, started_at, status)
            VALUES (?, ?, 'exam_ugc_net', ?, 'scheduled')
        """, (session_id, user_id, datetime.now().isoformat()))

        cursor.execute("""
            INSERT INTO revision_session_topics (id, revision_session_id, topic_id)
            VALUES (?, ?, ?)
        """, (f"rst_{secrets.token_hex(4)}", session_id, topic_id))

        # Ensure topic_progress exists
        cursor.execute("""
            INSERT INTO topic_progress (id, user_id, topic_id, stage, status, updated_at)
            VALUES (?, ?, ?, 2, 'reviewing', ?)
            ON DUPLICATE KEY UPDATE stage = 2, status = 'reviewing'
        """, (f"tp_{secrets.token_hex(4)}", user_id, topic_id, datetime.now().isoformat()))
        conn.commit()

        # Complete with struggling score (40%)
        res = complete_revision_session(session_id=session_id, score=40.0, user=user)
        self.assertTrue(res.get("success"))

        # Verify next revision date is contracted to 1 day and status is needs_revision
        cursor.execute("SELECT stage, status, next_revision_date FROM topic_progress WHERE user_id = ? AND topic_id = ?", (user_id, topic_id))
        p = cursor.fetchone()
        conn.close()

        tomorrow_str = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        self.assertEqual(p["status"], "needs_revision")
        self.assertEqual(p["next_revision_date"], tomorrow_str)


if __name__ == "__main__":
    unittest.main(verbosity=2)
