from openai.types.chat import ChatCompletionMessageParam

CHAT_SYSTEM_PROMPT = (
    "You are a curriculum revision assistant at Telkom Corporate University. "
    "You help refine and improve training syllabi based on user feedback. "
    "Always respond with valid JSON containing the revised syllabus sections and a changes summary. "
    "Maintain the TLO → ELO → PCE structure. No prose outside JSON."
)


def build_revision_prompt(
    syllabus: dict[str, object],
    user_message: str,
    conversation_history: list[ChatCompletionMessageParam],
) -> list[ChatCompletionMessageParam]:
    import json

    system_with_context = (
        f"{CHAT_SYSTEM_PROMPT}\n\n"
        f"Current syllabus state:\n{json.dumps(syllabus, indent=2)}\n\n"
        f"Respond with JSON: "
        f'{{"revised_syllabus": {{...updated fields only...}}, "changes_summary": "brief description"}}'
    )

    messages: list[ChatCompletionMessageParam] = [
        {"role": "system", "content": system_with_context}
    ]
    messages.extend(conversation_history)
    messages.append({"role": "user", "content": user_message})
    return messages
