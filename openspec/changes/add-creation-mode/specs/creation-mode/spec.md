## ADDED Requirements

### Requirement: Creation Mode tab is independent
The system SHALL expose Creation Mode as a separate tab under the creation workspace and SHALL NOT share prompt text, reference-image selections, prompt templates, queued jobs, or prompt-mode generated state with Creation Mode.

#### Scenario: User switches from prompt mode to Creation Mode
- **WHEN** the user opens the Creation Mode tab
- **THEN** the system displays Creation Mode-specific inputs and does not prefill them from the prompt-mode prompt, reference images, or Prompt Kit templates

#### Scenario: Creation Mode receives generated results
- **WHEN** a Creation Mode set saves generated images
- **THEN** the prompt-mode activity feed and default gallery-visible history are not updated as if the images were prompt-mode single-image jobs

### Requirement: Creation Mode generates configurable ecommerce sets
The system SHALL generate one set for one product with quick presets of 4, 6, 8, 10, or 12 ecommerce marketing roles and SHALL allow the user to customize which of the 12 image roles are generated for the current set. The system SHALL also allow the user to choose an industry template for general ecommerce, apparel, beauty, food, consumer electronics, or home/living products. When the user uses a preset without custom role changes and no non-general industry template is selected, the first four roles SHALL remain hero image, benefit image, lifestyle scene, and detail/trust image.

#### Scenario: User starts a creation set
- **WHEN** the user submits product information and a target language in Creation Mode
- **THEN** the system creates the selected number of planned image items
- **AND** the first four items use hero, benefit, scene, and detail/trust roles

#### Scenario: User selects eight images
- **WHEN** the user starts a Creation Mode set with 8 selected
- **THEN** the planned set includes comparison, social proof, package, and promotion roles after the first four ecommerce roles

#### Scenario: User selects twelve images
- **WHEN** the user starts a Creation Mode set with 12 selected
- **THEN** the planned set includes material close-up, usage steps, dimensions, and review/Q&A roles after the first eight ecommerce roles

#### Scenario: User customizes selected image roles
- **WHEN** the user selects a custom subset of Creation Mode image roles before generation
- **THEN** the generation request includes the selected role list
- **AND** the planned set image count equals the number of selected roles
- **AND** the planned items use the selected roles instead of only slicing the first preset roles

#### Scenario: User previews and edits the planned set before generation
- **WHEN** the user requests a Creation Mode plan preview before starting image generation
- **THEN** the system returns the same planned ecommerce image items without requiring API credentials
- **AND** the user can adjust one planned item prompt before generation
- **AND** the generation request uses that adjusted prompt only for the matching planned item

#### Scenario: User changes marketing scenario
- **WHEN** the user selects a Creation Mode marketing scenario such as livestream, marketplace search, gift guide, or brand story
- **THEN** the role picker updates to the scenario's recommended image-role combination
- **AND** the quick image count reflects the recommended role count when that count is supported
- **AND** the user can still manually add or remove image roles before generation

#### Scenario: User changes industry template
- **WHEN** the user selects a Creation Mode industry template such as apparel, beauty, food, consumer electronics, or home/living
- **THEN** the role picker updates to that industry's recommended image-role combination
- **AND** the planned prompts include the selected industry template's visual and compliance guidance
- **AND** the generation and plan-preview requests include the selected industry template

#### Scenario: Product information is missing
- **WHEN** the user submits Creation Mode without product information
- **THEN** the system rejects the request with a visible validation message and does not start image generation

### Requirement: Creation Mode supports independent reference images and marketing scenarios
The system SHALL allow Creation Mode to upload its own reference images and choose a marketing scenario without sharing prompt-mode reference-image state.

#### Scenario: User adds Creation Mode reference images
- **WHEN** the user uploads or drops images in the Creation Mode reference area
- **THEN** the images are stored only in Creation Mode browser state
- **AND** submitted to `/api/creation/generate` as generation references

#### Scenario: User chooses a marketing scenario
- **WHEN** the user selects a scenario such as detail page, social seeding, launch, promotion, livestream, gift guide, marketplace search, or brand story
- **THEN** every planned item prompt includes scenario-specific ecommerce guidance
- **AND** each planned item prompt includes role-specific guidance for that selected scenario when available
- **AND** the set manifest stores the selected scenario and reference image names

#### Scenario: User edits Creation Mode generation parameters
- **WHEN** the user opens the Creation Mode parameter area
- **THEN** set count, marketing scenario, target language, output format, ratio, and resolution are presented as one six-control grid
- **AND** the desktop layout places those controls in two rows of three without sharing prompt-mode parameter state
- **AND** changing the Creation Mode ratio refreshes only the Creation Mode resolution options

#### Scenario: User tags reference image roles
- **WHEN** the user assigns a role such as product, package, material, scene, style, or other to a Creation Mode reference image
- **THEN** the selected role is stored with the reference image metadata
- **AND** the generated item prompts include role-aware reference guidance

#### Scenario: User reviews applied reference roles
- **WHEN** reference image roles or notes have been applied to a Creation Mode set
- **THEN** the active set detail and saved asset record detail show the same reference role summary
- **AND** repair requests keep the saved reference role metadata when the original file input is no longer recoverable

#### Scenario: User analyzes Creation Mode reference images
- **WHEN** the user asks Creation Mode to identify uploaded reference images
- **THEN** the system analyzes those images through a Creation Mode-specific endpoint
- **AND** the suggested role and note for each reference image are shown as pending recommendations
- **AND** the suggested role and note are applied only to Creation Mode reference state after the user explicitly applies the recommendations
- **AND** the analysis result is not written into prompt-mode reference-analysis history
- **AND** generated item prompts include any applied reference-image analysis notes

### Requirement: Target language controls marketing prompts
The system SHALL apply the selected target language to every Creation Mode item prompt and marketing copy while preserving product names, model names, numbers, and units from the user's product input.

#### Scenario: User selects English target language
- **WHEN** the user starts a Creation Mode set with English selected
- **THEN** each generated item prompt instructs the image generator to use concise English marketing copy for image text

#### Scenario: User selects Chinese target language
- **WHEN** the user starts a Creation Mode set with Chinese selected
- **THEN** each generated item prompt instructs the image generator to use concise Simplified Chinese marketing copy for image text

### Requirement: Creation assets are stored under the creation folder
The system SHALL save Creation Mode generated images under `Pictures/MM/YYYY-MM-DD/YYYY-MM-DD-creation/<set-folder>/`, which is beside `YYYY-MM-DD-image` and `YYYY-MM-DD-ppt` for the same date.

#### Scenario: Creation image is saved
- **WHEN** a Creation Mode item finishes generation on May 5, 2026
- **THEN** its relative output path starts with `05/2026-05-05/2026-05-05-creation/`

#### Scenario: User opens the output directory
- **WHEN** the app prepares the daily output folders
- **THEN** the same date folder contains creation, image, and ppt output folders

### Requirement: Creation records are set-based
The system SHALL persist Creation Mode records as set manifests with set-level input, target language, marketing scenario, industry template, item roles, item statuses, prompts, image paths, and partial-failure status.

#### Scenario: All items complete
- **WHEN** all Creation Mode items save successfully
- **THEN** the set manifest status is `completed` and includes every saved item record

#### Scenario: One item fails
- **WHEN** at least one Creation Mode item fails after another item has saved
- **THEN** the set manifest status is `partial_failed` and saved item records remain available

### Requirement: Creation set records expose details and item repair
The system SHALL provide Creation Mode set record details that show the set-level input, target language, marketing scenario, industry template, reference image names, item roles, prompts, statuses, failure messages, and saved image paths. From the detail view, the system SHALL allow users to regenerate a saved item, fill a missing item, or retry failed items without creating a new set record.

#### Scenario: User opens a set record detail
- **WHEN** the user opens a Creation Mode set record
- **THEN** the detail view shows the set metadata and every planned item with its role, prompt, status, error message when present, and saved image path when present

#### Scenario: User regenerates one saved item
- **WHEN** the user requests regeneration for a completed item in a Creation Mode set record
- **THEN** only that item is generated again using the set metadata and item role prompt
- **AND** the set manifest keeps the same set identity and updates that item's status, prompt, and image path

#### Scenario: User edits one item prompt before regeneration
- **WHEN** the user saves a prompt adjustment on one Creation Mode item and regenerates that item
- **THEN** the repair request uses the adjusted prompt only for that item
- **AND** the same set manifest stores the adjusted prompt on that item

#### Scenario: User fills a missing or failed item
- **WHEN** the user requests completion for missing or failed items in a Creation Mode set record
- **THEN** only items without saved images or with failed status are generated
- **AND** the set manifest becomes `completed` only after every planned item has a saved image

### Requirement: Saved asset records are grouped under Assets
The system SHALL group waterfall gallery browsing, PPT records, Creation Mode set records, and output-directory access under the Assets navigation and SHALL NOT expose a separate top-level Records navigation item.

#### Scenario: User opens Create navigation
- **WHEN** the user opens the Create navigation menu
- **THEN** the menu includes prompt image generation, Creation Mode, PPT generation, and the image-to-prompt tool
- **AND** the system does not expose a separate top-level Presentation navigation item

#### Scenario: User opens Assets navigation
- **WHEN** the user opens the Assets navigation menu
- **THEN** the menu includes waterfall gallery, Creation set records, PPT records, and output-directory access
- **AND** there is no separate top-level Records tab

#### Scenario: User opens Settings navigation
- **WHEN** the user opens the Settings navigation menu
- **THEN** the menu includes API configuration and theme controls
- **AND** it does not include creation modes, asset records, or output-directory actions

#### Scenario: User opens Creation set records
- **WHEN** the user opens the Creation set records asset view
- **THEN** the view shows saved Creation Mode set manifests and their generated item images
- **AND** selecting a saved set in this asset view does not replace the active in-progress Creation Mode set

#### Scenario: User searches Creation set records
- **WHEN** the user searches the Creation set records asset view by product, scenario, industry template, language, prompt, filename, or output path
- **THEN** the record list narrows to matching Creation Mode set manifests

#### Scenario: User reuses a Creation set record
- **WHEN** the user explicitly reuses a selected Creation Mode set record
- **THEN** the selected record is loaded into the active Creation Mode workspace
- **AND** the Creation Mode form controls reflect the selected record's product input, target language, marketing scenario, industry template, image count, and selected roles
- **AND** local reference-image file inputs are cleared because saved manifests cannot restore browser `File` objects
- **AND** saved reference image names, roles, and notes are shown as items that need reupload
- **AND** the app switches to the Creation Mode workspace so the user can continue item prompt edits, regeneration, or repair

#### Scenario: User reuploads saved Creation reference images
- **WHEN** the user uploads reference images after reusing a Creation Mode set record
- **THEN** files matching saved reference names, or the next missing reference by order, are marked as uploaded
- **AND** the uploaded files inherit the saved reference role and note for preview, generation, and repair requests
- **AND** the user can manually bind an uploaded file to a selected historical reference item to override automatic filename or order matching
- **AND** manual binding applies the selected historical reference role and note to that uploaded file
- **AND** missing historical reference items are not sent as usable reference-image metadata until a real file is uploaded

#### Scenario: User opens a Creation set record folder
- **WHEN** the user opens the folder for a selected Creation Mode set record
- **THEN** the local server resolves the folder from the saved set manifest ID
- **AND** the server opens only a validated creation subfolder under the configured output directory

#### Scenario: User copies Creation set image paths
- **WHEN** the user copies paths from a selected Creation Mode set record
- **THEN** the clipboard text includes the selected set label, recorded creation folder, and saved image relative paths
- **AND** the active Creation Mode workspace is not replaced

#### Scenario: User works in Creation Mode
- **WHEN** the user opens the active Creation Mode workspace
- **THEN** the workspace shows the current in-progress or planned Creation set output
- **AND** saved Creation Mode history is not rendered as a history list inside the active workspace
