const agentBtn = document.getElementById('agent-btn') as HTMLButtonElement;

agentBtn.addEventListener('click', () => {
  setScanButtonsDisabled(true);
  setStatus('DETECTING', 'Running Agent Cycle...');
  clearError();
  
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs || tabs.length === 0 || !tabs[0].id) {
      console.error("No active tab found.");
      setStatus('ERROR');
      showError(new Error("No active tab found."));
      setScanButtonsDisabled(false);
      return;
    }
    const tabId = tabs[0].id;
    chrome.tabs.sendMessage(tabId, { type: "TRIGGER_AGENT_CYCLE_CONTENT", task_goal: 'Fill out this form' }, (response) => {
      if (chrome.runtime.lastError) {
        console.error("Content script not listening or not injected:", chrome.runtime.lastError.message);
        setStatus('ERROR');
        showError(new Error(chrome.runtime.lastError.message));
        setScanButtonsDisabled(false);
        return;
      }
      
      if (!response?.success) {
        const err = new Error(response?.error || 'Agent cycle failed');
        console.error('[Drishti:Popup] Agent cycle failed:', err);
        setStatus('ERROR');
        showError(err);
      } else {
        setStatus('IDLE');
      }
      setScanButtonsDisabled(false);
    });
  });
});
