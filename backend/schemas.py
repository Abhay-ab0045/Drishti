from pydantic import BaseModel, Field
from typing import List, Tuple, Union, Literal

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
