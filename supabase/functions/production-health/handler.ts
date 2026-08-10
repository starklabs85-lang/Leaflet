const headers = {
  "Cache-Control": "no-store",
  "Content-Type": "application/json"
};

function response(status: "ok" | "unavailable" | "method_not_allowed", httpStatus: number) {
  return new Response(JSON.stringify({
    appId: "fernly",
    environment: "production",
    status,
    schemaVersion: 1
  }), {
    status: httpStatus,
    headers
  });
}

export async function handleProductionHealth(
  request: Request,
  dependencies: { databaseHealthy: () => Promise<boolean> }
) {
  if (request.method !== "GET") {
    return response("method_not_allowed", 405);
  }

  try {
    return (await dependencies.databaseHealthy())
      ? response("ok", 200)
      : response("unavailable", 503);
  } catch {
    return response("unavailable", 503);
  }
}
