# Phase 11 — Growth Photo Timeline & Care Streaks

**Goal:** Add a visual growth timeline per plant and a gamified care streak system — two retention drivers that deepen engagement after the core loop is proven.

**Requirements covered:** FR-13 (growth photo timeline per plant), FR-14 (care streak / completion stat).

**Depends on:** Phases 01–10 (shipped MVP).

**Phase type:** Fast follow (post-MVP).

---

## What gets built

### 1. Growth photo timeline

#### Adding growth photos
- On the plant detail screen, add a "Add growth photo" button (camera icon).
- Captures or picks a photo, uploads to `plant-photos/{user_id}/{plant_id}/timeline/`.
- Stores a `care_logs` entry with `task_type = 'growth_photo'` and the `photo_url`.
- Optional: add a brief note with the photo.

#### Timeline view
- On the plant detail screen, a horizontal scroll or vertical timeline of growth photos.
- Each entry: photo thumbnail, date, optional note.
- Tapping a photo opens it full-screen.
- Visual progression: seeing the plant grow over time is the emotional payoff.

#### Timeline layout options
- **Horizontal scroll**: Photo thumbnails in a filmstrip with dates below. Compact, fits in the detail screen without taking over.
- **Full timeline screen**: Accessible via "View timeline" link. Vertical layout with larger photos, dates, and notes. Better for plants with many photos.

For the MVP fast-follow, start with the horizontal scroll on the detail screen.

### 2. Care streaks

#### What is a streak?
- A streak counts consecutive days the user completed all due care tasks.
- If all tasks due on a given day are logged, the streak continues.
- If any task goes unlogged past its due date, the streak breaks.
- Days with no due tasks don't break the streak — they're neutral.

#### Streak calculation
- Query `care_tasks` and `care_logs` to determine:
  - For each day going backward from today, were all due tasks completed?
  - Count consecutive completed days.
- Cache the current streak value to avoid recalculating on every load (store in `AsyncStorage` or a user-level field in Supabase).

#### Streak display
- **Dashboard**: Show a streak counter near the health ring.
  - Fire emoji + "12-day care streak" (or similar).
  - If streak is 0: "Start a streak — complete today's tasks!"
- **Plant detail**: Per-plant mini streak (optional, only if it adds value without clutter).
- **Milestone celebrations**: At 7, 14, 30, and 100 days, show a brief celebratory animation or modal.

### 3. Completion stats

On the dashboard or a dedicated stats section:

- **Weekly completion rate**: % of due tasks completed this week.
- **Monthly summary**: total care actions logged, plants added, diagnoses run.
- **Best streak**: all-time longest streak.

Keep this lightweight — 3-4 stats, not a full analytics dashboard.

### 4. Schema additions

```sql
-- No new tables needed. Growth photos use care_logs with task_type = 'growth_photo'.
-- Streak can be calculated from existing care_tasks + care_logs data.

-- Optional: add a streak cache column to avoid recalculation
-- alter table ... (or store in AsyncStorage for simplicity)
```

---

## Acceptance criteria

- [ ] Users can add a growth photo to any tracked plant.
- [ ] Growth photos appear in a timeline view on the plant detail screen.
- [ ] Photos are stored in Supabase Storage and display correctly.
- [ ] A care streak counter appears on the dashboard.
- [ ] The streak increments when all due tasks are completed for the day.
- [ ] The streak resets when a task goes overdue without being logged.
- [ ] Milestone celebrations trigger at 7, 14, 30, and 100 days.
- [ ] Weekly completion rate is visible on the dashboard.

---

## Tech notes

- **Growth photos reuse `care_logs`**: No new table needed. A log entry with `task_type = 'growth_photo'` and a `photo_url` is sufficient. The timeline view queries `care_logs WHERE task_type = 'growth_photo' AND user_plant_id = X ORDER BY logged_at`.
- **Streak calculation complexity**: Computing streaks from raw data requires iterating backward through days and checking task completion. For a solo dev MVP, calculating on demand is fine for users with modest collections. If performance becomes an issue, cache the streak value and update it on each care log.
- **Animations**: Use `react-native-reanimated` for streak milestone celebrations (confetti, bouncing leaf). Keep it subtle — the PRD emphasizes pleasant, not flashy.
- **Storage costs**: Growth photos accumulate. Compress to JPEG 0.8 and resize to max 1200px to keep storage costs reasonable.

---

## Full implementation plan

### Implementation objective
Add post-MVP retention features that make ongoing care feel rewarding: visual growth photos and care streaks. This phase should reuse existing storage and care log infrastructure wherever possible.

### Ordered build tasks
1. Add an "Add growth photo" action to plant detail.
2. Reuse camera/gallery capture and image compression from scan flows.
3. Upload growth photos to `plant-photos/{user_id}/{plant_id}/timeline/`.
4. Store each growth photo as a `care_logs` entry with `task_type = "growth_photo"`, `photo_url`, and optional note.
5. Add a horizontal timeline section to plant detail showing photo thumbnails, dates, and notes.
6. Add full-screen photo viewing from timeline thumbnails.
7. Implement streak calculation from due care tasks and completed care logs.
8. Display current streak and weekly completion rate on the dashboard.
9. Add milestone celebrations at 7, 14, 30, and 100 days.
10. Cache or memoize streak results if dashboard load becomes slow.

### Expected files and modules
- Growth photo action reuses existing image capture/upload helpers.
- Plant detail gains a timeline section without replacing core care sections.
- Streak helper calculates current streak, best streak if implemented, and weekly completion rate.
- Dashboard displays streak and completion stats in a compact retention card.

### Data and state flow
- User adds a growth photo from plant detail.
- App uploads the photo to the plant timeline folder.
- App inserts a `care_logs` row so timeline data can be queried with existing history infrastructure.
- Streak calculation reads tasks and logs, working backward from today.
- Dashboard displays calculated streaks and stats from current user data.

### Streak rules
- A streak day counts when all tasks due that day are completed.
- Days with no due tasks are neutral and do not break the streak.
- Missed overdue tasks break the streak.
- Disabled tasks are ignored.
- Milestone celebrations should trigger once per milestone achievement, not every app open.

### Edge cases and failure handling
- Failed photo upload should not create a timeline log without a usable photo URL.
- If a timeline photo is missing, show a placeholder and keep the date/note visible.
- Streak calculation should handle users with no tasks or no logs gracefully.
- Large plant collections should avoid expensive repeated recalculation on every render.

### Verification checklist
- Growth photo can be captured or selected.
- Growth photo uploads and appears in the plant timeline.
- Timeline photos open full-screen.
- Current streak matches known task/log scenarios.
- Missed overdue task resets the streak.
- No-task days do not reset the streak.
- Weekly completion rate displays on dashboard.
- Milestone celebration appears at configured thresholds.

### Handoff to Phase 12
Phase 12 can use growth photo limits and advanced stats as premium value, but the free experience should remain useful and non-punitive.
