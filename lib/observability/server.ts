export function getRequestId(request: Request) {
  return request.headers.get("x-request-id") || "untracked";
}

export function logServerError({
  request,
  route,
  error,
}: {
  request: Request;
  route: string;
  error: unknown;
}) {
  const message =
    error instanceof Error ? error.message : "Unknown server error";

  console.error(
    JSON.stringify({
      level: "error",
      service: "avenzo",
      requestId: getRequestId(request),
      route,
      error: message,
      timestamp: new Date().toISOString(),
    })
  );
}
