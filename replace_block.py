import sys
import re

with open('extension/src/background/background.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Define the start and end of the block
start_marker = "else if (message.type === 'TRIGGER_AGENT_CYCLE') {"
end_marker = "setState('COMPLETE', 'Action plan ready');"

start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

if start_idx == -1 or end_idx == -1:
    print("Could not find block")
    sys.exit(1)

# Find the full block ending with sendResponse
end_idx = content.find("sendResponse({ success: true, plan });", end_idx) + len("sendResponse({ success: true, plan });")
# find the closing brace
end_idx = content.find("}", end_idx) + 1

new_block = """else if (message.type === 'TRIGGER_AGENT_CYCLE') {
        const tabId = sender.tab?.id || ('tabId' in message ? message.tabId : undefined);
        if (!tabId) {
          sendResponse({ success: false, error: 'No tabId provided' });
          return;
        }
        
        const tracker = new TelemetryTracker();
        const incomingTelemetry = (message as any).telemetry || {};
        tracker.setDuration('dom_scan_ms', incomingTelemetry.dom_scan_ms || 0);
        tracker.setDuration('vision_inference_ms', incomingTelemetry.vision_inference_ms || 0);
        tracker.setDuration('redaction_paint_ms', incomingTelemetry.redaction_paint_ms || 0);

        setState('DETECTING', 'Capturing screen and calling VLM...');
        
        // Brief wait to ensure UI updates are painted
        await new Promise(r => setTimeout(r, 100));
        
        tracker.start('screenshot_capture_ms');
        const dataUrl = await chrome.tabs.captureVisibleTab(
          chrome.windows.WINDOW_ID_CURRENT,
          { format: 'jpeg', quality: 85 }
        );
        tracker.stop('screenshot_capture_ms');
        
        const base64Image = dataUrl.split(',')[1];
        
        tracker.start('vlm_roundtrip_ms');
        const apiResponse = await fetch('http://127.0.0.1:8000/api/v1/plan/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image_base64: base64Image,
            task_goal: message.task_goal
          })
        });

        if (!apiResponse.ok) {
          throw new Error(API error: );
        }

        const plan = await apiResponse.json();
        tracker.stop('vlm_roundtrip_ms');
        
        await tracker.finalizeAndSave();

        setState('COMPLETE', 'Action plan ready');
        sendResponse({ success: true, plan });
      }"""

content = content[:start_idx] + new_block + content[end_idx:]

with open('extension/src/background/background.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print("Block replaced successfully")
