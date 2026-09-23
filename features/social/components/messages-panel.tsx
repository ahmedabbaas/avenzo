"use client";

import type { KeyboardEvent } from "react";
import Icon from "./icon";
import { avatarFor, formatRelativeTime } from "../lib/profile";
import type { Chat, Message, Profile } from "../types";
import AvatarImage from "./avatar-image";

export default function MessagesPanel({
  people,
  chats,
  selected,
  openChat,
  messages,
  userId,
  text,
  setText,
  send,
  onBack,
}: {
  people: Profile[];
  chats: Chat[];
  selected: Profile | null;
  openChat: (profile: Profile) => void;
  messages: Message[];
  userId: string;
  text: string;
  setText: (value: string) => void;
  send: () => void;
  onBack: () => void;
}) {
  const list = chats
    .map((chat) => chat.profile)
    .concat(
      people
        .filter((person) => !chats.some((chat) => chat.profile.id === person.id))
        .slice(0, 12)
    );

  const chatMap = new Map(chats.map((chat) => [chat.profile.id, chat]));

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      send();
    }
  };

  return (
    <div className="chat">
      <div className={"chat-list " + (selected ? "mobile-hidden" : "")}>
        <div className="chat-list-title">
          <div>
            <div className="eyebrow">MESSAGES</div>
            <h3>Conversations</h3>
          </div>
        </div>

        {list.map((person) => {
          const chat = chatMap.get(person.id);
          return (
            <button
              className={"chat-user " + (selected?.id === person.id ? "active" : "")}
              key={person.id}
              onClick={() => openChat(person)}
            >
              <AvatarImage src={avatarFor(person)} alt={person.display_name} size={80} />
              <span>
                <b>{person.display_name}</b>
                <small>{chat?.last || "Start a conversation"}</small>
              </span>
              {chat?.unread ? <i className="chat-unread">{chat.unread}</i> : null}
            </button>
          );
        })}

        {list.length === 0 && (
          <p className="chat-list-empty">No people to message yet.</p>
        )}
      </div>

      <div className={"chat-main " + (!selected ? "mobile-hidden" : "")}>
        {selected ? (
          <>
            <div className="chat-head">
              <button
                className="chat-back"
                onClick={onBack}
                aria-label="Back to conversations"
              >
                <Icon name="back" size={19} />
              </button>
              <AvatarImage src={avatarFor(selected)} alt={selected.display_name} size={96} />
              <div>
                <b>{selected.display_name}</b>
                <small>@{selected.username}</small>
              </div>
            </div>

            <div className="chat-body">
              {messages.length === 0 && (
                <div className="conversation-start">
                  <AvatarImage src={avatarFor(selected)} alt={selected.display_name} size={96} />
                  <b>{selected.display_name}</b>
                  <span>@{selected.username}</span>
                  <p>Start the conversation.</p>
                </div>
              )}

              {messages.map((item) => (
                <div
                  key={item.id}
                  className={"message-row " + (item.sender_id === userId ? "me" : "")}
                >
                  <div className="bubble">{item.body}</div>
                  <small>{formatRelativeTime(item.created_at)}</small>
                </div>
              ))}
            </div>

            <div className="chat-compose">
              <input
                value={text}
                onChange={(event) => setText(event.target.value.slice(0, 5000))}
                onKeyDown={handleKeyDown}
                placeholder="Write a message…"
                aria-label="Message"
              />
              <button className="send-button" onClick={send} disabled={!text.trim()}>
                <Icon name="send" size={18} />
              </button>
            </div>
          </>
        ) : (
          <div className="empty chat-empty">
            <span className="empty-mark">A</span>
            <b>Your messages</b>
            <p>Choose a person to start a private conversation.</p>
          </div>
        )}
      </div>
    </div>
  );
}

