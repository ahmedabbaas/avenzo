"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "../../../lib/supabase/client";
import AvatarImage from "../../social/components/avatar-image";
import VerifiedBadge from "../../social/components/verified-badge";
import { initialsAvatar } from "../../social/lib/profile";

type VerificationCandidate = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  verified: boolean;
  created_at: string;
};

export default function VerificationAdmin() {
  const supabase = useMemo(() => createClient(), []);
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<VerificationCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  const load = useCallback(async (search = "") => {
    setLoading(true);
    const { data, error } = await supabase.rpc("get_verification_candidates", {
      search_term: search.trim(),
    });

    if (error) {
      setNotice("Verification accounts could not be loaded.");
      setLoading(false);
      return;
    }

    setRows((data || []) as VerificationCandidate[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(query), query ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [query, load]);

  async function toggle(candidate: VerificationCandidate) {
    setBusy(candidate.id);
    setNotice("");

    const next = !candidate.verified;
    setRows((current) =>
      current.map((item) =>
        item.id === candidate.id ? { ...item, verified: next } : item
      )
    );

    const { error } = await supabase.rpc("set_profile_verification", {
      target_user: candidate.id,
      next_verified: next,
    });

    if (error) {
      setRows((current) =>
        current.map((item) =>
          item.id === candidate.id
            ? { ...item, verified: candidate.verified }
            : item
        )
      );
      setNotice("Verification status could not be changed.");
    } else {
      setNotice(
        next
          ? "Account verified."
          : "Verification removed."
      );
    }

    setBusy(null);
  }

  return (
    <section className="admin-verification-card">
      <div className="admin-verification-head">
        <div>
          <div className="eyebrow">ADMIN</div>
          <h1>Verification</h1>
          <p>Manually verify or unverify real AVENZO accounts.</p>
        </div>
        <a className="btn secondary small" href="/home">Back to Home</a>
      </div>

      <label className="admin-search">
        <span>Search users</span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Username or display name"
        />
      </label>

      {notice && <div className="admin-notice" role="status">{notice}</div>}

      <div className="verification-list">
        {loading ? (
          <p>Loading accounts…</p>
        ) : rows.length === 0 ? (
          <p>No matching accounts.</p>
        ) : (
          rows.map((candidate) => (
            <article key={candidate.id} className="verification-row">
              <AvatarImage
                src={candidate.avatar_url || initialsAvatar(candidate.display_name)}
                alt={candidate.display_name}
                size={80}
              />
              <div>
                <b>{candidate.display_name}</b>
                <span className="verified-line">
                  @{candidate.username}
                  <VerifiedBadge verified={candidate.verified} />
                </span>
              </div>
              <span className={"verification-status " + (candidate.verified ? "verified" : "")}>
                {candidate.verified ? "Verified" : "Not verified"}
              </span>
              <button
                className={candidate.verified ? "btn secondary small" : "btn small"}
                disabled={busy === candidate.id}
                onClick={() => void toggle(candidate)}
              >
                {busy === candidate.id
                  ? "Saving…"
                  : candidate.verified
                    ? "Unverify"
                    : "Verify"}
              </button>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
