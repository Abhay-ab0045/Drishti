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
* **Phase 5: Performance Optimization & Edge Hardening (In Progress / Active)** — Streamlining memory consumption, latency reduction, batch DOM modifications, and edge-case validation across diverse form layouts.

---

## Repository Structure

The project is arranged as a monorepo containing the extension source, documentation, and a standalone local verification portal:

```text
Drishti/
├── demo-site/              # Local test portal for form & identity verification
│   ├── index.html          # Mock government/identity verification form
│   ├── package.json        # Test server dependencies
│   ├── script.js           # Demo site client logic
│   └── styles.css          # Demo site styling
├── docs/                   # Architecture diagrams and specifications
├── extension/              # Manifest V3 extension root
│   ├── dist/               # Production build output (load into Chrome)
│   ├── scripts/            # Build and packaging helper scripts
│   ├── src/                # Extension source code
│   │   ├── background/     # Background service worker (message hub)
│   │   ├── content-scripts/# DOM scraping, image capture, redaction injection
│   │   ├── offscreen/      # MediaPipe & WebAssembly vision execution context
│   │   └── popup/          # Extension popup UI and user controls
│   ├── manifest.json       # MV3 manifest definition and permissions
│   ├── package.json        # Extension build dependencies and scripts
│   ├── tsconfig.json       # TypeScript configuration
│   └── vite.config.ts      # Rollup / Vite bundling configuration
├── .env                    # Local environment variables
└── PROGRESS.md             # Detailed phase tracking and implementation log