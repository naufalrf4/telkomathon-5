import uuid
from collections.abc import Sequence
from typing import Any, cast

from sqlalchemy import select

from app.ai.llm import chat_complete_json
from app.ai.prompts.design_sessions import (
    build_elo_options_prompt,
    build_performance_options_prompt,
    build_source_summary_prompt,
    build_tlo_options_prompt,
)
from app.exceptions import (
    AIServiceException,
    AlreadyFinalizedException,
    InvalidStepException,
    NotFoundException,
    ValidationException,
)
from app.features.design_sessions.models import DesignSession
from app.features.design_sessions.schemas import CourseContextRequest, DesignSessionCreateRequest
from app.features.documents.models import Document
from app.features.syllabus.models import GeneratedSyllabus
from app.features.syllabus.service import SyllabusService


def build_default_journey(topic: str) -> dict[str, object]:
    return {
        "pre_learning": {
            "duration": "60 menit",
            "description": f"Peserta membangun konteks awal terkait {topic}.",
            "content": [
                f"Meninjau konteks kerja yang terkait dengan {topic}.",
                "Menyepakati fokus pembelajaran dan hasil yang diharapkan.",
            ],
        },
        "classroom": {
            "duration": "240 menit",
            "description": f"Peserta berlatih menerapkan {topic} melalui studi kasus dan diskusi terarah.",
            "content": [
                f"Fasilitator memandu konsep inti {topic}.",
                f"Peserta mempraktikkan penerapan {topic} pada studi kasus.",
                f"Peserta melakukan refleksi dan umpan balik atas hasil latihan {topic}.",
            ],
        },
        "after_learning": {
            "duration": "120 menit",
            "description": f"Peserta mentransfer hasil belajar {topic} ke rencana aksi nyata.",
            "content": [
                f"Peserta menerapkan rencana tindak lanjut {topic} di lingkungan kerja.",
                f"Peserta melaporkan hasil penerapan {topic} kepada atasan atau fasilitator.",
            ],
        },
    }


def fallback_source_summary(documents: Sequence[Document]) -> dict[str, object]:
    key_points: list[str] = []

    for document in documents:
        key_points.append(
            f"Dokumen {document.filename} mendukung perancangan materi {document.doc_type}."
        )

    deduped_key_points = list(dict.fromkeys(key_points))[:5]
    focus_points = deduped_key_points[:3]
    summary = _build_indonesian_company_profile_summary(focus_points)
    return {
        "summary": summary,
        "key_points": deduped_key_points
        or ["Sumber belajar siap digunakan untuk menyusun tujuan pembelajaran."],
        "company_profile_focus": focus_points,
    }


def normalize_text_options(payload: dict[str, Any], prefix: str) -> list[dict[str, object]]:
    raw_options = payload.get("options")
    if not isinstance(raw_options, list):
        return []

    options: list[dict[str, object]] = []
    for index, raw_item in enumerate(raw_options[:3], start=1):
        if not isinstance(raw_item, dict):
            continue
        text_value = raw_item.get("text") or raw_item.get("title")
        rationale_value = raw_item.get("rationale") or raw_item.get("description") or ""
        if not isinstance(text_value, str) or not text_value.strip():
            continue
        rationale_text = rationale_value.strip() if isinstance(rationale_value, str) else ""
        options.append(
            {
                "id": f"{prefix}-{index}",
                "text": text_value.strip(),
                "rationale": rationale_text,
            }
        )
    return options


def normalize_elo_options(payload: dict[str, Any]) -> list[dict[str, object]]:
    raw_options = payload.get("options")
    if not isinstance(raw_options, list):
        return []

    options: list[dict[str, object]] = []
    for index, raw_item in enumerate(raw_options[:5], start=1):
        if not isinstance(raw_item, dict):
            continue
        elo_value = raw_item.get("elo") or raw_item.get("text")
        rationale_value = raw_item.get("rationale") or ""
        if not isinstance(elo_value, str) or not elo_value.strip():
            continue
        rationale_text = rationale_value.strip() if isinstance(rationale_value, str) else ""
        options.append(
            {
                "id": f"elo-{index}",
                "elo": elo_value.strip(),
                "rationale": rationale_text,
            }
        )
    return options if len(options) >= 5 else []


def fallback_tlo_options(topic: str, target_level: int) -> list[dict[str, object]]:
    base = topic.strip() or "materi pelatihan"
    level_map = {
        1: "mengidentifikasi",
        2: "menjelaskan",
        3: "menerapkan",
        4: "menganalisis",
        5: "merancang",
    }
    terminal_verb = level_map.get(target_level, "menerapkan")
    return [
        {
            "id": "tlo-1",
            "text": f"Peserta mampu {terminal_verb} {base} sesuai kebutuhan kerja pada level {target_level}.",
            "rationale": "Menekankan penerapan kompetensi inti dalam konteks kerja.",
        },
        {
            "id": "tlo-2",
            "text": f"Peserta mampu menganalisis penerapan {base} untuk meningkatkan kualitas hasil kerja.",
            "rationale": "Menekankan kemampuan analisis dan peningkatan kinerja.",
        },
        {
            "id": "tlo-3",
            "text": f"Peserta mampu menyusun rencana implementasi {base} yang relevan dengan kebutuhan organisasi.",
            "rationale": "Menekankan hasil akhir yang siap diterapkan setelah pelatihan.",
        },
    ]


def fallback_performance_options(topic: str, selected_tlo_text: str) -> list[dict[str, object]]:
    return [
        {
            "id": "performance-1",
            "text": f"Menunjukkan penerapan {topic} pada studi kasus yang terstruktur.",
            "rationale": f"Selaras dengan TLO yang dipilih: {selected_tlo_text}",
        },
        {
            "id": "performance-2",
            "text": f"Menyusun keputusan kerja berbasis {topic} menggunakan data dan prosedur yang tepat.",
            "rationale": "Mendorong bukti performa yang dapat diamati dan dievaluasi.",
        },
        {
            "id": "performance-3",
            "text": f"Mengevaluasi hasil penerapan {topic} untuk perbaikan berkelanjutan.",
            "rationale": "Memberikan fokus kinerja yang relevan untuk tindak lanjut pascapelatihan.",
        },
    ]


def fallback_elo_options(topic: str, selected_performance_text: str) -> list[dict[str, object]]:
    return [
        {
            "id": "elo-1",
            "elo": f"Mendefinisikan istilah dan konsep dasar {topic} yang relevan dengan konteks kerja.",
            "rationale": selected_performance_text,
        },
        {
            "id": "elo-2",
            "elo": f"Mengidentifikasi komponen utama {topic} pada dokumen atau situasi kerja yang disediakan.",
            "rationale": selected_performance_text,
        },
        {
            "id": "elo-3",
            "elo": f"Menjelaskan hubungan antara konsep {topic} dan kebutuhan kerja organisasi.",
            "rationale": selected_performance_text,
        },
        {
            "id": "elo-4",
            "elo": f"Mengulang kembali langkah-langkah dasar {topic} sesuai panduan pembelajaran.",
            "rationale": selected_performance_text,
        },
        {
            "id": "elo-5",
            "elo": f"Mendeskripsikan contoh penerapan dasar {topic} dengan bahasa yang jelas dan tepat.",
            "rationale": selected_performance_text,
        },
    ]


class DesignSessionService:
    def __init__(self, db: Any) -> None:
        self.db: Any = db

    async def create_session(self, request: DesignSessionCreateRequest) -> DesignSession:
        _ = await self._get_ready_documents(request.document_ids)
        session = DesignSession(document_ids=[str(item) for item in request.document_ids])
        self.db.add(session)
        await self.db.flush()
        await self.db.refresh(session)
        self._attach_preview_fields(session)
        return session

    async def list_sessions(self) -> list[DesignSession]:
        result = await self.db.execute(
            select(DesignSession).order_by(
                DesignSession.updated_at.desc(),
                DesignSession.created_at.desc(),
            )
        )
        sessions = result.scalars().all()
        valid_sessions = [session for session in sessions if isinstance(session, DesignSession)]
        for session in valid_sessions:
            self._attach_preview_fields(session)
        return valid_sessions

    async def get_session(self, session_id: uuid.UUID) -> DesignSession:
        result = await self.db.execute(select(DesignSession).where(DesignSession.id == session_id))
        session = result.scalar_one_or_none()
        if not isinstance(session, DesignSession):
            raise NotFoundException("Design session", str(session_id))
        self._attach_preview_fields(session)
        return session

    async def start_assist(self, session_id: uuid.UUID) -> DesignSession:
        session = await self.get_session(session_id)
        self._ensure_not_finalized(session)
        documents = await self._get_ready_documents(self._document_ids_from_session(session))
        session.source_summary = await self._generate_source_summary(documents)
        if session.wizard_step == "uploaded":
            session.wizard_step = "summary_ready"
        await self.db.flush()
        await self.db.refresh(session)
        self._attach_preview_fields(session)
        return session

    async def update_course_context(
        self,
        session_id: uuid.UUID,
        request: CourseContextRequest,
    ) -> DesignSession:
        session = await self.get_session(session_id)
        self._ensure_not_finalized(session)
        if not session.source_summary:
            raise InvalidStepException("start-assist must be completed before course-context")
        session.course_context = request.model_dump()
        self._reset_after_course_context(session)
        session.wizard_step = "course_context_set"
        await self.db.flush()
        await self.db.refresh(session)
        self._attach_preview_fields(session)
        return session

    async def generate_tlo_options(self, session_id: uuid.UUID) -> DesignSession:
        session = await self.get_session(session_id)
        self._ensure_not_finalized(session)
        course_context = self._require_course_context(session)
        source_summary = self._require_source_summary(session)
        options = await self._generate_tlo_options(source_summary, course_context)
        session.tlo_options = options
        session.selected_tlo = None
        self._reset_after_tlo_selection(session)
        session.wizard_step = "tlo_options_ready"
        await self.db.flush()
        await self.db.refresh(session)
        self._attach_preview_fields(session)
        return session

    async def select_tlo(self, session_id: uuid.UUID, option_id: str) -> DesignSession:
        session = await self.get_session(session_id)
        self._ensure_not_finalized(session)
        session.selected_tlo = self._find_option(session.tlo_options, option_id, "TLO option")
        self._reset_after_tlo_selection(session)
        session.wizard_step = "tlo_selected"
        await self.db.flush()
        await self.db.refresh(session)
        self._attach_preview_fields(session)
        return session

    async def generate_performance_options(self, session_id: uuid.UUID) -> DesignSession:
        session = await self.get_session(session_id)
        self._ensure_not_finalized(session)
        course_context = self._require_course_context(session)
        source_summary = self._require_source_summary(session)
        selected_tlo = self._require_selected_tlo(session)
        options = await self._generate_performance_options(
            source_summary,
            course_context,
            selected_tlo,
        )
        session.performance_options = options
        session.selected_performance = None
        self._reset_after_performance_selection(session)
        session.wizard_step = "performance_options_ready"
        await self.db.flush()
        await self.db.refresh(session)
        self._attach_preview_fields(session)
        return session

    async def select_performance(self, session_id: uuid.UUID, option_id: str) -> DesignSession:
        session = await self.get_session(session_id)
        self._ensure_not_finalized(session)
        session.selected_performance = self._find_option(
            session.performance_options,
            option_id,
            "Performance option",
        )
        self._reset_after_performance_selection(session)
        session.wizard_step = "performance_selected"
        await self.db.flush()
        await self.db.refresh(session)
        self._attach_preview_fields(session)
        return session

    async def generate_elo_options(self, session_id: uuid.UUID) -> DesignSession:
        session = await self.get_session(session_id)
        self._ensure_not_finalized(session)
        course_context = self._require_course_context(session)
        source_summary = self._require_source_summary(session)
        selected_tlo = self._require_selected_tlo(session)
        selected_performance = self._require_selected_performance(session)
        options = await self._generate_elo_options(
            source_summary,
            course_context,
            selected_tlo,
            selected_performance,
        )
        session.elo_options = options
        session.selected_elos = []
        session.wizard_step = "elo_options_ready"
        await self.db.flush()
        await self.db.refresh(session)
        self._attach_preview_fields(session)
        return session

    async def select_elos(self, session_id: uuid.UUID, option_ids: list[str]) -> DesignSession:
        session = await self.get_session(session_id)
        self._ensure_not_finalized(session)
        if not session.elo_options:
            raise InvalidStepException("elo-options must be generated before elo-selection")
        selected = [
            option for option in session.elo_options if str(option.get("id")) in set(option_ids)
        ]
        if not selected:
            raise ValidationException("At least one ELO option must be selected")
        session.selected_elos = selected
        session.wizard_step = "elo_selected"
        await self.db.flush()
        await self.db.refresh(session)
        self._attach_preview_fields(session)
        return session

    async def finalize(self, session_id: uuid.UUID) -> tuple[DesignSession, GeneratedSyllabus]:
        session = await self.get_session(session_id)
        self._ensure_not_finalized(session)
        course_context = self._require_course_context(session)
        source_summary = self._require_source_summary(session)
        selected_tlo = self._require_selected_tlo(session)
        selected_performance = self._require_selected_performance(session)
        if not session.selected_elos:
            raise InvalidStepException("elo-selection must be completed before finalize")

        syllabus = await SyllabusService(self.db).create_finalized_syllabus(
            topic=self._course_topic(course_context),
            target_level=self._course_target_level(course_context),
            course_category=self._optional_course_text(course_context, "course_category"),
            client_company_name=self._optional_course_text(course_context, "client_company_name"),
            course_title=self._course_title(course_context),
            company_profile_summary=self._company_profile_summary(source_summary),
            commercial_overview=self._commercial_overview(course_context),
            tlo=str(selected_tlo["text"]),
            performance_result=str(selected_performance["text"]),
            condition_result=self._build_condition_result(course_context, selected_performance),
            standard_result=self._build_standard_result(session.selected_elos),
            elos=self._serialize_selected_elos(session.selected_elos),
            source_doc_ids=list(session.document_ids),
        )

        session.finalized_syllabus_id = syllabus.id
        session.wizard_step = "finalized"
        await self.db.flush()
        await self.db.refresh(session)
        self._attach_preview_fields(session)
        return session, syllabus

    def _attach_preview_fields(self, session: DesignSession) -> None:
        preview_condition_result: str | None = None
        preview_standard_result: str | None = None

        if isinstance(session.course_context, dict) and isinstance(
            session.selected_performance, dict
        ):
            preview_condition_result = self._build_condition_result(
                session.course_context,
                session.selected_performance,
            )

        if isinstance(session.selected_elos, list):
            preview_standard_result = self._build_standard_result(session.selected_elos)

        preview_session = cast(Any, session)
        preview_session.preview_condition_result = preview_condition_result
        preview_session.preview_standard_result = preview_standard_result

    async def _get_ready_documents(self, document_ids: Sequence[uuid.UUID]) -> list[Document]:
        result = await self.db.execute(select(Document).where(Document.id.in_(document_ids)))
        documents = list(result.scalars().all())
        if len(documents) != len(document_ids):
            raise ValidationException("All document_ids must reference existing documents")

        documents_by_id = {document.id: document for document in documents}
        ordered_documents = [
            documents_by_id[item] for item in document_ids if item in documents_by_id
        ]
        if any(document.status != "ready" for document in ordered_documents):
            raise ValidationException(
                "All documents must be ready before creating a design session"
            )
        return ordered_documents

    def _document_ids_from_session(self, session: DesignSession) -> list[uuid.UUID]:
        return [uuid.UUID(str(item)) for item in session.document_ids]

    def _ensure_not_finalized(self, session: DesignSession) -> None:
        if session.finalized_syllabus_id is not None or session.wizard_step == "finalized":
            raise AlreadyFinalizedException("Design session already finalized")

    def _require_source_summary(self, session: DesignSession) -> dict[str, object]:
        if not isinstance(session.source_summary, dict):
            raise InvalidStepException("start-assist must be completed before this step")
        return session.source_summary

    def _require_course_context(self, session: DesignSession) -> dict[str, object]:
        if not isinstance(session.course_context, dict):
            raise InvalidStepException("course-context must be completed before this step")
        return session.course_context

    def _require_selected_tlo(self, session: DesignSession) -> dict[str, object]:
        if not isinstance(session.selected_tlo, dict):
            raise InvalidStepException("tlo-selection must be completed before this step")
        return session.selected_tlo

    def _require_selected_performance(self, session: DesignSession) -> dict[str, object]:
        if not isinstance(session.selected_performance, dict):
            raise InvalidStepException("performance-selection must be completed before this step")
        return session.selected_performance

    def _course_topic(self, course_context: dict[str, object]) -> str:
        topic = course_context.get("topic")
        if not isinstance(topic, str) or not topic.strip():
            raise ValidationException("Course context topic is invalid")
        return topic.strip()

    def _course_target_level(self, course_context: dict[str, object]) -> int:
        target_level = course_context.get("target_level")
        if isinstance(target_level, int):
            return target_level
        if isinstance(target_level, str) and target_level.isdigit():
            return int(target_level)
        raise ValidationException("Course context target_level is invalid")

    def _optional_course_text(
        self,
        course_context: dict[str, object],
        key: str,
    ) -> str | None:
        value = course_context.get(key)
        if not isinstance(value, str):
            return None
        normalized = self._normalize_export_text(value)
        return normalized or None

    def _course_title(self, course_context: dict[str, object]) -> str:
        explicit_title = self._optional_course_text(course_context, "course_title")
        return explicit_title or self._course_topic(course_context)

    def _company_profile_summary(self, source_summary: dict[str, object]) -> str | None:
        summary = source_summary.get("summary")
        if not isinstance(summary, str):
            return None
        focus_points = self._summary_focus_points(source_summary)
        normalized = self._normalize_company_profile_summary(summary, focus_points)
        return normalized or None

    def _summary_focus_points(self, source_summary: dict[str, object]) -> list[str]:
        company_profile_focus = source_summary.get("company_profile_focus")
        if isinstance(company_profile_focus, list):
            normalized = [
                self._normalize_export_text(item)
                for item in company_profile_focus
                if isinstance(item, str) and self._normalize_export_text(item)
            ]
            if normalized:
                return normalized[:3]

        key_points = source_summary.get("key_points")
        if isinstance(key_points, list):
            normalized = [
                self._normalize_export_text(item)
                for item in key_points
                if isinstance(item, str) and self._normalize_export_text(item)
            ]
            return normalized[:3]

        return []

    def _commercial_overview(self, course_context: dict[str, object]) -> str | None:
        explicit_overview = self._optional_course_text(course_context, "commercial_overview")
        if explicit_overview:
            return explicit_overview
        additional_context = self._optional_course_text(course_context, "additional_context")
        return additional_context

    def _normalize_export_text(self, value: str) -> str:
        normalized = " ".join(value.replace("\r", " ").split())
        return normalized.lstrip("$ ").strip()

    def _normalize_company_profile_summary(self, value: str, focus_points: Sequence[str]) -> str:
        normalized_lines = [line.strip() for line in value.replace("\r", "\n").split("\n")]
        filtered_lines: list[str] = []
        ignored_prefixes = (
            "business profile",
            "organization context",
            "ringkasan organisasi",
            "profil perusahaan",
        )

        for line in normalized_lines:
            cleaned = self._normalize_export_text(line)
            if not cleaned:
                continue
            if cleaned.lower().startswith(ignored_prefixes):
                continue
            filtered_lines.append(cleaned)

        combined = " ".join(filtered_lines).strip()
        if not combined:
            return _build_indonesian_company_profile_summary(focus_points)

        if _looks_predominantly_english(combined):
            return _build_indonesian_company_profile_summary(focus_points)

        sentences = [segment.strip() for segment in combined.split(".") if segment.strip()]
        if sentences:
            capitalized = _capitalize_sentences(sentences[:3])
            if capitalized:
                return capitalized

        return _capitalize_sentences([combined])

    def _build_condition_result(
        self,
        course_context: dict[str, object],
        selected_performance: dict[str, object],
    ) -> str:
        topic = self._course_topic(course_context)
        target_level = self._course_target_level(course_context)
        rationale = selected_performance.get("rationale")
        rationale_text = rationale.strip() if isinstance(rationale, str) else ""
        base = (
            f"Peserta menunjukkan performa {topic} pada level {target_level} melalui studi kasus, "
            "diskusi terarah, dan konteks kerja yang relevan."
        )
        if rationale_text:
            return f"{base} {rationale_text}"
        return base

    def _build_standard_result(self, selected_elos: Sequence[dict[str, object]]) -> str:
        elo_count = len([item for item in selected_elos if isinstance(item, dict)])
        if elo_count <= 0:
            return "Keberhasilan peserta diukur melalui ketercapaian indikator unjuk kerja yang disepakati."
        return (
            f"Keberhasilan peserta diukur melalui demonstrasi konsisten pada {elo_count} enabling learning outcome, "
            "akurasi penerapan di konteks kerja, dan kualitas rencana tindak lanjut yang dapat dijalankan."
        )

    def _find_option(
        self,
        options: list[dict[str, object]],
        option_id: str,
        label: str,
    ) -> dict[str, object]:
        for option in options:
            if str(option.get("id")) == option_id:
                return option
        raise ValidationException(f"{label} {option_id} is invalid")

    def _serialize_selected_elos(
        self,
        selected_elos: Sequence[dict[str, object]],
    ) -> list[dict[str, object]]:
        serialized: list[dict[str, object]] = []
        for item in selected_elos:
            elo_text = str(item.get("elo", "")).strip()
            if not elo_text:
                raise ValidationException("Selected ELO must include valid elo text")
            serialized.append(
                {
                    "elo": elo_text,
                }
            )
        return serialized

    def _reset_after_course_context(self, session: DesignSession) -> None:
        session.tlo_options = []
        session.selected_tlo = None
        session.performance_options = []
        session.selected_performance = None
        session.elo_options = []
        session.selected_elos = []
        session.finalized_syllabus_id = None

    def _reset_after_tlo_selection(self, session: DesignSession) -> None:
        session.performance_options = []
        session.selected_performance = None
        session.elo_options = []
        session.selected_elos = []
        session.finalized_syllabus_id = None

    def _reset_after_performance_selection(self, session: DesignSession) -> None:
        session.elo_options = []
        session.selected_elos = []
        session.finalized_syllabus_id = None

    async def _generate_source_summary(self, documents: Sequence[Document]) -> dict[str, object]:
        fallback = fallback_source_summary(documents)
        document_context = "\n\n".join(
            f"File: {document.filename}\nType: {document.doc_type}\nContent:\n{document.content_text[:2400]}"
            for document in documents
        )
        try:
            payload = await chat_complete_json(build_source_summary_prompt(document_context))
        except AIServiceException:
            return fallback

        summary = payload.get("summary")
        key_points = payload.get("key_points")
        if not isinstance(summary, str) or not summary.strip():
            return fallback
        if not isinstance(key_points, list):
            return fallback

        normalized_key_points = [
            item.strip() for item in key_points if isinstance(item, str) and item.strip()
        ]
        if not normalized_key_points:
            return fallback
        company_profile_focus = payload.get("company_profile_focus")
        normalized_focus = (
            [
                item.strip()
                for item in company_profile_focus
                if isinstance(item, str) and item.strip()
            ]
            if isinstance(company_profile_focus, list)
            else []
        )
        normalized_summary = self._normalize_company_profile_summary(
            summary.strip(),
            normalized_focus[:5] or normalized_key_points[:3],
        )
        return {
            "summary": normalized_summary or fallback["summary"],
            "key_points": normalized_key_points[:5],
            "company_profile_focus": normalized_focus[:5] or normalized_key_points[:3],
        }

    async def _generate_tlo_options(
        self,
        source_summary: dict[str, object],
        course_context: dict[str, object],
    ) -> list[dict[str, object]]:
        topic = self._course_topic(course_context)
        target_level = self._course_target_level(course_context)
        fallback = fallback_tlo_options(topic, target_level)
        try:
            payload = await chat_complete_json(
                build_tlo_options_prompt(
                    topic=topic,
                    target_level=target_level,
                    summary=str(source_summary.get("summary", "")),
                    additional_context=str(course_context.get("additional_context", "")),
                )
            )
        except AIServiceException:
            return fallback

        options = normalize_text_options(payload, "tlo")
        return options or fallback

    async def _generate_performance_options(
        self,
        source_summary: dict[str, object],
        course_context: dict[str, object],
        selected_tlo: dict[str, object],
    ) -> list[dict[str, object]]:
        topic = self._course_topic(course_context)
        selected_tlo_text = str(selected_tlo["text"])
        fallback = fallback_performance_options(topic, selected_tlo_text)
        try:
            payload = await chat_complete_json(
                build_performance_options_prompt(
                    source_summary=str(source_summary.get("summary", "")),
                    topic=topic,
                    target_level=self._course_target_level(course_context),
                    selected_tlo=selected_tlo_text,
                )
            )
        except AIServiceException:
            return fallback

        options = normalize_text_options(payload, "performance")
        return options or fallback

    async def _generate_elo_options(
        self,
        source_summary: dict[str, object],
        course_context: dict[str, object],
        selected_tlo: dict[str, object],
        selected_performance: dict[str, object],
    ) -> list[dict[str, object]]:
        topic = self._course_topic(course_context)
        selected_performance_text = str(selected_performance["text"])
        fallback = fallback_elo_options(topic, selected_performance_text)
        try:
            payload = await chat_complete_json(
                build_elo_options_prompt(
                    source_summary=str(source_summary.get("summary", "")),
                    topic=topic,
                    target_level=self._course_target_level(course_context),
                    selected_tlo=str(selected_tlo["text"]),
                    selected_performance=selected_performance_text,
                )
            )
        except AIServiceException:
            return fallback

        options = normalize_elo_options(payload)
        return options or fallback


def _looks_predominantly_english(value: str) -> bool:
    lowered = f" {value.lower()} "
    english_markers = (
        " the ",
        " and ",
        " with ",
        " company ",
        " business ",
        " organization ",
        " profile ",
        " context ",
        " learning ",
        " training ",
        " skills ",
    )
    return sum(1 for marker in english_markers if marker in lowered) >= 2


def _capitalize_sentences(sentences: Sequence[str]) -> str:
    normalized_sentences: list[str] = []
    for sentence in sentences:
        cleaned = " ".join(sentence.split()).strip().rstrip(".")
        if not cleaned:
            continue
        normalized_sentences.append(cleaned[:1].upper() + cleaned[1:] + ".")
    return " ".join(normalized_sentences)


def _build_indonesian_company_profile_summary(focus_points: Sequence[str]) -> str:
    cleaned_points = [
        " ".join(point.split()).strip().rstrip(".") for point in focus_points if point.strip()
    ]
    if not cleaned_points:
        return "Perusahaan memiliki konteks bisnis dan kebutuhan pembelajaran yang menjadi dasar penyusunan silabus."

    lead_sentence = "Perusahaan memiliki konteks bisnis dan kebutuhan pembelajaran yang menjadi dasar penyusunan silabus."
    if len(cleaned_points) == 1:
        focus_sentence = f"Fokus utama perusahaan mencakup {cleaned_points[0]}."
    elif len(cleaned_points) == 2:
        focus_sentence = (
            f"Fokus utama perusahaan mencakup {cleaned_points[0]} dan {cleaned_points[1]}."
        )
    else:
        focus_sentence = (
            f"Fokus utama perusahaan mencakup {cleaned_points[0]}, {cleaned_points[1]}, "
            f"dan {cleaned_points[2]}."
        )

    return _capitalize_sentences([lead_sentence, focus_sentence])
