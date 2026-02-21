PERSONALIZE_SYSTEM_PROMPT = (
    "You are a personalized learning specialist at Telkom Corporate University. "
    "Your task is to analyze competency gaps and recommend targeted micro-learning modules. "
    "Always respond with valid JSON only. No prose outside JSON."
)


def build_personalize_prompt(
    syllabus_context: dict,
    competency_gaps: list[dict],
    available_content: str,
) -> list[dict]:
    import json

    user_content = (
        f"Analyze the following competency gaps and recommend micro-learning modules.\n\n"
        f"Syllabus Context:\n{json.dumps(syllabus_context, indent=2)}\n\n"
        f"Competency Gaps:\n{json.dumps(competency_gaps, indent=2)}\n\n"
        f"Available Reference Content:\n{available_content}\n\n"
        f"For each gap, provide a JSON array of recommendations:\n"
        f"{{\n"
        f'  "recommendations": [\n'
        f"    {{\n"
        f'      "competency": "gap name",\n'
        f'      "gap": "L2 → L3",\n'
        f'      "modules": [\n'
        f"        {{\n"
        f'          "title": "module title",\n'
        f'          "type": "Video|Interactive|Reading|Practice",\n'
        f'          "duration_min": 15,\n'
        f'          "difficulty": "Beginner|Medium|Advanced",\n'
        f'          "delivery_method": "Self-paced|Blended",\n'
        f'          "objective": "ELO-01",\n'
        f'          "description": "module description"\n'
        f"        }}\n"
        f"      ],\n"
        f'      "estimated_total_duration_min": 45,\n'
        f'      "sequence_order": 1\n'
        f"    }}\n"
        f"  ]\n"
        f"}}\n\n"
        f"Return ONLY valid JSON, no markdown fences."
    )

    return [
        {"role": "system", "content": PERSONALIZE_SYSTEM_PROMPT},
        {"role": "user", "content": user_content},
    ]
