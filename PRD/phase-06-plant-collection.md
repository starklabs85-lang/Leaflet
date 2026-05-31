# Phase 06 — Plant Collection

**Goal:** Users can save identified plants to a personal collection with a nickname and location, then browse and manage their plants — the "add to my collection" step of the core loop.

**Requirements covered:** FR-5 (save plant to collection with nickname & location).

**Depends on:** Phase 05 (plant info screen provides the "Add to my plants" entry point), Phase 03 (database schema).

---

## What gets built

### 1. Save plant flow

Triggered from:
- Plant info screen ("Add to my plants" button).
- Scan results screen ("Add to my plants" button).

**Save modal / screen:**
- Pre-filled with the species common name.
- Fields:
  - **Photo**: The scanned photo is pre-attached. Option to retake or choose a different photo.
  - **Nickname** (optional): Text input, e.g., "Living room Monstera". Defaults to the common name if left blank.
  - **Location** (optional): Selectable tags or free text — e.g., "Living room", "Bedroom", "Balcony", "Office", "Kitchen", "Bathroom". Pre-defined options + custom entry.
- **"Save plant"** button:
  - Uploads the photo to Supabase Storage (`plant-photos/{user_id}/{plant_id}/`).
  - Inserts a row into `user_plants` with `user_id`, `species_id`, `nickname`, `location`, `photo_url`.
  - Auto-generates care tasks (Phase 07 will implement the scheduling logic, but the row creation happens here or is deferred to Phase 07).
  - Navigates to the plant detail screen.
- **Success confirmation**: Brief toast or inline confirmation — "Monstera added to your collection!"

### 2. My Plants tab (collection list)

The **My Plants** tab in the bottom navigation shows all saved plants.

**List layout:**
- If the collection is empty: an empty state with illustration and "Scan your first plant" CTA button (links to Scan tab).
- If plants exist: a vertical list (or 2-column grid) of plant cards.

**Plant card:**
- Plant photo (thumbnail from Storage).
- Nickname (or common name if no nickname).
- Species name (smaller text).
- Location tag (if set).
- Status indicator dot: green (healthy), amber (needs attention), red (sick).
- Next care task preview: e.g., "Water in 2 days" (once Phase 07 is done).

**Sorting/filtering (keep simple for MVP):**
- Default: sorted by most recently added.
- Optional: filter by location tag.

### 3. Plant detail screen

Tapping a plant card opens the full detail view.

**Sections:**
- **Header**: Large photo, nickname, species name, status badge.
- **Quick actions bar**: Water, Fertilize, Note (quick-log buttons — functional in Phase 07).
- **Care info link**: "View care guide" → navigates to the plant info screen (Phase 05) for this species.
- **Care schedule summary**: Upcoming tasks (functional in Phase 07, placeholder for now).
- **Care history**: Recent logs (functional in Phase 07, placeholder for now).
- **Diagnosis history**: Past diagnoses (functional in Phase 08, placeholder for now).
- **Edit button**: Opens edit modal to change nickname, location, or photo.
- **Delete button**: Remove the plant from the collection (with confirmation dialog).

### 4. Edit plant

- Modal or screen to update:
  - Nickname.
  - Location.
  - Photo (replace with new capture or gallery pick).
  - Status (manual override: healthy / needs attention / sick).
- Changes saved to `user_plants` table.

### 5. Delete plant

- Confirmation dialog: "Remove [nickname] from your collection? This will also delete its care schedule and history."
- Deletes the `user_plants` row (cascades to `care_tasks`, `care_logs`, `diagnoses` via foreign key).
- Deletes associated photos from Storage.
- Returns to the collection list.

---

## Acceptance criteria

- [ ] After scanning and viewing info, tapping "Add to my plants" opens the save flow.
- [ ] User can set a nickname and location before saving.
- [ ] The plant photo is uploaded to Supabase Storage.
- [ ] The plant appears in the My Plants tab after saving.
- [ ] My Plants tab shows all saved plants with photo, name, and location.
- [ ] Empty collection shows a clear empty state with a CTA to scan.
- [ ] Tapping a plant card opens the detail screen.
- [ ] Editing a plant's nickname/location/photo works and persists.
- [ ] Deleting a plant removes it from the collection with a confirmation step.
- [ ] Data is scoped per user — User A cannot see User B's plants.

---

## Tech notes

- **Photo upload**: Use `supabase.storage.from('plant-photos').upload(path, file)`. The path convention is `{user_id}/{plant_id}/{filename}`. Generate a public URL with `getPublicUrl()` for display.
- **Collection query**: `supabase.from('user_plants').select('*, species(*)').eq('user_id', userId).order('date_added', { ascending: false })` — join with species to get names and care info in one query.
- **Optimistic UI**: When saving a plant, add it to the local list immediately while the upload/insert happens in the background. Show a loading indicator on the card until confirmed.
- **Image caching**: Use `expo-image` or React Native's built-in `Image` with caching for thumbnails. Storage URLs are stable, so standard HTTP caching works.
- **Location tags**: Store as a plain text field in `user_plants`. The predefined list is UI-only — the database stores whatever the user types. No separate locations table needed.

---

## Full implementation plan

### Implementation objective
Allow users to turn an identified species into a personal tracked plant, then browse, edit, view, and delete their own plants. This phase establishes the personal collection as the center of the app experience.

### Ordered build tasks
1. Build the save flow launched from plant info or scan results with species context and optional source photo.
2. Let users provide nickname and location with sensible defaults from common name and empty location.
3. Upload the chosen plant photo to the `plant-photos` bucket using the agreed folder convention.
4. Insert a `user_plants` row with current `user_id`, `species_id`, nickname, location, status, photo URL, and date added.
5. Build the My Plants tab with loading state, empty state, and collection grid/list.
6. Build plant cards showing photo, nickname or common name, location, and status.
7. Build the plant detail screen with species summary, photo, care entry points, diagnosis entry point placeholder, and edit/delete actions.
8. Build edit behavior for nickname, location, and photo replacement.
9. Build delete behavior with confirmation and cleanup expectations for dependent records through cascade rules.
10. Add user-scoped fetch helpers so every collection query filters by the authenticated user.

### Expected files and modules
- Save plant screen owns nickname, location, photo upload, and row insert.
- My Plants tab owns collection list, empty state, and pull-to-refresh.
- Plant detail screen owns per-plant display and entry points for later phases.
- Collection API helpers wrap `user_plants`, joined species data, and storage upload calls.
- Shared types define saved plant list item, detail item, and save/edit input.

### Data and state flow
- User arrives with `speciesId` and optionally a local scan image URI or remote photo URL.
- App uploads photo first when needed, then inserts or updates the `user_plants` row.
- Collection list fetches current user's plants joined to species data.
- Detail screen fetches one current-user plant by ID and prevents cross-user access through both query filters and RLS.
- Edits update only user-owned records.

### Edge cases and failure handling
- If photo upload succeeds but row insert fails, show retry and avoid duplicate uploads where practical.
- If the user saves without a custom nickname, use the species common name for display.
- If a plant photo is missing, render a designed botanical placeholder.
- Deleting a plant should warn that care history and diagnoses attached to that plant will also be removed or hidden.
- Cross-user access should fail safely with "plant not found" rather than raw authorization errors.

### Verification checklist
- Save flow creates a `user_plants` row for the signed-in user.
- Uploaded photo appears on the saved plant card and detail screen.
- My Plants shows all and only the current user's plants.
- Empty state includes a CTA back to Scan.
- Edit changes persist after app restart.
- Delete removes the plant from the list after confirmation.
- User A cannot view or modify User B's plant by ID.

### Handoff to Phase 07
Phase 07 should attach care tasks and logs to `user_plants.id` records created here and surface care actions on the plant detail screen.
