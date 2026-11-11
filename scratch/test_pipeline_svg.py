def generate_animated_pipeline_svg(steps, active_idx=0, title="Process & Pipeline Flow"):
    width, height = 660, 260
    n = len(steps)
    node_w = min(120, int((width - 80) / n) - 16)
    node_h = 60
    gap = (width - 60 - (n * node_w)) / max(1, n - 1)
    y_pos = 110

    colors = ["#38BDF8", "#10B981", "#8B5CF6", "#F59E0B", "#EC4899", "#06B6D4"]

    svg = f"""<svg viewBox="0 0 {width} {height}" width="100%" height="100%" style="max-height: 260px; display: block; margin: 0 auto; background: #0C131B; border-radius: 14px;">
  <defs>
    <linearGradient id="pipeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#38BDF8"/>
      <stop offset="100%" stop-color="#10B981"/>
    </linearGradient>
    <filter id="packetGlow">
      <feGaussianBlur stdDeviation="3" result="blur"/>
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
    </filter>
  </defs>

  <rect x="20" y="14" width="220" height="28" rx="6" fill="#141E2A" stroke="#263648" stroke-width="1"/>
  <text x="30" y="32" fill="#10B981" font-size="11" font-weight="700" font-family="system-ui, sans-serif">⚡ {title.upper()}</text>
"""
    # Draw connections and animated signal pulse
    for i in range(n - 1):
        x1 = 30 + i * (node_w + gap) + node_w
        x2 = 30 + (i + 1) * (node_w + gap)
        ym = y_pos + (node_h / 2)
        svg += f"""
  <line x1="{x1}" y1="{ym}" x2="{x2}" y2="{ym}" stroke="#263648" stroke-width="3" stroke-dasharray="4,4"/>
  <path d="M {x1} {ym} L {x2} {ym}" fill="none" stroke="#38BDF8" stroke-width="2"/>
  <circle r="4" fill="#38BDF8" filter="url(#packetGlow)">
    <animateMotion dur="2.5s" repeatCount="indefinite" path="M {x1} {ym} L {x2} {ym}"/>
  </circle>
  <polygon points="{x2},{ym} {x2-6},{ym-4} {x2-6},{ym+4}" fill="#38BDF8"/>
"""

    # Draw Nodes
    for i, step in enumerate(steps):
        x = 30 + i * (node_w + gap)
        col = colors[i % len(colors)]
        is_active = i == active_idx
        border_col = col if is_active else "#263648"
        border_w = "2.5" if is_active else "1"

        svg += f"""
  <g>
    <rect x="{x}" y="{y_pos}" width="{node_w}" height="{node_h}" rx="10" fill="#141E2A" stroke="{border_col}" stroke-width="{border_w}"/>
    <rect x="{x}" y="{y_pos}" width="{node_w}" height="18" rx="10" fill="{col}" fill-opacity="0.2"/>
    <text x="{x + 8}" y="{y_pos + 13}" fill="{col}" font-size="10" font-weight="800" font-family="system-ui, sans-serif">STEP {i+1}</text>
    <foreignObject x="{x + 6}" y="{y_pos + 20}" width="{node_w - 12}" height="{node_h - 22}">
      <div xmlns="http://www.w3.org/1999/xhtml" style="display:flex;align-items:center;height:100%;color:#FFFFFF;font-size:11px;font-weight:700;line-height:1.2;font-family:system-ui,sans-serif;word-break:break-word;overflow:hidden;">
        {step}
      </div>
    </foreignObject>
  </g>
"""

    svg += "</svg>"
    return svg

test_steps = ["User Device", "Router Gateway", "ISP Backbone", "DNS Lookup", "Server Processing", "Client Render"]
res = generate_animated_pipeline_svg(test_steps, active_idx=3)
print("Pipeline SVG created. Length:", len(res))

