import re

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
    <linearGradient id="cycleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0284C7"/>
      <stop offset="100%" stop-color="#38BDF8"/>
    </linearGradient>
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
    <rect width="160" height="42" rx="10" fill="#141E2A" stroke="#10B981" stroke-width="1.5"/>
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

print("[OK] All SVG generators defined and ready.")

