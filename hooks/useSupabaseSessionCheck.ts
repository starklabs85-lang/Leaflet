import { useEffect, useState } from "react";

import { getSupabaseSessionHealth } from "@/lib/supabase";

type SessionCheckState = {
  status: "checking" | "ready" | "missing-config" | "error";
  message: string;
};

export function useSupabaseSessionCheck() {
  const [state, setState] = useState<SessionCheckState>({
    status: "checking",
    message: "Checking Supabase session configuration..."
  });

  useEffect(() => {
    let isMounted = true;

    getSupabaseSessionHealth()
      .then((result) => {
        if (!isMounted) {
          return;
        }

        setState({
          status: result.ok ? "ready" : "missing-config",
          message: result.message
        });
      })
      .catch((error: unknown) => {
        if (!isMounted) {
          return;
        }

        setState({
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "Supabase session check failed."
        });
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return state;
}
