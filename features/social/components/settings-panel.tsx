"use client";

import {
  type ChangeEvent,
  useEffect,
  useState,
} from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import PageTitle from "./page-title";
import { avatarFor, initialsAvatar } from "../lib/profile";
import type { Profile } from "../types";
import AvatarImage from "./avatar-image";
import {
  AVATAR_MAX_BYTES,
  BIO_MAX_LENGTH,
  DISPLAY_NAME_MAX_LENGTH,
  isValidDisplayName,
} from "../../auth/validation";

type BlockedAccount = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  blocked_at: string;
};

export default function SettingsPanel({
  profile,
  setProfile,
  supabase,
  signOut,
  onSaved,
  onUnblocked,
}: {
  profile: Profile;
  setProfile: (profile: Profile) => void;
  supabase: SupabaseClient;
  signOut: () => void;
  onSaved: () => void;
  onUnblocked: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(profile.display_name);
  const [bio, setBio] = useState(profile.bio);
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState("");
  const [blockedAccounts, setBlockedAccounts] = useState<BlockedAccount[]>([]);
  const [blockedLoading, setBlockedLoading] = useState(true);
  const [unblockingId, setUnblockingId] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteValue, setDeleteValue] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let active = true;

    void supabase.rpc("get_blocked_accounts").then(({ data, error }) => {
      if (!active) return;

      if (error) {
        setNotice("Could not load blocked accounts.");
        setBlockedLoading(false);
        return;
      }

      setBlockedAccounts((data || []) as BlockedAccount[]);
      setBlockedLoading(false);
    });

    return () => {
      active = false;
    };
  }, [supabase, profile.id]);

  async function unblockAccount(account: Pick<BlockedAccount, "id" | "username">) {
    if (unblockingId) return;

    const confirmed = window.confirm(
      `Unblock @${account.username}? They can appear in your AVENZO experience again.`
    );

    if (!confirmed) return;

    setUnblockingId(account.id);
    setNotice("");

    const { error } = await supabase
      .from("blocks")
      .delete()
      .eq("blocker_id", profile.id)
      .eq("blocked_id", account.id);

    if (error) {
      setNotice("Could not unblock this account right now.");
      setUnblockingId(null);
      return;
    }

    setBlockedAccounts((current) =>
      current.filter((item) => item.id !== account.id)
    );
    setNotice(`@${account.username} has been unblocked.`);
    setUnblockingId(null);
    onUnblocked();
  }

  function chooseAvatar(event: ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0] || null;

    if (avatarPreview) URL.revokeObjectURL(avatarPreview);

    if (!picked) {
      setAvatarFile(null);
      setAvatarPreview("");
      return;
    }

    if (!picked.type.startsWith("image/")) {
      setNotice("Profile picture must be an image.");
      event.target.value = "";
      return;
    }

    if (picked.size > AVATAR_MAX_BYTES) {
      setNotice("Profile picture must be 5 MB or smaller.");
      event.target.value = "";
      return;
    }

    setAvatarFile(picked);
    setAvatarPreview(URL.createObjectURL(picked));
    setNotice("");
  }

  async function save() {
    const cleanName = name.trim();
    const cleanBio = bio.trim();

    if (!isValidDisplayName(cleanName)) {
      setNotice("Display name must be 1–80 characters.");
      return;
    }

    if (cleanBio.length > BIO_MAX_LENGTH) {
      setNotice("Bio must be 160 characters or less.");
      return;
    }

    setSaving(true);
    setNotice("");

    try {
      let avatarUrl = profile.avatar_url || "";

      if (avatarFile) {
        const extension =
          avatarFile.name
            .split(".")
            .pop()
            ?.toLowerCase()
            .replace(/[^a-z0-9]/g, "") || "jpg";

        const path =
          profile.id +
          "/avatars/" +
          crypto.randomUUID() +
          "." +
          extension.slice(0, 8);

        const upload = await supabase.storage
          .from("media")
          .upload(path, avatarFile, {
            upsert: false,
            contentType: avatarFile.type,
          });

        if (upload.error) throw upload.error;

        avatarUrl = supabase.storage.from("media").getPublicUrl(path).data.publicUrl;
      }

      const { data, error } = await supabase
        .from("profiles")
        .update({
          display_name: cleanName,
          bio: cleanBio,
          avatar_url: avatarUrl,
        })
        .eq("id", profile.id)
        .select("id,username,display_name,bio,avatar_url,created_at")
        .single();

      if (error) throw error;

      setProfile(data);
      setAvatarFile(null);

      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
      setAvatarPreview("");

      setNotice("Profile saved.");
      onSaved();
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Unable to save profile."
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteAccount() {
    if (deleting) return;

    if (deleteValue.trim().toLowerCase() !== profile.username.toLowerCase()) {
      setNotice("Type your exact username to confirm account deletion.");
      return;
    }

    setDeleting(true);
    setNotice("");

    const { error } = await supabase.functions.invoke("delete-account", {
      body: { confirmation: deleteValue.trim().toLowerCase() },
    });

    if (error) {
      setNotice("Account could not be deleted right now.");
      setDeleting(false);
      return;
    }

    await supabase.auth.signOut();
    router.replace("/login?deleted=1");
    router.refresh();
  }

  return (
    <>
      <PageTitle
        eyebrow="ACCOUNT"
        title="Profile settings"
        text="Control how your identity appears across AVENZO."
      />

      <div className="settings-card">
        <div className="settings-avatar">
          <AvatarImage
            src={avatarPreview || avatarFor(profile)}
            alt={profile.display_name + " profile picture"}
            size={160}
          />
          <label className="btn secondary small">
            Change picture
            <input type="file" accept="image/*" onChange={chooseAvatar} />
          </label>
        </div>

        <label htmlFor="settings-username">Username</label>
        <input id="settings-username" value={"@" + profile.username} readOnly />
        <small className="field-note">
          Usernames are permanent after registration.
        </small>

        <label htmlFor="settings-display-name">Display name</label>
        <input
          id="settings-display-name"
          value={name}
          onChange={(event) => setName(event.target.value.slice(0, DISPLAY_NAME_MAX_LENGTH))}
          maxLength={DISPLAY_NAME_MAX_LENGTH}
        />

        <label htmlFor="settings-bio">Bio</label>
        <textarea
          id="settings-bio"
          value={bio}
          onChange={(event) => setBio(event.target.value.slice(0, BIO_MAX_LENGTH))}
          maxLength={BIO_MAX_LENGTH}
        />
        <small className="field-note">{bio.length}/{BIO_MAX_LENGTH}</small>

        <button className="btn" onClick={() => void save()} disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </button>

        {notice && (
          <p className="settings-notice" role="status" aria-live="polite">
            {notice}
          </p>
        )}

        <section className="blocked-settings" aria-labelledby="blocked-accounts-title">
          <div className="settings-section-head">
            <div>
              <b id="blocked-accounts-title">Blocked accounts</b>
              <span>
                Manage people you have blocked. Unblocking does not
                automatically follow them again.
              </span>
            </div>
            <strong aria-label={blockedAccounts.length + " blocked accounts"}>
              {blockedAccounts.length}
            </strong>
          </div>

          {blockedLoading ? (
            <p className="blocked-empty">Loading blocked accounts…</p>
          ) : blockedAccounts.length === 0 ? (
            <p className="blocked-empty">You have not blocked anyone.</p>
          ) : (
            <div className="blocked-list">
              {blockedAccounts.map((account) => (
                <div className="blocked-row" key={account.id}>
                  <AvatarImage
                    src={
                      account.avatar_url ||
                      initialsAvatar(account.display_name)
                    }
                    alt={account.display_name}
                    size={88}
                  />
                  <div>
                    <b>{account.display_name}</b>
                    <span>@{account.username}</span>
                  </div>
                  <button
                    className="btn secondary small"
                    disabled={unblockingId === account.id}
                    onClick={() =>
                      void unblockAccount({
                        id: account.id,
                        username: account.username,
                      })
                    }
                  >
                    {unblockingId === account.id
                      ? "Unblocking…"
                      : "Unblock"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="danger-zone">
          <div>
            <b>Sign out</b>
            <span>End this session on this device.</span>
          </div>
          <button className="btn secondary" onClick={signOut}>
            Sign out
          </button>
        </div>

        <section className="delete-account-zone" aria-labelledby="delete-account-title">
          <div>
            <b id="delete-account-title">Delete account</b>
            <span>
              Permanently delete your account, profile and social content.
              Your username stays reserved and cannot be claimed again.
            </span>
          </div>

          {!deleteOpen ? (
            <button
              className="btn danger-button"
              type="button"
              onClick={() => {
                setDeleteOpen(true);
                setNotice("");
              }}
            >
              Delete account
            </button>
          ) : (
            <div className="delete-confirm">
              <label htmlFor="delete-account-confirmation">
                Type <strong>@{profile.username}</strong> to confirm.
              </label>
              <input
                id="delete-account-confirmation"
                value={deleteValue}
                onChange={(event) =>
                  setDeleteValue(event.target.value.replace(/^@/, ""))
                }
                placeholder={profile.username}
                autoComplete="off"
                spellCheck={false}
              />
              <div>
                <button
                  type="button"
                  className="btn secondary"
                  disabled={deleting}
                  onClick={() => {
                    setDeleteOpen(false);
                    setDeleteValue("");
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn danger-button"
                  disabled={
                    deleting ||
                    deleteValue.trim().toLowerCase() !==
                      profile.username.toLowerCase()
                  }
                  onClick={() => void deleteAccount()}
                >
                  {deleting ? "Deleting…" : "Delete permanently"}
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
