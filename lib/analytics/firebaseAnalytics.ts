import {
  ANALYTICS_EVENTS,
  type AnalyticsEventName,
  type AnalyticsParams,
  type AnalyticsTapName,
  type AnalyticsUserProperties
} from "@/lib/analytics/events";
import {
  clearAnalyticsUser,
  setAnalyticsUser,
  trackAction,
  trackScreenView
} from "@/lib/measurement/runtime";

export {
  ANALYTICS_EVENTS,
  ANALYTICS_TAPS,
  toCountBucket
} from "@/lib/analytics/events";
export type {
  AnalyticsEventName,
  AnalyticsParams,
  AnalyticsTapName,
  AnalyticsUserProperties
} from "@/lib/analytics/events";

export const trackFirebaseScreenView = trackScreenView;
export { clearAnalyticsUser, setAnalyticsUser, trackAction, trackScreenView };

export async function trackTap(
  controlName: AnalyticsTapName,
  params?: AnalyticsParams
) {
  await trackAction(ANALYTICS_EVENTS.UI_TAP, {
    control_name: controlName,
    ...params
  });
}
