## 1. Specification

- [x] 1.1 Add the `add-quick-blend-mode` OpenSpec change with scope, design decisions, acceptance scenarios, and implementation tasks.

## 2. Prompt Helper

- [x] 2.1 Add failing tests for Quick Blend mode constants, reference labels, prompt constraints, and metadata field names.
- [x] 2.2 Implement the shared Quick Blend prompt helper.

## 3. Local API

- [x] 3.1 Add failing local `/api/generate` tests for `mode=quick-blend`, exactly-two-reference validation, prompt replacement, output folder routing, and saved metadata.
- [x] 3.2 Implement local server support using the shared prompt helper and gallery metadata.

## 4. Cloudflare Worker

- [x] 4.1 Add failing Worker tests for Quick Blend reference validation, prompt helper usage, reference labels, saved metadata, and browser-private config safety.
- [x] 4.2 Implement Worker parity with the local server.

## 5. Frontend

- [x] 5.1 Add failing static UI/layout tests for `#quick-blend`, Create menu navigation, A/B upload controls, pair preview, validation feedback, and responsive constraints.
- [x] 5.2 Add client-side Quick Blend state, upload handling, pair preview rendering, batch queue submission, generated preview updates, and cleanup after gallery deletion or clear-history.
- [x] 5.3 Style the Quick Blend view for desktop, tablet, and mobile layouts without nesting cards or relying on hover-only controls.

## 6. Verification

- [x] 6.1 Run focused tests for Quick Blend, full `npm test`, public-lib sync check if a shared browser module is added, `npm run build:pages`, `git diff --check`, and browser verification of upload validation and pair preview.
