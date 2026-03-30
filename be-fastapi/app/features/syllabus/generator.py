import json
from collections.abc import AsyncIterator
from typing import cast

from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.llm import chat_complete
from app.ai.prompts.syllabus import build_syllabus_prompt
from app.ai.rag import build_context_block, retrieve_relevant_chunks
from app.exceptions import AIServiceException
from app.features.syllabus.schemas import SyllabusGenerateRequest


async def generate_syllabus_stream(
    request: SyllabusGenerateRequest,
    db: AsyncSession,
) -> AsyncIterator[str]:
    try:
        chunks = await retrieve_relevant_chunks(
            query=request.topic,
            doc_ids=request.doc_ids,
            db=db,
        )
        context = build_context_block(chunks)
        messages = build_syllabus_prompt(
            topic=request.topic,
            level=request.target_level,
            context=context,
            additional_context=request.additional_context,
        )
        stream = cast(AsyncIterator[str], await chat_complete(messages, stream=True))
        full_response = ""
        async for chunk in stream:
            full_response += chunk
            yield chunk
        yield f"\n__DONE__:{full_response}"
    except AIServiceException as exc:
        fallback_response = _build_fallback_syllabus_json(request, str(exc))
        yield fallback_response
        yield f"\n__DONE__:{fallback_response}"
    except Exception as exc:
        fallback_response = _build_fallback_syllabus_json(
            request,
            f"Syllabus generation failed: {exc}",
        )
        yield fallback_response
        yield f"\n__DONE__:{fallback_response}"


def parse_syllabus_json(raw: str) -> dict[str, object]:
    try:
        start = raw.find("{")
        end = raw.rfind("}") + 1
        if start == -1 or end == 0:
            raise ValueError("No JSON object found")
        return cast(dict[str, object], json.loads(raw[start:end]))
    except (json.JSONDecodeError, ValueError) as exc:
        raise AIServiceException("Failed to parse syllabus JSON from LLM response") from exc


def _build_fallback_syllabus_json(
    request: SyllabusGenerateRequest,
    reason: str,
) -> str:
    topic = request.topic.strip() or "Topik Pembelajaran"
    additional_context = request.additional_context.strip()
    context_suffix = f" Fokus konteks tambahan: {additional_context}." if additional_context else ""
    payload = {
        "tlo": (
            f"Peserta mampu menerapkan prinsip utama {topic} pada level {request.target_level}."
            f"{context_suffix}"
        ).strip(),
        "performance_result": f"Menunjukkan penerapan {topic} pada simulasi atau konteks kerja yang relevan.",
        "condition_result": (
            "Dilaksanakan menggunakan dokumen perusahaan, studi kasus, diskusi terarah, dan refleksi fasilitator."
        ),
        "standard_result": (
            "Hasil kerja akurat, relevan dengan kebutuhan organisasi, dan dapat ditindaklanjuti di pekerjaan."
        ),
        "elos": [
            {
                "elo": f"Mendefinisikan konsep inti {topic} dan istilah kunci yang digunakan dalam pembelajaran.",
            },
            {
                "elo": f"Mengidentifikasi contoh dasar {topic} pada konteks kerja yang disediakan.",
            },
            {
                "elo": f"Menjelaskan hubungan antara {topic} dan kebutuhan operasional organisasi.",
            },
            {
                "elo": f"Mengulang kembali urutan langkah dasar {topic} sesuai panduan fasilitator.",
            },
            {
                "elo": f"Mendeskripsikan ide atau konsep utama {topic} dengan bahasa yang jelas dan tepat.",
            },
        ],
        "journey": {
            "pre_learning": {
                "duration": "60 menit",
                "method": [
                    "Belajar mandiri untuk mengenali ruang lingkup topik.",
                    "Penelusuran materi pengantar secara bertahap.",
                    "Refleksi awal terhadap konteks kerja peserta.",
                ],
                "description": f"Peserta menyiapkan konteks awal dan kosa kata utama terkait {topic}.",
                "content": [
                    f"Konsep dasar dan terminologi inti {topic}.",
                    f"Gambaran awal konteks penerapan {topic}.",
                ],
            },
            "classroom": {
                "duration": "240 menit",
                "method": [
                    "Paparan fasilitator untuk membedah konsep inti.",
                    "Demonstrasi dan walkthrough contoh kerja nyata.",
                    "Diskusi terarah serta latihan terstruktur berbasis studi kasus.",
                ],
                "description": f"Peserta berlatih menerapkan {topic} melalui diskusi, studi kasus, dan umpan balik terarah.",
                "content": [
                    f"Konsep utama dan ruang lingkup {topic}.",
                    f"Tools, library, atau komponen dasar untuk {topic}.",
                    f"Workflow dasar dan contoh penerapan {topic}.",
                ],
            },
            "after_learning": {
                "duration": "120 menit",
                "method": [
                    "Penugasan mandiri untuk menerapkan hasil belajar di pekerjaan.",
                    "Review hasil dan umpan balik dari atasan atau fasilitator.",
                    "Refleksi tindak lanjut untuk penguatan praktik kerja.",
                ],
                "description": f"Peserta menerjemahkan hasil belajar {topic} menjadi aksi kerja nyata.",
                "content": [
                    f"Ringkasan penerapan dasar {topic} di pekerjaan.",
                    "Tindak lanjut dan penguatan materi setelah sesi kelas.",
                ],
            },
        },
        "generation_notes": {
            "mode": "fallback",
            "reason": reason,
        },
    }
    return json.dumps(payload, ensure_ascii=False)
