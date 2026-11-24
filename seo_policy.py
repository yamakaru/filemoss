"""C2/C3 indexing policy used by i18n.py and seo_post.py.

INDEXED_LANGS, Organization fields and the how-we-test index gate live in
config.py so a later C4 gate can be flipped in one place.
"""
import re, html
from pathlib import Path

_ROOT = Path(__file__).resolve().parent
_CFG = {}
exec(open(_ROOT / "config.py", encoding="utf-8").read(), _CFG)

SITE = _CFG["BASE_URL"].rstrip("/")
SITE_NAME = _CFG["SITE_NAME"]
INDEXED_LANGS = tuple(_CFG["INDEXED_LANGS"])
ORG_LOGO = _CFG.get("ORG_LOGO") or ""
ORG_EMAIL = _CFG.get("ORG_EMAIL") or ""
ORG_SAME_AS = tuple(x for x in (_CFG.get("ORG_SAME_AS") or ()) if x)
HOW_WE_TEST_INDEX = str(_CFG.get("HOW_WE_TEST_INDEX", "auto")).strip().lower()
HOW_WE_TEST_MIN_WORDS = int(_CFG.get("HOW_WE_TEST_MIN_WORDS", 500))
HOW_WE_TEST_MIN_SOURCES = int(_CFG.get("HOW_WE_TEST_MIN_SOURCES", 5))
EN_ONLY = {"/how-we-test/"}
STATIC_DIRS = ("about", "privacy", "contact", "how-we-test")

def norm(path):
    if not path or path == "/":
        return "/"
    if not path.startswith("/"):
        path = "/" + path
    if not path.endswith("/"):
        path += "/"
    return path

def is_en_only(path):
    return norm(path) in EN_ONLY

def is_contact(path):
    return norm(path) == "/contact/"

def is_privacy(path):
    return norm(path) == "/privacy/"

def _visible_text(src):
    src = re.sub(r"(?is)<(script|style|noscript|svg)[^>]*>.*?</\1>", " ", src)
    m = re.search(r"(?is)<main[^>]*>(.*?)</main>", src)
    body = m.group(1) if m else src
    body = re.sub(r"(?is)<!--.*?-->", " ", body)
    return html.unescape(re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", body))).strip()

def words_and_sources(src):
    """Word count of visible text, and number of unique external http(s) links."""
    text = _visible_text(src)
    words = len(text.split()) if text else 0
    hrefs = set()
    for h in re.findall(r"""href=["'](https?://[^"']+)["']""", src, re.I):
        hrefs.add(h.split("#")[0])
    return words, len(hrefs)

def how_we_test_content():
    p = _ROOT / "content" / "how-we-test.en.html"
    return p.read_text(encoding="utf-8") if p.exists() else ""

def how_we_test_should_index(html_src=None):
    """auto: index only when the EN article has >=500 words and >=5 outbound sources.
    Override with HOW_WE_TEST_INDEX=yes or =no in config.py."""
    if HOW_WE_TEST_INDEX in ("yes", "true", "1", "on"):
        return True
    if HOW_WE_TEST_INDEX in ("no", "false", "0", "off"):
        return False
    src = how_we_test_content() if html_src is None else html_src
    words, sources = words_and_sources(src)
    return words >= HOW_WE_TEST_MIN_WORDS and sources >= HOW_WE_TEST_MIN_SOURCES

def page_noindex(lang, path):
    path = norm(path)
    if is_en_only(path):
        return not (lang == "en" and how_we_test_should_index())
    if lang not in INDEXED_LANGS:
        return True
    if (is_contact(path) or is_privacy(path)) and lang != "en":
        return True
    return False

def page_in_sitemap(lang, path):
    """EN contact is indexable but omitted from the sitemap (spec C2)."""
    if page_noindex(lang, path):
        return False
    if is_contact(path):
        return False
    return True

def hreflang_langs(path):
    """Languages whose version of this path is indexable (excludes noindex URLs)."""
    return [l for l in INDEXED_LANGS if not page_noindex(l, path)]

def keep_href(h):
    """Root-relative hrefs that must not be prefixed with /<lang>/."""
    if not h or not h.startswith("/") or h.startswith("//"):
        return True
    if h.startswith("/assets/"):
        return True
    path = h.split("#")[0].split("?")[0]
    return is_en_only(path)

def robots_tag(lang, path):
    if page_noindex(lang, path):
        return '<meta name="robots" content="noindex, follow">'
    return ""

def organization_ld():
    o = {"@context": "https://schema.org", "@type": "Organization",
         "@id": SITE + "/#org", "name": SITE_NAME, "url": SITE + "/"}
    if ORG_LOGO:
        logo = ORG_LOGO if ORG_LOGO.startswith("http") else SITE + ORG_LOGO
        o["logo"] = logo
    if ORG_EMAIL:
        o["email"] = ORG_EMAIL
    if ORG_SAME_AS:
        o["sameAs"] = list(ORG_SAME_AS)
    return o
