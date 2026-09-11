import { DOMSummaryElement, FormSummary, MediaElementInfo, PageContext, DOMReadResult } from '../types';

function getUniqueSelectorPath(el: Element): string {
  if (el.id) {
    return `#${CSS.escape(el.id)}`;
  }
  let path = [];
  let current: Element | null = el;
  while (current && current.nodeType === Node.ELEMENT_NODE) {
    if (current.id) {
      path.unshift(`#${CSS.escape(current.id)}`);
      break;
    }
    let tag = current.tagName.toLowerCase();
    let sibling = current.previousElementSibling;
    let nth = 1;
    while (sibling) {
      if (sibling.tagName.toLowerCase() === tag) {
        nth++;
      }
      sibling = sibling.previousElementSibling;
    }
    path.unshift(`${tag}:nth-of-type(${nth})`);
    current = current.parentElement;
  }
  return path.join(' > ');
}

function isElementVisible(el: Element): boolean {
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return false;
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
  return true;
}

function getBoundingBox(el: Element) {
  const rect = el.getBoundingClientRect();
  return {
    x: Math.round(rect.x),
    y: Math.round(rect.y),
    w: Math.round(rect.width),
    h: Math.round(rect.height)
  };
}

function resolveLabel(el: Element): string {
  const ariaLabel = el.getAttribute('aria-label');
  if (ariaLabel) return ariaLabel;

  const ariaLabelledby = el.getAttribute('aria-labelledby');
  if (ariaLabelledby) {
    const labelEl = document.getElementById(ariaLabelledby);
    if (labelEl && labelEl.textContent) return labelEl.textContent.trim();
  }

  if (el.id) {
    const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
    if (label && label.textContent) return label.textContent.trim();
  }

  const parentLabel = el.closest('label');
  if (parentLabel) {
    const clone = parentLabel.cloneNode(true) as HTMLElement;
    const inputs = clone.querySelectorAll('input, select, textarea');
    inputs.forEach(input => input.remove());
    if (clone.textContent) return clone.textContent.trim();
  }

  const placeholder = el.getAttribute('placeholder');
  if (placeholder) return placeholder;

  const title = el.getAttribute('title');
  if (title) return title;

  return '';
}

function inferRole(el: Element): string {
  const explicitRole = el.getAttribute('role');
  if (explicitRole) return explicitRole;

  const tag = el.tagName.toLowerCase();
  if (tag === 'input') {
    const type = el.getAttribute('type')?.toLowerCase() || 'text';
    if (['text', 'email', 'tel', 'url', 'search', 'number', 'password'].includes(type)) return 'textbox';
    if (type === 'checkbox') return 'checkbox';
    if (type === 'radio') return 'radio';
    if (['submit', 'reset', 'button'].includes(type)) return 'button';
    if (type === 'file') return 'file-upload';
    if (['date', 'datetime-local', 'month', 'week', 'time'].includes(type)) return 'date-input';
  }
  if (tag === 'textarea') return 'textbox';
  if (tag === 'select') return 'combobox';
  if (tag === 'button') return 'button';
  if (tag === 'a') return 'link';

  return '';
}

function isFocusable(el: Element): boolean {
  if (el.hasAttribute('disabled')) return false;
  const tabIndex = el.getAttribute('tabindex');
  if (tabIndex !== null && parseInt(tabIndex) < 0) return false;
  
  const tag = el.tagName.toLowerCase();
  const focusableTags = ['a', 'button', 'input', 'select', 'textarea'];
  if (focusableTags.includes(tag)) return true;
  if (el.hasAttribute('tabindex')) return true;
  if (el.getAttribute('contenteditable') === 'true') return true;
  
  return false;
}

function getPageContext(): PageContext {
  const url = new URL(window.location.href);
  return {
    url: window.location.href,
    domain: url.hostname,
    title: document.title,
    viewport: {
      w: window.innerWidth,
      h: window.innerHeight
    }
  };
}

function extractInteractiveElements(): DOMSummaryElement[] {
  const selectors = [
    'input', 'textarea', 'select', 'button', 'a[href]',
    '[role="button"]', '[role="textbox"]', '[role="combobox"]',
    '[role="checkbox"]', '[role="radio"]', '[role="link"]',
    '[contenteditable="true"]'
  ];
  
  const elements = new Set<Element>();
  selectors.forEach(selector => {
    document.querySelectorAll(selector).forEach(el => elements.add(el));
  });

  const results: DOMSummaryElement[] = [];

  elements.forEach(el => {
    if (!isElementVisible(el)) return;
    const focusable = isFocusable(el);
    if (!focusable && !el.matches('a[href], button, input, select, textarea')) return;

    let hasValue = false;
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
      hasValue = el.value.length > 0;
    } else if (el.getAttribute('contenteditable') === 'true') {
      hasValue = (el.textContent || '').trim().length > 0;
    }

    const tag = el.tagName.toLowerCase();
    const role = inferRole(el);
    const summary: DOMSummaryElement = {
      role: role || tag,
      tag,
      label: resolveLabel(el),
      domPath: getUniqueSelectorPath(el),
      boundingBox: getBoundingBox(el),
      isVisible: true,
      isFocusable: focusable,
      hasValue,
    };

    const placeholder = el.getAttribute('placeholder');
    if (placeholder) summary.placeholder = placeholder;

    if (el instanceof HTMLInputElement) {
      summary.inputType = el.type;
    }

    const autocomplete = el.getAttribute('autocomplete');
    if (autocomplete) summary.autocomplete = autocomplete;

    const name = el.getAttribute('name');
    if (name) summary.name = name;

    if (el.id) summary.id = el.id;

    if (tag === 'button' || tag === 'a' || role === 'button' || role === 'link') {
      summary.textContent = (el.textContent || '').substring(0, 100);
    }

    results.push(summary);
  });

  return results;
}

function extractForms(): FormSummary[] {
  const forms = document.querySelectorAll('form');
  const results: FormSummary[] = [];
  
  forms.forEach(form => {
    const summary: FormSummary = {
      fieldCount: form.querySelectorAll('input, select, textarea').length,
      domPath: getUniqueSelectorPath(form),
    };
    if (form.id) summary.id = form.id;
    if (form.name) summary.name = form.name;
    const action = form.getAttribute('action');
    if (action) summary.action = action;
    const method = form.getAttribute('method');
    if (method) summary.method = method;
    
    results.push(summary);
  });
  
  return results;
}

function extractMediaElements(): MediaElementInfo[] {
  const elements = document.querySelectorAll('img, canvas, video');
  const results: MediaElementInfo[] = [];
  
  elements.forEach(el => {
    if (!isElementVisible(el)) return;
    
    const tag = el.tagName.toLowerCase() as 'img' | 'canvas' | 'video';
    const rect = getBoundingBox(el);
    
    if (tag === 'img' && (rect.w < 32 || rect.h < 32)) return;
    
    const info: MediaElementInfo = {
      tag,
      domPath: getUniqueSelectorPath(el),
      boundingBox: rect,
    };
    
    if (tag === 'img') {
      const img = el as HTMLImageElement;
      if (img.src) info.src = img.src;
      if (img.alt) info.alt = img.alt;
      if (img.naturalWidth) info.naturalWidth = img.naturalWidth;
      if (img.naturalHeight) info.naturalHeight = img.naturalHeight;
    } else if (tag === 'video') {
      const video = el as HTMLVideoElement;
      if (video.src) info.src = video.src;
      if (video.videoWidth) info.naturalWidth = video.videoWidth;
      if (video.videoHeight) info.naturalHeight = video.videoHeight;
    }
    
    results.push(info);
  });
  
  return results;
}

export function readDOM(): DOMReadResult {
  const startMs = performance.now();
  
  const pageContext = getPageContext();
  const elements = extractInteractiveElements();
  const forms = extractForms();
  const mediaElements = extractMediaElements();
  
  const endMs = performance.now();
  
  return {
    pageContext,
    elements,
    forms,
    mediaElements,
    timing: {
      startMs,
      endMs,
      durationMs: Math.round(endMs - startMs)
    }
  };
}
