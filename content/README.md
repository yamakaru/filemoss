# C3 content slots (FileMoss)

English-only copy that the build reads on every run. No `--translate` step is needed.

| File | Route | Notes |
|---|---|---|
| `about.en.html` | `/about/` | HTML fragment used as the About body. The current published About text is already here. To ship a rewrite (≥400 words), replace this file’s contents (same fragment format: headings and paragraphs, no `<html>` wrapper). Changing the English will leave older translations in `i18n/<lang>.json` stale until MMO/Lập trình viên update those caches (or run a later approved `--translate`). |
| `how-we-test.en.html` | `/how-we-test/` | EN-only route. Canonical is self. Default **noindex** and **not in the sitemap** until the article is long enough (see the comment in the file and `HOW_WE_TEST_INDEX` in `../config.py`). |

JSON-LD Organization is assembled in `seo_policy.py` from `config.py` (`ORG_LOGO`, optional `ORG_EMAIL`, `ORG_SAME_AS`). Leave empty fields blank so they are omitted.

The EN articles from `/workspace/specs/c3_content/` were pasted on 24/11/2026 (Asia/Saigon). `/how-we-test/` now meets the auto-index thresholds.
