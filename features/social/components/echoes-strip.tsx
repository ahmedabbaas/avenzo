"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "../../../lib/supabase/client";
import type { Profile } from "../types";
import AvatarImage from "./avatar-image";
import Icon from "./icon";
import { avatarFor } from "../lib/profile";

type EchoAudience = "everyone" | "followers" | "close_friends";

type EchoRow = {
  user_id: string;
  body: string;
  audience: EchoAudience;
  created_at: string;
  updated_at: string;
  expires_at: string;
  profile?: Profile;
};

const AUDIENCES: Array<{ id: EchoAudience; label: string }> = [
  { id: "followers", label: "Followers" },
  { id: "close_friends", label: "Circle" },
  { id: "everyone", label: "Everyone" },
];

export default function EchoesStrip({
  currentUser,
}: {
  currentUser: Profile;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [echoes, setEchoes] = useState<EchoRow[]>([]);
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<EchoAudience>("followers");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("notes")
      .select("user_id,body,audience,created_at,updated_at,expires_at")
      .gt("expires_at", new Date().toISOString())
      .order("updated_at", { ascending: false })
      .limit(40);

    if (error) {
      setNotice("Echoes could not load.");
      return;
    }

    const rows = (data || []) as EchoRow[];
    const userIds = [...new Set(rows.map((row) => row.user_id))];
    let profileMap = new Map<string, Profile>();

    if (userIds.length) {
      const profiles = await supabase
        .from("profiles")
        .select("id,username,display_name,bio,avatar_url,website,verified,created_at")
        .in("id", userIds);

      profileMap = new Map(
        ((profiles.data || []) as Profile[]).map((profile) => [
          profile.id,
          profile,
        ])
      );
    }

    setEchoes(
      rows
        .map((row) => ({ ...row, profile: profileMap.get(row.user_id) }))
        .sort((a, b) => {
          if (a.user_id === currentUser.id) return -1;
          if (b.user_id === currentUser.id) return 1;
          return (
            new Date(b.updated_at).getTime() -
            new Date(a.updated_at).getTime()
          );
        })
    );
  }, [currentUser.id, supabase]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => {
      void load();
    }, 0);

    const channel = supabase
      .channel("avenzo-echoes-" + currentUser.id)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notes" },
        () => void load()
      )
      .subscribe();

    return () => {
      window.clearTimeout(initialLoad);
      void supabase.removeChannel(channel);
    };
  }, [currentUser.id, load, supabase]);

  const own = echoes.find((echo) => echo.user_id === currentUser.id);

  function openComposer() {
    setBody(own?.body || "");
    setAudience(own?.audience || "followers");
    setNotice("");
    setEditing(true);
  }

  async function saveEcho() {
    const clean = body.trim().slice(0, 80);
    if (!clean || saving) return;

    setSaving(true);
    setNotice("");

    try {
      const now = new Date();
      const result = await supabase.from("notes").upsert(
        {
          user_id: currentUser.id,
          body: clean,
          audience,
          updated_at: now.toISOString(),
          expires_at: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
        },
        { onConflict: "user_id" }
      );

      if (result.error) throw result.error;

      setEditing(false);
      await load();
    } catch {
      setNotice("Echo could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function clearEcho() {
    if (saving) return;
    setSaving(true);

    try {
      const result = await supabase
        .from("notes")
        .delete()
        .eq("user_id", currentUser.id);
      if (result.error) throw result.error;
      setEditing(false);
      setBody("");
      await load();
    } catch {
      setNotice("Echo could not be removed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="avenzo-echoes" aria-label="Echoes">
      <div className="avenzo-echoes-head">
        <div>
          <span>AVENZO ECHOES</span>
          <b>What&apos;s on your mind?</b>
        </div>
        <small>24h</small>
      </div>

      <div className="avenzo-echoes-row">
        <button
          type="button"
          className={"avenzo-echo-card own " + (own ? "has-echo" : "")}
          onClick={openComposer}
        >
          <span className="avenzo-echo-avatar">
            <AvatarImage
              src={avatarFor(currentUser)}
              alt={currentUser.display_name}
              size={70}
            />
            <i><Icon name="plus" size={12} /></i>
          </span>
          <span>
            <b>{own?.body || "Add an Echo"}</b>
            <small>{own ? "Tap to edit" : "Visible for 24 hours"}</small>
          </span>
        </button>

        {echoes
          .filter((echo) => echo.user_id !== currentUser.id && echo.profile)
          .map((echo) => (
            <Link
              key={echo.user_id}
              className="avenzo-echo-card"
              href={"/u/" + encodeURIComponent(echo.profile?.username || "")}
            >
              <AvatarImage
                src={avatarFor(echo.profile || currentUser)}
                alt={echo.profile?.display_name || "AVENZO user"}
                size={70}
              />
              <span>
                <b>{echo.body}</b>
                <small>@{echo.profile?.username}</small>
              </span>
            </Link>
          ))}
      </div>

      {editing && (
        <div className="avenzo-echo-composer">
          <label>
            <span>Your Echo</span>
            <textarea
              autoFocus
              value={body}
              maxLength={80}
              onChange={(event) => setBody(event.target.value.slice(0, 80))}
              placeholder="Share a thought, plan or mood…"
            />
            <small>{body.length}/80</small>
          </label>

          <div className="avenzo-echo-audience">
            {AUDIENCES.map((item) => (
              <button
                type="button"
                key={item.id}
                className={audience === item.id ? "active" : ""}
                onClick={() => setAudience(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>

          {notice && <p role="status">{notice}</p>}

          <div className="avenzo-echo-actions">
            {own && (
              <button type="button" className="danger" onClick={() => void clearEcho()}>
                Remove
              </button>
            )}
            <button type="button" onClick={() => setEditing(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="primary"
              disabled={!body.trim() || saving}
              onClick={() => void saveEcho()}
            >
              {saving ? "Saving…" : "Share Echo"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
