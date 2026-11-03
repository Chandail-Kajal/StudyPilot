import json
import unittest
from unittest.mock import AsyncMock, patch

import syllabus_parser


class SyllabusPipelineTests(unittest.IsolatedAsyncioTestCase):
    async def test_unstructured_text_uses_live_ai_rows_when_available(self):
        response = {
            "rows": [{
                "subject_name": "Physics",
                "unit_name": "Mechanics",
                "chapter_name": "Motion",
                "topic_name": "Vectors",
                "difficulty": "easy",
                "estimated_minutes": 40,
                "importance": "high"
            }]
        }
        with patch.object(
            syllabus_parser.ai_service,
            "call_llm",
            new=AsyncMock(return_value=json.dumps(response))
        ):
            rows, source = await syllabus_parser.analyze_unstructured_rows(
                "Unit 1: Motion\n1. Vectors",
                exam_name="Physics Exam",
                api_key="configured-test-key"
            )

        self.assertEqual(source, "live_ai")
        self.assertEqual(rows[0]["topic_name"], "Vectors")
        self.assertEqual(rows[0]["subject_name"], "Physics")

    async def test_fallback_does_not_invent_topics_for_empty_text(self):
        with patch.object(
            syllabus_parser.ai_service,
            "call_llm",
            new=AsyncMock(return_value=None)
        ):
            rows, source = await syllabus_parser.analyze_unstructured_rows(
                "",
                exam_name="Empty Exam"
            )

        self.assertEqual(source, "heuristic")
        self.assertEqual(rows, [])


if __name__ == "__main__":
    unittest.main()
