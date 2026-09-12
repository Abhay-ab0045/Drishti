import type { ActionPlanResponse } from '../types/schemas';

const HITL_CONTAINER_ID = 'drishti-hitl-container';
const HITL_STYLE_ID = 'drishti-hitl-style';

function ensureHITLStyles() {
  if (document.getElementById(HITL_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = HITL_STYLE_ID;
  style.textContent = `
    #${HITL_CONTAINER_ID} {
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
    #${HITL_CONTAINER_ID} .drishti-hitl-header {
      padding: 12px 16px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: rgba(0, 0, 0, 0.2);
    }
    #${HITL_CONTAINER_ID} .drishti-hitl-title {
      font-size: 13px;
      font-weight: 600;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      color: #aaa;
    }
    #${HITL_CONTAINER_ID} .drishti-hitl-confidence {
      font-size: 12px;
      padding: 4px 8px;
      border-radius: 4px;
      background: rgba(46, 204, 113, 0.2);
      color: #2ecc71;
      font-weight: 500;
    }
    #${HITL_CONTAINER_ID} .drishti-hitl-content {
      padding: 16px;
      font-size: 14px;
      line-height: 1.5;
    }
    #${HITL_CONTAINER_ID} .drishti-hitl-reasoning {
      margin-bottom: 12px;
      color: #eee;
    }
    #${HITL_CONTAINER_ID} .drishti-hitl-proposed {
      padding: 12px;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 6px;
      border-left: 3px solid #3498db;
      font-family: monospace;
      font-size: 13px;
      color: #64b5f6;
    }
    #${HITL_CONTAINER_ID} .drishti-hitl-actions {
      display: flex;
      padding: 12px 16px;
      gap: 12px;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
    }
    #${HITL_CONTAINER_ID} button {
      flex: 1;
      padding: 10px;
      border: none;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }
    #${HITL_CONTAINER_ID} .btn-reject {
      background: rgba(255, 255, 255, 0.1);
      color: #fff;
    }
    #${HITL_CONTAINER_ID} .btn-reject:hover {
      background: rgba(255, 255, 255, 0.2);
    }
    #${HITL_CONTAINER_ID} .btn-approve {
      background: #3498db;
      color: #fff;
    }
    #${HITL_CONTAINER_ID} .btn-approve:hover {
      background: #2980b9;
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
    const targetLabel = plan.target?.text_hint || plan.target?.selector || 'Page';
    const proposedText = `Suggested: ${plan.action.toUpperCase()} -> ${targetLabel}`;

    container.innerHTML = `
      <div class="drishti-hitl-header">
        <span class="drishti-hitl-title">Drishti Action Planner</span>
        <span class="drishti-hitl-confidence">Confidence: ${confPct}%</span>
      </div>
      <div class="drishti-hitl-content">
        <div class="drishti-hitl-reasoning">${plan.reasoning}</div>
        <div class="drishti-hitl-proposed">${proposedText}</div>
      </div>
      <div class="drishti-hitl-actions">
        <button class="btn-reject" id="drishti-btn-reject">Reject</button>
        <button class="btn-approve" id="drishti-btn-approve">Approve & Execute</button>
      </div>
    `;

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
