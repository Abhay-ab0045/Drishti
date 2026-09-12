import sys

with open('src/popup/popup.ts', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    "chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {",
    "chrome.tabs.query({ url: '*://localhost/*' }, (tabs) => {"
)
content = content.replace(
    "let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });",
    "let [tab] = await chrome.tabs.query({ url: '*://localhost/*' });"
)

with open('src/popup/popup.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print("Patched popup.ts for testing")
