const headers = {
  "Cache-Control": "no-store",
  "Content-Type": "application/json"
};

function response(
  status: "ok" | "unavailable" | "method_not_allowed",
  httpStatus: number,
  includeBody = true
) {
  const body = includeBody
    ? JSON.stringify({
        appId: "fernly",
        environment: "production",
        status,
        schemaVersion: 1
      })
    : null;

  return new Response(body, {
    status: httpStatus,
    headers
  });
}

export async function handleProductionHealth(
  request: Request,
  dependencies: { databaseHealthy: () => Promise<boolean> }
) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return response("method_not_allowed", 405);
  }

  const includeBody = request.method !== "HEAD";

  try {
    return (await dependencies.databaseHealthy())
      ? response("ok", 200, includeBody)
      : response("unavailable", 503, includeBody);
  } catch {
    return response("unavailable", 503, includeBody);
  }
}
