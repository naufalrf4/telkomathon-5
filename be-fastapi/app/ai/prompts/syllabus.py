from openai.types.chat import ChatCompletionMessageParam


def build_syllabus_prompt(
    topic: str,
    level: int,
    context: str,
    additional_context: str = "",
) -> list[ChatCompletionMessageParam]:
    expertise_level = {
        1: "foundational (Remember/Understand)",
        2: "elementary (Understand/Apply)",
        3: "intermediate (Apply/Analyze)",
        4: "advanced (Analyze/Evaluate)",
        5: "expert (Evaluate/Create)",
    }.get(level, "intermediate (Apply/Analyze)")
    system = (
        "You are an expert curriculum designer for Telkom Corporate University. "
        "You design structured learning syllabi with separate TLO, performance, condition, standard, ELO, and learning journey sections. "
        "Always respond with valid JSON only, no markdown, no explanation."
    )
    user = f"""Design a complete syllabus for the following training topic.

Topic: {topic}
Target Level: {level} (1=Basic, 2=Elementary, 3=Intermediate, 4=Advanced, 5=Expert)
Additional Context: {additional_context}
Expertise Tier: {expertise_level}

Reference Materials:
{context}

Respond with this exact JSON structure:
{{
  "tlo": "Terminal Learning Objective — one sentence describing overall competency",
  "performance_result": "Observable workplace performance statement in Bahasa Indonesia",
  "condition_result": "Condition or learning/work context in Bahasa Indonesia",
  "standard_result": "Standard of success in Bahasa Indonesia",
  "elos": [
    {{
      "elo": "Enabling Learning Objective description"
    }}
  ],
  "journey": {{
    "pre_learning": {{
      "duration": "Estimated duration",
      "description": "Short phase description",
      "content": ["Activity 1", "Activity 2"]
    }},
    "classroom": {{
      "duration": "Estimated duration",
      "description": "Short phase description",
      "content": ["Activity 1", "Activity 2", "Activity 3"]
    }},
    "after_learning": {{
      "duration": "Estimated duration",
      "description": "Short phase description",
      "content": ["Activity 1", "Activity 2"]
    }}
  }}
}}

Requirements:
- 3-5 ELOs, each as a single capability statement without PCS/PCE bullets
- Generate at least 5 ELOs
- Keep performance, condition, and standard separate from ELO lines
- Journey sections must each include duration, description, and content list
- Use Indonesian output even if the source materials are primarily English
- For ELOs, stay within Bloom Remember and Understand only, using verbs aligned to define, duplicate, memorize, repeat, describe, explain, identify
- Avoid higher-level ELO verbs equivalent to apply, analyze, evaluate, or create
- Use Bloom-aligned verbs that match the expertise tier for the overall syllabus, while keeping ELO itself in the Remember/Understand band
- All in Bahasa Indonesia
- Level-appropriate complexity"""
    return [{"role": "system", "content": system}, {"role": "user", "content": user}]
