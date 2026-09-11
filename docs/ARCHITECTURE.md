# Drishti Architecture

## Overview

**Drishti (दृष्टि)** is a privacy-preserving browser vision agent designed to empower automated web navigation and intelligent assistance without sacrificing user data confidentiality. Drishti operates directly inside the browser to read the active screen and DOM structure, understand context, and detect and redact sensitive Personally Identifiable Information (PII) — including passwords, national identification numbers (e.g., Aadhaar, PAN), biometric features (faces), and financial credentials — **BEFORE any network payload leaves the local machine**.

Once sanitized, Drishti transmits only redacted text tokens, masked screen context, and sanitized structural metadata to a server-side Vision-Language Model (VLM). The VLM generates a sequence of concrete, structured UI actions which are validated and presented to the user for human-in-the-loop approval before local execution.

> **Non-Negotiable Constraint:** Raw, identifiable screen data and sensitive user information must **NEVER** leave the user's device.

---

## System Architecture Diagram

```mermaid
flowchart TB
    subgraph Browser ["Client: Chrome MV3 Browser Extension"]
        subgraph CS ["Content Script Context"]
            DOM["DOM Reader<br/>(DOM Traversal & Accessibility Tree)"]
            PII["PII Detector<br/>(DOM Rules, Luhn, Aadhaar, PAN Regex)"]
            RE["Redaction Engine<br/>(Source Masking & Canvas Blackout)"]
            ZV["Zod Validator<br/>(Strict Sanitization Verification)"]
            OV["UI Overlay & Highlights<br/>(Visual Redaction Feedback)"]
        end

        subgraph WW ["Web Worker (Comlink)"]
            ONNX["ONNX Runtime Web<br/>(MobileViT-Small int8: WebGPU / WASM)"]
            MP["MediaPipe FaceDetector<br/>(Client-Side Face Bounding Boxes)"]
        end

        subgraph BG ["Background Service Worker"]
            ORCH["Orchestrator<br/>(Lifecycle & State Management)"]
            SC["Server Client<br/>(HTTPS / SSE Transport)"]
            AE["Action Executor<br/>(Human-in-the-Loop Confirmation)"]
        end
    end

    subgraph NetworkBoundary ["🔒 Device Boundary (Local Network Perimeter)"]
        SanitizedPayload["Sanitized Payload Only<br/>• Redacted Text Tokens<br/>• Pixel-Blacked-Out Screenshots<br/>• Redaction Audit Metadata"]
        PlannedActions["Planned Action Sequence<br/>• Action Type & Target Selector<br/>• Human Confirmation Prompts"]
    end

    subgraph Server ["Backend: FastAPI Service"]
        PV["Pydantic Validator<br/>(Payload Schema Enforcement)"]
        AP["Action Planner<br/>(Reasoning & Task Decomposition)"]
        VLM["VLM Provider Interface<br/>(Gemini 1.5 Flash / Ollama)"]
    end

    %% Client Internal Data Flows
    DOM -->|Element Tree & Text| PII
    WW -->|Face Bounding Boxes & Screen Category| PII
    PII -->|Identified PII Spans & Coordinates| RE
    DOM -->|Raw Canvas / Viewport Capture| RE
    RE -->|Sanitized DOM Context + Redacted Image| ZV
    RE -.->|Visual Indicators| OV
    ZV -->|Validated Sanitized Payload| ORCH
    ORCH --> SC

    %% Network Transit
    SC -->|POST Sanitized Context (HTTPS)| SanitizedPayload
    SanitizedPayload -->|Validate Input| PV
    PV --> AP
    AP -->|Context Prompt with Redaction Tokens| VLM
    VLM -->|Structured Intent Response| AP
    AP -->|Serialize Action Plan| PlannedActions
    PlannedActions -->|HTTPS Response| SC

    %% Client Execution Flow
    SC --> ORCH
    ORCH --> AE
    AE -->|Request User Confirmation| OV
    OV -->|User Approved Execution| DOM
```

---

## Module Breakdown

### 1. DOM Reader
- Performs high-speed structural analysis and semantic page comprehension via DOM and accessibility tree traversal.
- Extracts interactive elements (inputs, buttons, anchors, forms), ARIA attributes, bounding client rects, and hierarchical context while ignoring irrelevant hidden elements.

### 2. Vision Pipeline
- Executes in an isolated Web Worker via Comlink to ensure zero main-thread UI jank.
- Uses **ONNX Runtime Web** (WebGPU with automatic WebAssembly/SIMD fallback) running an int8-quantized **MobileViT-Small** model for real-time screen classification and UI region proposal.
- Integrates **MediaPipe FaceDetector** client-side to compute precise bounding boxes for human faces appearing in photos, avatars, ID cards, and web camera feeds.

### 3. PII Detection Engine
- Combines multi-tier detection techniques:
  - **DOM Attribute Rules**: Inspects input types (`type="password"`), autocomplete attributes, input names, labels, and ARIA attributes.
  - **Deterministic Regex & Checksum Validators**: High-precision detection for credit card numbers (Luhn algorithm), Indian national identifiers (Aadhaar with Verhoeff validation, PAN format), email addresses, and phone numbers.
  - **Visual Face Detection**: Consumes face bounding boxes output by the Web Worker vision pipeline.

### 4. Redaction Engine
- Performs deterministic source-level masking, replacing sensitive strings with irreversible placeholder tokens (e.g., `[REDACTED_AADHAAR_1]`, `[REDACTED_PASSWORD]`).
- For graphical visual data, executes canvas-level destructive pixel blackout (drawing solid opaque black rectangles over sensitive coordinate regions) before screenshots are serialized or converted to base64.

### 5. Payload Schema
- Dual-barrier schema validation:
  - **Client-Side (Zod)**: Validates sanitized payload invariants before transmission. Ensures no raw PII leaks and guarantees audit metadata exists for all redacted coordinates.
  - **Server-Side (Pydantic)**: Enforces strict data models on all FastAPI endpoints, rejecting malformed requests or payloads violating safety schemas.

### 6. Server
- Lightweight, asynchronous **FastAPI** backend that acts as the reasoning bridge.
- Provides endpoints for health monitoring, agentic planning, and session handling with stateless or session-scoped architecture.

### 7. VLM Integration
- Modular VLM provider abstraction.
- Defaults to **Google Gemini 1.5 Flash** for low latency, multimodal reasoning, and structured JSON output.
- Easily swappable to a local or self-hosted **Ollama** endpoint (e.g., LLaVA, MiniCPM-V) for completely offline or air-gapped environments.

### 8. Action Executor
- Translates high-level VLM action specifications (click, type, scroll, select) into verified browser interactions.
- Enforces **Human-in-the-Loop (HITL)** verification for high-risk actions (e.g., form submissions, irreversible buttons, payment flows) via visual overlay confirmation prompts.

### 9. Benchmarking Harness
- Comprehensive local testing and evaluation suite.
- Measures PII detection precision and recall, visual redaction Intersection-over-Union (IoU), end-to-end latency breakdown (detection, redaction, network, VLM inference), memory footprint, and WebGPU/WASM compute overhead.

---

## Privacy Guarantees

1. **Zero-In-Memory Exposure for Sensitive Fields:** Field values from identified sensitive elements (such as passwords, CVVs, and secure inputs) are never read into unmasked strings or sent to runtime stores.
2. **Destructive Canvas Pixel Blackout:** Face and visual document regions are destroyed at the raw canvas pixel buffer level. De-anonymization via reverse filtering is mathematically impossible because the original pixel data is discarded prior to screenshot serialization.
3. **Client-Side Hard-Block Gate:** The client Zod validator acts as a zero-trust firewall; any outbound request failing redaction compliance or missing verification metadata is rejected and aborted before hitting the network stack.
4. **Opaque Token Ingestion by VLM:** The server-side system prompt instructs the VLM to treat redaction placeholders (e.g., `[REDACTED_PAN_1]`) as immutable, opaque entities. The VLM references these tokens symbolically in actions without ever guessing or reconstructing them.
5. **No Raw Logging Policy:** The server strictly disables raw request body logging, disk persistence of image frames, and telemetry of identifiable attributes.

---

## Technology Stack

| Layer | Technology | Description |
|---|---|---|
| **Extension** | Manifest V3, Vite + CRXJS, TypeScript, webextension-polyfill | Modern Chrome MV3 toolchain with hot reload, strong typing, and cross-browser compatibility |
| **Vision** | ONNX Runtime Web (WebGPU → WASM), MobileViT-Small int8, MediaPipe | On-device hardware-accelerated neural networks and face detection |
| **Detection** | DOM attribute rules, regex patterns (Luhn, Aadhaar, PAN, email, phone) | Multi-layered hybrid heuristic and algorithmic detection engine |
| **Validation** | Zod (client), Pydantic (server) | End-to-end schema synchronization and zero-trust payload verification |
| **Server** | FastAPI, Gemini 1.5 Flash API | Fast async Python backend with low-latency multimodal planning |
| **Deployment** | Chrome Web Store (extension), Render (server), Vercel (demo site) | Scalable and accessible cloud / client distribution |

---

## Repo Structure

```
/extension              — Chrome MV3 browser extension
  /src/background       — Service worker orchestrator
  /src/content-scripts  — DOM reader, overlay
  /src/popup            — Extension popup UI
  /src/options          — Options/benchmark page
  /src/vision           — ONNX + MediaPipe pipeline
  /src/redaction        — PII detection + redaction
  /src/schemas          — Zod payload schemas
  /src/types            — Shared TypeScript types
  /src/ui               — Design system
  manifest.json
/server                 — FastAPI backend
  /app/main.py          — App entry
  /app/routes.py        — API endpoints
  /app/schemas.py       — Pydantic models
  /app/vlm/             — VLM provider interface
/demo-site              — Mock government portal for testing
/docs                   — Documentation
```
