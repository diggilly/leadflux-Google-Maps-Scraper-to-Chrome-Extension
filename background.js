// background.js
let collectedData = [];

// Intercept Google Maps API requests
chrome.webRequest.onCompleted.addListener(
  async (details) => {
    if (details.url.includes('/search') && details.url.includes('tbm=map')) {
      try {
        // Fetch the response using chrome.debugger or alternative method
        // Note: webRequest cannot access response body directly in MV3
        // We'll use a different approach below
      } catch (error) {
        console.error('Error processing response:', error);
      }
    }
  },
  {
    urls: [
      '*://*.google.com/maps/search*',
      '*://*.google.*/*/maps/search*'
    ],
    types: ['xmlhttprequest']
  },
  ['responseHeaders']
);

// Alternative: Use chrome.debugger for response body access
// Or inject script to capture XHR responses

// Handle messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'UPDATE_COUNT') {
    chrome.action.setBadgeText({ text: request.count.toString() });
  }
  
  if (request.type === 'SCROLL_STARTED') {
    chrome.action.setBadgeBackgroundColor({ color: '#ff0000' });
  }
  
  if (request.type === 'SCROLL_STOPPED') {
    chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });
  }

  if (request.type === 'EXPORT_DATA') {
    // Handle export logic
    sendResponse({ success: true });
  }

  return true;
});

// Email extraction function
async function fetchEmails(url) {
  try {
    const response = await fetch(`https://g2.converts.workers.dev/${url}`);
    if (response.status !== 200) return [];
    const data = await response.json();
    return data.emails || [];
  } catch (error) {
    console.error('Email extraction error:', error);
    return [];
  }
}

// Plus Code extraction function
async function fetchPlusCode(lat, long) {
  try {
    const response = await fetch(
      `https://plus.codes/api?address=${lat},${long}&format=json`
    );
    if (response.status !== 200) return '';
    const data = await response.json();
    return data.plus_code?.global_code || '';
  } catch (error) {
    console.error('Plus code extraction error:', error);
    return '';
  }
}

// Store data persistently
chrome.storage.local.set({ scraperData: collectedData });
