# LeadFlux Google Maps Scraper - Chrome Extension

A Chrome extension that scrapes business data from Google Maps and sends it directly to your LeadFlux system.

## Features

- **Auto-Scroll**: Automatically scrolls through Google Maps search results to scrape more businesses
- **Data Capture**: Captures business name, address, phone, website, ratings, reviews, categories, and more
- **Export Options**: Export scraped data as JSON or CSV
- **Direct Integration**: Send data directly to your LeadFlux API endpoint
- **Duplicate Detection**: Automatically skips or updates existing contacts
- **Configurable Settings**: Adjust scroll speed, intervals, and enable optional features

## Installation

### Step 1: Load the Extension in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top right)
3. Click **Load unpacked**
4. Select the `leadflux-chrome-extension` folder
5. The extension icon should appear in your toolbar

### Step 2: Configure Your LeadFlux API

1. Click the extension icon to open the popup
2. Go to the **Settings** tab
3. Enter your LeadFlux API URL:
   ```
   https://your-leadflux-site.com/api/scraper/import
   ```
4. Optionally enter an API key if your system requires it
5. Click **Save Settings**

### Step 3: Set Up LeadFlux Backend

1. **Copy the ScraperController** to your controllers:
   ```bash
   cp leadflux_ScraperController.php /path/to/your/app/Controllers/ScraperController.php
   ```

2. **Add routes** to your Router.php:
   ```php
   $this->post('/api/scraper/import', ['\\App\\Controllers\\ScraperController', 'import']);
   $this->post('/api/scraper/preview', ['\\App\\Controllers\\ScraperController', 'preview']);
   $this->get('/api/scraper/history', ['\\App\\Controllers\\ScraperController', 'history']);
   ```

3. **Run the database migration**:
   ```bash
   mysql -u your_user -p your_database < scraper_tables_migration.sql
   ```

## Usage

### Scraping Data

1. Navigate to [Google Maps](https://www.google.com/maps)
2. Search for businesses (e.g., "restaurants in New York")
3. Click the extension icon or use the control buttons injected into the Google Maps page
4. Click **Start Auto Scroll** to automatically scroll and capture business data
5. Watch the record count increase as businesses are scraped

### Exporting Data

- **JSON**: Click "Export JSON" to download data as a JSON file
- **CSV**: Click "Export CSV" to download data as a CSV spreadsheet

### Sending to LeadFlux

1. Make sure your API URL is configured in Settings
2. Enter a **Contact Group Name** (e.g., "New York Restaurants")
3. Click **Send to LeadFlux**
4. Data will be imported into your LeadFlux contacts database

## Data Fields Captured

| Field | Description |
|-------|-------------|
| `name` | Business name |
| `fullAddress` | Full street address |
| `phones` | Phone number(s) |
| `website` | Business website URL |
| `averageRating` | Google rating (0-5) |
| `reviewCount` | Number of reviews |
| `categories` | Business categories |
| `emails` | Email addresses (if extraction enabled) |
| `latitude` | GPS latitude |
| `longitude` | GPS longitude |
| `placeId` | Google Place ID |
| `googleMapsURL` | Direct link to Google Maps listing |

## Settings

### Scroll Settings
- **Scroll Speed**: Pixels to scroll per second (default: 1000)
- **Scroll Interval**: Random seconds between scrolls (default: 5-10)

### Extra Features
- **Email Extraction**: Attempts to extract emails from business websites (slower)
- **Plus Code Extraction**: Get Google Plus Codes for precise location

## API Endpoint Specification

### POST /api/scraper/import

**Request Body:**
```json
{
  "data": [
    {
      "name": "Business Name",
      "fullAddress": "123 Main St, City, State",
      "phones": "+1234567890",
      "website": "https://example.com",
      "averageRating": "4.5",
      "reviewCount": "100",
      "categories": "Restaurant, Food",
      "emails": "",
      "plusCode": "",
      "latitude": "12.3456",
      "longitude": "-78.9012",
      "placeId": "ChIJ...",
      "googleMapsURL": "https://www.google.com/maps?cid=..."
    }
  ],
  "groupName": "Google Maps Import - 2024-01-15",
  "source": "google_maps_scraper",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Import completed successfully",
  "imported": 45,
  "skipped": 5,
  "errors": [],
  "groupId": 123
}
```

## Troubleshooting

### Extension Not Working
- Make sure you're on a Google Maps search results page
- Check that the URL contains `/maps/search/`
- Try refreshing the page

### No Data Being Captured
- Google Maps may have changed their data structure
- Check the browser console for errors
- Try a different search query

### API Import Failing
- Verify your API URL is correct and accessible
- Check if your LeadFlux site uses HTTPS
- Ensure you're logged in to LeadFlux
- Check server error logs

## Security Notes

- The extension only works on Google Maps pages
- API keys are stored locally in Chrome storage
- Data is sent over HTTPS only
- Authentication is handled via session cookies

## Files Structure

```
leadflux-chrome-extension/
├── manifest.json          # Extension configuration
├── content.js             # Main scraping logic
├── content-styles.css     # Injected UI styles
├── popup.html             # Extension popup HTML
├── popup.css              # Popup styles
├── popup.js               # Popup logic
├── background.js          # Service worker
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## License

This extension is part of the LeadFlux lead management system.

## Support

For issues and feature requests, please contact the LeadFlux development team.
