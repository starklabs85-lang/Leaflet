# Phase 09 — Dashboard & Notifications

**Goal:** The home screen becomes a command center — showing today's tasks, collection health, and care streaks — with local push notifications that bring users back when tasks are due.

**Requirements covered:** FR-8 (local reminders / notifications), FR-9 (dashboard with tasks, health & charts).

**Depends on:** Phase 07 (care tasks and logs exist), Phase 06 (plant collection data).

---

## What gets built

### 1. Dashboard home screen

The **Home tab** replaces the placeholder from Phase 01 with a fully functional dashboard.

**Layout (top to bottom):**

#### Greeting header
- "Good morning, [name]" (or afternoon/evening based on local time).
- Subtitle: "[N] plants need you today" — count of tasks due today or overdue.

#### Collection health ring
- Circular progress indicator showing overall collection health:
  - % of plants with `status = 'healthy'` out of total plants.
  - Green fill for the healthy percentage, gray for the remainder.
  - Center text: "82% healthy" (example).
- Adjacent stats:
  - Total plants count.
  - Overdue tasks count (amber/red text if > 0).

#### Today's tasks
- Sorted list of care tasks due today or overdue.
- Each task card shows:
  - Plant photo thumbnail.
  - Plant nickname.
  - Task type icon + label ("Water", "Fertilize", etc.).
  - Due status: "Due today" (neutral) or "Overdue 2 days" (red).
  - **"Done" button** — tapping logs the action (same logic as Phase 07 quick-log) and removes the card from the list with an animation.
- If no tasks today: "All caught up! Your plants are happy." with a leaf illustration.

#### My plants preview
- Horizontal scroll of plant cards (subset of the collection).
- Each card: photo, nickname, health dot.
- "See all" link → navigates to the My Plants tab.

#### Watering consistency chart (simple)
- A small line chart showing watering completion rate over the last 8 weeks.
- X-axis: weeks. Y-axis: % of watering tasks completed that week.
- Data source: aggregate `care_logs` where `task_type = 'water'` grouped by week, compared against expected `care_tasks`.
- Use a lightweight chart library like `react-native-chart-kit` or `victory-native`, or a simple custom SVG.

### 2. Dashboard data queries

Aggregate multiple Supabase queries on screen load:

```
// Tasks due today or overdue
care_tasks WHERE next_due_date <= today AND is_active = true
  JOIN user_plants (nickname, photo_url)

// Collection health
user_plants GROUP BY status → calculate healthy %

// Watering consistency (last 8 weeks)
care_logs WHERE task_type = 'water' AND logged_at >= 8 weeks ago
  GROUP BY week
```

Consider a single RPC function or database view to reduce round trips if performance becomes an issue.

### 3. Local notifications

Using `expo-notifications` for local (not push) notifications.

#### Permission request
- Request notification permission **after the user saves their first plant** (in-context, not during onboarding).
- If denied, the app works fine — just no reminders. Show a subtle prompt in settings to re-enable.

#### Scheduling notifications
When a care task is created or its `next_due_date` is updated:
- Schedule a local notification for the morning of the due date (e.g., 9:00 AM local time).
- Notification content:
  - Title: "Time to water [plant nickname]"
  - Body: "[Plant nickname] is thirsty! Tap to log it."
  - Data payload: `{ userPlantId, taskType }` — so tapping the notification deep-links to the plant detail.
- Cancel and reschedule when the task is completed (Phase 07 quick-log already advances `next_due_date`).

#### Overdue notifications
- If a task becomes overdue (not logged by end of due date):
  - Schedule a follow-up notification for the next morning:
    - Title: "Overdue: [task type] [plant nickname]"
    - Body: "[Plant nickname] was due for watering yesterday."
  - Only send one overdue reminder per task (don't spam).

#### Notification management
- On the Profile/Settings screen, add a toggle: "Care reminders" (on/off).
- When off, cancel all scheduled notifications.
- When on, reschedule all active care tasks' notifications.

### 4. Deep linking from notifications

When a user taps a notification:
- The app opens (or foregrounds).
- Navigates directly to the plant detail screen for the relevant plant.
- The "Done" quick-log button is prominently visible so the user can log the action immediately.

---

## Acceptance criteria

- [ ] The Home tab displays a personalized greeting with the time-appropriate salutation.
- [ ] The health ring shows the correct percentage of healthy plants.
- [ ] Today's tasks list shows all due and overdue care tasks.
- [ ] Tapping "Done" on a task card logs the action, removes it from the list, and advances the due date.
- [ ] The "All caught up" empty state appears when no tasks are due.
- [ ] The plant preview section shows a horizontal scroll of collection plants.
- [ ] The watering consistency chart renders with real data from the last 8 weeks.
- [ ] Local notifications fire at 9 AM local time on the day a care task is due.
- [ ] Tapping a notification opens the app and navigates to the relevant plant.
- [ ] Notifications can be toggled on/off in settings.
- [ ] Notification permission is requested in-context, not at first launch.

---

## Tech notes

- **`expo-notifications` local scheduling**: Use `Notifications.scheduleNotificationAsync()` with a `trigger` of type `date` or `daily` at a specific time. For the MVP, schedule individual notifications per task — don't try to batch them.
- **Notification identifiers**: Store the notification ID returned by `scheduleNotificationAsync` so it can be cancelled when the task is completed. Consider storing it in the `care_tasks` row or in local `AsyncStorage`.
- **Chart library**: Keep it simple. `react-native-chart-kit` is lightweight and sufficient for a single line chart. Don't introduce a heavy charting dependency for one graph.
- **Performance**: The dashboard makes 3-4 Supabase queries on load. Use `Promise.all()` to run them in parallel. If the dashboard feels slow, consider a Postgres view or RPC function that returns all the data in one call.
- **Pull to refresh**: Implement pull-to-refresh on the dashboard to re-fetch data. Users will expect this.
- **Notification timing**: 9 AM is a reasonable default. A "preferred reminder time" setting could come in Phase 2 but is overkill for the MVP.

---

## Full implementation plan

### Implementation objective
Make the Home tab the user's daily command center and add local reminders that bring users back when care tasks are due. This phase should reuse care task and plant data rather than creating parallel dashboard-specific state.

### Ordered build tasks
1. Build the Home tab layout with greeting, health summary, today's tasks, plant preview, and consistency chart sections.
2. Fetch all current-user plants, active care tasks due today or overdue, recent care logs, and diagnosis/status data needed for summaries.
3. Calculate health percentage from plant statuses.
4. Calculate watering or care consistency from care logs over the last 8 weeks.
5. Add dashboard task cards with the same quick-log behavior used on plant detail.
6. Add an "All caught up" state when there are no due tasks.
7. Add local notification permission request at the moment the user enables reminders or saves a relevant care schedule.
8. Schedule notifications for active care tasks at 9 AM local time on their due date.
9. Cancel or reschedule notifications when tasks are logged, edited, disabled, or deleted.
10. Add a settings toggle for notifications.
11. Handle notification taps by opening the relevant plant or dashboard task context.

### Expected files and modules
- Home tab composes dashboard cards and summary sections.
- Notification service owns permission requests, scheduling, cancellation, and tap handling.
- Dashboard data helper aggregates plants, due tasks, logs, and health metrics.
- Existing task card and quick-log logic from Phase 07 should be reused.
- Settings/Profile screen exposes notification toggle state.

### Data and state flow
- Dashboard fetches current-user data from Supabase on focus and refresh.
- Quick-log from dashboard writes the same `care_logs` and task due-date updates as plant detail.
- Notification identifiers are stored locally or in a task-linked mapping so they can be cancelled/rescheduled.
- Notification tap payload includes enough plant/task context to route the user after app open.

### Edge cases and failure handling
- If notifications are denied, keep the app usable and explain how to enable them later.
- Time zone changes should not permanently break reminders; reschedule on app foreground where practical.
- Disabled tasks should have their notifications cancelled.
- If dashboard metrics cannot load, show partial content rather than a blank home screen.
- Empty collection should point users to Scan instead of showing useless analytics.

### Verification checklist
- Home greets the user and renders without plants.
- Health ring percentage matches current plant statuses.
- Today's task list includes due and overdue tasks.
- Dashboard quick-log updates task state and history.
- Consistency chart uses real care log data.
- Local notification fires at the scheduled local time.
- Tapping a notification opens the relevant plant or task context.
- Notification toggle disables future reminders and cancels pending ones.

### Handoff to Phase 10
Phase 10 should polish onboarding, errors, accessibility, and launch readiness around the completed core loop rather than adding major new product surface area.
