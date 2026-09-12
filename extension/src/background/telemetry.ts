export interface TelemetryReport {
  dom_scan_ms: number;
  vision_inference_ms: number;
  redaction_paint_ms: number;
  screenshot_capture_ms: number;
  vlm_roundtrip_ms: number;
  total_latency_ms: number;
  timestamp: number;
}

export class TelemetryTracker {
  private startTimes: Record<string, number> = {};
  private durations: Partial<TelemetryReport> = {};

  start(stage: keyof TelemetryReport) {
    this.startTimes[stage] = performance.now();
  }

  stop(stage: keyof TelemetryReport) {
    if (this.startTimes[stage]) {
      this.durations[stage] = performance.now() - this.startTimes[stage];
    }
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
