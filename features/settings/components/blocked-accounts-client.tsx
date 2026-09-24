"use client";

import { useMemo, useState } from "react";
import { createClient } from "../../../lib/supabase/client";
import AvatarImage from "../../social/components/avatar-image";
import { initialsAvatar } from "../../social/lib/profile";

type BlockedAccount = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  blocked_at: string;
};

export default function BlockedAccountsClient({
  initialAccounts,
}: {
  initialAccounts: BlockedAccount[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const [accounts, setAccounts] = useState(initialAccounts);
  const [busyId, setBusyId] = useState("");
  const [status, setStatus] = useState("");

  async function unblock(account: BlockedAccount) {
    if (!window.confirm(`Unblock @${account.username}?`)) return;

    setBusyId(account.id);
    setStatus("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setBusyId("");
      setStatus("Your session expired. Sign in again.");
      return;
    }

    const { error } = await supabase
      .from("blocks")
      .delete()
      .eq("blocker_id", user.id)
      .eq("blocked_id", account.id);

    setBusyId("");

    if (error) {
      setStatus("Could not unblock this account.");
      return;
    }

    setAccounts((current) => current.filter((item) => item.id !== account.id));
    setStatus(`@${account.username} has been unblocked.`);
  }

  return (
    <div className="blocked-page-card">
      {accounts.length === 0 ? (
        <div className="settings-empty-state">
          <span>A</span>
          <b>No blocked accounts</b>
          <p>Accounts you block will appear here so you can manage them later.</p>
        </div>
      ) : (
        <div className="blocked-list">
          {accounts.map((account) => (
            <div className="blocked-row" key={account.id}>
              <AvatarImage
                src={account.avatar_url || initialsAvatar(account.display_name)}
                alt={account.display_name}
                size={88}
              />
              <div>
                <b>{account.display_name}</b>
                <span>@{account.username}</span>
                <small>
                  Blocked {new Date(account.blocked_at).toLocaleDateString()}
                </small>
              </div>
              <button
                className="btn secondary small"
                disabled={busyId === account.id}
                onClick={() => void unblock(account)}
              >
                {busyId === account.id ? "Unblocking…" : "Unblock"}
              </button>
            </div>
          ))}
        </div>
      )}

      {status && (
        <p className="settings-status" role="status" aria-live="polite">
          {status}
        </p>
      )}
    </div>
  );
}
