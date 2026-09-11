/**
 * Drishti \u2014 Core Type Definitions
 * All shared types for the extension pipeline.
 */

// ===== Geometry =====

export interface BoundingBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

// ===== DOM Reader Types =====

export interface DOMSummaryElement {
  /** ARIA role or inferred role */
  role: string;
  /** HTML tag name */
  tag: string;
  /** Resolved label text (aria-label > <label> > placeholder > title) */
  label: string;
  /** Placeholder text if present */
  placeholder?: string;
  /** Input type attribute for <input> elements */
  inputType?: string;
  /** Autocomplete attribute value */
  autocomplete?: string;
  /** Name attribute */
  name?: string;
  /** ID attribute */
  id?: string;
  /** Unique CSS selector path */
  domPath: string;
  /** Bounding rectangle on screen */
  boundingBox: BoundingBox;
  /** Whether element is visible in viewport */
  isVisible: boolean;
  /** Whether element can receive focus */
  isFocusable: boolean;
  /** Whether the field has a non-empty value (checked WITHOUT reading the value) */
  hasValue: boolean;
  /** Text content for non-sensitive elements (buttons, links \u2014 capped at 100 chars) */
  textContent?: string;
  /** Whether this field's value was redacted (set by redaction engine) */
  value_redacted?: boolean;
  /** Redaction type applied (set by redaction engine) */
  redaction_type?: string;
}

export interface FormSummary {
  id?: string;
  name?: string;
  action?: string;
  method?: string;
  fieldCount: number;
  domPath: string;
}

export interface MediaElementInfo {
  tag: 'img' | 'canvas' | 'video';
  src?: string;
  alt?: string;
  domPath: string;
  boundingBox: BoundingBox;
  naturalWidth?: number;
  naturalHeight?: number;
}

export interface PageContext {
  url: string;
  domain: string;
  title: string;
  viewport: { w: number; h: number };
}

export interface DOMReadResult {
  pageContext: PageContext;
  elements: DOMSummaryElement[];
  forms: FormSummary[];
  mediaElements: MediaElementInfo[];
  timing: {
    startMs: number;
    endMs: number;
    durationMs: number;
  };
}

// ===== PII Detection Types =====
// Defined in src/pii/types.ts


// ===== Pipeline State =====

export type PipelineState =
  | 'IDLE'
  | 'SCANNING'
  | 'DETECTING'
  | 'REDACTING'
  | 'VALIDATING'
  | 'TRANSMITTING'
  | 'ACTION_READY'
  | 'EXECUTING'
  | 'COMPLETE'
  | 'ERROR';

export type ExecutionBackend = 'WEBGPU' | 'WASM' | 'DOM_ONLY';

// ===== Messaging =====

export interface ExtensionMessage {
  type: string;
  payload?: unknown;
}

export interface DOMReadRequest extends ExtensionMessage {
  type: 'DOM_READ_REQUEST';
}

export interface DOMReadResponse extends ExtensionMessage {
  type: 'DOM_READ_RESPONSE';
  payload: DOMReadResult;
}

export interface StateUpdate extends ExtensionMessage {
  type: 'STATE_UPDATE';
  payload: {
    state: PipelineState;
    detail?: string;
  };
}

// ===== Vision Pipeline Types =====

/** Strict output schema for all vision detections (face boxes, ViT regions) */
export interface VisionDetection {
  type: string;
  boundingBox: [number, number, number, number]; // [x, y, w, h]
  confidence: number;
}

/** Raw RGBA pixel payload for messaging (no base64) */
export interface ImagePayload {
  buffer: ArrayBuffer;
  width: number;
  height: number;
  domPath?: string;
  sourceType?: 'screenshot' | 'img' | 'canvas' | 'video';
}

