import * as ort from 'onnxruntime-web';
import { FaceDetector, FilesetResolver } from '@mediapipe/tasks-vision';

// ===== CSP-safe WASM path configuration =====
ort.env.wasm.wasmPaths = chrome.runtime.getURL('wasm');

// ===== Strict output schema =====
interface VisionDetection {
  type: string;
  boundingBox: [number, number, number, number]; // [x, y, w, h]
  confidence: number;
}

// ===== State =====
let activeBackend: 'webgpu' | 'wasm' | 'none' = 'none';
let faceDetectorReady = false;
let faceDetector: FaceDetector | null = null;
let faceDetectorInitTimestamp: number = 0; // DIAG #2: track init completion time

// Processing canvas (from the HTML)
const canvas = document.getElementById('processing-canvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

// ===== ONNX Session with Explicit WebGPU → WASM Fallback =====
async function createONNXSession(modelBuffer: ArrayBuffer): Promise<ort.InferenceSession> {
  // Step 1: Try WebGPU explicitly
  try {
    console.log('[Drishti:Offscreen] Attempting ONNX session with WebGPU...');
    const session = await ort.InferenceSession.create(modelBuffer, {
      executionProviders: ['webgpu'],
    });
    activeBackend = 'webgpu';
    console.log('[Drishti:Offscreen] ✓ ONNX session created with WebGPU');
    return session;
  } catch (webgpuError) {
    console.warn('[Drishti:Offscreen] WebGPU failed:', webgpuError);
  }

  // Step 2: Explicit WASM fallback (inside catch path)
  try {
    console.log('[Drishti:Offscreen] Falling back to WASM execution provider...');
    const session = await ort.InferenceSession.create(modelBuffer, {
      executionProviders: ['wasm'],
    });
    activeBackend = 'wasm';
    console.log('[Drishti:Offscreen] ✓ ONNX session created with WASM fallback');
    return session;
  } catch (wasmError) {
    console.error('[Drishti:Offscreen] WASM fallback also failed:', wasmError);
    throw new Error(`All ONNX execution providers failed. WASM error: ${wasmError}`);
  }
}

// ===== Probe available ONNX backend (no model needed) =====
async function probeBackend(): Promise<string> {
  // Check if WebGPU is available at the hardware level
  if (typeof navigator !== 'undefined' && 'gpu' in navigator) {
    try {
      const adapter = await (navigator as any).gpu.requestAdapter();
      if (adapter) {
        activeBackend = 'webgpu';
        console.log('[Drishti:Offscreen] ✓ WebGPU adapter available');
        return 'webgpu';
      }
    } catch (e) {
      console.warn('[Drishti:Offscreen] WebGPU adapter request failed:', e);
    }
  }

  activeBackend = 'wasm';
  console.log('[Drishti:Offscreen] WebGPU not available — WASM backend selected');
  return 'wasm';
}

// ===== MediaPipe Face Detector Initialization =====
async function initFaceDetector(): Promise<void> {
  const wasmPath = chrome.runtime.getURL('mediapipe');
  const modelUrl = chrome.runtime.getURL('models/blaze_face_short_range.tflite');

  // DIAG #3: Log both paths so we can check network tab
  console.log('[Drishti:Offscreen] DIAG#3 — WASM fileset path:', wasmPath);
  console.log('[Drishti:Offscreen] DIAG#3 — Model .tflite URL:', modelUrl);
  console.log('[Drishti:Offscreen] DIAG#3 — ✓ Model is bundled locally via chrome.runtime.getURL');

  // Try GPU delegate first
  try {
    // DIAG #4: Log exact options
    const gpuOptions = {
      baseOptions: {
        modelAssetPath: modelUrl,
        delegate: 'GPU' as const,
      },
      runningMode: 'IMAGE' as const,
      minDetectionConfidence: 0.5,
    };
    console.log('[Drishti:Offscreen] DIAG#4 — FaceDetector GPU options:', JSON.stringify(gpuOptions, null, 2));

    console.log('[Drishti:Offscreen] Initializing FaceDetector with GPU delegate...');
    const fileset = await FilesetResolver.forVisionTasks(wasmPath);
    console.log('[Drishti:Offscreen] DIAG#3 — FilesetResolver loaded successfully');
    faceDetector = await FaceDetector.createFromOptions(fileset, gpuOptions);
    faceDetectorReady = true;
    faceDetectorInitTimestamp = Date.now();
    // DIAG #2: Confirm init completed with timestamp
    console.log(`[Drishti:Offscreen] DIAG#2 — ✓ FaceDetector READY at timestamp ${faceDetectorInitTimestamp} (GPU delegate)`);
    return;
  } catch (gpuError) {
    console.warn('[Drishti:Offscreen] FaceDetector GPU delegate failed:', gpuError);
  }

  // Explicit CPU fallback
  try {
    const cpuOptions = {
      baseOptions: {
        modelAssetPath: modelUrl,
        delegate: 'CPU' as const,
      },
      runningMode: 'IMAGE' as const,
      minDetectionConfidence: 0.5,
    };
    console.log('[Drishti:Offscreen] DIAG#4 — FaceDetector CPU fallback options:', JSON.stringify(cpuOptions, null, 2));

    console.log('[Drishti:Offscreen] Retrying FaceDetector with CPU delegate...');
    const fileset = await FilesetResolver.forVisionTasks(wasmPath);
    faceDetector = await FaceDetector.createFromOptions(fileset, cpuOptions);
    faceDetectorReady = true;
    faceDetectorInitTimestamp = Date.now();
    console.log(`[Drishti:Offscreen] DIAG#2 — ✓ FaceDetector READY at timestamp ${faceDetectorInitTimestamp} (CPU fallback)`);
  } catch (cpuError) {
    console.error('[Drishti:Offscreen] FaceDetector initialization completely failed:', cpuError);
    faceDetectorReady = false;
  }
}

// ===== Face Detection =====
async function detectFaces(dataUrl: string): Promise<VisionDetection[]> {
  const detectCallTimestamp = Date.now();

  if (!faceDetector || !faceDetectorReady) {
    throw new Error('FaceDetector is not initialized');
  }

  // DIAG #2: Confirm init happened before detect
  console.log(`[Drishti:Offscreen] DIAG#2 — detectFaces() called at ${detectCallTimestamp}. Init was at ${faceDetectorInitTimestamp}. Delta: ${detectCallTimestamp - faceDetectorInitTimestamp}ms. Init-before-detect: ${faceDetectorInitTimestamp < detectCallTimestamp}`);

  if (!dataUrl) {
    throw new Error("Image dataUrl is empty on arrival!");
  }

  console.log(`[Drishti:Offscreen] Received Base64 image of length: ${dataUrl.length} characters`);

  // Fetch the base64 string into a Blob, then into an ImageBitmap
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  const imageBitmap = await createImageBitmap(blob);

  console.log(`[Drishti:Offscreen] ImageBitmap decoded: ${imageBitmap.width}x${imageBitmap.height}`);

  // DIAG #1: Visual verification — draw ImageBitmap to canvas and dump as data URL
  canvas.width = imageBitmap.width;
  canvas.height = imageBitmap.height;
  ctx.drawImage(imageBitmap, 0, 0);
  const verifyDataUrl = canvas.toDataURL('image/jpeg', 0.5); // lower quality to keep log manageable
  console.log(`[Drishti:Offscreen] DIAG#1 — Visual verification image (${canvas.width}x${canvas.height}). Copy this data URL into your browser address bar to inspect:`);
  console.log(verifyDataUrl);

  // Also append an <img> tag to the offscreen document body for inspection
  const debugImg = document.createElement('img');
  debugImg.src = verifyDataUrl;
  debugImg.style.cssText = 'max-width:400px;border:2px solid red;margin:8px;';
  debugImg.title = `DIAG#1: ${canvas.width}x${canvas.height}`;
  document.body.appendChild(debugImg);

  // Run MediaPipe face detection directly on the optimized ImageBitmap
  console.log('[Drishti:Offscreen] DIAG#4 — Calling faceDetector.detect(imageBitmap) with runningMode=IMAGE...');
  const result = faceDetector.detect(imageBitmap);

  console.log(`[Drishti:Offscreen] Raw MediaPipe result: ${result.detections.length} detections`);
  if (result.detections.length > 0) {
    console.log('[Drishti:Offscreen] DIAG — Raw detections:', JSON.stringify(result.detections, null, 2));
  }

  // Clean up WebGPU memory
  imageBitmap.close();

  // Map to strict output schema
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

  console.log(
    `[Drishti:Offscreen] Face detection complete: ${detections.length} face(s) found`
  );
  return detections;
}

// ===== DIAG #6: Control Image Test =====
// A tiny 8x8 PNG is NOT useful for face detection (too small for any model).
// Instead, we test with a known-good remote face image to isolate detector vs pipeline.
async function runControlImageTest(): Promise<void> {
  if (!faceDetector || !faceDetectorReady) {
    console.error('[Drishti:Offscreen] DIAG#6 — Cannot run control test: FaceDetector not ready');
    return;
  }

  console.log('[Drishti:Offscreen] DIAG#6 — Running control image test with a known-good face photo...');

  try {
    // Use a locally bundled, publicly available, frontal face test image
    const controlUrl = chrome.runtime.getURL('test-assets/face.jpg');
    const res = await fetch(controlUrl);
    if (!res.ok) {
      console.error(`[Drishti:Offscreen] DIAG#6 — Failed to fetch control image: ${res.status}`);
      return;
    }
    const blob = await res.blob();
    const bitmap = await createImageBitmap(blob);
    console.log(`[Drishti:Offscreen] DIAG#6 — Control image decoded: ${bitmap.width}x${bitmap.height}`);

    const result = faceDetector.detect(bitmap);
    console.log(`[Drishti:Offscreen] DIAG#6 — Control image result: ${result.detections.length} detections`);
    if (result.detections.length > 0) {
      console.log('[Drishti:Offscreen] DIAG#6 — ✓ PASS: FaceDetector works. Bug is in capture/encoding pipeline.');
      console.log('[Drishti:Offscreen] DIAG#6 — Raw:', JSON.stringify(result.detections, null, 2));
    } else {
      console.error('[Drishti:Offscreen] DIAG#6 — ✗ FAIL: FaceDetector returned 0 detections on a known-good face. Bug is in detector setup (steps 2-4).');
    }
    bitmap.close();
  } catch (err) {
    console.error('[Drishti:Offscreen] DIAG#6 — Control test error:', err);
  }
}

// ===== Full Pipeline Init =====
async function initPipeline(): Promise<{
  backend: string;
  faceDetectorReady: boolean;
}> {
  console.log('[Drishti:Offscreen] Message received, starting pipeline...');
  try {
    console.log('[Drishti:Offscreen] Booting ONNX...');
    const backend = await probeBackend();
    
    console.log('[Drishti:Offscreen] Booting MediaPipe...');
    await initFaceDetector();

    // DIAG #6: Run control test right after init
    await runControlImageTest();
    
    return { backend, faceDetectorReady };
  } catch (err) {
    console.error('[Drishti:Offscreen] Model Init Error:', err);
    throw err;
  }
}

// ===== Port Listener (Long-lived connections) =====
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'drishti-vision') return;

  port.onMessage.addListener((msg: { action: string; imageParams?: { dataUrl: string } }) => {
    console.log('[Drishti:Offscreen] Received via port:', msg.action);

    if (msg.action === 'INIT_PIPELINE') {
      const initPromise = initPipeline();
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Model Init Timeout: Exceeded 15 seconds')), 15000);
      });

      Promise.race([initPromise, timeoutPromise])
        .then((result) => {
          port.postMessage({ success: true, ...result });
        })
        .catch((err) => {
          console.error('[Drishti:Offscreen] INIT_PIPELINE error:', err);
          port.postMessage({ success: false, error: String(err) });
        });
    }

    if (msg.action === 'DETECT_FACES') {
      console.log('[Drishti:Offscreen] Running actual face detection...');
      if (!msg.imageParams || !msg.imageParams.dataUrl) {
        port.postMessage({ success: false, error: 'No dataUrl in message' });
        return;
      }
      
      detectFaces(msg.imageParams.dataUrl)
        .then((detections) => {
          port.postMessage({ success: true, detections, backend: activeBackend });
        })
        .catch((err) => {
          console.error('[Drishti:Offscreen] DETECT_FACES error:', err);
          port.postMessage({ success: false, error: String(err) });
        });
    }
  });
});

console.log('[Drishti:Offscreen] Offscreen document loaded — vision pipeline ready (PORT READY)');
