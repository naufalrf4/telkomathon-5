# Overview

## Purpose
MyDigiLearn is Telkom Athon #10 Group 5's AI-assisted curriculum design platform for educators and learning teams. The current verified product flow helps a user upload source materials directly into a syllabus creation flow, walk a guided backend-owned wizard, finalize a syllabus, revise it explicitly, and export a polished DOCX artifact.

## Primary users
- Educators and learning designers using a desktop-first web interface
- Internal teams reviewing uploaded materials, generated outcomes, revisions, and export output

## Core value
- Turn uploaded documents into a guided syllabus design workflow instead of a one-shot generation-only experience
- Keep backend session state authoritative so wizard progress, resets, revisions, and export remain durable
- Make the finalized syllabus the long-lived source of truth for revision and DOCX export

## Current product truth
- The user-facing shell is centered on `Syllabus` routes: `/syllabus/create`, `/syllabus/generated`, `/syllabus/[id]`, `/syllabus/[id]/revision`, and `/syllabus/[id]/export`
- `design_sessions` remains the backend wizard engine and still backs compatibility route aliases under `/design-session/*`
- `syllabus/create` now starts with direct document upload per create flow instead of selecting from a global document pool
- Structured revision is explicit via backend syllabus mutation, while chat remains the suggestion channel
- Export uses a canonical DOCX route backed by a `docxtpl` template asset
- The repo now includes both local/dev Docker Compose and a production-style Docker stack with nginx proxying frontend and backend

## Explicit non-goals
- This repo is not a generic LMS or course-delivery platform
- It is not a public multi-tenant SaaS with verified auth, billing, or production-grade security guarantees
- It is not mobile-first-only; desktop web remains the primary target even though Expo native entry points still exist
- It is not a generic infra repo; `server.py` remains a sensitive local helper outside normal app architecture
