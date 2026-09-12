import type { PIIDetection } from '../pii/types';

const FIELD_CLASS   = 'drishti-redact-field';
const TEXT_CLASS    = 'drishti-redact-text';
const STYLE_ID      = 'drishti-redact-styles';
const OVERLAY_CLASS = 'drishti-redact-overlay';
const REDACT_ATTR   = 'data-drishti-redacted';

const redactedInputs: Element[] = [];
const redactedTexts: Array<{ el: Element; originalHTML: string }> = [];
const overlayDivs: HTMLElement[] = [];

function ensureStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = [
    '.' + FIELD_CLASS + ' {',
    '  color: transparent !important;',
    '  background: #0d0d0d !important;',
    '  -webkit-text-security: disc !important;',
    '  border-color: #222 !important;',
    '  box-shadow: none !important;',
    '  caret-color: #888 !important;',
    '}',
    '.' + FIELD_CLASS + '::placeholder { color: transparent !important; }',
    '.' + TEXT_CLASS + ' {',
    '  background: #0d0d0d !important;',
    '  color: #0d0d0d !important;',
    '  border-radius: 2px;',
    '  cursor: default;',
    '  user-select: none;',
    '}',
    '.' + OVERLAY_CLASS + ' {',
    '  position: absolute;',
    '  background: #0d0d0d;',
    '  z-index: 2147483647;',
    '  pointer-events: none;',
    '  border-radius: 2px;',
    '  display: flex;',
    '  align-items: flex-end;',
    '  justify-content: flex-end;',
    '}',
  ].join('\n');
  document.head.appendChild(style);
}

function resolveElement(domPath: string): Element | null {
  try { return document.querySelector(domPath); } catch { return null; }
}

function isInputLike(el: Element): boolean {
  const tag = el.tagName.toLowerCase();
  return tag === 'input' || tag === 'select' || tag === 'textarea';
}

function redactField(el: Element): void {
  if (el.hasAttribute(REDACT_ATTR)) return;
  el.setAttribute(REDACT_ATTR, 'field');
  el.classList.add(FIELD_CLASS);
  redactedInputs.push(el);
  // .value is NEVER read, logged, or touched.
}

function unredactField(el: Element): void {
  el.removeAttribute(REDACT_ATTR);
  el.classList.remove(FIELD_CLASS);
}

function redactTextElement(el: Element, type: string): void {
  if (el.hasAttribute(REDACT_ATTR)) return;
  const originalHTML = el.innerHTML;
  el.setAttribute(REDACT_ATTR, 'text');
  const span = document.createElement('span');
  span.className = TEXT_CLASS;
  span.setAttribute('data-drishti-type', type);
  while (el.firstChild) span.appendChild(el.firstChild);
  el.appendChild(span);
  redactedTexts.push({ el, originalHTML });
}

function unredactTextElement(el: Element, originalHTML: string): void {
  el.removeAttribute(REDACT_ATTR);
  el.innerHTML = originalHTML;
}

function redactBoundingBox(box: [number, number, number, number]): void {
  const [x, y, w, h] = box;
  if (w <= 0 || h <= 0) return;
  const div = document.createElement('div');
  div.className = OVERLAY_CLASS;
  div.setAttribute(REDACT_ATTR, 'overlay');
  div.style.left   = Math.round(x + window.scrollX) + 'px';
  div.style.top    = Math.round(y + window.scrollY) + 'px';
  div.style.width  = Math.ceil(w) + 'px';
  div.style.height = Math.ceil(h) + 'px';
  document.body.appendChild(div);
  overlayDivs.push(div);
}

export function pixelRedactDataUrl(
  dataUrl: string,
  boxes: Array<[number, number, number, number]>
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (boxes.length === 0) { resolve(dataUrl); return; }
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width  = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('pixelRedactDataUrl: no 2d context')); return; }
      ctx.drawImage(img, 0, 0);
      ctx.fillStyle = '#000000';
      for (const [bx, by, bw, bh] of boxes) {
        ctx.fillRect(Math.floor(bx), Math.floor(by), Math.ceil(bw), Math.ceil(bh));
      }
      resolve(canvas.toDataURL('image/jpeg', 0.92));
    };
    img.onerror = () => reject(new Error('pixelRedactDataUrl: image load failed'));
    img.src = dataUrl;
  });
}

export interface RedactionSummary {
  fieldsRedacted: number;
  textsRedacted: number;
  overlaysPlaced: number;
  total: number;
}

export function applyRedactions(detections: PIIDetection[]): RedactionSummary {
  ensureStyles();
  let fieldsRedacted = 0, textsRedacted = 0, overlaysPlaced = 0;

  for (const det of detections) {
    if ('domPath' in det.location) {
      const el = resolveElement(det.location.domPath);
      if (!el) { console.warn('[Drishti:Redact] Not found: ' + det.location.domPath); continue; }
      if (isInputLike(el)) { redactField(el); fieldsRedacted++; }
      else { redactTextElement(el, det.type); textsRedacted++; }
    } else if ('boundingBox' in det.location) {
      redactBoundingBox(det.location.boundingBox);
      overlaysPlaced++;
    }
  }

  console.log('[Drishti:Redact] Applied: ' + fieldsRedacted + ' field(s), ' + textsRedacted + ' text(s), ' + overlaysPlaced + ' overlay(s)');
  return { fieldsRedacted, textsRedacted, overlaysPlaced, total: fieldsRedacted + textsRedacted + overlaysPlaced };
}

export function removeRedactions(): void {
  for (const el of redactedInputs) unredactField(el);
  redactedInputs.length = 0;
  for (const { el, originalHTML } of redactedTexts) unredactTextElement(el, originalHTML);
  redactedTexts.length = 0;
  for (const div of overlayDivs) div.remove();
  overlayDivs.length = 0;
  document.getElementById(STYLE_ID)?.remove();
  console.log('[Drishti:Redact] All redactions removed.');
}