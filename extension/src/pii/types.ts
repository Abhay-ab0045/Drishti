export interface PIIDetection {
  type: 'PASSWORD_FIELD' | 'EMAIL' | 'PHONE' | 'CREDIT_CARD' | 'AADHAAR' | 'PAN' | 'FACE_IMAGE' | 'SENSITIVE_LABEL_IMAGE';
  source: 'dom_attribute' | 'regex_text' | 'visual';
  location: { domPath: string } | { boundingBox: [number, number, number, number] };
  confidence: number; // 0–1
}
