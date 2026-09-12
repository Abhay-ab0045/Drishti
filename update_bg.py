import sys

with open('extension/src/background/background.ts', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    'chrome.runtime.onMessage.addListener((rawMessage: any, _sender, sendResponse) => {',
    'chrome.runtime.onMessage.addListener((rawMessage: any, sender, sendResponse) => {'
)

# Fix TRIGGER_VISION_SCAN
content = content.replace(
    "const tabId = message.tabId;\n        console.log('[Drishti:Background] Received TRIGGER_VISION_SCAN for tab:', tabId);",
    "const tabId = sender.tab?.id || ('tabId' in message ? message.tabId : undefined);\n        console.log('[Drishti:Background] Received TRIGGER_VISION_SCAN for tab:', tabId);"
)

# Fix TRIGGER_PII_SCAN
content = content.replace(
    "const tabId = message.tabId;\n        console.log('[Drishti:Background] Received TRIGGER_PII_SCAN for tab:', tabId);",
    "const tabId = sender.tab?.id || ('tabId' in message ? message.tabId : undefined);\n        console.log('[Drishti:Background] Received TRIGGER_PII_SCAN for tab:', tabId);"
)

# Fix TRIGGER_REDACTION
content = content.replace(
    "      else if (message.type === 'TRIGGER_REDACTION') {\n        const tabId = message.tabId;",
    "      else if (message.type === 'TRIGGER_REDACTION') {\n        const tabId = sender.tab?.id || ('tabId' in message ? message.tabId : undefined);"
)

# Fix TRIGGER_REMOVE_REDACTION
content = content.replace(
    "      else if (message.type === 'TRIGGER_REMOVE_REDACTION') {\n        const tabId = message.tabId;",
    "      else if (message.type === 'TRIGGER_REMOVE_REDACTION') {\n        const tabId = sender.tab?.id || ('tabId' in message ? message.tabId : undefined);"
)

# Fix TRIGGER_AGENT_CYCLE
content = content.replace(
    "      else if (message.type === 'TRIGGER_AGENT_CYCLE') {\n        const tabId = message.tabId;",
    "      else if (message.type === 'TRIGGER_AGENT_CYCLE') {\n        const tabId = sender.tab?.id || ('tabId' in message ? message.tabId : undefined);"
)

with open('extension/src/background/background.ts', 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated background.ts successfully")
