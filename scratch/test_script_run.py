from test_all_svgs import (
    wrap_svg_tspans, detect_visual_archetype, generate_linked_list_svg,
    generate_cycle_svg, generate_pipeline_svg, generate_formula_derivation_svg,
    generate_architecture_flow_svg, generate_topic_diagram_svg
)

def test_heuristic(topic, subj, exam):
    arch = detect_visual_archetype(topic, subj)
    print(f"Topic '{topic}' detected as archetype: {arch}")
    diag = generate_topic_diagram_svg(topic, subj, "auto")
    print(f"  Generated diagram length: {len(diag)}, starts with <svg: {diag.startswith('<svg')}")

test_heuristic("Singly and Doubly Linked Lists", "Computer Science", "GATE CS")
test_heuristic("Water Cycle", "Environmental Science", "CBSE Class 10")
test_heuristic("Newton Second Law", "Physics", "JEE Main")
test_heuristic("HTTP Protocol Handshake", "Networking", "Computer Science")
print("[OK] Test completed successfully!")

