from openai.types.chat import ChatCompletionMessageParam


ROADMAP_SYSTEM_PROMPT = (
    "You are a career roadmap strategist for corporate learning programs. "
    "Create a practical, role-oriented roadmap in natural Bahasa Indonesia. "
    "Always return valid JSON only. No prose outside JSON."
)


def build_roadmap_prompt(
    syllabus_context: dict[str, object],
    participant_name: str,
    current_role: str,
    target_role: str,
    time_horizon_weeks: int,
    competency_gaps: list[dict[str, object]],
) -> list[ChatCompletionMessageParam]:
    import json

    user_content = (
        "Susun roadmap pengembangan karier yang realistis dan berurutan.\n\n"
        f"Participant Name:\n{participant_name}\n\n"
        f"Current Role:\n{current_role}\n\n"
        f"Target Role:\n{target_role}\n\n"
        f"Time Horizon (weeks):\n{time_horizon_weeks}\n\n"
        f"Syllabus Context:\n{json.dumps(syllabus_context, indent=2, ensure_ascii=False)}\n\n"
        f"Competency Gaps:\n{json.dumps(competency_gaps, indent=2, ensure_ascii=False)}\n\n"
        "Return JSON with this shape:\n"
        "{\n"
        '  "milestones": [\n'
        "    {\n"
        '      "phase_title": "Nama fase",\n'
        '      "timeframe": "Minggu 1-2",\n'
        '      "objective": "Tujuan fase ini",\n'
        '      "focus_modules": ["materi/modul 1", "materi/modul 2"],\n'
        '      "activities": ["aksi konkrit 1", "aksi konkrit 2"],\n'
        '      "success_indicator": "indikator keberhasilan"\n'
        "    }\n"
        "  ]\n"
        "}\n\n"
        "Requirements:\n"
        "- Output must be in natural Bahasa Indonesia.\n"
        "- Milestones must be practical, sequenced, and role-oriented.\n"
        "- Focus modules must align with syllabus TLO/ELO and competency gaps.\n"
        "- Activities must be actionable, not generic motivational text.\n"
        "- Success indicators must be observable and measurable.\n"
        "- Return ONLY valid JSON, no markdown fences."
    )

    return [
        {"role": "system", "content": ROADMAP_SYSTEM_PROMPT},
        {"role": "user", "content": user_content},
    ]
