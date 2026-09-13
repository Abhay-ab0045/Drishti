import type { ActionPlanResponse } from '../types/schemas';

const HITL_CONTAINER_ID = 'drishti-hitl-container';
const HITL_STYLE_ID = 'drishti-hitl-style';

function confidenceBadgeStyle(confidence: number): { bg: string; color: string } {
  if (confidence >= 0.8) return { bg: 'rgba(57, 255, 136, 0.15)', color: '#39FF88' };
  if (confidence >= 0.5) return { bg: 'rgba(255, 122, 26, 0.15)', color: '#FF7A1A' };
  return { bg: 'rgba(255, 59, 48, 0.15)', color: '#FF3B30' };
}

function ensureHITLStyles() {
  if (document.getElementById(HITL_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = HITL_STYLE_ID;
  style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&family=Space+Grotesk:wght@400;600&display=swap');

    #${HITL_CONTAINER_ID} {
      position: fixed;
      bottom: 24px;
      right: 24px;
      width: 380px;
      background: #0B0D10;
      border: 1px solid #1E2228;
      border-top: 2px solid #000000;
      color: #E8EAED;
      font-family: 'Space Grotesk', system-ui, sans-serif;
      z-index: 2147483647;
      box-shadow: 0 16px 48px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255,255,255,0.04);
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    #${HITL_CONTAINER_ID} .drishti-hitl-header {
      padding: 10px 14px;
      border-bottom: 1px solid #1E2228;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #000000;
    }

    #${HITL_CONTAINER_ID} .drishti-hitl-title {
      font-family: 'IBM Plex Mono', monospace;
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      color: #6B7280;
    }

    #${HITL_CONTAINER_ID} .drishti-hitl-confidence {
      font-family: 'IBM Plex Mono', monospace;
      font-size: 11px;
      padding: 3px 8px;
      font-weight: 600;
      letter-spacing: 0.05em;
    }

    #${HITL_CONTAINER_ID} .drishti-hitl-content {
      padding: 14px;
      font-size: 13px;
      line-height: 1.55;
    }

    #${HITL_CONTAINER_ID} .drishti-hitl-reasoning {
      margin-bottom: 12px;
      color: #B0B8C4;
      font-size: 13px;
    }

    #${HITL_CONTAINER_ID} .drishti-hitl-proposed {
      padding: 10px 12px;
      background: #14171C;
      border-left: 2px solid #000000;
      font-family: 'IBM Plex Mono', monospace;
      font-size: 12px;
      color: #4FD8E8;
      letter-spacing: 0.02em;
    }

    #${HITL_CONTAINER_ID} .drishti-hitl-actions {
      display: flex;
      padding: 10px 14px;
      gap: 10px;
      border-top: 1px solid #1E2228;
    }

    #${HITL_CONTAINER_ID} button {
      flex: 1;
      padding: 9px;
      border: 1px solid transparent;
      font-family: 'Space Grotesk', system-ui, sans-serif;
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      cursor: pointer;
      transition: background 0.15s, box-shadow 0.15s;
    }

    #${HITL_CONTAINER_ID} .btn-reject {
      background: transparent;
      border-color: #1E2228;
      color: #6B7280;
    }

    #${HITL_CONTAINER_ID} .btn-reject:hover {
      border-color: #6B7280;
      color: #E8EAED;
    }

    #${HITL_CONTAINER_ID} .btn-approve {
      background: transparent;
      border-color: #39FF88;
      color: #39FF88;
    }

    #${HITL_CONTAINER_ID} .btn-approve:hover {
      background: rgba(57, 255, 136, 0.1);
      box-shadow: 0 0 10px rgba(57, 255, 136, 0.25);
    }
  `;
  document.head.appendChild(style);
}

export function showHITLOverlay(plan: ActionPlanResponse): Promise<boolean> {
  ensureHITLStyles();

  return new Promise((resolve) => {
    const existing = document.getElementById(HITL_CONTAINER_ID);
    if (existing) existing.remove();

    const container = document.createElement('div');
    container.id = HITL_CONTAINER_ID;

    const confPct = Math.round(plan.confidence * 100);
    const badge = confidenceBadgeStyle(plan.confidence);
    const targetLabel = plan.target?.text_hint || plan.target?.selector || 'Page';
    const proposedText = `${plan.action.toUpperCase()} → ${targetLabel}`;

    container.innerHTML = `
      <div class="drishti-hitl-header">
        <span class="drishti-hitl-title">Drishti // Action Planner</span>
        <span class="drishti-hitl-confidence" style="background: ${badge.bg}; color: ${badge.color};">CONF ${confPct}%</span>
      </div>
      <div class="drishti-hitl-content">
        <div class="drishti-hitl-reasoning">${plan.reasoning}</div>
        <div class="drishti-hitl-proposed">${proposedText}</div>
      </div>
      <div class="drishti-hitl-actions">
        <button class="btn-reject" id="drishti-btn-reject">Reject</button>
        <button class="btn-approve" id="drishti-btn-approve">Approve &amp; Execute</button>
      </div>
    `;

    document.body.appendChild(container);

    const btnReject = container.querySelector('#drishti-btn-reject') as HTMLButtonElement;
    const btnApprove = container.querySelector('#drishti-btn-approve') as HTMLButtonElement;

    const cleanup = () => { container.remove(); };

    btnReject.addEventListener('click', () => { cleanup(); resolve(false); });
    btnApprove.addEventListener('click', () => { cleanup(); resolve(true); });
  });
}
