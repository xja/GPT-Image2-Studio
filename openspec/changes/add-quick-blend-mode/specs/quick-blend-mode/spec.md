## ADDED Requirements

### Requirement: Quick Blend Mode is an independent Create view
The system SHALL expose Quick Blend Mode through the Create menu at `#quick-blend` and SHALL keep its A uploads, B uploads, pair list, generated preview state, and feedback independent from prompt mode, style transfer, reference analysis, image decomposition, Creation Mode, Portrait Mode, Article Illustration, and PPT generation.

#### Scenario: User opens Quick Blend
- **WHEN** the user opens `#quick-blend`
- **THEN** the system displays two multi-image upload groups labeled product/A and B
- **AND** it displays an ordered pair preview area
- **AND** it does not prefill A or B uploads from any other Create mode

### Requirement: Quick Blend pairs A and B images by order
The system SHALL pair A and B files strictly by upload order and SHALL create one generation job per pair.

#### Scenario: User uploads matching A and B counts
- **WHEN** the user uploads product images `A1,A2` into product/A group
- **AND** uploads `B1,B2` into group B
- **THEN** the pair preview shows `A1+B1` and `A2+B2`
- **AND** starting generation queues two jobs

#### Scenario: User uploads more than two pairs
- **WHEN** the user uploads `A1,A2,A3,A4,A5,A6` and `B1,B2,B3,B4,B5,B6`
- **THEN** the system queues six jobs in the same order
- **AND** each job submits only the matched A/B pair as references

### Requirement: Quick Blend validates pair completeness
The system SHALL require both upload groups to contain at least one image and SHALL require the A and B counts to match before generation starts.

#### Scenario: A group is missing
- **WHEN** the user uploads one or more B images but no A images
- **THEN** the generation action is disabled or rejected with visible feedback
- **AND** no generation job starts

#### Scenario: B group is missing
- **WHEN** the user uploads one or more A images but no B images
- **THEN** the generation action is disabled or rejected with visible feedback
- **AND** no generation job starts

#### Scenario: Counts do not match
- **WHEN** the user uploads two A images and one B image
- **THEN** the pair preview marks the missing pair
- **AND** generation is disabled or rejected with visible feedback
- **AND** no generation job starts

### Requirement: Quick Blend generation uses a dedicated two-reference prompt
The system SHALL build a dedicated Quick Blend prompt when `/api/generate` receives `mode=quick-blend`. The backend SHALL require exactly two reference images for each Quick Blend request.

#### Scenario: Backend receives one valid pair
- **WHEN** `/api/generate` receives `mode=quick-blend` with exactly two image references
- **THEN** it generates one image from that pair
- **AND** the prompt tells the model to extract visible subjects from A and B, remove or neutralize backgrounds, and arrange A above B
- **AND** the prompt tells the model to preserve subject shape, colors, materials, markings, proportions, and identity cues
- **AND** the prompt tells the model not to add text, labels, watermarks, unrelated objects, invented logos, or decorative scene elements

#### Scenario: Backend receives malformed Quick Blend references
- **WHEN** `/api/generate` receives `mode=quick-blend` with fewer or more than two reference images
- **THEN** the backend rejects the request
- **AND** no image generation call is made

### Requirement: Quick Blend results are saved as gallery assets
The system SHALL save completed Quick Blend outputs into the normal gallery with quick-blend metadata.

#### Scenario: Quick Blend generation completes
- **WHEN** a Quick Blend job saves successfully
- **THEN** the result appears in the normal gallery
- **AND** saved metadata includes `generationMode: quick-blend`, `assetKind: quick-blend`, `quickBlendPairIndex`, `quickBlendAImageName`, and `quickBlendBImageName`
- **AND** the output path uses the dated `quick-blend` image folder

#### Scenario: Gallery item is deleted or history is cleared
- **WHEN** the user deletes a Quick Blend gallery item or clears history
- **THEN** Quick Blend preview state no longer points to the removed saved asset
- **AND** other Create modes remain unaffected
