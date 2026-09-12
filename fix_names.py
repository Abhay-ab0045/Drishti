import sys

# Replace in schemas.ts
with open('extension/src/types/schemas.ts', 'r', encoding='utf-8') as f:
    content = f.read()
content = content.replace("type: z.literal('TRIGGER_AGENT_CYCLE_CONTENT')", "type: z.literal('RUN_AGENT_CYCLE')")
with open('extension/src/types/schemas.ts', 'w', encoding='utf-8') as f:
    f.write(content)

# Replace in popup.ts
with open('extension/src/popup/popup.ts', 'r', encoding='utf-8') as f:
    content = f.read()
content = content.replace("type: \"TRIGGER_AGENT_CYCLE_CONTENT\"", "type: 'RUN_AGENT_CYCLE'")
with open('extension/src/popup/popup.ts', 'w', encoding='utf-8') as f:
    f.write(content)

# Replace in content.ts
with open('extension/src/content-scripts/content.ts', 'r', encoding='utf-8') as f:
    content = f.read()
content = content.replace("message.type === 'TRIGGER_AGENT_CYCLE_CONTENT'", "message.type === 'RUN_AGENT_CYCLE'")
with open('extension/src/content-scripts/content.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated schemas, popup, and content successfully to use RUN_AGENT_CYCLE")
