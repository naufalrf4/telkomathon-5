from openai.types.chat import ChatCompletionMessageParam


def build_source_summary_prompt(document_context: str) -> list[ChatCompletionMessageParam]:
    return [
        {
            "role": "system",
            "content": (
                "You are an expert curriculum analyst. "
                "Return valid JSON only with keys 'summary' and 'key_points'."
            ),
        },
        {
            "role": "user",
            "content": (
                "Summarize the uploaded learning materials in Bahasa Indonesia. "
                "Return JSON with this shape: "
                '{"summary": string, "key_points": string[]}\n\n'
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
    return [
        {
            "role": "system",
            "content": (
                "You are an expert curriculum designer. Return valid JSON only with key "
                "'options' as an array of objects containing 'text' and 'rationale'."
            ),
        },
        {
            "role": "user",
            "content": (
                "Create 3 terminal learning objective options in Bahasa Indonesia. "
                "Each option must fit the target level and source summary. "
                'Return JSON: {"options": [{"text": string, "rationale": string}]}\n\n'
                f"Topic: {topic}\n"
                f"Target level: {target_level}\n"
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
    return [
        {
            "role": "system",
            "content": (
                "You are an expert curriculum designer. Return valid JSON only with key "
                "'options' as an array of objects containing 'text' and 'rationale'."
            ),
        },
        {
            "role": "user",
            "content": (
                "Create 3 performance objective options in Bahasa Indonesia that support the "
                "selected terminal learning objective. Return JSON: "
                '{"options": [{"text": string, "rationale": string}]}\n\n'
                f"Topic: {topic}\n"
                f"Target level: {target_level}\n"
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
) -> list[ChatCompletionMessageParam]:
    return [
        {
            "role": "system",
            "content": (
                "You are an expert curriculum designer. Return valid JSON only with key "
                "'options' as an array of objects containing 'elo', 'pce', and 'rationale'."
            ),
        },
        {
            "role": "user",
            "content": (
                "Create 3 to 5 enabling learning outcomes in Bahasa Indonesia. Each item must "
                "contain a short ELO statement and a PCE list with exactly 3 entries. Return JSON: "
                '{"options": [{"elo": string, "pce": string[], "rationale": string}]}\n\n'
                f"Topic: {topic}\n"
                f"Target level: {target_level}\n"
                f"Source summary: {source_summary}\n"
                f"Selected TLO: {selected_tlo}\n"
                f"Selected performance objective: {selected_performance}"
            ),
        },
    ]
