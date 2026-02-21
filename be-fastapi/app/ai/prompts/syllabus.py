from openai.types.chat import ChatCompletionMessageParam


def build_syllabus_prompt(
    topic: str,
    level: int,
    context: str,
    additional_context: str = "",
) -> list[ChatCompletionMessageParam]:
    system = (
        "You are an expert curriculum designer for Telkom Corporate University. "
        "You design structured learning syllabi following the TLO → ELO → PCE framework. "
        "Always respond with valid JSON only, no markdown, no explanation."
    )
    user = f"""Design a complete syllabus for the following training topic.

Topic: {topic}
Target Level: {level} (1=Basic, 2=Elementary, 3=Intermediate, 4=Advanced, 5=Expert)
Additional Context: {additional_context}

Reference Materials:
{context}

Respond with this exact JSON structure:
{{
  "tlo": "Terminal Learning Objective — one sentence describing overall competency",
  "elos": [
    {{
      "elo": "Enabling Learning Objective description",
      "pce": ["Performance Criterion 1", "Performance Criterion 2", "Performance Criterion 3"]
    }}
  ],
  "journey": {{
    "pre_learning": ["Pre-learning activity 1", "Pre-learning activity 2"],
    "classroom": ["Classroom session 1", "Classroom session 2", "Classroom session 3"],
    "after_learning": ["Post-learning activity 1", "Post-learning activity 2"]
  }}
}}

Requirements:
- 3-5 ELOs, each with 2-4 PCEs
- Journey sections: 2-3 pre-learning, 3-5 classroom, 2-3 after-learning
- All in Bahasa Indonesia
- Level-appropriate complexity"""
    return [{"role": "system", "content": system}, {"role": "user", "content": user}]
