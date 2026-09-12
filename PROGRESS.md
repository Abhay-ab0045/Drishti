# Drishti — Build Progress

## Phase 1: Scaffolding + DOM Reader - COMPLETE
- [x] Repo structure created
- [x] Vite + CRXJS build config
- [x] Chrome MV3 manifest
- [x] TypeScript types defined
- [x] DOM reader implemented
- [x] Content script entry point
- [x] Background service worker
- [x] Popup UI connected
- [x] Demo site created
- [x] ARCHITECTURE.md created
- [x] npm install + build verification
- [x] Extension loaded in Chrome
- [x] DOM reader tested on demo site

## Phase 2: Local Vision Pipeline - COMPLETE
- [x] Web Worker/Offscreen document setup
- [x] ONNX Runtime Web with WebGPU/WASM fallback (local bundling)
- [x] MediaPipe FaceDetector integration (local bundling)
- [x] Image capture pipeline (DOM level extraction, scaling, coordinate mapping)
- [x] Verifiable diagnostic tests (DIAG 1-6) working cleanly

## Phase 3: PII Detection Engine - COMPLETE
- [x] Define PIIDetection schema (`{type, source, location: {domPath}|{boundingBox}, confidence}`)
- [x] DOM-attribute detector (`detectFromAttributes` in `detector-dom.ts`)
- [x] Regex text detector (`detectFromTextNodes` — TreeWalker, Luhn check, Aadhaar separator-required, PAN, phone, email)
- [x] Visual heuristic detector (FACE_IMAGE → SENSITIVE_LABEL_IMAGE if label keyword within 300px)
- [x] Aggregation + deduplication layer (`detector-aggregate.ts`, pure logic, no DOM APIs — safe for SW import)
- [x] Architectural split: `detector-dom.ts` (content-script only) / `detector-aggregate.ts` (background only) — fixes the prior SW crash
- [x] Content-script `RUN_PII_DETECTION` handler wired
- [x] Background `TRIGGER_PII_SCAN` / `runPIIScan` with per-tab vision cache (`lastVisionByTab`)
- [x] Popup "PII Scan" button + PII DETECTIONS panel (TOTAL, VISUAL status, per-item list)
- [x] Adversarial fixture test (12/12 TP, 0 FP) — `uid` field not matched, unseparated 12-digit tracking IDs not matched, CC validated via Luhn
- [x] Live end-to-end verification on **cached path** (PII Scan after prior Vision Scan) on demo test page:
  - TOTAL: 5, VISUAL: CACHED
  - EMAIL — `#email` — 95.0%
  - PHONE — `#mobile` — 95.0%
  - AADHAAR — `#aadhaar` — 85.0%
  - PAN — `#pan` — 85.0%
  - SENSITIVE_LABEL_IMAGE — `[1025, 392, 61, 56]` — 95.0%
- [ ] **OPEN — NOT YET CONFIRMED LIVE:** "No cached vision data" auto-trigger path (PII Scan before any Vision Scan). Code is implemented; independent live confirmation has not been run.
- [ ] **OPEN — NOT YET DEMONSTRATED:** `PASSWORD_FIELD` and `CREDIT_CARD` detectors exist in code (DOM attribute + Luhn regex paths) but the demo test page has no matching fields. Implemented but no live positive case observed.

## Phase 4: Targeted Redaction Engine - COMPLETE
- [x] Implemented reversible CSS obfuscation (color: transparent, background: #0d0d0d) for input fields and text nodes.
- [x] Implemented non-destructive absolute-positioned Canvas overlay (redact-overlay) for images/videos.
- [x] State-managed `lastPIIByTab` cache for fast apply/remove loops.
- [x] Popup UI integration for Apply/Clear Redactions.

## Phase 5: Payload Schema & Validation - COMPLETE
- [x] Install Zod (`npm install zod`)
- [x] Centralize schemas in `src/types/schemas.ts`
- [x] Implement `safeParse()` at all runtime messaging boundaries
- [x] Pass strict `tsc` checking

## Phase 6: Server Contract (FastAPI) - COMPLETE
- [x] Scaffold the Backend Environment (FastAPI, Uvicorn, Pydantic)
- [x] Implement Pydantic Data Contracts matching Zod schemas
- [x] Create the FastAPI Application & configure CORS
- [x] Define API Endpoints (`/health`, `/api/v1/session/start`, `/api/v1/scan/pii`, `/api/v1/scan/vision`, `/api/v1/redact/verify`)

## Phase 7: VLM Integration (Gemini) - COMPLETE
- [x] Add `google-genai`, `python-dotenv`, `pillow` to `requirements.txt`
- [x] Create `backend/.env.example` and `backend/.gitignore`
- [x] Create `backend/vlm_adapter.py` with `plan_next_action()` function
- [x] Define `ActionPlanRequest`, `ActionTarget`, `ActionPlanResponse` schemas
- [x] Add `POST /api/v1/plan/action` endpoint
- [x] Live verification: valid request returns ActionPlanResponse; missing key returns safe error

## Phase 8: Action Execution & Human-in-the-Loop UI Confirmation - IN PROGRESS
- [ ] Implement floating HITL UI Overlay (`hitl-overlay.ts`)
- [ ] Implement Action Execution Engine (`executor.ts`)
- [ ] End-to-End Orchestration (Background to Content Script to Backend)
- [ ] Verification on Demo Portal
## Phase 9: Benchmarking Harness - NOT STARTED
## Phase 10: Visual Design Pass - NOT STARTED
