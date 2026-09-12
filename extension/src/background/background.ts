import type { DOMReadResult, PipelineState } from '../types';
import type { PIIDetection } from '../pii/types';

/**
 * Background service worker — orchestrates the Drishti pipeline.
 * Phase 1: DOM read coordination.
 * Phase 2: Vision pipeline via offscreen document.
 */

let currentState: PipelineState = 'IDLE';

/** Last successful Phase 2 result per tab — reused by PII scan so visual boxes are not silently dropped. */
const lastVisionByTab = new Map<number, {
  detections: Array<{ type: string; boundingBox: [number, number, number, number]; confidence: number }>;
  backend: string;
}>();

/** Last successful Phase 3 PII scan result per tab — reused by TRIGGER_REDACTION so Redact doesn't re-run the full pipeline. */
const lastPIIByTab = new Map<number, PIIDetection[]>();

function setState(state: PipelineState, detail?: string): void {
  currentState = state;
  console.log(`[Drishti:BG] State → ${state}${detail ? ` — ${detail}` : ''}`);
  // Notify popup (might not be open)
  chrome.runtime.sendMessage({
    type: 'STATE_UPDATE',
    payload: { state, detail },
  }).catch(() => {});
}

// ===== Offscreen Document Management =====

let creatingOffscreen: Promise<void> | null = null;

async function ensureOffscreen(): Promise<void> {
  console.log('[Drishti:BG] ensureOffscreen() called');
  
  if (await chrome.offscreen.hasDocument()) {
    console.log('[Drishti:BG] Offscreen document already exists');
    return;
  }
  
  if (creatingOffscreen) {
    await creatingOffscreen;
    return;
  }

  console.log('[Drishti:BG] Creating offscreen document...');
  creatingOffscreen = chrome.offscreen.createDocument({
    url: chrome.runtime.getURL('src/offscreen/offscreen.html'),
    reasons: [chrome.offscreen.Reason.WORKERS],
    justification: 'Running ONNX Runtime Web and MediaPipe for ML inference',
  });
  
  try {
    await creatingOffscreen;
    console.log('[Drishti:BG] ✓ Offscreen document created successfully');
  } finally {
    creatingOffscreen = null;
  }
}

// ===== Vision Pipeline =====

async function initVisionPipeline(): Promise<{ backend: string; faceDetectorReady: boolean }> {
  console.log('[Drishti:BG] initVisionPipeline() called - awaiting ensureOffscreen()');
  await ensureOffscreen();
  // Give a small 200ms grace period for the offscreen listener to fully register
  await new Promise(r => setTimeout(r, 200));
  console.log('[Drishti:BG] ensureOffscreen() completed. Sending INIT_PIPELINE message via port...');

  return new Promise((resolve, reject) => {
    const port = chrome.runtime.connect({ name: 'drishti-vision' });
    const timeout = setTimeout(() => {
      port.disconnect();
      reject(new Error('Offscreen worker failed to respond within 5s (INIT)'));
    }, 5000);

    port.onMessage.addListener((response) => {
      clearTimeout(timeout);
      console.log('[Drishti:BG] Received response for INIT_PIPELINE:', response);
      port.disconnect();

      if (!response?.success) {
        reject(new Error(response?.error || 'Pipeline init failed'));
      } else {
        console.log('[Drishti:BG] Vision pipeline initialized successfully');
        resolve({ backend: response.backend, faceDetectorReady: response.faceDetectorReady });
      }
    });

    port.postMessage({ action: 'INIT_PIPELINE' });
  });
}

async function runVisionScan(tabId: number): Promise<{
  detections: Array<{ type: string; boundingBox: [number, number, number, number]; confidence: number }>;
  backend: string;
}> {
  setState('DETECTING', 'Capturing DOM media...');

  // Step 1: Request images from content script
  const payloads: any[] = await chrome.tabs.sendMessage(tabId, { type: 'CAPTURE_IMAGES' });
  if (!payloads || payloads.length === 0) {
    console.log('[Drishti:BG] No media elements found in DOM.');
    setState('IDLE', '0 detections');
    return { detections: [], backend: 'unknown' };
  }

  // Step 2: Ensure offscreen document is alive
  await initVisionPipeline();

  const allDetections: Array<{ type: string; boundingBox: [number, number, number, number]; confidence: number }> = [];
  let usedBackend = 'unknown';

  setState('DETECTING', `Scanning ${payloads.length} elements...`);

  // Step 3: Run detection per element
  for (const payload of payloads) {
    console.log(`[Drishti:BG] Scanning element: ${payload.domPath}`);
    try {
      const visionResponse = await new Promise<any>((resolve, reject) => {
        const port = chrome.runtime.connect({ name: 'drishti-vision' });
        const timeout = setTimeout(() => {
          port.disconnect();
          reject(new Error('Offscreen worker failed to respond within 15s (DETECT)'));
        }, 15000);

        port.onMessage.addListener((response) => {
          clearTimeout(timeout);
          port.disconnect();
          resolve(response);
        });

        port.postMessage({
          action: 'DETECT_FACES',
          imageParams: {
            dataUrl: payload.dataUrl,
          },
        });
      });

      if (visionResponse?.success && visionResponse.detections) {
        usedBackend = visionResponse.backend;
        
        // Map bounding boxes back to viewport coordinates
        for (const det of visionResponse.detections) {
          const [x, y, w, h] = det.boundingBox;
          
          const viewportX = (x / payload.width) * payload.rect.width + payload.rect.left;
          const viewportY = (y / payload.height) * payload.rect.height + payload.rect.top;
          const viewportW = (w / payload.width) * payload.rect.width;
          const viewportH = (h / payload.height) * payload.rect.height;

          allDetections.push({
            type: det.type,
            boundingBox: [viewportX, viewportY, viewportW, viewportH],
            confidence: det.confidence,
          });
        }
      }
    } catch (err) {
      console.warn(`[Drishti:BG] Detection failed for element ${payload.domPath}:`, err);
    }
  }

  console.log(`[Drishti:BG] Total detections across DOM: ${allDetections.length}`);
  lastVisionByTab.set(tabId, { detections: allDetections, backend: usedBackend });
  setState(
    allDetections.length > 0 ? 'COMPLETE' : 'IDLE',
    `${allDetections.length} detection(s), backend: ${usedBackend}`
  );

  return { detections: allDetections, backend: usedBackend };
}

import { aggregateDetections } from '../pii/detector-aggregate';

async function runPIIScan(tabId: number): Promise<{
  detections: PIIDetection[];
  counts: Record<string, number>;
  visualSource: 'cached' | 'fresh' | 'unavailable';
  visualError?: string;
  dom_scan_ms?: number;
  vision_inference_ms?: number;
}> {
  setState('DETECTING', 'Running PII detection...');

  // 1. Get DOM & Regex detections + Label Boxes from content script
  const t0_dom = performance.now();
  const contentResult: any = await chrome.tabs.sendMessage(tabId, { type: 'RUN_PII_DETECTION' });
  const dom_scan_ms = performance.now() - t0_dom;
  if (!contentResult?.success) {
    throw new Error(contentResult?.error || 'Content script PII detection failed');
  }

  // 2. Visual detections: reuse last Vision Scan for this tab, otherwise auto-run Phase 2
  let visualSource: 'cached' | 'fresh' | 'unavailable' = 'fresh';
  let visualError: string | undefined;
  let vision_inference_ms = 0;
  let visionDetections: Array<{ type: string; boundingBox: [number, number, number, number]; confidence: number }> = [];

  const cached = lastVisionByTab.get(tabId);
  if (cached) {
    visualSource = 'cached';
    visionDetections = cached.detections;
    console.log(`[Drishti:BG] Reusing cached vision result for tab ${tabId} (${visionDetections.length} box(es))`);
  } else {
    setState('DETECTING', 'No cached vision data — running vision scan...');
    try {
      const t0_vis = performance.now();
      const visionResult = await runVisionScan(tabId);
      vision_inference_ms = performance.now() - t0_vis;
      
      visualSource = 'fresh';
      visionDetections = visionResult.detections;
    } catch (err) {
      visualSource = 'unavailable';
      visualError = err instanceof Error ? err.message : String(err);
      console.warn('[Drishti:BG] Vision scan failed during PII scan; DOM/regex results only:', visualError);
    }
  }

  const visualDetections: PIIDetection[] = visionDetections
    .filter(d => d.type === 'FACE')
    .map(d => ({
      type: 'FACE_IMAGE',
      source: 'visual',
      location: { boundingBox: d.boundingBox },
      confidence: d.confidence
    }));

  // 3. Aggregate
  const finalDetections = aggregateDetections(
    contentResult.domDetections,
    contentResult.regexDetections,
    visualDetections,
    contentResult.labelBoxes
  );

  // 4. Compute Summary
  const counts: Record<string, number> = {};
  for (const det of finalDetections) {
    counts[det.type] = (counts[det.type] || 0) + 1;
  }

  console.log('[Drishti:BG] PII Aggregation complete:', counts, 'visualSource:', visualSource);
  setState('COMPLETE', `Found ${finalDetections.length} PII items`);

  // Cache for TRIGGER_REDACTION so it doesn't need to re-run the pipeline
  lastPIIByTab.set(tabId, finalDetections);

  return { detections: finalDetections, counts, visualSource, visualError, dom_scan_ms, vision_inference_ms };
}

import { MessageEnvelopeSchema, ActionPlanResponse } from '../types/schemas';
import { TelemetryTracker } from './telemetry';

// ===== Message Listener =====

chrome.runtime.onMessage.addListener((rawMessage: any, sender, sendResponse) => {
  const parsed = MessageEnvelopeSchema.safeParse(rawMessage);
  
  (async () => {
    if (!parsed.success) {
      console.warn('[Drishti:BG] Invalid payload:', parsed.error);
      sendResponse({ success: false, error: `Invalid payload: ${parsed.error.message}` });
      return;
    }
    const message = parsed.data;
    console.log('[Drishti:BG] Received message type:', message.type);
    
    try {
      if (message.type === 'TRIGGER_VISION_SCAN') {
        const tabId = sender.tab?.id || ('tabId' in message ? message.tabId : undefined);
        console.log('[Drishti:Background] Received TRIGGER_VISION_SCAN for tab:', tabId);
        if (!tabId) {
          sendResponse({ type: 'VISION_RESULT', success: false, error: 'No tabId provided' });
          return;
        }
        const result = await runVisionScan(tabId);
        sendResponse({
          type: 'VISION_RESULT',
          success: true,
          detections: result.detections,
          backend: result.backend,
        });
      }
      else if (message.type === 'TRIGGER_PII_SCAN') {
        const tabId = sender.tab?.id || ('tabId' in message ? message.tabId : undefined);
        console.log('[Drishti:Background] Received TRIGGER_PII_SCAN for tab:', tabId);
        if (!tabId) {
          sendResponse({ type: 'PII_RESULT', success: false, error: 'No tabId provided' });
          return;
        }
        const result = await runPIIScan(tabId);
        sendResponse({
          type: 'PII_RESULT',
          success: true,
          detections: result.detections,
          counts: result.counts,
          visualSource: result.visualSource,
          visualError: result.visualError,
          telemetry: { dom_scan_ms: result.dom_scan_ms, vision_inference_ms: result.vision_inference_ms },
        });
      }
      else if (message.type === 'INIT_VISION') {
        const result = await initVisionPipeline();
        sendResponse({ type: 'VISION_INIT_RESULT', success: true, ...result });
      }
      else if (message.type === 'GET_STATE') {
        sendResponse({ type: 'STATE_UPDATE', payload: { state: currentState } });
      }
      else if (message.type === 'TRIGGER_REDACTION') {
        const tabId = sender.tab?.id || ('tabId' in message ? message.tabId : undefined);
        if (!tabId) {
          sendResponse({ success: false, error: 'No tabId provided' });
          return;
        }

        let detections = lastPIIByTab.get(tabId);
        let fromCache = true;
        if (!detections) {
          fromCache = false;
          console.log('[Drishti:BG] No cached PII - running fresh PII scan for redaction');
          setState('DETECTING', 'Running PII scan for redaction...');
          const piiResult = await runPIIScan(tabId);
          detections = piiResult.detections;
        } else {
          console.log(`[Drishti:BG] Using cached PII (${detections.length} item(s)) for redaction`);
        }

        setState('REDACTING', `Applying ${detections.length} redaction(s)...`);
        const redactResponse = await chrome.tabs.sendMessage(tabId, { type: 'APPLY_REDACTIONS', detections });

        if (!redactResponse?.success) {
          throw new Error(redactResponse?.error || 'Content script APPLY_REDACTIONS failed');
        }

        setState('COMPLETE', `${redactResponse.total} item(s) redacted`);
        sendResponse({ success: true, fromCache, ...redactResponse });
      }
      else if (message.type === 'TRIGGER_REMOVE_REDACTION') {
        const tabId = sender.tab?.id || ('tabId' in message ? message.tabId : undefined);
        if (!tabId) {
          sendResponse({ success: false, error: 'No tabId provided' });
          return;
        }

        const response = await chrome.tabs.sendMessage(tabId, { type: 'REMOVE_REDACTIONS' });
        setState('IDLE');
        sendResponse({ success: response?.success ?? true });
      }
      else if (message.type === 'TRIGGER_AGENT_CYCLE') {
        const tabId = sender.tab?.id || ('tabId' in message ? message.tabId : undefined);
        if (!tabId) {
          sendResponse({ success: false, error: 'No tabId provided' });
          return;
        }
        
        const tracker = new TelemetryTracker();
        const incomingTelemetry = (message as any).telemetry || {};
        tracker.setDuration('dom_scan_ms', incomingTelemetry.dom_scan_ms || 0);
        tracker.setDuration('vision_inference_ms', incomingTelemetry.vision_inference_ms || 0);
        tracker.setDuration('redaction_paint_ms', incomingTelemetry.redaction_paint_ms || 0);
        tracker.setCounts(incomingTelemetry.pii_detected_count || 0, incomingTelemetry.pii_redacted_count || 0);

        setState('DETECTING', 'Capturing screen and calling VLM...');
        
        // Brief wait to ensure UI updates are painted
        await new Promise(r => setTimeout(r, 100));
        
        tracker.start('screenshot_capture_ms');
        const dataUrl = await chrome.tabs.captureVisibleTab(
          chrome.windows.WINDOW_ID_CURRENT,
          { format: 'jpeg', quality: 85 }
        );
        tracker.stop('screenshot_capture_ms');
        
        const base64Image = dataUrl.split(',')[1];
        
        tracker.start('vlm_roundtrip_ms');
        const apiResponse = await fetch('http://127.0.0.1:8000/api/v1/plan/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image_base64: base64Image,
            task_goal: message.task_goal
          })
        });

        if (!apiResponse.ok) {
          throw new Error(`API error: ${apiResponse.statusText}`);
        }

        const plan = await apiResponse.json();
        tracker.stop('vlm_roundtrip_ms');
        
        await tracker.finalizeAndSave();

        setState('COMPLETE', 'Action plan ready');
        sendResponse({ success: true, plan });
      }
    } catch (err) {
      console.error('[Drishti:BG] Async listener error handling message:', message.type, err);
      // Try to update state if it was a scanning operation
      if (['TRIGGER_VISION_SCAN', 'TRIGGER_PII_SCAN', 'TRIGGER_REDACTION'].includes(message.type)) {
        setState('ERROR', err instanceof Error ? err.message : String(err));
      }
      sendResponse({ success: false, error: err instanceof Error ? err.message : String(err) });
    }
  })();

  // CRITICAL: Always return true synchronously to keep the message channel open
  return true;
});

console.log('[Drishti:BG] Background service worker initialized (Phase 1 + Phase 2)');


