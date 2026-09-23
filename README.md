# Drishti 🛡️

Client-side privacy preservation and PII redaction engine implemented as a cross-browser Manifest V3 extension (Chrome & Firefox) with on-device computer vision.

---

## 🚀 Quickstart for Judges

Experience the Drishti Vision Agent live in under 60 seconds on either Firefox or Google Chrome.

### Option A: Mozilla Firefox (Recommended — 1-Click Install)

1. **Download Signed Add-on**: Click **[Drishti v0.2.0 (.xpi)](https://github.com/Shlok82/Drishti/releases/download/v0.2.0-firefox/4111d396888e467db397-0.2.0.xpi)** directly in Firefox.
2. **Confirm Installation**: Firefox will trigger native installation. Click **Add**[cite: 16].
3. **Run Live Demo**:
* Open the live test portal: **[https://drishti-five-kohl.vercel.app](https://drishti-five-kohl.vercel.app?utm_source=gemini)**
* Click the Drishti shield icon in your Firefox toolbar[cite: 8].
* Click **Initiate Scan**, **Vision Scan**, or **PII Scan** to test local redaction, and **Run Agent Cycle** to verify the secure Human-in-the-Loop VLM planning flow.



### Option B: Google Chrome (Developer Mode)

1. **Download the Extension**: Download **[drishti-v0.2.0.zip](https://github.com/Shlok82/Drishti/releases/tag/v0.2.0?utm_source=gemini)**[cite: 16].
2. **Unzip**: Extract the archive into a local folder.
3. **Load in Chrome**:
* Navigate to `chrome://extensions`.
* Enable **Developer mode** (top-right toggle).
* Click **Load unpacked** and select the extracted folder.


4. **Run Live Demo**:
* Open the live test portal: **[https://drishti-five-kohl.vercel.app](https://drishti-five-kohl.vercel.app?utm_source=gemini)**
* Click the Drishti extension icon from the toolbar.
* Run **PII Scan** to test local redaction, or **Run Agent Cycle** to test the secure VLM planning.



---

## Overview

Drishti provides on-device detection and redaction of Personally Identifiable Information (PII) and facial media within web forms before data leaves the browser client. The architecture executes inference locally via WebAssembly and WebGPU delegates, ensuring zero data leakage to external inference endpoints.

* **Chromium Pipeline:** Leverages Manifest V3 offscreen documents for isolated MediaPipe/ONNX WebAssembly and WebGPU execution.
* **Gecko Pipeline:** Operates natively inside Firefox Manifest V3 background event-pages with direct DOM and Canvas APIs.

---

## Project Roadmap & Current Status

* **Phase 1: DOM & Form Inspection (Completed)** — Tree walking, input target mapping, and layout metrics capture.
* **Phase 2: Local AI & Runtime Setup (Completed)** — Manifest V3 offscreen document orchestration and WebAssembly/ONNX Runtime integration.
* **Phase 3: Vision Pipeline (Completed)** — MediaPipe face detection using local `.tflite` model assets via WebGPU/WASM delegates.
* **Phase 4: Targeted Redaction Engine (Completed)** — Bidirectional message routing, DOM-level visual masking, and dynamic text/canvas obfuscation.
* **Phase 5: Performance Optimization & Edge Hardening (Completed)** — Streamlining memory consumption, latency reduction, batch DOM modifications, and edge-case validation across diverse form layouts.
* **Phase 6: Server Contract & Scaffolding (Completed)** — Python FastAPI backend environment setup, routing contracts, and secure credential handling.
* **Phase 7: VLM Integration (Completed)** — Multimodal Action-Planning Adapter leveraging Gemini to reason over pre-redacted DOM screenshots.
* **Phase 8: Action Execution & Human-in-the-Loop UI Confirmation (Completed)** — Floating confirmation overlays, step-by-step reasoning previews, and secure DOM interaction execution.
* **Phase 9: Self-Benchmarking Harness & Telemetry Dashboard (Completed)** — Latency tracking, local redaction benchmarks, and operational telemetry integration.
* **Phase 10: Visual Design Polish (Completed)** — Mission-control dark aesthetic pass across popup and modal surfaces.
* **Phase 11: Production Deployment & Live Demonstration (Completed)** — FastAPI backend hosted on Render, static demo portal hosted on Vercel edge CDN, and uptime monitoring configured.
* **Phase 12: Cross-Browser Engineering & Dual Engine Support (Completed)** — Firefox Manifest V3 adaptation with capability branching (`chrome.offscreen` vs event page DOM), multi-target Vite bundling (`dist-chrome` and `dist-firefox`)[cite: 9], and Mozilla AMO signing validation (`.xpi` distribution)[cite: 15, 16].

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
│   ├── dist-chrome/        # Production build target for Chromium browsers
│   ├── dist-firefox/       # Production build target for Mozilla Firefox
│   ├── node_modules/       # Extension package dependencies
│   ├── scripts/            # Build and packaging helper scripts
│   ├── src/                # Extension source code (Background, Content, Offscreen, Popup)
│   ├── .env.example        # Template for extension environment variables
│   ├── manifest.json       # Chromium MV3 manifest definition
│   ├── manifest-firefox.json# Firefox MV3 manifest definition (Gecko settings & permissions)
│   ├── package-lock.json   # Exact dependency versions lockfile
│   ├── package.json        # Extension build dependencies and scripts
│   ├── tsconfig.json       # TypeScript configuration
│   └── vite.config.ts      # Rollup / Vite dual-target bundling configuration
├── .env                    # Local environment variables
├── .gitignore              # Monorepo git ignore rules
├── PROGRESS.md             # Detailed phase tracking and implementation log
├── README.md               # Project overview and instructions
└── start-demo.bat          # Windows batch script to launch the local demo ecosystem

```

---

## Contributing

Contributions are welcome! Here's a quick workflow:

1. **Fork** the repository and create a feature branch (`git checkout -b feature/your-feature`).
2. **Commit** your changes with a clear message (`git commit -m "feat: ..."`).
3. **Push** to your fork (`git push origin feature/your-feature`).
4. **Open a pull request** describing what you changed and why.

If you find a bug or have an idea, please file an issue first — it helps coordinate work and avoid duplicated effort.
