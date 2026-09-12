import browser from 'webextension-polyfill';
import { readDOM } from './dom-reader';
import type { DOMReadResult } from '../types';

/**
 * Content script entry point.
 * - DOM_READ_REQUEST: reads page structure
 * - CAPTURE_IMAGES: extracts pixel data from media elements as raw RGBA ArrayBuffers
 */

interface ImagePayload {
  dataUrl: string;
  width: number;
  height: number;
  domPath: string;
  sourceType: 'img' | 'canvas' | 'video';
  rect: { top: number; left: number; width: number; height: number };
  scale: number;
}

function captureImageElement(el: HTMLImageElement): ImagePayload | null {
  try {
    if (!el.complete || el.naturalWidth === 0) {
      console.warn('[Drishti:Content] DIAG#5 — Image not loaded or 0x0:', el.src?.substring(0, 80));
      return null;
    }
    let w = el.naturalWidth;
    let h = el.naturalHeight;
    if (w < 32 || h < 32) return null; // Skip tiny images (icons)

    let scale = 1;
    if (w < 150 || h < 150) {
      scale = 3;
    }

    const cvs = document.createElement('canvas');
    cvs.width = w * scale;
    cvs.height = h * scale;
    const cCtx = cvs.getContext('2d');
    if (!cCtx) return null;

    if (scale > 1) {
      cCtx.imageSmoothingEnabled = true;
      cCtx.imageSmoothingQuality = 'high';
    }
    cCtx.drawImage(el, 0, 0, cvs.width, cvs.height);

    // DIAG #5: Explicit try/catch on toDataURL to detect canvas tainting
    let dataUrl: string;
    try {
      dataUrl = cvs.toDataURL('image/jpeg', 1.0);
      console.log(`[Drishti:Content] DIAG#5 — toDataURL succeeded for img (${cvs.width}x${cvs.height}), dataUrl length: ${dataUrl.length}`);
    } catch (taintErr) {
      console.error(`[Drishti:Content] DIAG#5 — ✗ toDataURL FAILED (canvas tainted). src: ${el.src?.substring(0, 80)}`, taintErr);
      return null;
    }

    const rect = el.getBoundingClientRect();
    return {
      dataUrl,
      width: cvs.width,
      height: cvs.height,
      domPath: el.id ? `#${el.id}` : el.tagName.toLowerCase(),
      sourceType: 'img',
      rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
      scale,
    };
  } catch (err) {
    // CORS-tainted canvas — skip
    console.warn('[Drishti:Content] Cannot capture image (CORS):', err);
    return null;
  }
}

function captureCanvasElement(el: HTMLCanvasElement): ImagePayload | null {
  try {
    if (el.width < 32 || el.height < 32) return null;
    
    // We can't always draw a canvas to another canvas or use toDataURL if it's a webgl canvas, but for standard 2d it works.
    // If it's 2d, we can just call toDataURL on the element directly.
    const rect = el.getBoundingClientRect();
    return {
      dataUrl: el.toDataURL('image/jpeg', 1.0),
      width: el.width,
      height: el.height,
      domPath: el.id ? `#${el.id}` : 'canvas',
      sourceType: 'canvas',
      rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
      scale: 1,
    };
  } catch (err) {
    console.warn('[Drishti:Content] Cannot capture canvas:', err);
    return null;
  }
}

function captureVideoElement(el: HTMLVideoElement): ImagePayload | null {
  try {
    const w = el.videoWidth;
    const h = el.videoHeight;
    if (w < 32 || h < 32) return null;

    const cvs = document.createElement('canvas');
    cvs.width = w;
    cvs.height = h;
    const cCtx = cvs.getContext('2d');
    if (!cCtx) return null;

    cCtx.drawImage(el, 0, 0, w, h);
    const rect = el.getBoundingClientRect();
    return {
      dataUrl: cvs.toDataURL('image/jpeg', 1.0),
      width: w,
      height: h,
      domPath: el.id ? `#${el.id}` : 'video',
      sourceType: 'video',
      rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
      scale: 1,
    };
  } catch (err) {
    console.warn('[Drishti:Content] Cannot capture video:', err);
    return null;
  }
}

function captureAllMedia(): ImagePayload[] {
  const payloads: ImagePayload[] = [];

  document.querySelectorAll('img').forEach((img) => {
    const p = captureImageElement(img as HTMLImageElement);
    if (p) payloads.push(p);
  });

  document.querySelectorAll('canvas').forEach((cvs) => {
    const p = captureCanvasElement(cvs as HTMLCanvasElement);
    if (p) payloads.push(p);
  });

  document.querySelectorAll('video').forEach((vid) => {
    const p = captureVideoElement(vid as HTMLVideoElement);
    if (p) payloads.push(p);
  });

  console.log(`[Drishti:Content] Captured ${payloads.length} media element(s)`);
  return payloads;
}

// ===== Message Listener =====

import { detectFromAttributes, detectFromTextNodes } from '../pii/detector-dom';
import { applyRedactions, removeRedactions } from './redact';
import { showHITLOverlay } from './hitl-overlay';
import { executeApprovedAction } from './executor';

import { MessageEnvelopeSchema } from '../types/schemas';

chrome.runtime.onMessage.addListener((rawMessage: any, _sender, sendResponse) => {
  (async () => {
    const parsed = MessageEnvelopeSchema.safeParse(rawMessage);
    if (!parsed.success) {
      console.warn('[Drishti:Content] Invalid payload:', parsed.error);
      sendResponse({ success: false, error: 'Invalid payload' });
      return;
    }
    const message = parsed.data;
    console.log('[Drishti:Content] Received message action:', message.type);
    
    // EXPLICIT IGNORE: Do not intercept background-bound scans
    if (message.type === 'TRIGGER_VISION_SCAN' || message.type === 'TRIGGER_PII_SCAN') {
      // Intentionally do not sendResponse here so background can answer it.
      return;
    }
    
    if (message.type === 'DOM_READ_REQUEST') {
      console.log('[Drishti:Content] Received DOM_READ_REQUEST');
      try {
        const result = readDOM();
        console.log(
          `[Drishti:Content] DOM read complete: ${result.elements.length} elements, ` +
          `${result.forms.length} forms, ${result.mediaElements.length} media ` +
          `(${result.timing.durationMs}ms)`
        );
        sendResponse(result);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error('[Drishti:Content] DOM read failed:', errorMsg);
        sendResponse({ error: errorMsg });
      }
    } 
    else if (message.type === 'CAPTURE_IMAGES') {
      console.log('[Drishti:Content] Received CAPTURE_IMAGES');
      try {
        const payloads = captureAllMedia();
        sendResponse(payloads);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error('[Drishti:Content] Image capture failed:', errorMsg);
        sendResponse({ error: errorMsg });
      }
    } 
    else if (message.type === 'RUN_PII_DETECTION') {
      console.log('[Drishti:Content] Received RUN_PII_DETECTION');
      try {
        const domDetections = detectFromAttributes();
        const { detections: regexDetections, labelBoxes } = detectFromTextNodes();
        console.log(`[Drishti:Content] PII DOM: ${domDetections.length}, Regex: ${regexDetections.length}, Labels: ${labelBoxes.length}`);
        sendResponse({ success: true, domDetections, regexDetections, labelBoxes });
      } catch (error) {
        console.error('[Drishti:Content] PII detection failed:', error);
        sendResponse({ success: false, error: String(error) });
      }
    } 
    else if (message.type === 'APPLY_REDACTIONS') {
      console.log('[Drishti:Content] Received APPLY_REDACTIONS');
      try {
        const detections = (message as any).detections ?? [];
        const summary = applyRedactions(detections);
        sendResponse({ success: true, ...summary });
      } catch (error) {
        console.error('[Drishti:Content] applyRedactions failed:', error);
        sendResponse({ success: false, error: String(error) });
      }
    } 
    else if (message.type === 'REMOVE_REDACTIONS') {
      console.log('[Drishti:Content] Received REMOVE_REDACTIONS');
      try {
        removeRedactions();
        sendResponse({ success: true });
      } catch (error) {
        console.error('[Drishti:Content] removeRedactions failed:', error);
        sendResponse({ success: false, error: String(error) });
      }
    }
    else if (message.type === 'RUN_AGENT_CYCLE') {
      try {
        console.log('[Drishti:Content] Starting agent cycle...');
        
        // 1. Force a fresh Vision Scan
        const t0_vis = performance.now();
        await chrome.runtime.sendMessage({ type: 'TRIGGER_VISION_SCAN' });
        const vision_inference_ms = performance.now() - t0_vis;

        // 2. DOM / PII Scan (will reuse the vision cache we just populated)
        const t0_dom = performance.now();
        const piiResponse = await chrome.runtime.sendMessage({ type: 'TRIGGER_PII_SCAN' });
        const dom_scan_ms = piiResponse?.telemetry?.dom_scan_ms || (performance.now() - t0_dom);

        // 3. Redaction Paint
        const t1_redact = performance.now();
        if (piiResponse && piiResponse.success) {
          applyRedactions(piiResponse.detections);
        }
        // Await next animation frame to measure true paint time
        await new Promise(resolve => requestAnimationFrame(resolve));
        const redaction_paint_ms = performance.now() - t1_redact;

        const planResponse = await chrome.runtime.sendMessage({ 
          type: 'TRIGGER_AGENT_CYCLE',
          task_goal: (message as any).task_goal,
          telemetry: { dom_scan_ms, vision_inference_ms, redaction_paint_ms }
        });
        if (!planResponse || !planResponse.success) {
          throw new Error(planResponse?.error || 'Failed to get action plan');
        }
        const approved = await showHITLOverlay(planResponse.plan);
        removeRedactions();
        if (approved) {
          await executeApprovedAction(planResponse.plan);
        }
        sendResponse({ success: true, approved });
      } catch (e) {
        removeRedactions();
        console.error('[Drishti:Content] Agent cycle error:', e);
        sendResponse({ success: false, error: e instanceof Error ? e.message : String(e) });
      }
    }
  })();

  // CRITICAL: Always return true synchronously to keep the message channel open
  return true;
});

console.log('[Drishti] Content script loaded — DOM reader + image capture ready');




