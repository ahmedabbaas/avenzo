type TurnstileResponse = {
  success: boolean;
  hostname?: string;
  action?: string;
  "error-codes"?: string[];
};

export function isTurnstileConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY &&
      process.env.TURNSTILE_SECRET_KEY
  );
}

export async function verifyTurnstile(
  request: Request,
  token: string,
  expectedAction: string
) {
  if (!isTurnstileConfigured()) return true;

  if (!token || token.length > 2048) return false;

  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return false;

  const forwardedFor = request.headers.get("x-forwarded-for");
  const remoteip = forwardedFor?.split(",")[0]?.trim();

  const body = new URLSearchParams({
    secret,
    response: token,
  });

  if (remoteip) body.set("remoteip", remoteip);

  try {
    const response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
        cache: "no-store",
        signal: AbortSignal.timeout(6000),
      }
    );

    if (!response.ok) return false;

    const result = (await response.json()) as TurnstileResponse;

    if (!result.success) return false;
    if (result.action && result.action !== expectedAction) return false;

    return true;
  } catch {
    return false;
  }
}
