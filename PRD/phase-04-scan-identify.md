# Phase 04 — Scan & Identify

**Goal:** A user can take a photo of a plant (or pick from their library) and receive a species identification with confidence levels and alternates — the core "aha" moment of the app.

**Requirements covered:** FR-1 (photo capture & library upload), FR-2 (species ID via OpenAI vision).

**Depends on:** Phase 03 (Edge Function scaffold, `species` table, `scan_cache` table).

---

## What gets built

### 1. Camera & photo capture screen

- The **Scan tab** opens a full-screen camera view using `expo-camera`.
- Capture guidance overlay:
  - Centered frame/reticle to guide framing of the plant.
  - Brief text hint: "Center the plant — get a clear shot of the leaves."
- Two entry points:
  - **Camera shutter button** — captures a photo directly.
  - **Gallery button** — opens `expo-image-picker` to select from the photo library.
- Request camera permission in-context (when user first taps Scan), not during onboarding.
- After capture/selection:
  - Show a preview of the image with "Use this photo" / "Retake" options.
  - Compress/resize the image client-side before uploading (target ~1MB max, JPEG quality 0.8).

### 2. OpenAI Edge Function — identification

Flesh out the `identify-plant` Edge Function from Phase 03.

**Request flow:**
1. Receive the image as base64 + `scan_type: "identify"` from the app.
2. Compute a hash of the image content.
3. Check `scan_cache` for a matching hash — if found, return the cached result immediately.
4. If no cache hit, call the OpenAI API:
   - Model: `gpt-4o` (or latest vision-capable model).
   - System prompt (example):
     ```
     You are a plant identification expert. Analyze the provided image and identify the plant species.
     
     Return a JSON object with this exact structure:
     {
       "primary": {
         "common_name": "string",
         "scientific_name": "string",
         "confidence": 0.0-1.0,
         "description": "1-2 sentence description"
       },
       "alternates": [
         { "common_name": "string", "scientific_name": "string", "confidence": 0.0-1.0 }
       ],
       "care_profile": {
         "light": "string (e.g., 'Bright indirect light')",
         "water": "string (e.g., 'Water when top inch of soil is dry')",
         "humidity": "string",
         "temperature": "string (e.g., '65-80°F / 18-27°C')",
         "soil": "string",
         "feeding": "string",
         "difficulty": "easy | moderate | hard",
         "toxicity": "string (e.g., 'Toxic to cats and dogs')"
       },
       "is_plant": true/false
     }
     
     If the image does not contain a plant, set is_plant to false and omit other fields.
     Provide 2-4 alternates ranked by confidence. Be specific about species, not just genus.
     ```
5. Validate the JSON response shape.
6. Insert the result into `scan_cache` (keyed by image hash).
7. Upsert the species into the `species` table if it's new (match on `scientific_name`).
8. Return the structured result to the app.

**Error handling:**
- If OpenAI returns a non-plant image → return `{ is_plant: false }` with a friendly message.
- If OpenAI API fails → return a 503 with a retry suggestion.
- Rate limit: max 10 scans per user per hour (check against a simple counter or `care_logs` count).

### 3. Results screen

After the Edge Function returns:
- **Not a plant:** Show a friendly "We couldn't find a plant in this photo" message with a retry button.
- **Plant identified:**
  - **Primary result card:**
    - Common name (large), scientific name (smaller, italic).
    - Confidence badge: High (green, >0.8), Medium (amber, 0.5-0.8), Low (red, <0.5).
    - 1-2 sentence description.
  - **Alternates section:**
    - 2-4 alternate species as tappable cards.
    - Tapping an alternate selects it as the primary result.
  - **Action buttons:**
    - "View care info" → navigates to plant info screen (Phase 05).
    - "Add to my plants" → navigates to collection save flow (Phase 06).
    - "Scan again" → returns to camera.

### 4. Loading state

- The OpenAI call takes 2-5 seconds. Show an engaging loading state:
  - Leaf animation or pulsing plant icon.
  - Text: "Identifying your plant..."
  - Show the captured photo in the background (blurred or dimmed).

---

## Acceptance criteria

- [ ] Tapping the Scan tab opens the camera with a capture guidance overlay.
- [ ] Taking a photo shows a preview with Use/Retake options.
- [ ] Picking from the photo library works identically to camera capture.
- [ ] Submitting a plant photo returns a species identification within ~5 seconds.
- [ ] The primary result shows common name, scientific name, and a confidence level.
- [ ] 2-4 alternate species are displayed and tappable.
- [ ] Submitting a non-plant photo returns a clear "not a plant" message.
- [ ] Scanning the same image a second time returns a cached result (faster, no OpenAI call).
- [ ] The Edge Function does not expose the OpenAI API key to the client.

---

## Tech notes

- **Image compression**: Use `expo-image-manipulator` to resize to max 1024px on the longest edge and compress to JPEG 0.8 before sending. This reduces upload time and OpenAI token cost.
- **Base64 vs. URL**: For the MVP, send the image as base64 in the Edge Function request body. This avoids needing a signed Storage URL flow. If payload size becomes an issue, switch to uploading to Storage first and passing the URL.
- **Image hashing**: Use a simple hash (e.g., SHA-256 of the base64 string) for the cache key. Exact matches only — no perceptual hashing in the MVP.
- **OpenAI model**: Use `gpt-4o` for the best balance of vision quality and cost. The response format should use `response_format: { type: "json_object" }` to enforce JSON output.
- **Prompt iteration**: The identification prompt is the single most impactful thing for accuracy. Plan to iterate on it based on testing. Start with the structure above, then refine based on real-world results.

---

## Full implementation plan

### Implementation objective
Deliver the core scan-to-identification loop: capture or select a plant photo, send a compressed image through the Supabase Edge Function, receive a structured OpenAI result, and display actionable identification results without exposing secrets to the client.

### Ordered build tasks
1. Build the Scan tab with camera permission handling, camera preview, guidance overlay, shutter button, and gallery entry point.
2. Add image preview with Use/Retake actions for both camera captures and selected library images.
3. Add client-side image manipulation to resize and compress images before upload.
4. Implement the app-side function invocation wrapper for `identify-plant` with auth headers and typed responses.
5. Replace the Phase 03 placeholder Edge Function logic with hash calculation, cache lookup, OpenAI request, JSON validation, species upsert, cache insert, and structured response.
6. Build a scan loading screen or state that keeps the captured image visible while analysis runs.
7. Build the result screen with primary result, confidence badge, alternates, not-a-plant state, and actions for care info, save flow, or scan again.
8. Add user-safe error messages for timeout, network failure, invalid image, non-plant image, and low confidence.
9. Add a simple per-user scan rate limit in the Edge Function.
10. Ensure no OpenAI API key or service-role credential is referenced from app code.

### Expected files and modules
- Scan screen under the authenticated tabs owns capture and selection UX.
- A scan result route owns display of primary/alternate species and next actions.
- `lib/api/identifyPlant.ts` invokes the Supabase Edge Function and normalizes errors.
- `supabase/functions/identify-plant/index.ts` owns OpenAI calls, cache, and species writes.
- Shared types describe identify request, identify result, alternate species, care profile, and not-a-plant response.

### Data and state flow
- User grants camera or library permission in context.
- App captures/selects an image and compresses it to the agreed size target.
- App sends base64 image plus `scan_type: "identify"` to the Edge Function.
- Function verifies the user JWT, hashes the image, checks `scan_cache`, and returns cached results when present.
- On a cache miss, function calls OpenAI, validates JSON, upserts `species`, inserts `scan_cache`, and returns the result.
- Client stores only the result needed for navigation and display; persistent species data lives in Supabase.

### Edge cases and failure handling
- Permission denied should show a clear path to open settings or use gallery where possible.
- Non-plant images should not be treated as errors; show the designed retry state.
- Low-confidence results should emphasize alternates and encourage another photo angle.
- OpenAI timeout or malformed JSON should return a friendly retryable error from the function.
- Re-scanning the exact same image should use the cache and avoid a second OpenAI call.

### Verification checklist
- Camera opens from the Scan tab and captures an image.
- Gallery selection follows the same preview and submit path.
- Compressed image payload is accepted by the Edge Function.
- A real plant photo returns primary species data and alternates.
- A non-plant photo returns the not-a-plant UI.
- Cache hit is measurably faster and does not call OpenAI again.
- OpenAI and service-role secrets are absent from the Expo bundle.

### Handoff to Phase 05
Phase 05 should consume the `species` record and scan result from this phase to render a stable care profile screen without triggering another AI call.
