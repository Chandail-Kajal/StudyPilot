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
  <g transform="translate(230, 148)">
    <line x1="0" y1="6" x2="25" y2="6" stroke="#38BDF8" stroke-width="2.5"/>
    <text x="32" y="10" fill="#94A3B8" font-size="11" font-family="system-ui">Next Pointer (Singly/Doubly)</text>
    <line x1="195" y1="6" x2="220" y2="6" stroke="#C084FC" stroke-width="2" stroke-dasharray="3"/>
    <text x="227" y="10" fill="#94A3B8" font-size="11" font-family="system-ui">Prev Pointer (Doubly Only)</text>
  </g>
</svg>"""

out = generate_linked_list_svg("Singly and Doubly Linked Lists")
print("[OK] Linked List SVG generated successfully, length:", len(out))

