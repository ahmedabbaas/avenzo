import { NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";
import { createAdminClient } from "../../../../lib/supabase/admin";

const USERNAME_PATTERN = /^[a-z0-9._]{3,30}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function extensionFor(file: File) {
  const byName = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (byName) return byName.slice(0, 8);
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return "jpg";
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const fullName = String(form.get("fullName") || "").trim();
    const username = String(form.get("username") || "").trim().toLowerCase().replace(/^@+/, "");
    const email = String(form.get("email") || "").trim().toLowerCase();
    const password = String(form.get("password") || "");
    const confirmPassword = String(form.get("confirmPassword") || "");
    const avatarEntry = form.get("avatar");
    const avatar = avatarEntry instanceof File && avatarEntry.size > 0 ? avatarEntry : null;

    if (fullName.length < 1 || fullName.length > 80) {
      return NextResponse.json({ error: "Enter a valid full name." }, { status: 400 });
    }
    if (!USERNAME_PATTERN.test(username)) {
      return NextResponse.json({ error: "Username must be 3–30 characters using letters, numbers, underscores or periods." }, { status: 400 });
    }
    if (!EMAIL_PATTERN.test(email)) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
    }
    if (password !== confirmPassword) {
      return NextResponse.json({ error: "Passwords do not match." }, { status: 400 });
    }
    if (avatar && (!avatar.type.startsWith("image/") || avatar.size > 5 * 1024 * 1024)) {
      return NextResponse.json({ error: "Profile picture must be an image no larger than 5 MB." }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: available, error: availabilityError } = await supabase
      .rpc("is_username_available", { candidate: username });

    if (availabilityError) throw availabilityError;
    if (!available) {
      return NextResponse.json(
        { error: "This username is already taken. Please choose another one." },
        { status: 409 }
      );
    }

    const origin = new URL(request.url).origin;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: origin + "/auth/confirm?next=/home",
        data: { username, display_name: fullName },
      },
    });

    if (error) {
      const duplicateUsername =
        error.message.includes("USERNAME_TAKEN") ||
        error.message.toLowerCase().includes("duplicate");

      if (duplicateUsername) {
        return NextResponse.json(
          { error: "This username is already taken. Please choose another one." },
          { status: 409 }
        );
      }

      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    let avatarWarning = "";
    if (avatar && data.user) {
      try {
        const admin = createAdminClient();
        const path = data.user.id + "/avatars/" + crypto.randomUUID() + "." + extensionFor(avatar);
        const bytes = new Uint8Array(await avatar.arrayBuffer());

        const { error: uploadError } = await admin.storage
          .from("media")
          .upload(path, bytes, { contentType: avatar.type, upsert: false });

        if (uploadError) throw uploadError;

        const publicUrl = admin.storage.from("media").getPublicUrl(path).data.publicUrl;
        const { error: profileError } = await admin
          .from("profiles")
          .update({ avatar_url: publicUrl })
          .eq("id", data.user.id);

        if (profileError) throw profileError;
      } catch {
        avatarWarning = "Account created, but the profile picture could not be saved.";
      }
    }

    return NextResponse.json({
      ok: true,
      requiresVerification: !data.session,
      avatarWarning,
    });
  } catch {
    return NextResponse.json({ error: "AVENZO backend is not fully configured." }, { status: 503 });
  }
}
