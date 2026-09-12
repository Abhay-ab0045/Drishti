import os

hitl_ts = '''import type { ActionPlanResponse } from '../types/schemas';

const HITL_CONTAINER_ID = 'drishti-hitl-container';
const HITL_STYLE_ID = 'drishti-hitl-style';

function ensureHITLStyles() {
  if (document.getElementById(HITL_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = HITL_STYLE_ID;
  style.textContent = 
    # {
      position: fixed;
      bottom: 24px;
      right: 24px;
      width: 380px;
      background: rgba(13, 13, 13, 0.85);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      color: #fff;
      font-family: system-ui, -apple-system, sans-serif;
      z-index: 2147483647;
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.4);
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    # .drishti-hitl-header {
      padding: 12px 16px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: rgba(0, 0, 0, 0.2);
    }
    # .drishti-hitl-title {
      font-size: 13px;
      font-weight: 600;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      color: #aaa;
    }
    # .drishti-hitl-confidence {
      font-size: 12px;
      padding: 4px 8px;
      border-radius: 4px;
      background: rgba(46, 204, 113, 0.2);
      color: #2ecc71;
      font-weight: 500;
    }
    # .drishti-hitl-content {
      padding: 16px;
      font-size: 14px;
      line-height: 1.5;
    }
    # .drishti-hitl-reasoning {
      margin-bottom: 12px;
      color: #eee;
    }
    # .drishti-hitl-proposed {
      padding: 12px;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 6px;
      border-left: 3px solid #3498db;
      font-family: monospace;
      font-size: 13px;
      color: #64b5f6;
    }
    # .drishti-hitl-actions {
      display: flex;
      padding: 12px 16px;
      gap: 12px;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
    }
    # button {
      flex: 1;
      padding: 10px;
      border: none;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }
    # .btn-reject {
      background: rgba(255, 255, 255, 0.1);
      color: #fff;
    }
    # .btn-reject:hover {
      background: rgba(255, 255, 255, 0.2);
    }
    # .btn-approve {
      background: #3498db;
      color: #fff;
    }
    # .btn-approve:hover {
      background: #2980b9;
    }
  ;
  document.head.appendChild(style);
}

export function showHITLOverlay(plan: ActionPlanResponse): Promise<boolean> {
  ensureHITLStyles();

  return new Promise((resolve) => {
    // Remove existing if any
    const existing = document.getElementById(HITL_CONTAINER_ID);
    if (existing) existing.remove();

    const container = document.createElement('div');
    container.id = HITL_CONTAINER_ID;

    const confPct = Math.round(plan.confidence * 100);
    const targetLabel = plan.target?.text_hint || plan.target?.selector || 'Page';
    const proposedText = Suggested:  -> ;

    container.innerHTML = 
      <div class="drishti-hitl-header">
        <span class="drishti-hitl-title">Drishti Action Planner</span>
        <span class="drishti-hitl-confidence">Confidence: %</span>
      </div>
      <div class="drishti-hitl-content">
        <div class="drishti-hitl-reasoning"></div>
        <div class="drishti-hitl-proposed"></div>
      </div>
      <div class="drishti-hitl-actions">
        <button class="btn-reject" id="drishti-btn-reject">Reject</button>
        <button class="btn-approve" id="drishti-btn-approve">Approve & Execute</button>
      </div>
    ;

    document.body.appendChild(container);

    const btnReject = container.querySelector('#drishti-btn-reject') as HTMLButtonElement;
    const btnApprove = container.querySelector('#drishti-btn-approve') as HTMLButtonElement;

    const cleanup = () => {
      container.remove();
    };

    btnReject.addEventListener('click', () => {
      cleanup();
      resolve(false);
    });

    btnApprove.addEventListener('click', () => {
      cleanup();
      resolve(true);
    });
  });
}
'''

executor_ts = '''import type { ActionPlanResponse } from '../types/schemas';

const PULSE_STYLE_ID = 'drishti-pulse-style';

function ensurePulseStyles() {
  if (document.getElementById(PULSE_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = PULSE_STYLE_ID;
  style.textContent = 
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
  ;
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
      // Small delay to let scroll finish
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
    // Basic scroll down if no specific direction
    window.scrollBy({ top: window.innerHeight * 0.8, behavior: 'smooth' });
  }
  // For 'respond' and 'wait', the HITL overlay already showed the message, so we just log
  else {
    console.log('[Drishti:Executor] Action was:', plan.action, '-', plan.reasoning);
  }
}
'''

with open('extension/src/content-scripts/hitl-overlay.ts', 'w', encoding='utf-8') as f:
    f.write(hitl_ts)

with open('extension/src/content-scripts/executor.ts', 'w', encoding='utf-8') as f:
    f.write(executor_ts)

print("Files written correctly")
