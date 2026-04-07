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


def build_final_syllabus_sections_prompt(
    *,
    topic: str,
    target_level: int,
    source_summary: str,
    company_profile_summary: str,
    commercial_overview: str,
    course_category: str,
    additional_context: str,
    selected_tlo: str,
    selected_performance: str,
    selected_elos: list[str],
    retry_notes: str = "",
) -> list[ChatCompletionMessageParam]:
    system = (
        "You are an expert curriculum designer. "
        "Generate grounded syllabus sections based only on the provided context. "
        "Return valid JSON only with keys 'condition_result', 'standard_result', and 'journey'. "
        "Do not invent unsupported company facts, business claims, tools, or metrics. "
        "All output must be natural Bahasa Indonesia."
    )
    user = f"""Lengkapi bagian akhir silabus berikut berdasarkan konteks yang diberikan.

Kamu hanya boleh menggunakan informasi dari:
- source summary
- company profile summary
- commercial overview
- course category
- additional context
- selected TLO
- selected performance
- selected ELOs

Jangan mengulang kalimat yang sama antar field. Setiap field harus punya fungsi yang berbeda:
- condition_result = konteks, syarat, situasi, atau lingkungan saat performa ditunjukkan
- standard_result = ukuran keberhasilan, mutu, atau bukti capaian
- journey = rencana pembelajaran yang runtut dan konkret

Aturan penting:
- Jangan menyalin performance_result ke condition_result atau standard_result
- Jangan membuat standard_result yang hanya mengulang condition_result
- Setiap stage journey harus berbeda satu sama lain
- `journey.*.method` berisi cara penyampaian pembelajaran, bukan daftar topik
- `journey.*.content` berisi topik/modul konkret, bukan kalimat aktivitas fasilitator
- Durasi boleh berupa estimasi instruksional yang wajar, tetapi jangan menambahkan fakta bisnis baru
- Jika konteks terbatas, tetap spesifik namun konservatif; jangan berhalusinasi
- Semua output dalam Bahasa Indonesia

Return JSON dengan struktur exact ini:
{{
  "condition_result": "string",
  "standard_result": "string",
  "journey": {{
    "pre_learning": {{
      "duration": "string",
      "method": ["string"],
      "description": "string",
      "content": ["string"]
    }},
    "classroom": {{
      "duration": "string",
      "method": ["string"],
      "description": "string",
      "content": ["string"]
    }},
    "after_learning": {{
      "duration": "string",
      "method": ["string"],
      "description": "string",
      "content": ["string"]
    }}
  }}
}}

Topic: {topic}
Target level: {target_level}
Course category: {course_category or "-"}
Additional context: {additional_context or "-"}
Source summary: {source_summary or "-"}
Company profile summary: {company_profile_summary or "-"}
Commercial overview: {commercial_overview or "-"}
Selected TLO: {selected_tlo}
Selected performance: {selected_performance}
Selected ELOs: {selected_elos or ["-"]}
Retry notes: {retry_notes or "-"}
"""
    return [{"role": "system", "content": system}, {"role": "user", "content": user}]
