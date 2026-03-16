# Overview

## Purpose
MyDigiLearn is Telkom Athon #10 Group 5's AI-assisted curriculum design platform for educators. The current verified product flow helps an instructor upload reference materials, run a guided design session, generate learning outcomes, personalize follow-up learning, chat on top of generated content, and export finished syllabi.

## Primary users
- Educators and learning designers working from a desktop-first web interface
- Internal teams reviewing uploaded learning materials and generated syllabus output

## Core value
- Turn uploaded documents into a guided syllabus-design workflow instead of a single one-shot generation step
- Keep backend session state authoritative so users can refresh or resume work safely
- Support downstream personalization, chat, and export from finalized syllabus data

## Current product truth
- The active flow is a stateful `design_sessions` wizard backed by FastAPI and surfaced in Expo Router under `/design-session/*`
- The backend still keeps legacy syllabus routes for compatibility while the wizard rollout completes
- Export currently includes a canonical DOCX download route for finalized syllabi

## Explicit non-goals
- This repo is not a generic LMS or course-delivery platform
- It is not a public multi-tenant SaaS with verified auth or billing
- It is not a mobile-first-only app; web desktop is the primary target
- It is not a general deployment-orchestration repo; the root `server.py` is a local sensitive helper, not core architecture
