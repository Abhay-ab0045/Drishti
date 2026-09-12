# Drishti 🛡️

Client-side privacy preservation and PII redaction engine implemented as a Manifest V3 browser extension with on-device computer vision.

---

## Overview

Drishti provides on-device detection and redaction of Personally Identifiable Information (PII) and facial media within web forms before data leaves the browser client. The architecture executes all inference locally via WebAssembly and WebGPU delegates, ensuring zero data leakage to external inference endpoints.

### Project Roadmap & Current Status

* **Phase 1: DOM & Form Inspection (Completed)** — Tree walking, input target mapping, and layout metrics capture.
* **Phase 2: Local AI & Runtime Setup (Completed)** — Manifest V3 offscreen document orchestration and WebAssembly/ONNX Runtime runtime integration.
* **Phase 3: Vision Pipeline (Completed)** — MediaPipe face detection using local `.tflite` model assets via WebGPU/WASM delegates.
* **Phase 4: Targeted Redaction Engine (Completed)** — Bidirectional message routing, DOM-level visual masking, and dynamic text/canvas obfuscation.
* **Phase 5: Performance Optimization & Edge Hardening (Completed)** — Streamlining memory consumption, latency reduction, batch DOM modifications, and edge-case validation across diverse form layouts.
* **Phase 6: Server Contract & Scaffolding (Completed)** — Python FastAPI backend environment setup, routing contracts, and secure credential handling.
* **Phase 7: VLM Integration (Completed)** — Multimodal Action-Planning Adapter leveraging `gemini-3.1-flash-lite` to reason over pre-redacted DOM screenshots.
* **Phase 8: Action Execution & Human-in-the-Loop UI Confirmation (In Progress / Active)** — Floating confirmation overlays and secure DOM interaction execution.

---

## Repository Structure

The project is arranged as a monorepo containing the extension source, a Python reasoning backend, documentation, and a standalone local verification portal:

```text
Drishti/
├── backend/                # Python FastAPI backend for VLM action-planning
├── demo-site/              # Local test portal for form & identity verification
├── docs/                   # Architecture diagrams and specifications
│   └── ARCHITECTURE.md     # Core system architecture documentation
├── extension/              # Manifest V3 extension root
│   ├── dist/               # Production build output (load into Chrome)
│   ├── node_modules/       # Extension package dependencies
│   ├── scripts/            # Build and packaging helper scripts
│   ├── src/                # Extension source code (Background, Content, Offscreen, Popup)
│   ├── .env.example        # Template for extension environment variables
│   ├── manifest.json       # MV3 manifest definition and permissions
│   ├── package-lock.json   # Exact dependency versions lockfile
│   ├── package.json        # Extension build dependencies and scripts
│   ├── tsconfig.json       # TypeScript configuration
│   └── vite.config.ts      # Rollup / Vite bundling configuration
├── .env                    # Local environment variables
├── .gitignore              # Monorepo git ignore rules
├── PROGRESS.md             # Detailed phase tracking and implementation log
├── readme.md               # Project overview and instructions
└── start-demo.bat          # Windows batch script to launch the local demo ecosystem
