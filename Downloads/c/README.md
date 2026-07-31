# chrome-extension (Gmail Inbox Labeler)

Chrome Extension that adds a small, native-feeling label UI next to each email subject in Gmail’s inbox. Labels persist locally (no backend, no API calls).

## What it does

- Detects inbox rows in Gmail and injects a small pill UI next to the subject
- Lets you label each email with:
  - None
  - Follow up
  - Later
  - Important
- Persists labels in `chrome.storage.local` so they survive reloads and Gmail navigation

## How to load (unpacked)

1. Open Chrome → `chrome://extensions`
2. Enable “Developer mode”
3. Click “Load unpacked”
4. Select the folder: `gmail-inbox-labeler/`
5. Open Gmail (`https://mail.google.com/`) and go to your inbox

## How to use

- In the inbox list, click the small pill next to the subject
- Choose a label from the dropdown
- Reload Gmail to confirm labels persist

## Implementation decisions

- UI injection point: inserts a pill right after the subject text so it feels like part of the row and doesn’t break Gmail’s layout.
- Email identity: uses Gmail’s thread id when available (`data-legacy-thread-id` / `data-thread-id`), and falls back to parsing the row link when needed.
- SPA-safe: Gmail is a single-page app, so a `MutationObserver` re-scans the DOM as rows are virtualized/updated.
- Persistence: `chrome.storage.local` under a single key (`gmailLabeler:v1`) for simple, reliable storage.

## Source

- Extension folder: [gmail-inbox-labeler/](./gmail-inbox-labeler)
- Main script: [src/content.js](./gmail-inbox-labeler/src/content.js)
- Styles: [src/styles.css](./gmail-inbox-labeler/src/styles.css)

## Loom / screen recording

Record a ~2 minute clip showing:

1. Loading the unpacked extension
2. Applying labels to a few emails
3. Refreshing Gmail and showing labels remain
