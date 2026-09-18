import os
import re

with open("/proc/51/mem", "rb") as f:
    f.seek(0x7f6db8000000 + 350000)
    buf = f.read(350000)

def clean_code(byte_slice):
    text = byte_slice.decode("utf-8", errors="ignore")
    # strip non-printable chars from edges
    text = text.strip()
    return text

files = {}

# 1. SourcesPanel.tsx
art_start = b"import React from 'react';\nimport {\n  ExternalLink,\n  Clock,"
sources_start = b"import React, { useState, useMemo } from 'react';"
s_idx = buf.find(sources_start)
next_idx = buf.find(art_start, s_idx)
sources_slice = buf[s_idx:next_idx]
last_close = sources_slice.rfind(b");\n};")
if last_close != -1:
    files["src/components/SourcesPanel.tsx"] = clean_code(sources_slice[:last_close + len(b");\n};")])

# 2. ArticleCard.tsx
videos_start = b"import React, { useState, useEffect, useCallback } from 'react';"
art_idx = buf.find(art_start)
vid_idx = buf.find(videos_start, art_idx)
art_slice = buf[art_idx:vid_idx]
last_close = art_slice.rfind(b");\n});")
if last_close != -1:
    files["src/components/ArticleCard.tsx"] = clean_code(art_slice[:last_close + len(b");\n});")])

# 3. VideosPanel.tsx
logs_start = b"import React, { useState } from 'react';"
logs_idx = buf.find(logs_start, vid_idx)
vid_slice = buf[vid_idx:logs_idx]
last_close = vid_slice.rfind(b");\n};")
if last_close != -1:
    files["src/components/VideosPanel.tsx"] = clean_code(vid_slice[:last_close + len(b");\n};")])

# 4. IngestionLogsPanel.tsx
cat_start = b"import React from 'react';\nimport { CATEGORIES"
cat_idx = buf.find(cat_start, logs_idx)
logs_slice = buf[logs_idx:cat_idx]
last_close = logs_slice.rfind(b");\n};")
if last_close != -1:
    files["src/components/IngestionLogsPanel.tsx"] = clean_code(logs_slice[:last_close + len(b");\n};")])

# 5. CategoryFilter.tsx
modal_start = b"import React, { useState, useEffect } from 'react';\nimport {\n  X,"
modal_idx = buf.find(modal_start, cat_idx)
cat_slice = buf[cat_idx:modal_idx]
last_close = cat_slice.rfind(b");\n};")
if last_close != -1:
    files["src/components/CategoryFilter.tsx"] = clean_code(cat_slice[:last_close + len(b");\n};")])

# 6. ArticleModal.tsx
med_start = b"import React, { useState, useEffect } from 'react';\nimport {\n  Image,"
med_idx = buf.find(med_start, modal_idx)
modal_slice = buf[modal_idx:med_idx]
last_close = modal_slice.rfind(b");\n};")
if last_close != -1:
    files["src/components/ArticleModal.tsx"] = clean_code(modal_slice[:last_close + len(b");\n};")])

# 7. MediaRenderer.tsx
pipe_start = b"import React from 'react';\nimport {\n  Layers,\n  ArrowRight,"
pipe_idx = buf.find(pipe_start, med_idx)
med_slice = buf[med_idx:pipe_idx]
last_close = med_slice.rfind(b");\n};")
if last_close != -1:
    files["src/components/MediaRenderer.tsx"] = clean_code(med_slice[:last_close + len(b");\n};")])

# 8. PipelineFlowView.tsx
hdr_start = b"import React from 'react';\nimport {\n  Activity,\n  Radio,"
hdr_idx = buf.find(hdr_start, pipe_idx)
pipe_slice = buf[pipe_idx:hdr_idx]
last_close = pipe_slice.rfind(b");\n};")
if last_close != -1:
    files["src/components/PipelineFlowView.tsx"] = clean_code(pipe_slice[:last_close + len(b");\n};")])

# 9. Header.tsx
item_idx = buf.find(b"ArticleListItemProps", hdr_idx)
item_import_idx = buf.rfind(b"import React from 'react';", hdr_idx, item_idx)
hdr_slice = buf[hdr_idx:item_import_idx]
last_close = hdr_slice.rfind(b");\n};")
if last_close != -1:
    files["src/components/Header.tsx"] = clean_code(hdr_slice[:last_close + len(b");\n};")])

# 10. ArticleListItem.tsx
metrics_start = b"import React from 'react';\nimport {\n  Radio,\n  Cpu,"
metrics_idx = buf.find(metrics_start, item_import_idx)
item_slice = buf[item_import_idx:metrics_idx]
last_close = item_slice.rfind(b");\n});")
if last_close != -1:
    files["src/components/ArticleListItem.tsx"] = clean_code(item_slice[:last_close + len(b");\n});")])

# 11. MetricsOverview.tsx
ed_start = b"/**\n * Curated high-resolution editorial cover image mappings"
ed_idx = buf.find(ed_start, metrics_idx)
metrics_slice = buf[metrics_idx:ed_idx]
last_close = metrics_slice.rfind(b");\n};")
if last_close != -1:
    files["src/components/MetricsOverview.tsx"] = clean_code(metrics_slice[:last_close + len(b");\n};")])

# 12. editorialMedia.ts
app_start = b"import React, { useState, useEffect, useCallback, useRef } from 'react';"
app_idx = buf.find(app_start, ed_idx)
ed_slice = buf[ed_idx:app_idx]
last_close = ed_slice.rfind(b"return pool[index];\n}")
if last_close != -1:
    files["src/utils/editorialMedia.ts"] = clean_code(ed_slice[:last_close + len(b"return pool[index];\n}")])

# 13. App.tsx
test_start = b"import assert from 'assert';\nimport { normalizeUrl,"
test_idx = buf.find(test_start, app_idx)
app_slice = buf[app_idx:test_idx]
last_close = app_slice.rfind(b"  );\n}")
if last_close != -1:
    files["src/App.tsx"] = clean_code(app_slice[:last_close + len(b"  );\n}")])

# 14. tests/run_tests.ts
test_end = b"runAllTests().catch(err => {\n  console.error('Test runner fatal error:', err);\n  process.exit(1);\n});"
test_slice = buf[test_idx:]
end_idx = test_slice.find(test_end)
if end_idx != -1:
    files["tests/run_tests.ts"] = clean_code(test_slice[:end_idx + len(test_end)])

print(f"Successfully extracted {len(files)} files!")
for p, content in files.items():
    print(f"  - {p} ({len(content)} chars)")
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, "w", encoding="utf-8") as out:
        out.write(content + "\n")
