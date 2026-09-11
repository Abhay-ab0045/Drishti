import { PIIDetection } from './types';
import { EMAIL_PATTERN, PHONE_PATTERN, CREDIT_CARD_PATTERN, luhnCheck, AADHAAR_PATTERN, PAN_PATTERN } from './patterns';

/**
 * 1. DOM Attribute Detector
 */
export function detectFromAttributes(): PIIDetection[] {
  const detections: PIIDetection[] = [];
  
  // Find all inputs, selects, textareas
  const elements = document.querySelectorAll('input, select, textarea');
  
  elements.forEach((el) => {
    const tagName = el.tagName.toLowerCase();
    const type = el.getAttribute('type')?.toLowerCase();
    const autocomplete = el.getAttribute('autocomplete')?.toLowerCase();
    const name = el.getAttribute('name')?.toLowerCase() || '';
    const id = el.id?.toLowerCase() || '';
    const ariaLabel = el.getAttribute('aria-label')?.toLowerCase() || '';
    
    // Fallback path generation (simple)
    const domPath = el.id ? `#${el.id}` : tagName; // A real path generator would be better, but we can rely on standard CSS selector

    // Password
    if (tagName === 'input' && type === 'password') {
      detections.push({ type: 'PASSWORD_FIELD', source: 'dom_attribute', location: { domPath }, confidence: 1.0 });
      return; // Stop processing this field if it's explicitly a password
    }

    // Autocomplete
    if (autocomplete) {
      if (autocomplete.includes('cc-number') || autocomplete.includes('cc-csc') || autocomplete.includes('cc-exp')) {
        detections.push({ type: 'CREDIT_CARD', source: 'dom_attribute', location: { domPath }, confidence: 0.95 });
      } else if (autocomplete.includes('email')) {
        detections.push({ type: 'EMAIL', source: 'dom_attribute', location: { domPath }, confidence: 0.95 });
      } else if (autocomplete.includes('tel')) {
        detections.push({ type: 'PHONE', source: 'dom_attribute', location: { domPath }, confidence: 0.95 });
      }
    }

    // Keywords in name, id, or aria-label
    const combinedAttributes = `${name} ${id} ${ariaLabel}`;
    if (combinedAttributes.includes('aadhaar') || combinedAttributes.includes('aadhar') || combinedAttributes.includes('uidai')) {
      detections.push({ type: 'AADHAAR', source: 'dom_attribute', location: { domPath }, confidence: 0.85 });
    } else if (/\bpan\b/.test(combinedAttributes)) {
      detections.push({ type: 'PAN', source: 'dom_attribute', location: { domPath }, confidence: 0.85 });
    }
  });

  return detections;
}

/**
 * Helper to generate DOM path
 */
function getDomPath(el: Node): string {
  if (el.nodeType === Node.TEXT_NODE) {
    el = el.parentElement as Node;
  }
  if (!el || el.nodeType !== Node.ELEMENT_NODE) return 'unknown';
  
  const element = el as Element;
  if (element.id) return `#${element.id}`;
  
  let path = [];
  let current: Element | null = element;
  while (current && current.nodeType === Node.ELEMENT_NODE) {
    if (current.id) {
      path.unshift(`#${current.id}`);
      break;
    }
    let tagName = current.tagName.toLowerCase();
    let sibling = current.previousElementSibling;
    let nth = 1;
    while (sibling) {
      if (sibling.tagName.toLowerCase() === tagName) nth++;
      sibling = sibling.previousElementSibling;
    }
    path.unshift(`${tagName}:nth-of-type(${nth})`);
    current = current.parentElement;
  }
  return path.join(' > ');
}

/**
 * 2. Regex Detector for Text Content
 */
export function detectFromTextNodes(): {
  detections: PIIDetection[];
  labelBoxes: { x: number, y: number, w: number, h: number }[];
} {
  const detections: PIIDetection[] = [];
  const labelBoxes: { x: number, y: number, w: number, h: number }[] = [];
  
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      if (!node.nodeValue || node.nodeValue.trim() === '') return NodeFilter.FILTER_REJECT;
      const parentTag = node.parentElement?.tagName.toLowerCase();
      if (parentTag === 'script' || parentTag === 'style' || parentTag === 'noscript') return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });

  let currentNode: Node | null;
  while ((currentNode = walker.nextNode())) {
    const text = currentNode.nodeValue || '';
    const domPath = getDomPath(currentNode);
    
    // Label keywords for visual heuristic
    const lowerText = text.toLowerCase();
    if (lowerText.includes('photo') || lowerText.includes('passport') || lowerText.includes('id proof') || lowerText.includes('profile picture')) {
      const parent = currentNode.parentElement;
      if (parent) {
        const rect = parent.getBoundingClientRect();
        labelBoxes.push({ x: rect.left, y: rect.top, w: rect.width, h: rect.height });
      }
    }

    const phoneRanges: { start: number, end: number }[] = [];
    const ccRanges: { start: number, end: number }[] = [];

    for (const match of text.matchAll(EMAIL_PATTERN)) {
      detections.push({ type: 'EMAIL', source: 'regex_text', location: { domPath }, confidence: 0.99 });
    }

    for (const match of text.matchAll(PHONE_PATTERN)) {
      phoneRanges.push({ start: match.index!, end: match.index! + match[0].length });
      detections.push({ type: 'PHONE', source: 'regex_text', location: { domPath }, confidence: 0.90 });
    }

    for (const match of text.matchAll(CREDIT_CARD_PATTERN)) {
      ccRanges.push({ start: match.index!, end: match.index! + match[0].length });
      if (luhnCheck(match[0])) {
        detections.push({ type: 'CREDIT_CARD', source: 'regex_text', location: { domPath }, confidence: 0.99 });
      }
    }

    for (const match of text.matchAll(AADHAAR_PATTERN)) {
      const isOverlapPhone = phoneRanges.some(r => match.index! >= r.start && match.index! < r.end);
      const isOverlapCC = ccRanges.some(r => match.index! >= r.start && match.index! < r.end);
      if (!isOverlapPhone && !isOverlapCC) {
        detections.push({ type: 'AADHAAR', source: 'regex_text', location: { domPath }, confidence: 0.95 });
      }
    }

    for (const match of text.matchAll(PAN_PATTERN)) {
      detections.push({ type: 'PAN', source: 'regex_text', location: { domPath }, confidence: 0.95 });
    }
  }

  return { detections, labelBoxes };
}


