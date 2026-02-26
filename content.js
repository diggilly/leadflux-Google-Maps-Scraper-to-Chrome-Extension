// content.js
class DataManager {
  constructor() {
    this.data = new Map();
    this.errorLog = [];
    this.defaultFields = new Set([
      'name', 'fullAddress', 'phones', 'website',
      'averageRating', 'reviewCount', 'categories', 'emails', 'plusCode'
    ]);
    this.selectedFields = new Set(this.defaultFields);
    this.loadSelectedFields();
  }

  async loadSelectedFields() {
    const result = await chrome.storage.local.get('selectedFields');
    if (result.selectedFields) {
      this.selectedFields = new Set(result.selectedFields);
    }
  }

  async saveSelectedFields() {
    await chrome.storage.local.set({
      selectedFields: Array.from(this.selectedFields)
    });
  }

  addItem(item) {
    if (!item || !item.placeId) {
      console.log('Skipping item: Missing placeId');
      return;
    }
    const isDuplicate = this.data.has(item.placeId);
    if (isDuplicate) {
      console.log(`Duplicate record found - placeId: ${item.placeId}`);
      const existingItem = this.data.get(item.placeId);
      Object.assign(existingItem, item);
      this.data.set(item.placeId, existingItem);
    } else {
      console.log(`New record added - placeId: ${item.placeId}, name: ${item.name}`);
      this.data.set(item.placeId, item);
    }
    this.updateCount();
  }

  updateCount() {
    chrome.runtime.sendMessage({
      type: 'UPDATE_COUNT',
      count: this.data.size
    });
  }

  getItems() {
    return Array.from(this.data.values());
  }

  getCount() {
    return this.data.size;
  }

  getSelectedFields() {
    return Array.from(this.selectedFields);
  }

  async setSelectedFields(fields) {
    this.selectedFields = new Set(fields);
    await this.saveSelectedFields();
  }

  getPreviewData(limit = 5) {
    return this.getItems().slice(0, limit);
  }

  clearData() {
    this.data.clear();
    this.errorLog = [];
    this.updateCount();
  }

  prepareData() {
    const data = this.getItems().map(item => {
      const filteredItem = {};
      this.getSelectedFields().forEach(field => {
        filteredItem[field] = item[field];
      });
      return filteredItem;
    });
    return data;
  }
}

class AutoScrollManager {
  constructor() {
    this.scrollTimer = null;
    this.countdownTimer = null;
    this.isLoading = false;
    this.config = {
      scrollSpeed: 1000,
      scrollInterval: { min: 5, max: 10 }
    };
    this.loadConfig();
    this.createCountdownDisplay();
  }

  async loadConfig() {
    const result = await chrome.storage.local.get('scraperConfig');
    if (result.scraperConfig) {
      this.config = { ...this.config, ...result.scraperConfig };
    }
  }

  createCountdownDisplay() {
    this.countdownDisplay = document.createElement('div');
    this.countdownDisplay.className = 'countdown-display';
    this.countdownDisplay.style.cssText = `
      display: none;
      position: fixed;
      top: 10px;
      right: 10px;
      background: rgba(0,0,0,0.7);
      color: white;
      padding: 5px 10px;
      border-radius: 4px;
      font-size: 12px;
      z-index: 9999;
    `;
    document.body.appendChild(this.countdownDisplay);
  }

  startCountdown(seconds) {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
    }
    this.countdownDisplay.style.display = 'block';
    let remainingSeconds = seconds;
    
    const updateDisplay = () => {
      this.countdownDisplay.textContent = `Next scroll in ${remainingSeconds}s`;
      if (remainingSeconds <= 0) {
        clearInterval(this.countdownTimer);
        this.countdownTimer = null;
      }
      remainingSeconds--;
    };
    
    updateDisplay();
    this.countdownTimer = setInterval(updateDisplay, 1000);
  }

  getRandomInteger(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  checkIfReachedEnd() {
    const elScroll = document.querySelector('[role="feed"]');
    if (!elScroll) return false;
    const lastChild = elScroll.lastElementChild;
    return lastChild && lastChild.getAttribute('style')?.includes('height: 64px');
  }

  scroll() {
    const elScroll = document.querySelector('[role="feed"]');
    if (!elScroll) {
      console.warn("Scrollable element not found. Stopping auto-scroll.");
      this.stop();
      return;
    }

    elScroll.scrollBy({
      top: this.config.scrollSpeed,
      behavior: 'smooth'
    });

    if (this.checkIfReachedEnd()) {
      console.log("Reached end of results.");
      this.stop();
      return;
    }

    const nextInterval = this.getRandomInteger(
      this.config.scrollInterval.min,
      this.config.scrollInterval.max
    );
    
    this.startCountdown(nextInterval);
    this.scrollTimer = setTimeout(() => this.scroll(), nextInterval * 1000);
  }

  start() {
    if (this.isLoading) return;
    
    if (this.checkIfReachedEnd()) {
      alert('Already reached the end of results.');
      return;
    }
    
    this.isLoading = true;
    chrome.runtime.sendMessage({ type: 'SCROLL_STARTED' });
    
    const firstInterval = this.getRandomInteger(
      this.config.scrollInterval.min,
      this.config.scrollInterval.max
    );
    
    this.startCountdown(firstInterval);
    this.scrollTimer = setTimeout(() => this.scroll(), firstInterval * 1000);
  }

  stop() {
    if (this.scrollTimer) {
      clearTimeout(this.scrollTimer);
      this.scrollTimer = null;
    }
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
    this.isLoading = false;
    this.countdownDisplay.style.display = 'none';
    chrome.runtime.sendMessage({ type: 'SCROLL_STOPPED' });
  }
}

// ============================================
// 🔥 XHR INTERCEPTION (Core Functionality)
// ============================================

class XHRInterceptor {
  constructor(dataManager) {
    this.dataManager = dataManager;
    this.originalOpen = XMLHttpRequest.prototype.open;
    this.originalSend = XMLHttpRequest.prototype.send;
    this.originalAbort = XMLHttpRequest.prototype.abort;
    this.intercept();
  }

  intercept() {
    const self = this;

    // Override XMLHttpRequest.open
    XMLHttpRequest.prototype.open = function(method, url) {
      this._url = url;
      return self.originalOpen.apply(this, arguments);
    };

    // Override XMLHttpRequest.send
    XMLHttpRequest.prototype.send = function() {
      const xhr = this;
      const isTargetUrl = this._url && 
        this._url.includes('/search') && 
        this._url.includes('tbm=map');

      if (isTargetUrl) {
        console.log('🎯 [TARGET] Intercepting API call:', this._url);
      }

      // Add readyState listener
      this.addEventListener('readystatechange', function() {
        if (isTargetUrl && this.readyState === 4) {
          console.log('📡 [TARGET] Response received:', this.status);
        }
      });

      // Add load listener to process response
      this.addEventListener('load', function() {
        if (this._url && this._url.includes('/search?tbm=map')) {
          try {
            self.processResponse(this.responseText);
          } catch (error) {
            console.error('Error processing response:', error);
          }
        }
      });

      // Override abort to capture data before cancellation
      const originalAbort = this.abort;
      this.abort = function() {
        if (isTargetUrl && this.responseText && this.responseText.length > 0) {
          console.log('💾 [TARGET] Capturing data before abort...');
          try {
            self.processResponse(this.responseText);
          } catch (error) {
            console.error('Error capturing data before abort:', error);
          }
        }
        return originalAbort.apply(this, arguments);
      };

      return self.originalSend.apply(this, arguments);
    };
  }

  processResponse(responseText) {
    try {
      // Clean the response (Google adds prefix to prevent JSON hijacking)
      let cleanedData = responseText.replace(`/*""*/`, '');
      cleanedData = cleanedData.replace(`)]}'`, '');
      
      const parsedData = JSON.parse(cleanedData);
      
      // Extract business data from different possible locations
      let dataList = parsedData[0]?.[1] || parsedData[64];
      
      if (!dataList || !Array.isArray(dataList)) {
        console.warn('No valid data found in response');
        return;
      }

      // Filter valid items
      let filteredData = dataList.filter(item => item?.[14] !== undefined);
      
      if (!filteredData || filteredData.length < 1) {
        filteredData = dataList;
      }

      if (filteredData) {
        const formattedData = this.formatAllData(filteredData);
        formattedData.forEach(item => this.dataManager.addItem(item));
        console.log(`✅ Processed ${formattedData.length} items. Total: ${this.dataManager.getCount()}`);
        
        // Update button text
        const exportBtn = document.getElementById('export-data-btn');
        if (exportBtn) {
          exportBtn.textContent = `Export Data (${this.dataManager.getCount()})`;
        }
      }
    } catch (error) {
      console.error('Error parsing Google Maps response:', error);
    }
  }

  formatAllData(allDataList) {
    return allDataList.map(d => this.formatDataItem(d)).filter(d => d?.name);
  }

  formatDataItem(item) {
    const fieldConfig = {
      fullAddress: [39],
      placeId: [78],
      kgmid: [89],
      categories: [13],
      cid: [10],
      name: [11],
      latitude: [9, 2],
      longitude: [9, 3],
      reviewCount: [4, 8],
      averageRating: [4, 7],
      phones: [],
      website: [7, 0],
      emails: [],
      plusCode: []
    };

    const resultData = {};
    
    Object.keys(fieldConfig).forEach(key => {
      resultData[key] = this.handleSingleField(item, fieldConfig[key]);
    });

    // Process special fields
    resultData.phones = this.handleSingleField(item, [178, 0, 1])?.map(d => d?.[0]) || [];
    resultData.categories = resultData.categories || [];
    
    // Format array fields
    resultData.phones = resultData.phones?.join?.(', ') || '';
    resultData.categories = resultData.categories?.join?.(', ') || '';
    
    // Generate URLs
    resultData.googleMapsURL = resultData.cid ? 
      `https://www.google.com/maps?cid=${resultData.cid}` : '';
    resultData.googleKnowledgeURL = resultData.kgmid ? 
      `https://www.google.com/maps/search/*?kgmid=${resultData.kgmid}&kponly` : '';

    // Fetch emails and plus codes asynchronously (optional)
    this.fetchAdditionalData(resultData);

    return resultData;
  }

  handleSingleField(item, config) {
    const itemData = item[1];
    if (!itemData || !config || !config.length) {
      return;
    }
    let currentData = itemData;
    for (let i = 0; i < config.length; i++) {
      currentData = currentData?.[config[i]];
    }
    return currentData;
  }

  async fetchAdditionalData(data) {
    // Email extraction (if enabled)
    if (data.website) {
      const config = await chrome.storage.local.get('scraperConfig');
      if (config.scraperConfig?.emailExtraction?.enabled) {
        try {
          const response = await fetch(`https://g2.converts.workers.dev/${data.website}`);
          if (response.status === 200) {
            const emailData = await response.json();
            data.emails = emailData.emails?.join(', ') || '';
            this.updateExistingItem(data);
          }
        } catch (error) {
          console.error('Email extraction error:', error);
        }
      }
    }

    // Plus Code extraction (if enabled)
    if (data.latitude && data.longitude) {
      const config = await chrome.storage.local.get('scraperConfig');
      if (config.scraperConfig?.plusCodeExtraction?.enabled) {
        try {
          const response = await fetch(
            `https://plus.codes/api?address=${data.latitude},${data.longitude}&format=json`
          );
          if (response.status === 200) {
            const plusData = await response.json();
            data.plusCode = plusData.plus_code?.global_code || '';
            this.updateExistingItem(data);
          }
        } catch (error) {
          console.error('Plus code extraction error:', error);
        }
      }
    }
  }

  updateExistingItem(data) {
    if (data.placeId) {
      const existingItem = this.dataManager.data.get(data.placeId);
      if (existingItem) {
        Object.assign(existingItem, data);
        this.dataManager.data.set(data.placeId, existingItem);
      }
    }
  }
}

// ============================================
// 🎨 UI Injection
// ============================================

function injectButtons() {
  const targetDiv = document.evaluate(
    "//button[contains(@class, 'e2moi') and not(contains(@jsaction, 'ripple')) and @aria-haspopup='menu']/../..",
    document,
    null,
    XPathResult.FIRST_ORDERED_NODE_TYPE,
    null
  ).singleNodeValue;

  if (targetDiv && !document.getElementById('scraper-button-container')) {
    const container = document.createElement('div');
    container.id = 'scraper-button-container';
    container.style.cssText = 'margin-left: 20px; display: inline-flex; gap: 10px;';

    const exportBtn = document.createElement('button');
    exportBtn.className = 'scraper-btn scraper-btn-primary';
    exportBtn.textContent = `Export Data (0)`;
    exportBtn.id = 'export-data-btn';
    
    const scrollBtn = document.createElement('button');
    scrollBtn.className = 'scraper-btn scraper-btn-secondary';
    scrollBtn.textContent = 'Start Auto Scroll';
    scrollBtn.id = 'auto-scroll-btn';

    const configBtn = document.createElement('button');
    configBtn.className = 'scraper-btn scraper-btn-secondary';
    configBtn.textContent = '⚙️ Settings';
    configBtn.id = 'config-btn';

    exportBtn.onclick = () => {
      chrome.runtime.sendMessage({ 
        type: 'OPEN_EXPORT_MODAL',
        data: dataManager.getItems(),
        fields: dataManager.getSelectedFields()
      });
    };

    scrollBtn.onclick = () => {
      if (autoScrollManager.isLoading) {
        autoScrollManager.stop();
        scrollBtn.textContent = 'Start Auto Scroll';
        scrollBtn.classList.remove('scraper-btn-danger');
        scrollBtn.classList.add('scraper-btn-secondary');
      } else {
        autoScrollManager.start();
        scrollBtn.textContent = 'Stop Auto Scroll';
        scrollBtn.classList.remove('scraper-btn-secondary');
        scrollBtn.classList.add('scraper-btn-danger');
      }
    };

    configBtn.onclick = () => {
      chrome.runtime.sendMessage({ type: 'OPEN_SETTINGS' });
    };

    container.appendChild(exportBtn);
    container.appendChild(scrollBtn);
    container.appendChild(configBtn);
    targetDiv.appendChild(container);
  }
}

// ============================================
// 🚀 Initialize
// ============================================

const dataManager = new DataManager();
const autoScrollManager = new AutoScrollManager();
const xhrInterceptor = new XHRInterceptor(dataManager);

// Observe DOM for button injection
const observer = new MutationObserver(() => {
  injectButtons();
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});

// Listen for messages from background/popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'CLEAR_DATA') {
    dataManager.clearData();
    sendResponse({ success: true });
  }
  if (request.type === 'GET_COUNT') {
    sendResponse({ count: dataManager.getCount() });
  }
  if (request.type === 'GET_DATA') {
    sendResponse({ 
      data: dataManager.getItems(),
      fields: dataManager.getSelectedFields()
    });
  }
  if (request.type === 'EXPORT_XLSX' || request.type === 'EXPORT_CSV' || request.type === 'EXPORT_JSON') {
    handleExport(request.type);
    sendResponse({ success: true });
  }
  return true;
});

// Export functionality
function handleExport(type) {
  const data = dataManager.prepareData();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  let content, filename, mimeType;

  if (type === 'EXPORT_XLSX') {
    // You'll need to include XLSX library or use background script
    filename = `google_maps_${timestamp}.xlsx`;
    mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  } else if (type === 'EXPORT_CSV') {
    content = convertToCSV(data);
    filename = `google_maps_${timestamp}.csv`;
    mimeType = 'text/csv';
  } else {
    content = JSON.stringify(data, null, 2);
    filename = `google_maps_${timestamp}.json`;
    mimeType = 'application/json';
  }

  if (content) {
    downloadFile(content, filename, mimeType);
  }
}

function convertToCSV(data) {
  if (!data || data.length === 0) return '';
  const headers = Object.keys(data[0]);
  const rows = data.map(obj => 
    headers.map(header => 
      `"${String(obj[header] || '').replace(/"/g, '""')}"`
    ).join(',')
  );
  return [headers.join(','), ...rows].join('\n');
}

function downloadFile(content, filename, mimeType) {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Initial button injection
setTimeout(injectButtons, 2000);
