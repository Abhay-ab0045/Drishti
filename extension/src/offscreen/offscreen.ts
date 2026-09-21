import { 
  initPipeline, 
  detectFaces, 
  getActiveBackend 
} from '../vision/vision-pipeline';

import { OffscreenMessageSchema } from '../types/schemas';

// ===== Port Listener (Long-lived connections) =====
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'drishti-vision') return;

  port.onMessage.addListener((rawMsg: any) => {
    const parsed = OffscreenMessageSchema.safeParse(rawMsg);
    if (!parsed.success) {
      console.warn('[Drishti:Offscreen] Invalid payload:', parsed.error);
      port.postMessage({ success: false, error: 'Invalid payload' });
      return;
    }
    const msg = parsed.data;
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
          port.postMessage({ success: true, detections, backend: getActiveBackend() });
        })
        .catch((err) => {
          console.error('[Drishti:Offscreen] DETECT_FACES error:', err);
          port.postMessage({ success: false, error: String(err) });
        });
    }
  });
});

console.log('[Drishti:Offscreen] Offscreen document loaded — vision pipeline ready (PORT READY)');
