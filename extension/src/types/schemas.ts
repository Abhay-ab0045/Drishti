import { z } from 'zod';

// ===== Vision Detection Schema =====
export const VisionDetectionSchema = z.object({
  type: z.string(), // e.g. 'FACE'
  boundingBox: z.tuple([z.number(), z.number(), z.number(), z.number()]), // [x, y, w, h]
  confidence: z.number().min(0).max(1),
});

export type VisionDetection = z.infer<typeof VisionDetectionSchema>;

// ===== PII Detection Schema =====
export const PIIDetectionSchema = z.object({
  type: z.enum([
    'PASSWORD_FIELD',
    'EMAIL',
    'PHONE',
    'CREDIT_CARD',
    'AADHAAR',
    'PAN',
    'FACE_IMAGE',
    'SENSITIVE_LABEL_IMAGE'
  ]),
  source: z.enum(['dom_attribute', 'regex_text', 'visual']),
  location: z.union([
    z.object({ domPath: z.string() }),
    z.object({ boundingBox: z.tuple([z.number(), z.number(), z.number(), z.number()]) })
  ]),
  confidence: z.number().min(0).max(1),
});

export type PIIDetection = z.infer<typeof PIIDetectionSchema>;

// ===== Redaction Payload Schema =====
export const RedactionPayloadSchema = z.object({
  detections: z.array(PIIDetectionSchema),
});

export type RedactionPayload = z.infer<typeof RedactionPayloadSchema>;

// ===== Action Plan Schemas =====
export const ActionTargetSchema = z.object({
  selector: z.string().nullable().optional(),
  text_hint: z.string().nullable().optional(),
});

export const ActionPlanResponseSchema = z.object({
  action: z.enum(['click', 'type', 'scroll', 'navigate', 'wait', 'respond']),
  target: ActionTargetSchema.nullable().optional(),
  value: z.string().nullable().optional(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string()
});
export type ActionPlanResponse = z.infer<typeof ActionPlanResponseSchema>;

// ===== Message Envelope Schema =====
export const MessageEnvelopeSchema = z.discriminatedUnion('type', [
  // Content Script actions
  z.object({ type: z.literal('DOM_READ_REQUEST') }),
  z.object({ type: z.literal('CAPTURE_IMAGES') }),
  z.object({ type: z.literal('RUN_PII_DETECTION') }),
  z.object({ type: z.literal('APPLY_REDACTIONS'), detections: z.array(PIIDetectionSchema) }),
  z.object({ type: z.literal('REMOVE_REDACTIONS') }),
  z.object({ type: z.literal('RUN_AGENT_CYCLE'), task_goal: z.string() }),

  // Background actions
  z.object({ type: z.literal('TRIGGER_VISION_SCAN'), tabId: z.number().optional() }),
  z.object({ type: z.literal('TRIGGER_PII_SCAN'), tabId: z.number().optional() }),
  z.object({ type: z.literal('TRIGGER_REDACTION'), tabId: z.number().optional() }),
  z.object({ type: z.literal('TRIGGER_REMOVE_REDACTION'), tabId: z.number().optional() }),
  z.object({ type: z.literal('TRIGGER_AGENT_CYCLE'), tabId: z.number().optional(), task_goal: z.string() }),
  z.object({ type: z.literal('INIT_VISION') }),
  z.object({ type: z.literal('GET_STATE') }),
  
  // State updates to popup
  z.object({ 
    type: z.literal('STATE_UPDATE'), 
    payload: z.object({
      state: z.string(),
      detail: z.string().optional()
    }).optional()
  })
]);

export type MessageEnvelope = z.infer<typeof MessageEnvelopeSchema>;
// ===== Offscreen Document Schemas =====
export const OffscreenMessageSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('INIT_PIPELINE') }),
  z.object({ action: z.literal('DETECT_FACES'), imageParams: z.object({ dataUrl: z.string() }) })
]);

export type OffscreenMessage = z.infer<typeof OffscreenMessageSchema>;
