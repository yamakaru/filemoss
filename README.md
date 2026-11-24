# FileMoss

Free, private office tools: PDF, image and spreadsheet converters plus everyday calculators. Every tool runs 100% in the browser, so files never leave the user's device.

Live: https://filemoss.pages.dev

- `python3 build.py`: generates the static site into `dist/`
- `./test_all.sh`: builds the site, then runs unit tests (`tests/test_core.js`) and real-Chrome end-to-end tests (`tests/test_browser.js`) against the sample files in `tests/samples/`
- Set `BASE=https://filemoss.pages.dev node tests/test_browser.js` to test the live site.

## Rotating the IndexNow key (only when a deploy is approved)

A new key may already be waiting locally in `.indexnow_key.next` (gitignored, mode 600). Leave `.indexnow_key` and the current `dist/` on the live key until deploy is approved.

When ready to rotate:

1. `mv .indexnow_key.next .indexnow_key`
2. Rebuild the site (`python3 build.py`) so `dist/` gets the new key file and `_worker.js` is updated
3. Deploy `dist/` with the usual Direct Upload (`wrangler pages deploy`)
4. Ping IndexNow with the new key so search engines pick up the change

Do not commit `.indexnow_key`, `.indexnow_key.next`, or `dist/`.
