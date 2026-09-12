export interface TelemetryReport {
  dom_scan_ms: number;
  vision_inference_ms: number;
  redaction_paint_ms: number;
  screenshot_capture_ms: number;
  vlm_roundtrip_ms: number;
  total_latency_ms: number;
  pii_detected_count: number;
  pii_redacted_count: number;
  redaction_completeness_pct: number;
  timestamp: number;
}

export class TelemetryTracker {
  private startTimes: Record<string, number> = {};
  private durations: Partial<TelemetryReport> = {};
  private counts: { detected: number, redacted: number } = { detected: 0, redacted: 0 };

  start(stage: keyof TelemetryReport) {
    this.startTimes[stage] = performance.now();
  }

  stop(stage: keyof TelemetryReport) {
    if (this.startTimes[stage]) {
      this.durations[stage] = performance.now() - this.startTimes[stage];
    }
  }

  setCounts(detected: number, redacted: number) {
    this.counts.detected = detected;
    this.counts.redacted = redacted;
  }

  setDuration(stage: keyof TelemetryReport, duration: number) {
    this.durations[stage] = duration;
  }

  async finalizeAndSave(): Promise<TelemetryReport> {
    const report: TelemetryReport = {
      dom_scan_ms: this.durations.dom_scan_ms || 0,
      vision_inference_ms: this.durations.vision_inference_ms || 0,
      redaction_paint_ms: this.durations.redaction_paint_ms || 0,
      screenshot_capture_ms: this.durations.screenshot_capture_ms || 0,
      vlm_roundtrip_ms: this.durations.vlm_roundtrip_ms || 0,
      total_latency_ms: 0,
      pii_detected_count: this.counts.detected,
      pii_redacted_count: this.counts.redacted,
      redaction_completeness_pct: this.counts.detected === 0 ? 100 : (this.counts.redacted / this.counts.detected) * 100,
      timestamp: Date.now()
    };

    report.total_latency_ms = 
      report.dom_scan_ms + 
      report.vision_inference_ms + 
      report.redaction_paint_ms + 
      report.screenshot_capture_ms + 
      report.vlm_roundtrip_ms;

    await chrome.storage.local.set({ drishti_last_telemetry: report });
    return report;
  }
}
