from typing import Dict, Any, List, Tuple
from pydantic import BaseModel, Field

GENERIC_BOILERPLATE_PATTERNS = [
    "imagine baking a cake",
    "imagine riding a bicycle",
    "rate(singly and doubly",
    "rate =",
    "input stimulus transforming into stable output",
    "rule of [topic]",
    "standard assumption: closed or equilibrium",
    "verification method: boundary and dimensional check",
    "i-d-e-a-l (identify, define, equation, apply, limit)"
]

REQUIRED_PEDAGOGICAL_KEYS = [
    "topic_introduction",
    "learning_objectives",
    "prerequisites",
    "simple_explanation",
    "detailed_explanation",
    "how_it_works",
    "real_world_applications",
    "analogy",
    "step_by_step_examples",
    "important_formulas_or_code",
    "diagrams_and_visuals",
    "common_mistakes_and_traps",
    "advantages_and_limitations",
    "comparison_table",
    "exam_perspective",
    "practice_questions",
    "points_to_remember",
    "topic_summary"
]


class PedagogicalContentValidator:
    """
    Validates teacher-grade educational content against 15 pedagogical requirements
    and detects unwanted generic heuristic boilerplate.
    """

    @classmethod
    def validate_content(cls, content: Dict[str, Any], topic_name: str, subject_name: str) -> Tuple[bool, float, List[str]]:
        """
        Validates content quality.
        Returns: (is_valid: bool, quality_score: float, issues: List[str])
        """
        issues: List[str] = []
        clean_topic = topic_name.strip().lower()
        
        if not content or not isinstance(content, dict):
            return False, 0.0, ["Content is empty or not a valid dictionary"]

        score_components = 0
        total_components = len(REQUIRED_PEDAGOGICAL_KEYS)

        # 1. Check for required pedagogical sections
        for key in REQUIRED_PEDAGOGICAL_KEYS:
            val = content.get(key)
            if not val:
                issues.append(f"Missing required section: '{key}'")
            elif isinstance(val, (str, list, dict)) and len(val) == 0:
                issues.append(f"Section '{key}' is empty")
            else:
                score_components += 1

        # 2. Check for generic boilerplate phrases
        content_text = str(content).lower()
        boilerplate_detected = False
        for bp in GENERIC_BOILERPLATE_PATTERNS:
            if bp in content_text:
                issues.append(f"Generic boilerplate detected: '{bp}'")
                boilerplate_detected = True

        # 3. Topic specificity check (must mention topic name or keywords)
        topic_words = [w for w in clean_topic.split() if len(w) > 3]
        if topic_words and not any(w in content_text for w in topic_words):
            issues.append(f"Content does not contain core topic terms for '{clean_topic}'")

        # 4. Diagram syntax check
        diag = content.get("diagrams_and_visuals")
        if isinstance(diag, dict):
            svg = diag.get("diagram_svg", "")
            if svg and "foreignObject" in svg:
                issues.append("Diagram contains legacy foreignObject which can break in browsers")

        base_score = round(score_components / total_components, 2)
        if boilerplate_detected:
            base_score = max(0.2, base_score - 0.3)

        is_valid = (len(issues) == 0 or (score_components >= 14 and not boilerplate_detected))
        return is_valid, base_score, issues

