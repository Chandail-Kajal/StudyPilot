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

import logging

logger = logging.getLogger(__name__)

try:
    from database import get_db
except ImportError:
    from backend.database import get_db
try:
    from ai_provider import ai_manager, extract_clean_json
except ImportError:
    from backend.ai_provider import ai_manager, extract_clean_json

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

# =============================================================================
# 3.5. Visual Archetype & Dynamic SVG Diagram Engine (100% Wrapped, Never Overflows)
# =============================================================================

def wrap_svg_tspans(text: str, center_x: float, center_y: float, max_chars: int = 18, font_size: int = 12, line_height: int = 16, fill: str = "#FFFFFF") -> str:
    words = text.split()
    lines = []
    curr = []
    curr_len = 0
    for w in words:
        if curr and curr_len + len(w) + 1 > max_chars:
            lines.append(" ".join(curr))
            curr = [w]
            curr_len = len(w)
        else:
            curr.append(w)
            curr_len += len(w) + (1 if len(curr) > 1 else 0)
    if curr:
        lines.append(" ".join(curr))
    if not lines:
        lines = [text]
    
    total_h = (len(lines) - 1) * line_height
    start_y = center_y - (total_h / 2)
    
    tspans = []
    for i, line in enumerate(lines):
        y_pos = round(start_y + (i * line_height), 1)
        tspans.append(f'<tspan x="{center_x}" y="{y_pos}">{line}</tspan>')
    
    return f'<text x="{center_x}" fill="{fill}" font-size="{font_size}" font-weight="700" font-family="system-ui, -apple-system, sans-serif" text-anchor="middle">{"".join(tspans)}</text>'

def detect_visual_archetype(topic_name: str, subject_name: str = "") -> str:
    combined = f"{topic_name} {subject_name}".lower()
    if any(k in combined for k in ["linked list", "binary tree", "bst", "heap", "stack", "queue", "graph", "hash table", "data structure", "pointer"]):
        return "data_structure"
    if any(k in combined for k in ["cycle", "krebs", "carbon", "nitrogen", "water cycle", "calvin", "cardiac", "cell cycle", "carnot", "refrigeration", "circulation"]):
        return "cycle"
    if any(k in combined for k in ["how it works", "pipeline", "protocol", "compiler", "dns", "http", "internet", "digestion", "reflex", "algorithm", "process", "synthesis", "transmission"]):
        return "pipeline"
    if any(k in combined for k in ["formula", "equation", "law", "derivation", "energy", "force", "gravity", "calculus", "velocity", "acceleration", "ohm", "thermodynamics", "integral", "derivative"]):
        return "formula"
    return "concept"

def generate_linked_list_svg(topic_name: str) -> str:
    escaped_title = wrap_svg_tspans(topic_name, 360, 24, max_chars=36, font_size=13, fill="#38BDF8")
    return f"""<svg viewBox="0 0 720 170" width="100%" height="100%" style="max-height: 170px; display: block; margin: 0 auto;">
  <defs>
    <linearGradient id="nodeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0F2438"/>
      <stop offset="100%" stop-color="#0369A1"/>
    </linearGradient>
    <marker id="arrowNext" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1 L 10 5 L 0 9 z" fill="#38BDF8"/>
    </marker>
    <marker id="arrowPrev" viewBox="0 0 10 10" refX="4" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 10 1 L 0 5 L 10 9 z" fill="#C084FC"/>
    </marker>
  </defs>

  {escaped_title}

  <!-- Node 1: HEAD -->
  <g transform="translate(40, 52)">
    <rect width="160" height="72" rx="10" fill="url(#nodeGrad)" stroke="#38BDF8" stroke-width="1.8"/>
    <rect x="0" y="0" width="95" height="72" rx="10" fill="rgba(56, 189, 248, 0.1)"/>
    <line x1="95" y1="0" x2="95" y2="72" stroke="#38BDF8" stroke-width="1.5" stroke-dasharray="3"/>
    <text x="48" y="32" fill="#94A3B8" font-size="10" font-family="monospace" text-anchor="middle">HEAD [0]</text>
    <text x="48" y="52" fill="#FFFFFF" font-size="14" font-weight="700" font-family="monospace" text-anchor="middle">val: 12</text>
    <circle cx="128" cy="36" r="6" fill="#38BDF8"/>
    <text x="128" y="55" fill="#38BDF8" font-size="9" font-family="monospace" text-anchor="middle">next</text>
  </g>

  <!-- Forward Pointer (Node 1 -> Node 2) -->
  <line x1="200" y1="76" x2="265" y2="76" stroke="#38BDF8" stroke-width="2.5" marker-end="url(#arrowNext)"/>
  <!-- Backward Pointer (Node 2 -> Node 1 for Doubly) -->
  <line x1="265" y1="96" x2="200" y2="96" stroke="#C084FC" stroke-width="2" stroke-dasharray="3" marker-start="url(#arrowPrev)"/>

  <!-- Node 2 -->
  <g transform="translate(275, 52)">
    <rect width="160" height="72" rx="10" fill="url(#nodeGrad)" stroke="#38BDF8" stroke-width="1.8"/>
    <rect x="0" y="0" width="95" height="72" rx="10" fill="rgba(56, 189, 248, 0.1)"/>
    <line x1="95" y1="0" x2="95" y2="72" stroke="#38BDF8" stroke-width="1.5" stroke-dasharray="3"/>
    <text x="48" y="32" fill="#94A3B8" font-size="10" font-family="monospace" text-anchor="middle">NODE [1]</text>
    <text x="48" y="52" fill="#FFFFFF" font-size="14" font-weight="700" font-family="monospace" text-anchor="middle">val: 45</text>
    <circle cx="128" cy="36" r="6" fill="#38BDF8"/>
    <text x="128" y="55" fill="#38BDF8" font-size="9" font-family="monospace" text-anchor="middle">next</text>
  </g>

  <!-- Forward Pointer (Node 2 -> Node 3) -->
  <line x1="435" y1="76" x2="500" y2="76" stroke="#38BDF8" stroke-width="2.5" marker-end="url(#arrowNext)"/>
  <!-- Backward Pointer (Node 3 -> Node 2 for Doubly) -->
  <line x1="500" y1="96" x2="435" y2="96" stroke="#C084FC" stroke-width="2" stroke-dasharray="3" marker-start="url(#arrowPrev)"/>

  <!-- Node 3: TAIL -->
  <g transform="translate(510, 52)">
    <rect width="160" height="72" rx="10" fill="url(#nodeGrad)" stroke="#10B981" stroke-width="1.8"/>
    <rect x="0" y="0" width="95" height="72" rx="10" fill="rgba(16, 185, 129, 0.1)"/>
    <line x1="95" y1="0" x2="95" y2="72" stroke="#10B981" stroke-width="1.5" stroke-dasharray="3"/>
    <text x="48" y="32" fill="#94A3B8" font-size="10" font-family="monospace" text-anchor="middle">TAIL [2]</text>
    <text x="48" y="52" fill="#FFFFFF" font-size="14" font-weight="700" font-family="monospace" text-anchor="middle">val: 99</text>
    <rect x="110" y="26" width="36" height="20" rx="4" fill="#0C131B" stroke="#64748B"/>
    <text x="128" y="40" fill="#EF4444" font-size="10" font-weight="700" font-family="monospace" text-anchor="middle">NULL</text>
  </g>

  <!-- Legend -->
  <g transform="translate(200, 150)">
    <line x1="0" y1="6" x2="25" y2="6" stroke="#38BDF8" stroke-width="2.5"/>
    <text x="32" y="10" fill="#94A3B8" font-size="11" font-family="system-ui">Next Pointer (Singly/Doubly)</text>
    <line x1="210" y1="6" x2="235" y2="6" stroke="#C084FC" stroke-width="2" stroke-dasharray="3"/>
    <text x="242" y="10" fill="#94A3B8" font-size="11" font-family="system-ui">Prev Pointer (Doubly Only)</text>
  </g>
</svg>"""

def generate_cycle_svg(topic_name: str) -> str:
    escaped_title = wrap_svg_tspans(topic_name, 360, 110, max_chars=18, font_size=12, line_height=16, fill="#FFFFFF")
    return f"""<svg viewBox="0 0 720 220" width="100%" height="100%" style="max-height: 220px; display: block; margin: 0 auto;">
  <defs>
    <linearGradient id="cycleCenterGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0C1E32"/>
      <stop offset="100%" stop-color="#082F49"/>
    </linearGradient>
  </defs>

  <!-- Continuous Circular Orbit Path -->
  <path id="orbitLoop" d="M 360,35 A 190,75 0 1,1 359.9,35 Z" fill="none" stroke="rgba(56, 189, 248, 0.25)" stroke-width="2" stroke-dasharray="6 4"/>

  <!-- Orbiting Energy Particles -->
  <circle r="4.5" fill="#38BDF8">
    <animateMotion dur="5s" repeatCount="indefinite">
      <mpath href="#orbitLoop"/>
    </animateMotion>
  </circle>
  <circle r="4" fill="#34D399">
    <animateMotion dur="5s" begin="-2.5s" repeatCount="indefinite">
      <mpath href="#orbitLoop"/>
    </animateMotion>
  </circle>

  <!-- Stage 1 (Top) -->
  <g transform="translate(280, 8)">
    <rect width="160" height="42" rx="10" fill="#141E2A" stroke="#38BDF8" stroke-width="1.5"/>
    <text x="80" y="20" fill="#38BDF8" font-size="10" font-weight="800" font-family="system-ui" text-anchor="middle">STAGE 1: GENESIS</text>
    <text x="80" y="34" fill="#E2E8F0" font-size="11" font-weight="600" font-family="system-ui" text-anchor="middle">Input / Evaporation</text>
  </g>

  <!-- Stage 2 (Right) -->
  <g transform="translate(530, 88)">
    <rect width="160" height="42" rx="10" fill="#141E2A" stroke="#38BDF8" stroke-width="1.5"/>
    <text x="80" y="20" fill="#38BDF8" font-size="10" font-weight="800" font-family="system-ui" text-anchor="middle">STAGE 2: TRANSFORMATION</text>
    <text x="80" y="34" fill="#E2E8F0" font-size="11" font-weight="600" font-family="system-ui" text-anchor="middle">Condensation / Synthesis</text>
  </g>

  <!-- Stage 3 (Bottom) -->
  <g transform="translate(280, 168)">
    <rect width="160" height="42" rx="10" fill="#10B981" stroke="#10B981" stroke-width="1.5"/>
    <text x="80" y="20" fill="#10B981" font-size="10" font-weight="800" font-family="system-ui" text-anchor="middle">STAGE 3: RELEASE</text>
    <text x="80" y="34" fill="#E2E8F0" font-size="11" font-weight="600" font-family="system-ui" text-anchor="middle">Precipitation / Action</text>
  </g>

  <!-- Stage 4 (Left) -->
  <g transform="translate(30, 88)">
    <rect width="160" height="42" rx="10" fill="#141E2A" stroke="#C084FC" stroke-width="1.5"/>
    <text x="80" y="20" fill="#C084FC" font-size="10" font-weight="800" font-family="system-ui" text-anchor="middle">STAGE 4: RECOVERY</text>
    <text x="80" y="34" fill="#E2E8F0" font-size="11" font-weight="600" font-family="system-ui" text-anchor="middle">Return to Initial State</text>
  </g>

  <!-- Center Core Topic Badge -->
  <circle cx="360" cy="110" r="48" fill="url(#cycleCenterGrad)" stroke="#38BDF8" stroke-width="2"/>
  {escaped_title}
</svg>"""

def generate_pipeline_svg(topic_name: str) -> str:
    escaped_title = wrap_svg_tspans(topic_name, 360, 24, max_chars=36, font_size=13, fill="#38BDF8")
    return f"""<svg viewBox="0 0 720 150" width="100%" height="100%" style="max-height: 150px; display: block; margin: 0 auto;">
  <defs>
    <linearGradient id="pipeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0F2438"/>
      <stop offset="100%" stop-color="#0369A1"/>
    </linearGradient>
    <marker id="pipeArr" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1 L 10 5 L 0 9 z" fill="#38BDF8"/>
    </marker>
  </defs>

  {escaped_title}

  <!-- Stage 1 -->
  <g transform="translate(20, 50)">
    <rect width="140" height="64" rx="10" fill="#141E2A" stroke="#38BDF8" stroke-width="1.5"/>
    <text x="70" y="28" fill="#38BDF8" font-size="10" font-weight="800" font-family="system-ui" text-anchor="middle">STEP 1: INGESTION</text>
    <text x="70" y="48" fill="#FFFFFF" font-size="12" font-weight="600" font-family="system-ui" text-anchor="middle">Input Request</text>
  </g>
  <line x1="160" y1="82" x2="195" y2="82" stroke="#38BDF8" stroke-width="2" marker-end="url(#pipeArr)"/>

  <!-- Stage 2 -->
  <g transform="translate(195, 50)">
    <rect width="150" height="64" rx="10" fill="url(#pipeGrad)" stroke="#38BDF8" stroke-width="1.8"/>
    <text x="75" y="28" fill="#54C2F0" font-size="10" font-weight="800" font-family="system-ui" text-anchor="middle">STEP 2: PARSER</text>
    <text x="75" y="48" fill="#FFFFFF" font-size="12" font-weight="600" font-family="system-ui" text-anchor="middle">Validation & Routing</text>
  </g>
  <line x1="345" y1="82" x2="380" y2="82" stroke="#38BDF8" stroke-width="2" marker-end="url(#pipeArr)"/>

  <!-- Stage 3 -->
  <g transform="translate(380, 50)">
    <rect width="150" height="64" rx="10" fill="url(#pipeGrad)" stroke="#818CF8" stroke-width="1.8"/>
    <text x="75" y="28" fill="#C084FC" font-size="10" font-weight="800" font-family="system-ui" text-anchor="middle">STEP 3: EXECUTION</text>
    <text x="75" y="48" fill="#FFFFFF" font-size="12" font-weight="600" font-family="system-ui" text-anchor="middle">Core Compute Rule</text>
  </g>
  <line x1="530" y1="82" x2="565" y2="82" stroke="#10B981" stroke-width="2" marker-end="url(#pipeArr)"/>

  <!-- Stage 4 -->
  <g transform="translate(565, 50)">
    <rect width="135" height="64" rx="10" fill="#064E3B" stroke="#10B981" stroke-width="1.5"/>
    <text x="67" y="28" fill="#10B981" font-size="10" font-weight="800" font-family="system-ui" text-anchor="middle">STEP 4: OUTPUT</text>
    <text x="67" y="48" fill="#FFFFFF" font-size="12" font-weight="600" font-family="system-ui" text-anchor="middle">Verified Result</text>
  </g>

  <!-- Travelling Packet Animation -->
  <circle r="4" fill="#38BDF8">
    <animate attributeName="cx" values="160;565" dur="3s" repeatCount="indefinite"/>
    <animate attributeName="cy" values="82;82" dur="3s" repeatCount="indefinite"/>
  </circle>
</svg>"""

def generate_formula_derivation_svg(topic_name: str) -> str:
    escaped_title = wrap_svg_tspans(topic_name, 150, 95, max_chars=20, font_size=12, fill="#FFFFFF")
    return f"""<svg viewBox="0 0 720 160" width="100%" height="100%" style="max-height: 160px; display: block; margin: 0 auto;">
  <defs>
    <linearGradient id="eqGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1E1B4B"/>
      <stop offset="100%" stop-color="#312E81"/>
    </linearGradient>
  </defs>

  <!-- Left Card: Equation Spotlight -->
  <g transform="translate(20, 20)">
    <rect width="260" height="120" rx="12" fill="url(#eqGrad)" stroke="#818CF8" stroke-width="1.8"/>
    <text x="130" y="32" fill="#C084FC" font-size="10" font-weight="800" font-family="system-ui" letter-spacing="1" text-anchor="middle">GOVERNING EQUATION</text>
    <text x="130" y="66" fill="#FBBF24" font-size="20" font-weight="700" font-family="serif" text-anchor="middle">y = f(x) · ΔS / Δt</text>
  </g>
  {escaped_title}

  <!-- Right Card: 3 Derivation Verification Steps -->
  <g transform="translate(300, 20)">
    <rect width="400" height="120" rx="12" fill="#0F172A" stroke="#334155" stroke-width="1.5"/>

    <g transform="translate(18, 22)">
      <circle cx="10" cy="10" r="10" fill="rgba(56, 189, 248, 0.2)"/>
      <text x="10" y="14" fill="#38BDF8" font-size="10" font-weight="800" text-anchor="middle">1</text>
      <text x="30" y="14" fill="#E2E8F0" font-size="12" font-weight="600" font-family="system-ui">Identify given variables and convert units to SI standard</text>
    </g>

    <g transform="translate(18, 56)">
      <circle cx="10" cy="10" r="10" fill="rgba(192, 132, 252, 0.2)"/>
      <text x="10" y="14" fill="#C084FC" font-size="10" font-weight="800" text-anchor="middle">2</text>
      <text x="30" y="14" fill="#E2E8F0" font-size="12" font-weight="600" font-family="system-ui">Apply algebraic transformation and boundary constraints</text>
    </g>

    <g transform="translate(18, 90)">
      <circle cx="10" cy="10" r="10" fill="rgba(16, 185, 129, 0.2)"/>
      <text x="10" y="14" fill="#10B981" font-size="10" font-weight="800" text-anchor="middle">3</text>
      <text x="30" y="14" fill="#10B981" font-size="12" font-weight="700" font-family="system-ui">Dimensional consistency checked → Final calibrated answer</text>
    </g>
  </g>
</svg>"""

def generate_architecture_flow_svg(topic_name: str) -> str:
    escaped_title = wrap_svg_tspans(topic_name, 360, 78, max_chars=22, font_size=13, line_height=17, fill="#FFFFFF")
    return f"""<svg viewBox="0 0 720 160" width="100%" height="100%" style="max-height: 160px; display: block; margin: 0 auto;">
  <defs>
    <linearGradient id="archCoreGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0C2338"/>
      <stop offset="100%" stop-color="#0369A1"/>
    </linearGradient>
    <linearGradient id="archInGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#141E2A"/>
      <stop offset="100%" stop-color="#1E293B"/>
    </linearGradient>
    <linearGradient id="archOutGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#064E3B"/>
      <stop offset="100%" stop-color="#047857"/>
    </linearGradient>
    <marker id="archArrow1" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1 L 10 5 L 0 9 z" fill="#38BDF8"/>
    </marker>
    <marker id="archArrow2" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1 L 10 5 L 0 9 z" fill="#10B981"/>
    </marker>
  </defs>

  <!-- Left: Input State -->
  <g transform="translate(24, 44)">
    <rect width="130" height="62" rx="12" fill="url(#archInGrad)" stroke="#334155" stroke-width="1.5"/>
    <text x="65" y="32" fill="#94A3B8" font-size="12" font-weight="700" font-family="system-ui" text-anchor="middle">Input Stimulus</text>
    <text x="65" y="49" fill="#64748B" font-size="10" font-family="monospace" text-anchor="middle">[Initial State]</text>
  </g>

  <!-- Line 1: Input -> Core -->
  <line x1="154" y1="75" x2="208" y2="75" stroke="#38BDF8" stroke-width="2.5" stroke-dasharray="4" marker-end="url(#archArrow1)"/>
  <circle r="3.5" fill="#38BDF8">
    <animate attributeName="cx" from="154" to="208" dur="1.8s" repeatCount="indefinite"/>
    <animate attributeName="cy" values="75;75" dur="1.8s" repeatCount="indefinite"/>
  </circle>

  <!-- Center: Core Governing Principle Box (Spacious 288px wide, wrapped text) -->
  <g transform="translate(216, 28)">
    <rect width="288" height="94" rx="14" fill="url(#archCoreGrad)" stroke="#38BDF8" stroke-width="1.8"/>
    <text x="144" y="24" fill="#54C2F0" font-size="10" font-weight="800" font-family="system-ui" letter-spacing="1" text-anchor="middle">✦ CORE MECHANISM</text>
  </g>
  {escaped_title}

  <!-- Line 2: Core -> Output -->
  <line x1="504" y1="75" x2="558" y2="75" stroke="#10B981" stroke-width="2.5" marker-end="url(#archArrow2)"/>
  <circle r="3.5" fill="#10B981">
    <animate attributeName="cx" from="504" to="558" dur="1.8s" repeatCount="indefinite"/>
    <animate attributeName="cy" values="75;75" dur="1.8s" repeatCount="indefinite"/>
  </circle>

  <!-- Right: Output State -->
  <g transform="translate(566, 44)">
    <rect width="130" height="62" rx="12" fill="url(#archOutGrad)" stroke="#10B981" stroke-width="1.5"/>
    <text x="65" y="32" fill="#FFFFFF" font-size="12" font-weight="700" font-family="system-ui" text-anchor="middle">Stable Output</text>
    <text x="65" y="49" fill="#A7F3D0" font-size="10" font-family="monospace" text-anchor="middle">[Equilibrium]</text>
  </g>
</svg>"""

def generate_concept_badge_svg(topic_name: str, subtitle: str = "Core Educational Pillar") -> str:
    escaped_title = wrap_svg_tspans(topic_name, 360, 105, max_chars=28, font_size=15, line_height=19, fill="#FFFFFF")
    return f"""<svg viewBox="0 0 720 160" width="100%" height="100%" style="max-height: 160px; display: block; margin: 0 auto;">
  <rect x="20" y="16" width="680" height="128" rx="16" fill="#111C2B" stroke="#0284C7" stroke-width="1.8"/>
  <circle cx="360" cy="52" r="26" fill="#0284C7"/>
  <text x="360" y="58" fill="#FFFFFF" font-size="18" text-anchor="middle" font-weight="bold">✦</text>
  {escaped_title}
  <text x="360" y="132" fill="#38BDF8" font-size="11" font-weight="600" font-family="system-ui" text-anchor="middle">{subtitle}</text>
</svg>"""

def generate_recap_checklist_svg(topic_name: str) -> str:
    return f"""<svg viewBox="0 0 720 140" width="100%" height="100%" style="max-height: 140px; display: block; margin: 0 auto;">
  <rect x="20" y="12" width="680" height="116" rx="14" fill="#0F172A" stroke="#38BDF8" stroke-width="1.5"/>
  <g transform="translate(60, 42)">
    <circle cx="10" cy="10" r="10" fill="#10B981"/>
    <text x="10" y="14" fill="#FFFFFF" font-size="11" font-weight="900" text-anchor="middle">✓</text>
    <text x="32" y="14" fill="#F1F5F9" font-size="13" font-weight="600" font-family="system-ui">Foundational Definitions & Core Invariants Understood</text>
  </g>
  <g transform="translate(60, 72)">
    <circle cx="10" cy="10" r="10" fill="#10B981"/>
    <text x="10" y="14" fill="#FFFFFF" font-size="11" font-weight="900" text-anchor="middle">✓</text>
    <text x="32" y="14" fill="#F1F5F9" font-size="13" font-weight="600" font-family="system-ui">Dimensional Limits, SI Units & Governing Equations Verified</text>
  </g>
  <g transform="translate(60, 102)">
    <circle cx="10" cy="10" r="10" fill="#38BDF8"/>
    <text x="10" y="14" fill="#0C131B" font-size="11" font-weight="900" text-anchor="middle">★</text>
    <text x="32" y="14" fill="#38BDF8" font-size="13" font-weight="700" font-family="system-ui">Practice Test Drills & Common Trap Elimination Mastered</text>
  </g>
</svg>"""

def generate_practice_challenge_svg(topic_name: str) -> str:
    escaped_title = wrap_svg_tspans(topic_name, 360, 52, max_chars=32, font_size=14, fill="#38BDF8")
    return f"""<svg viewBox="0 0 720 140" width="100%" height="100%" style="max-height: 140px; display: block; margin: 0 auto;">
  <rect x="20" y="12" width="680" height="116" rx="14" fill="#1E1B4B" stroke="#818CF8" stroke-width="1.8"/>
  <text x="360" y="32" fill="#C084FC" font-size="10" font-weight="800" font-family="system-ui" letter-spacing="1" text-anchor="middle">✦ MASTERCLASS DRILL CHALLENGE ✦</text>
  {escaped_title}
  <g transform="translate(160, 80)">
    <rect width="180" height="34" rx="8" fill="rgba(56, 189, 248, 0.15)" stroke="#38BDF8" stroke-width="1.2"/>
    <text x="90" y="21" fill="#38BDF8" font-size="11" font-weight="700" font-family="system-ui" text-anchor="middle">⏱ Timed Practice Mode</text>
  </g>
  <g transform="translate(380, 80)">
    <rect width="180" height="34" rx="8" fill="rgba(16, 185, 129, 0.15)" stroke="#10B981" stroke-width="1.2"/>
    <text x="90" y="21" fill="#10B981" font-size="11" font-weight="700" font-family="system-ui" text-anchor="middle">🎯 Immediate Feedback</text>
  </g>
</svg>"""

def generate_topic_diagram_svg(topic_name: str, subject_name: str = "", scene_archetype: str = "auto") -> str:
    arch = detect_visual_archetype(topic_name, subject_name) if scene_archetype == "auto" else scene_archetype
    if arch == "data_structure":
        return generate_linked_list_svg(topic_name)
    elif arch == "cycle":
        return generate_cycle_svg(topic_name)
    elif arch == "pipeline":
        return generate_pipeline_svg(topic_name)
    elif arch == "formula":
        return generate_formula_derivation_svg(topic_name)
    else:
        return generate_architecture_flow_svg(topic_name)


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
    """Generates structured 11-scene educational masterclass animation script from Basic to Advanced."""
    clean_t = topic_name.strip()
    clean_s = subject_name.strip()

    scenes = [
        {
            "id": "scene_1",
            "title": f"1. Introduction to {clean_t}",
            "scene_type": "intro",
            "level_key": "basic",
            "deep_explanation": f"In {clean_s}, {clean_t} represents a fundamental mechanism designed to solve the challenges of state transitions and data organization. Rather than treating this as abstract theory, this masterclass approaches {clean_t} through first-principles thinking: understanding what problems it solves, how it minimizes system complexity, and why it is universally adopted across modern computer science and engineering systems.",
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
            "deep_explanation": f"Examiners frequently place high scoring weight on {clean_t} because it combines basic conceptual clarity with deceptive edge cases. Competitive examinations such as {exam_name} test your ability to differentiate between static conditions and dynamic transformations. Mastering this topic gives you an immediate scoring edge by allowing you to spot correct options in seconds.",
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
            "deep_explanation": f"Think of {clean_t} through a tangible physical metaphor: rather than storing items in a rigid, fixed block of contiguous lockers where resizing requires relocating the entire system, components are individual self-contained links scattered flexibly wherever space permits. Each link knows its own value and holds a precise forward pointer pointing directly to where the next link lives.",
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
            "deep_explanation": f"Under the hood, {clean_t} executes in four distinct phases: 1) Parameter Ingestion, where new state or inputs enter; 2) Boundary Invariant Check, confirming references and memory limits; 3) Pointer / Transformation Update, where references are systematically redirected without breaking continuity; and 4) Final Output Verification, returning stable equilibrium.",
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
            "deep_explanation": f"The dynamic archetype diagram above maps the precise architecture of {clean_t}. Notice how each node consists of two essential zones: the payload value (holding data or state) and reference pointer addresses (such as Next and Prev pointers). Observe the NULL boundary condition at the tail: this sentinel invariant guarantees safe termination and protects against infinite loops and memory faults.",
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
            "deep_explanation": f"When solving complex problems on {clean_t}: 1) Always write down given parameters and convert units to standard SI; 2) Check if boundary edge cases (such as single-element systems, empty inputs, or zero-frequency conditions) alter the standard equation; 3) Execute algebraic substitution systematically, verifying dimensional balance at every step.",
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
            "deep_explanation": f"In real-world production engineering, {clean_t} is actively deployed across mission-critical infrastructure: Operating System memory allocation tables, browser forward-backward navigation history stacks, music player continuous playlists, database buffer managers, and real-time graphics rendering pipelines where constant-time O(1) insertions are essential.",
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
            "deep_explanation": f"Beware of the top 3 examiner traps: 1) Unit mismatch (confusing milliseconds with seconds, or bytes with bits); 2) Null Pointer Dereferencing or boundary leaks (forgetting to update the tail pointer or losing reference to head); 3) Assuming O(1) random access when sequential traversal O(n) is actually required.",
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
            "deep_explanation": f"This live checkpoint tests your intuitive grasp of system conservation and state changes. Notice that deterministic state transitions guarantee predictable outcomes under boundary constraints, allowing top students to eliminate illogical distractors without performing lengthy derivations.",
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
            "deep_explanation": f"High-yield revision lock: 1) State invariants are conserved throughout all transitions; 2) Always verify terminal boundary conditions (such as NULL pointers or zero-velocity states) before calculating; 3) Dimensional elimination allows discarding 2 out of 4 options in under 5 seconds.",
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
            "deep_explanation": f"You have now completed the full theoretical and visual breakdown of {clean_t}. Complete the practice drill challenges and interactive quizzes in the next tab to lock this into long-term memory for guaranteed exam success.",
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

    total_duration = sum(s["duration_seconds"] for s in scenes)
    return {
        "video_title": f"Visual Masterclass: {clean_t}",
        "engine": engine,
        "total_duration": total_duration,
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
                audio_url = ?,
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
            audio_url,
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
