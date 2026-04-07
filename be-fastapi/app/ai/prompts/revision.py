"""Prompts for chat-based syllabus revision routing and rewriting."""

from openai.types.chat import ChatCompletionMessageParam

_VALID_SECTIONS = (
    "tlo",
    "performance_result",
    "condition_result",
    "standard_result",
    "elos",
    "journey.pre_learning",
    "journey.classroom",
    "journey.after_learning",
)


def build_revision_routing_prompt(
    user_message: str,
    syllabus_outline: dict[str, object],
    *,
    conversation_history: list[dict[str, str]] | None = None,
) -> list[ChatCompletionMessageParam]:
    """Route a user message to the relevant syllabus sections."""
    section_list = ", ".join(f'"{s}"' for s in _VALID_SECTIONS)

    system: str = (
        "Kamu adalah asisten peninjau silabus di Telkom Corporate University. "
        "Tugasmu: tentukan apakah pesan pengguna merupakan permintaan revisi silabus, "
        "dan jika ya, identifikasi bagian silabus mana yang perlu diubah.\n\n"
        "Bagian silabus yang valid: " + section_list + ".\n\n"
        "Balas HANYA dalam format JSON valid tanpa markdown:\n"
        "{\n"
        '  "is_revision": true/false,\n'
        '  "target_sections": ["section_key", ...],\n'
        '  "instructions": "instruksi revisi yang diperhalus dalam Bahasa Indonesia"\n'
        "}\n\n"
        "Aturan:\n"
        '- Jika pesan bukan permintaan revisi (misalnya sapaan, pertanyaan umum), set "is_revision": false, '
        '"target_sections": [], "instructions": "".\n'
        "- Jika pesan meminta perubahan umum tanpa menyebut bagian spesifik, tentukan bagian yang paling relevan.\n"
        "- Perhatikan riwayat percakapan untuk memahami konteks (misalnya 'buat lebih pendek lagi' merujuk pada revisi sebelumnya).\n"
        "- Instruksi harus jelas dan actionable untuk rewriter."
    )

    # Build conversation context
    history_text = ""
    if conversation_history:
        history_lines = []
        for msg in conversation_history[-6:]:
            role_label = "Pengguna" if msg["role"] == "user" else "Asisten"
            history_lines.append(f"[{role_label}]: {msg['content']}")
        history_text = "\n\nRiwayat percakapan sebelumnya:\n" + "\n".join(history_lines)

    user: str = (
        f"Pesan pengguna:\n{user_message}\n\n"
        f"Ringkasan silabus saat ini:\n{_format_outline(syllabus_outline)}"
        f"{history_text}"
    )

    return [
        {"role": "system", "content": system},
        {"role": "user", "content": user},
    ]


def build_revision_rewrite_prompt(
    instruction: str,
    target_sections: list[str],
    current_values: dict[str, object],
    syllabus_context: dict[str, str],
) -> list[ChatCompletionMessageParam]:
    """Rewrite targeted sections based on the instruction."""
    section_schemas = _build_section_schema_hints(target_sections)

    system: str = (
        "Kamu adalah curriculum designer ahli di Telkom Corporate University. "
        "Tugasmu: revisi bagian silabus yang diminta sesuai instruksi.\n\n"
        "Konteks silabus:\n"
        f"- Topik: {syllabus_context.get('topic', '')}\n"
        f"- TLO: {syllabus_context.get('tlo', '')}\n"
        f"- Level: {syllabus_context.get('level', '')}\n\n"
        "Balas HANYA dalam format JSON valid tanpa markdown:\n"
        "{\n"
        '  "revised_sections": {\n'
        '    "section_key": <new_value>,\n'
        "    ...\n"
        "  }\n"
        "}\n\n"
        "Format nilai per section:\n" + section_schemas + "\n\n"
        "Aturan:\n"
        "- Hanya revisi bagian yang ditargetkan, jangan ubah yang lain.\n"
        "- Gunakan Bahasa Indonesia.\n"
        "- Pertahankan kualitas akademis Telkom Corporate University.\n"
        "- Pastikan konsistensi dengan TLO dan level kompetensi.\n"
        "- Untuk setiap section yang direvisi, hasil HARUS berbeda secara nyata dari nilai saat ini.\n"
        "- Jangan menyalin ulang nilai saat ini apa adanya. Jika instruksi meminta peringkasan, penajaman, atau penambahan, keluaran harus mencerminkan perubahan tersebut."
    )

    user: str = (
        f"Instruksi revisi:\n{instruction}\n\n"
        f"Bagian yang perlu direvisi: {target_sections}\n\n"
        f"Nilai saat ini:\n{_format_current_values(current_values)}"
    )

    return [
        {"role": "system", "content": system},
        {"role": "user", "content": user},
    ]


def _format_outline(outline: dict[str, object]) -> str:
    lines: list[str] = []
    for key, value in outline.items():
        if key == "journey" and isinstance(value, dict):
            for stage, desc in value.items():
                lines.append(f"  journey.{stage}: {desc}")
        elif key == "elos" and isinstance(value, list):
            elo_strs = [str(e) for e in value[:5]]
            lines.append(f"  elos: {elo_strs}")
        else:
            lines.append(f"  {key}: {value}")
    return "\n".join(lines)


def _format_current_values(values: dict[str, object]) -> str:
    import json

    return json.dumps(values, ensure_ascii=False, indent=2, default=str)


def _build_section_schema_hints(sections: list[str]) -> str:
    hints: list[str] = []
    for section in sections:
        if section in ("tlo", "performance_result", "condition_result", "standard_result"):
            hints.append(f'- "{section}": string')
        elif section == "elos":
            hints.append(f'- "{section}": [{{"elo": "..."}}]')
        elif section.startswith("journey."):
            hints.append(
                f'- "{section}": '
                '{"duration": "...", "method": [...], "description": "...", "content": [...]}'
            )
    return "\n".join(hints) if hints else "- (gunakan format yang sesuai)"
