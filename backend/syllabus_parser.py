import io
import re
import csv
import json
import secrets
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from pypdf import PdfReader
import openpyxl

try:
    import fitz  # PyMuPDF
    HAS_PYMUPDF = True
except ImportError:
    HAS_PYMUPDF = False

try:
    import pandas as pd
    HAS_PANDAS = True
except ImportError:
    HAS_PANDAS = False

try:
    import xlrd
    HAS_XLRD = True
except ImportError:
    HAS_XLRD = False

import ai_service

SUBJECT_COLORS = [
    '#3E7BE0', '#1FA095', '#D99211', '#D04F73', 
    '#7C62D9', '#4C9A2A', '#E06A3B', '#2A8EA0',
    '#B54894', '#556EE6', '#26B487', '#E55353'
]

COMMON_SUBJECT_KEYWORDS = [
    "physics", "chemistry", "mathematics", "maths", "math", "biology",
    "computer science", "informatics", "data science", "statistics",
    "english", "literature", "history", "geography", "economics",
    "political science", "psychology", "sociology", "accounting",
    "business studies", "finance", "general knowledge", "logical reasoning",
    "quantitative aptitude", "reasoning", "general awareness", "data structures",
    "operating systems", "database", "algorithms"
]

CANONICAL_COLUMNS = [
    "exam_name",
    "subject_name",
    "unit_name",
    "chapter_name",
    "topic_name",
    "subtopic_name",
    "topic_order",
    "difficulty",
    "estimated_minutes",
    "importance",
    "source_page",
    "source_ref"
]

def clean_name(val: Any) -> str:
    if val is None:
        return ""
    s = str(val).strip()
    # Remove leading numbering like "1.", "Unit 1:", "Chapter 3 -"
    s = re.sub(r'^(unit\s*\d+[:\-–]?|chapter\s*\d+[:\-–]?|module\s*\d+[:\-–]?|\d+[\.\)]\s*)', '', s, flags=re.IGNORECASE).strip()
    return s

def normalize_difficulty(val: Any) -> str:
    if not val:
        return "medium"
    s = str(val).strip().lower()
    if any(k in s for k in ["easy", "basic", "fundamental", "low"]):
        return "easy"
    if any(k in s for k in ["hard", "difficult", "advanced", "complex"]):
        return "hard"
    return "medium"

def normalize_importance(val: Any) -> str:
    if not val:
        return "medium"
    s = str(val).strip().lower()
    if any(k in s for k in ["very high", "critical", "must", "very_high"]):
        return "very_high"
    if any(k in s for k in ["high", "important"]):
        return "high"
    if any(k in s for k in ["low", "optional"]):
        return "low"
    return "medium"

def normalize_minutes(val: Any) -> int:
    if not val:
        return 45
    s = str(val).strip().lower()
    # Check for hours e.g. "6 hours", "4h"
    m_hour = re.search(r'(\d+(?:\.\d+)?)\s*(?:hr|hour|h\b)', s)
    if m_hour:
        try:
            return max(15, min(720, int(float(m_hour.group(1)) * 60)))
        except Exception:
            pass
    # Check numeric
    digits = re.search(r'\d+', s)
    if digits:
        v = int(digits.group(0))
        # If <= 12, likely hours
        if v <= 12:
            return v * 60
        return max(15, min(720, v))
    return 45

def detect_column_mappings(headers: List[str]) -> Dict[str, str]:
    """
    Auto-detects mapping from raw headers to canonical column names:
    exam_name, subject_name, unit_name, chapter_name, topic_name,
    subtopic_name, topic_order, difficulty, estimated_minutes, importance.
    """
    mapping: Dict[str, str] = {}
    for h in headers:
        if not h:
            continue
        norm = h.strip().lower()
        if any(k in norm for k in ["exam", "course"]):
            mapping[h] = "exam_name"
        elif any(k in norm for k in ["subject", "discipline", "paper"]):
            mapping[h] = "subject_name"
        elif any(k in norm for k in ["unit", "module", "section"]):
            mapping[h] = "unit_name"
        elif any(k in norm for k in ["chapter"]):
            mapping[h] = "chapter_name"
        elif any(k in norm for k in ["subtopic", "sub_topic"]):
            mapping[h] = "subtopic_name"
        elif any(k in norm for k in ["topic", "concept", "syllabus", "content", "title"]):
            mapping[h] = "topic_name"
        elif any(k in norm for k in ["order", "seq", "s.no", "sr no", "id"]):
            mapping[h] = "topic_order"
        elif any(k in norm for k in ["diff", "level"]):
            mapping[h] = "difficulty"
        elif any(k in norm for k in ["minute", "duration", "time", "hour", "hours"]):
            mapping[h] = "estimated_minutes"
        elif any(k in norm for k in ["importan", "weight", "prio"]):
            mapping[h] = "importance"
    return mapping

def extract_text_from_pdf(file_bytes: bytes) -> str:
    """Extracts raw text content using PyMuPDF (fitz) with OCR fallback for scanned pages or fallback to pypdf."""
    if HAS_PYMUPDF:
        try:
            doc = fitz.open(stream=file_bytes, filetype="pdf")
            extracted = []
            for i, page in enumerate(doc):
                text = page.get_text("text")
                if text and text.strip() and len(text.strip()) > 35:
                    extracted.append(f"--- Page {i+1} ---\n" + text.strip())
                else:
                    # Scanned PDF page OCR fallback
                    try:
                        from PIL import Image
                        import pytesseract
                        pix = page.get_pixmap(dpi=150)
                        img = Image.open(io.BytesIO(pix.tobytes("png")))
                        ocr_text = pytesseract.image_to_string(img)
                        if ocr_text and ocr_text.strip():
                            extracted.append(f"--- Page {i+1} (OCR) ---\n" + ocr_text.strip())
                        elif text and text.strip():
                            extracted.append(f"--- Page {i+1} ---\n" + text.strip())
                    except Exception as ocr_err:
                        if text and text.strip():
                            extracted.append(f"--- Page {i+1} ---\n" + text.strip())
            if extracted:
                return "\n\n".join(extracted)
        except Exception as e:
            print(f"[Syllabus Parser Notice] PyMuPDF extract failed: {e}. Falling back to pypdf.")

    reader = PdfReader(io.BytesIO(file_bytes))
    extracted = []
    for i, page in enumerate(reader.pages):
        text = page.extract_text()
        if text:
            extracted.append(f"--- Page {i+1} ---\n" + text.strip())
    return "\n\n".join(extracted)

def extract_text_from_docx(file_bytes: bytes) -> str:
    """Extracts text and table rows from Word (.docx) syllabus files."""
    try:
        import docx
        doc = docx.Document(io.BytesIO(file_bytes))
        paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
        for table in doc.tables:
            for row in table.rows:
                cells = [c.text.strip() for c in row.cells if c.text.strip()]
                if cells:
                    paragraphs.append(" | ".join(cells))
        return "\n".join(paragraphs)
    except Exception as e:
        print(f"Error extracting docx: {e}")
        return ""

def extract_text_from_image(file_bytes: bytes) -> str:
    """Extracts text from scanned syllabus images via OCR (pytesseract or PIL)."""
    try:
        from PIL import Image
        import pytesseract
        image = Image.open(io.BytesIO(file_bytes))
        text = pytesseract.image_to_string(image)
        return text or ""
    except Exception as e:
        print(f"Error running OCR on image: {e}")
        return ""

def parse_and_preview_syllabus(
    file_bytes: bytes,
    filename: str,
    exam_name: Optional[str] = "Selected Exam",
    default_subject: Optional[str] = None,
    scope: str = "complete",  # "complete" or "subject"
    custom_mapping: Optional[Dict[str, str]] = None,
    existing_topics: Optional[List[str]] = None,
    preparsed_rows: Optional[List[Dict[str, Any]]] = None,
    analysis_source: Optional[str] = None
) -> Dict[str, Any]:
    """
    Standardized multi-format preview parser.
    Normalizes every syllabus into the hierarchy:
    Exam -> Subject -> Unit -> Chapter -> Topic -> Subtopic.
    Returns:
    - rows: list of normalized row dictionaries with validation status
    - detected_columns: original headers detected in the file
    - summary: counts of subjects, units, chapters, topics, valid, duplicate, correction
    """
    ext = filename.lower().split(".")[-1] if "." in filename else ""
    raw_rows: List[Dict[str, Any]] = []
    detected_headers: List[str] = []

    existing_set = set(t.strip().lower() for t in (existing_topics or []))
    active_exam = exam_name or "Target Examination"
    fallback_subject = (default_subject.strip() if default_subject and default_subject.strip() else None)

    if preparsed_rows is not None:
        raw_rows = preparsed_rows
    # 1. Excel (.xlsx)
    elif ext == "xlsx":
        wb = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True)
        # Check if sheets represent subjects
        valid_sheets = [s for s in wb.sheetnames if s.strip().lower() not in ["sheet", "sheet1", "instructions", "readme"]]
        is_multi_sheet = len(valid_sheets) > 1 and scope != "subject"

        for sheet in wb.worksheets:
            sheet_title = sheet.title.strip()
            sheet_rows = list(sheet.iter_rows(values_only=True))
            if not sheet_rows:
                continue

            # Find header row
            header_idx = -1
            headers = []
            for r_idx, r in enumerate(sheet_rows[:6]):
                cells = [str(c).strip() for c in r if c is not None and str(c).strip()]
                if any(any(k in c.lower() for k in ["topic", "chapter", "subject", "unit", "content"]) for c in cells):
                    header_idx = r_idx
                    headers = [str(c).strip() if c is not None else f"col_{ci}" for ci, c in enumerate(r)]
                    break

            if header_idx != -1 and headers:
                detected_headers = list(dict.fromkeys(detected_headers + [h for h in headers if not h.startswith("col_")]))
                mapping = custom_mapping or detect_column_mappings(headers)

                for r in sheet_rows[header_idx + 1:]:
                    if not r or all(c is None for c in r):
                        continue
                    row_dict = {}
                    for ci, h in enumerate(headers):
                        if ci < len(r):
                            field = mapping.get(h)
                            if field:
                                row_dict[field] = r[ci]

                    topic = clean_name(row_dict.get("topic_name") or (r[0] if len(r) > 0 else ""))
                    if not topic or len(topic) < 2:
                        continue

                    subj = clean_name(row_dict.get("subject_name"))
                    if not subj:
                        subj = fallback_subject or (sheet_title if is_multi_sheet else "General")

                    raw_rows.append({
                        "exam_name": clean_name(row_dict.get("exam_name")) or active_exam,
                        "subject_name": subj,
                        "unit_name": clean_name(row_dict.get("unit_name")) or "Core Units",
                        "chapter_name": clean_name(row_dict.get("chapter_name")) or "Main Chapter",
                        "topic_name": topic,
                        "subtopic_name": clean_name(row_dict.get("subtopic_name")),
                        "topic_order": row_dict.get("topic_order") or len(raw_rows) + 1,
                        "difficulty": normalize_difficulty(row_dict.get("difficulty")),
                        "estimated_minutes": normalize_minutes(row_dict.get("estimated_minutes")),
                        "importance": normalize_importance(row_dict.get("importance"))
                    })
            else:
                # Tabular fallback without clear header
                subj = fallback_subject or (sheet_title if is_multi_sheet else "General")
                for r in sheet_rows:
                    non_empty = [str(c).strip() for c in r if c is not None and str(c).strip()]
                    if not non_empty:
                        continue
                    if len(non_empty) >= 2:
                        raw_rows.append({
                            "exam_name": active_exam,
                            "subject_name": non_empty[0] if not fallback_subject else fallback_subject,
                            "unit_name": "Unit 1",
                            "chapter_name": "General Chapter",
                            "topic_name": clean_name(non_empty[1]),
                            "subtopic_name": clean_name(non_empty[2]) if len(non_empty) > 2 else "",
                            "difficulty": "medium",
                            "estimated_minutes": 45,
                            "importance": "medium"
                        })
                    elif len(non_empty) == 1 and len(non_empty[0]) > 2:
                        raw_rows.append({
                            "exam_name": active_exam,
                            "subject_name": subj,
                            "unit_name": "Unit 1",
                            "chapter_name": "General Chapter",
                            "topic_name": clean_name(non_empty[0]),
                            "subtopic_name": "",
                            "difficulty": "medium",
                            "estimated_minutes": 45,
                            "importance": "medium"
                        })

    # 2. Excel (.xls) via xlrd
    elif ext == "xls":
        if HAS_XLRD:
            book = xlrd.open_workbook(file_contents=file_bytes)
            valid_sheets = [book.sheet_by_name(name) for name in book.sheet_names()]
            for sheet in valid_sheets:
                if sheet.nrows == 0:
                    continue
                header_row = [str(sheet.cell_value(0, c)).strip() for c in range(sheet.ncols)]
                detected_headers = list(dict.fromkeys(detected_headers + header_row))
                mapping = custom_mapping or detect_column_mappings(header_row)

                subj = fallback_subject or (sheet.name.strip() if len(valid_sheets) > 1 else "General")
                for r_idx in range(1, sheet.nrows):
                    row_dict = {}
                    for c_idx in range(sheet.ncols):
                        h = header_row[c_idx]
                        field = mapping.get(h)
                        if field:
                            row_dict[field] = sheet.cell_value(r_idx, c_idx)

                    top = clean_name(row_dict.get("topic_name") or sheet.cell_value(r_idx, 0))
                    if not top or len(top) < 2:
                        continue

                    raw_rows.append({
                        "exam_name": clean_name(row_dict.get("exam_name")) or active_exam,
                        "subject_name": clean_name(row_dict.get("subject_name")) or subj,
                        "unit_name": clean_name(row_dict.get("unit_name")) or "Core Units",
                        "chapter_name": clean_name(row_dict.get("chapter_name")) or "General Chapter",
                        "topic_name": top,
                        "subtopic_name": clean_name(row_dict.get("subtopic_name")),
                        "difficulty": normalize_difficulty(row_dict.get("difficulty")),
                        "estimated_minutes": normalize_minutes(row_dict.get("estimated_minutes")),
                        "importance": normalize_importance(row_dict.get("importance"))
                    })
        else:
            # Fallback if xlrd not present
            text = file_bytes.decode("latin-1", errors="ignore")
            # Parse text heuristics
            raw_rows = _parse_text_to_preview_rows(text, active_exam, fallback_subject)

    # 3. CSV (.csv)
    elif ext == "csv":
        text_str = file_bytes.decode("utf-8", errors="ignore")
        # Detect delimiter
        delimiter = ","
        if "\t" in text_str and text_str.count("\t") > text_str.count(","):
            delimiter = "\t"
        elif ";" in text_str and text_str.count(";") > text_str.count(","):
            delimiter = ";"

        reader = csv.reader(io.StringIO(text_str), delimiter=delimiter)
        csv_rows = list(reader)
        if csv_rows:
            header_row = [c.strip() for c in csv_rows[0]]
            detected_headers = [h for h in header_row if h]
            mapping = custom_mapping or detect_column_mappings(header_row)

            for r in csv_rows[1:]:
                if not r or all(not str(c).strip() for c in r):
                    continue
                row_dict = {}
                for ci, h in enumerate(header_row):
                    if ci < len(r):
                        field = mapping.get(h)
                        if field:
                            row_dict[field] = r[ci]

                top = clean_name(row_dict.get("topic_name") or (r[1] if len(r) > 1 else r[0]))
                if not top or len(top) < 2:
                    continue

                subj = clean_name(row_dict.get("subject_name"))
                if not subj:
                    subj = fallback_subject or (clean_name(r[0]) if len(r) > 1 else "General")

                raw_rows.append({
                    "exam_name": clean_name(row_dict.get("exam_name")) or active_exam,
                    "subject_name": subj,
                    "unit_name": clean_name(row_dict.get("unit_name")) or "Core Section",
                    "chapter_name": clean_name(row_dict.get("chapter_name")) or "Main Chapter",
                    "topic_name": top,
                    "subtopic_name": clean_name(row_dict.get("subtopic_name")),
                    "difficulty": normalize_difficulty(row_dict.get("difficulty")),
                    "estimated_minutes": normalize_minutes(row_dict.get("estimated_minutes")),
                    "importance": normalize_importance(row_dict.get("importance"))
                })

    # 4. DOCX (.docx, .doc)
    elif ext in ["docx", "doc"]:
        raw_text = extract_text_from_docx(file_bytes)
        raw_rows = _parse_text_to_preview_rows(raw_text, active_exam, fallback_subject)

    # 5. Images (.png, .jpg, .jpeg, .webp, .tiff)
    elif ext in ["png", "jpg", "jpeg", "webp", "tiff", "bmp"]:
        raw_text = extract_text_from_image(file_bytes)
        raw_rows = _parse_text_to_preview_rows(raw_text, active_exam, fallback_subject)

    # 6. PDF (.pdf) or Plain Text (.txt)
    else:
        if ext == "pdf":
            raw_text = extract_text_from_pdf(file_bytes)
        else:
            raw_text = file_bytes.decode("utf-8", errors="ignore")
        raw_rows = _parse_text_to_preview_rows(raw_text, active_exam, fallback_subject)

    # Post-process, validate, and detect duplicates
    processed_rows = []
    seen_in_file = set()
    subjects_set = set()
    units_set = set()
    chapters_set = set()
    topics_set = set()

    valid_count = 0
    duplicate_count = 0
    correction_count = 0

    for idx, r in enumerate(raw_rows):
        topic_name = r.get("topic_name", "").strip()
        subject_name = r.get("subject_name", "").strip() or (fallback_subject or "General")
        unit_name = r.get("unit_name", "").strip() or "General Unit"
        chapter_name = r.get("chapter_name", "").strip() or "Core Chapter"
        subtopic_name = r.get("subtopic_name", "").strip()

        row_id = f"row_{idx+1}_{secrets.token_hex(3)}"
        norm_key = (subject_name.lower(), topic_name.lower())

        status = "valid"
        status_msg = "Ready to import"

        # Validation rules
        if not topic_name or len(topic_name) < 2:
            status = "needs_correction"
            status_msg = "Topic name is too short or missing"
            correction_count += 1
        elif norm_key in seen_in_file:
            status = "duplicate"
            status_msg = "Duplicate topic within uploaded file"
            duplicate_count += 1
        elif topic_name.lower() in existing_set:
            status = "duplicate"
            status_msg = "Topic already exists in this exam syllabus"
            duplicate_count += 1
        else:
            valid_count += 1

        seen_in_file.add(norm_key)
        subjects_set.add(subject_name)
        units_set.add((subject_name, unit_name))
        chapters_set.add((subject_name, chapter_name))
        topics_set.add(norm_key)

        processed_rows.append({
            "id": row_id,
            "exam_name": r.get("exam_name", active_exam),
            "subject_name": subject_name,
            "unit_name": unit_name,
            "chapter_name": chapter_name,
            "topic_name": topic_name,
            "subtopic_name": subtopic_name,
            "difficulty": r.get("difficulty", "medium"),
            "estimated_minutes": r.get("estimated_minutes", 45),
            "importance": r.get("importance", "medium"),
            "source_page": r.get("source_page", "Page 1"),
            "source_ref": r.get("source_ref", "Direct Syllabus Reference"),
            "status": status,
            "status_message": status_msg
        })

    summary = {
        "total_rows": len(processed_rows),
        "subjects_count": len(subjects_set),
        "units_count": len(units_set),
        "chapters_count": len(chapters_set),
        "topics_count": len(topics_set),
        "valid_rows": valid_count,
        "duplicate_rows": duplicate_count,
        "correction_rows": correction_count
    }

    return {
        "success": True,
        "filename": filename,
        "analysis_source": analysis_source or (
            "heuristic" if ext in {"pdf", "txt", "doc", "docx", "png", "jpg", "jpeg", "webp"}
            else "structured_file"
        ),
        "detected_headers": detected_headers,
        "canonical_columns": CANONICAL_COLUMNS,
        "subjects": sorted(list(subjects_set)),
        "summary": summary,
        "rows": processed_rows
    }

def _parse_text_to_preview_rows(text: str, active_exam: str, fallback_subject: Optional[str]) -> List[Dict[str, Any]]:
    """Heuristic regex parser for unstructured PDF and text outlines with page tracking."""
    lines = [line.strip() for line in text.split("\n") if line.strip()]
    rows = []
    current_subject = fallback_subject or "Core Curriculum"
    current_unit = "Unit 1: Foundations"
    current_chapter = "Chapter 1: Principles"
    current_page = "Page 1"

    for line in lines:
        cleaned = line.strip()
        lower = cleaned.lower()

        # Check for page boundary
        page_match = re.match(r'^---\s*Page\s*(\d+).*?---', cleaned, re.IGNORECASE)
        if page_match:
            current_page = f"Page {page_match.group(1)}"
            continue

        # Check for Subject header
        if any(kw in lower for kw in COMMON_SUBJECT_KEYWORDS) and (len(cleaned) < 45 or "subject:" in lower or "paper:" in lower):
            candidate = re.sub(r'^(subject\s*:\s*|course\s*:\s*|paper\s*\d*\s*:\s*|\d+[\.\)]\s*)', '', cleaned, flags=re.IGNORECASE).strip()
            if 3 <= len(candidate) <= 45 and not fallback_subject:
                current_subject = candidate.title()
                continue

        # Check for Unit header
        unit_match = re.match(r'^(unit|module|section|part)\s*([0-9ivx]+)[:\-–]?\s*(.*)$', cleaned, re.IGNORECASE)
        if unit_match:
            u_title = unit_match.group(3).strip() or f"Unit {unit_match.group(2)}"
            current_unit = u_title
            continue

        # Check for Chapter header
        chap_match = re.match(r'^(chapter)\s*([0-9ivx]+)[:\-–]?\s*(.*)$', cleaned, re.IGNORECASE)
        if chap_match:
            c_title = chap_match.group(3).strip() or f"Chapter {chap_match.group(2)}"
            current_chapter = c_title
            continue

        # Check for Bullet/Numbered Topic
        bullet_match = re.match(r'^([•\-\*–—]|(\d+[\.\)]))\s+(.+)$', cleaned)
        if bullet_match:
            top = bullet_match.group(3).strip()
            if len(top) >= 3 and not re.match(r'^(page|copyright|author|date)\b', top, re.IGNORECASE):
                rows.append({
                    "exam_name": active_exam,
                    "subject_name": current_subject,
                    "unit_name": current_unit,
                    "chapter_name": current_chapter,
                    "topic_name": top,
                    "subtopic_name": "",
                    "difficulty": "medium",
                    "estimated_minutes": 45,
                    "importance": "medium",
                    "source_page": current_page,
                    "source_ref": f"{current_page}, {current_unit}"
                })
            continue

        # Comma-separated topics
        if "," in cleaned and len(cleaned) < 160:
            parts = [p.strip() for p in cleaned.split(",") if len(p.strip()) > 3]
            if len(parts) >= 2:
                for p in parts:
                    rows.append({
                        "exam_name": active_exam,
                        "subject_name": current_subject,
                        "unit_name": current_unit,
                        "chapter_name": current_chapter,
                        "topic_name": p,
                        "subtopic_name": "",
                        "difficulty": "medium",
                        "estimated_minutes": 45,
                        "importance": "medium",
                        "source_page": current_page,
                        "source_ref": f"{current_page}, {current_unit}"
                    })
                continue

        # Short clean lines
        if 4 <= len(cleaned) <= 60 and not cleaned.endswith(('.', ':', ';', '?')):
            if not any(k in lower for k in ["table of contents", "maximum marks", "duration", "all rights reserved"]):
                rows.append({
                    "exam_name": active_exam,
                    "subject_name": current_subject,
                    "unit_name": current_unit,
                    "chapter_name": current_chapter,
                    "topic_name": cleaned,
                    "subtopic_name": "",
                    "difficulty": "medium",
                    "estimated_minutes": 45,
                    "importance": "medium",
                    "source_page": current_page,
                    "source_ref": f"{current_page}, {current_unit}"
                })

    return rows


async def analyze_unstructured_rows(
    text: str,
    exam_name: str,
    fallback_subject: Optional[str] = None,
    api_key: Optional[str] = None
) -> tuple[List[Dict[str, Any]], str]:
    """Extract a syllabus hierarchy with a configured LLM, or use local text heuristics."""
    prompt = f"""
Extract only syllabus content from the text below. Do not invent topics.
Return a JSON object with a "rows" array. Each row must contain:
"subject_name", "unit_name", "chapter_name", "topic_name", "subtopic_name",
"difficulty" (easy, medium, or hard), "estimated_minutes" (integer), and
"importance" (low, medium, high, or very_high).
Use "{exam_name}" as context. Use "{fallback_subject or 'General'}" when a subject
cannot be identified. Keep every topic faithful to the source and put parent
headings into unit_name and chapter_name rather than treating them as topics.

Syllabus text:
{text[:40000]}
"""
    raw_response = await ai_service.call_llm(
        prompt,
        api_key=api_key,
        system_instruction="You extract syllabus structure faithfully. Return valid JSON only.",
        json_mode=True
    )

    extracted_rows: List[Dict[str, Any]] = []
    analysis_source = "heuristic"
    if raw_response:
        try:
            parsed = json.loads(raw_response)
            candidate_rows = parsed.get("rows", []) if isinstance(parsed, dict) else []
            if isinstance(candidate_rows, list):
                for row in candidate_rows:
                    if not isinstance(row, dict):
                        continue
                    topic_name = clean_name(row.get("topic_name"))
                    if len(topic_name) < 2:
                        continue
                    extracted_rows.append({
                        "exam_name": exam_name,
                        "subject_name": clean_name(row.get("subject_name")) or fallback_subject or "General",
                        "unit_name": clean_name(row.get("unit_name")) or "General Unit",
                        "chapter_name": clean_name(row.get("chapter_name")) or "Core Chapter",
                        "topic_name": topic_name,
                        "subtopic_name": clean_name(row.get("subtopic_name")),
                        "difficulty": normalize_difficulty(row.get("difficulty")),
                        "estimated_minutes": normalize_minutes(row.get("estimated_minutes")),
                        "importance": normalize_importance(row.get("importance"))
                    })
            if extracted_rows:
                analysis_source = "live_ai"
        except (json.JSONDecodeError, TypeError, ValueError):
            extracted_rows = []

    if not extracted_rows:
        extracted_rows = _parse_text_to_preview_rows(text, exam_name, fallback_subject)
    return extracted_rows, analysis_source


async def analyze_unstructured_text(
    text: str,
    api_key: Optional[str] = None,
    exam_name: str = "Target Examination",
    fallback_subject: Optional[str] = None
) -> List[Dict[str, Any]]:
    """Return parsed free-text syllabus topics grouped for the study-plan generator."""
    rows, _ = await analyze_unstructured_rows(
        text=text,
        exam_name=exam_name,
        fallback_subject=fallback_subject,
        api_key=api_key
    )
    grouped: Dict[str, Dict[str, Any]] = {}
    for row in rows:
        subject_name = row["subject_name"]
        subject = grouped.setdefault(
            subject_name,
            {"id": f"subject_{len(grouped) + 1}", "name": subject_name, "topics": []}
        )
        subject["topics"].append({
            "name": row["topic_name"],
            "difficulty": row["difficulty"],
            "estimated_minutes": row["estimated_minutes"],
            "importance": row["importance"]
        })
    return list(grouped.values())

def build_complete_study_plan(
    subjects: List[Dict[str, Any]],
    exam_name: str = "Upcoming Examination",
    exam_date: Optional[str] = None,
    sitting_capacity_mins: int = 45,
    daily_goal_mins: int = 180
) -> Dict[str, Any]:
    """
    Builds a complete, realistic StudyPlan structure containing:
    - Analyzed subjects & spaced repetition topics
    - Intelligently scheduled daily tasks up to the exam date
    - Planned focus sessions matching sitting capacity
    - Exam metadata and pomodoro settings
    """
    today_dt = datetime.now()
    t_str = today_dt.strftime("%Y-%m-%d")

    if not exam_date:
        exam_dt = today_dt + timedelta(days=28)
        exam_date = exam_dt.strftime("%Y-%m-%d")
    else:
        try:
            exam_dt = datetime.fromisoformat(exam_date)
        except Exception:
            exam_dt = today_dt + timedelta(days=28)
            exam_date = exam_dt.strftime("%Y-%m-%d")

    total_days = max(3, (exam_dt - today_dt).days)

    def add_d(days):
        return (today_dt + timedelta(days=days)).strftime("%Y-%m-%d")

    tasks = []
    task_prio_cycle = ["high", "med", "high", "med", "low"]
    task_mins_cycle = [
        min(daily_goal_mins, max(30, sitting_capacity_mins)),
        min(daily_goal_mins, max(45, sitting_capacity_mins)),
        60,
        45,
        30
    ]

    all_topics_with_subj = []
    for subj in subjects:
        for top in subj.get("topics", []):
            all_topics_with_subj.append((subj, top))

    if not all_topics_with_subj:
        all_topics_with_subj = [(
            {"id": "gen", "name": "General"},
            {"id": "t1", "name": "Core Subject Revision"}
        )]

    num_topics = len(all_topics_with_subj)
    for i, (subj, top) in enumerate(all_topics_with_subj):
        day_offset = int((i / num_topics) * (total_days - 2))
        t_date = add_d(day_offset)
        
        action_prefixes = [
            f"Study concept & key formulas for {top['name']}",
            f"Solve numerical drills & exam problems on {top['name']}",
            f"Comprehensive notes review & flashcards: {top['name']}",
            f"Timed practice questions on {top['name']}",
            f"Active recall & summary diagram for {top['name']}"
        ]
        
        action_title = action_prefixes[i % len(action_prefixes)]
        t_mins = task_mins_cycle[i % len(task_mins_cycle)]
        t_prio = task_prio_cycle[i % len(task_prio_cycle)]

        tasks.append({
            "id": secrets.token_hex(4),
            "title": action_title,
            "subjectId": subj["id"],
            "date": t_date,
            "mins": t_mins,
            "prio": t_prio,
            "done": False
        })

    # Add dedicated Full Syllabus Mock Test milestones
    if total_days >= 7:
        mock_day_1 = add_d(total_days - 5)
        mock_day_2 = add_d(total_days - 2)
        tasks.append({
            "id": secrets.token_hex(4),
            "title": "🎯 60-Minute Rapid Full Syllabus Mock Test",
            "subjectId": subjects[0]["id"] if subjects else "phy",
            "date": mock_day_1,
            "mins": 60,
            "prio": "high",
            "done": False
        })
        tasks.append({
            "id": secrets.token_hex(4),
            "title": "🏆 3-Hour Grand Full Mock Examination",
            "subjectId": subjects[0]["id"] if subjects else "phy",
            "date": mock_day_2,
            "mins": 180,
            "prio": "high",
            "done": False
        })

    sessions = []
    for d_off in [-3, -2, -1]:
        s_date = add_d(d_off)
        s_subj = subjects[abs(d_off) % len(subjects)]["id"] if subjects else "phy"
        sessions.append({
            "id": secrets.token_hex(4),
            "date": s_date,
            "mins": sitting_capacity_mins,
            "subjectId": s_subj,
            "at": int((today_dt + timedelta(days=d_off)).timestamp() * 1000) + 10 * 3600000
        })

    return {
        "v": 1,
        "subjects": subjects,
        "tasks": tasks,
        "sessions": sessions,
        "exam": {
            "name": exam_name,
            "date": exam_date
        },
        "goalMins": daily_goal_mins,
        "sittingCapacityMins": sitting_capacity_mins,
        "settings": {
            "focus": min(sitting_capacity_mins, 45),
            "short": 5,
            "long": 15
        }
    }
