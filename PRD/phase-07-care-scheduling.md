# Phase 07 — Care Scheduling & Logging

**Goal:** Each saved plant gets an auto-generated, editable care schedule, and users can quickly log care actions — the "keep it alive" engine that drives retention.

**Requirements covered:** FR-6 (auto-generated editable care schedule), FR-7 (quick-log care actions & metric history).

**Depends on:** Phase 06 (plants exist in the collection), Phase 05 (care profile data available per species).

---

## What gets built

### 1. Auto-generate care schedule on plant save

When a plant is saved to the collection (Phase 06), generate default `care_tasks` rows based on the species `care_profile`.

**Default schedule mapping** (derive intervals from the AI-generated care profile text):

| Task type | Default interval | Parse from |
|-----------|-----------------|------------|
| Water | 7 days (adjust by species) | `care_profile.water` |
| Fertilize | 30 days | `care_profile.feeding` |
| Rotate | 14 days | Always included |
| Mist | 3 days (if humidity needs are high) | `care_profile.humidity` |

**Parsing logic:**
- The care profile text is natural language (e.g., "Water every 5-7 days, allowing soil to dry between waterings").
- Use simple keyword/pattern matching to extract intervals:
  - "every X days" → interval = X
  - "weekly" → 7 days
  - "bi-weekly" / "every two weeks" → 14 days
  - "monthly" → 30 days
  - "daily" → 1 day
- If parsing fails, use sensible defaults (water: 7 days, fertilize: 30 days).
- Set `next_due_date` to today + interval for each task.

**Insert `care_tasks` rows** for each applicable task type tied to the `user_plant_id`.

### 2. Care schedule view (on plant detail screen)

On the plant detail screen (Phase 06), show the upcoming care schedule:

**Upcoming tasks list:**
- Each task shows: type icon, task name ("Water", "Fertilize"), next due date, frequency.
- Color coding:
  - Green: due in 2+ days.
  - Amber: due tomorrow.
  - Red: overdue.
- Tasks sorted by `next_due_date` ascending.

**Edit schedule:**
- Tap a task to edit its interval (e.g., change watering from 7 days to 5 days).
- Toggle tasks on/off (e.g., disable "Rotate" if the user doesn't want it).
- Changes update the `care_tasks` row.

### 3. Quick-log care actions

**Quick-log buttons** on the plant detail screen:

A row of action buttons: Water, Fertilize, Repot, Prune, Mist, Note.

**Tapping a quick-log button:**
1. Inserts a `care_logs` row with `user_plant_id`, `task_type`, `logged_at = now()`.
2. Updates the corresponding `care_tasks.next_due_date` to `today + interval_days`.
3. Visual feedback: button briefly animates (checkmark, color flash).
4. Optional: add a note or photo to the log entry (expandable, not required).

**Quick-log from the dashboard (Phase 09):**
- The same action is available from task cards on the home screen.
- Tapping "Done" on a dashboard task card triggers the same logic.

### 4. Care history

On the plant detail screen, below the schedule:

**History list:**
- Chronological list of past care actions.
- Each entry: icon, task type, date/time, optional note.
- Grouped by date (e.g., "Today", "Yesterday", "May 25").
- Scrollable, with "Load more" if the list is long.

**Data source:** `care_logs` table filtered by `user_plant_id`, ordered by `logged_at DESC`.

### 5. Next-due-date recalculation

When a care action is logged:
- `next_due_date = today + interval_days` for the corresponding `care_task`.
- If the task was overdue (e.g., due 3 days ago, logged today), recalculate from today, not from the original due date. This prevents cascading overdue states.

---

## Acceptance criteria

- [ ] Saving a new plant auto-generates care tasks with species-appropriate intervals.
- [ ] The plant detail screen shows upcoming care tasks sorted by due date.
- [ ] Overdue tasks are visually distinct (red/amber) from upcoming tasks.
- [ ] Tapping a quick-log button records the action and advances the next due date.
- [ ] Quick-log provides immediate visual feedback (animation or checkmark).
- [ ] Care task intervals are editable — changing from 7 to 5 days persists.
- [ ] Care tasks can be toggled on/off.
- [ ] Care history shows a chronological list of past logged actions.
- [ ] A note can optionally be attached to a care log entry.

---

## Tech notes

- **Interval parsing**: Don't over-engineer the natural language parsing. A simple regex/keyword approach handles the most common patterns. Fall back to defaults for anything ambiguous. This can be improved iteratively.
- **Timezone handling**: Store `next_due_date` as a `date` (not `timestamptz`) since care tasks are day-level, not minute-level. The app displays them relative to the user's local date.
- **Batch operations**: When the user logs "Water" for a plant, only the water task's `next_due_date` updates — not all tasks. Each task type is independent.
- **Optimistic updates**: Update the UI immediately when the user taps a quick-log button. The Supabase insert/update happens in the background. If it fails, revert the UI and show an error.
- **Query for due tasks**: `supabase.from('care_tasks').select('*, user_plants(nickname, photo_url, species(*))').eq('user_id', userId).lte('next_due_date', today).eq('is_active', true)` — this powers the dashboard in Phase 09.

---

## Full implementation plan

### Implementation objective
Convert saved plants into an actionable care system. Each plant should receive editable care tasks, users should be able to quickly log care, and the app should maintain a useful history of completed care actions.

### Ordered build tasks
1. Define care task generation rules that map `species.care_profile` values into initial task types and intervals.
2. Trigger task generation immediately after a plant is saved, or on first plant detail load if tasks do not exist.
3. Display upcoming and overdue care tasks on the plant detail screen.
4. Add quick-log buttons for each active due task.
5. On quick-log, insert a `care_logs` row and advance `care_tasks.next_due_date` by its interval.
6. Add edit controls for interval days, task active/inactive state, and optional task notes if needed.
7. Add care history as a chronological list filtered by plant.
8. Add optional freeform note capture when logging care.
9. Add optimistic UI feedback only when the app can safely roll back on failure.
10. Keep task logic in service/helper functions rather than route files.

### Expected files and modules
- Care task service owns generation, due task fetches, quick-log, and interval updates.
- Plant detail screen displays upcoming care and history sections.
- Reusable task card and log row components keep dashboard reuse possible in Phase 09.
- Types define care task type, care task row, care log row, and quick-log input.

### Data and state flow
- New plant creation produces one or more `care_tasks` rows for that user and plant.
- Plant detail fetches active tasks ordered by due date and care logs ordered by logged date descending.
- Quick-log writes a log and updates the matching task in a single logical operation.
- Dashboard in Phase 09 will reuse the same due task query across all plants.

### Scheduling rules
- Use conservative defaults when AI care profile text is vague.
- Watering should usually be generated first because it is the highest-frequency task.
- Fertilize, rotate, prune, mist, and repot should be optional based on available profile hints.
- Intervals must be user-editable because plant environment varies.

### Edge cases and failure handling
- If task generation fails after plant save, show the plant but surface a retry to create schedule.
- If quick-log insert succeeds but due-date update fails, flag the task for retry and avoid double-counting logs.
- Overdue tasks should remain visible until logged or disabled.
- Disabled tasks should not appear in due lists or notifications.
- Invalid interval values should be rejected before saving.

### Verification checklist
- Saving a plant creates initial care tasks.
- Plant detail shows tasks in due-date order.
- Overdue tasks are visually distinct.
- Quick-log creates a history row and advances the next due date.
- Edited intervals persist and affect future due dates.
- Disabled tasks disappear from due lists.
- Care history remains scoped to the selected plant and current user.

### Handoff to Phase 08
Phase 08 should use the plant detail screen entry point established here and can update plant status or create follow-up care tasks after diagnosis.
