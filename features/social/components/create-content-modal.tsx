"use client";

import type { ChangeEvent, FormEvent } from "react";
import AvatarImage from "./avatar-image";
import UserMediaImage from "./user-media-image";
import Icon from "./icon";
import { avatarFor } from "../lib/profile";
import type { MediaDimensions } from "../lib/media";
import type { Profile } from "../types";

export type CreateContentMode = "post" | "reel" | "story";

export default function CreateContentModal({
  profile,
  mode,
  caption,
  file,
  preview,
  dimensions,
  posting,
  onModeChange,
  onCaptionChange,
  onFileChange,
  onClose,
  onSubmit,
}: {
  profile: Profile;
  mode: CreateContentMode;
  caption: string;
  file: File | null;
  preview: string;
  dimensions: MediaDimensions | null;
  posting: boolean;
  onModeChange: (mode: CreateContentMode) => void;
  onCaptionChange: (value: string) => void;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
}) {
  return (
    <div
      className="modal"
      role="dialog"
      aria-modal="true"
      aria-label={"Create " + mode}
    >
      <form className="modal-box create-modal" onSubmit={onSubmit}>
        <div className="modal-header">
          <div>
            <div className="eyebrow">CREATE</div>
            <h2>
              {mode === "post"
                ? "New post"
                : mode === "reel"
                  ? "New reel"
                  : "New story"}
            </h2>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Close"
          >
            <Icon name="close" />
          </button>
        </div>

        <div className="create-type-tabs" role="tablist" aria-label="Content type">
          {(["post", "reel", "story"] as const).map((nextMode) => (
            <button
              key={nextMode}
              type="button"
              className={mode === nextMode ? "active" : ""}
              onClick={() => onModeChange(nextMode)}
            >
              {nextMode === "post"
                ? "Post"
                : nextMode === "reel"
                  ? "Reel"
                  : "Story"}
            </button>
          ))}
        </div>

        <div className="composer-author">
          <AvatarImage
            src={avatarFor(profile)}
            alt={profile.display_name}
            size={96}
          />
          <div>
            <b>{profile.display_name}</b>
            <small>@{profile.username}</small>
          </div>
        </div>

        {mode !== "story" && (
          <textarea
            value={caption}
            onChange={(event) => onCaptionChange(event.target.value.slice(0, 2200))}
            placeholder={
              mode === "reel"
                ? "Add a caption to your reel…"
                : "What’s worth sharing?"
            }
            autoFocus
          />
        )}

        <div className="composer-meta">
          <label className="upload-button">
            <Icon name="camera" size={17} />
            {mode === "reel"
              ? "Choose video"
              : mode === "story"
                ? "Choose story media"
                : "Add photo or video"}
            <input
              type="file"
              accept={mode === "reel" ? "video/*" : "image/*,video/*"}
              onChange={onFileChange}
            />
          </label>
          {mode !== "story" && <span>{caption.length}/2200</span>}
        </div>

        {mode === "story" && (
          <p className="create-hint">
            Stories are visible to you and your followers for 24 hours.
          </p>
        )}

        {mode === "reel" && (
          <p className="create-hint">
            Reels are real uploaded videos. AVENZO never inserts demo reels.
          </p>
        )}

        {preview &&
          (file?.type.startsWith("video/") ? (
            <video src={preview} controls className="upload-preview" />
          ) : (
            <UserMediaImage
              src={preview}
              className="upload-preview"
              alt={mode === "story" ? "Story preview" : "Post preview"}
              width={dimensions?.width}
              height={dimensions?.height}
              loading="eager"
            />
          ))}

        <div className="modal-actions">
          <button type="button" className="btn secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn" disabled={posting}>
            {posting
              ? "Publishing…"
              : mode === "post"
                ? "Publish Post"
                : mode === "reel"
                  ? "Publish Reel"
                  : "Publish Story"}
          </button>
        </div>
      </form>
    </div>
  );
}
