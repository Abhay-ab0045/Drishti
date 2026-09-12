import type { ActionPlanResponse } from '../types/schemas';

const PULSE_STYLE_ID = 'drishti-pulse-style';

function ensurePulseStyles() {
  if (document.getElementById(PULSE_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = PULSE_STYLE_ID;
  style.textContent = `
    @keyframes drishtiPulse {
      0% { box-shadow: 0 0 0 0 rgba(52, 152, 219, 0.7); }
      70% { box-shadow: 0 0 0 10px rgba(52, 152, 219, 0); }
      100% { box-shadow: 0 0 0 0 rgba(52, 152, 219, 0); }
    }
    .drishti-pulse-active {
      animation: drishtiPulse 1.5s infinite;
      outline: 2px solid #3498db !important;
      outline-offset: 2px !important;
    }
  `;
  document.head.appendChild(style);
}

function resolveTarget(plan: ActionPlanResponse): HTMLElement | null {
  if (plan.target?.selector) {
    try {
      const el = document.querySelector(plan.target.selector);
      if (el) return el as HTMLElement;
    } catch (e) {
      console.warn('[Drishti:Executor] Invalid selector:', plan.target.selector);
    }
  }
  
  if (plan.target?.text_hint) {
    const hint = plan.target.text_hint.toLowerCase();
    const elements = Array.from(document.querySelectorAll('button, a, input, select, textarea')) as HTMLElement[];
    for (const el of elements) {
      if (el.innerText?.toLowerCase().includes(hint) || 
          (el as HTMLInputElement).placeholder?.toLowerCase().includes(hint) ||
          (el as HTMLInputElement).name?.toLowerCase().includes(hint) ||
          el.getAttribute('aria-label')?.toLowerCase().includes(hint)) {
        return el;
      }
    }
  }
  
  return null;
}

export async function executeApprovedAction(plan: ActionPlanResponse): Promise<void> {
  console.log('[Drishti:Executor] Executing action:', plan.action);
  ensurePulseStyles();

  if (plan.action === 'click') {
    const el = resolveTarget(plan);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await new Promise(r => setTimeout(r, 300));
      el.click();
    } else {
      console.warn('[Drishti:Executor] Could not find target to click.');
    }
  } 
  else if (plan.action === 'type') {
    const el = resolveTarget(plan) as HTMLInputElement;
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await new Promise(r => setTimeout(r, 300));
      
      if (plan.value === '[USER_INPUT_REQUIRED]') {
        el.focus();
        el.classList.add('drishti-pulse-active');
        const removePulse = () => {
          el.classList.remove('drishti-pulse-active');
          el.removeEventListener('input', removePulse);
          el.removeEventListener('blur', removePulse);
        };
        el.addEventListener('input', removePulse);
        el.addEventListener('blur', removePulse);
      } else if (plan.value) {
        el.value = plan.value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
    } else {
      console.warn('[Drishti:Executor] Could not find target to type into.');
    }
  }
  else if (plan.action === 'scroll') {
    window.scrollBy({ top: window.innerHeight * 0.8, behavior: 'smooth' });
  }
  else {
    console.log('[Drishti:Executor] Action was:', plan.action, '-', plan.reasoning);
  }
}
