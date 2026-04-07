import re
import uuid
from collections.abc import Sequence
from difflib import SequenceMatcher
from typing import Any, cast

from sqlalchemy import select

from app.ai.llm import chat_complete_json
from app.ai.prompts.design_sessions import (
    build_elo_options_prompt,
    build_performance_options_prompt,
    build_source_summary_prompt,
    build_tlo_options_prompt,
)
from app.ai.prompts.syllabus import build_final_syllabus_sections_prompt
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

_FINAL_SYNTHESIS_PROMPT_VERSION = "final-synthesis-v1"


def build_default_journey(topic: str) -> dict[str, object]:
    content_outline = _build_topic_outline(topic)
    return {
        "pre_learning": {
            "duration": "60 menit",
            "method": [
                f"Orientasi mandiri untuk mengenali ruang lingkup {topic}.",
                "Penelusuran materi pengantar secara bertahap.",
                "Refleksi awal terhadap kebutuhan kerja yang terkait.",
            ],
            "description": f"Peserta membangun konteks awal terkait {topic}.",
            "content": [
                f"Pengantar konteks dan tujuan belajar {topic}.",
                f"Peta konsep awal: {content_outline[0]} dan {content_outline[1]}.",
            ],
        },
        "classroom": {
            "duration": "240 menit",
            "method": [
                f"Paparan fasilitator untuk membedah konsep inti {topic}.",
                "Demonstrasi dan walkthrough contoh kerja nyata.",
                "Diskusi terarah serta latihan terstruktur berbasis studi kasus.",
            ],
            "description": f"Peserta berlatih menerapkan {topic} melalui studi kasus dan diskusi terarah.",
            "content": content_outline,
        },
        "after_learning": {
            "duration": "120 menit",
            "method": [
                f"Penugasan mandiri untuk mencoba penerapan {topic} di konteks kerja.",
                "Review hasil dan umpan balik dari atasan atau fasilitator.",
                "Refleksi tindak lanjut untuk penguatan praktik kerja.",
            ],
            "description": f"Peserta mentransfer hasil belajar {topic} ke rencana aksi nyata.",
            "content": [
                f"Ringkasan penerapan {content_outline[-2]} pada konteks kerja.",
                f"Tindak lanjut mandiri berdasarkan {content_outline[-1]}.",
            ],
        },
    }


def fallback_source_summary(documents: Sequence[Document]) -> dict[str, object]:
    focus_points = _extract_company_profile_focus(documents)
    key_points = focus_points[:]
    if not key_points:
        key_points = [
            "Perusahaan memiliki kebutuhan pembelajaran yang perlu diterjemahkan ke dalam target kemampuan kerja.",
            "Dokumen sumber menunjukkan konteks bisnis, proses, dan istilah kerja yang relevan untuk penyusunan silabus.",
            "Fokus pembelajaran diarahkan pada penguatan kemampuan praktis yang dibutuhkan organisasi.",
        ]

    deduped_key_points = list(dict.fromkeys(key_points))[:5]
    summary = _build_indonesian_company_profile_summary(focus_points)
    company_name = _document_company_name(documents)
    extracted_summary = _document_company_profile_summary(documents)
    return {
        "summary": summary,
        "key_points": deduped_key_points
        or ["Sumber belajar siap digunakan untuk menyusun tujuan pembelajaran."],
        "company_profile_focus": focus_points,
        "company_name": company_name,
        "company_profile_summary": extracted_summary or summary,
        "company_profile_confidence": _document_company_confidence(documents),
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
    terminal_verb = _primary_tlo_verbs(target_level)[0]
    return [
        {
            "id": "tlo-1",
            "text": f"Peserta mampu {terminal_verb} {base} sesuai kebutuhan kerja pada level {target_level}.",
            "rationale": "Menekankan penerapan kompetensi inti dalam konteks kerja.",
        },
        {
            "id": "tlo-2",
            "text": f"Peserta mampu {_secondary_tlo_verbs(target_level)[0]} penerapan {base} untuk meningkatkan kualitas hasil kerja.",
            "rationale": "Menekankan kemampuan analisis dan peningkatan kinerja.",
        },
        {
            "id": "tlo-3",
            "text": f"Peserta mampu {_secondary_tlo_verbs(target_level)[1]} langkah implementasi {base} yang relevan dengan kebutuhan organisasi.",
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


def fallback_elo_options(
    topic: str,
    selected_performance_text: str,
    *,
    regenerate: bool = False,
    previous_elo_texts: Sequence[str] | None = None,
) -> list[dict[str, object]]:
    primary_set = [
        f"Mendefinisikan istilah dan konsep dasar {topic} yang relevan dengan konteks kerja.",
        f"Mengidentifikasi komponen utama {topic} pada dokumen atau situasi kerja yang disediakan.",
        f"Menjelaskan hubungan antara konsep {topic} dan kebutuhan kerja organisasi.",
        f"Mengulang kembali langkah-langkah dasar {topic} sesuai panduan pembelajaran.",
        f"Mendeskripsikan contoh penerapan dasar {topic} dengan bahasa yang jelas dan tepat.",
    ]
    alternate_set = [
        f"Menyebutkan istilah inti {topic} yang perlu dikenali dalam konteks kerja.",
        f"Menjelaskan fungsi komponen utama {topic} yang paling sering digunakan dalam pekerjaan.",
        f"Menguraikan alur dasar {topic} dari input hingga keluaran yang diharapkan.",
        f"Mengelompokkan elemen penting {topic} berdasarkan peran atau kegunaannya.",
        f"Mencontohkan penerapan awal {topic} pada kasus kerja sederhana.",
    ]
    tertiary_set = [
        f"Menjabarkan istilah utama {topic} yang menjadi fondasi pembelajaran awal.",
        f"Membedakan peran setiap komponen dasar {topic} pada alur kerja sederhana.",
        f"Menuturkan tahapan umum {topic} secara runtut dan mudah diikuti.",
        f"Menghubungkan konsep dasar {topic} dengan kebutuhan kerja yang paling dekat.",
        f"Menunjukkan contoh sederhana penggunaan awal {topic} pada pekerjaan sehari-hari.",
    ]
    normalized_previous = {item.strip() for item in (previous_elo_texts or []) if item.strip()}

    if not regenerate:
        selected_set = primary_set
    else:
        variants = [alternate_set, tertiary_set, primary_set]
        selected_set = next(
            (variant for variant in variants if not normalized_previous.intersection(variant)),
            tertiary_set,
        )

    return [
        {
            "id": f"elo-{index}",
            "elo": elo_text,
            "rationale": selected_performance_text,
        }
        for index, elo_text in enumerate(selected_set, start=1)
    ]


def _build_topic_outline(topic: str) -> list[str]:
    normalized_topic = topic.strip() or "topik pembelajaran"
    lowered = normalized_topic.lower()

    if "machine learning" in lowered or lowered == "ml" or " ml " in f" {lowered} ":
        return [
            "Konsep AI, Machine Learning, dan Deep Learning.",
            "Dasar Python untuk workflow machine learning.",
            "Library Python yang umum dipakai untuk machine learning.",
            "Pre-processing data sebelum pemodelan.",
            "Exploratory Data Analysis (EDA) untuk memahami dataset.",
        ]

    return [
        f"Konsep dasar dan terminologi inti {normalized_topic}.",
        f"Kerangka kerja, tools, atau library utama untuk {normalized_topic}.",
        f"Alur kerja dasar dan praktik inti dalam {normalized_topic}.",
        f"Analisis contoh kasus atau data terkait {normalized_topic}.",
        f"Penerapan {normalized_topic} pada konteks kerja nyata.",
    ]


def _primary_tlo_verbs(target_level: int) -> tuple[str, ...]:
    mapping = {
        1: ("mengidentifikasi", "menjelaskan"),
        2: ("menjelaskan", "menguraikan"),
        3: ("menerapkan", "menganalisis"),
        4: ("menganalisis", "mengevaluasi"),
        5: ("merancang", "mengevaluasi"),
    }
    return mapping.get(target_level, ("menerapkan", "menganalisis"))


def _secondary_tlo_verbs(target_level: int) -> tuple[str, str]:
    mapping = {
        1: ("menjelaskan", "menyusun"),
        2: ("menerapkan dasar", "menyusun"),
        3: ("menganalisis", "menyusun"),
        4: ("mengevaluasi", "merumuskan"),
        5: ("mengevaluasi", "merancang"),
    }
    return mapping.get(target_level, ("menganalisis", "menyusun"))


def _allowed_tlo_verbs(target_level: int) -> tuple[str, ...]:
    mapping = {
        1: ("mengidentifikasi", "mengenali", "menyebutkan", "menjelaskan"),
        2: ("menjelaskan", "menguraikan", "menafsirkan", "menerapkan dasar", "menggunakan"),
        3: ("menerapkan", "mengolah", "menginterpretasikan", "menganalisis"),
        4: ("menganalisis", "mengevaluasi", "memvalidasi", "mengoptimalkan"),
        5: ("mengevaluasi", "merancang", "merumuskan", "membangun"),
    }
    return mapping.get(target_level, ("menerapkan", "menganalisis"))


def _disallowed_tlo_verbs(target_level: int) -> tuple[str, ...]:
    mapping = {
        1: ("menganalisis", "mengevaluasi", "merancang", "membangun", "memvalidasi"),
        2: ("mengevaluasi", "merancang", "membangun", "memvalidasi"),
        3: ("menyebutkan", "mengenali"),
        4: ("menyebutkan", "mengenali", "menerapkan dasar"),
        5: ("menyebutkan", "mengenali", "menjelaskan dasar", "menerapkan dasar"),
    }
    return mapping.get(target_level, ())


def matches_tlo_level(text: str, target_level: int) -> bool:
    normalized = text.strip().lower()
    if not normalized:
        return False
    allowed = _allowed_tlo_verbs(target_level)
    disallowed = _disallowed_tlo_verbs(target_level)
    generic_disallowed = (
        "memahami",
        "mengetahui",
        "mempelajari",
        "menguasai",
        "mengapresiasi",
    )
    has_allowed = any(f" {verb} " in f" {normalized} " for verb in allowed)
    has_disallowed = any(f" {verb} " in f" {normalized} " for verb in disallowed)
    has_generic_disallowed = any(f" {verb} " in f" {normalized} " for verb in generic_disallowed)
    return has_allowed and not has_disallowed and not has_generic_disallowed


def _extract_company_profile_focus(documents: Sequence[Document]) -> list[str]:
    scored_points: list[tuple[int, str]] = []
    for document in documents:
        content = document.content_text or ""
        if not content.strip():
            continue
        candidates = re.split(r"(?<=[.!?])\s+|\n+", content)
        for raw_candidate in candidates:
            candidate = _sanitize_focus_point(raw_candidate)
            if candidate:
                score = _score_focus_point(candidate)
                if score >= 4:
                    scored_points.append((score, candidate))
            if len(scored_points) >= 12:
                break
        if len(scored_points) >= 12:
            break

    ordered = sorted(scored_points, key=lambda item: (-item[0], len(item[1])))
    deduped: list[str] = []
    for _, point in ordered:
        if point not in deduped:
            deduped.append(point)
        if len(deduped) >= 5:
            break

    return deduped


def _sanitize_focus_point(value: str) -> str | None:
    cleaned = " ".join(value.replace("\r", " ").split()).strip().strip("-•* ")
    if not cleaned:
        return None
    cleaned = _clean_focus_point_clauses(cleaned)
    if not cleaned:
        return None
    lowered = cleaned.lower()
    if len(cleaned) < 30:
        return None
    if re.search(r"\b\d{2,}([./_-]\d+)*\b", cleaned):
        return None
    if any(ext in lowered for ext in (".pdf", ".docx", ".pptx")):
        return None
    ignored_prefixes = (
        "dokumen ",
        "document ",
        "table of contents",
        "daftar isi",
        "laporan tahunan",
        "annual report",
        "halaman ",
        "page ",
    )
    if lowered.startswith(ignored_prefixes):
        return None
    if _looks_like_low_signal_profile_point(cleaned):
        return None
    if cleaned.isupper():
        return None
    return cleaned.rstrip(". ") + "."


def _clean_focus_point_clauses(value: str) -> str:
    clauses = [segment.strip(" .") for segment in re.split(r"[,;]", value) if segment.strip(" .")]
    kept: list[str] = []
    for clause in clauses:
        if _contains_english_profile_terms(clause):
            continue
        if len(clause.split()) < 4:
            continue
        kept.append(clause)
    if kept:
        return ", ".join(kept)
    return "" if _contains_english_profile_terms(value) else value


def _score_focus_point(value: str) -> int:
    lowered = value.lower()
    score = 0
    business_markers = (
        "perusahaan",
        "organisasi",
        "layanan",
        "bisnis",
        "operasional",
        "pelanggan",
        "digital",
        "kapabilitas",
        "kompetensi",
        "produk",
        "strategi",
        "transformasi",
        "kinerja",
        "proses",
    )
    for marker in business_markers:
        if marker in lowered:
            score += 2
    if 50 <= len(value) <= 180:
        score += 2
    if lowered.endswith("."):
        score += 1
    if _looks_predominantly_english(value):
        score -= 2
    if _looks_like_low_signal_profile_point(value):
        score -= 3
    return score


class DesignSessionService:
    def __init__(self, db: Any) -> None:
        self.db: Any = db

    async def create_session(
        self, request: DesignSessionCreateRequest, *, owner_id: uuid.UUID | None = None
    ) -> DesignSession:
        documents = await self._get_ready_documents(request.document_ids)
        source_summary = await self._generate_source_summary(documents)
        session = DesignSession(
            document_ids=[str(item) for item in request.document_ids],
            owner_id=owner_id,
            source_summary=source_summary,
            course_context=self._build_prefill_course_context(source_summary),
            wizard_step="summary_ready",
        )
        self.db.add(session)
        await self.db.flush()
        await self.db.refresh(session)
        self._attach_preview_fields(session)
        return session

    async def list_sessions(self, *, owner_id: uuid.UUID | None = None) -> list[DesignSession]:
        query = select(DesignSession)
        if owner_id is not None:
            query = query.where(DesignSession.owner_id == owner_id)
        query = query.order_by(
            DesignSession.updated_at.desc(),
            DesignSession.created_at.desc(),
        )
        result = await self.db.execute(query)
        sessions = result.scalars().all()
        valid_sessions = [session for session in sessions if isinstance(session, DesignSession)]
        for session in valid_sessions:
            self._attach_preview_fields(session)
        return valid_sessions

    async def get_session(
        self,
        session_id: uuid.UUID,
        *,
        owner_id: uuid.UUID | None = None,
    ) -> DesignSession:
        query = select(DesignSession).where(DesignSession.id == session_id)
        if owner_id is not None:
            query = query.where(DesignSession.owner_id == owner_id)
        result = await self.db.execute(query)
        session = result.scalar_one_or_none()
        if not isinstance(session, DesignSession):
            raise NotFoundException("Design session", str(session_id))
        self._attach_preview_fields(session)
        return session

    async def start_assist(
        self,
        session_id: uuid.UUID,
        *,
        owner_id: uuid.UUID | None = None,
    ) -> DesignSession:
        session = (
            await self.get_session(session_id)
            if owner_id is None
            else await self.get_session(session_id, owner_id=owner_id)
        )
        self._ensure_not_finalized(session)
        documents = await self._get_ready_documents(self._document_ids_from_session(session))
        generated_source_summary = await self._generate_source_summary(documents)
        session.source_summary = generated_source_summary
        session.course_context = self._merge_prefill_course_context(
            session.course_context,
            generated_source_summary,
        )
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
        *,
        owner_id: uuid.UUID | None = None,
    ) -> DesignSession:
        session = (
            await self.get_session(session_id)
            if owner_id is None
            else await self.get_session(session_id, owner_id=owner_id)
        )
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

    async def generate_tlo_options(
        self,
        session_id: uuid.UUID,
        *,
        owner_id: uuid.UUID | None = None,
    ) -> DesignSession:
        session = (
            await self.get_session(session_id)
            if owner_id is None
            else await self.get_session(session_id, owner_id=owner_id)
        )
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

    async def select_tlo(
        self,
        session_id: uuid.UUID,
        option_id: str,
        *,
        owner_id: uuid.UUID | None = None,
    ) -> DesignSession:
        session = (
            await self.get_session(session_id)
            if owner_id is None
            else await self.get_session(session_id, owner_id=owner_id)
        )
        self._ensure_not_finalized(session)
        session.selected_tlo = self._find_option(session.tlo_options, option_id, "TLO option")
        self._reset_after_tlo_selection(session)
        session.wizard_step = "tlo_selected"
        await self.db.flush()
        await self.db.refresh(session)
        self._attach_preview_fields(session)
        return session

    async def generate_performance_options(
        self,
        session_id: uuid.UUID,
        *,
        owner_id: uuid.UUID | None = None,
    ) -> DesignSession:
        session = (
            await self.get_session(session_id)
            if owner_id is None
            else await self.get_session(session_id, owner_id=owner_id)
        )
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

    async def select_performance(
        self,
        session_id: uuid.UUID,
        option_id: str,
        *,
        owner_id: uuid.UUID | None = None,
    ) -> DesignSession:
        session = (
            await self.get_session(session_id)
            if owner_id is None
            else await self.get_session(session_id, owner_id=owner_id)
        )
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

    async def generate_elo_options(
        self,
        session_id: uuid.UUID,
        *,
        owner_id: uuid.UUID | None = None,
    ) -> DesignSession:
        session = (
            await self.get_session(session_id)
            if owner_id is None
            else await self.get_session(session_id, owner_id=owner_id)
        )
        self._ensure_not_finalized(session)
        course_context = self._require_course_context(session)
        source_summary = self._require_source_summary(session)
        selected_tlo = self._require_selected_tlo(session)
        selected_performance = self._require_selected_performance(session)
        previous_elo_texts = [
            str(option.get("elo", "")).strip()
            for option in session.elo_options
            if isinstance(option, dict) and str(option.get("elo", "")).strip()
        ]
        options = await self._generate_elo_options(
            source_summary,
            course_context,
            selected_tlo,
            selected_performance,
            previous_elo_texts,
        )
        session.elo_options = options
        session.selected_elos = []
        session.wizard_step = "elo_options_ready"
        await self.db.flush()
        await self.db.refresh(session)
        self._attach_preview_fields(session)
        return session

    async def select_elos(
        self,
        session_id: uuid.UUID,
        option_ids: list[str],
        *,
        owner_id: uuid.UUID | None = None,
    ) -> DesignSession:
        session = (
            await self.get_session(session_id)
            if owner_id is None
            else await self.get_session(session_id, owner_id=owner_id)
        )
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
        try:
            session.ai_preview_sections = await self._generate_preview_sections(session)
        except Exception:
            session.ai_preview_sections = None
        await self.db.flush()
        await self.db.refresh(session)
        self._attach_preview_fields(session)
        return session

    async def finalize(
        self,
        session_id: uuid.UUID,
        *,
        owner_id: uuid.UUID | None = None,
    ) -> tuple[DesignSession, GeneratedSyllabus]:
        session = (
            await self.get_session(session_id)
            if owner_id is None
            else await self.get_session(session_id, owner_id=owner_id)
        )
        self._ensure_not_finalized(session)
        course_context = self._require_course_context(session)
        source_summary = self._require_source_summary(session)
        selected_tlo = self._require_selected_tlo(session)
        selected_performance = self._require_selected_performance(session)
        if not session.selected_elos:
            raise InvalidStepException("elo-selection must be completed before finalize")

        company_profile_summary = self._company_profile_summary(source_summary)
        commercial_overview, commercial_overview_source = self._resolve_commercial_overview(
            course_context,
            company_profile_summary,
        )
        final_sections = await self._generate_final_sections(
            source_summary=source_summary,
            course_context=course_context,
            selected_tlo=selected_tlo,
            selected_performance=selected_performance,
            selected_elos=session.selected_elos,
            company_profile_summary=company_profile_summary,
            commercial_overview=commercial_overview,
        )

        syllabus = await SyllabusService(self.db).create_finalized_syllabus(
            topic=self._course_topic(course_context),
            target_level=self._course_target_level(course_context),
            course_category=self._optional_course_text(course_context, "course_category"),
            client_company_name=self._optional_course_text(course_context, "client_company_name"),
            course_title=self._course_title(course_context),
            company_profile_summary=company_profile_summary,
            commercial_overview=commercial_overview,
            tlo=str(selected_tlo["text"]),
            performance_result=str(selected_performance["text"]),
            condition_result=str(final_sections["condition_result"]),
            standard_result=str(final_sections["standard_result"]),
            elos=self._serialize_selected_elos(session.selected_elos),
            journey=cast(dict[str, object], final_sections["journey"]),
            source_doc_ids=list(session.document_ids),
            owner_id=session.owner_id,
            generation_meta=self._build_generation_meta(
                company_profile_summary=company_profile_summary,
                commercial_overview=commercial_overview,
                commercial_overview_source=commercial_overview_source,
                source_summary=source_summary,
                course_context=course_context,
                selected_tlo=selected_tlo,
                selected_performance=selected_performance,
                selected_elos=session.selected_elos,
            ),
        )

        session.finalized_syllabus_id = syllabus.id
        session.wizard_step = "finalized"
        await self.db.flush()
        await self.db.refresh(session)
        self._attach_preview_fields(session)
        return session, syllabus

    async def _generate_preview_sections(
        self,
        session: DesignSession,
    ) -> dict[str, object]:
        source_summary = self._require_source_summary(session)
        course_context = self._require_course_context(session)
        selected_tlo = self._require_selected_tlo(session)
        selected_performance = self._require_selected_performance(session)
        company_profile_summary = self._company_profile_summary(source_summary)
        commercial_overview, _ = self._resolve_commercial_overview(
            course_context,
            company_profile_summary,
        )
        final_sections = await self._generate_final_sections(
            source_summary=source_summary,
            course_context=course_context,
            selected_tlo=selected_tlo,
            selected_performance=selected_performance,
            selected_elos=session.selected_elos,
            company_profile_summary=company_profile_summary,
            commercial_overview=commercial_overview,
        )
        return {
            "condition_result": str(final_sections["condition_result"]),
            "standard_result": str(final_sections["standard_result"]),
        }

    def _attach_preview_fields(self, session: DesignSession) -> None:
        preview_condition_result: str | None = None
        preview_standard_result: str | None = None

        ai_sections = session.ai_preview_sections
        if (
            isinstance(ai_sections, dict)
            and isinstance(ai_sections.get("condition_result"), str)
            and ai_sections["condition_result"]
            and isinstance(ai_sections.get("standard_result"), str)
            and ai_sections["standard_result"]
        ):
            preview_condition_result = str(ai_sections["condition_result"])
            preview_standard_result = str(ai_sections["standard_result"])
        else:
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
        explicit_summary = source_summary.get("company_profile_summary")
        if isinstance(explicit_summary, str) and explicit_summary.strip():
            return explicit_summary.strip()
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

    def _resolve_commercial_overview(
        self,
        course_context: dict[str, object],
        company_profile_summary: str | None,
    ) -> tuple[str | None, str]:
        explicit_overview = self._optional_course_text(course_context, "commercial_overview")
        if explicit_overview and not _texts_too_similar(explicit_overview, company_profile_summary):
            return explicit_overview, "user_input"

        additional_context = self._optional_course_text(course_context, "additional_context")
        if additional_context and not _texts_too_similar(
            additional_context, company_profile_summary
        ):
            return additional_context, "course_context"

        return None, "omitted"

    def _normalize_export_text(self, value: str) -> str:
        normalized = " ".join(value.replace("\r", " ").split())
        return normalized.lstrip("$ ").strip()

    async def _generate_final_sections(
        self,
        *,
        source_summary: dict[str, object],
        course_context: dict[str, object],
        selected_tlo: dict[str, object],
        selected_performance: dict[str, object],
        selected_elos: Sequence[dict[str, object]],
        company_profile_summary: str | None,
        commercial_overview: str | None,
    ) -> dict[str, object]:
        retry_notes = ""
        selected_performance_text = str(selected_performance["text"])
        selected_elo_texts = [
            str(item.get("elo", "")).strip()
            for item in selected_elos
            if isinstance(item, dict) and str(item.get("elo", "")).strip()
        ]

        for _ in range(2):
            payload = await chat_complete_json(
                build_final_syllabus_sections_prompt(
                    topic=self._course_topic(course_context),
                    target_level=self._course_target_level(course_context),
                    source_summary=str(source_summary.get("summary", "")).strip(),
                    company_profile_summary=company_profile_summary or "",
                    commercial_overview=commercial_overview or "",
                    course_category=self._optional_course_text(course_context, "course_category")
                    or "",
                    additional_context=self._optional_course_text(
                        course_context, "additional_context"
                    )
                    or "",
                    selected_tlo=str(selected_tlo["text"]),
                    selected_performance=selected_performance_text,
                    selected_elos=selected_elo_texts,
                    retry_notes=retry_notes,
                )
            )
            normalized = self._normalize_final_sections_payload(payload)
            issues = self._collect_final_section_issues(
                performance_result=selected_performance_text,
                condition_result=str(normalized["condition_result"]),
                standard_result=str(normalized["standard_result"]),
                journey=cast(dict[str, object], normalized["journey"]),
            )
            if not issues:
                return normalized
            retry_notes = "; ".join(issues)

        raise ValidationException(
            "AI generated overlapping or incomplete final syllabus sections. Please retry finalization."
        )

    def _normalize_final_sections_payload(self, payload: dict[str, object]) -> dict[str, object]:
        condition_result = self._normalize_export_text(str(payload.get("condition_result", "")))
        standard_result = self._normalize_export_text(str(payload.get("standard_result", "")))
        journey_payload = payload.get("journey")
        if not isinstance(journey_payload, dict):
            raise ValidationException("Final syllabus synthesis must include a journey object")

        return {
            "condition_result": condition_result,
            "standard_result": standard_result,
            "journey": self._normalize_learning_journey(journey_payload),
        }

    def _normalize_learning_journey(self, value: dict[str, object]) -> dict[str, object]:
        return {
            "pre_learning": self._normalize_learning_stage(value.get("pre_learning")),
            "classroom": self._normalize_learning_stage(value.get("classroom")),
            "after_learning": self._normalize_learning_stage(value.get("after_learning")),
        }

    def _normalize_learning_stage(self, value: object) -> dict[str, object]:
        stage = value if isinstance(value, dict) else {}
        method_value = stage.get("method") if isinstance(stage, dict) else []
        content_value = stage.get("content") if isinstance(stage, dict) else []
        method = self._dedupe_text_list(method_value)
        content = self._dedupe_text_list(content_value)
        return {
            "duration": self._normalize_export_text(str(stage.get("duration", ""))).strip()
            if isinstance(stage, dict)
            else "",
            "method": method,
            "description": self._normalize_export_text(str(stage.get("description", ""))).strip()
            if isinstance(stage, dict)
            else "",
            "content": content,
        }

    def _dedupe_text_list(self, value: object) -> list[str]:
        if isinstance(value, str):
            items = [value]
        elif isinstance(value, list):
            items = [item for item in value if isinstance(item, str)]
        else:
            items = []

        deduped: list[str] = []
        seen: set[str] = set()
        for item in items:
            normalized = self._normalize_export_text(item)
            key = normalized.casefold()
            if not normalized or key in seen:
                continue
            seen.add(key)
            deduped.append(normalized)
        return deduped

    def _collect_final_section_issues(
        self,
        *,
        performance_result: str,
        condition_result: str,
        standard_result: str,
        journey: dict[str, object],
    ) -> list[str]:
        issues: list[str] = []
        for label, value in (
            ("condition_result", condition_result),
            ("standard_result", standard_result),
        ):
            if not value.strip():
                issues.append(f"{label} must not be empty")

        if _texts_too_similar(performance_result, condition_result):
            issues.append("condition_result repeats performance_result")
        if _texts_too_similar(performance_result, standard_result):
            issues.append("standard_result repeats performance_result")
        if _texts_too_similar(condition_result, standard_result):
            issues.append("standard_result repeats condition_result")

        stage_texts: dict[str, str] = {}
        for stage_name in ("pre_learning", "classroom", "after_learning"):
            raw_stage = journey.get(stage_name)
            if not isinstance(raw_stage, dict):
                issues.append(f"journey.{stage_name} must be an object")
                continue
            duration = str(raw_stage.get("duration", "")).strip()
            description = str(raw_stage.get("description", "")).strip()
            method = cast(list[str], raw_stage.get("method", []))
            content = cast(list[str], raw_stage.get("content", []))
            if not duration:
                issues.append(f"journey.{stage_name}.duration must not be empty")
            if not description:
                issues.append(f"journey.{stage_name}.description must not be empty")
            if not method:
                issues.append(f"journey.{stage_name}.method must not be empty")
            if not content:
                issues.append(f"journey.{stage_name}.content must not be empty")

            stage_text = " ".join([description, *method, *content]).strip()
            stage_texts[stage_name] = stage_text
            if _texts_too_similar(stage_text, performance_result):
                issues.append(f"journey.{stage_name} repeats performance_result")
            if _texts_too_similar(stage_text, condition_result):
                issues.append(f"journey.{stage_name} repeats condition_result")
            if _texts_too_similar(stage_text, standard_result):
                issues.append(f"journey.{stage_name} repeats standard_result")

        for left, right in (
            ("pre_learning", "classroom"),
            ("pre_learning", "after_learning"),
            ("classroom", "after_learning"),
        ):
            if _texts_too_similar(stage_texts.get(left, ""), stage_texts.get(right, "")):
                issues.append(f"journey.{left} repeats journey.{right}")

        return issues

    def _build_generation_meta(
        self,
        *,
        company_profile_summary: str | None,
        commercial_overview: str | None,
        commercial_overview_source: str,
        source_summary: dict[str, object],
        course_context: dict[str, object],
        selected_tlo: dict[str, object],
        selected_performance: dict[str, object],
        selected_elos: Sequence[dict[str, object]],
    ) -> dict[str, object]:
        _ = source_summary, course_context, selected_tlo, selected_performance, selected_elos
        meta: dict[str, object] = {
            "tlo": {
                "source": "ai_option_selected",
                "prompt_version": "tlo-options-v1",
                "grounded_with": ["source_summary", "course_context"],
            },
            "performance_result": {
                "source": "ai_option_selected",
                "prompt_version": "performance-options-v1",
                "grounded_with": ["source_summary", "course_context", "selected_tlo"],
            },
            "elos": {
                "source": "ai_option_selected",
                "prompt_version": "elo-options-v1",
                "grounded_with": [
                    "source_summary",
                    "course_context",
                    "selected_tlo",
                    "selected_performance",
                ],
            },
            "condition_result": {
                "source": "ai_final_synthesis",
                "prompt_version": _FINAL_SYNTHESIS_PROMPT_VERSION,
                "grounded_with": [
                    "source_summary",
                    "company_profile_summary",
                    "commercial_overview",
                    "course_context",
                    "selected_tlo",
                    "selected_performance",
                    "selected_elos",
                ],
            },
            "standard_result": {
                "source": "ai_final_synthesis",
                "prompt_version": _FINAL_SYNTHESIS_PROMPT_VERSION,
                "grounded_with": [
                    "source_summary",
                    "company_profile_summary",
                    "commercial_overview",
                    "course_context",
                    "selected_tlo",
                    "selected_performance",
                    "selected_elos",
                ],
            },
            "journey": {
                "source": "ai_final_synthesis",
                "prompt_version": _FINAL_SYNTHESIS_PROMPT_VERSION,
                "grounded_with": [
                    "source_summary",
                    "company_profile_summary",
                    "commercial_overview",
                    "course_context",
                    "selected_tlo",
                    "selected_performance",
                    "selected_elos",
                ],
            },
        }

        if company_profile_summary:
            meta["company_profile_summary"] = {
                "source": "source_summary",
                "prompt_version": "source-summary-v1",
                "grounded_with": ["documents"],
            }
        if commercial_overview:
            meta["commercial_overview"] = {
                "source": commercial_overview_source,
                "prompt_version": None,
                "grounded_with": ["course_context"],
            }

        return meta

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

        if _looks_like_document_reference_summary(combined):
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
        session.ai_preview_sections = None
        session.finalized_syllabus_id = None

    def _reset_after_tlo_selection(self, session: DesignSession) -> None:
        session.performance_options = []
        session.selected_performance = None
        session.elo_options = []
        session.selected_elos = []
        session.ai_preview_sections = None
        session.finalized_syllabus_id = None

    def _reset_after_performance_selection(self, session: DesignSession) -> None:
        session.elo_options = []
        session.selected_elos = []
        session.ai_preview_sections = None
        session.finalized_syllabus_id = None

    async def _generate_source_summary(self, documents: Sequence[Document]) -> dict[str, object]:
        fallback = fallback_source_summary(documents)
        fallback_focus = _extract_company_profile_focus(documents)
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
        normalized_focus = [
            point for point in normalized_focus if not _looks_like_document_reference_summary(point)
        ]
        if not normalized_focus:
            normalized_focus = fallback_focus[:3]
        payload_company_name = payload.get("company_name")
        normalized_company_name = (
            payload_company_name.strip()
            if isinstance(payload_company_name, str) and payload_company_name.strip()
            else cast(str | None, fallback.get("company_name"))
        )
        payload_company_profile_summary = payload.get("company_profile_summary")
        normalized_summary = self._normalize_company_profile_summary(
            summary.strip(),
            normalized_focus[:5] or fallback_focus[:3] or normalized_key_points[:3],
        )
        if (
            normalized_summary
            == "Perusahaan memiliki konteks bisnis dan kebutuhan pembelajaran yang menjadi dasar penyusunan silabus."
            and fallback_focus
        ):
            normalized_summary = _build_indonesian_company_profile_summary(fallback_focus[:3])
        explicit_company_profile_summary = (
            self._normalize_company_profile_summary(
                payload_company_profile_summary.strip(),
                normalized_focus[:5] or fallback_focus[:3] or normalized_key_points[:3],
            )
            if isinstance(payload_company_profile_summary, str)
            and payload_company_profile_summary.strip()
            else None
        )
        payload_company_confidence = payload.get("company_profile_confidence")
        company_profile_confidence = (
            payload_company_confidence.strip().lower()
            if isinstance(payload_company_confidence, str)
            and payload_company_confidence.strip().lower() in {"high", "medium", "low"}
            else cast(str | None, fallback.get("company_profile_confidence"))
        )
        company_profile_summary = explicit_company_profile_summary
        if not company_profile_summary:
            for candidate in (
                cast(str | None, fallback.get("company_profile_summary")),
                _build_indonesian_company_profile_summary(
                    normalized_focus[:5] or fallback_focus[:3] or normalized_key_points[:3]
                ),
                normalized_summary,
                cast(str | None, fallback.get("summary")),
            ):
                if not candidate:
                    continue
                if company_profile_summary is None and not _texts_too_similar(
                    candidate, normalized_summary
                ):
                    company_profile_summary = candidate
                    break
            if company_profile_summary is None:
                company_profile_summary = normalized_summary or cast(
                    str,
                    fallback["summary"],
                )

        return {
            "summary": normalized_summary or fallback["summary"],
            "key_points": (normalized_key_points[:5] or fallback["key_points"]),
            "company_profile_focus": normalized_focus[:5]
            or fallback_focus[:3]
            or fallback["company_profile_focus"],
            "company_name": normalized_company_name,
            "company_profile_summary": company_profile_summary,
            "company_profile_confidence": company_profile_confidence or "medium",
        }

    def _build_prefill_course_context(
        self,
        source_summary: dict[str, object],
    ) -> dict[str, object]:
        return {
            "topic": "",
            "target_level": 3,
            "additional_context": "",
            "course_category": "",
            "client_company_name": self._optional_summary_text(source_summary, "company_name")
            or "",
            "course_title": "",
            "commercial_overview": self._optional_summary_text(
                source_summary,
                "company_profile_summary",
            )
            or "",
        }

    def _merge_prefill_course_context(
        self,
        existing: dict[str, object] | None,
        source_summary: dict[str, object],
    ) -> dict[str, object]:
        merged = dict(existing or self._build_prefill_course_context(source_summary))
        if not str(merged.get("client_company_name", "")).strip():
            merged["client_company_name"] = (
                self._optional_summary_text(source_summary, "company_name") or ""
            )
        if not str(merged.get("commercial_overview", "")).strip():
            merged["commercial_overview"] = (
                self._optional_summary_text(source_summary, "company_profile_summary") or ""
            )
        merged.setdefault("topic", "")
        merged.setdefault("target_level", 3)
        merged.setdefault("additional_context", "")
        merged.setdefault("course_category", "")
        merged.setdefault("course_title", "")
        return merged

    def _optional_summary_text(
        self,
        source_summary: dict[str, object],
        key: str,
    ) -> str | None:
        value = source_summary.get(key)
        if not isinstance(value, str):
            return None
        normalized = self._normalize_export_text(value)
        return normalized or None

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
        valid_options = [
            option
            for option in options
            if matches_tlo_level(str(option.get("text", "")), target_level)
        ]
        return valid_options or fallback

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
        previous_elo_texts: Sequence[str] | None = None,
    ) -> list[dict[str, object]]:
        topic = self._course_topic(course_context)
        selected_performance_text = str(selected_performance["text"])
        normalized_previous = [item.strip() for item in (previous_elo_texts or []) if item.strip()]
        fallback = fallback_elo_options(
            topic,
            selected_performance_text,
            regenerate=bool(normalized_previous),
            previous_elo_texts=normalized_previous,
        )
        try:
            payload = await chat_complete_json(
                build_elo_options_prompt(
                    source_summary=str(source_summary.get("summary", "")),
                    topic=topic,
                    target_level=self._course_target_level(course_context),
                    selected_tlo=str(selected_tlo["text"]),
                    selected_performance=selected_performance_text,
                    previous_elos=normalized_previous,
                )
            )
        except AIServiceException:
            return fallback

        options = normalize_elo_options(payload)
        if normalized_previous:
            options = [
                option
                for option in options
                if str(option.get("elo", "")).strip() not in normalized_previous
            ]
        return options or fallback


def _document_company_name(documents: Sequence[Document]) -> str | None:
    for document in documents:
        extraction = _document_extraction_payload(document)
        value = extraction.get("company_name")
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


def _document_company_profile_summary(documents: Sequence[Document]) -> str | None:
    for document in documents:
        extraction = _document_extraction_payload(document)
        value = extraction.get("company_profile_summary")
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


def _document_company_confidence(documents: Sequence[Document]) -> str | None:
    for document in documents:
        extraction = _document_extraction_payload(document)
        value = extraction.get("confidence")
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


def _document_extraction_payload(document: Document) -> dict[str, object]:
    metadata = document.metadata_ if isinstance(document.metadata_, dict) else {}
    extraction = metadata.get("extraction")
    return extraction if isinstance(extraction, dict) else {}


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


def _contains_english_profile_terms(value: str) -> bool:
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
        " reliable ",
        " services ",
        " performance ",
        " transformation ",
        " growth ",
        " industrial ",
        " catalyst ",
        " through ",
        " not only ",
    )
    return any(marker in lowered for marker in english_markers)


def _looks_like_document_reference_summary(value: str) -> bool:
    lowered = value.lower()
    if any(ext in lowered for ext in (".pdf", ".docx", ".pptx")):
        return True
    generic_markers = (
        "dokumen ",
        "document ",
        "mendukung perancangan materi",
        "supports the design of learning materials",
    )
    return any(marker in lowered for marker in generic_markers)


def _looks_like_low_signal_profile_point(value: str) -> bool:
    lowered = value.lower()
    low_signal_markers = (
        "transformasi berkelanjutan bagi negeri",
        "enhancing connectivity",
        "catalyzing sustainable transformation",
        "committed to being",
        "katalisator utama",
        "meningkatkan konektivitas",
        "annual report",
        "laporan tahunan",
    )
    return any(marker in lowered for marker in low_signal_markers)


def _texts_too_similar(left: str | None, right: str | None) -> bool:
    normalized_left = _normalize_similarity_text(left)
    normalized_right = _normalize_similarity_text(right)
    if not normalized_left or not normalized_right:
        return False
    if normalized_left == normalized_right:
        return True
    if len(normalized_left) >= 40 and normalized_left in normalized_right:
        return True
    if len(normalized_right) >= 40 and normalized_right in normalized_left:
        return True
    return SequenceMatcher(None, normalized_left, normalized_right).ratio() >= 0.9


def _normalize_similarity_text(value: str | None) -> str:
    if not value:
        return ""
    return re.sub(r"\W+", " ", value.casefold()).strip()


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
        " ".join(point.split()).strip().rstrip(".")
        for point in focus_points
        if point.strip() and not _looks_like_document_reference_summary(point)
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
