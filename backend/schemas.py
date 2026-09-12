from pydantic import BaseModel, Field
from typing import List, Tuple, Union, Literal, Optional

class VisionDetection(BaseModel):
    type: str
    boundingBox: Tuple[float, float, float, float]
    confidence: float = Field(ge=0.0, le=1.0)

class DomPathLocation(BaseModel):
    domPath: str

class BoundingBoxLocation(BaseModel):
    boundingBox: Tuple[float, float, float, float]

class PIIDetection(BaseModel):
    type: Literal[
        'PASSWORD_FIELD',
        'EMAIL',
        'PHONE',
        'CREDIT_CARD',
        'AADHAAR',
        'PAN',
        'FACE_IMAGE',
        'SENSITIVE_LABEL_IMAGE'
    ]
    source: Literal['dom_attribute', 'regex_text', 'visual']
    location: Union[DomPathLocation, BoundingBoxLocation]
    confidence: float = Field(ge=0.0, le=1.0)

class RedactionPayload(BaseModel):
    detections: List[PIIDetection]

class SessionStartRequest(BaseModel):
    targetUrl: str
    timestamp: float

class SessionStartResponse(BaseModel):
    sessionId: str
    status: str

# ===== Phase 7: VLM Action Planning =====

class ActionPlanRequest(BaseModel):
    image_base64: str
    task_goal: str
    context_url: Optional[str] = None

class ActionTarget(BaseModel):
    selector: Optional[str] = None
    text_hint: Optional[str] = None

class ActionPlanResponse(BaseModel):
    action: Literal["click", "type", "scroll", "navigate", "wait", "respond"]
    target: Optional[ActionTarget] = None
    value: Optional[str] = None
    confidence: float = Field(ge=0.0, le=1.0)
    reasoning: str

