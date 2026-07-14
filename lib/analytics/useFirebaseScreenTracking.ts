import { useEffect, useMemo, useRef } from "react";

import { trackScreenView } from "@/lib/analytics/firebaseAnalytics";

type UseFirebaseScreenTrackingOptions = {
  enabled: boolean;
  segments: string[];
};

export function useFirebaseScreenTracking({
  enabled,
  segments
}: UseFirebaseScreenTrackingOptions) {
  const routeKey = segments.join("/");
  const screenName = useMemo(() => buildFirebaseScreenName(routeKey), [routeKey]);
  const lastTrackedScreen = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || !screenName || lastTrackedScreen.current === screenName) {
      return;
    }

    lastTrackedScreen.current = screenName;
    void trackScreenView(screenName);
  }, [enabled, screenName]);
}

function buildFirebaseScreenName(routeKey: string) {
  const normalizedSegments = routeKey
    .split("/")
    .map(normalizeRouteSegment)
    .filter(Boolean);

  if (normalizedSegments.length === 0) {
    return "index";
  }

  return normalizedSegments.join("_").slice(0, 100);
}

function normalizeRouteSegment(segment: string) {
  return segment
    .replace(/^\((.*)\)$/, "$1")
    .replace(/^\[(.*)\]$/, "$1")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}
