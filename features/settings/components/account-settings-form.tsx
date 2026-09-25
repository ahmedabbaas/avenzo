"use client";

import { type ChangeEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";
import {
  AVATAR_MAX_BYTES,
  BIO_MAX_LENGTH,
  DISPLAY_NAME_MAX_LENGTH,
  isValidDisplayName,
  isValidEmail,
  isValidPassword,
  isValidUsername,
  normalizeEmail,
  normalizeUsername,
} from "../../auth/validation";
import AvatarImage from "../../social/components/avatar-image";
import { avatarFor } from "../../social/lib/profile";
import type { PrivacySettings } from "../types";
import { useUiTranslation } from "../lib/i18n";

type AccountProfile = {
  id: string;
  username: string;
  display_name: string;
  bio: string;
  avatar_url: string | null;
  website: string;
  gender: string | null;
  date_of_birth: string | null;
  verified: boolean;
  created_at: string;
};

type UsernameState = "idle" | "checking" | "available" | "taken" | "invalid" | "error";

function Section({
  title,
  text,
  children,
}: {
  title: string;
  text: string;
  children: React.ReactNode;
}) {
  return (
    <section className="settings-form-section">
      <div className="settings-form-head">
        <h2>{title}</h2>
        <p>{text}</p>
      </div>
      <div className="settings-form-body">{children}</div>
    </section>
  );
}

function AudienceSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: PrivacySettings["who_can_follow"];
  onChange: (value: PrivacySettings["who_can_follow"]) => void;
}) {
  return (
    <label className="settings-field settings-field-row">
      <span>{label}</span>
      <select
        value={value}
        onChange={(event) =>
          onChange(event.target.value as PrivacySettings["who_can_follow"])
        }
      >
        <option value="everyone">Everyone</option>
        <option value="people_i_follow">People I follow</option>
        <option value="no_one">No one</option>
      </select>
    </label>
  );
}

export default function AccountSettingsForm({
  initialProfile,
  initialPrivacy,
  email,
  phone,
}: {
  initialProfile: AccountProfile;
  initialPrivacy: PrivacySettings;
  email: string;
  phone: string;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const t = useUiTranslation();

  const [profile, setProfile] = useState(initialProfile);
  const [privacy, setPrivacy] = useState(initialPrivacy);
  const [name, setName] = useState(initialProfile.display_name);
  const [username, setUsername] = useState(initialProfile.username);
  const [savedUsername, setSavedUsername] = useState(initialProfile.username);
  const [bio, setBio] = useState(initialProfile.bio || "");
  const [website, setWebsite] = useState(initialProfile.website || "");
  const [gender, setGender] = useState(initialProfile.gender || "");
  const [dob, setDob] = useState(initialProfile.date_of_birth || "");
  const [verifiedBadge, setVerifiedBadge] = useState(Boolean(initialProfile.verified));
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState("");
  const [usernameState, setUsernameState] = useState<UsernameState>("idle");
  const [profileStatus, setProfileStatus] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);

  const [emailValue, setEmailValue] = useState(email);
  const [emailStatus, setEmailStatus] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [securityStatus, setSecurityStatus] = useState("");
  const [securityBusy, setSecurityBusy] = useState(false);

  const [mfaFactorId, setMfaFactorId] = useState("");
  const [mfaQrCode, setMfaQrCode] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaVerified, setMfaVerified] = useState(false);

  const [privacyStatus, setPrivacyStatus] = useState("");
  const [privacySaving, setPrivacySaving] = useState(false);

  const [deactivateConfirm, setDeactivateConfirm] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteValue, setDeleteValue] = useState("");
  const [dangerStatus, setDangerStatus] = useState("");
  const [dangerBusy, setDangerBusy] = useState(false);

  useEffect(() => {
    if (
      username === savedUsername ||
      !isValidUsername(username)
    ) {
      return;
    }

    let active = true;
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(
          "/api/auth/username?username=" + encodeURIComponent(username),
          { cache: "no-store" }
        );
        const result = await response.json();

        if (!active) return;

        if (!response.ok) {
          setUsernameState("error");
          return;
        }

        setUsernameState(result.available ? "available" : "taken");
      } catch {
        if (active) setUsernameState("error");
      }
    }, 350);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [username, savedUsername]);

  useEffect(() => {
    let active = true;

    void supabase.auth.mfa.listFactors().then(({ data }) => {
      if (!active) return;
      const verified = data?.totp?.find((factor) => factor.status === "verified");
      if (verified) {
        setMfaFactorId(verified.id);
        setMfaVerified(true);
      }
    });

    return () => {
      active = false;
    };
  }, [supabase]);

  function chooseAvatar(event: ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0] || null;

    if (avatarPreview) URL.revokeObjectURL(avatarPreview);

    if (!picked) {
      setAvatarFile(null);
      setAvatarPreview("");
      return;
    }

    if (!picked.type.startsWith("image/") || picked.size > AVATAR_MAX_BYTES) {
      setProfileStatus("Profile picture must be an image up to 5 MB.");
      event.target.value = "";
      return;
    }

    setAvatarFile(picked);
    setAvatarPreview(URL.createObjectURL(picked));
    setProfileStatus("");
  }

  async function saveProfile() {
    const cleanName = name.trim();
    const cleanBio = bio.trim();
    const cleanWebsite = website.trim();

    if (!isValidDisplayName(cleanName)) {
      setProfileStatus("Full name must be 1–80 characters.");
      return;
    }

    if (cleanBio.length > BIO_MAX_LENGTH) {
      setProfileStatus("Bio must be 160 characters or less.");
      return;
    }

    if (username !== savedUsername) {
      if (!isValidUsername(username)) {
        setProfileStatus("Username must be 3–30 characters using letters, numbers, underscores or periods.");
        return;
      }
      if (usernameState !== "available") {
        setProfileStatus(
          usernameState === "taken"
            ? "This username is already taken. Please choose another one."
            : "Wait for username availability to finish checking."
        );
        return;
      }
    }

    if (cleanWebsite && cleanWebsite.length > 2048) {
      setProfileStatus("Website URL is too long.");
      return;
    }

    setProfileSaving(true);
    setProfileStatus("");

    try {
      let avatarUrl = profile.avatar_url || "";

      if (avatarFile) {
        const ext =
          avatarFile.name
            .split(".")
            .pop()
            ?.toLowerCase()
            .replace(/[^a-z0-9]/g, "")
            .slice(0, 8) || "jpg";

        const path =
          profile.id + "/avatars/" + crypto.randomUUID() + "." + ext;

        const { error: uploadError } = await supabase.storage
          .from("media")
          .upload(path, avatarFile, {
            contentType: avatarFile.type,
            upsert: false,
          });

        if (uploadError) throw uploadError;
        avatarUrl = supabase.storage.from("media").getPublicUrl(path).data.publicUrl;
      }

      if (username !== savedUsername) {
        const { error: usernameError } = await supabase.rpc("change_username", {
          candidate: username,
        });

        if (usernameError) {
          if (
            usernameError.message.includes("USERNAME_TAKEN") ||
            usernameError.code === "23505"
          ) {
            setUsernameState("taken");
            throw new Error("This username is already taken. Please choose another one.");
          }
          throw usernameError;
        }
      }

      const { data, error } = await supabase
        .from("profiles")
        .update({
          display_name: cleanName,
          bio: cleanBio,
          avatar_url: avatarUrl,
          website: cleanWebsite,
          gender: gender || null,
          date_of_birth: dob || null,
          verified: verifiedBadge,
        })
        .eq("id", profile.id)
        .select(
          "id,username,display_name,bio,avatar_url,website,gender,date_of_birth,verified,created_at"
        )
        .single();

      if (error) throw error;

      setProfile(data as AccountProfile);
      setUsername(data.username);
      setSavedUsername(data.username);
      setUsernameState("idle");
      setAvatarFile(null);
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
      setAvatarPreview("");
      setProfileStatus("Profile & account information saved.");
      router.refresh();
    } catch (error) {
      setProfileStatus(
        error instanceof Error ? error.message : "Could not save profile."
      );
    } finally {
      setProfileSaving(false);
    }
  }

  async function updateEmail() {
    const clean = normalizeEmail(emailValue);
    if (!isValidEmail(clean)) {
      setEmailStatus("Enter a valid email address.");
      return;
    }

    setEmailStatus("");
    const { error } = await supabase.auth.updateUser({ email: clean });

    setEmailStatus(
      error
        ? error.message
        : "Check the new email address to confirm the change."
    );
  }

  async function changePassword() {
    if (!isValidPassword(password)) {
      setSecurityStatus("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setSecurityStatus("Passwords do not match.");
      return;
    }

    setSecurityBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSecurityBusy(false);

    if (error) {
      setSecurityStatus(error.message);
      return;
    }

    setPassword("");
    setConfirmPassword("");
    setSecurityStatus("Password updated.");
  }

  async function logoutOtherDevices() {
    setSecurityBusy(true);
    const { error } = await supabase.auth.signOut({ scope: "others" });
    setSecurityBusy(false);
    setSecurityStatus(
      error ? error.message : "Signed out from all other sessions."
    );
  }

  async function startMfa() {
    setSecurityStatus("");
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      issuer: "AVENZO",
      friendlyName: "AVENZO Authenticator",
    });

    if (error || !data) {
      setSecurityStatus(error?.message || "Could not start two-factor setup.");
      return;
    }

    setMfaFactorId(data.id);
    setMfaQrCode(data.totp.qr_code);
    setMfaVerified(false);
  }

  async function verifyMfa() {
    if (!mfaFactorId || mfaCode.trim().length !== 6) {
      setSecurityStatus("Enter the 6-digit authenticator code.");
      return;
    }

    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId: mfaFactorId,
      code: mfaCode.trim(),
    });

    if (error) {
      setSecurityStatus(error.message);
      return;
    }

    setMfaVerified(true);
    setMfaQrCode("");
    setMfaCode("");
    setSecurityStatus("Two-factor authentication enabled.");
  }

  async function disableMfa() {
    if (!mfaFactorId) return;
    const { error } = await supabase.auth.mfa.unenroll({
      factorId: mfaFactorId,
    });

    if (error) {
      setSecurityStatus(error.message);
      return;
    }

    setMfaVerified(false);
    setMfaFactorId("");
    setMfaQrCode("");
    setSecurityStatus("Two-factor authentication disabled.");
  }

  async function savePrivacy() {
    setPrivacySaving(true);
    setPrivacyStatus("");

    const { error } = await supabase
      .from("privacy_settings")
      .update({
        account_private: privacy.account_private,
        who_can_follow: privacy.who_can_follow,
        who_can_message: privacy.who_can_message,
        who_can_send_message_requests: privacy.who_can_send_message_requests,
        read_receipts: privacy.read_receipts,
        online_status: privacy.online_status,
        who_can_comment: privacy.who_can_comment,
        who_can_mention: privacy.who_can_mention,
        who_can_tag: privacy.who_can_tag,
        story_visibility: privacy.story_visibility,
      })
      .eq("user_id", privacy.user_id);

    setPrivacySaving(false);
    setPrivacyStatus(error ? "Could not save privacy settings." : "Privacy settings saved.");
  }

  async function signOutCurrent() {
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  async function deactivateAccount() {
    if (!deactivateConfirm) {
      setDeactivateConfirm(true);
      setDangerStatus("Press Deactivate again to confirm. Logging back in reactivates the account.");
      return;
    }

    setDangerBusy(true);
    const { error } = await supabase.rpc("deactivate_account");

    if (error) {
      setDangerBusy(false);
      setDangerStatus("Could not deactivate account.");
      return;
    }

    await supabase.auth.signOut();
    router.replace("/login?deactivated=1");
    router.refresh();
  }

  async function deleteAccount() {
    if (deleteValue.trim().toLowerCase() !== username.toLowerCase()) {
      setDangerStatus("Type your exact username to confirm account deletion.");
      return;
    }

    setDangerBusy(true);
    const { error } = await supabase.functions.invoke("delete-account", {
      body: { confirmation: deleteValue.trim().toLowerCase() },
    });

    if (error) {
      setDangerBusy(false);
      setDangerStatus("Account could not be deleted right now.");
      return;
    }

    await supabase.auth.signOut();
    router.replace("/login?deleted=1");
    router.refresh();
  }

  const usernameMessage =
    username === savedUsername
      ? "Your current username."
      : usernameState === "checking"
        ? "Checking availability…"
        : usernameState === "available"
          ? "Username is available."
          : usernameState === "taken"
            ? "This username is already taken. Please choose another one."
            : usernameState === "invalid"
              ? "Use 3–30 lowercase letters, numbers, underscores or periods."
              : usernameState === "error"
                ? "Unable to check username right now."
                : "";

  return (
    <div className="settings-sections">
      <Section
        title={t("Profile")}
        text="Manage public profile information. Email and security stay separate."
      >
        <div className="account-avatar-row">
          <AvatarImage
            src={avatarPreview || avatarFor(profile)}
            alt={profile.display_name}
            size={144}
          />
          <label className="btn secondary small">
            Change profile picture
            <input type="file" accept="image/*" onChange={chooseAvatar} />
          </label>
        </div>

        <div className="settings-grid-2">
          <label className="settings-field">
            <span>{t("Full name")}</span>
            <input
              value={name}
              maxLength={DISPLAY_NAME_MAX_LENGTH}
              onChange={(event) => setName(event.target.value)}
            />
          </label>

          <label className="settings-field">
            <span>{t("Username")}</span>
            <div className="username-input-wrap">
              <span>@</span>
              <input
                value={username}
                maxLength={30}
                autoCapitalize="none"
                spellCheck={false}
                onChange={(event) => {
                  const next = normalizeUsername(event.target.value);
                  setUsername(next);
                  setUsernameState(
                    next === savedUsername
                      ? "idle"
                      : isValidUsername(next)
                        ? "checking"
                        : "invalid"
                  );
                }}
              />
            </div>
            <small className={"username-check-state " + usernameState}>
              {usernameMessage}
            </small>
          </label>
        </div>

        <label className="settings-field">
          <span>{t("Bio")}</span>
          <textarea
            value={bio}
            maxLength={BIO_MAX_LENGTH}
            onChange={(event) => setBio(event.target.value)}
          />
          <small>{bio.length}/{BIO_MAX_LENGTH}</small>
        </label>

        <div className="settings-grid-2">
          <label className="settings-field">
            <span>{t("Website")}</span>
            <input
              value={website}
              placeholder="https://example.com"
              onChange={(event) => setWebsite(event.target.value)}
            />
          </label>

          <label className="settings-field">
            <span>{t("Gender")}</span>
            <select value={gender} onChange={(event) => setGender(event.target.value)}>
              <option value="">Not specified</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
              <option value="prefer_not_to_say">Prefer not to say</option>
            </select>
          </label>
        </div>

        <label className="settings-field">
          <span>{t("Date of birth")}</span>
          <input
            type="date"
            value={dob}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(event) => setDob(event.target.value)}
          />
          <small>This is not displayed publicly by default.</small>
        </label>

        <label className="settings-toggle-row verification-toggle-row">
          <span>
            <b>Blue verification badge</b>
            <small>
              Show the blue badge beside your username across AVENZO. You can turn it off any time.
            </small>
          </span>
          <input
            type="checkbox"
            checked={verifiedBadge}
            onChange={(event) => setVerifiedBadge(event.target.checked)}
          />
          <span className="settings-switch" aria-hidden="true" />
        </label>

        <div className="settings-inline-action">
          <div role="status" aria-live="polite">{profileStatus}</div>
          <button className="btn" disabled={profileSaving} onClick={() => void saveProfile()}>
            {profileSaving ? "Saving…" : t("Save Profile")}
          </button>
        </div>
      </Section>

      <Section
        title={t("Account Information")}
        text="Sensitive account details are visible only to you."
      >
        <label className="settings-field">
          <span>{t("Email address")}</span>
          <div className="settings-inline-input">
            <input
              type="email"
              value={emailValue}
              onChange={(event) => setEmailValue(event.target.value)}
            />
            <button className="btn secondary" type="button" onClick={() => void updateEmail()}>
              Update
            </button>
          </div>
          {emailStatus && <small>{emailStatus}</small>}
        </label>

        <div className="account-info-list">
          <div><span>{t("Phone number")}</span><b>{phone || "Not configured"}</b></div>
          <div><span>{t("Account created")}</span><b>{new Date(profile.created_at).toLocaleDateString()}</b></div>
        </div>
      </Section>

      <Section
        title={t("Password & Security")}
        text="Manage password, active sessions and two-factor authentication."
      >
        <div className="settings-grid-2">
          <label className="settings-field">
            <span>{t("New password")}</span>
            <input
              type="password"
              value={password}
              autoComplete="new-password"
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <label className="settings-field">
            <span>{t("Confirm new password")}</span>
            <input
              type="password"
              value={confirmPassword}
              autoComplete="new-password"
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </label>
        </div>

        <div className="settings-button-row">
          <button className="btn" disabled={securityBusy} onClick={() => void changePassword()}>
            {t("Change password")}
          </button>
          <Link className="btn secondary" href="/forgot-password">
            {t("Forgot password?")}
          </Link>
          <button className="btn secondary" disabled={securityBusy} onClick={() => void logoutOtherDevices()}>
            {t("Log out other devices")}
          </button>
        </div>

        <div className="security-subsection">
          <div>
            <b>{t("Two-factor authentication")}</b>
            <span>{mfaVerified ? "Enabled with an authenticator app." : "Add an authenticator app for extra security."}</span>
          </div>
          {mfaVerified ? (
            <button className="btn secondary small" onClick={() => void disableMfa()}>
              Disable 2FA
            </button>
          ) : (
            <button className="btn secondary small" onClick={() => void startMfa()}>
              Set up 2FA
            </button>
          )}
        </div>

        {mfaQrCode && (
          <div className="mfa-setup">
            <img src={mfaQrCode} alt="Two-factor authentication QR code" />
            <label className="settings-field">
              <span>6-digit code</span>
              <input
                inputMode="numeric"
                maxLength={6}
                value={mfaCode}
                onChange={(event) =>
                  setMfaCode(event.target.value.replace(/\D/g, "").slice(0, 6))
                }
              />
            </label>
            <button className="btn" onClick={() => void verifyMfa()}>
              Verify & Enable
            </button>
          </div>
        )}

        {securityStatus && <p className="settings-status">{securityStatus}</p>}
      </Section>

      <Section
        title={t("Privacy")}
        text="Control who can interact with your account."
      >
        <label className="settings-toggle-row">
          <span>
            <b>{t("Private account")}</b>
            <small>Limit your content to approved/following relationships where supported.</small>
          </span>
          <input
            type="checkbox"
            checked={privacy.account_private}
            onChange={(event) =>
              setPrivacy((current) => ({ ...current, account_private: event.target.checked }))
            }
          />
          <span className="settings-switch" aria-hidden="true" />
        </label>

        <AudienceSelect label={t("Who can follow me")} value={privacy.who_can_follow} onChange={(v) => setPrivacy((p) => ({ ...p, who_can_follow: v }))} />
        <AudienceSelect label={t("Who can message me")} value={privacy.who_can_message} onChange={(v) => setPrivacy((p) => ({ ...p, who_can_message: v }))} />
        <AudienceSelect label="Who can send message requests" value={privacy.who_can_send_message_requests} onChange={(v) => setPrivacy((p) => ({ ...p, who_can_send_message_requests: v }))} />

        <label className="settings-toggle-row">
          <span>
            <b>Read receipts</b>
            <small>Allow people to see when you have seen their messages.</small>
          </span>
          <input
            type="checkbox"
            checked={privacy.read_receipts}
            onChange={(event) =>
              setPrivacy((current) => ({
                ...current,
                read_receipts: event.target.checked,
              }))
            }
          />
          <span className="settings-switch" aria-hidden="true" />
        </label>

        <label className="settings-toggle-row">
          <span>
            <b>Online status</b>
            <small>Allow people you message to see when you are online.</small>
          </span>
          <input
            type="checkbox"
            checked={privacy.online_status}
            onChange={(event) =>
              setPrivacy((current) => ({
                ...current,
                online_status: event.target.checked,
              }))
            }
          />
          <span className="settings-switch" aria-hidden="true" />
        </label>

        <AudienceSelect label={t("Who can comment on my posts")} value={privacy.who_can_comment} onChange={(v) => setPrivacy((p) => ({ ...p, who_can_comment: v }))} />
        <AudienceSelect label={t("Who can mention me")} value={privacy.who_can_mention} onChange={(v) => setPrivacy((p) => ({ ...p, who_can_mention: v }))} />
        <AudienceSelect label={t("Who can tag me")} value={privacy.who_can_tag} onChange={(v) => setPrivacy((p) => ({ ...p, who_can_tag: v }))} />

        <label className="settings-field settings-field-row">
          <span>{t("Story visibility")}</span>
          <select
            value={privacy.story_visibility}
            onChange={(event) =>
              setPrivacy((current) => ({
                ...current,
                story_visibility: event.target.value as PrivacySettings["story_visibility"],
              }))
            }
          >
            <option value="everyone">Everyone</option>
            <option value="followers">Followers</option>
            <option value="close_friends">Close Friends</option>
            <option value="only_me">Only me</option>
          </select>
        </label>

        <Link className="settings-navigation-row" href="/settings/follow-requests">
          <span>
            <b>Follow requests</b>
            <small>Approve or decline people requesting access to your private account.</small>
          </span>
          <span>›</span>
        </Link>

        <Link className="settings-navigation-row" href="/settings/close-friends">
          <span>
            <b>Close Friends</b>
            <small>Manage your private audience for Notes and Stories.</small>
          </span>
          <span>›</span>
        </Link>

        <Link className="settings-navigation-row" href="/settings/blocked">
          <span>
            <b>Blocked accounts</b>
            <small>View and unblock people.</small>
          </span>
          <span>›</span>
        </Link>

        <div className="settings-inline-action">
          <div role="status" aria-live="polite">{privacyStatus}</div>
          <button className="btn" disabled={privacySaving} onClick={() => void savePrivacy()}>
            {privacySaving ? "Saving…" : t("Save Privacy")}
          </button>
        </div>
      </Section>

      <section className="settings-danger-section">
        <div className="settings-form-head">
          <h2>{t("Account Actions")}</h2>
          <p>These actions affect your login or account availability.</p>
        </div>

        <div className="danger-action-row">
          <div><b>{t("Log out")}</b><span>End this session on this device.</span></div>
          <button className="btn secondary" onClick={() => void signOutCurrent()}>Log out</button>
        </div>

        <div className="danger-action-row">
          <div><b>{t("Deactivate account")}</b><span>Temporarily deactivate. Logging in again reactivates your account.</span></div>
          <button className="btn secondary" disabled={dangerBusy} onClick={() => void deactivateAccount()}>
            {deactivateConfirm ? "Confirm Deactivate" : "Deactivate"}
          </button>
        </div>

        <div className="danger-action-row danger">
          <div><b>{t("Delete account")}</b><span>Permanently delete your account and social content. Your username remains reserved.</span></div>
          {!deleteOpen ? (
            <button className="btn danger-button" onClick={() => setDeleteOpen(true)}>
              Delete account
            </button>
          ) : (
            <div className="delete-confirm-inline">
              <input
                value={deleteValue}
                placeholder={username}
                onChange={(event) => setDeleteValue(event.target.value.replace(/^@/, ""))}
              />
              <button
                className="btn danger-button"
                disabled={dangerBusy || deleteValue.toLowerCase() !== username.toLowerCase()}
                onClick={() => void deleteAccount()}
              >
                Delete permanently
              </button>
              <button className="btn secondary" onClick={() => { setDeleteOpen(false); setDeleteValue(""); }}>
                Cancel
              </button>
            </div>
          )}
        </div>

        {dangerStatus && <p className="settings-status danger-text">{dangerStatus}</p>}
      </section>
    </div>
  );
}
