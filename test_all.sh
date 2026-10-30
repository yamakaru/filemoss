#!/bin/sh
# Build and run all FileMoss tests (unit + real-browser end-to-end).
set -e
cd "$(dirname "$0")"
python3 build.py
node tests/make_pdfs.js
python3 tests/make_scans.py
node tests/test_core.js
node tests/test_browser.js
python3 tests/make_compress_samples.py tests/out/cs 4 >/dev/null && (python3 -m http.server 8813 -d dist >/dev/null 2>&1 & echo $! > /tmp/cs.pid; sleep 1; F=/workspace/qa_retest/cpdf2_fx; [ -f $F/cmyk.pdf ] && export PNG2=$F/alpha_smask.pdf,$F/cmyk.pdf,$F/indexed.pdf,$F/screenshot_png.pdf; node tests/test_compress.js tests/out/cs http://localhost:8813; r=$?; kill $(cat /tmp/cs.pid) 2>/dev/null || true; exit $r)
node tests/test_scan.js
node tests/test_scan2.js
node tests/test_ocr_vi.js
