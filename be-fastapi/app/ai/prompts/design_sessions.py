from openai.types.chat import ChatCompletionMessageParam


def build_source_summary_prompt(document_context: str) -> list[ChatCompletionMessageParam]:
    return [
        {
            "role": "system",
            "content": (
                "You are an expert curriculum analyst. "
                "Return valid JSON only with keys 'summary', 'key_points', 'company_profile_focus', 'company_name', 'company_profile_summary', and 'company_profile_confidence'. "
                "All output must be natural Bahasa Indonesia. Do not keep English sentence structure. "
                "If the source documents are in English, translate the company profile and learning context into Bahasa Indonesia."
            ),
        },
        {
            "role": "user",
            "content": (
                "Summarize the uploaded learning materials in Bahasa Indonesia. "
                "Paksa seluruh hasil menjadi Bahasa Indonesia yang natural, termasuk jika materi sumber dominan berbahasa Inggris. "
                "Deteksi nama perusahaan bila tersedia. Untuk bagian company profile, tuliskan ringkasan perusahaan dalam kalimat Bahasa Indonesia yang jelas, ringkas, dan siap dipakai untuk prefill formulir. "
                "Gunakan nilai confidence sederhana: high, medium, atau low. "
                "Return JSON with this shape: "
                '{"summary": string, "key_points": string[], "company_profile_focus": string[], "company_name": string | null, "company_profile_summary": string, "company_profile_confidence": "high" | "medium" | "low"}\n\n'
                f"Materials:\n{document_context}"
            ),
        },
    ]


def build_tlo_options_prompt(
    *,
    topic: str,
    target_level: int,
    summary: str,
    additional_context: str,
) -> list[ChatCompletionMessageParam]:
    expertise_level = {
        1: "foundational (Remember/Understand)",
        2: "elementary (Understand/Apply)",
        3: "intermediate (Apply/Analyze)",
        4: "advanced (Analyze/Evaluate)",
        5: "expert (Evaluate/Create)",
    }.get(target_level, "intermediate (Apply/Analyze)")
    verb_guidance = {
        1: "Gunakan verba dasar seperti mengidentifikasi, mengenali, menyebutkan, atau menjelaskan dasar. Jangan memakai verba tingkat tinggi seperti menganalisis, mengevaluasi, atau merancang.",
        2: "Gunakan verba seperti menjelaskan, menguraikan, menafsirkan, atau menerapkan dasar. Hindari verba expert seperti mengevaluasi atau merancang.",
        3: "Gunakan verba seperti menerapkan, mengolah, menginterpretasikan, atau menganalisis. Hindari verba terlalu dasar seperti hanya menyebutkan.",
        4: "Gunakan verba seperti menganalisis, mengevaluasi, memvalidasi, atau mengoptimalkan. Hindari verba entry-level seperti mengidentifikasi atau menyebutkan.",
        5: "Gunakan verba seperti mengevaluasi strategis, merancang, merumuskan, atau membangun pendekatan baru. Hindari verba entry-level atau sekadar operasional dasar.",
    }.get(target_level, "Pastikan verba sesuai tier kompetensi yang diminta.")
    return [
        {
            "role": "system",
            "content": (
                "You are an expert curriculum designer. Return valid JSON only with key "
                "'options' as an array of objects containing 'text' and 'rationale'. "
                "Use Indonesian Bloom-aligned verbs and ensure each option matches the requested expertise tier. "
                "Every TLO must be measurable, terminal, job-relevant, and written in one sentence. "
                "Do not use generic verbs like memahami or mengetahui."
            ),
        },
        {
            "role": "user",
            "content": (
                "Create 3 terminal learning objective options in Bahasa Indonesia. "
                "Each option must fit the target level, source summary, and company profile. "
                "TLO must describe terminal capability, not assessment criteria. "
                "Paksa pemilihan verba sesuai level Bloom yang tepat dan jangan membuat TLO terlalu generik atau abstrak. "
                'Return JSON: {"options": [{"text": string, "rationale": string}]}\n\n'
                f"Topic: {topic}\n"
                f"Target level: {target_level}\n"
                f"Expertise tier: {expertise_level}\n"
                f"Verb guidance: {verb_guidance}\n"
                f"Additional context: {additional_context or '-'}\n"
                f"Source summary: {summary}"
            ),
        },
    ]


def build_performance_options_prompt(
    *,
    source_summary: str,
    topic: str,
    target_level: int,
    selected_tlo: str,
) -> list[ChatCompletionMessageParam]:
    expertise_level = {
        1: "foundational (Remember/Understand)",
        2: "elementary (Understand/Apply)",
        3: "intermediate (Apply/Analyze)",
        4: "advanced (Analyze/Evaluate)",
        5: "expert (Evaluate/Create)",
    }.get(target_level, "intermediate (Apply/Analyze)")
    return [
        {
            "role": "system",
            "content": (
                "You are an expert curriculum designer. Return valid JSON only with key "
                "'options' as an array of objects containing 'text' and 'rationale'. "
                "Performance options must describe observable on-the-job performance in Bahasa Indonesia."
            ),
        },
        {
            "role": "user",
            "content": (
                "Create 3 performance objective options in Bahasa Indonesia that support the "
                "selected terminal learning objective. Do not restate condition or standard inside the same sentence. Return JSON: "
                '{"options": [{"text": string, "rationale": string}]}\n\n'
                f"Topic: {topic}\n"
                f"Target level: {target_level}\n"
                f"Expertise tier: {expertise_level}\n"
                f"Source summary: {source_summary}\n"
                f"Selected TLO: {selected_tlo}"
            ),
        },
    ]


def build_elo_options_prompt(
    *,
    source_summary: str,
    topic: str,
    target_level: int,
    selected_tlo: str,
    selected_performance: str,
    previous_elos: list[str] | None = None,
) -> list[ChatCompletionMessageParam]:
    expertise_level = {
        1: "foundational (Remember/Understand)",
        2: "elementary (Understand/Apply)",
        3: "intermediate (Apply/Analyze)",
        4: "advanced (Analyze/Evaluate)",
        5: "expert (Evaluate/Create)",
    }.get(target_level, "intermediate (Apply/Analyze)")
    return [
        {
            "role": "system",
            "content": (
                "You are an expert curriculum designer. Return valid JSON only with key "
                "'options' as an array of objects containing 'elo' and 'rationale'. "
                "Each ELO must be a capability statement in Bahasa Indonesia without PCS/PCE bullets. "
                "For this system, ELOs must stay within Bloom Remember and Understand only. "
                "Use verbs aligned to define, duplicate, memorize, repeat, describe, explain, identify. "
                "Do not use higher-level verbs equivalent to apply, analyze, evaluate, or create."
            ),
        },
        {
            "role": "user",
            "content": (
                "Create 3 to 5 enabling learning outcomes in Bahasa Indonesia. Each item must "
                "return exactly 5 enabling learning outcomes with rationale only. "
                "ELO must support the selected performance objective, follow the expertise tier, and use precise Bloom-aligned Indonesian verbs. "
                "Use operational verbs aligned to Remember (define, duplicate, memorize, repeat) and Understand (describe, explain, identify). "
                "The output must describe recall of facts/basic concepts and explanation of ideas/concepts only. "
                "Do not include PCS, condition, standard, or evaluation bullets inside ELO text. Return JSON: "
                '{"options": [{"elo": string, "rationale": string}]}\n\n'
                f"Topic: {topic}\n"
                f"Target level: {target_level}\n"
                f"Expertise tier: {expertise_level}\n"
                f"Source summary: {source_summary}\n"
                f"Selected TLO: {selected_tlo}\n"
                f"Selected performance objective: {selected_performance}\n"
                f"Previous ELO options to avoid repeating: {previous_elos or ['-']}\n"
                "When the learning journey or downstream module/content outline is inferred, prefer concrete topic bullets rather than generic activity sentences."
            ),
        },
    ]
