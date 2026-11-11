import math

def generate_animated_cycle_svg(stages, active_idx=0, title="Continuous Cycle Process"):
    """
    Generates a professional circular cycle SVG with animated circulating energy particles
    and highlighted active stage.
    """
    width, height = 640, 360
    cx, cy = 320, 180
    radius = 115

    n = len(stages)
    nodes = []
    for i, s in enumerate(stages):
        angle = (2 * math.pi / n) * i - (math.pi / 2) # start at top
        x = cx + radius * math.cos(angle)
        y = cy + radius * math.sin(angle)
        nodes.append({"label": s, "x": x, "y": y, "angle": angle, "is_active": i == active_idx})

    # Build circular path for animateMotion
    # Arc between nodes
    path_d = f"M {cx} {cy - radius} "
    for i in range(1, n + 1):
        angle = (2 * math.pi / n) * (i % n) - (math.pi / 2)
        x = cx + radius * math.cos(angle)
        y = cy + radius * math.sin(angle)
        path_d += f"A {radius} {radius} 0 0 1 {x:.1f} {y:.1f} "

    # Color palette
    colors = ["#38BDF8", "#10B981", "#F59E0B", "#EC4899", "#8B5CF6"]

    svg = f"""<svg viewBox="0 0 {width} {height}" width="100%" height="100%" style="max-height: 360px; display: block; margin: 0 auto; background: #0C131B; border-radius: 14px;">
  <defs>
    <linearGradient id="cycleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38BDF8"/>
      <stop offset="50%" stop-color="#10B981"/>
      <stop offset="100%" stop-color="#8B5CF6"/>
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="4" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>

  <!-- Cycle Title Badge -->
  <rect x="20" y="14" width="220" height="28" rx="6" fill="#141E2A" stroke="#263648" stroke-width="1"/>
  <text x="30" y="32" fill="#38BDF8" font-size="11" font-weight="700" font-family="system-ui, sans-serif">🔄 CONTINUOUS CYCLE PROCESS</text>

  <!-- Center Hub with Pulsing Core -->
  <circle cx="{cx}" cy="{cy}" r="38" fill="#141E2A" stroke="#263648" stroke-width="2"/>
  <circle cx="{cx}" cy="{cy}" r="26" fill="rgba(56, 189, 248, 0.15)" stroke="#38BDF8" stroke-width="1.5" stroke-dasharray="3,3"/>
  <text x="{cx}" y="{cy - 4}" fill="#E8EEF4" font-size="10" font-weight="800" text-anchor="middle" font-family="system-ui, sans-serif">CYCLE</text>
  <text x="{cx}" y="{cy + 10}" fill="#38BDF8" font-size="9" font-weight="700" text-anchor="middle" font-family="system-ui, sans-serif">INVARIANTS</text>

  <!-- Background Orbit Path -->
  <circle cx="{cx}" cy="{cy}" r="{radius}" fill="none" stroke="#263648" stroke-width="3" stroke-dasharray="6,6"/>
  <path id="cycleOrbitPath" d="{path_d}" fill="none" stroke="url(#cycleGrad)" stroke-width="2.5" opacity="0.85"/>

  <!-- Animated Circulating Energy Particles -->
  <circle r="5" fill="#38BDF8" filter="url(#glow)">
    <animateMotion dur="6s" repeatCount="indefinite" path="{path_d}"/>
  </circle>
  <circle r="4" fill="#10B981" filter="url(#glow)">
    <animateMotion dur="6s" begin="3s" repeatCount="indefinite" path="{path_d}"/>
  </circle>
"""

    # Draw Nodes
    for i, node in enumerate(nodes):
        nx, ny = node["x"], node["y"]
        col = colors[i % len(colors)]
        w_box, h_box = 130, 48
        bx, by = nx - (w_box / 2), ny - (h_box / 2)

        border_w = "2.5" if node["is_active"] else "1.5"
        border_col = col if node["is_active"] else "#334155"
        bg_col = f"rgba(15, 23, 42, 0.95)"

        svg += f"""
  <!-- Node {i+1}: {node['label']} -->
  <g>
    <rect x="{bx:.1f}" y="{by:.1f}" width="{w_box}" height="{h_box}" rx="10" fill="{bg_col}" stroke="{border_col}" stroke-width="{border_w}"/>
    <circle cx="{bx + 14}" cy="{by + 14}" r="7" fill="{col}"/>
    <text x="{bx + 14}" y="{by + 17}" fill="#FFFFFF" font-size="9" font-weight="800" text-anchor="middle" font-family="system-ui, sans-serif">{i+1}</text>
    <foreignObject x="{bx + 24}" y="{by + 4}" width="{w_box - 28}" height="{h_box - 8}">
      <div xmlns="http://www.w3.org/1999/xhtml" style="display:flex;align-items:center;height:100%;color:#FFFFFF;font-size:11px;font-weight:700;line-height:1.2;font-family:system-ui,sans-serif;word-break:break-word;overflow:hidden;">
        {node['label']}
      </div>
    </foreignObject>
  </g>
"""

    svg += "</svg>"
    return svg

# Test run
test_stages = ["Evaporation (Liquid → Vapor)", "Condensation (Cloud Formation)", "Precipitation (Rain / Snow)", "Collection & Infiltration"]
test_svg = generate_animated_cycle_svg(test_stages, active_idx=1)
print(f"Cycle SVG generated successfully! Length: {len(test_svg)} chars")
assert "<animateMotion" in test_svg
assert "Evaporation" in test_svg
print("Cycle SVG verified.")

