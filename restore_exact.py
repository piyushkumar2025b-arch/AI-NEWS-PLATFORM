import os

with open("/proc/51/mem", "rb") as f:
    f.seek(0x7f6db8000000 + 350000)
    buf = f.read(350000)

files = {}

# 1. SourcesPanel.tsx (34720 to ~78760)
sources_text = buf[34720:78770].decode("utf-8", errors="ignore")
last_close = sources_text.rfind(");\n};")
if last_close != -1:
    files["src/components/SourcesPanel.tsx"] = sources_text[:last_close + len(");\n};")]

# 2. ArticleCard.tsx (78784 to ~89880)
art_text = buf[78784:89888].decode("utf-8", errors="ignore")
pos = art_text.find("</article>")
if pos != -1:
    files["src/components/ArticleCard.tsx"] = art_text[:pos + len("</article>")] + "\n      </div>\n    );\n  }\n  return (\n    <article ...\n" # wait, let us check the exact end of ArticleCard
