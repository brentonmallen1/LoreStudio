# shared

`prose-syntax/cases.json` is the cross-language test fixture for the prose inline syntax
(@mentions, [[links]], "…"<Speaker> tags, quotes, find, word count). It is read by
`backend/tests/services/test_prose_syntax.py` and by `frontend/src/lib/prose/syntax.test.ts`
and `find.test.ts`, so the Python and TypeScript readers stay in step. It is not shipped in
the images or used at runtime.
