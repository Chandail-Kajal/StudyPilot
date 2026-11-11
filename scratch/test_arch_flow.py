from test_svg_nodes import wrap_svg_tspans

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

out2 = generate_architecture_flow_svg("Singly and Doubly Linked Lists")
print("[OK] Architecture Flow SVG generated, length:", len(out2))

