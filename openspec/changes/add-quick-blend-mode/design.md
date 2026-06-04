## Context

Quick Blend is a narrow two-source batch workflow. It should feel closer to Image Decomposition and Style Transfer than to Creation Mode: a user uploads product images into A, uploads matching B references, checks the generated task list, and starts a batch of independent single-image jobs.

The confirmed v1 pairing rule is order-based one-to-one pairing. A is the product upload group. If the user uploads `A1,A2` and `B1,B2`, the app creates two jobs: `A1+B1` and `A2+B2`.

## Goals / Non-Goals

**Goals:**

- Add a Create menu entry and independent `#quick-blend` view.
- Allow unlimited A/B uploads in the UI, subject to browser memory and existing queue limits.
- Require A and B counts to match before generation.
- Submit one queued generation job per pair.
- Reuse `/api/generate`, SSE progress, browser API config, image compression, queue polling, gallery saving, and Cloudflare parity.
- Preserve pair identity in job state, saved metadata, gallery items, and task records.
- Build the final prompt from a shared helper so local and Cloudflare behavior match.
- Keep the generated image focused on extracted visible subjects from A and B, arranged vertically with A above B.

**Non-Goals:**

- No automatic background-removal preprocessor before the model request.
- No user-controlled canvas layout editor.
- No drag-and-drop pair reordering in v1.
- No cross-pair batch math.
- No new backend route unless `/api/generate` cannot support the validated request shape.

## Decisions

1. **Use `/api/generate` with `mode=quick-blend`.**
   - Rationale: each pair outputs one image and fits the current single-image generation pipeline.
   - Alternative considered: add `/api/quick-blend/generate`. This would duplicate SSE, queue, gallery, and Cloudflare logic without a v1 benefit.

2. **Pair in the browser, validate again on the backend.**
   - Rationale: the browser can show an exact pair list before submission, while the backend must still reject malformed direct API calls.
   - Alternative considered: submit all A/B images in one request and pair server-side. This would complicate progress tracking and saved metadata for each output.

3. **Use independent jobs rather than a set manifest.**
   - Rationale: Quick Blend outputs gallery assets, not an ecommerce set with repair flows.
   - Alternative considered: reuse Creation Mode set records. This would add record complexity that the quick workflow does not need.

4. **Store quick-blend metadata on normal gallery assets.**
   - Rationale: users should find outputs beside other single-image generations while still seeing which A/B pair produced them.
   - Alternative considered: separate record view. This is deferred until there is a need for pair-level repair or export.

## Prompt Contract

The prompt helper must instruct the model to:

- Treat the first reference as A and the second reference as B.
- Extract the visible main subject or subjects from each reference.
- Remove or neutralize the original backgrounds.
- Preserve subject shape, colors, material, markings, identity cues, and proportions.
- Arrange the A subject group above the B subject group in one image.
- Keep the composition clean, centered, and product-like.
- Avoid adding text, labels, watermarks, unrelated objects, invented logos, or decorative scene elements.

## Risks / Trade-offs

- **"Unlimited" uploads can exceed browser memory or queue limits** -> v1 allows unlimited selection in the UI but queues generation through the existing session limits.
- **Subject extraction is model-driven** -> the prompt strongly asks for cutout-like extraction, but no deterministic segmentation model is introduced in v1.
- **Order mistakes are possible** -> the pair preview must make A/B order visible before generation.
- **Very large batches can take time** -> the existing queue and activity feed should make progress visible without blocking the whole UI.
