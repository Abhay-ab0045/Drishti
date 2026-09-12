import uuid
import base64
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import List

from schemas import (
    VisionDetection,
    PIIDetection,
    RedactionPayload,
    SessionStartRequest,
    SessionStartResponse,
    ActionPlanRequest,
    ActionPlanResponse,
    ActionTarget,
)
from vlm_adapter import plan_next_action

app = FastAPI(title="Drishti Backend", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "drishti-core"}

@app.post("/api/v1/session/start", response_model=SessionStartResponse)
def start_session(request: SessionStartRequest):
    session_id = f"sess_{uuid.uuid4().hex}"
    return {"sessionId": session_id, "status": "initialized"}

@app.post("/api/v1/scan/pii")
def scan_pii(payload: List[PIIDetection]):
    return {"success": True, "count": len(payload)}

@app.post("/api/v1/scan/vision")
def scan_vision(payload: VisionDetection):
    return {"success": True}

@app.post("/api/v1/redact/verify")
def redact_verify(payload: RedactionPayload):
    return {"success": True, "verified": True}


@app.post("/api/v1/plan/action", response_model=ActionPlanResponse)
def plan_action(request: ActionPlanRequest) -> ActionPlanResponse:
    """
    VLM-powered action planner.

    IMPORTANT: Expects an already-redacted image (pixel-blacked-out sensitive regions).
    This endpoint performs action planning only — it does NOT detect or process sensitive data.
    That responsibility belongs entirely to the on-device Phase 3 (PII detection) and
    Phase 4 (Redaction Engine) pipeline that runs before this endpoint is ever called.

    Accepts a base64-encoded screenshot and a task goal string.
    Returns a structured action plan (click, type, scroll, navigate, wait, respond)
    with a human-readable reasoning string for HITL confirmation.
    """
    try:
        image_bytes = base64.b64decode(request.image_base64)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid base64 image: {e}")

    result = plan_next_action(
        image_bytes=image_bytes,
        task_goal=request.task_goal,
    )

    # Normalize the target field — may be a dict, None, or already an ActionTarget
    raw_target = result.get("target")
    target: ActionTarget | None = None
    if isinstance(raw_target, dict):
        target = ActionTarget(
            selector=raw_target.get("selector"),
            text_hint=raw_target.get("text_hint"),
        )
    elif isinstance(raw_target, ActionTarget):
        target = raw_target

    return ActionPlanResponse(
        action=result["action"],
        target=target,
        value=result.get("value"),
        confidence=max(0.0, min(1.0, float(result.get("confidence", 0.0)))),
        reasoning=result.get("reasoning", ""),
    )
