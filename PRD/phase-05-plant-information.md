# Phase 05 — Plant Information & Species Profiles

**Goal:** After identifying a plant, the user sees a rich, structured species profile with actionable care instructions — the "understand" step of the core loop.

**Requirements covered:** FR-3 (species info / care profile display), FR-12 (toxicity & difficulty indicators).

**Depends on:** Phase 04 (scan results populate the `species` table with AI-generated data).

---

## What gets built

### 1. Plant info screen

Accessed from:
- Scan results screen ("View care info" button).
- Plant detail screen in the collection (Phase 06).
- Navigated to with a `speciesId` param.

**Layout (scrollable single screen):**

#### Header section
- Hero area with plant common name (large) and scientific name (italic).
- Placeholder/generic plant illustration (or the user's scanned photo if available).
- Two badges:
  - **Difficulty**: Easy (green), Moderate (amber), Hard (red) — from `care_profile.difficulty`.
  - **Toxicity**: Safe (green shield) or Toxic (red warning) with detail text — from `care_profile.toxicity`.

#### Care cards grid
A 2-column grid of care info cards, each with an icon and concise text:

| Card | Icon | Source field |
|------|------|-------------|
| Light | sun | `care_profile.light` |
| Water | droplet | `care_profile.water` |
| Humidity | mist | `care_profile.humidity` |
| Temperature | thermometer | `care_profile.temperature` |
| Soil | layers | `care_profile.soil` |
| Feeding | leaf | `care_profile.feeding` |

Each card shows:
- Category label (e.g., "Light").
- Short instruction text (e.g., "Bright indirect light — avoid direct afternoon sun").

#### Description
- 1-2 paragraph description of the species from `species.description`.

#### Action bar (sticky bottom)
- **"Add to my plants"** button — navigates to the save flow (Phase 06).
- If the plant is already in the user's collection, show "Already in your collection" with a link to the plant detail.

### 2. Species data flow

The species data is AI-generated during scanning (Phase 04) and cached in the `species` table:

1. User scans a plant → Edge Function generates the care profile → inserts into `species` if new.
2. Plant info screen fetches from `species` table by `speciesId`.
3. Subsequent users who scan the same species reuse the cached entry.

**No pre-seeded database** — the species table grows organically as users scan plants.

### 3. Toxicity warning

If `care_profile.toxicity` indicates the plant is toxic:
- Show a prominent warning banner at the top of the care section.
- Red/orange background with a warning icon.
- Text like: "Toxic to cats and dogs — keep out of reach."
- This is a high-value safety signal identified in the PRD.

---

## Acceptance criteria

- [ ] Navigating to plant info with a valid `speciesId` displays the full species profile.
- [ ] Common name, scientific name, difficulty badge, and toxicity badge are visible.
- [ ] All 6 care cards render with correct data from the `care_profile` JSON.
- [ ] Toxic plants show a prominent warning banner.
- [ ] "Add to my plants" button is visible and tappable (navigation to Phase 06).
- [ ] If the species is already in the user's collection, the button state reflects this.
- [ ] Screen loads quickly from the Supabase `species` table (no additional AI call).

---

## Tech notes

- **`care_profile` is JSONB**: Parse it from the `species` row. Handle missing fields gracefully — the AI might occasionally omit one. Show "Not available" for any missing field rather than crashing.
- **Icons**: Use a lightweight icon set like `@expo/vector-icons` (Ionicons or MaterialCommunityIcons) for the care cards. No need for custom SVGs in the MVP.
- **Toxicity logic**: The AI returns a free-text toxicity field. Parse for keywords like "toxic", "poisonous", "harmful" to trigger the warning banner. Default to showing the full text regardless.
- **Already in collection check**: Query `user_plants` where `user_id = current user` and `species_id = this species`. If a row exists, adjust the button. This is a simple query, not a complex join.
- **No edit capability**: Species data is read-only from the user's perspective. If the AI got something wrong, the user can re-scan or the data can be manually corrected in the database later.

---

## Full implementation plan

### Implementation objective
Turn scan results into a useful species profile screen that explains what the plant is and how to care for it. The screen should read structured data from Supabase and provide a clean path into the save-to-collection flow.

### Ordered build tasks
1. Define the plant information route that accepts a `speciesId` and optional scan result context.
2. Fetch the species record from Supabase by ID and parse its `care_profile` JSON.
3. Build the species header with common name, scientific name, image if available, difficulty badge, and toxicity badge.
4. Build care cards for light, water, humidity, temperature, soil, feeding, and any additional profile fields returned by the backend.
5. Add a prominent toxicity warning banner when the care profile indicates pet or human toxicity.
6. Add description and practical care summary sections using the existing PRD tone.
7. Add "Add to my plants" as the primary action and route it to Phase 06's save flow.
8. Check whether the current user already has this species saved and adjust button copy/state accordingly.
9. Add loading, missing species, malformed care profile, and network error states.
10. Keep all AI-generated content visibly practical, concise, and non-medical.

### Expected files and modules
- A plant info route/screen displays species data and actions.
- A species data helper fetches one species and normalizes the `care_profile` shape.
- Shared components can include care card, badge, toxicity banner, and section header.
- Types should define `Species`, `CareProfile`, `Difficulty`, and toxicity display values.

### Data and state flow
- User taps "View care info" from scan results or navigates from a saved plant.
- Screen loads `species` from Supabase using the ID created or returned in Phase 04.
- The care profile is normalized before rendering so missing optional fields do not crash the UI.
- Add-to-collection checks `user_plants` for an existing row with the same `species_id` and current `user_id`.

### Edge cases and failure handling
- If `speciesId` is missing or invalid, show a friendly "plant info unavailable" state.
- If `care_profile` lacks a field, hide that specific card or show a neutral fallback rather than blocking the screen.
- If toxicity is unknown, do not invent safety claims; display "Toxicity unknown" in a subdued style.
- If Supabase is offline/unreachable, show retry and keep navigation available.

### Verification checklist
- A valid `speciesId` displays full species information.
- Care cards render from the JSON profile without another OpenAI request.
- Toxicity and difficulty badges are visible and accurate to source data.
- Existing saved species are detected for the current user.
- "Add to my plants" navigates to the save flow with species context intact.
- Missing or malformed data produces a graceful fallback.

### Handoff to Phase 06
Phase 06 should use the species context and optional scan photo from this screen to create a user-owned `user_plants` row and upload the display photo.
