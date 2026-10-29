#!/bin/sh
# Build and run all FileMoss tests (unit + real-browser end-to-end).
set -e
cd "$(dirname "$0")"
python3 build.py
node tests/make_pdfs.js
python3 tests/make_scans.py
node tests/test_core.js
node tests/test_browser.js
node tests/test_scan.js
node tests/test_scan2.js
node tests/test_ocr_vi.js
