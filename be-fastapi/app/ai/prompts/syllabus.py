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
    tlo_verb_guidance = {
        1: "Gunakan verba seperti mengidentifikasi, mengenali, menyebutkan, atau menjelaskan dasar.",
        2: "Gunakan verba seperti menjelaskan, menguraikan, menafsirkan, atau menerapkan dasar.",
        3: "Gunakan verba seperti menerapkan, mengolah, menginterpretasikan, atau menganalisis.",
        4: "Gunakan verba seperti menganalisis, mengevaluasi, memvalidasi, atau mengoptimalkan.",
        5: "Gunakan verba seperti mengevaluasi strategis, merancang, merumuskan, atau membangun pendekatan baru.",
    }.get(level, "Pastikan TLO memakai verba yang sesuai tier kompetensi.")
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
      "method": ["How the learning is delivered step 1", "How the learning is delivered step 2"],
      "description": "Short phase description",
      "content": ["Topic/module 1", "Topic/module 2"]
    }},
    "classroom": {{
      "duration": "Estimated duration",
      "method": ["How the learning is delivered step 1", "How the learning is delivered step 2"],
      "description": "Short phase description",
      "content": ["Topic/module 1", "Topic/module 2", "Topic/module 3"]
    }},
    "after_learning": {{
      "duration": "Estimated duration",
      "method": ["How the learning is delivered step 1", "How the learning is delivered step 2"],
      "description": "Short phase description",
      "content": ["Topic/module 1", "Topic/module 2"]
    }}
  }}
}}

Requirements:
- 3-5 ELOs, each as a single capability statement without PCS/PCE bullets
- Generate at least 5 ELOs
- Keep performance, condition, and standard separate from ELO lines
- Journey sections must each include duration, method, description, and content list
- `journey.*.method` must be a list of point-based delivery steps that explain how learning is delivered/disampaikan
- `journey.*.content` must be a concrete outline of learning topics/modules, not facilitator activity prose
- For example, if the topic is basic ML, content should resemble topic bullets such as konsep AI/ML/DL, dasar Python, library ML, preprocessing, and EDA
- Use Indonesian output even if the source materials are primarily English
- For ELOs, stay within Bloom Remember and Understand only, using verbs aligned to define, duplicate, memorize, repeat, describe, explain, identify
- Avoid higher-level ELO verbs equivalent to apply, analyze, evaluate, or create
- Use Bloom-aligned verbs that match the expertise tier for the overall syllabus, while keeping ELO itself in the Remember/Understand band
- For TLO specifically, use a measurable verb that matches the target level and avoid generic verbs like memahami or mengetahui
- TLO verb guidance: {tlo_verb_guidance}
- All in Bahasa Indonesia
- Level-appropriate complexity"""
    return [{"role": "system", "content": system}, {"role": "user", "content": user}]
