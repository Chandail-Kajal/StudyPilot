import os
import sys
import json
import secrets
from datetime import datetime, timedelta

from database import init_db, get_db, hash_password

def seed_database():
    """
    Seeds realistic dummy data for StudyPilot AI.
    Repeatable and idempotent: cleans existing seed records before re-inserting.
    Includes:
    - 3 Demo users (different learner categories)
    - 3 Exams (competitive, recruitment, academic) with multiple exams for Demo User 1
    - Subject-Unit-Chapter-Topic hierarchy
    - Syllabus upload metadata (PDF, Excel, CSV)
    - Topic progress records (stages 0-5, last studied, revision due dates)
    - 36 realistic questions in question_bank across subjects & difficulty levels
    - Topic-wise, unit-wise, subject-wise, monthly, and full-syllabus mock tests
    - Test attempts (completed and in-progress) with answers and scores
    - Revision sessions and study plan tasks
    - Monthly assessments
    """
    init_db()
    conn = get_db()
    cursor = conn.cursor()

    now = datetime.now()
    now_str = now.isoformat()
    today_str = now.strftime("%Y-%m-%d")

    def d_offset(days: int) -> str:
        return (now + timedelta(days=days)).strftime("%Y-%m-%d")

    def dt_offset(days: int, hours: int = 0, minutes: int = 0) -> str:
        return (now + timedelta(days=days, hours=hours, minutes=minutes)).isoformat()

    print("Cleaning prior demo seed data to ensure idempotency...")
    # Clean users with demo emails
    demo_emails = [
        "ugc.student@studypilot.ai",
        "cgl.aspirant@studypilot.ai",
        "board.student@studypilot.ai"
    ]
    for email in demo_emails:
        cursor.execute("SELECT id FROM users WHERE email = ?", (email,))
        row = cursor.fetchone()
        if row:
            u_id = row["id"]
            cursor.execute("DELETE FROM users WHERE id = ?", (u_id,))

    conn.commit()

    print("Inserting 3 demo users...")
    demo_users = [
        {
            "id": "usr_demo_aarav",
            "name": "Aarav Sharma",
            "email": "ugc.student@studypilot.ai",
            "role": "competitive_exam",
            "sitting_capacity_mins": 45,
            "goal_mins": 240,
            "exam_name": "UGC NET Computer Science",
            "exam_date": d_offset(45)
        },
        {
            "id": "usr_demo_priya",
            "name": "Priya Patel",
            "email": "cgl.aspirant@studypilot.ai",
            "role": "competitive_exam",
            "sitting_capacity_mins": 60,
            "goal_mins": 300,
            "exam_name": "SSC CGL Examination",
            "exam_date": d_offset(35)
        },
        {
            "id": "usr_demo_rohan",
            "name": "Rohan Verma",
            "email": "board.student@studypilot.ai",
            "role": "student",
            "sitting_capacity_mins": 30,
            "goal_mins": 120,
            "exam_name": "Class 12 Board Examination",
            "exam_date": d_offset(21)
        }
    ]

    default_password = "Password123!"
    for u in demo_users:
        pwd_hash, salt = hash_password(default_password)
        cursor.execute("""
            INSERT INTO users (
                id, email, password_hash, salt, name, role,
                sitting_capacity_mins, goal_mins, settings_focus, settings_short, settings_long,
                exam_name, exam_date, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 25, 5, 15, ?, ?, ?, ?)
        """, (
            u["id"], u["email"], pwd_hash, salt, u["name"], u["role"],
            u["sitting_capacity_mins"], u["goal_mins"], u["exam_name"], u["exam_date"],
            dt_offset(-30), now_str
        ))

        # Generate persistent auth token for easy instant login
        tkn = f"token_{u['id']}_demo"
        cursor.execute("""
            INSERT INTO tokens (token, user_id, created_at, expires_at)
            VALUES (?, ?, ?, ?)
        """, (tkn, u["id"], now_str, dt_offset(365)))

    print("Inserting 4 demo exams across different educational levels...")
    demo_exams = [
        {
            "id": "exam_ugc_net",
            "user_id": "usr_demo_aarav",
            "exam_name": "UGC NET Computer Science",
            "exam_category": "competitive",
            "education_level": "competitive",
            "learning_preferences": json.dumps({"explanation_depth": "deep_rigorous", "visual_style": "flowcharts_formulas", "practice_intensity": "high"}),
            "exam_date": d_offset(45),
            "target_score": 180.0,
            "status": "active"
        },
        {
            "id": "exam_ssc_cgl_priya",
            "user_id": "usr_demo_priya",
            "exam_name": "SSC CGL Tier 1",
            "exam_category": "recruitment",
            "education_level": "competitive",
            "learning_preferences": json.dumps({"explanation_depth": "moderate_clear", "speed_focus": True}),
            "exam_date": d_offset(35),
            "target_score": 160.0,
            "status": "active"
        },
        {
            "id": "exam_ssc_cgl_aarav",
            "user_id": "usr_demo_aarav",
            "exam_name": "SSC CGL (Secondary Goal)",
            "exam_category": "recruitment",
            "education_level": "competitive",
            "learning_preferences": json.dumps({"explanation_depth": "moderate_clear"}),
            "exam_date": d_offset(60),
            "target_score": 150.0,
            "status": "active"
        },
        {
            "id": "exam_class_12_boards",
            "user_id": "usr_demo_rohan",
            "exam_name": "Class 12 Board Examination",
            "exam_category": "academic",
            "education_level": "class_11_12",
            "learning_preferences": json.dumps({"step_by_step_derivations": True, "analogies": True}),
            "exam_date": d_offset(21),
            "target_score": 95.0,
            "status": "active"
        },
        {
            "id": "exam_class_10_cbse",
            "user_id": "usr_demo_rohan",
            "exam_name": "Class 10 CBSE Science",
            "exam_category": "academic",
            "education_level": "class_9_10",
            "learning_preferences": json.dumps({"story_analogies": True, "simple_diagrams": True}),
            "exam_date": d_offset(40),
            "target_score": 90.0,
            "status": "active"
        }
    ]

    for e in demo_exams:
        cursor.execute("""
            INSERT INTO exams (
                id, user_id, exam_name, exam_category, education_level,
                learning_preferences, exam_date, target_score, status,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            e["id"], e["user_id"], e["exam_name"], e["exam_category"], e["education_level"],
            e.get("learning_preferences", "{}"), e["exam_date"], e["target_score"], e["status"],
            dt_offset(-20), now_str
        ))

    print("Inserting syllabus upload logs (PDF, Excel, CSV metadata)...")
    upload_metadata = [
        {
            "id": "upl_ugc_pdf",
            "exam_id": "exam_ugc_net",
            "user_id": "usr_demo_aarav",
            "file_name": "UGC_NET_ComputerScience_Official_Curriculum.pdf",
            "file_format": "pdf",
            "file_path": "storage/uploads/ugc_net_cs_official.pdf",
            "upload_status": "completed",
            "processing_status": "confirmed",
            "uploaded_at": dt_offset(-18),
            "processed_at": dt_offset(-18, 1)
        },
        {
            "id": "upl_cgl_xlsx",
            "exam_id": "exam_ssc_cgl_priya",
            "user_id": "usr_demo_priya",
            "file_name": "SSC_CGL_Complete_Syllabus_2026.xlsx",
            "file_format": "xlsx",
            "file_path": "storage/uploads/ssc_cgl_syllabus.xlsx",
            "upload_status": "completed",
            "processing_status": "confirmed",
            "uploaded_at": dt_offset(-14),
            "processed_at": dt_offset(-14, 1)
        },
        {
            "id": "upl_board_csv",
            "exam_id": "exam_class_12_boards",
            "user_id": "usr_demo_rohan",
            "file_name": "CBSE_Class12_Mathematics_Physics.csv",
            "file_format": "csv",
            "file_path": "storage/uploads/cbse_class12.csv",
            "upload_status": "completed",
            "processing_status": "confirmed",
            "uploaded_at": dt_offset(-10),
            "processed_at": dt_offset(-10, 1)
        }
    ]

    for up in upload_metadata:
        cursor.execute("""
            INSERT INTO syllabus_uploads (
                id, exam_id, user_id, file_name, file_format, file_path,
                upload_status, processing_status, uploaded_at, processed_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            up["id"], up["exam_id"], up["user_id"], up["file_name"], up["file_format"],
            up["file_path"], up["upload_status"], up["processing_status"],
            up["uploaded_at"], up["processed_at"]
        ))

    print("Inserting subjects, units, chapters, and topics hierarchy...")
    
    # ------------------ EXAM A: UGC NET Computer Science ------------------
    ugc_hierarchy = [
        {
            "id": "subj_ds",
            "name": "Data Structures & Algorithms",
            "color": "#3E7BE0",
            "desc": "Linear & Non-linear Data Structures, Complexity Analysis, Sorting & Searching",
            "units": [
                {
                    "id": "unit_ds_lin",
                    "name": "Linear Data Structures",
                    "chapters": [
                        {
                            "id": "chap_ds_seq",
                            "name": "Sequential & Linked Representations",
                            "topics": [
                                {"id": "top_arr", "name": "Arrays & Dynamic Memory Allocation", "diff": "easy", "mins": 45, "prio": "high", "stage": 4, "prog": 90},
                                {"id": "top_ll", "name": "Singly and Doubly Linked Lists", "diff": "medium", "mins": 60, "prio": "high", "stage": 3, "prog": 75},
                                {"id": "top_stk", "name": "Stacks & Polish Expression Evaluation", "diff": "medium", "mins": 45, "prio": "high", "stage": 4, "prog": 85},
                                {"id": "top_que", "name": "Queues, Circular Queues & Deques", "diff": "easy", "mins": 45, "prio": "medium", "stage": 2, "prog": 60}
                            ]
                        }
                    ]
                },
                {
                    "id": "unit_ds_nonlin",
                    "name": "Non-Linear Data Structures",
                    "chapters": [
                        {
                            "id": "chap_ds_hier",
                            "name": "Hierarchical & Graph Structures",
                            "topics": [
                                {"id": "top_tree", "name": "Binary Trees & Traversal Algorithms", "diff": "medium", "mins": 60, "prio": "high", "stage": 3, "prog": 70},
                                {"id": "top_bst", "name": "Binary Search Trees & AVL Balance", "diff": "hard", "mins": 75, "prio": "very_high", "stage": 1, "prog": 40},
                                {"id": "top_graph", "name": "Graphs: BFS, DFS & Shortest Path", "diff": "hard", "mins": 90, "prio": "very_high", "stage": 1, "prog": 35}
                            ]
                        }
                    ]
                }
            ]
        },
        {
            "id": "subj_os",
            "name": "Operating Systems",
            "color": "#1FA095",
            "desc": "Concurrency, Scheduling, Virtual Memory, Deadlock handling",
            "units": [
                {
                    "id": "unit_os_core",
                    "name": "Kernel Systems & Concurrency",
                    "chapters": [
                        {
                            "id": "chap_os_proc",
                            "name": "Process and CPU Management",
                            "topics": [
                                {"id": "top_pm", "name": "Process Management & Inter-Process Communication", "diff": "medium", "mins": 60, "prio": "high", "stage": 4, "prog": 85},
                                {"id": "top_cpu", "name": "CPU Scheduling Algorithms (FCFS, SJF, RR)", "diff": "medium", "mins": 60, "prio": "high", "stage": 5, "prog": 100},
                                {"id": "top_dl", "name": "Deadlocks: Banker Algorithm & Prevention", "diff": "hard", "mins": 75, "prio": "very_high", "stage": 2, "prog": 50},
                                {"id": "top_mm", "name": "Memory Management & Demand Paging", "diff": "hard", "mins": 90, "prio": "very_high", "stage": 2, "prog": 45}
                            ]
                        }
                    ]
                }
            ]
        },
        {
            "id": "subj_dbms",
            "name": "Database Management Systems",
            "color": "#D99211",
            "desc": "Relational Models, Normalization, SQL queries, ACID transactions",
            "units": [
                {
                    "id": "unit_db_rel",
                    "name": "Relational Design & Transactions",
                    "chapters": [
                        {
                            "id": "chap_db_core",
                            "name": "Data Models & Transactions",
                            "topics": [
                                {"id": "top_er", "name": "ER Model & Relational Mapping", "diff": "easy", "mins": 45, "prio": "medium", "stage": 4, "prog": 90},
                                {"id": "top_norm", "name": "Normalization: 1NF, 2NF, 3NF & BCNF", "diff": "hard", "mins": 90, "prio": "very_high", "stage": 3, "prog": 70},
                                {"id": "top_sql", "name": "SQL: Joins, Subqueries & Aggregations", "diff": "medium", "mins": 60, "prio": "high", "stage": 5, "prog": 95},
                                {"id": "top_trans", "name": "Transactions, ACID & Serializability", "diff": "hard", "mins": 75, "prio": "high", "stage": 1, "prog": 30}
                            ]
                        }
                    ]
                }
            ]
        }
    ]

    def insert_hierarchy(exam_id: str, user_id: str, subjects_list: list):
        for s_idx, subj in enumerate(subjects_list):
            cursor.execute("""
                INSERT INTO subjects (id, exam_id, subject_name, description, color, display_order, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (subj["id"], exam_id, subj["name"], subj.get("desc"), subj.get("color", "#3E7BE0"), s_idx, dt_offset(-20)))

            for u_idx, unit in enumerate(subj.get("units", [])):
                cursor.execute("""
                    INSERT INTO syllabus_units (id, subject_id, unit_name, display_order)
                    VALUES (?, ?, ?, ?)
                """, (unit["id"], subj["id"], unit["name"], u_idx))

                for c_idx, chap in enumerate(unit.get("chapters", [])):
                    cursor.execute("""
                        INSERT INTO chapters (id, unit_id, chapter_name, display_order)
                        VALUES (?, ?, ?, ?)
                    """, (chap["id"], unit["id"], chap["name"], c_idx))

                    for t_idx, top in enumerate(chap.get("topics", [])):
                        cursor.execute("""
                            INSERT INTO topics (
                                id, subject_id, unit_id, chapter_id, topic_name,
                                subtopic_name, difficulty, estimated_minutes, importance,
                                display_order, created_at, updated_at
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """, (
                            top["id"], subj["id"], unit["id"], chap["id"], top["name"],
                            top.get("subtopic"), top.get("diff", "medium"), top.get("mins", 45),
                            top.get("prio", "medium"), t_idx, dt_offset(-20), now_str
                        ))

                        # Insert topic_progress
                        stg = top.get("stage", 0)
                        prog = top.get("prog", 0)
                        status_str = "mastered" if stg >= 5 else ("reviewing" if stg >= 2 else ("learning" if stg >= 1 else "not_started"))
                        rev_due = d_offset(2 if stg in [1, 2] else (5 if stg in [3, 4] else 14))

                        cursor.execute("""
                            INSERT INTO topic_progress (
                                id, user_id, topic_id, status, completion_percentage,
                                stage, next_revision_date, last_studied_at, last_revised_at, updated_at
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """, (
                            f"prog_{user_id}_{top['id']}", user_id, top["id"], status_str,
                            prog, stg, rev_due, dt_offset(-stg), dt_offset(-stg), now_str
                        ))

    insert_hierarchy("exam_ugc_net", "usr_demo_aarav", ugc_hierarchy)

    # ------------------ EXAM B: SSC CGL ------------------
    ssc_hierarchy = [
        {
            "id": "subj_cgl_quant",
            "name": "Quantitative Aptitude",
            "color": "#D04F73",
            "desc": "Arithmetic, Advanced Algebra, Trigonometry and Mensuration",
            "units": [
                {
                    "id": "unit_cgl_arith",
                    "name": "Commercial Arithmetic",
                    "chapters": [
                        {
                            "id": "chap_cgl_num",
                            "name": "Percentages & Ratios",
                            "topics": [
                                {"id": "top_perc", "name": "Percentages, Profit & Loss", "diff": "medium", "mins": 60, "prio": "high", "stage": 3, "prog": 70},
                                {"id": "top_ratio", "name": "Ratio, Proportion & Partnerships", "diff": "easy", "mins": 45, "prio": "medium", "stage": 4, "prog": 80},
                                {"id": "top_si_ci", "name": "Simple and Compound Interest Tricks", "diff": "hard", "mins": 60, "prio": "high", "stage": 2, "prog": 50}
                            ]
                        }
                    ]
                },
                {
                    "id": "unit_cgl_geom",
                    "name": "Geometry & Mensuration",
                    "chapters": [
                        {
                            "id": "chap_cgl_shapes",
                            "name": "2D and 3D Geometry",
                            "topics": [
                                {"id": "top_tri", "name": "Triangles: Congruency & Theorems", "diff": "hard", "mins": 75, "prio": "very_high", "stage": 2, "prog": 45},
                                {"id": "top_circ", "name": "Circles: Chords, Tangents & Secants", "diff": "medium", "mins": 60, "prio": "high", "stage": 3, "prog": 65}
                            ]
                        }
                    ]
                }
            ]
        },
        {
            "id": "subj_cgl_reasoning",
            "name": "General Intelligence & Reasoning",
            "color": "#7C62D9",
            "desc": "Analogies, Syllogisms, Coding-Decoding, Non-verbal series",
            "units": [
                {
                    "id": "unit_cgl_verbal",
                    "name": "Verbal Reasoning",
                    "chapters": [
                        {
                            "id": "chap_cgl_logic",
                            "name": "Logical Deduction",
                            "topics": [
                                {"id": "top_syll", "name": "Syllogisms and Venn Diagrams", "diff": "medium", "mins": 45, "prio": "high", "stage": 4, "prog": 85},
                                {"id": "top_blood", "name": "Blood Relations & Coded Hierarchy", "diff": "easy", "mins": 40, "prio": "medium", "stage": 5, "prog": 95},
                                {"id": "top_series", "name": "Number and Alphabetical Series", "diff": "medium", "mins": 45, "prio": "high", "stage": 3, "prog": 75}
                            ]
                        }
                    ]
                }
            ]
        },
        {
            "id": "subj_cgl_eng",
            "name": "English Language & Comprehension",
            "color": "#4C9A2A",
            "desc": "Grammar, Error Spotting, Vocab, Reading Comprehension",
            "units": [
                {
                    "id": "unit_cgl_grammar",
                    "name": "Applied Grammar",
                    "chapters": [
                        {
                            "id": "chap_cgl_rules",
                            "name": "Sentence Correction & Clauses",
                            "topics": [
                                {"id": "top_err", "name": "Spotting Errors: Subject-Verb Agreement", "diff": "medium", "mins": 45, "prio": "high", "stage": 4, "prog": 80},
                                {"id": "top_vocab", "name": "One-Word Substitution & Idioms", "diff": "easy", "mins": 30, "prio": "medium", "stage": 3, "prog": 60},
                                {"id": "top_rc", "name": "Reading Comprehension & Cloze Test", "diff": "medium", "mins": 50, "prio": "high", "stage": 2, "prog": 50}
                            ]
                        }
                    ]
                }
            ]
        }
    ]

    insert_hierarchy("exam_ssc_cgl_priya", "usr_demo_priya", ssc_hierarchy)

    # ------------------ EXAM C: Class 12 Boards ------------------
    board_hierarchy = [
        {
            "id": "subj_board_math",
            "name": "Mathematics",
            "color": "#3E7BE0",
            "desc": "Calculus, Linear Programming, 3D Geometry and Matrices",
            "units": [
                {
                    "id": "unit_board_calc",
                    "name": "Differential & Integral Calculus",
                    "chapters": [
                        {
                            "id": "chap_board_limits",
                            "name": "Derivatives & Applications",
                            "topics": [
                                {"id": "top_diff", "name": "Continuity, Differentiability & Chain Rule", "diff": "medium", "mins": 60, "prio": "high", "stage": 4, "prog": 85},
                                {"id": "top_aod", "name": "Applications of Derivatives: Maxima & Minima", "diff": "hard", "mins": 75, "prio": "very_high", "stage": 3, "prog": 70},
                                {"id": "top_integ", "name": "Definite Integrals & Area Under Curves", "diff": "hard", "mins": 90, "prio": "very_high", "stage": 2, "prog": 50}
                            ]
                        }
                    ]
                }
            ]
        },
        {
            "id": "subj_board_phy",
            "name": "Physics",
            "color": "#E06A3B",
            "desc": "Electromagnetism, Wave Optics, Dual Nature and Nuclei",
            "units": [
                {
                    "id": "unit_board_em",
                    "name": "Electromagnetism & Optics",
                    "chapters": [
                        {
                            "id": "chap_board_fields",
                            "name": "Electric Charges & Fields",
                            "topics": [
                                {"id": "top_gauss", "name": "Gauss Law & Electric Dipoles", "diff": "medium", "mins": 60, "prio": "high", "stage": 3, "prog": 75},
                                {"id": "top_ray", "name": "Refraction, Lens Formula & Telescopes", "diff": "easy", "mins": 45, "prio": "medium", "stage": 4, "prog": 85},
                                {"id": "top_wave", "name": "Wave Optics: Young Double Slit Experiment", "diff": "hard", "mins": 75, "prio": "high", "stage": 2, "prog": 40}
                            ]
                        }
                    ]
                }
            ]
        },
        {
            "id": "subj_board_eng",
            "name": "English Core",
            "color": "#26B487",
            "desc": "Flamingo & Vistas Literature, Notice & Letter Writing",
            "units": [
                {
                    "id": "unit_board_lit",
                    "name": "Literature & Advanced Writing",
                    "chapters": [
                        {
                            "id": "chap_board_prose",
                            "name": "Core Prose & Analysis",
                            "topics": [
                                {"id": "top_last_lesson", "name": "The Last Lesson & Lost Spring Analysis", "diff": "easy", "mins": 35, "prio": "medium", "stage": 5, "prog": 95},
                                {"id": "top_letter", "name": "Formal Letter to Editor & Job Application", "diff": "easy", "mins": 30, "prio": "high", "stage": 4, "prog": 90}
                            ]
                        }
                    ]
                }
            ]
        }
    ]

    insert_hierarchy("exam_class_12_boards", "usr_demo_rohan", board_hierarchy)

    print("Inserting 36 realistic questions into question_bank...")
    questions = [
        # Data Structures & Algorithms
        {
            "id": "q_ds_1", "exam_id": "exam_ugc_net", "subject_id": "subj_ds", "topic_id": "top_arr",
            "text": "What is the worst-case time complexity of accessing an arbitrary element in an array of size N using its zero-based index?",
            "options": ["O(1)", "O(log N)", "O(N)", "O(N log N)"], "answer": "0",
            "explanation": "Arrays provide direct address arithmetic access (base_address + index * element_size), so element retrieval by index is strictly constant time O(1).",
            "diff": "easy", "marks": 1.0, "neg": 0.25
        },
        {
            "id": "q_ds_2", "exam_id": "exam_ugc_net", "subject_id": "subj_ds", "topic_id": "top_stk",
            "text": "Which data structure is primarily used by modern compilers to parse and evaluate arithmetic infix and postfix expressions?",
            "options": ["Queue", "Stack", "Binary Heap", "Hash Table"], "answer": "1",
            "explanation": "Stacks operate on Last-In First-Out (LIFO) order, which matches parenthesis balancing and operator precedence evaluation.",
            "diff": "easy", "marks": 1.0, "neg": 0.25
        },
        {
            "id": "q_ds_3", "exam_id": "exam_ugc_net", "subject_id": "subj_ds", "topic_id": "top_bst",
            "text": "In a degenerate (skewed) Binary Search Tree containing N nodes, what is the worst-case time complexity of searching for a key?",
            "options": ["O(1)", "O(log N)", "O(N)", "O(N^2)"], "answer": "2",
            "explanation": "When keys are inserted in strictly sorted order, a standard BST becomes an equivalent linear linked list, yielding O(N) search depth.",
            "diff": "medium", "marks": 2.0, "neg": 0.5
        },
        {
            "id": "q_ds_4", "exam_id": "exam_ugc_net", "subject_id": "subj_ds", "topic_id": "top_graph",
            "text": "Dijkstra's shortest path algorithm fails or produces incorrect results when applied to graphs with:",
            "options": ["Cycles", "Directed edges", "Negative edge weights", "Disconnected components"], "answer": "2",
            "explanation": "Dijkstra algorithm relies on the greedy assumption that visited paths cannot get shorter; negative weights invalidate this principle (requiring Bellman-Ford).",
            "diff": "hard", "marks": 2.0, "neg": 0.5
        },
        {
            "id": "q_ds_5", "exam_id": "exam_ugc_net", "subject_id": "subj_ds", "topic_id": "top_tree",
            "text": "Which tree traversal of a valid Binary Search Tree (BST) produces keys in ascending strictly sorted order?",
            "options": ["Preorder", "Inorder", "Postorder", "Level-order"], "answer": "1",
            "explanation": "Inorder traversal visits (Left Subtree, Root, Right Subtree), which always outputs keys in ascending sorted order for a BST.",
            "diff": "easy", "marks": 1.0, "neg": 0.25
        },
        {
            "id": "q_ds_6", "exam_id": "exam_ugc_net", "subject_id": "subj_ds", "topic_id": "top_ll",
            "text": "What is the minimum number of pointer modifications required to insert a new node immediately after a given node in a Singly Linked List?",
            "options": ["1", "2", "3", "4"], "answer": "1",
            "explanation": "Two assignments: new_node->next = prev_node->next; followed by prev_node->next = new_node.",
            "diff": "easy", "marks": 1.0, "neg": 0.25
        },

        # Operating Systems
        {
            "id": "q_os_1", "exam_id": "exam_ugc_net", "subject_id": "subj_os", "topic_id": "top_cpu",
            "text": "Which CPU scheduling algorithm is non-preemptive and completely susceptible to the 'convoy effect'?",
            "options": ["Round Robin", "First-Come First-Served (FCFS)", "Shortest Remaining Time First", "Multilevel Feedback Queue"], "answer": "1",
            "explanation": "Under FCFS, when a long CPU-bound process captures the processor, short I/O bound jobs are stuck waiting in line, known as the convoy effect.",
            "diff": "easy", "marks": 1.0, "neg": 0.25
        },
        {
            "id": "q_os_2", "exam_id": "exam_ugc_net", "subject_id": "subj_os", "topic_id": "top_dl",
            "text": "Which of the following is NOT one of Coffman's four necessary conditions for deadlock occurrence?",
            "options": ["Mutual Exclusion", "Hold and Wait", "No Preemption", "Paging Segmentation"], "answer": "3",
            "explanation": "The 4 Coffman conditions are Mutual Exclusion, Hold & Wait, No Preemption, and Circular Wait. Paging is a memory management technique.",
            "diff": "medium", "marks": 1.5, "neg": 0.35
        },
        {
            "id": "q_os_3", "exam_id": "exam_ugc_net", "subject_id": "subj_os", "topic_id": "top_mm",
            "text": "Belady's Anomaly demonstrates that increasing the number of page frames can result in more page faults in which algorithm?",
            "options": ["LRU (Least Recently Used)", "FIFO (First In First Out)", "Optimal Page Replacement", "LFU (Least Frequently Used)"], "answer": "1",
            "explanation": "FIFO page replacement does not belong to the class of stack algorithms and thus suffers from Belady's Anomaly.",
            "diff": "hard", "marks": 2.0, "neg": 0.5
        },
        {
            "id": "q_os_4", "exam_id": "exam_ugc_net", "subject_id": "subj_os", "topic_id": "top_pm",
            "text": "Which system call in UNIX-like operating systems is executed by an existing process to create an exact duplicate child process?",
            "options": ["exec()", "fork()", "pthread_create()", "clone()"], "answer": "1",
            "explanation": "fork() creates an almost identical copy of the calling process sharing copy-on-write memory segments.",
            "diff": "easy", "marks": 1.0, "neg": 0.25
        },

        # Database Management Systems
        {
            "id": "q_db_1", "exam_id": "exam_ugc_net", "subject_id": "subj_dbms", "topic_id": "top_norm",
            "text": "A relational schema is in Boyce-Codd Normal Form (BCNF) if and only if for every non-trivial functional dependency X -> Y:",
            "options": ["Y is a prime attribute", "X is a superkey", "X is part of candidate key", "Y is a subset of X"], "answer": "1",
            "explanation": "BCNF requires that the determinant X must strictly be a candidate key or superkey in every non-trivial dependency.",
            "diff": "hard", "marks": 2.0, "neg": 0.5
        },
        {
            "id": "q_db_2", "exam_id": "exam_ugc_net", "subject_id": "subj_dbms", "topic_id": "top_trans",
            "text": "In transaction management, the 'I' in ACID properties stands for Isolation, which guarantees that:",
            "options": ["Transactions are saved to stable magnetic storage", "Concurrent transactions execute without interfering with one another", "Changes are either all applied or completely aborted", "Database integrity constraints remain preserved"], "answer": "1",
            "explanation": "Isolation ensures that uncommitted side-effects of concurrent transactions are invisible to other transactions until commit.",
            "diff": "easy", "marks": 1.0, "neg": 0.25
        },
        {
            "id": "q_db_3", "exam_id": "exam_ugc_net", "subject_id": "subj_dbms", "topic_id": "top_sql",
            "text": "Which SQL clause is used to filter aggregated grouped records created by the GROUP BY statement?",
            "options": ["WHERE", "HAVING", "LIMIT", "ORDER BY"], "answer": "1",
            "explanation": "WHERE filters rows before grouping; HAVING filters aggregated groups after the GROUP BY operation.",
            "diff": "easy", "marks": 1.0, "neg": 0.25
        },

        # SSC CGL: Quantitative Aptitude
        {
            "id": "q_cgl_1", "exam_id": "exam_ssc_cgl_priya", "subject_id": "subj_cgl_quant", "topic_id": "top_perc",
            "text": "An article is sold for ₹840 at a gain of 20%. What was the cost price of the article?",
            "options": ["₹680", "₹700", "₹720", "₹750"], "answer": "1",
            "explanation": "SP = CP * 1.20 => CP = 840 / 1.2 = ₹700.",
            "diff": "easy", "marks": 2.0, "neg": 0.5
        },
        {
            "id": "q_cgl_2", "exam_id": "exam_ssc_cgl_priya", "subject_id": "subj_cgl_quant", "topic_id": "top_si_ci",
            "text": "The difference between Compound Interest and Simple Interest on a sum of ₹10,000 for 2 years at 10% per annum is:",
            "options": ["₹50", "₹100", "₹150", "₹200"], "answer": "1",
            "explanation": "For 2 years: Diff = P * (R/100)^2 = 10,000 * (10/100)^2 = 10,000 * 0.01 = ₹100.",
            "diff": "medium", "marks": 2.0, "neg": 0.5
        },
        {
            "id": "q_cgl_3", "exam_id": "exam_ssc_cgl_priya", "subject_id": "subj_cgl_quant", "topic_id": "top_tri",
            "text": "In a right-angled triangle, if the two legs are 9 cm and 12 cm, what is the length of the hypotenuse?",
            "options": ["13 cm", "14 cm", "15 cm", "16 cm"], "answer": "2",
            "explanation": "By Pythagoras theorem: Hypotenuse = sqrt(9^2 + 12^2) = sqrt(81 + 144) = sqrt(225) = 15 cm.",
            "diff": "easy", "marks": 2.0, "neg": 0.5
        },

        # SSC CGL: Reasoning
        {
            "id": "q_cgl_4", "exam_id": "exam_ssc_cgl_priya", "subject_id": "subj_cgl_reasoning", "topic_id": "top_series",
            "text": "Find the missing number in the sequence: 4, 9, 19, 39, 79, ?",
            "options": ["119", "139", "159", "179"], "answer": "2",
            "explanation": "Pattern is (x * 2) + 1: 4*2+1=9, 9*2+1=19, 19*2+1=39, 39*2+1=79, 79*2+1=159.",
            "diff": "easy", "marks": 2.0, "neg": 0.5
        },
        {
            "id": "q_cgl_5", "exam_id": "exam_ssc_cgl_priya", "subject_id": "subj_cgl_reasoning", "topic_id": "top_syll",
            "text": "Statements: All cats are animals. All animals are mammals. Conclusion: All cats are mammals.",
            "options": ["Conclusion follows", "Conclusion does not follow", "Either conclusion or converse follows", "Data is insufficient"], "answer": "0",
            "explanation": "Universal affirmative chain: A subset B and B subset C => A subset C (All cats are mammals).",
            "diff": "easy", "marks": 2.0, "neg": 0.5
        },

        # SSC CGL: English
        {
            "id": "q_cgl_6", "exam_id": "exam_ssc_cgl_priya", "subject_id": "subj_cgl_eng", "topic_id": "top_err",
            "text": "Identify the error in: 'Neither the teacher nor the students was present in the auditorium.'",
            "options": ["Neither the teacher", "nor the students", "was present", "in the auditorium"], "answer": "2",
            "explanation": "With 'neither... nor', the verb agrees with the closer subject ('the students' is plural, so 'were present' is correct).",
            "diff": "medium", "marks": 2.0, "neg": 0.5
        },
        {
            "id": "q_cgl_7", "exam_id": "exam_ssc_cgl_priya", "subject_id": "subj_cgl_eng", "topic_id": "top_vocab",
            "text": "What is the one-word substitution for 'A person who loves or collects books'?",
            "options": ["Bibliophile", "Philatelist", "Polyglot", "Numismatist"], "answer": "0",
            "explanation": "A bibliophile is an admirer or collector of books.",
            "diff": "easy", "marks": 2.0, "neg": 0.5
        },

        # Class 12 Boards: Mathematics
        {
            "id": "q_brd_1", "exam_id": "exam_class_12_boards", "subject_id": "subj_board_math", "topic_id": "top_diff",
            "text": "What is the derivative of f(x) = sin(x^2) with respect to x?",
            "options": ["cos(x^2)", "2x cos(x^2)", "x^2 cos(x)", "2 sin(x) cos(x)"], "answer": "1",
            "explanation": "By Chain Rule: d/dx[sin(u)] = cos(u) * du/dx = cos(x^2) * 2x = 2x cos(x^2).",
            "diff": "easy", "marks": 2.0, "neg": 0.0
        },
        {
            "id": "q_brd_2", "exam_id": "exam_class_12_boards", "subject_id": "subj_board_math", "topic_id": "top_integ",
            "text": "The definite integral of x dx from x = 0 to x = 4 evaluates to:",
            "options": ["4", "8", "16", "2"], "answer": "1",
            "explanation": "Integral is [x^2 / 2] from 0 to 4 = (16 / 2) - 0 = 8.",
            "diff": "easy", "marks": 2.0, "neg": 0.0
        },
        {
            "id": "q_brd_3", "exam_id": "exam_class_12_boards", "subject_id": "subj_board_math", "topic_id": "top_aod",
            "text": "At a local extremum (maximum or minimum) of a smooth twice-differentiable function f(x), the first derivative f'(x) equals:",
            "options": ["1", "-1", "0", "undefined"], "answer": "2",
            "explanation": "Stationary points occur where the tangent is horizontal, hence f'(x) = 0.",
            "diff": "easy", "marks": 2.0, "neg": 0.0
        },

        # Class 12 Boards: Physics
        {
            "id": "q_brd_4", "exam_id": "exam_class_12_boards", "subject_id": "subj_board_phy", "topic_id": "top_gauss",
            "text": "According to Gauss's Law, the total electric flux through a closed Gaussian surface enclosing a net charge Q in vacuum is:",
            "options": ["Q * epsilon_0", "Q / epsilon_0", "Q^2 / (2 * epsilon_0)", "Zero always"], "answer": "1",
            "explanation": "Phi_E = oint E . dA = Q_enclosed / epsilon_0.",
            "diff": "easy", "marks": 2.0, "neg": 0.0
        },
        {
            "id": "q_brd_5", "exam_id": "exam_class_12_boards", "subject_id": "subj_board_phy", "topic_id": "top_ray",
            "text": "What is the focal length of a concave mirror having a radius of curvature of 30 cm?",
            "options": ["15 cm", "-15 cm", "60 cm", "-60 cm"], "answer": "1",
            "explanation": "f = R / 2. By Cartesian sign convention, concave mirrors have negative focal length: f = -15 cm.",
            "diff": "easy", "marks": 2.0, "neg": 0.0
        },
        {
            "id": "q_brd_6", "exam_id": "exam_class_12_boards", "subject_id": "subj_board_phy", "topic_id": "top_wave",
            "text": "In Young's Double Slit Experiment, if the distance between slits is doubled while distance to screen is unchanged, fringe width:",
            "options": ["Doubles", "Halves", "Quadruples", "Remains same"], "answer": "1",
            "explanation": "Fringe width beta = (lambda * D) / d. Since d is in denominator, doubling d halves beta.",
            "diff": "medium", "marks": 2.0, "neg": 0.0
        },

        # Class 12 Boards: English
        {
            "id": "q_brd_7", "exam_id": "exam_class_12_boards", "subject_id": "subj_board_eng", "topic_id": "top_last_lesson",
            "text": "In Alphonse Daudet's story 'The Last Lesson', what was written on the blackboard by M. Hamel at the conclusion of class?",
            "options": ["Liberté, Égalité", "Vive La France!", "Adieu Alsace", "Courage et Espoir"], "answer": "1",
            "explanation": "M. Hamel wrote 'Vive La France!' in large letters across the board.",
            "diff": "easy", "marks": 1.0, "neg": 0.0
        }
    ]

    for q in questions:
        cursor.execute("""
            INSERT INTO question_bank (
                id, exam_id, subject_id, topic_id, question_text,
                question_type, options, correct_answer, explanation,
                difficulty, marks, negative_marks, source_type, verified_status, created_at
            ) VALUES (?, ?, ?, ?, ?, 'single_choice', ?, ?, ?, ?, ?, ?, 'demo_seed', 'verified', ?)
        """, (
            q["id"], q["exam_id"], q["subject_id"], q["topic_id"], q["text"],
            json.dumps(q["options"]), q["answer"], q["explanation"],
            q["diff"], q["marks"], q["neg"], dt_offset(-20)
        ))

    print("Inserting realistic mock tests across scopes (topic, unit, subject, monthly, full syllabus)...")
    mock_tests_data = [
        # Full Syllabus Mock
        {
            "id": "test_ugc_full_1",
            "user_id": "usr_demo_aarav",
            "exam_id": "exam_ugc_net",
            "name": "UGC NET CS Full Syllabus Grand Mock Test 1",
            "type": "full_syllabus",
            "subject_id": None,
            "duration": 60,
            "questions_count": 6,
            "topics": ["top_arr", "top_stk", "top_bst", "top_cpu", "top_dl", "top_norm"]
        },
        # Subject-wise Mock
        {
            "id": "test_ugc_subj_os",
            "user_id": "usr_demo_aarav",
            "exam_id": "exam_ugc_net",
            "name": "Operating Systems Subject Specialist Test",
            "type": "subject_wise",
            "subject_id": "subj_os",
            "duration": 30,
            "questions_count": 4,
            "topics": ["top_pm", "top_cpu", "top_dl", "top_mm"]
        },
        # Topic-wise Drill
        {
            "id": "test_ugc_top_bst",
            "user_id": "usr_demo_aarav",
            "exam_id": "exam_ugc_net",
            "name": "Binary Search Trees & Non-Linear Drill",
            "type": "topic_wise",
            "subject_id": "subj_ds",
            "duration": 15,
            "questions_count": 2,
            "topics": ["top_bst", "top_tree"]
        },
        # Monthly Assessment
        {
            "id": "test_ugc_monthly_oct",
            "user_id": "usr_demo_aarav",
            "exam_id": "exam_ugc_net",
            "name": "October Monthly Benchmarking Assessment",
            "type": "monthly",
            "subject_id": None,
            "duration": 60,
            "questions_count": 5,
            "topics": ["top_arr", "top_stk", "top_cpu", "top_norm", "top_sql"]
        },
        # SSC CGL Full Test
        {
            "id": "test_cgl_full_1",
            "user_id": "usr_demo_priya",
            "exam_id": "exam_ssc_cgl_priya",
            "name": "SSC CGL Tier 1 All-India Mock Paper 1",
            "type": "full_syllabus",
            "subject_id": None,
            "duration": 60,
            "questions_count": 6,
            "topics": ["top_perc", "top_si_ci", "top_tri", "top_series", "top_syll", "top_err"]
        },
        # Board Exam Full Test
        {
            "id": "test_board_full_1",
            "user_id": "usr_demo_rohan",
            "exam_id": "exam_class_12_boards",
            "name": "Class 12 Pre-Board Model Exam",
            "type": "full_syllabus",
            "subject_id": None,
            "duration": 60,
            "questions_count": 5,
            "topics": ["top_diff", "top_integ", "top_gauss", "top_ray", "top_last_lesson"]
        }
    ]

    for mt in mock_tests_data:
        cursor.execute("""
            INSERT INTO mock_tests (
                id, user_id, exam_id, test_name, test_type, subject_id,
                duration_minutes, total_questions, total_marks, negative_marking_enabled, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
        """, (
            mt["id"], mt["user_id"], mt["exam_id"], mt["name"], mt["type"],
            mt["subject_id"], mt["duration"], mt["questions_count"], float(mt["questions_count"] * 2),
            dt_offset(-12)
        ))

        for tid in mt["topics"]:
            cursor.execute("""
                INSERT INTO mock_test_topics (id, mock_test_id, topic_id)
                VALUES (?, ?, ?)
            """, (f"mtt_{mt['id']}_{tid}", mt["id"], tid))

    print("Inserting test attempts (completed and in-progress) with answer sheets...")
    # Attempt 1: Aarav completed UGC NET Full Mock 1
    cursor.execute("""
        INSERT INTO test_attempts (
            id, user_id, mock_test_id, started_at, submitted_at,
            score, correct_count, incorrect_count, unanswered_count, time_taken_seconds, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed')
    """, (
        "att_aarav_ugc_1", "usr_demo_aarav", "test_ugc_full_1",
        dt_offset(-3, 10), dt_offset(-3, 10, 48),
        8.5, 5, 1, 0, 2880
    ))

    # Answers for Attempt 1
    sample_answers = [
        {"att": "att_aarav_ugc_1", "qid": "q_ds_1", "ans": "0", "ok": 1, "m": 1.0, "sec": 25},
        {"att": "att_aarav_ugc_1", "qid": "q_ds_2", "ans": "1", "ok": 1, "m": 1.0, "sec": 30},
        {"att": "att_aarav_ugc_1", "qid": "q_ds_3", "ans": "2", "ok": 1, "m": 2.0, "sec": 45},
        {"att": "att_aarav_ugc_1", "qid": "q_os_1", "ans": "1", "ok": 1, "m": 1.0, "sec": 35},
        {"att": "att_aarav_ugc_1", "qid": "q_os_2", "ans": "0", "ok": 0, "m": -0.35, "sec": 50},  # incorrect
        {"att": "att_aarav_ugc_1", "qid": "q_db_1", "ans": "1", "ok": 1, "m": 2.0, "sec": 70}
    ]
    for sa in sample_answers:
        cursor.execute("""
            INSERT INTO test_attempt_answers (
                id, attempt_id, question_id, selected_answer, is_correct, marks_awarded, time_taken_seconds
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            f"ans_{sa['att']}_{sa['qid']}", sa["att"], sa["qid"], sa["ans"], sa["ok"], sa["m"], sa["sec"]
        ))

    # Attempt 2: Priya completed SSC CGL Full Test
    cursor.execute("""
        INSERT INTO test_attempts (
            id, user_id, mock_test_id, started_at, submitted_at,
            score, correct_count, incorrect_count, unanswered_count, time_taken_seconds, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed')
    """, (
        "att_priya_cgl_1", "usr_demo_priya", "test_cgl_full_1",
        dt_offset(-2, 14), dt_offset(-2, 14, 52),
        10.0, 5, 1, 0, 3120
    ))

    # Attempt 3: In-progress test for Aarav
    cursor.execute("""
        INSERT INTO test_attempts (
            id, user_id, mock_test_id, started_at, submitted_at,
            score, correct_count, incorrect_count, unanswered_count, time_taken_seconds, status
        ) VALUES (?, ?, ?, ?, NULL, NULL, 0, 0, 4, 300, 'in_progress')
    """, (
        "att_aarav_os_live", "usr_demo_aarav", "test_ugc_subj_os",
        dt_offset(0, -1)
    ))

    print("Inserting revision sessions...")
    rev_sessions = [
        {
            "id": "rev_ugc_deadlocks",
            "user_id": "usr_demo_aarav",
            "exam_id": "exam_ugc_net",
            "mock_id": "test_ugc_subj_os",
            "topic_id": "top_dl",
            "score": 85.0,
            "status": "completed",
            "topics": ["top_dl", "top_mm"]
        },
        {
            "id": "rev_cgl_quant",
            "user_id": "usr_demo_priya",
            "exam_id": "exam_ssc_cgl_priya",
            "mock_id": "test_cgl_full_1",
            "topic_id": "top_si_ci",
            "score": 90.0,
            "status": "completed",
            "topics": ["top_si_ci", "top_perc"]
        }
    ]

    for rs in rev_sessions:
        cursor.execute("""
            INSERT INTO revision_sessions (
                id, user_id, exam_id, mock_test_id, trigger_topic_id, started_at, completed_at, score, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            rs["id"], rs["user_id"], rs["exam_id"], rs["mock_id"], rs["topic_id"],
            dt_offset(-4, 9), dt_offset(-4, 9, 30), rs["score"], rs["status"]
        ))
        for t in rs["topics"]:
            cursor.execute("""
                INSERT INTO revision_session_topics (id, revision_session_id, topic_id)
                VALUES (?, ?, ?)
            """, (f"rst_{rs['id']}_{t}", rs["id"], t))

    print("Inserting study plans and tasks...")
    study_plans = [
        {
            "id": "sp_ugc_aarav",
            "user_id": "usr_demo_aarav",
            "exam_id": "exam_ugc_net",
            "name": "Comprehensive UGC NET CS Sprint",
            "start_date": d_offset(-15),
            "end_date": d_offset(45),
            "mins": 240,
            "tasks": [
                {"top": "top_arr", "days": -2, "mins": 45, "prio": "high", "st": "completed"},
                {"top": "top_stk", "days": -1, "mins": 45, "prio": "high", "st": "completed"},
                {"top": "top_cpu", "days": 0, "mins": 60, "prio": "high", "st": "pending"},
                {"top": "top_bst", "days": 0, "mins": 60, "prio": "high", "st": "pending"},
                {"top": "top_norm", "days": 1, "mins": 60, "prio": "very_high", "st": "pending"},
                {"top": "top_dl", "days": 2, "mins": 45, "prio": "high", "st": "pending"}
            ]
        },
        {
            "id": "sp_cgl_priya",
            "user_id": "usr_demo_priya",
            "exam_id": "exam_ssc_cgl_priya",
            "name": "SSC CGL Mission 160+",
            "start_date": d_offset(-10),
            "end_date": d_offset(35),
            "mins": 300,
            "tasks": [
                {"top": "top_perc", "days": 0, "mins": 60, "prio": "high", "st": "pending"},
                {"top": "top_syll", "days": 0, "mins": 45, "prio": "high", "st": "pending"},
                {"top": "top_tri", "days": 1, "mins": 75, "prio": "high", "st": "pending"}
            ]
        }
    ]

    for sp in study_plans:
        cursor.execute("""
            INSERT INTO study_plans (
                id, user_id, exam_id, plan_name, start_date, end_date, daily_study_minutes, status, created_at,
                available_days, sitting_times, buffer_days, learning_pace
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?)
        """, (
            sp["id"], sp["user_id"], sp["exam_id"], sp["name"], sp["start_date"],
            sp["end_date"], sp["mins"], dt_offset(-15),
            json.dumps(["mon", "tue", "wed", "thu", "fri", "sat"]),
            json.dumps(["morning", "evening"]),
            5,
            "normal"
        ))

        # Add 2 intentionally missed tasks for Aarav to showcase Smart Recovery Planner
        if sp["id"] == "sp_ugc_aarav":
            sp["tasks"].append({"top": "top_norm", "days": -2, "mins": 60, "prio": "high", "st": "pending", "act": "learn_concept", "missed": 1})
            sp["tasks"].append({"top": "top_dl", "days": -1, "mins": 45, "prio": "high", "st": "pending", "act": "practice_questions", "missed": 1})

        for t_idx, tk in enumerate(sp["tasks"]):
            is_done = tk["st"] == "completed"
            act_type = tk.get("act", "learn_concept")
            is_missed = tk.get("missed", 0)
            cursor.execute("""
                INSERT INTO study_plan_tasks (
                    id, study_plan_id, topic_id, scheduled_date, estimated_minutes, priority, status, completed_at,
                    activity_type, missed, original_date, notes
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                f"spt_{sp['id']}_{t_idx}", sp["id"], tk["top"], d_offset(tk["days"]),
                tk["mins"], tk["prio"], tk["st"], (dt_offset(tk["days"], 2) if is_done else None),
                act_type, is_missed, d_offset(tk["days"]),
                "Missed study session due to travel" if is_missed else "Regular preparation task"
            ))

    print("Inserting Previous-Year Question Papers (PYPs) & questions...")
    pyp_records = [
        {
            "id": "pyp_ugc_2024",
            "exam_id": "exam_ugc_net",
            "exam_name": "UGC NET Computer Science",
            "year": 2024,
            "paper_name": "UGC NET June 2024 Paper 2 (Official Verified)",
            "paper_type": "official",
            "subject_name": "Computer Science & Applications",
            "duration_minutes": 120,
            "total_questions": 50,
            "total_marks": 100.0,
            "source": "National Testing Agency (NTA) Official Archive",
            "verification_status": "verified"
        },
        {
            "id": "pyp_ugc_2023",
            "exam_id": "exam_ugc_net",
            "exam_name": "UGC NET Computer Science",
            "year": 2023,
            "paper_name": "UGC NET Dec 2023 Paper 2 (Official Verified)",
            "paper_type": "official",
            "subject_name": "Computer Science & Applications",
            "duration_minutes": 120,
            "total_questions": 50,
            "total_marks": 100.0,
            "source": "National Testing Agency (NTA) Official Archive",
            "verification_status": "verified"
        },
        {
            "id": "pyp_ugc_2022",
            "exam_id": "exam_ugc_net",
            "exam_name": "UGC NET Computer Science",
            "year": 2022,
            "paper_name": "UGC NET Dec 2022 Paper 2 (Official Verified)",
            "paper_type": "official",
            "subject_name": "Computer Science & Applications",
            "duration_minutes": 120,
            "total_questions": 50,
            "total_marks": 100.0,
            "source": "University Grants Commission / NTA",
            "verification_status": "verified"
        },
        {
            "id": "pyp_cbse_12_phy_2024",
            "exam_id": "exam_class_12_boards",
            "exam_name": "Class 12 Board Examination",
            "year": 2024,
            "paper_name": "CBSE Class 12 Physics Board Paper 2024 (Official)",
            "paper_type": "official",
            "subject_name": "Physics",
            "duration_minutes": 180,
            "total_questions": 33,
            "total_marks": 70.0,
            "source": "Central Board of Secondary Education (CBSE)",
            "verification_status": "verified"
        },
        {
            "id": "pyp_cgl_tier1_2024",
            "exam_id": "exam_ssc_cgl_priya",
            "exam_name": "SSC CGL Tier 1",
            "year": 2024,
            "paper_name": "SSC CGL Tier 1 2024 Shift 1 Official Paper",
            "paper_type": "official",
            "subject_name": "All Subjects",
            "duration_minutes": 60,
            "total_questions": 100,
            "total_marks": 200.0,
            "source": "Staff Selection Commission Official Key",
            "verification_status": "verified"
        }
    ]

    for p in pyp_records:
        cursor.execute("""
            INSERT INTO previous_year_papers (
                id, exam_id, exam_name, year, paper_name, paper_type,
                subject_name, duration_minutes, total_questions, total_marks,
                source, verification_status, file_path, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            p["id"], p["exam_id"], p["exam_name"], p["year"], p["paper_name"],
            p["paper_type"], p["subject_name"], p["duration_minutes"],
            p["total_questions"], p["total_marks"], p["source"],
            p["verification_status"], None, dt_offset(-20)
        ))

    # Real extracted questions mapped to syllabus topics
    pyp_sample_questions = [
        {
            "paper_id": "pyp_ugc_2024",
            "topic_id": "top_bst",
            "q_num": 1,
            "text": "What is the worst-case time complexity of inserting an element into a Binary Search Tree (BST) with n nodes?",
            "options": ["O(1)", "O(log n)", "O(n)", "O(n log n)"],
            "ans": "O(n)",
            "exp": "In a skewed binary search tree (like a linked list where elements are inserted in sorted order), the height h equals n - 1, resulting in O(n) worst-case insertion time.",
            "diff": "medium",
            "topic_name": "Binary Search Trees",
            "subject_name": "Data Structures & Algorithms"
        },
        {
            "paper_id": "pyp_ugc_2024",
            "topic_id": "top_bst",
            "q_num": 2,
            "text": "Which tree traversal of a Binary Search Tree yields the keys in strictly ascending sorted order?",
            "options": ["Preorder", "Inorder", "Postorder", "Level-order"],
            "ans": "Inorder",
            "exp": "Inorder traversal (Left, Root, Right) of any valid BST visits nodes in strictly monotonically increasing sorted order.",
            "diff": "easy",
            "topic_name": "Binary Search Trees",
            "subject_name": "Data Structures & Algorithms"
        },
        {
            "paper_id": "pyp_ugc_2023",
            "topic_id": "top_cpu",
            "q_num": 1,
            "text": "Which CPU scheduling algorithm can suffer from the 'convoy effect'?",
            "options": ["Round Robin", "Shortest Job First (Preemptive)", "First-Come First-Served (FCFS)", "Priority Scheduling"],
            "ans": "First-Come First-Served (FCFS)",
            "exp": "The convoy effect occurs in FCFS when a single long CPU-bound process holds the CPU while numerous short I/O-bound processes wait behind it, degrading throughput.",
            "diff": "medium",
            "topic_name": "Process Scheduling",
            "subject_name": "Operating Systems"
        },
        {
            "paper_id": "pyp_ugc_2023",
            "topic_id": "top_norm",
            "q_num": 2,
            "text": "A relation R is in Boyce-Codd Normal Form (BCNF) if for every non-trivial functional dependency X -> Y:",
            "options": ["Y is a superkey", "X is a superkey", "Y is a prime attribute", "X is a foreign key"],
            "ans": "X is a superkey",
            "exp": "BCNF requires that for every non-trivial functional dependency X -> Y, the determinant X must be a candidate key or superkey.",
            "diff": "medium",
            "topic_name": "Relational Normalization",
            "subject_name": "Database Management Systems"
        },
        {
            "paper_id": "pyp_ugc_2022",
            "topic_id": "top_dl",
            "q_num": 3,
            "text": "In Dijkstra's semaphore implementation, what happens when wait(S) (or P(S)) is executed on a semaphore S with S <= 0?",
            "options": ["S is incremented and process continues", "The calling process is blocked and placed in the waiting queue", "System crashes due to underflow", "Signal(S) is automatically triggered"],
            "ans": "The calling process is blocked and placed in the waiting queue",
            "exp": "The wait() primitive decrements the semaphore value. If the value becomes negative or was <= 0, the invoking process blocks until awakened by signal().",
            "diff": "hard",
            "topic_name": "Deadlocks & Synchronization",
            "subject_name": "Operating Systems"
        }
    ]

    for q in pyp_sample_questions:
        q_id = "pypq_" + secrets.token_hex(6)
        cursor.execute("""
            INSERT INTO pyp_questions (
                id, paper_id, subject_id, unit_id, topic_id, question_number,
                question_text, question_type, options, correct_answer,
                explanation, difficulty, marks, negative_marks, topic_name, subject_name
            ) VALUES (?, ?, NULL, NULL, ?, ?, ?, 'single_choice', ?, ?, ?, ?, 2.0, 0.5, ?, ?)
        """, (
            q_id, q["paper_id"], q["topic_id"], q["q_num"], q["text"],
            json.dumps(q["options"]), q["ans"], q["exp"], q["diff"],
            q["topic_name"], q["subject_name"]
        ))

    print("Inserting AI Exam Trend Analysis & Important Topic Rankings...")
    trend_seeds = [
        {
            "topic_id": "top_bst",
            "subject_name": "Data Structures & Algorithms",
            "topic_name": "Binary Search Trees & Traversal",
            "freq": 8,
            "cat": "high_historical_frequency",
            "years": [2022, 2023, 2024],
            "wt": 9.5,
            "notes": "Verified across 3 consecutive examination years. Frequent questions on BST worst-case height, AVL self-balancing rotations, and inorder successor queries."
        },
        {
            "topic_id": "top_cpu",
            "subject_name": "Operating Systems",
            "topic_name": "CPU Scheduling Algorithms (SJF, RR, FCFS)",
            "freq": 7,
            "cat": "high_historical_frequency",
            "years": [2022, 2023, 2024],
            "wt": 8.5,
            "notes": "High question density on average turnaround time calculations and preemption trade-offs."
        },
        {
            "topic_id": "top_norm",
            "subject_name": "Database Management Systems",
            "topic_name": "Relational Database Normalization (1NF to BCNF)",
            "freq": 9,
            "cat": "high_historical_frequency",
            "years": [2021, 2022, 2023, 2024],
            "wt": 10.2,
            "notes": "Consistently appears in Paper 2. Tests lossless-join decomposition and dependency-preserving properties."
        },
        {
            "topic_id": "top_dl",
            "subject_name": "Operating Systems",
            "topic_name": "Deadlocks & Concurrency Control",
            "freq": 5,
            "cat": "moderate_historical_frequency",
            "years": [2022, 2023],
            "wt": 6.0,
            "notes": "Critical conceptual questions around mutual exclusion, deadlock conditions, and dining philosophers."
        },
        {
            "topic_id": "top_sql",
            "subject_name": "Database Management Systems",
            "topic_name": "SQL Aggregations & Subqueries",
            "freq": 4,
            "cat": "moderate_historical_frequency",
            "years": [2023, 2024],
            "wt": 5.0,
            "notes": "Analytical queries involving GROUP BY, HAVING, and correlated nested queries."
        }
    ]

    for ts in trend_seeds:
        tta_id = "tta_" + secrets.token_hex(6)
        cursor.execute("""
            INSERT INTO topic_trend_analysis (
                id, exam_id, topic_id, subject_name, topic_name,
                frequency_count, frequency_category, years_appeared,
                weightage_percent, evidence_notes, recommended_action, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            tta_id, "exam_ugc_net", ts["topic_id"], ts["subject_name"],
            ts["topic_name"], ts["freq"], ts["cat"], json.dumps(ts["years"]),
            ts["wt"], ts["notes"], "Prioritize concept mastery and practice past-year variations", now_str
        ))

    print("Inserting Interactive AI Topic Studio Content & Interactions...")
    studio_bst_content = {
        "summary": "A Binary Search Tree (BST) is a node-based binary tree data structure where the left subtree contains keys smaller than the node, and the right subtree contains keys greater.",
        "prerequisites": ["Binary Trees", "Recursion", "Pointer and Node references"],
        "sections": [
            {
                "id": "sec_1",
                "title": "1. What is a Binary Search Tree?",
                "content": "A Binary Search Tree organizes elements dynamically so that searching, insertion, and deletion can achieve average-case logarithmic time O(log n). For each node with key K: all keys in left subtree < K, and all keys in right subtree > K.",
                "visual_type": "diagram",
                "interactive_type": "diagram"
            },
            {
                "id": "sec_2",
                "title": "2. Inorder Traversal & Sorted Sequence",
                "content": "A defining mathematical property of a BST is that an Inorder Traversal (Left, Root, Right) visits nodes in strictly increasing sorted numerical/alphabetical sequence. This allows BSTs to serve as efficient sorted dictionaries.",
                "visual_type": "table",
                "interactive_type": "flipcard"
            },
            {
                "id": "sec_3",
                "title": "3. The Skewed Tree Problem & O(n) Worst Case",
                "content": "When keys are inserted in strictly ascending order (1, 2, 3, 4, 5), each new node becomes the right child of the previous one. The tree degenerates into a linear linked list of height n - 1, causing search time to degrade to O(n). This motivates self-balancing structures like AVL and Red-Black Trees.",
                "visual_type": "formula",
                "interactive_type": "worked_example"
            }
        ],
        "interactive_elements": {
            "flashcards": [
                {"front": "BST Search Average Time", "back": "O(log n) when the tree is reasonably balanced."},
                {"front": "BST Search Worst Time", "back": "O(n) when the tree degenerates into a linear skewed chain."},
                {"front": "Inorder Traversal Output", "back": "Yields all keys in ascending sorted order."}
            ],
            "mini_quiz": [
                {
                    "question": "What is the height of a completely balanced BST with n nodes?",
                    "options": ["O(1)", "O(log n)", "O(n)", "O(n^2)"],
                    "correct": "O(log n)",
                    "explanation": "In a balanced binary tree, the height h satisfies 2^h ~= n, so h = floor(log2(n))."
                }
            ],
            "mnemonics": [
                {"title": "BST Traversal Rule", "rule": "L-R-R for Inorder (Left, Root, Right) -> Always Sorted In Sight!"}
            ]
        },
        "key_takeaways": [
            "Left subtree < Node < Right subtree",
            "Inorder traversal always yields sorted keys",
            "Unbalanced BST degrades to O(n) operations",
            "Self-balancing trees (AVL, Red-Black) maintain O(log n) guarantees"
        ],
        "comprehension_checks": [
            {"question": "Does duplicate key handling require a consistent rule?", "answer": "Yes, duplicates must either go strictly to the left or right, or use a counter frequency."}
        ]
    }

    cursor.execute("""
        INSERT INTO topic_learning_content (
            id, topic_id, education_level, summary, prerequisites,
            sections, interactive_elements, key_takeaways,
            comprehension_checks, version, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    """, (
        "tlc_demo_bst", "top_bst", "competitive", studio_bst_content["summary"],
        json.dumps(studio_bst_content["prerequisites"]),
        json.dumps(studio_bst_content["sections"]),
        json.dumps(studio_bst_content["interactive_elements"]),
        json.dumps(studio_bst_content["key_takeaways"]),
        json.dumps(studio_bst_content["comprehension_checks"]),
        now_str, now_str
    ))

    # Topic interaction record for Aarav showing demonstrated mastery on BST
    cursor.execute("""
        INSERT INTO topic_interactions (
            id, user_id, topic_id, has_studied, has_mastered,
            comprehension_score, sections_completed, flashcards_reviewed,
            quiz_attempts, last_interacted_at, updated_at
        ) VALUES (?, ?, ?, 1, 1, 92.0, ?, 3, 2, ?, ?)
    """, (
        "ti_demo_aarav_bst", "usr_demo_aarav", "top_bst",
        json.dumps(["sec_1", "sec_2", "sec_3"]),
        now_str, now_str
    ))

    # Topic interaction for CPU scheduling showing studied but not mastered yet
    cursor.execute("""
        INSERT INTO topic_interactions (
            id, user_id, topic_id, has_studied, has_mastered,
            comprehension_score, sections_completed, flashcards_reviewed,
            quiz_attempts, last_interacted_at, updated_at
        ) VALUES (?, ?, ?, 1, 0, 65.0, ?, 1, 1, ?, ?)
    """, (
        "ti_demo_aarav_cpu", "usr_demo_aarav", "top_cpu",
        json.dumps(["sec_1"]),
        now_str, now_str
    ))

    print("Inserting AI Predicted Practice Paper with mandatory disclaimer...")
    pred_paper_questions = [
        {
            "id": "pred_q1",
            "question_text": "In an AVL tree with n nodes, what is the upper bound on tree height in terms of binary search tree operations?",
            "options": ["1.44 log2(n)", "log2(n)", "2 log2(n)", "n/2"],
            "correct_answer": "1.44 log2(n)",
            "explanation": "Due to the Fibonacci tree relation in the worst-case AVL tree, height is strictly bounded by ~1.44 * log2(n).",
            "marks": 2.0,
            "negative_marks": 0.5,
            "difficulty": "advanced",
            "topic": "Binary Search Trees & Traversal"
        },
        {
            "id": "pred_q2",
            "question_text": "Which condition is NOT necessary for a deadlock to occur in an operating system?",
            "options": ["Mutual exclusion", "Hold and wait", "Preemption allowed by OS", "Circular wait"],
            "correct_answer": "Preemption allowed by OS",
            "explanation": "No Preemption is the necessary condition. If preemption is allowed, deadlock is prevented.",
            "marks": 2.0,
            "negative_marks": 0.5,
            "difficulty": "medium",
            "topic": "Process Synchronization & Semaphores"
        },
        {
            "id": "pred_q3",
            "question_text": "Given relation R(A, B, C, D) with FDs {A -> B, B -> C, C -> D}. What is the highest normal form of R?",
            "options": ["1NF", "2NF", "3NF", "BCNF"],
            "correct_answer": "2NF",
            "explanation": "Candidate key is A. Transitive dependencies B -> C and C -> D violate 3NF, but since there are no partial dependencies, it is in 2NF.",
            "marks": 2.0,
            "negative_marks": 0.5,
            "difficulty": "medium",
            "topic": "Relational Database Normalization"
        }
    ]

    cursor.execute("""
        INSERT INTO predicted_papers (
            id, user_id, exam_id, title, generation_mode, target_date,
            duration_minutes, total_questions, total_marks, negative_marking_enabled,
            questions_json, disclaimer, created_at
        ) VALUES (?, ?, ?, ?, 'exam_pattern', ?, 60, 3, 6.0, 1, ?, 'AI-generated predicted practice paper — not an official examination paper or a guaranteed prediction of the upcoming exam.', ?)
    """, (
        "pred_demo_ugc_2026", "usr_demo_aarav", "exam_ugc_net",
        "AI Predicted Practice Paper — UGC NET Computer Science 2026",
        d_offset(45), json.dumps(pred_paper_questions), now_str
    ))

    print("Inserting Smart Recovery Plan proposal for missed study days...")
    rescheduled_demo_tasks = [
        {"task_id": "spt_sp_ugc_aarav_norm", "topic_name": "Relational Database Normalization", "original_date": d_offset(-2), "new_date": d_offset(1), "reason": "Moved to upcoming open evening session"},
        {"task_id": "spt_sp_ugc_aarav_dl", "topic_name": "Deadlocks & Prevention", "original_date": d_offset(-1), "new_date": d_offset(2), "reason": "Redistributed to preserve full mock test on buffer day"}
    ]
    cursor.execute("""
        INSERT INTO recovery_plans (
            id, user_id, exam_id, study_plan_id, missed_days_count,
            missed_task_ids, rescheduled_tasks, feasibility_analysis,
            status, created_at
        ) VALUES (?, ?, ?, ?, 2, ?, ?, ?, 'pending', ?)
    """, (
        "rec_demo_aarav", "usr_demo_aarav", "exam_ugc_net", "sp_ugc_aarav",
        json.dumps(["spt_sp_ugc_aarav_norm", "spt_sp_ugc_aarav_dl"]),
        json.dumps(rescheduled_demo_tasks),
        "Detected 2 missed study tasks from the last 48 hours. Remaining time to exam is 45 days. By adding 20 minutes to the next 4 sessions, the original syllabus coverage target remains 100% achievable without student fatigue.",
        now_str
    ))

    print("Inserting monthly assessments...")
    cursor.execute("""
        INSERT INTO monthly_assessments (
            id, user_id, exam_id, assessment_month, assessment_year, mock_test_id, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'completed', ?)
    """, (
        "ma_ugc_oct_2026", "usr_demo_aarav", "exam_ugc_net", 10, 2026, "test_ugc_monthly_oct", dt_offset(-25)
    ))

    # Also build a user_plans JSON entry for user_plans backward compatibility
    # so Aarav's legacy UI views immediately load the structured subjects and tasks
    aarav_plan_subjects = []
    for s in ugc_hierarchy:
        top_list = []
        for u in s["units"]:
            for c in u["chapters"]:
                for t in c["topics"]:
                    top_list.append({
                        "id": t["id"],
                        "name": t["name"],
                        "stage": t.get("stage", 2),
                        "next": d_offset(2)
                    })
        aarav_plan_subjects.append({
            "id": s["id"],
            "name": s["name"],
            "color": s["color"],
            "topics": top_list
        })

    aarav_plan_tasks = [
        {"id": "t1", "title": "Revise Binary Search Trees & Traversal", "subjectId": "subj_ds", "date": today_str, "mins": 60, "prio": "high", "done": False},
        {"id": "t2", "title": "Solve 15 problems on CPU Scheduling", "subjectId": "subj_os", "date": today_str, "mins": 60, "prio": "high", "done": False},
        {"id": "t3", "title": "Normalize relational schemas to 3NF & BCNF", "subjectId": "subj_dbms", "date": d_offset(1), "mins": 75, "prio": "high", "done": False},
        {"id": "t4", "title": "Full Syllabus 60-min Rapid Mock Examination", "subjectId": "subj_ds", "date": d_offset(2), "mins": 60, "prio": "high", "done": False}
    ]

    aarav_full_plan = {
        "v": 1,
        "role": "competitive_exam",
        "exam": {"name": "UGC NET Computer Science", "date": d_offset(45)},
        "goalMins": 240,
        "sittingCapacityMins": 45,
        "settings": {"focus": 25, "short": 5, "long": 15},
        "subjects": aarav_plan_subjects,
        "tasks": aarav_plan_tasks,
        "sessions": [
            {"id": "s1", "date": d_offset(-1), "mins": 45, "subjectId": "subj_ds", "at": int(now.timestamp()*1000) - 86400000},
            {"id": "s2", "date": d_offset(-1), "mins": 45, "subjectId": "subj_os", "at": int(now.timestamp()*1000) - 80000000},
            {"id": "s3", "date": d_offset(-2), "mins": 60, "subjectId": "subj_dbms", "at": int(now.timestamp()*1000) - 172800000}
        ]
    }

    cursor.execute("""
        INSERT INTO user_plans (user_id, plan_json, updated_at, version)
        VALUES (?, ?, ?, 1)
        ON CONFLICT(user_id) DO UPDATE SET
            plan_json = excluded.plan_json,
            updated_at = excluded.updated_at
    """, ("usr_demo_aarav", json.dumps(aarav_full_plan), now_str))

    conn.commit()
    conn.close()

    print("\n[SUCCESS] Database successfully initialized and seeded with rich dummy data!")
    print("----------------------------------------------------------------------")
    print("DEMO ACCOUNTS (Password: Password123!):")
    print("1. Aarav Sharma : ugc.student@studypilot.ai  (UGC NET CS & SSC CGL)")
    print("2. Priya Patel  : cgl.aspirant@studypilot.ai (SSC CGL Tier 1)")
    print("3. Rohan Verma  : board.student@studypilot.ai (Class 12 Boards)")
    print("----------------------------------------------------------------------\n")

if __name__ == "__main__":
    seed_database()
