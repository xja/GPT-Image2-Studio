## 1. Specification And Planning

- [ ] 1.1 Validate this OpenSpec change against the current Creation Mode data model and API routes.
- [ ] 1.2 Create the implementation plan after the user reviews and approves this spec.

## 2. Listing Schema And Validation

- [ ] 2.1 Add tests for the Listing Agent output schema, SKU grouping, evidence modes, and 500-character field and bullet limits.
- [ ] 2.2 Implement listing draft normalization and validation helpers.
- [ ] 2.3 Add tests for title ordering: quantity first, size second when available, then search and descriptive terms.
- [ ] 2.4 Implement keyword de-duplication, warning generation, and one-retry rewrite feedback.

## 3. Source Assembly And Fallback

- [ ] 3.1 Add tests for image-backed, mixed, and input-only source packages.
- [ ] 3.2 Build source assembly from Creation set manifests, SKU subjects, generated image items, reference-role notes, category path, dimensions, prompts, and saved copy.
- [ ] 3.3 Ensure failed or missing generated images degrade to input-only listing generation rather than blocking the listing workflow.

## 4. Local API And Persistence

- [ ] 4.1 Add tests for a local listing-generation endpoint that resolves Creation sets by manifest ID.
- [ ] 4.2 Implement the local endpoint, model request, validator, retry-once path, and manifest persistence.
- [ ] 4.3 Keep listing failures isolated from Creation image-generation status.

## 5. Frontend

- [ ] 5.1 Add layout tests for the optional Listing Agent switch and Creation record Listing section.
- [ ] 5.2 Implement automatic post-generation trigger when enabled.
- [ ] 5.3 Implement manual generate, rewrite, copy, and export actions from Creation records.
- [ ] 5.4 Render evidence mode, warnings, missing information, and failed fallback states.

## 6. Worker, Docs, And Verification

- [ ] 6.1 Align Cloudflare Worker contracts where possible, with explicit input-only fallback when local images are inaccessible.
- [ ] 6.2 Update README and relevant Creation Mode docs.
- [ ] 6.3 Run targeted tests, full tests, Pages build, and Chinese text encoding checks.
