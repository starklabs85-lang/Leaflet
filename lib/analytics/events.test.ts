import { deepEqual, equal } from "node:assert/strict";

import {
  ANALYTICS_EVENTS,
  ANALYTICS_TAPS,
  sanitizeAnalyticsParams,
  sanitizeAnalyticsUserProperties,
  toCountBucket
} from "./events";

const eventParams = sanitizeAnalyticsParams({
  count: 2,
  control_name: "premium_cta",
  email: "reader@example.com",
  enabled: true,
  exact_location: "12.97,77.59",
  photoUri: "file://private/photo.jpg",
  plant_name: "Monstera",
  raw_error: "stack trace",
  source: "Scan Result",
  undefined_value: undefined
});

deepEqual(eventParams, {
  count: 2,
  control_name: "premium_cta",
  enabled: true,
  source: "scan_result"
});

equal(ANALYTICS_EVENTS.SIGN_IN_TAP, "sign_in_tap");
equal(
  ANALYTICS_TAPS.PREMIUM_MANAGE_SUBSCRIPTION,
  "premium_manage_subscription"
);

deepEqual(
  sanitizeAnalyticsUserProperties({
    care_reminders_enabled: true,
    email: "reader@example.com",
    premium_status: "Premium",
    weather_location_source: "gps"
  }),
  {
    care_reminders_enabled: "true",
    premium_status: "premium",
    weather_location_source: "gps"
  }
);

equal(toCountBucket(0), "0");
equal(toCountBucket(1), "1");
equal(toCountBucket(4), "2_5");
equal(toCountBucket(8), "6_10");
equal(toCountBucket(20), "11_plus");
