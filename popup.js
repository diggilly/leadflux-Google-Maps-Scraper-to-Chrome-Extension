// popup.js
document.addEventListener('DOMContentLoaded', async () => {
  const countEl = document.getElementById('count');
  
  // Get current count
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) {
    const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_COUNT' });
    countEl.textContent = response?.count || 0;
  }

  document.getElementById('openMaps').onclick = () => {
    chrome.tabs.create({ url: 'https://www.google.com/maps' });
  };

  document.getElementById('exportXLSX').onclick = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, { type: 'EXPORT_XLSX' });
    });
  };

  document.getElementById('exportCSV').onclick = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, { type: 'EXPORT_CSV' });
    });
  };

  document.getElementById('exportJSON').onclick = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, { type: 'EXPORT_JSON' });
    });
  };

  document.getElementById('clearData').onclick = () => {
    if (confirm('Clear all collected data?')) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'CLEAR_DATA' });
        countEl.textContent = '0';
      });
    }
  };
});
