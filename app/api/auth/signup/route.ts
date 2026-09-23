import { NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";
import { verifyTurnstile } from "../../../../lib/turnstile";

export const dynamic = "force-dynamic";

const USERNAME_PATTERN = /^[a-z0-9._]{3,30}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function extensionFor(file: File) {
  const byName = file.name
    .split(".")
    .pop()
    ?.toLowerCase()
    .replace(/[^a-z0-9]/g, "");

  if (byName) return byName.slice(0, 8);
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return "jpg";
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();

    const fullName = String(form.get("fullName") || "").trim();
    const username = String(form.get("username") || "")
      .trim()
      .toLowerCase()
      .replace(/^@+/, "");
    const email = String(form.get("email") || "").trim().toLowerCase();
    const password = String(form.get("password") || "");
    const confirmPassword = String(form.get("confirmPassword") || "");
    const turnstileToken = String(form.get("turnstileToken") || "");

    const avatarEntry = form.get("avatar");
    const avatar =
      avatarEntry instanceof File && avatarEntry.size > 0
        ? avatarEntry
        : null;

    if (fullName.length < 1 || fullName.length > 80) {
      return json({ error: "Enter a valid full name." }, 400);
    }

    if (!USERNAME_PATTERN.test(username)) {
      return json(
        {
          error:
            "Username must be 3–30 characters using letters, numbers, underscores or periods.",
        },
        400
      );
    }

    if (!EMAIL_PATTERN.test(email) || email.length > 254) {
      return json({ error: "Enter a valid email address." }, 400);
    }

    if (password.length < 8 || password.length > 1024) {
      return json(
        { error: "Password must be at least 8 characters." },
        400
      );
    }

    if (password !== confirmPassword) {
      return json({ error: "Passwords do not match." }, 400);
    }

    if (
      avatar &&
      (!avatar.type.startsWith("image/") ||
        avatar.size > 5 * 1024 * 1024)
    ) {
      return json(
        {
          error:
            "Profile picture must be an image no larger than 5 MB.",
        },
        400
      );
    }

    const verified = await verifyTurnstile(
      request,
      turnstileToken,
      "signup"
    );

    if (!verified) {
      return json(
        { error: "Verification failed. Please try again." },
        403
      );
    }

    const supabase = await createClient();

    const { data: available, error: availabilityError } =
      await supabase.rpc("is_username_available", {
        candidate: username,
      });

    if (availabilityError) throw availabilityError;

    if (!available) {
      return json(
        {
          error:
            "This username is already taken. Please choose another one.",
        },
        409
      );
    }

    const origin = new URL(request.url).origin;

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: origin + "/auth/confirm?next=/home",
        data: {
          username,
          display_name: fullName,
        },
      },
    });

    if (error) {
      const message = error.message.toLowerCase();

      if (
        error.message.includes("USERNAME_TAKEN") ||
        message.includes("duplicate")
      ) {
        return json(
          {
            error:
              "This username is already taken. Please choose another one.",
          },
          409
        );
      }

      if (
        message.includes("already registered") ||
        message.includes("already exists")
      ) {
        return json(
          { error: "An account with this email already exists." },
          409
        );
      }

      return json({ error: "Unable to create account." }, 400);
    }

    let avatarWarning = "";

    if (avatar && data.user && data.session) {
      try {
        const path =
          data.user.id +
          "/avatars/" +
          crypto.randomUUID() +
          "." +
          extensionFor(avatar);

        const bytes = new Uint8Array(await avatar.arrayBuffer());

        const { error: uploadError } = await supabase.storage
          .from("media")
          .upload(path, bytes, {
            contentType: avatar.type,
            upsert: false,
          });

        if (uploadError) throw uploadError;

        const publicUrl = supabase.storage
          .from("media")
          .getPublicUrl(path).data.publicUrl;

        const { error: profileError } = await supabase
          .from("profiles")
          .update({ avatar_url: publicUrl })
          .eq("id", data.user.id);

        if (profileError) throw profileError;
      } catch {
        avatarWarning =
          "Account created. You can add your profile picture after verification.";
      }
    } else if (avatar) {
      avatarWarning =
        "Account created. Add your profile picture after email verification.";
    }

    return json({
      ok: true,
      requiresVerification: !data.session,
      avatarWarning,
    });
  } catch {
    return json(
      { error: "Account services are temporarily unavailable." },
      503
    );
  }
}
