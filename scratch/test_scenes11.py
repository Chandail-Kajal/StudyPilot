from test_all_svgs import (
    wrap_svg_tspans, detect_visual_archetype, generate_linked_list_svg,
    generate_cycle_svg, generate_pipeline_svg, generate_formula_derivation_svg,
    generate_architecture_flow_svg, generate_concept_badge_svg,
    generate_recap_checklist_svg, generate_practice_challenge_svg,
    generate_topic_diagram_svg
)

def build_11_scenes(topic_name, subject_name, exam_name):
    clean_t = topic_name.strip()
    clean_s = subject_name.strip()
    
    scenes = [
        {
            "id": "scene_1",
            "title": f"1. Introduction to {clean_t}",
            "scene_type": "intro",
            "level_key": "basic",
            "level_badge": "1. Topic Introduction (Basic)",
            "pedagogical_goal": f"Establish core relevance of {clean_t} within {clean_s} for {exam_name}.",
            "analogy": "Every complex concept has a single root idea from which all rules grow.",
            "duration_seconds": 12,
            "voiceover_text": f"Welcome to this visual masterclass on {clean_t}. In {clean_s}, this topic forms an essential pillar of your syllabus. Let's build your intuition from the ground up.",
            "visual_instructions": "Animated concept card with glowing boundary, subject badge, and pulsing icon.",
            "hotspots": [
                {"id": "h1", "title": "Core Pillar", "desc": "Foundational syllabus concept.", "badge": "Step 1"},
                {"id": "h2", "title": "Exam Weighting", "desc": "High frequency in competitive tests.", "badge": "Step 2"}
            ],
            "slide_content": {
                "heading": clean_t,
                "subheading": f"Curriculum Foundation in {clean_s}",
                "bullet_points": [
                    f"High-yield syllabus pillar for {exam_name}",
                    "Mastering this unlocks multiple derivative topics"
                ],
                "diagram_type": "concept_badge",
                "diagram_svg": generate_concept_badge_svg(clean_t, "High-Yield Curriculum Pillar")
            }
        },
        {
            "id": "scene_2",
            "title": "2. Why This Topic Is Important",
            "scene_type": "significance",
            "level_key": "basic",
            "level_badge": "2. Why It Matters (Significance)",
            "pedagogical_goal": "Understand exam scoring weight and practical engineering/scientific applications.",
            "analogy": "Knowing why a tool exists makes choosing the right moment to use it effortless.",
            "duration_seconds": 12,
            "voiceover_text": f"Why does {clean_t} matter so much? Because in {exam_name}, examiners love testing edge cases here to differentiate top ranks. Mastering this concept guarantees reliable marks.",
            "visual_instructions": "Exam frequency bar and application checklist with glowing verification ticks.",
            "hotspots": [
                {"id": "sig1", "title": "High Weighting", "desc": "Appears repeatedly across papers.", "badge": "Exam"},
                {"id": "sig2", "title": "Compound Concepts", "desc": "Prerequisite for advanced sections.", "badge": "Foundation"}
            ],
            "slide_content": {
                "heading": "Why This Topic Is Vital",
                "subheading": f"Exam Differentiation & Scoring Power in {exam_name}",
                "bullet_points": [
                    "Consistently tested across objective and numerical questions",
                    "Clear rules enable rapid 30-second problem solving"
                ],
                "diagram_type": "checklist",
                "diagram_svg": generate_recap_checklist_svg(clean_t)
            }
        },
        {
            "id": "scene_3",
            "title": "3. Basic Concept & Intuition",
            "scene_type": "intuition",
            "level_key": "basic",
            "level_badge": "3. Intuition & Analogy (Zero Jargon)",
            "pedagogical_goal": "Grasp the concept through a relatable everyday metaphor before looking at formulas.",
            "analogy": f"Think of {clean_t} like an assembly line: an initial trigger passes energy through orderly checkpoints until balance is reached.",
            "duration_seconds": 14,
            "voiceover_text": f"Let's strip away all jargon. Imagine {clean_t} as a natural flow of energy or information. When an input triggers the system, it passes cleanly through invariant rules to reach equilibrium.",
            "visual_instructions": "Clean 3-node stimulus transformation flow with moving pulse animation.",
            "hotspots": [
                {"id": "int1", "title": "Input Trigger", "desc": "The primary stimulus initiating action.", "badge": "Start"},
                {"id": "int2", "title": "Invariant Rule", "desc": "The core conservation mechanism.", "badge": "Rule"},
                {"id": "int3", "title": "Equilibrium", "desc": "The stable final outcome.", "badge": "End"}
            ],
            "interactive_sim": {
                "param_name": "Stimulus Intensity",
                "min": 1,
                "max": 5,
                "default": 2,
                "unit": "Level",
                "states": {
                    "1": {"label": "Sub-threshold", "effect": "Signal faint; baseline rest."},
                    "2": {"label": "Nominal", "effect": "Standard balanced propagation."},
                    "3": {"label": "Elevated", "effect": "Fast feedback activation."},
                    "4": {"label": "Surge", "effect": "High load near limit."},
                    "5": {"label": "Peak", "effect": "Full theoretical capacity."}
                }
            },
            "slide_content": {
                "heading": "Zero-Jargon Intuition",
                "subheading": "Cause, Rule & Observable Effect",
                "bullet_points": [
                    "Every action follows an underlying invariant constraint",
                    "Predictable response across all boundary states"
                ],
                "diagram_type": "architecture_flow",
                "diagram_svg": generate_architecture_flow_svg(clean_t)
            }
        },
        {
            "id": "scene_4",
            "title": "4. Step-by-Step Explanation",
            "scene_type": "explanation",
            "level_key": "foundation",
            "level_badge": "4. Step-by-Step Breakdown (Mechanism)",
            "pedagogical_goal": "Deconstruct the operational anatomy into clear chronological phases.",
            "analogy": "Like a precision clock: each gear engages only after the preceding gear turns.",
            "duration_seconds": 14,
            "voiceover_text": f"Now, let's break down {clean_t} step-by-step. First, parameters enter through the ingestion gate. Next, the parser validates boundary limits. Then the execution engine computes state change, producing the output.",
            "visual_instructions": "Sequential horizontal pipeline with traveling data packet.",
            "hotspots": [
                {"id": "st1", "title": "Phase 1: Ingestion", "desc": "Data or energy enters system.", "badge": "Phase 1"},
                {"id": "st2", "title": "Phase 2: Validation", "desc": "Boundary conditions checked.", "badge": "Phase 2"},
                {"id": "st3", "title": "Phase 3: Execution", "desc": "Core transformation rule applied.", "badge": "Phase 3"}
            ],
            "slide_content": {
                "heading": "Step-by-Step Anatomy",
                "subheading": "Four Discrete Functional Phases",
                "bullet_points": [
                    "Phase 1: Input ingestion and parameter calibration",
                    "Phase 2: Validation against boundary invariants",
                    "Phase 3: Core transformation and state update",
                    "Phase 4: Output verification and delivery"
                ],
                "diagram_type": "pipeline",
                "diagram_svg": generate_pipeline_svg(clean_t)
            }
        },
        {
            "id": "scene_5",
            "title": "5. Visual Diagram / Dynamic Model",
            "scene_type": "visual_model",
            "level_key": "foundation",
            "level_badge": "5. Dynamic Visual Model (Archetype)",
            "pedagogical_goal": f"Visualize the archetype of {clean_t} dynamically with animated flow lines.",
            "analogy": "A picture is worth a thousand equations; an animated model makes it unforgettable.",
            "duration_seconds": 14,
            "voiceover_text": f"Look at this visual diagram of {clean_t}. Notice how the nodes and pointers maintain structure, or how energy cycles continuously through each phase. This visual map is your mental anchor.",
            "visual_instructions": "Dynamic archetype animation with traveling particles, next/prev pointers, or continuous orbit.",
            "hotspots": [
                {"id": "vm1", "title": "Node/Stage 1", "desc": "Primary anchor point.", "badge": "Node 1"},
                {"id": "vm2", "title": "Node/Stage 2", "desc": "Intermediate mediator.", "badge": "Node 2"},
                {"id": "vm3", "title": "Node/Stage 3", "desc": "Terminal boundary or loop return.", "badge": "Node 3"}
            ],
            "slide_content": {
                "heading": "Dynamic Architecture Model",
                "subheading": f"Animated {clean_t} Representation",
                "bullet_points": [
                    "Observe the directional pointers and data flow",
                    "No component acts in isolation; invariants hold throughout"
                ],
                "diagram_type": "dynamic_archetype",
                "diagram_svg": generate_topic_diagram_svg(clean_t, clean_s, "auto")
            }
        },
        {
            "id": "scene_6",
            "title": "6. Worked Exam Example",
            "scene_type": "example",
            "level_key": "intermediate",
            "level_badge": "6. Worked Problem (Step-by-Step)",
            "pedagogical_goal": "Deconstruct an examination question into 3 methodical calculation steps.",
            "analogy": "Solving exam problems is like executing a proven recipe: extract ingredients, apply formula, check result.",
            "duration_seconds": 16,
            "voiceover_text": f"Here is a typical {exam_name} problem. Step one: list given variables and convert units to SI. Step two: substitute into the governing law. Step three: check dimensions and verify boundary limits.",
            "visual_instructions": "Interactive chalkboard showing equation, variable breakdown, and calculation steps.",
            "hotspots": [
                {"id": "wk1", "title": "Given Extraction", "desc": "Units normalized to standard SI.", "badge": "Step 1"},
                {"id": "wk2", "title": "Formula Law", "desc": "Governing equation applied.", "badge": "Step 2"},
                {"id": "wk3", "title": "Sanity Verification", "desc": "Dimensional limit confirmation.", "badge": "Step 3"}
            ],
            "slide_content": {
                "heading": "Worked Exam Problem",
                "subheading": "Standard Application Routine",
                "bullet_points": [
                    "Step 1: Extract given parameters and convert to SI units",
                    "Step 2: Substitute values into the governing formula",
                    "Step 3: Test boundary limits and verify dimensional consistency"
                ],
                "diagram_type": "formula_derivation",
                "diagram_svg": generate_formula_derivation_svg(clean_t)
            }
        },
        {
            "id": "scene_7",
            "title": "7. Real-World Application",
            "scene_type": "application",
            "level_key": "intermediate",
            "level_badge": "7. Real-World Impact (Application)",
            "pedagogical_goal": f"Connect theoretical {clean_t} to modern engineering, nature, or technology.",
            "analogy": "Theory is the blueprint; real-world systems are the skyscrapers built upon it.",
            "duration_seconds": 12,
            "voiceover_text": f"Where do we see {clean_t} in real life? From high-throughput computer algorithms and data pipelines to space navigation and biological regulation, this exact principle operates everywhere.",
            "visual_instructions": "Application showcase card highlighting industrial and biological use cases.",
            "hotspots": [
                {"id": "app1", "title": "Modern Software & Tech", "desc": "Memory optimization and data routing.", "badge": "Tech"},
                {"id": "app2", "title": "Physical Systems", "desc": "Resource efficiency and balance.", "badge": "Nature"}
            ],
            "slide_content": {
                "heading": "Real-World Applications",
                "subheading": f"How {clean_t} Powers Modern Systems",
                "bullet_points": [
                    "Used in high-performance computing, systems engineering and robotics",
                    "Underpins biological equilibrium and natural cycles"
                ],
                "diagram_type": "pipeline",
                "diagram_svg": generate_pipeline_svg(clean_t)
            }
        },
        {
            "id": "scene_8",
            "title": "8. Common Student Mistakes & Traps",
            "scene_type": "traps",
            "level_key": "advanced",
            "level_badge": "8. Traps & Common Mistakes (Exam Hacks)",
            "pedagogical_goal": "Spot deceptive exam distractors and unit pitfalls in under 5 seconds.",
            "analogy": "Knowing where the potholes are lets you drive at full speed with complete confidence.",
            "duration_seconds": 12,
            "voiceover_text": f"Watch out for these common traps! Examiners frequently flip sign conventions or hide mismatched units. Over 50% of lost marks on {clean_t} come from simple unit mismatch, not concept failure.",
            "visual_instructions": "Trap alert board with danger badges and 5-second elimination rules.",
            "hotspots": [
                {"id": "trp1", "title": "Unit Mismatch Trap", "desc": "cm vs m, seconds vs minutes.", "badge": "Trap 1"},
                {"id": "trp2", "title": "Sign Convention", "desc": "Directional sign confusion in MCQ.", "badge": "Trap 2"}
            ],
            "slide_content": {
                "heading": "Examiner Traps & Pitfalls",
                "subheading": "Avoid Costly Negative Marks",
                "bullet_points": [
                    "Trap 1: Forgetting SI unit conversion before calculation",
                    "Trap 2: Misinterpreting direction or sign conventions",
                    "Trap 3: Applying formulas outside valid boundary regimes"
                ],
                "diagram_type": "checklist",
                "diagram_svg": generate_recap_checklist_svg(clean_t)
            }
        },
        {
            "id": "scene_9",
            "title": "9. Quick Check Question",
            "scene_type": "quick_check",
            "level_key": "advanced",
            "level_badge": "9. Quick Check (Live Verification)",
            "pedagogical_goal": "Test conceptual comprehension with an immediate interactive check question.",
            "analogy": "A quick pit-stop to verify tire pressure before the final race lap.",
            "duration_seconds": 14,
            "voiceover_text": f"Time for a quick check. If the primary driving variable in {clean_t} is doubled while constraints remain constant, what is the expected outcome? Select your answer on screen now.",
            "checkpoint_quiz": {
                "question": f"Which statement best summarizes the primary operational mechanism of {clean_t}?",
                "options": [
                    f"It governs a deterministic state transition preserving invariant system properties.",
                    f"It functions completely randomly with no predictable constraints.",
                    f"It only holds when temperature and pressure are zero."
                ],
                "correct_index": 0,
                "explanation": f"{clean_t} enforces deterministic relationships that preserve conservation laws.",
                "hint": "Think back to the core invariant rule discussed earlier!"
            },
            "slide_content": {
                "heading": "Live Checkpoint Question",
                "subheading": "Confirm Your Intuition",
                "bullet_points": [
                    "Select the best answer on screen",
                    "Immediate feedback verifies your conceptual lock"
                ],
                "diagram_type": "architecture_flow",
                "diagram_svg": generate_architecture_flow_svg(clean_t)
            }
        },
        {
            "id": "scene_10",
            "title": "10. Summary & Key Points",
            "scene_type": "summary",
            "level_key": "mastery",
            "level_badge": "10. High-Yield Summary (Key Points)",
            "pedagogical_goal": "Consolidate memory with 3 golden takeaways for instant exam recall.",
            "analogy": "The cheat-sheet you carry in your mind on exam day.",
            "duration_seconds": 12,
            "voiceover_text": f"To wrap up our lesson on {clean_t}: Remember the core mechanism, always verify units first, and watch out for sign traps. You now have the complete conceptual blueprint.",
            "visual_instructions": "Golden summary banner with 3 checkmark badges.",
            "hotspots": [
                {"id": "sum1", "title": "Rule 1", "desc": "Check units before calculating.", "badge": "Rule 1"},
                {"id": "sum2", "title": "Rule 2", "desc": "Verify boundary conditions.", "badge": "Rule 2"},
                {"id": "sum3", "title": "Rule 3", "desc": "Eliminate 2 choices via dimensions.", "badge": "Rule 3"}
            ],
            "slide_content": {
                "heading": "High-Yield Summary",
                "subheading": "Three Golden Rules to Remember",
                "bullet_points": [
                    "1. Always check given units and dimensional consistency first",
                    "2. Confirm whether standard linearity or boundary constraints apply",
                    "3. Eliminate wrong distractors quickly using order-of-magnitude checks"
                ],
                "diagram_type": "checklist",
                "diagram_svg": generate_recap_checklist_svg(clean_t)
            }
        },
        {
            "id": "scene_11",
            "title": "11. Practice Questions & Next Steps",
            "scene_type": "practice",
            "level_key": "mastery",
            "level_badge": "11. Practice Drill (Exam Mastery)",
            "pedagogical_goal": "Direct the student into interactive practice drills and mock tests.",
            "analogy": "Practice makes permanent: test your knowledge now while it's fresh.",
            "duration_seconds": 10,
            "voiceover_text": f"Now put this knowledge to work. Head into the practice drills tab or start a focused study timer on {clean_t} to cement your 100% exam readiness!",
            "visual_instructions": "Celebration card with practice drill button and timer launcher.",
            "slide_content": {
                "heading": "Test Your Mastery",
                "subheading": "Ready for Practice Drills",
                "bullet_points": [
                    "Launch interactive practice questions for this topic",
                    "Track your accuracy and review worked solutions"
                ],
                "diagram_type": "practice_challenge",
                "diagram_svg": generate_practice_challenge_svg(clean_t)
            }
        }
    ]
    return scenes

sc = build_11_scenes("Singly and Doubly Linked Lists", "Computer Science", "GATE")
print(f"[OK] Generated {len(sc)} scenes. Total duration: {sum(s['duration_seconds'] for s in sc)}s")

