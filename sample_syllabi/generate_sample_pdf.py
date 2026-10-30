import os
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors

pdf_path = os.path.join(os.path.dirname(__file__), "ssc_cgl_syllabus.pdf")
doc = SimpleDocTemplate(pdf_path, pagesize=letter, rightMargin=36, leftMargin=36, topMargin=36, bottomMargin=36)
styles = getSampleStyleSheet()

elements = []

title_style = ParagraphStyle(
    "TitleStyle",
    parent=styles["Heading1"],
    fontSize=18,
    leading=22,
    textColor=colors.HexColor("#0A6C9E"),
    spaceAfter=10
)

elements.append(Paragraph("Staff Selection Commission (SSC) CGL Examination Syllabus", title_style))
elements.append(Paragraph("Subject-Wise Official Syllabus Breakdown with Units, Chapters, and Estimated Study Time", styles["Normal"]))
elements.append(Spacer(1, 14))

data = [
    ["Subject", "Unit", "Chapter", "Topic Name", "Difficulty", "Est. Minutes", "Importance"],
    ["Quantitative Aptitude", "Arithmetic", "Percentage & Ratio", "Percentages and Direct Fractions", "Easy", "45", "High"],
    ["Quantitative Aptitude", "Arithmetic", "Profit & Loss", "Marked Price, Discount and Successive Discounts", "Medium", "60", "High"],
    ["Quantitative Aptitude", "Arithmetic", "Time & Work", "Pipes and Cisterns, Efficiency Rules", "Medium", "50", "Medium"],
    ["Quantitative Aptitude", "Advanced Math", "Algebra", "Quadratic Equations and Polynomials", "Hard", "90", "High"],
    ["Quantitative Aptitude", "Advanced Math", "Trigonometry", "Heights and Distances, Compound Angles", "Hard", "90", "High"],
    ["General Intelligence", "Verbal Reasoning", "Analogy", "Semantic Analogy and Symbolic Number Analogy", "Easy", "30", "Medium"],
    ["General Intelligence", "Verbal Reasoning", "Syllogism", "Venn Diagram Syllogisms and Deductions", "Medium", "45", "High"],
    ["General Intelligence", "Non-Verbal Reasoning", "Figure Series", "Embedded Figures and Paper Folding", "Medium", "40", "Medium"],
    ["English Comprehension", "Grammar", "Error Spotting", "Subject-Verb Agreement and Tenses", "Easy", "35", "High"],
    ["English Comprehension", "Vocabulary", "Idioms & Phrases", "Common Idiomatic Expressions in Tier 1", "Medium", "40", "Medium"],
    ["English Comprehension", "Reading", "Comprehension Passages", "Editorial Tone and Inference Questions", "Hard", "60", "High"]
]

t = Table(data, colWidths=[90, 80, 80, 130, 50, 55, 55])
t.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0A6C9E")),
    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
    ("FONTSIZE", (0, 0), (-1, 0), 8),
    ("BOTTOMPADDING", (0, 0), (-1, 0), 6),
    ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#D9E0E7")),
    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F4F6F8")]),
    ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
    ("FONTSIZE", (0, 1), (-1, -1), 7.5),
    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
]))

elements.append(t)
doc.build(elements)
print(f"[SUCCESS] Generated sample PDF syllabus at: {pdf_path}")
