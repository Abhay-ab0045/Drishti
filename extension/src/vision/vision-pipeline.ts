import * as ort from 'onnxruntime-web';
import { FaceDetector, FilesetResolver } from '@mediapipe/tasks-vision';

// ===== CSP-safe WASM path configuration =====
ort.env.wasm.wasmPaths = chrome.runtime.getURL('wasm');

// ===== Strict output schema =====
export interface VisionDetection {
  type: string;
  boundingBox: [number, number, number, number]; // [x, y, w, h]
  confidence: number;
}

// ===== State =====
let activeBackend: 'webgpu' | 'wasm' | 'none' = 'none';
export let faceDetectorReady = false;
let faceDetector: FaceDetector | null = null;
let faceDetectorInitTimestamp: number = 0;

// Dynamic processing canvas
let canvas: HTMLCanvasElement;
let ctx: CanvasRenderingContext2D;

function getCanvas(): HTMLCanvasElement {
  if (!canvas) {
    canvas = document.getElementById('processing-canvas') as HTMLCanvasElement;
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'processing-canvas';
      document.body.appendChild(canvas);
    }
  }
  return canvas;
}

function getCtx(): CanvasRenderingContext2D {
  if (!ctx) {
    ctx = getCanvas().getContext('2d')!;
  }
  return ctx;
}

// ===== ONNX Session with Explicit WebGPU → WASM Fallback =====
export async function createONNXSession(modelBuffer: ArrayBuffer): Promise<ort.InferenceSession> {
  try {
    console.log('[Drishti:Vision] Attempting ONNX session with WebGPU...');
    const session = await ort.InferenceSession.create(modelBuffer, {
      executionProviders: ['webgpu'],
    });
    activeBackend = 'webgpu';
    console.log('[Drishti:Vision] ✓ ONNX session created with WebGPU');
    return session;
  } catch (webgpuError) {
    console.warn('[Drishti:Vision] WebGPU failed:', webgpuError);
  }

  try {
    console.log('[Drishti:Vision] Falling back to WASM execution provider...');
    const session = await ort.InferenceSession.create(modelBuffer, {
      executionProviders: ['wasm'],
    });
    activeBackend = 'wasm';
    console.log('[Drishti:Vision] ✓ ONNX session created with WASM fallback');
    return session;
  } catch (wasmError) {
    console.error('[Drishti:Vision] WASM fallback also failed:', wasmError);
    throw new Error(`All ONNX execution providers failed. WASM error: ${wasmError}`);
  }
}

// ===== Probe available ONNX backend (no model needed) =====
export async function probeBackend(): Promise<string> {
  if (typeof navigator !== 'undefined' && 'gpu' in navigator) {
    try {
      const adapter = await (navigator as any).gpu.requestAdapter();
      if (adapter) {
        activeBackend = 'webgpu';
        console.log('[Drishti:Vision] ✓ WebGPU adapter available');
        return 'webgpu';
      }
    } catch (e) {
      console.warn('[Drishti:Vision] WebGPU adapter request failed:', e);
    }
  }

  activeBackend = 'wasm';
  console.log('[Drishti:Vision] WebGPU not available — WASM backend selected');
  return 'wasm';
}

// ===== MediaPipe Face Detector Initialization =====
export async function initFaceDetector(): Promise<void> {
  const wasmPath = chrome.runtime.getURL('mediapipe');
  const modelUrl = chrome.runtime.getURL('models/blaze_face_short_range.tflite');

  console.log('[Drishti:Vision] DIAG#3 — WASM fileset path:', wasmPath);
  console.log('[Drishti:Vision] DIAG#3 — Model .tflite URL:', modelUrl);

  try {
    const gpuOptions = {
      baseOptions: {
        modelAssetPath: modelUrl,
        delegate: 'GPU' as const,
      },
      runningMode: 'IMAGE' as const,
      minDetectionConfidence: 0.5,
    };
    console.log('[Drishti:Vision] Initializing FaceDetector with GPU delegate...');
    const fileset = await FilesetResolver.forVisionTasks(wasmPath);
    faceDetector = await FaceDetector.createFromOptions(fileset, gpuOptions);
    faceDetectorReady = true;
    faceDetectorInitTimestamp = Date.now();
    console.log(`[Drishti:Vision] DIAG#2 — ✓ FaceDetector READY at timestamp ${faceDetectorInitTimestamp} (GPU delegate)`);
    return;
  } catch (gpuError) {
    console.warn('[Drishti:Vision] FaceDetector GPU delegate failed:', gpuError);
  }

  try {
    const cpuOptions = {
      baseOptions: {
        modelAssetPath: modelUrl,
        delegate: 'CPU' as const,
      },
      runningMode: 'IMAGE' as const,
      minDetectionConfidence: 0.5,
    };
    console.log('[Drishti:Vision] Retrying FaceDetector with CPU delegate...');
    const fileset = await FilesetResolver.forVisionTasks(wasmPath);
    faceDetector = await FaceDetector.createFromOptions(fileset, cpuOptions);
    faceDetectorReady = true;
    faceDetectorInitTimestamp = Date.now();
    console.log(`[Drishti:Vision] DIAG#2 — ✓ FaceDetector READY at timestamp ${faceDetectorInitTimestamp} (CPU fallback)`);
  } catch (cpuError) {
    console.error('[Drishti:Vision] FaceDetector initialization completely failed:', cpuError);
    faceDetectorReady = false;
  }
}

// ===== Face Detection =====
export async function detectFaces(dataUrl: string): Promise<VisionDetection[]> {
  const detectCallTimestamp = Date.now();

  if (!faceDetector || !faceDetectorReady) {
    throw new Error('FaceDetector is not initialized');
  }

  if (!dataUrl) {
    throw new Error("Image dataUrl is empty on arrival!");
  }

  const response = await fetch(dataUrl);
  const blob = await response.blob();
  const imageBitmap = await createImageBitmap(blob);

  const cnv = getCanvas();
  const c = getCtx();
  cnv.width = imageBitmap.width;
  cnv.height = imageBitmap.height;
  c.drawImage(imageBitmap, 0, 0);

  const result = faceDetector.detect(imageBitmap);

  imageBitmap.close();

  const detections: VisionDetection[] = result.detections.map((det: any) => {
    const bb = det.boundingBox!;
    return {
      type: 'FACE',
      boundingBox: [
        Math.round(bb.originX),
        Math.round(bb.originY),
        Math.round(bb.width),
        Math.round(bb.height),
      ] as [number, number, number, number],
      confidence: Math.round((det.categories?.[0]?.score ?? 0) * 1000) / 1000,
    };
  });

  return detections;
}

// ===== Full Pipeline Init =====
export async function initPipeline(): Promise<{
  backend: string;
  faceDetectorReady: boolean;
}> {
  console.log('[Drishti:Vision] Starting pipeline...');
  try {
    const backend = await probeBackend();
    await initFaceDetector();
    return { backend, faceDetectorReady };
  } catch (err) {
    console.error('[Drishti:Vision] Model Init Error:', err);
    throw err;
  }
}

export function getActiveBackend() {
  return activeBackend;
}
