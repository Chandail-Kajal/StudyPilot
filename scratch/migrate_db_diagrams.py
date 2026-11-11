from backend.database import get_db
from backend.video_generator import generate_heuristic_video_script, generate_topic_diagram_svg, detect_visual_archetype
import json
from datetime import datetime

conn = get_db()
cur = conn.cursor()

# 1. Update educational_videos
cur.execute("SELECT id, topic_id, title FROM educational_videos")
vrows = cur.fetchall()
print(f"Found {len(vrows)} video records to upgrade with 11-scene YouTube masterclass format.")

for r in vrows:
    vid = r["id"]
    t_id = r["topic_id"]
    # Get topic and exam details
    cur.execute("""
        SELECT t.topic_name, s.subject_name, e.exam_name 
        FROM topics t
        LEFT JOIN subjects s ON t.subject_id = s.id
        LEFT JOIN exams e ON s.exam_id = e.id
        WHERE t.id = %s
    """, (t_id,))
    t_row = cur.fetchone()
    if t_row:
        t_name = t_row["topic_name"]
        s_name = t_row["subject_name"] or "General"
        e_name = t_row["exam_name"] or "Target Examination"
        print(f"Upgrading video for '{t_name}' ({t_id})...")
        script = generate_heuristic_video_script(t_name, s_name, e_name)
        scenes = script["scenes"]
        duration = script["total_duration"]
        
        cur.execute("""
            UPDATE educational_videos 
            SET scenes_json = %s, script_json = %s, duration_seconds = %s, updated_at = %s 
            WHERE id = %s
        """, (json.dumps(scenes), json.dumps(script), duration, datetime.now().isoformat(), vid))

# 2. Update topic_learning_content diagrams_and_visuals
cur.execute("SELECT topic_id, sections FROM topic_learning_content")
trows = cur.fetchall()
print(f"Checking {len(trows)} topic_learning_content records...")

for r in trows:
    t_id = r["topic_id"]
    cur.execute("SELECT topic_name, subject_name FROM topics t LEFT JOIN subjects s ON t.subject_id = s.id WHERE t.id = %s", (t_id,))
    t_row = cur.fetchone()
    if t_row:
        t_name = t_row["topic_name"]
        s_name = t_row["subject_name"] or "General"
        arch = detect_visual_archetype(t_name, s_name)
        new_svg = generate_topic_diagram_svg(t_name, s_name, arch)
        
        # Check if sections has diagram_svg
        if r["sections"]:
            try:
                sec = json.loads(r["sections"]) if isinstance(r["sections"], str) else r["sections"]
                if isinstance(sec, dict) and "diagrams_and_visuals" in sec:
                    sec["diagrams_and_visuals"]["diagram_svg"] = new_svg
                    cur.execute("UPDATE topic_learning_content SET sections = %s WHERE topic_id = %s", (json.dumps(sec), t_id))
                    print(f"Updated diagrams_and_visuals for {t_name}")
            except Exception as e:
                pass

conn.commit()
conn.close()
print("[OK] Database migration completed successfully!")

