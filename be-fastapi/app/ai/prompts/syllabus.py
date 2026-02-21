SYLLABUS_SYSTEM_PROMPT = (
    "You are an expert curriculum designer at Telkom Corporate University (SoDSNP). "
    "Your task is to design structured training syllabi following the TLO → ELO → PCE framework. "
    "Always respond with valid JSON only. No prose outside JSON."
)

SYLLABUS_OUTPUT_SCHEMA = {
    "tlo": "Terminal Learning Objective string",
    "elos": [
        {
            "id": "ELO-01",
            "description": "ELO description",
            "pce": "Performance | Condition | Evaluation criteria",
            "sub_elos": [],
        }
    ],
    "journey": {
        "pre_learning": {
            "duration": "1 week",
            "method": "Self-paced online",
            "activities": [],
        },
        "classroom": {
            "duration": "1.5 days",
            "method": "Virtual/In-person",
            "sessions": [],
        },
        "after_learning": {
            "duration": "2 months",
            "method": "On-the-job + coaching",
            "activities": [],
        },
    },
}


def build_syllabus_prompt(topic: str, level: int, context: str) -> list[dict]:
    import json

    user_content = (
        f"Design a complete training syllabus for the topic: '{topic}'\n"
        f"Target competency level: {level} (1=Beginner, 5=Expert)\n\n"
        f"Reference materials from organizational knowledge base:\n{context}\n\n"
        f"Generate a JSON object with this exact structure:\n{json.dumps(SYLLABUS_OUTPUT_SCHEMA, indent=2)}\n\n"
        f"Requirements:\n"
        f"- TLO must be measurable and behavioral\n"
        f"- Generate 3-5 ELOs, each with PCE criteria\n"
        f"- Learning Journey follows 70-20-10 model\n"
        f"- Pre-learning: 1 week self-paced\n"
        f"- Classroom: 1.5-2 days structured sessions\n"
        f"- After-learning: 2 months on-the-job\n"
        f"- Use Indonesian language for content\n"
        f"- Return ONLY valid JSON, no markdown fences"
    )

    return [
        {"role": "system", "content": SYLLABUS_SYSTEM_PROMPT},
        {"role": "user", "content": user_content},
    ]
