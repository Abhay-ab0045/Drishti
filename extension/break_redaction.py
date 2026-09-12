import sys

with open('src/content-scripts/content.ts', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    "pii_detected_count = piiResponse.detections.length;",
    "piiResponse.detections.push({ source: 'DOM', type: 'AADHAAR', location: { domPath: '#fake_broken_id' }, confidence: 0.99, value: 'fake' }); pii_detected_count = piiResponse.detections.length;"
)

with open('src/content-scripts/content.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print("Injected fake detection into content.ts")
