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
        "elos": [
            {
                "elo": f"Menjelaskan konsep inti {topic} dan relevansinya di pekerjaan.",
                "pce": [
                    f"Performance: menjabarkan konsep utama {topic} secara runtut.",
                    "Condition: menggunakan studi kasus, diskusi fasilitator, dan dokumen pendukung yang tersedia.",
                    "Standard: penjelasan akurat, mudah dipahami, dan dapat diterapkan.",
                ],
            },
            {
                "elo": f"Menganalisis kebutuhan implementasi {topic} pada situasi kerja nyata.",
                "pce": [
                    f"Performance: memetakan langkah implementasi {topic} untuk unit kerja sendiri.",
                    "Condition: berdasarkan data, konteks organisasi, dan prioritas operasional saat ini.",
                    "Standard: analisis menghasilkan rekomendasi yang relevan dan dapat ditindaklanjuti.",
                ],
            },
            {
                "elo": f"Menyusun rencana aksi penerapan {topic} setelah pembelajaran selesai.",
                "pce": [
                    "Performance: membuat rencana aksi dan indikator keberhasilan awal.",
                    "Condition: dikerjakan melalui refleksi, template tindak lanjut, dan umpan balik fasilitator.",
                    "Standard: rencana aksi spesifik, terukur, dan memiliki target waktu yang jelas.",
                ],
            },
        ],
        "journey": {
            "pre_learning": [
                f"Mempelajari pengantar singkat mengenai {topic}.",
                "Mengidentifikasi tantangan kerja yang ingin diselesaikan melalui pembelajaran ini.",
            ],
            "classroom": [
                f"Diskusi terarah mengenai konsep inti dan praktik {topic}.",
                "Latihan studi kasus dan umpan balik fasilitator.",
                "Refleksi kelompok untuk menyepakati langkah implementasi pascapelatihan.",
            ],
            "after_learning": [
                f"Menjalankan rencana aksi penerapan {topic} di pekerjaan.",
                "Mengevaluasi hasil awal bersama atasan atau mentor kerja.",
            ],
        },
        "generation_notes": {
            "mode": "fallback",
            "reason": reason,
        },
    }
    return json.dumps(payload, ensure_ascii=False)
