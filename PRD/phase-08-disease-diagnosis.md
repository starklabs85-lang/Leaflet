# Phase 08 — Disease & Pest Diagnosis

**Goal:** Users can photograph a sick plant and receive an AI-powered diagnosis with cause, treatment plan, and prevention steps — then attach it to a tracked plant with a follow-up reminder.

**Requirements covered:** FR-4 (disease/pest diagnosis via OpenAI vision + treatment plan).

**Depends on:** Phase 04 (Edge Function and OpenAI integration), Phase 06 (plant collection to attach diagnoses to).

---

## What gets built

### 1. Diagnose entry point

Two ways to enter diagnosis mode:

- **From a plant detail screen**: "Diagnose" button on a tracked plant. Pre-associates the diagnosis with that plant.
- **From the Scan tab**: A toggle or second button — "Diagnose a sick plant" alongside the main "Identify" scan. If entered this way, the user selects which plant to attach the diagnosis to afterward (or skips to get a standalone diagnosis).

### 2. Diagnosis capture screen

Similar to the identification capture (Phase 04) but with diagnosis-specific guidance:

- Camera view with overlay text: "Photograph the affected area — yellowing leaves, spots, pests, etc."
- Tips: "Get close-up", "Show the damage clearly", "Include both healthy and affected areas if possible."
- Same capture/gallery options as the ID flow.
- Image compression applied before sending.

### 3. OpenAI Edge Function — diagnosis mode

Extend the `identify-plant` Edge Function (or create a separate `diagnose-plant` function) to handle `scan_type: "diagnose"`.

**Diagnosis prompt (example):**
```
You are a plant disease and pest diagnosis expert. Analyze the provided image of a plant showing signs of distress.

Return a JSON object with this exact structure:
{
  "condition": {
    "name": "string (e.g., 'Root rot', 'Spider mites', 'Powdery mildew')",
    "confidence": 0.0-1.0,
    "category": "disease | pest | nutrient_deficiency | environmental | unknown"
  },
  "cause": "string — likely cause in 1-2 sentences",
  "treatment": [
    "Step 1: ...",
    "Step 2: ...",
    "Step 3: ..."
  ],
  "prevention": "string — how to prevent recurrence in 1-2 sentences",
  "severity": "mild | moderate | severe",
  "follow_up_days": number (suggested days until re-check),
  "is_healthy": true/false
}

If the plant appears healthy, set is_healthy to true.
If you cannot determine the condition, set confidence below 0.3 and explain in the cause field.
Treatment steps should be specific and actionable for a home gardener.
```

**Additional context**: If the diagnosis was initiated from a tracked plant, include the species name in the prompt for better accuracy:
```
The plant is a [common_name] ([scientific_name]).
```

### 4. Diagnosis result screen

**If the plant appears healthy:**
- "Your plant looks healthy!" message with a leaf illustration.
- Suggestions: "If something still looks off, try photographing the specific area more closely."

**If a condition is identified:**

#### Condition header
- Condition name (large text).
- Severity badge: Mild (green), Moderate (amber), Severe (red).
- Confidence level.
- Category tag (Disease, Pest, Nutrient deficiency, Environmental).

#### Cause section
- "Likely cause" with the AI-generated explanation.

#### Treatment plan
- Numbered step-by-step instructions.
- Each step is a clear, actionable item.
- Checkbox-style formatting (for readability, not interactive in MVP).

#### Prevention
- Brief prevention tips.

#### Advisory disclaimer
- Prominent but non-intrusive text: "This diagnosis is AI-generated and advisory. For serious plant health concerns, consult a local nursery or extension service."
- This is a risk mitigation requirement from the PRD.

#### Actions
- **"Attach to [plant name]"** — saves the diagnosis to the `diagnoses` table linked to the `user_plant_id`.
  - Updates the plant's `status` to `needs_attention` or `sick` based on severity.
  - Sets a follow-up reminder date (`follow_up_date = today + follow_up_days`).
- **"Save without plant"** — saves the diagnosis to `diagnoses` with `user_plant_id = null`.
- **"Scan again"** — return to the camera for another attempt.

### 5. Diagnosis history on plant detail

On the plant detail screen (Phase 06), add a "Diagnosis history" section:

- List of past diagnoses for this plant.
- Each entry: condition name, date, severity badge.
- Tapping an entry expands to show the full treatment plan.
- Follow-up reminders show as care tasks (or as a note on the timeline).

### 6. Follow-up reminder

When a diagnosis is attached to a plant with a `follow_up_days` value:
- Insert a `care_task` of type `check_diagnosis` with `next_due_date = today + follow_up_days`.
- This appears in the dashboard alongside regular care tasks.
- When the user completes the follow-up, they can re-scan to check progress.

---

## Acceptance criteria

- [ ] "Diagnose" button is available on the plant detail screen.
- [ ] Diagnosis mode is available from the Scan tab as a secondary option.
- [ ] Submitting a photo of a sick plant returns a condition, cause, treatment, and prevention.
- [ ] The treatment plan is displayed as a clear step-by-step list.
- [ ] Severity and confidence are visually indicated.
- [ ] The advisory disclaimer is visible on every diagnosis result.
- [ ] A diagnosis can be attached to a tracked plant and appears in its diagnosis history.
- [ ] Attaching a diagnosis updates the plant's status and sets a follow-up reminder.
- [ ] A healthy plant photo returns a "looks healthy" message.
- [ ] Diagnosis results are cached (same image → same result without re-calling OpenAI).

---

## Tech notes

- **Same Edge Function, different prompt**: The `identify-plant` function accepts a `scan_type` parameter. When `scan_type = "diagnose"`, use the diagnosis system prompt instead of the identification prompt. This keeps infrastructure simple.
- **Species context improves accuracy**: If the user initiates diagnosis from a tracked plant, pass the species name in the prompt. "This is a Monstera deliciosa showing signs of distress" gives the AI better context than a generic "diagnose this plant."
- **`follow_up_days`**: The AI suggests a re-check interval. Default to 7 if the AI doesn't provide one. Insert it as a `care_task` so it flows naturally into the dashboard and notification system.
- **Status transitions**: When a diagnosis is attached:
  - `severity: "mild"` → `status: "needs_attention"`
  - `severity: "moderate"` or `"severe"` → `status: "sick"`
  - After a follow-up scan shows healthy → manually set `status: "healthy"` (no auto-transition in MVP).
- **Disclaimer**: Consider making this configurable or easily updatable — regulatory requirements may vary by market.

---

## Full implementation plan

### Implementation objective
Add an AI-assisted diagnosis flow for sick plants that uses the existing scan infrastructure, clearly communicates uncertainty, stores diagnosis history, and attaches follow-up actions to tracked plants.

### Ordered build tasks
1. Add a Diagnose action on plant detail and a secondary diagnose mode in the Scan tab.
2. Reuse the camera/gallery capture and preview flow from Phase 04 with diagnosis-specific guidance copy.
3. Extend the Edge Function to accept `scan_type: "diagnose"` and use a diagnosis-specific OpenAI prompt and response contract.
4. Check `scan_cache` using image hash plus diagnosis scan type before calling OpenAI.
5. Validate diagnosis JSON before returning it to the client.
6. Build the diagnosis result screen with condition, confidence, severity, cause, treatment steps, prevention steps, and disclaimer.
7. Allow diagnosis results to be attached to a selected tracked plant.
8. Insert a `diagnoses` row and update the plant status when a diagnosis is attached.
9. Add diagnosis history to the plant detail screen.
10. Add follow-up reminder behavior using `follow_up_date` and later notification integration.

### Expected files and modules
- Diagnosis mode reuses scan capture components where possible.
- Diagnosis result screen owns treatment display, disclaimer, attach action, and healthy-result state.
- Edge Function branches by `scan_type` but shares auth, hash, cache, and OpenAI client setup.
- Diagnosis API helper normalizes service errors into app-safe messages.
- Types define diagnosis result, severity, treatment step, and attach diagnosis input.

### Data and state flow
- User starts diagnosis from a plant detail or Scan tab.
- App submits compressed image with `scan_type: "diagnose"`.
- Edge Function returns cached diagnosis or calls OpenAI and stores the result in `scan_cache`.
- User reviews the diagnosis result before attaching it.
- Attaching creates a `diagnoses` row linked to `user_plant_id` and `user_id`.
- Plant status changes to `sick` or `needs_attention` based on severity, while healthy results do not unnecessarily alarm the user.

### Safety and copy requirements
- Always show the advisory disclaimer on diagnosis result screens.
- Avoid medical-style certainty; use "may be", "likely", and confidence indicators.
- Encourage contacting a local nursery or expert for severe or unclear cases.
- Treatment steps should be practical and ordered.

### Edge cases and failure handling
- A healthy plant photo should show a reassuring healthy-result state.
- A low-confidence diagnosis should emphasize retaking the photo and checking alternates if available.
- Diagnosis without a selected tracked plant should still show results but prompt the user to attach or save later.
- If attaching fails, preserve the result in screen state so the user can retry.
- Cached diagnosis results must not overwrite user-specific diagnosis history unless the user explicitly attaches them.

### Verification checklist
- Diagnose can start from plant detail.
- Diagnose mode can start from Scan tab.
- Sick plant photo returns condition, cause, treatment, prevention, severity, and confidence.
- Disclaimer appears on every diagnosis result.
- Diagnosis attaches to a tracked plant and appears in history.
- Plant status updates after attachment.
- Healthy image returns a healthy message.
- Exact same diagnosis image uses cache on the second attempt.

### Handoff to Phase 09
Phase 09 should include diagnosis follow-up reminders and dashboard health summaries using plant status and diagnosis data created here.
