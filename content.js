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
      // Update existing item
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

// Initialize
const dataManager = new DataManager();
const autoScrollManager = new AutoScrollManager();

// Inject UI Buttons
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
    container.style.marginLeft = '20px';
    container.style.display = 'inline-flex';
    container.style.gap = '10px';

    const exportBtn = document.createElement('button');
    exportBtn.className = 'scraper-btn scraper-btn-primary';
    exportBtn.textContent = `Export Data (0)`;
    exportBtn.id = 'export-data-btn';
    
    const scrollBtn = document.createElement('button');
    scrollBtn.className = 'scraper-btn scraper-btn-secondary';
    scrollBtn.textContent = 'Start Auto Scroll';
    scrollBtn.id = 'auto-scroll-btn';

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

    container.appendChild(exportBtn);
    container.appendChild(scrollBtn);
    targetDiv.appendChild(container);
  }
}

// Observe DOM for button injection
const observer = new MutationObserver(() => {
  injectButtons();
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'NEW_DATA') {
    request.items.forEach(item => dataManager.addItem(item));
  }
  if (request.type === 'CLEAR_DATA') {
    dataManager.clearData();
  }
  if (request.type === 'GET_COUNT') {
    sendResponse({ count: dataManager.getCount() });
  }
  return true;
});

// Initial button injection
setTimeout(injectButtons, 2000);
