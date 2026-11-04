"""
StudyPilot AI - Automated Animated Educational Video Generator
Integrates:
- Mathematical & Physics Equations via Manim Community Edition
- Educational Slide Presentations, Diagrams & Transitions via Remotion / SVG-Canvas Video Engine
- Voice Narration via Offline TTS (pyttsx3) and Synchronized Subtitles
"""

import os
import re
import json
import time
import secrets
import asyncio
import subprocess
from datetime import datetime
from typing import Dict, Any, List, Optional

from database import get_db
from ai_provider import ai_manager, extract_clean_json

STATIC_VIDEO_DIR = os.path.join(os.path.dirname(__file__), "static", "videos")
STATIC_AUDIO_DIR = os.path.join(os.path.dirname(__file__), "static", "audio")

os.makedirs(STATIC_VIDEO_DIR, exist_ok=True)
os.makedirs(STATIC_AUDIO_DIR, exist_ok=True)

# Check if Manim is importable
HAS_MANIM = False
try:
    import manim
    HAS_MANIM = True
except Exception:
    HAS_MANIM = False

# =============================================================================
# 1. Voice Narration Synthesizer (pyttsx3 / Windows SAPI5)
# =============================================================================

def synthesize_narration(text: str, filename_prefix: str) -> Optional[str]:
    """
    Synthesizes speech audio using local offline TTS (pyttsx3).
    Returns the relative URL to the audio file e.g. '/static/audio/filename.wav'.
    """
    if not text or not text.strip():
        return None

    filename = f"{filename_prefix}_{secrets.token_hex(4)}.wav"
    out_path = os.path.join(STATIC_AUDIO_DIR, filename)

    try:
        import pyttsx3
        engine = pyttsx3.init()
        engine.setProperty("rate", 160)  # comfortable educational speaking pace
        # Pick female or standard clear voice if available
        voices = engine.getProperty("voices")
        if voices:
            for v in voices:
                if "zira" in v.name.lower() or "eva" in v.name.lower() or "female" in v.name.lower():
                    engine.setProperty("voice", v.id)
                    break
        engine.save_to_file(text, out_path)
        engine.runAndWait()
        if os.path.exists(out_path) and os.path.getsize(out_path) > 100:
            return f"/static/audio/{filename}"
    except Exception as e:
        print(f"[Video Generator Notice] pyttsx3 synthesis error: {e}")

    return None


# =============================================================================
# 2. Synchronized Subtitle Generator
# =============================================================================

def generate_timed_subtitles(scenes: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Splits scene narration into timed sentence cues for live closed-captioning.
    """
    subtitles: List[Dict[str, Any]] = []
    current_time = 0.0

    for idx, sc in enumerate(scenes):
        text = sc.get("voiceover_text", "")
        duration = float(sc.get("duration_seconds", 18.0))
        # Split into sentences or clean clauses
        sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", text) if s.strip()]
        if not sentences:
            sentences = [f"Exploring {sc.get('title', 'Concept')}"]

        time_per_sentence = duration / max(1, len(sentences))
        for sent in sentences:
            start_t = round(current_time, 2)
            end_t = round(current_time + time_per_sentence, 2)
            subtitles.append({
                "scene_idx": idx,
                "start": start_t,
                "end": end_t,
                "text": sent
            })
            current_time += time_per_sentence

    return subtitles


# =============================================================================
# 3. Manim Code Validator & Isolated Execution
# =============================================================================

FORBIDDEN_MANIM_TERMS = [
    "import os", "import sys", "subprocess", "eval(", "exec(", "open(",
    "__import__", "socket", "shutil", "urllib", "requests", "pip", "globals()"
]

def validate_manim_code(code: str) -> bool:
    """Verifies that generated Manim code is safe and restricted to mathematical graphics."""
    if not code:
        return False
    lower = code.lower()
    for term in FORBIDDEN_MANIM_TERMS:
        if term in lower:
            return False
    return "class " in code and "Scene" in code


def render_manim_scene(manim_code: str, output_prefix: str) -> Optional[str]:
    """
    Executes validated Manim scene code in an isolated directory.
    Returns relative URL to rendered MP4 video or None on fallback.
    """
    if not HAS_MANIM or not validate_manim_code(manim_code):
        return None

    sandbox_dir = os.path.join(STATIC_VIDEO_DIR, "sandbox")
    os.makedirs(sandbox_dir, exist_ok=True)
    script_file = os.path.join(sandbox_dir, f"{output_prefix}.py")

    with open(script_file, "w", encoding="utf-8") as f:
        f.write(manim_code)

    try:
        # Extract Scene class name
        m = re.search(r"class\s+([A-Za-z0-9_]+)\s*\(\s*Scene\s*\)", manim_code)
        scene_name = m.group(1) if m else "TopicAnimation"

        cmd = [
            "manim",
            "-qm",  # 720p medium quality, fast rendering
            "--media_dir", sandbox_dir,
            "-o", f"{output_prefix}.mp4",
            script_file,
            scene_name
        ]
        res = subprocess.run(cmd, capture_output=True, timeout=25, text=True)
        if res.returncode == 0:
            rendered_mp4 = os.path.join(sandbox_dir, "videos", f"{output_prefix}", "720p30", f"{output_prefix}.mp4")
            if os.path.exists(rendered_mp4):
                final_dest = os.path.join(STATIC_VIDEO_DIR, f"{output_prefix}.mp4")
                os.replace(rendered_mp4, final_dest)
                return f"/static/videos/{output_prefix}.mp4"
    except Exception as e:
        print(f"[Manim Engine Notice] Manim rendering bypassed ({e}). Falling back to Remotion/SVG animation.")

    return None


# =============================================================================
# 4. Educational Video Script & Scene Structure Generator
# =============================================================================

async def generate_educational_video_script(
    topic_name: str,
    subject_name: str,
    exam_name: str,
    lesson_content: Optional[Dict[str, Any]] = None,
    engine: str = "remotion"
) -> Dict[str, Any]:
    """
    Generates a progressive 5-scene educational animation package structured from Basic to Advanced:
    - Level 1 (Basic): Intuition & Everyday Analogy (zero jargon, relatable metaphor)
    - Level 2 (Foundation): Working Mechanism & Anatomy (flow of components, labeled diagrams)
    - Level 3 (Intermediate): Formulas & Parameter Scaling (variables, direct/inverse proportionality)
    - Level 4 (Advanced): Step-by-Step Worked Exam Problem (application & calculation)
    - Level 5 (Mastery): High-Yield Exam Recap, Traps & Speed Shortcuts
    """
    clean_topic = topic_name.strip()
    clean_subj = subject_name.strip()

    prompt = f"""
    Create a complete 5-scene progressive animated educational video script from BASIC to ADVANCED for:
    Topic: "{clean_topic}"
    Subject: "{clean_subj}"
    Target Exam: "{exam_name}"
    Preferred Engine: "{engine}"

    PEDAGOGICAL PROGRESSION REQUIREMENT:
    Scene 1 (Level 1 - Basic): Start with a relatable real-life analogy that a complete beginner understands instantly without any formulas.
    Scene 2 (Level 2 - Foundation): Show the internal mechanism, sequence of actions, and key components.
    Scene 3 (Level 3 - Intermediate): Explain the governing formula, parameter relationships (what increases or decreases output), and SI units.
    Scene 4 (Level 4 - Advanced): Walk through a classic entrance exam numerical/conceptual problem with clear numbered steps.
    Scene 5 (Level 5 - Mastery): Highlight examiner trick questions, common traps, dimensional elimination shortcuts, and final takeaway checklist.

    Return ONLY a valid JSON object adhering strictly to this schema:
    {{
        "video_title": "Visual Masterclass: {clean_topic}",
        "engine": "{engine}",
        "total_duration": 90,
        "scenes": [
            {{
                "id": "scene_1",
                "title": "1. Intuition & Everyday Analogy",
                "scene_type": "intro",
                "level_key": "basic",
                "level_badge": "Level 1: Intuition (Basic)",
                "pedagogical_goal": "Build immediate intuition using a familiar everyday analogy before touching formulas.",
                "analogy": "Think of {clean_topic} like an everyday relatable mechanism...",
                "duration_seconds": 16,
                "voiceover_text": "Engaging beginner-friendly introduction to {clean_topic} in {clean_subj}.",
                "visual_instructions": "Animated concept card with smooth pulsing effects and real-world badge.",
                "hotspots": [
                    {{"id": "h1", "title": "Input Trigger", "desc": "Initial stimulus or cause.", "badge": "Step 1"}},
                    {{"id": "h2", "title": "Response Circuit", "desc": "System pathway transmitting the signal.", "badge": "Step 2"}},
                    {{"id": "h3", "title": "Observable Effect", "desc": "Real-world result.", "badge": "Step 3"}}
                ],
                "interactive_sim": {{
                    "param_name": "Input Stimulus Intensity",
                    "min": 1,
                    "max": 5,
                    "default": 2,
                    "unit": "Level",
                    "states": {{
                        "1": {{"label": "Sub-threshold (Low)", "effect": "Signal too faint; baseline state."}},
                        "2": {{"label": "Normal Baseline", "effect": "Smooth standard transition triggered."}},
                        "3": {{"label": "Elevated Response", "effect": "Rapid adaptive feedback loop active."}},
                        "4": {{"label": "High Stress / Surge", "effect": "Intense activation near tolerance limit."}},
                        "5": {{"label": "Critical Saturation", "effect": "Peak capacity; saturation plateau reached."}}
                    }}
                }},
                "checkpoint_quiz": {{
                    "question": "What is the core intuition behind {clean_topic}?",
                    "options": [
                        "An initial stimulus triggers an orderly governed transformation toward equilibrium.",
                        "It occurs randomly with no causal relationship.",
                        "It only functions in purely theoretical vacuums."
                    ],
                    "correct_index": 0,
                    "explanation": "{clean_topic} operates as an organized cause-and-effect mechanism.",
                    "hint": "Think of the everyday analogy presented in this scene!"
                }},
                "slide_content": {{
                    "heading": "{clean_topic}",
                    "subheading": "Intuition & Everyday Analogy",
                    "bullet_points": [
                        "Real-world intuitive model",
                        "Zero-prerequisite entry point"
                    ],
                    "diagram_type": "concept_card",
                    "diagram_svg": "<svg viewBox='0 0 400 180'><rect x='20' y='20' width='360' height='140' rx='16' fill='#141E2A' stroke='#0A6C9E' stroke-width='2'/><circle cx='200' cy='75' r='36' fill='#0A6C9E'/><text x='200' y='82' fill='#FFFFFF' font-size='22' text-anchor='middle' font-weight='bold'>✦</text><text x='200' y='135' fill='#E8EEF4' font-size='16' font-weight='bold' text-anchor='middle'>{clean_topic}</text></svg>"
                }},
                "manim_code": null
            }},
            {{
                "id": "scene_2",
                "title": "2. Working Mechanism & Anatomy",
                "scene_type": "concept",
                "level_key": "foundation",
                "level_badge": "Level 2: Mechanism (Foundation)",
                "pedagogical_goal": "Trace internal components and understand how each stage works step-by-step.",
                "analogy": "Like an assembly line or relay race where each stage passes state to the next without loss.",
                "duration_seconds": 20,
                "voiceover_text": "Detailed explanation of the governing laws and state transformations.",
                "visual_instructions": "Flowchart with glowing state transitions.",
                "hotspots": [
                    {{"id": "m1", "title": "Receptor Stage", "desc": "Receives the incoming input or boundary condition.", "badge": "Node A"}},
                    {{"id": "m2", "title": "Mediator Node", "desc": "Processes the transfer according to conservation laws.", "badge": "Node B"}},
                    {{"id": "m3", "title": "Effector Stage", "desc": "Delivers the final output state.", "badge": "Node C"}}
                ],
                "interactive_sim": {{
                    "param_name": "Transmission Velocity",
                    "min": 1,
                    "max": 5,
                    "default": 3,
                    "unit": "x Speed",
                    "states": {{
                        "1": {{"label": "0.5x Damped Speed", "effect": "High latency; signal heavily resisted."}},
                        "2": {{"label": "1.0x Normal Pace", "effect": "Smooth propagation without loss."}},
                        "3": {{"label": "1.5x Accelerated", "effect": "Fast response; optimal efficiency."}},
                        "4": {{"label": "2.0x High Frequency", "effect": "Increased dissipation across mediator."}},
                        "5": {{"label": "3.0x Resonance Limit", "effect": "Maximum frequency throughput."}}
                    }}
                }},
                "checkpoint_quiz": {{
                    "question": "What role does the mediator stage perform in this mechanism?",
                    "options": [
                        "It ensures regulated transfer while obeying conservation laws.",
                        "It destroys energy to speed up the process.",
                        "It terminates the system permanently."
                    ],
                    "correct_index": 0,
                    "explanation": "The intermediate mediator governs rate and preserves physical constraints.",
                    "hint": "Notice how it bridges the input and output."
                }},
                "slide_content": {{
                    "heading": "Governing Mechanism",
                    "subheading": "Anatomy & Sequence of States",
                    "bullet_points": [
                        "Input → Transformation Rule → Output",
                        "Conservation law invariants preserved"
                    ],
                    "diagram_type": "flowchart",
                    "diagram_svg": "<svg viewBox='0 0 620 140'><rect x='20' y='42' width='125' height='52' rx='10' fill='#141E2A' stroke='#263648' stroke-width='1.5'/><text x='82' y='73' fill='#92A3B5' font-size='12' font-family='system-ui, sans-serif' text-anchor='middle'>Input State</text><line x1='145' y1='68' x2='195' y2='68' stroke='#54C2F0' stroke-width='2.5' stroke-dasharray='4'/><polygon points='195,68 188,64 188,72' fill='#54C2F0'/><rect x='195' y='28' width='230' height='80' rx='14' fill='#0A6C9E' stroke='#54C2F0' stroke-width='1.5'/><foreignObject x='195' y='28' width='230' height='80'><div xmlns='http://www.w3.org/1999/xhtml' style='display:flex;align-items:center;justify-content:center;height:100%;text-align:center;color:#ffffff;font-size:13px;font-weight:700;line-height:1.25;padding:6px 14px;font-family:system-ui,sans-serif;word-break:break-word;overflow:hidden;'>{clean_topic}</div></foreignObject><line x1='425' y1='68' x2='475' y2='68' stroke='#4CC98A' stroke-width='2.5'/><polygon points='475,68 468,64 468,72' fill='#4CC98A'/><rect x='475' y='42' width='125' height='52' rx='10' fill='#1B8553' stroke='#4CC98A' stroke-width='1.5'/><text x='537' y='73' fill='#ffffff' font-size='12' font-family='system-ui, sans-serif' text-anchor='middle'>Output</text></svg>"
                }},
                "manim_code": null
            }},
            {{
                "id": "scene_3",
                "title": "3. Mathematical Formulation & Scaling",
                "scene_type": "formula",
                "level_key": "intermediate",
                "level_badge": "Level 3: Formulas & Scaling (Intermediate)",
                "pedagogical_goal": "Understand variables, direct vs inverse proportionality, and SI units.",
                "analogy": "Like a seesaw: increasing the driving term lifts output; increasing resistance depresses it.",
                "duration_seconds": 20,
                "voiceover_text": "Examining equations, dimensional consistency, and scaling relations.",
                "visual_instructions": "Mathematical formula card with active term highlighting.",
                "hotspots": [
                    {{"id": "f1", "title": "Driving Term", "desc": "Directly proportional: increasing this scales the output upward.", "badge": "Drive"}},
                    {{"id": "f2", "title": "Resistance / Damping", "desc": "Inversely proportional: larger denominator reduces the final output.", "badge": "Damping"}},
                    {{"id": "f3", "title": "Dimensional Constant", "desc": "Calibrates units to standard SI metric system.", "badge": "Constant"}}
                ],
                "interactive_sim": {{
                    "param_name": "Driving vs Resistance Ratio",
                    "min": 1,
                    "max": 5,
                    "default": 3,
                    "unit": "Ratio",
                    "states": {{
                        "1": {{"label": "0.2x Over-damped", "effect": "Resistance dominates; output strongly suppressed."}},
                        "2": {{"label": "0.5x Moderate", "effect": "Linear regime; steady output growth."}},
                        "3": {{"label": "1.0x Balanced", "effect": "Optimal resonance and maximum energy transfer."}},
                        "4": {{"label": "2.0x High Drive", "effect": "Output surges; boundary conditions critical."}},
                        "5": {{"label": "5.0x Extreme Drive", "effect": "Approaching asymptotic non-linear saturation."}}
                    }}
                }},
                "checkpoint_quiz": {{
                    "question": "If the driving parameter is doubled while resistance stays constant, what happens to the output in a linear regime?",
                    "options": [
                        "The output approximately doubles.",
                        "The output drops to zero.",
                        "The output remains unaffected."
                    ],
                    "correct_index": 0,
                    "explanation": "Direct linear proportionality means doubling the numerator doubles the resulting value.",
                    "hint": "Check the exponent of the variable in the equation!"
                }},
                "slide_content": {{
                    "heading": "Governing Mathematical Laws",
                    "subheading": "Formula & Proportionality Analysis",
                    "bullet_points": [
                        "Direct vs inverse scaling dependencies",
                        "SI dimensional balance"
                    ],
                    "formula_latex": "\\Delta S \\ge 0",
                    "diagram_type": "formula_callout",
                    "diagram_svg": "<svg viewBox='0 0 450 130'><rect x='20' y='20' width='410' height='90' rx='12' fill='#141E2A' stroke='#F0B23C' stroke-width='2'/><text x='225' y='65' fill='#F0B23C' font-size='18' text-anchor='middle' font-family='monospace'>Governing Law: {clean_topic}</text><text x='225' y='95' fill='#92A3B5' font-size='12' text-anchor='middle'>Units: Verified SI standard</text></svg>"
                }},
                "manim_code": null
            }},
            {{
                "id": "scene_4",
                "title": "4. Step-by-Step Worked Exam Problem",
                "scene_type": "example",
                "level_key": "advanced",
                "level_badge": "Level 4: Worked Problem (Advanced)",
                "pedagogical_goal": "Deconstruct entrance exam numerical problems into reliable sequential steps.",
                "analogy": "Like a culinary recipe: inspect ingredients first, combine in sequence, check final taste.",
                "duration_seconds": 20,
                "voiceover_text": "Systematic 3-step breakdown of a high-yield exam question.",
                "visual_instructions": "Step-by-step revealed solution card.",
                "hotspots": [
                    {{"id": "w1", "title": "Extract Givens", "desc": "Identify variables and normalize to standard SI units immediately.", "badge": "Step 1"}},
                    {{"id": "w2", "title": "Select Equation", "desc": "Connect given parameters to the requested target variable.", "badge": "Step 2"}},
                    {{"id": "w3", "title": "Sanity Check", "desc": "Verify physical magnitude, sign, and unit consistency.", "badge": "Step 3"}}
                ],
                "interactive_sim": {{
                    "param_name": "Question Difficulty Level",
                    "min": 1,
                    "max": 5,
                    "default": 3,
                    "unit": "Level",
                    "states": {{
                        "1": {{"label": "Direct Plug-and-Chug", "effect": "Single formula; direct numerical substitution."}},
                        "2": {{"label": "Unit Conversion Trick", "effect": "Non-standard units (e.g. km/h to m/s) required."}},
                        "3": {{"label": "Standard Entrance Level", "effect": "Two-variable simultaneous boundary condition."}},
                        "4": {{"label": "Assertion-Reason Twist", "effect": "Requires theoretical justification of intermediate steps."}},
                        "5": {{"label": "Multi-Chapter Synthesis", "effect": "Combines {clean_topic} with an adjacent syllabus concept."}}
                    }}
                }},
                "checkpoint_quiz": {{
                    "question": "What is the single most common reason students lose marks on this type of exam problem?",
                    "options": [
                        "Failing to convert given quantities into standard SI units before calculation.",
                        "Using the wrong ink color.",
                        "Skipping the calculator on multiple-choice questions."
                    ],
                    "correct_index": 0,
                    "explanation": "Over 60% of lost marks in entrance exams occur due to unit mismatch before calculation!",
                    "hint": "Check the units beside each numerical value carefully."
                }},
                "slide_content": {{
                    "heading": "Worked Exam Example",
                    "subheading": "Application & Calculation Routine",
                    "bullet_points": [
                        "Step 1: Extract given parameters and convert to SI units",
                        "Step 2: Apply the governing formula",
                        "Step 3: Eliminate distractors and verify sanity"
                    ],
                    "diagram_type": "solution_steps",
                    "diagram_svg": "<svg viewBox='0 0 450 140'><rect x='20' y='15' width='410' height='110' rx='10' fill='#141E2A' stroke='#4CC98A'/><text x='40' y='45' fill='#4CC98A' font-size='14' font-weight='bold'>Step 1: Given Variables & Units</text><text x='40' y='75' fill='#E8EEF4' font-size='12'>Step 2: Substitution into Governing Law</text><text x='40' y='105' fill='#54C2F0' font-size='12' font-weight='bold'>Step 3: Verification → Final Result</text></svg>"
                }},
                "manim_code": null
            }},
            {{
                "id": "scene_5",
                "title": "5. High-Yield Exam Recap & Traps",
                "scene_type": "summary",
                "level_key": "mastery",
                "level_badge": "Level 5: Exam Mastery & Traps (Expert)",
                "pedagogical_goal": "Master high-speed elimination shortcuts, negative marking traps, and key formulas.",
                "analogy": "Like reviewing the examiner's marking scheme before walking into the examination hall.",
                "duration_seconds": 14,
                "voiceover_text": "Recap of top percentile exam tactics, common pitfalls, and formula memory locks.",
                "visual_instructions": "Golden summary checklist with animated ticks.",
                "hotspots": [
                    {{"id": "t1", "title": "Negative Sign Trap", "desc": "Examiners often invert direction or sign convention in options A & B.", "badge": "Trap!"}},
                    {{"id": "t2", "title": "Boundary Edge Case", "desc": "Conditions that only hold for ideal or static states.", "badge": "Trap!"}},
                    {{"id": "t3", "title": "Dimensional Shortcut", "desc": "Eliminate 2 wrong choices in 5 seconds via dimensional consistency.", "badge": "Pro-Tip"}}
                ],
                "interactive_sim": {{
                    "param_name": "Exam Time Pressure",
                    "min": 1,
                    "max": 5,
                    "default": 2,
                    "unit": "Pace",
                    "states": {{
                        "1": {{"label": "Relaxed Drill (3 mins/Q)", "effect": "Ample time for full derivation from fundamental laws."}},
                        "2": {{"label": "Standard Exam (90s/Q)", "effect": "Execute standard formulas with fast mental math."}},
                        "3": {{"label": "Speed Sprint (45s/Q)", "effect": "Dimensional elimination and option bracket checking."}},
                        "4": {{"label": "Emergency Guess (15s/Q)", "effect": "Extreme value testing (let x=0 or infinity)."}},
                        "5": {{"label": "Instinctive Mastery (<10s)", "effect": "Immediate visual pattern recognition."}}
                    }}
                }},
                "checkpoint_quiz": {{
                    "question": "When short on time, what is the fastest way to eliminate impossible options?",
                    "options": [
                        "Check dimensional formulas of options; eliminate those mismatching the target unit.",
                        "Always select the longest option.",
                        "Pick the option containing the number 0."
                    ],
                    "correct_index": 0,
                    "explanation": "Dimensional analysis can discard 2 to 3 incorrect choices in seconds without calculation!",
                    "hint": "Physical laws demand identical dimensions on both sides of an equality."
                }},
                "slide_content": {{
                    "heading": "High-Yield Summary & Traps",
                    "subheading": "Top-Percentile Exam Tactics",
                    "bullet_points": [
                        "Watch out for boundary condition traps",
                        "Verify dimensional consistency across options",
                        "Complete interactive drills to seal retention"
                    ],
                    "diagram_type": "checklist",
                    "diagram_svg": "<svg viewBox='0 0 400 130'><rect x='30' y='15' width='340' height='100' rx='12' fill='#1A2634' stroke='#54C2F0'/><text x='60' y='50' fill='#4CC98A' font-size='15'>✔ Core Mechanism Understood</text><text x='60' y='80' fill='#4CC98A' font-size='15'>✔ Formulas & Limits Verified</text><text x='60' y='105' fill='#4CC98A' font-size='15'>✔ Practice Drill Ready</text></svg>"
                }},
                "manim_code": null
            }}
        ]
    }}
    """

    ai_result = await ai_manager.call_llm_json(prompt, system_instruction="You are a professional educational video director. Always output valid JSON strictly adhering to schema.")
    if ai_result and "scenes" in ai_result and len(ai_result["scenes"]) > 0:
        return ai_result

    # Fallback heuristic script
    return generate_heuristic_video_script(clean_topic, clean_subj, exam_name, engine)


def generate_heuristic_video_script(
    topic_name: str,
    subject_name: str,
    exam_name: str,
    engine: str = "remotion"
) -> Dict[str, Any]:
    """Generates structured educational animation script from Basic to Advanced without relying on external APIs."""
    clean_t = topic_name.strip()
    clean_s = subject_name.strip()

    scenes = [
        {
            "id": "scene_1",
            "title": f"1. Intuition: {clean_t}",
            "scene_type": "intro",
            "level_key": "basic",
            "level_badge": "Level 1: Intuition (Basic)",
            "pedagogical_goal": f"Build immediate intuition for {clean_t} using a relatable everyday analogy before formulas.",
            "analogy": f"Think of {clean_t} like an everyday cause-and-effect system: when an initial stimulus occurs, the system passes energy or signals along an orderly path until balance is restored.",
            "duration_seconds": 16,
            "voiceover_text": f"Welcome to this visual masterclass on {clean_t}. Within {clean_s}, we start with simple intuition before any complex math. Think of it like a chain of dominoes: one trigger initiates an orderly sequence toward equilibrium.",
            "visual_instructions": "Sleek animated title slide with pulse effect, subject color bar, and introductory concept card.",
            "hotspots": [
                {"id": "h1", "title": "Input Trigger", "desc": "The primary everyday cause or stimulus initiating the process.", "badge": "Step 1"},
                {"id": "h2", "title": "Response Circuit", "desc": "The pathway carrying the signal or energy.", "badge": "Step 2"},
                {"id": "h3", "title": "Observable Effect", "desc": "The visible real-world outcome produced.", "badge": "Step 3"}
            ],
            "interactive_sim": {
                "param_name": "Input Stimulus Intensity",
                "min": 1,
                "max": 5,
                "default": 2,
                "unit": "Level",
                "states": {
                    "1": {"label": "Sub-threshold / Low", "effect": "Signal too weak; negligible response in baseline state."},
                    "2": {"label": "Baseline / Normal", "effect": "Standard steady-state action pathway triggered."},
                    "3": {"label": "Elevated Response", "effect": "Fast adaptive feedback loops activated."},
                    "4": {"label": "High Stress / Surge", "effect": "Intense activation approaching compensation limit."},
                    "5": {"label": "Peak Saturation", "effect": "Maximum theoretical throughput reached."}
                }
            },
            "checkpoint_quiz": {
                "question": f"Which statement best captures the basic intuition behind {clean_t}?",
                "options": [
                    "It represents how a system adapts its state in response to an input stimulus.",
                    "It operates completely at random with no predictable cause-and-effect.",
                    "It only applies in isolated theoretical environments."
                ],
                "correct_index": 0,
                "explanation": f"At its core, {clean_t} describes how components dynamically interact when stimulated.",
                "hint": "Think of the everyday analogy described in this scene!"
            },
            "slide_content": {
                "heading": clean_t,
                "subheading": f"Level 1: Intuition & Relatable Analogy in {clean_s}",
                "bullet_points": [
                    f"Core curriculum pillar for {exam_name}",
                    "Essential for both conceptual MCQs and analytical derivations"
                ],
                "diagram_type": "concept_badge",
                "diagram_svg": f"<svg viewBox='0 0 400 180'><rect x='20' y='20' width='360' height='140' rx='16' fill='#141E2A' stroke='#0A6C9E' stroke-width='2'/><circle cx='200' cy='75' r='36' fill='#0A6C9E'/><text x='200' y='82' fill='#FFFFFF' font-size='22' text-anchor='middle' font-weight='bold'>✦</text><text x='200' y='135' fill='#E8EEF4' font-size='16' font-weight='bold' text-anchor='middle'>{clean_t}</text></svg>"
            },
            "manim_code": None
        },
        {
            "id": "scene_2",
            "title": "2. Working Mechanism & Anatomy",
            "scene_type": "concept",
            "level_key": "foundation",
            "level_badge": "Level 2: Mechanism (Foundation)",
            "pedagogical_goal": "Trace internal components and understand how each stage works step-by-step.",
            "analogy": f"Like an assembly line or relay race where each node passes information or energy without loss.",
            "duration_seconds": 20,
            "voiceover_text": f"Now let us examine the internal anatomy of {clean_t}. When an initial stimulus enters, it is received by the input gate, processed through the mediator node, and transformed into the calibrated output.",
            "visual_instructions": "Animated sequence diagram showing the step-by-step state transition and invariant preservation.",
            "hotspots": [
                {"id": "m1", "title": "Receptor / Input Gate", "desc": "Detects the specific stimulus or boundary change.", "badge": "A"},
                {"id": "m2", "title": "Mediator Node", "desc": "Applies governing conservation rules without loss.", "badge": "B"},
                {"id": "m3", "title": "Effector / Output Channel", "desc": "Delivers the functional transformation.", "badge": "C"}
            ],
            "interactive_sim": {
                "param_name": "System Transmission Rate",
                "min": 1,
                "max": 5,
                "default": 3,
                "unit": "x Speed",
                "states": {
                    "1": {"label": "0.5x Latency", "effect": "High delay, damped propagation."},
                    "2": {"label": "1.0x Normal", "effect": "Balanced transmission without overshoot."},
                    "3": {"label": "1.5x Accelerated", "effect": "Rapid signal conveyance; minimal loss."},
                    "4": {"label": "2.0x High Frequency", "effect": "Increased dissipation and thermal/energy cost."},
                    "5": {"label": "3.0x Ultra Frequency", "effect": "Potential resonance or bottlenecking at mediator."}
                }
            },
            "checkpoint_quiz": {
                "question": "What happens if the intermediate processing step in this mechanism is bypassed?",
                "options": [
                    "The transformation becomes irregular or fails to reach the calibrated output state.",
                    "The system runs infinitely fast with 100% surplus energy.",
                    "The laws of conservation no longer apply."
                ],
                "correct_index": 0,
                "explanation": "The intermediate step ensures regulatory control and invariant conservation.",
                "hint": "Notice how node B mediates between input and output."
            },
            "slide_content": {
                "heading": "Foundational Mechanism",
                "subheading": "Input → Rule Transformation → Output",
                "bullet_points": [
                    "Active variables and physical/logical parameters",
                    "Conservation laws and invariant constraints"
                ],
                "formula_latex": "f(x) \rightarrow f'(x)",
                "diagram_type": "flowchart",
                "diagram_svg": f"<svg viewBox='0 0 620 140'><rect x='20' y='42' width='125' height='52' rx='10' fill='#141E2A' stroke='#263648' stroke-width='1.5'/><text x='82' y='73' fill='#92A3B5' font-size='12' font-family='system-ui, sans-serif' text-anchor='middle'>Input State</text><line x1='145' y1='68' x2='195' y2='68' stroke='#54C2F0' stroke-width='2.5' stroke-dasharray='4'/><polygon points='195,68 188,64 188,72' fill='#54C2F0'/><rect x='195' y='28' width='230' height='80' rx='14' fill='#0A6C9E' stroke='#54C2F0' stroke-width='1.5'/><foreignObject x='195' y='28' width='230' height='80'><div xmlns='http://www.w3.org/1999/xhtml' style='display:flex;align-items:center;justify-content:center;height:100%;text-align:center;color:#ffffff;font-size:13px;font-weight:700;line-height:1.25;padding:6px 14px;font-family:system-ui,sans-serif;word-break:break-word;overflow:hidden;'>{clean_t}</div></foreignObject><line x1='425' y1='68' x2='475' y2='68' stroke='#4CC98A' stroke-width='2.5'/><polygon points='475,68 468,64 468,72' fill='#4CC98A'/><rect x='475' y='42' width='125' height='52' rx='10' fill='#1B8553' stroke='#4CC98A' stroke-width='1.5'/><text x='537' y='73' fill='#ffffff' font-size='12' font-family='system-ui, sans-serif' text-anchor='middle'>Output</text></svg>"
            },
            "manim_code": None
        },
        {
            "id": "scene_3",
            "title": "3. Mathematical Formulation & Scaling",
            "scene_type": "formula",
            "level_key": "intermediate",
            "level_badge": "Level 3: Formulas & Scaling (Intermediate)",
            "pedagogical_goal": "Connect variables into equations: understand direct vs inverse proportionality.",
            "analogy": "Like a seesaw: increasing the driving term lifts output, while increasing resistance suppresses it.",
            "duration_seconds": 20,
            "voiceover_text": f"Now observe the mathematical formulation of {clean_t}. Understanding the constants, variables, and units allows you to solve standard problems without hesitation.",
            "visual_instructions": "Manim mathematical rendering: Formula transforms and highlights active terms.",
            "hotspots": [
                {"id": "f1", "title": "Driving Term", "desc": "Directly proportional term; larger driving force increases value.", "badge": "Drive"},
                {"id": "f2", "title": "Resistance / Damping", "desc": "Inversely proportional term; acts as opposition or damping.", "badge": "Damping"},
                {"id": "f3", "title": "Dimensional Constant", "desc": "Maintains physical SI unit homogeneity.", "badge": "Constant"}
            ],
            "interactive_sim": {
                "param_name": "Driving vs Resistance Ratio",
                "min": 1,
                "max": 5,
                "default": 3,
                "unit": "Ratio",
                "states": {
                    "1": {"label": "Ratio 0.2 (Heavy Resistance)", "effect": "Output throttled; heavily damped regime."},
                    "2": {"label": "Ratio 0.5 (Moderate Damping)", "effect": "Output grows linearly with driving force."},
                    "3": {"label": "Ratio 1.0 (Critical Balance)", "effect": "Optimal resonance; maximum power transfer."},
                    "4": {"label": "Ratio 2.0 (High Drive)", "effect": "Steep output slope; boundary warnings apply."},
                    "5": {"label": "Ratio 5.0 (Extreme Overdrive)", "effect": "Non-linear saturation region."}
                }
            },
            "checkpoint_quiz": {
                "question": "If the primary driving variable in the formula is doubled while resistance stays constant, what is the expected result?",
                "options": [
                    "The primary outcome approximately doubles (linear proportionality).",
                    "The output drops to zero.",
                    "The output increases by a factor of 100."
                ],
                "correct_index": 0,
                "explanation": "Direct linear proportionality means doubling the numerator doubles the final value.",
                "hint": "Look at the power (exponent) of the variable in the formula."
            },
            "slide_content": {
                "heading": "Governing Mathematical Laws",
                "subheading": "Standard Formula & Unit Analysis",
                "bullet_points": [
                    "Dimensional consistency across parameters",
                    "Direct and inverse proportionality"
                ],
                "formula_latex": f"\\Delta S_{{{clean_t[:3]}}} \ge 0",
                "diagram_type": "formula_callout",
                "diagram_svg": f"<svg viewBox='0 0 450 130'><rect x='20' y='20' width='410' height='90' rx='12' fill='#141E2A' stroke='#F0B23C' stroke-width='2'/><text x='225' y='65' fill='#F0B23C' font-size='18' text-anchor='middle' font-family='monospace'>Governing Equation: {clean_t}</text><text x='225' y='95' fill='#92A3B5' font-size='12' text-anchor='middle'>Units: Verified SI standard</text></svg>"
            },
            "manim_code": f"""from manim import *

class TopicAnimation(Scene):
    def construct(self):
        title = Text("{clean_t}", font_size=34, color=BLUE)
        self.play(Write(title))
        self.wait(1)
        eq = MathTex(r"\Phi = \oint \vec{{E}} \cdot d\vec{{A}}", font_size=40, color=YELLOW)
        self.play(Transform(title, eq))
        self.wait(2)
"""
        },
        {
            "id": "scene_4",
            "title": "4. Step-by-Step Worked Exam Problem",
            "scene_type": "example",
            "level_key": "advanced",
            "level_badge": "Level 4: Worked Problem (Advanced)",
            "pedagogical_goal": "Deconstruct entrance exam numerical problems into reliable sequential steps.",
            "analogy": "Like following a recipe: verify your ingredients first, mix in sequence, check the temperature.",
            "duration_seconds": 20,
            "voiceover_text": "Here is a typical entrance exam problem. By checking boundary constraints and executing the steps systematically, the correct solution emerges cleanly.",
            "visual_instructions": "Interactive problem-solution breakdown with clear numbered steps.",
            "hotspots": [
                {"id": "w1", "title": "Given Extraction", "desc": "Translate problem text into mathematical symbols with SI units.", "badge": "Step 1"},
                {"id": "w2", "title": "Formula Matching", "desc": "Select the exact equation connecting given variables to the unknown.", "badge": "Step 2"},
                {"id": "w3", "title": "Sanity Verification", "desc": "Check sign, order of magnitude, and unit consistency.", "badge": "Step 3"}
            ],
            "interactive_sim": {
                "param_name": "Problem Complexity Parameter",
                "min": 1,
                "max": 5,
                "default": 3,
                "unit": "Difficulty",
                "states": {
                    "1": {"label": "Direct 1-Step Substitution", "effect": "Single formula; direct plug-and-chug MCQ."},
                    "2": {"label": "2-Step Unit Conversion", "effect": "Requires SI prefix conversion before calculation."},
                    "3": {"label": "Standard Entrance Exam Level", "effect": "Two simultaneous equations with boundary condition."},
                    "4": {"label": "Assertion-Reason Twist", "effect": "Requires conceptual justification of step 2."},
                    "5": {"label": "Advanced Multi-Concept Integration", "effect": f"Connects {clean_t} with an adjacent syllabus concept."}
                }
            },
            "checkpoint_quiz": {
                "question": "What is the most frequent reason students lose marks on this problem in competitive exams?",
                "options": [
                    "Forgetting to convert units to SI (e.g. cm to m, or minutes to seconds).",
                    "Using a pen of the wrong color.",
                    "Writing too neatly."
                ],
                "correct_index": 0,
                "explanation": "Over 60% of test errors stem from mismatched units before formula substitution!",
                "hint": "Always check the units beside each numerical value."
            },
            "slide_content": {
                "heading": "Worked Exam Example",
                "subheading": "Application & Calculation Routine",
                "bullet_points": [
                    "Step 1: Extract given parameters from question and convert to SI",
                    "Step 2: Apply the governing formula",
                    "Step 3: Eliminate distractors and verify sanity"
                ],
                "diagram_type": "solution_steps",
                "diagram_svg": "<svg viewBox='0 0 450 140'><rect x='20' y='15' width='410' height='110' rx='10' fill='#141E2A' stroke='#4CC98A'/><text x='40' y='45' fill='#4CC98A' font-size='14' font-weight='bold'>Step 1: Given Variables</text><text x='40' y='75' fill='#E8EEF4' font-size='12'>Step 2: Substitution into Core Law</text><text x='40' y='105' fill='#54C2F0' font-size='12' font-weight='bold'>Step 3: Verification → Final Result</text></svg>"
            },
            "manim_code": None
        },
        {
            "id": "scene_5",
            "title": "5. High-Yield Exam Recap & Traps",
            "scene_type": "summary",
            "level_key": "mastery",
            "level_badge": "Level 5: Exam Mastery & Traps (Expert)",
            "pedagogical_goal": "Lock in top percentile performance: recognize question tricks in 5 seconds.",
            "analogy": "Like having the examiner's answer key and grading rubric in advance.",
            "duration_seconds": 14,
            "voiceover_text": f"In summary, remember these critical takeaways for {clean_t}. Now head into the interactive drills and practice test to cement your mastery!",
            "visual_instructions": "Golden summary checklist with animated celebration ticks.",
            "hotspots": [
                {"id": "t1", "title": "Negative Sign Trap", "desc": "Examiners often flip directions or sign conventions in options A & B.", "badge": "Trap!"},
                {"id": "t2", "title": "Boundary Condition Trap", "desc": "Assumptions that only hold for ideal or static cases.", "badge": "Trap!"},
                {"id": "t3", "title": "Speed Shortcut", "desc": "Eliminate 2 choices immediately using dimensional analysis.", "badge": "Pro-Tip"}
            ],
            "interactive_sim": {
                "param_name": "Exam Time Pressure Simulation",
                "min": 1,
                "max": 5,
                "default": 2,
                "unit": "Speed",
                "states": {
                    "1": {"label": "Relaxed Practice (3 mins/Q)", "effect": "Full derivation possible from scratch."},
                    "2": {"label": "Standard Exam Pace (90 secs/Q)", "effect": "Use direct formula and rapid arithmetic."},
                    "3": {"label": "Speed Sprint (45 secs/Q)", "effect": "Dimension checking and option elimination strategy."},
                    "4": {"label": "Emergency Guess (15 secs/Q)", "effect": "Extreme value testing (let x=0 or x=infinity)."},
                    "5": {"label": "Flawless Intuitive Lock (<10 secs)", "effect": "Immediate visual pattern recognition."}
                }
            },
            "checkpoint_quiz": {
                "question": "When encountering options with dimensional expressions, what is the fastest elimination hack?",
                "options": [
                    "Verify the dimensional formula of each option; eliminate those that do not match the target quantity.",
                    "Always pick the longest option.",
                    "Pick option 'C' automatically."
                ],
                "correct_index": 0,
                "explanation": "Dimensional analysis can eliminate 2 to 3 wrong options in under 10 seconds without full calculation!",
                "hint": "Both sides of an equality must always share identical physical dimensions."
            },
            "slide_content": {
                "heading": "High-Yield Summary & Traps",
                "subheading": "Top-Percentile Exam Tactics",
                "bullet_points": [
                    "Watch out for boundary condition edge cases",
                    "Never skip verifying dimensional consistency",
                    "Complete practice questions to seal retention"
                ],
                "diagram_type": "checklist",
                "diagram_svg": "<svg viewBox='0 0 400 130'><rect x='30' y='15' width='340' height='100' rx='12' fill='#1A2634' stroke='#54C2F0'/><text x='60' y='50' fill='#4CC98A' font-size='15'>✔ Core Mechanism Understood</text><text x='60' y='80' fill='#4CC98A' font-size='15'>✔ Formulas & Limits Verified</text><text x='60' y='105' fill='#4CC98A' font-size='15'>✔ Practice Drill Ready</text></svg>"
            },
            "manim_code": None
        }
    ]

    return {
        "video_title": f"Visual Masterclass: {clean_t}",
        "engine": engine,
        "total_duration": 90,
        "scenes": scenes
    }


# =============================================================================
# 5. Video Generation & Database Pipeline
# =============================================================================

async def create_or_regenerate_video(
    topic_id: str,
    user_id: str,
    exam_id: Optional[str] = None,
    engine: str = "remotion"
) -> Dict[str, Any]:
    """
    Orchestrates the entire video generation workflow:
    1. Fetches topic and syllabus details.
    2. Generates the structured 5-scene educational video script.
    3. Synthesizes voice narration using offline TTS (pyttsx3).
    4. Renders Manim animation scene if requested and supported.
    5. Generates timed synchronized subtitles.
    6. Saves record in educational_videos with status 'completed'.
    """
    conn = get_db()
    cur = conn.cursor()

    # Get topic details
    cur.execute("""
        SELECT t.id, t.topic_name, s.id as subject_id, s.subject_name, s.exam_id
        FROM topics t
        LEFT JOIN subjects s ON t.subject_id = s.id
        WHERE t.id = ?
    """, (topic_id,))
    topic_row = cur.fetchone()
    if not topic_row:
        conn.close()
        raise ValueError(f"Topic not found: {topic_id}")

    topic_name = topic_row["topic_name"]
    subject_name = topic_row["subject_name"] or "General"
    resolved_exam_id = exam_id or topic_row["exam_id"]

    # Get exam name
    exam_name = "Target Examination"
    if resolved_exam_id:
        cur.execute("SELECT exam_name FROM exams WHERE id = ?", (resolved_exam_id,))
        ex_row = cur.fetchone()
        if ex_row:
            exam_name = ex_row["exam_name"]

    video_id = f"vid_{secrets.token_hex(6)}"
    now_str = datetime.now().isoformat()

    # Insert or update record as 'processing'
    cur.execute("""
        SELECT id FROM educational_videos WHERE topic_id = ? AND user_id = ?
    """, (topic_id, user_id))
    existing = cur.fetchone()

    if existing:
        video_id = existing["id"]
        cur.execute("""
            UPDATE educational_videos
            SET status = 'processing', engine = ?, updated_at = ?
            WHERE id = ?
        """, (engine, now_str, video_id))
    else:
        cur.execute("""
            INSERT INTO educational_videos (
                id, user_id, topic_id, exam_id, title, engine, status,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, 'processing', ?, ?)
        """, (video_id, user_id, topic_id, resolved_exam_id, f"Video: {topic_name}", engine, now_str, now_str))

    conn.commit()

    try:
        # Step 1: Generate educational script with scenes
        script_data = await generate_educational_video_script(topic_name, subject_name, exam_name, engine=engine)
        scenes = script_data.get("scenes", [])
        total_duration = float(script_data.get("total_duration", 90))

        # Step 2: Synthesize voice narration
        full_voiceover = " ".join([sc.get("voiceover_text", "") for sc in scenes])
        audio_url = synthesize_narration(full_voiceover, f"{topic_id}_{video_id}")

        # Step 3: Render Manim mathematical animation if present
        manim_url = None
        for sc in scenes:
            if sc.get("manim_code"):
                manim_url = render_manim_scene(sc["manim_code"], f"{topic_id}_manim")
                if manim_url:
                    sc["rendered_clip_url"] = manim_url

        # Step 4: Generate timed subtitles
        subtitles = generate_timed_subtitles(scenes)

        # Step 5: Save completed record
        cur.execute("""
            UPDATE educational_videos
            SET status = 'completed',
                title = ?,
                duration_seconds = ?,
                video_url = ?,
                thumbnail_url = ?,
                script_json = ?,
                scenes_json = ?,
                subtitles_json = ?,
                updated_at = ?
            WHERE id = ?
        """, (
            script_data.get("video_title", f"Video: {topic_name}"),
            total_duration,
            manim_url or audio_url or f"/static/videos/{video_id}.mp4",
            "/static/thumbnails/default_video.png",
            json.dumps(script_data),
            json.dumps(scenes),
            json.dumps(subtitles),
            datetime.now().isoformat(),
            video_id
        ))
        conn.commit()
        conn.close()

        return {
            "id": video_id,
            "topic_id": topic_id,
            "title": script_data.get("video_title", f"Video: {topic_name}"),
            "engine": engine,
            "status": "completed",
            "duration_seconds": total_duration,
            "video_url": manim_url or audio_url,
            "audio_url": audio_url,
            "script": script_data,
            "scenes": scenes,
            "subtitles": subtitles,
            "scenes_json": scenes,
            "subtitles_json": subtitles,
            "script_json": script_data
        }

    except Exception as e:
        logger.error(f"Educational video generation failed: {e}")
        cur.execute("""
            UPDATE educational_videos
            SET status = 'failed', error_message = ?, updated_at = ?
            WHERE id = ?
        """, (str(e), datetime.now().isoformat(), video_id))
        conn.commit()
        conn.close()
        raise e
