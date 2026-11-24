# Single place to change the public site URL (e.g. to https://filemoss.com when the domain is bought).
BASE_URL = "https://filemoss.com"
SITE_NAME = "FileMoss"

# C2: languages that stay in the sitemap / hreflang / indexable set.
# Other built locales stay live with noindex,follow (no 301, no deletion).
INDEXED_LANGS = ("en", "it", "es", "pt")

# C3 Organization JSON-LD. Empty email/sameAs fields are omitted.
ORG_LOGO = "/favicon.svg"
ORG_EMAIL = ""  # set to hello@filemoss.com only after approval
ORG_SAME_AS = ("https://github.com/yamakaru/filemoss",)

# C3 /how-we-test/ index gate: "auto" (default) indexes only when the EN article
# in content/how-we-test.en.html has >= HOW_WE_TEST_MIN_WORDS and
# >= HOW_WE_TEST_MIN_SOURCES outbound https links. Use "yes" or "no" to override.
HOW_WE_TEST_INDEX = "auto"
HOW_WE_TEST_MIN_WORDS = 500
HOW_WE_TEST_MIN_SOURCES = 5
