# Drishti 🛡️

Client-side privacy preservation and PII redaction engine implemented as a Manifest V3 browser extension with on-device computer vision.

---
## 🚀 Quickstart for Judges

Experience the Drishti Vision Agent live in under 60 seconds:

1. **Download the Extension:** [Download drishti-v0.2.0.zip](https://github.com/Shlok82/Drishti/releases/download/v0.2.0/drishti-v0.2.0.zip)
2. **Unzip:** Extract the downloaded file into a folder.
3. **Load in Chrome:**
   - Go to `chrome://extensions`
   - Enable **Developer mode** (top-right).
   - Click **Load unpacked** and select the extracted folder.
4. **Run Live Demo:**
   - Open our live test portal: **https://drishti-five-kohl.vercel.app**
   - Click the Drishti extension icon.
   - Run **PII Scan** to test local redaction, or **Run Agent Cycle** to test the secure VLM planning.
  
  
## Overview

Drishti provides on-device detection and redaction of Personally Identifiable Information (PII) and facial media within web forms before data leaves the browser client. The architecture executes all inference locally via WebAssembly and WebGPU delegates, ensuring zero data leakage to external inference endpoints.

### Project Roadmap & Current Status

### Project Roadmap & Current Status

* **Phase 1: DOM & Form Inspection (Completed)** — Tree walking, input target mapping, and layout metrics capture.
* **Phase 2: Local AI & Runtime Setup (Completed)** — Manifest V3 offscreen document orchestration and WebAssembly/ONNX Runtime integration.
* **Phase 3: Vision Pipeline (Completed)** — MediaPipe face detection using local `.tflite` model assets via WebGPU/WASM delegates.
* **Phase 4: Targeted Redaction Engine (Completed)** — Bidirectional message routing, DOM-level visual masking, and dynamic text/canvas obfuscation.
* **Phase 5: Performance Optimization & Edge Hardening (Completed)** — Streamlining memory consumption, latency reduction, batch DOM modifications, and edge-case validation across diverse form layouts.
* **Phase 6: Server Contract & Scaffolding (Completed)** — Python FastAPI backend environment setup, routing contracts, and secure credential handling.
* **Phase 7: VLM Integration (Completed)** — Multimodal Action-Planning Adapter leveraging `gemini-3.1-flash-lite` to reason over pre-redacted DOM screenshots.
* **Phase 8: Action Execution & Human-in-the-Loop UI Confirmation (Completed)** — Floating confirmation overlays, step-by-step reasoning previews, and secure DOM interaction execution.
* **Phase 9: Self-Benchmarking Harness & Telemetry Dashboard (Completed)** — Latency tracking, local redaction benchmarks, and operational telemetry integration.
* **Phase 10: Visual Design Polish (Completed)** — Mission-control dark aesthetic pass across popup and modal surfaces.
* **Phase 11: Production Deployment & Live Demonstration (Completed)** — FastAPI backend hosted on Render (Singapore region), static demo portal hosted on Vercel edge CDN, and 24/7 uptime monitoring configured.
* **Phase 12: Judge Packaging & Distribution (Completed)** — Production extension bundled into `drishti-v0.2.0.zip` and published via GitHub Releases for evaluator distribution.
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
