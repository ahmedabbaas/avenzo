"use client";

import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { createClient } from "../../../lib/supabase/client";
import AvatarImage from "../../social/components/avatar-image";
import VerifiedBadge from "../../social/components/verified-badge";
import Icon from "../../social/components/icon";
import { avatarFor, formatRelativeTime } from "../../social/lib/profile";
import type { Profile } from "../../social/types";
import {
  createGroupChat,
  fetchGroupChats,
  fetchGroupMembers,
  fetchGroupMessages,
  leaveGroupChat,
  searchGroupCandidates,
  sendGroupMessage,
} from "../group-data";
import type {
  GroupChat,
  GroupMember,
  GroupMessage,
} from "../group-types";

function groupAvatar(group: GroupChat) {
  return group.avatar_url || "";
}

function initialLetter(group: GroupChat) {
  return group.title.trim().charAt(0).toUpperCase() || "G";
}

export default function GroupMessagesWorkspace({
  currentUser,
}: {
  currentUser: Profile;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [groups, setGroups] = useState<GroupChat[]>([]);
  const [active, setActive] = useState<GroupChat | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [people, setPeople] = useState<Profile[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [groupTitle, setGroupTitle] = useState("");
  const [peopleQuery, setPeopleQuery] = useState("");
  const [messageText, setMessageText] = useState("");
  const [newGroupOpen, setNewGroupOpen] = useState(false);
  const [groupInfoOpen, setGroupInfoOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [sending, setSending] = useState(false);
  const bodyRef = useRef<HTMLDivElement | null>(null);

  const loadGroups = useCallback(async () => {
    setGroups(await fetchGroupChats(supabase, currentUser.id));
  }, [supabase, currentUser.id]);

  const loadGroup = useCallback(async (group: GroupChat) => {
    const [nextMembers, nextMessages] = await Promise.all([
      fetchGroupMembers(supabase, group.id),
      fetchGroupMessages(supabase, group.id),
    ]);
    setActive(group);
    setMembers(nextMembers);
    setMessages(nextMessages);
    window.setTimeout(() => {
      const node = bodyRef.current;
      if (node) node.scrollTop = node.scrollHeight;
    }, 0);
  }, [supabase]);

  const loadPeople = useCallback(async (search = "") => {
    setPeople(
      await searchGroupCandidates(supabase, currentUser.id, search)
    );
  }, [supabase, currentUser.id]);

  useEffect(() => {
    let alive = true;
    void Promise.all([loadGroups(), loadPeople()])
      .then(() => alive && setLoading(false))
      .catch(() => {
        if (!alive) return;
        setNotice("Groups could not be loaded right now.");
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [loadGroups, loadPeople]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadPeople(peopleQuery).catch(() =>
        setNotice("User search is unavailable right now.")
      );
    }, peopleQuery.trim() ? 260 : 0);

    return () => window.clearTimeout(timer);
  }, [peopleQuery, loadPeople]);

  useEffect(() => {
    const channel = supabase
      .channel("avenzo-group-list-" + currentUser.id)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "group_members" },
        () => void loadGroups()
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "group_messages" },
        async ({ new: inserted }) => {
          const row = inserted as GroupMessage;
          await loadGroups();
          if (active?.id === row.group_id) {
            setMessages(await fetchGroupMessages(supabase, active.id));
            window.setTimeout(() => {
              const node = bodyRef.current;
              if (node) node.scrollTop = node.scrollHeight;
            }, 0);
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, currentUser.id, active?.id, loadGroups]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 4500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  function togglePerson(id: string) {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    );
  }

  async function createGroup() {
    const title = groupTitle.trim();
    if (!title) {
      setNotice("Add a group name.");
      return;
    }
    if (!selectedIds.length) {
      setNotice("Choose at least one person.");
      return;
    }

    setSending(true);
    try {
      const groupId = await createGroupChat(
        supabase,
        title,
        selectedIds
      );
      setNewGroupOpen(false);
      setGroupTitle("");
      setSelectedIds([]);
      setPeopleQuery("");
      const next = await fetchGroupChats(supabase, currentUser.id);
      setGroups(next);
      const created = next.find((group) => group.id === groupId);
      if (created) await loadGroup(created);
      setNotice("Group created.");
    } catch {
      setNotice("Group could not be created.");
    } finally {
      setSending(false);
    }
  }

  async function send(event: FormEvent) {
    event.preventDefault();
    if (!active || !messageText.trim() || sending) return;

    setSending(true);
    try {
      await sendGroupMessage(
        supabase,
        active.id,
        messageText.trim()
      );
      setMessageText("");
      setMessages(await fetchGroupMessages(supabase, active.id));
      await loadGroups();
      window.setTimeout(() => {
        const node = bodyRef.current;
        if (node) node.scrollTop = node.scrollHeight;
      }, 0);
    } catch {
      setNotice("Message could not be sent.");
    } finally {
      setSending(false);
    }
  }

  async function leaveCurrentGroup() {
    if (!active) return;
    if (!window.confirm("Leave this group?")) return;

    try {
      await leaveGroupChat(supabase, active.id);
      setActive(null);
      setMessages([]);
      setMembers([]);
      setGroupInfoOpen(false);
      await loadGroups();
      setNotice("You left the group.");
    } catch {
      setNotice("Could not leave the group.");
    }
  }

  return (
    <div className="group-workspace">
      <section
        className={
          "group-sidebar " + (active ? "group-mobile-hidden" : "")
        }
      >
        <div className="group-sidebar-head">
          <div>
            <div className="eyebrow">MESSAGES</div>
            <h1>Groups</h1>
          </div>
          <button
            type="button"
            className="btn small"
            onClick={() => setNewGroupOpen(true)}
          >
            <Icon name="plus" size={16} />
            New Group
          </button>
        </div>

        <div className="group-switch-row">
          <Link href="/messages">Direct</Link>
          <span>Groups</span>
        </div>

        <div className="group-list">
          {loading ? (
            <div className="group-empty">
              <span className="loader" />
              <p>Loading groups…</p>
            </div>
          ) : groups.length === 0 ? (
            <div className="group-empty">
              <div className="group-empty-icon">
                <Icon name="messages" size={24} />
              </div>
              <h3>No groups yet</h3>
              <p>Create a group with real AVENZO users to start chatting.</p>
              <button
                type="button"
                className="btn small"
                onClick={() => setNewGroupOpen(true)}
              >
                Create Group
              </button>
            </div>
          ) : (
            groups.map((group) => (
              <button
                type="button"
                key={group.id}
                className={
                  "group-row " + (active?.id === group.id ? "active" : "")
                }
                onClick={() => void loadGroup(group)}
              >
                <span className="group-row-avatar">
                  {groupAvatar(group) ? (
                    <img src={groupAvatar(group)} alt="" />
                  ) : (
                    <b>{initialLetter(group)}</b>
                  )}
                </span>
                <span className="group-row-copy">
                  <strong>{group.title}</strong>
                  <small>
                    {group.last_message} · {group.member_count} members
                  </small>
                </span>
                <time>
                  {formatRelativeTime(group.last_message_at_effective)}
                </time>
              </button>
            ))
          )}
        </div>
      </section>

      <section
        className={
          "group-chat " + (!active ? "group-mobile-hidden" : "")
        }
      >
        {!active ? (
          <div className="group-chat-placeholder">
            <div className="group-empty-icon">
              <Icon name="messages" size={26} />
            </div>
            <h2>Your group chats</h2>
            <p>Select a group or create a new one.</p>
          </div>
        ) : (
          <>
            <header className="group-chat-head">
              <button
                type="button"
                className="group-back"
                onClick={() => setActive(null)}
                aria-label="Back to groups"
              >
                <Icon name="back" size={21} />
              </button>
              <span className="group-chat-avatar">
                {groupAvatar(active) ? (
                  <img src={groupAvatar(active)} alt="" />
                ) : (
                  <b>{initialLetter(active)}</b>
                )}
              </span>
              <div>
                <b>{active.title}</b>
                <small>{members.length} members</small>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={() => setGroupInfoOpen(true)}
                aria-label="Group info"
              >
                <Icon name="more" size={19} />
              </button>
            </header>

            <div className="group-message-area" ref={bodyRef}>
              {messages.length === 0 ? (
                <div className="group-conversation-start">
                  <span className="group-chat-avatar large">
                    {groupAvatar(active) ? (
                      <img src={groupAvatar(active)} alt="" />
                    ) : (
                      <b>{initialLetter(active)}</b>
                    )}
                  </span>
                  <h3>{active.title}</h3>
                  <p>
                    This is the beginning of this group conversation.
                  </p>
                </div>
              ) : (
                messages.map((message) => {
                  const own = message.sender_id === currentUser.id;
                  return (
                    <div
                      key={message.id}
                      className={
                        "group-message-row " + (own ? "me" : "them")
                      }
                    >
                      {!own && (
                        <AvatarImage
                          src={
                            message.sender
                              ? avatarFor({
                                  id: message.sender.user_id,
                                  username: message.sender.username,
                                  display_name: message.sender.display_name,
                                  bio: "",
                                  avatar_url: message.sender.avatar_url,
                                  verified: message.sender.verified,
                                })
                              : ""
                          }
                          alt=""
                          size={56}
                        />
                      )}

                      <div className="group-message-stack">
                        {!own && message.sender && (
                          <small className="group-message-sender">
                            <span className="verified-line">
                              {message.sender.display_name}
                              <VerifiedBadge
                                verified={message.sender.verified}
                              />
                            </span>
                          </small>
                        )}
                        <div
                          className={
                            "group-message-bubble" +
                            (message.deleted_at ? " deleted" : "")
                          }
                        >
                          {message.deleted_at
                            ? "Message deleted"
                            : message.body}
                        </div>
                        <small className="group-message-time">
                          {new Date(message.created_at).toLocaleTimeString(
                            [],
                            { hour: "2-digit", minute: "2-digit" }
                          )}
                        </small>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <form className="group-composer" onSubmit={send}>
              <div className="group-compose-row">
                <textarea
                  rows={1}
                  value={messageText}
                  maxLength={5000}
                  onChange={(event) => setMessageText(event.target.value)}
                  placeholder="Message group…"
                  aria-label="Message group"
                />
                <button
                  className="send-button"
                  disabled={!messageText.trim() || sending}
                  aria-label="Send group message"
                >
                  <Icon name="send" size={19} />
                </button>
              </div>
            </form>
          </>
        )}
      </section>

      {notice && (
        <div className="dm-inline-notice group-notice" role="status">
          <span>{notice}</span>
          <button
            type="button"
            onClick={() => setNotice("")}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      {newGroupOpen && (
        <div
          className="modal"
          role="dialog"
          aria-modal="true"
          aria-label="Create group"
          onClick={() => setNewGroupOpen(false)}
        >
          <div
            className="group-create-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="group-create-head">
              <div>
                <small>NEW GROUP</small>
                <h2>Create group chat</h2>
              </div>
              <button
                type="button"
                onClick={() => setNewGroupOpen(false)}
                aria-label="Close"
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            <label className="settings-field">
              <span>Group name</span>
              <input
                value={groupTitle}
                maxLength={80}
                onChange={(event) => setGroupTitle(event.target.value)}
                placeholder="e.g. AVENZO Team"
              />
            </label>

            <label className="group-user-search">
              <Icon name="search" size={16} />
              <input
                value={peopleQuery}
                onChange={(event) => setPeopleQuery(event.target.value)}
                placeholder="Search people"
              />
            </label>

            <div className="group-selected-count">
              {selectedIds.length} selected
            </div>

            <div className="group-user-list">
              {people.map((person) => {
                const selected = selectedIds.includes(person.id);
                return (
                  <button
                    type="button"
                    key={person.id}
                    className={selected ? "selected" : ""}
                    onClick={() => togglePerson(person.id)}
                  >
                    <AvatarImage
                      src={avatarFor(person)}
                      alt={person.display_name}
                      size={72}
                    />
                    <span>
                      <b className="verified-line">
                        {person.display_name}
                        <VerifiedBadge verified={person.verified} />
                      </b>
                      <small>@{person.username}</small>
                    </span>
                    <i>{selected ? "✓" : "+"}</i>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              className="btn group-create-submit"
              disabled={
                sending ||
                !groupTitle.trim() ||
                selectedIds.length === 0
              }
              onClick={() => void createGroup()}
            >
              {sending ? "Creating…" : "Create Group"}
            </button>
          </div>
        </div>
      )}

      {groupInfoOpen && active && (
        <div
          className="modal"
          role="dialog"
          aria-modal="true"
          aria-label="Group info"
          onClick={() => setGroupInfoOpen(false)}
        >
          <div
            className="group-info-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="group-create-head">
              <div>
                <small>GROUP INFO</small>
                <h2>{active.title}</h2>
              </div>
              <button
                type="button"
                onClick={() => setGroupInfoOpen(false)}
                aria-label="Close"
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            <div className="group-member-list">
              {members.map((member) => (
                <div key={member.user_id}>
                  <AvatarImage
                    src={avatarFor({
                      id: member.user_id,
                      username: member.username,
                      display_name: member.display_name,
                      bio: "",
                      avatar_url: member.avatar_url,
                      verified: member.verified,
                    })}
                    alt={member.display_name}
                    size={72}
                  />
                  <span>
                    <b className="verified-line">
                      {member.display_name}
                      <VerifiedBadge verified={member.verified} />
                    </b>
                    <small>
                      @{member.username}
                      {member.role !== "member"
                        ? " · " + member.role
                        : ""}
                    </small>
                  </span>
                </div>
              ))}
            </div>

            <button
              type="button"
              className="btn danger"
              onClick={() => void leaveCurrentGroup()}
            >
              Leave Group
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
