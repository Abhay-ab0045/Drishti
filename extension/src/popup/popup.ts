import { MessageEnvelopeSchema } from '../types/schemas';

const statusDot = document.getElementById('status-dot') as HTMLSpanElement;
const statusText = document.getElementById('status-text') as HTMLSpanElement;
const scanBtn = document.getElementById('scan-btn') as HTMLButtonElement;
const visionBtn = document.getElementById('vision-btn') as HTMLButtonElement;
const piiBtn = document.getElementById('pii-btn') as HTMLButtonElement;
const redactBtn = document.getElementById('redact-btn') as HTMLButtonElement;
const clearBtn = document.getElementById('clear-btn') as HTMLButtonElement;
const modeIndicator = document.getElementById('mode-indicator') as HTMLSpanElement;
const resultsSection = document.getElementById('results-section') as HTMLDivElement;
const elementCount = document.getElementById('element-count') as HTMLSpanElement;
const formCount = document.getElementById('form-count') as HTMLSpanElement;
const mediaCount = document.getElementById('media-count') as HTMLSpanElement;
const latency = document.getElementById('latency') as HTMLSpanElement;
const visionResults = document.getElementById('vision-results') as HTMLDivElement;
const faceCount = document.getElementById('face-count') as HTMLSpanElement;
const visionBackend = document.getElementById('vision-backend') as HTMLSpanElement;
const detectionList = document.getElementById('detection-list') as HTMLDivElement;
const piiResults = document.getElementById('pii-results') as HTMLDivElement;
const piiCount = document.getElementById('pii-count') as HTMLSpanElement;
const piiVisualStatus = document.getElementById('pii-visual-status') as HTMLSpanElement;
const piiVisualNote = document.getElementById('pii-visual-note') as HTMLDivElement;
const piiDetectionList = document.getElementById('pii-detection-list') as HTMLDivElement;
const redactStatus = document.getElementById('redact-status') as HTMLSpanElement;
const errorSection = document.getElementById('error-section') as HTMLDivElement;
const errorDetails = document.getElementById('error-details') as HTMLPreElement;

async function getActiveTabId(actionName: string): Promise<number> {
  let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) {
    // Fallback if popup DevTools steals window focus
    const tabs = await chrome.tabs.query({ active: true, windowType: 'normal' });
    tab = tabs[0];
  }
  if (!tab || !tab.id) throw new Error("No active tab found to send message to.");
  
  console.log(`[Drishti:Popup] Routing ${actionName} to Tab ID: ${tab.id}`);
  return tab.id;
}

function setScanButtonsDisabled(disabled: boolean): void {
  scanBtn.disabled = disabled;
  visionBtn.disabled = disabled;
  piiBtn.disabled = disabled;
  // redactBtn has its own enable logic — don't force-enable here, just disable during scans
  if (disabled) redactBtn.disabled = true;
  if (disabled) clearBtn.disabled = true;
}

function setStatus(state: string, detail?: string): void {
  statusText.textContent = detail ? `${state} — ${detail}` : state;
  statusDot.className = 'status-indicator';
  statusText.className = 'status-text';

  if (state === 'SCANNING' || state === 'DETECTING' || state === 'REDACTING') {
    statusDot.classList.add('scanning');
    statusText.classList.add('scanning');
  } else if (state === 'ERROR') {
    statusDot.classList.add('error');
    statusText.classList.add('error');
  }
}

function showError(err: unknown): void {
  errorSection.style.display = 'block';
  errorDetails.textContent =
    err instanceof Error ? `${err.message}\n\n${err.stack || ''}` : String(err);
}

function clearError(): void {
  errorSection.style.display = 'none';
  errorDetails.textContent = '';
}

// ===== Phase 1: DOM Scan (popup → content script directly) =====

scanBtn.addEventListener('click', async () => {
  setScanButtonsDisabled(true);
  setStatus('SCANNING');
  clearError();
  resultsSection.style.display = 'none';

  try {
    const tabId = await getActiveTabId('Action');

    const response = await chrome.tabs.sendMessage(tabId, { type: 'DOM_READ_REQUEST' });

    if (response?.error) throw new Error(response.error);

    if (response) {
      const result = response;
      resultsSection.style.display = 'block';
      elementCount.textContent = String(result.elements?.length ?? 0);
      formCount.textContent = String(result.forms?.length ?? 0);
      mediaCount.textContent = String(result.mediaElements?.length ?? 0);
      latency.textContent = `${result.timing?.durationMs ?? '\u2014'}ms`;
      setStatus('IDLE');
    } else {
      throw new Error('Invalid response received from content script');
    }
  } catch (error) {
    console.error('[Drishti:Popup] Scan failed:', error);
    setStatus('ERROR');
    showError(error);
  } finally {
    setScanButtonsDisabled(false);
  }
});

// ===== Phase 2: Vision Scan (popup → background → offscreen) =====

visionBtn.addEventListener('click', async () => {
  setScanButtonsDisabled(true);
  setStatus('DETECTING');
  clearError();
  visionResults.style.display = 'none';
  detectionList.innerHTML = '';

  try {
    // Get the active tab ID to pass to background
    const tabId = await getActiveTabId('Action');

    console.log('[Drishti:Popup] Triggering vision scan for tab:', tabId);

    console.log('[Drishti:Popup] Dispatching TRIGGER_VISION_SCAN to chrome.runtime.sendMessage (background worker)');
    
    // Send to background service worker (which manages the offscreen doc)
    const messagePromise = new Promise<any>((resolve, reject) => {
      chrome.runtime.sendMessage({
        type: 'TRIGGER_VISION_SCAN',
        tabId: tabId,
      }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Vision scan timed out: receiver did not respond within 20s')), 20000);
    });

    const response = await Promise.race([messagePromise, timeoutPromise]);

    console.log('[Drishti:Popup] Vision response:', response);

    if (!response?.success) {
      throw new Error(response?.error || 'Vision scan failed — no success flag');
    }

    const detections = response.detections || [];
    const backend = response.backend || 'unknown';

    // Update UI
    visionResults.style.display = 'block';
    faceCount.textContent = String(detections.filter((d: any) => d.type === 'FACE').length);
    visionBackend.textContent = backend.toUpperCase();
    modeIndicator.textContent = backend.toUpperCase();

    // Render each detection
    detections.forEach((det: any, i: number) => {
      const row = document.createElement('div');
      row.className = 'detection-row';
      row.innerHTML = `
        <span class="detection-type">${det.type}</span>
        <span class="detection-bbox">[${det.boundingBox.join(', ')}]</span>
        <span class="detection-conf">${(det.confidence * 100).toFixed(1)}%</span>
      `;
      detectionList.appendChild(row);
    });

    if (detections.length === 0) {
      const row = document.createElement('div');
      row.className = 'detection-row';
      row.innerHTML = '<span class="detection-type" style="color: var(--text-dim);">No detections</span>';
      detectionList.appendChild(row);
    }

    setStatus(detections.length > 0 ? 'COMPLETE' : 'IDLE');
  } catch (error) {
    console.error('[Drishti:Popup] Vision scan failed:', error);
    setStatus('ERROR');
    showError(error);
  } finally {
    setScanButtonsDisabled(false);
  }
});

function formatPiiLocation(location: { domPath: string } | { boundingBox: number[] }): string {
  if ('domPath' in location) return location.domPath;
  if ('boundingBox' in location) {
    return `[${location.boundingBox.map((n) => Math.round(n)).join(', ')}]`;
  }
  return '—';
}

function visualStatusLabel(source: string | undefined): string {
  if (source === 'cached') return 'CACHED';
  if (source === 'fresh') return 'SCANNED';
  if (source === 'unavailable') return 'UNAVAILABLE';
  return '—';
}

// ===== Phase 3: PII Scan (popup → background TRIGGER_PII_SCAN) =====

piiBtn.addEventListener('click', async () => {
  setScanButtonsDisabled(true);
  setStatus('DETECTING', 'PII scan');
  clearError();
  piiResults.style.display = 'none';
  piiDetectionList.innerHTML = '';
  piiVisualNote.style.display = 'none';
  piiVisualNote.textContent = '';

  try {
    const tabId = await getActiveTabId('Action');

    console.log('[Drishti:Popup] Dispatching TRIGGER_PII_SCAN for tab:', tabId);

    const messagePromise = new Promise<any>((resolve, reject) => {
      chrome.runtime.sendMessage({
        type: 'TRIGGER_PII_SCAN',
        tabId: tabId,
      }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('PII scan timed out: receiver did not respond within 30s')), 30000);
    });

    const response = await Promise.race([messagePromise, timeoutPromise]);
    console.log('[Drishti:Popup] PII response:', response);

    if (!response?.success) {
      throw new Error(response?.error || 'PII scan failed — no success flag');
    }

    const detections = response.detections || [];
    const visualSource = response.visualSource as string | undefined;

    piiResults.style.display = 'block';
    piiCount.textContent = String(detections.length);
    piiVisualStatus.textContent = visualStatusLabel(visualSource);

    if (visualSource === 'fresh') {
      piiVisualNote.style.display = 'block';
      piiVisualNote.textContent = 'No cached vision data — vision scan ran as part of this PII scan.';
    } else if (visualSource === 'unavailable') {
      piiVisualNote.style.display = 'block';
      piiVisualNote.textContent = `Visual detections unavailable${response.visualError ? `: ${response.visualError}` : ''}. List is DOM/regex only.`;
    }

    detections.forEach((det: any) => {
      const row = document.createElement('div');
      row.className = 'detection-row';
      row.innerHTML = `
        <span class="detection-type">${det.type}</span>
        <span class="detection-bbox">${formatPiiLocation(det.location)}</span>
        <span class="detection-conf">${(det.confidence * 100).toFixed(1)}%</span>
      `;
      piiDetectionList.appendChild(row);
    });

    if (detections.length === 0) {
      const row = document.createElement('div');
      row.className = 'detection-row';
      row.innerHTML = '<span class="detection-type" style="color: var(--text-dim);">No detections</span>';
      piiDetectionList.appendChild(row);
    }

    setStatus(detections.length > 0 ? 'COMPLETE' : 'IDLE');

    // Enable Redact button now that we have PII results
    if (detections.length > 0) {
      redactBtn.disabled = false;
      clearBtn.style.display = 'none';
      redactBtn.style.display = '';
      redactStatus.textContent = '—';
    }
  } catch (error) {
    console.error('[Drishti:Popup] PII scan failed:', error);
    setStatus('ERROR');
    showError(error);
  } finally {
    setScanButtonsDisabled(false);
    // Restore redact button to whatever state it was in (disabled check handled above)
    clearBtn.disabled = false;
  }
});

// ===== Phase 4: Redact =====

redactBtn.addEventListener('click', async () => {
  setScanButtonsDisabled(true);
  setStatus('REDACTING');
  clearError();

  try {
    const tabId = await getActiveTabId('Action');

    const messagePromise = new Promise<any>((resolve, reject) => {
      chrome.runtime.sendMessage(
        { type: 'TRIGGER_REDACTION', tabId: tabId },
        (response) => {
          if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
          else resolve(response);
        }
      );
    });
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Redaction timed out after 30s')), 30000)
    );

    const response = await Promise.race([messagePromise, timeoutPromise]);
    console.log('[Drishti:Popup] Redaction response:', response);

    if (!response?.success) throw new Error(response?.error || 'Redaction failed');

    const total = response.total ?? 0;
    redactStatus.textContent = `${total} item(s) redacted`;

    // Prefix every detection row with a redacted indicator
    const rows = piiDetectionList.querySelectorAll('.detection-type');
    rows.forEach((el) => {
      if (!el.textContent?.startsWith('🔴')) {
        el.textContent = `🔴 ${el.textContent}`;
      }
    });

    // Switch buttons: hide Redact, show Clear
    redactBtn.style.display = 'none';
    clearBtn.style.display = '';
    clearBtn.disabled = false;

    setStatus('COMPLETE', `${total} item(s) redacted on page`);
  } catch (error) {
    console.error('[Drishti:Popup] Redaction failed:', error);
    setStatus('ERROR');
    showError(error);
  } finally {
    setScanButtonsDisabled(false);
    clearBtn.disabled = false;
  }
});

clearBtn.addEventListener('click', async () => {
  setScanButtonsDisabled(true);
  setStatus('IDLE');
  clearError();

  try {
    const tabId = await getActiveTabId('Action');

    const messagePromise = new Promise<any>((resolve, reject) => {
      chrome.runtime.sendMessage(
        { type: 'TRIGGER_REMOVE_REDACTION', tabId: tabId },
        (response) => {
          if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
          else resolve(response);
        }
      );
    });
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Clear redaction timed out after 10s')), 10000)
    );

    await Promise.race([messagePromise, timeoutPromise]);

    // Restore detection row labels
    const rows = piiDetectionList.querySelectorAll('.detection-type');
    rows.forEach((el) => {
      el.textContent = el.textContent?.replace(/^🔴 /, '') ?? el.textContent;
    });

    redactStatus.textContent = 'CLEARED';
    clearBtn.style.display = 'none';
    redactBtn.style.display = '';
    redactBtn.disabled = false;
    setStatus('IDLE');
  } catch (error) {
    console.error('[Drishti:Popup] Clear redaction failed:', error);
    setStatus('ERROR');
    showError(error);
  } finally {
    setScanButtonsDisabled(false);
    redactBtn.disabled = false;
  }
});

// Get current state on popup open
chrome.runtime.onMessage.addListener((rawMessage: any) => {
  const parsed = MessageEnvelopeSchema.safeParse(rawMessage);
  if (!parsed.success) {
    console.warn('[Drishti:Popup] Invalid payload:', parsed.error);
    return;
  }
  const message = parsed.data;
  if (message.type === 'STATE_UPDATE' && message.payload?.state) {
    setStatus(message.payload.state, message.payload.detail);
  }
});

chrome.runtime.sendMessage({ type: 'GET_STATE' })
  .then((response) => {
    if (response?.payload?.state) {
      setStatus(response.payload.state, response.payload.detail);
    }
  })
  .catch((err) => {
    console.error('[Drishti:Popup] Failed to get state:', err);
  });






