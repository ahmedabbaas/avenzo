import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const USERNAME_PATTERN = /^[a-z0-9._]{3,30}$/;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

  try {
    const body = await request.json();
    const identifier = String(body.identifier ?? "")
      .trim()
      .toLowerCase();
    const password = String(body.password ?? "");

    if (
      !identifier ||
      !password ||
      identifier.length > 254 ||
      password.length > 1024
    ) {
      return json(
        { error: "Invalid username/email or password." },
        401
      );
    }

    let email = identifier;

    if (!identifier.includes("@")) {
      if (!USERNAME_PATTERN.test(identifier)) {
        return json(
          { error: "Invalid username/email or password." },
          401
        );
      }

      const admin = createClient(
        SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY,
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        }
      );

      const { data: profile, error: profileError } = await admin
        .from("profiles")
        .select("id")
        .eq("username", identifier)
        .maybeSingle();

      if (profileError || !profile) {
        return json(
          { error: "Invalid username/email or password." },
          401
        );
      }

      const { data: userData, error: userError } =
        await admin.auth.admin.getUserById(profile.id);

      if (userError || !userData.user?.email) {
        return json(
          { error: "Invalid username/email or password." },
          401
        );
      }

      email = userData.user.email;
    }

    const authClient = createClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    const { data, error } =
      await authClient.auth.signInWithPassword({
        email,
        password,
      });

    if (error || !data.session || !data.user) {
      const message = error?.message
        ?.toLowerCase()
        .includes("confirm")
        ? "Verify your email before signing in."
        : "Invalid username/email or password.";

      return json({ error: message }, 401);
    }

    return json({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_in: data.session.expires_in,
      user: {
        id: data.user.id,
        email: data.user.email,
      },
    });
  } catch {
    return json(
      { error: "Unable to sign in right now." },
      500
    );
  }
});
