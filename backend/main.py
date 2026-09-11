import uuid
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from typing import List

from schemas import (
    VisionDetection,
    PIIDetection,
    RedactionPayload,
    SessionStartRequest,
    SessionStartResponse
)

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
