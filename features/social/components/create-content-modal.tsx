"use client";

import { useRef, useState, type DragEvent, type FormEvent } from "react";
import AvatarImage from "./avatar-image";
import UserMediaImage from "./user-media-image";
import Icon from "./icon";
import VerifiedBadge from "./verified-badge";
import { avatarFor } from "../lib/profile";
import type { MediaDimensions } from "../lib/media";
import type { Profile } from "../types";

export type CreateContentMode = "post" | "reel" | "story";

export default function CreateContentModal({
  profile,
  mode,
  title,
  caption,
  hashtags,
  mentions,
  location,
  file,
  preview,
  coverFile,
  coverPreview,
  dimensions,
  posting,
  uploadProgress,
  onModeChange,
  onTitleChange,
  onCaptionChange,
  onHashtagsChange,
  onMentionsChange,
  onLocationChange,
  onFileSelect,
  onCoverSelect,
  onClose,
  onSubmit,
}: {
  profile: Profile;
  mode: CreateContentMode;
  title: string;
  caption: string;
  hashtags: string;
  mentions: string;
  location: string;
  file: File | null;
  preview: string;
  coverFile: File | null;
  coverPreview: string;
  dimensions: MediaDimensions | null;
  posting: boolean;
  uploadProgress: number;
  onModeChange: (mode: CreateContentMode) => void;
  onTitleChange: (value: string) => void;
  onCaptionChange: (value: string) => void;
  onHashtagsChange: (value: string) => void;
  onMentionsChange: (value: string) => void;
  onLocationChange: (value: string) => void;
  onFileSelect: (file: File | null) => void;
  onCoverSelect: (file: File | null) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const coverInput = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function drop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    onFileSelect(event.dataTransfer.files?.[0] || null);
  }

  const isVideo = Boolean(file?.type.startsWith("video/"));

  return (
    <div
      className="modal"
      role="dialog"
      aria-modal="true"
      aria-label={"Create " + mode}
    >
      <form className="modal-box create-modal create-upload-panel" onSubmit={onSubmit}>
        <div className="modal-header">
          <div>
            <div className="eyebrow">CREATE / UPLOAD</div>
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
            disabled={posting}
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
              disabled={posting}
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
            <small className="verified-line">
              @{profile.username}
              <VerifiedBadge verified={profile.verified} />
            </small>
          </div>
        </div>

        <div
          className={"upload-dropzone " + (dragging ? "dragging" : "")}
          onDragEnter={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={() => setDragging(false)}
          onDrop={drop}
          onClick={() => !posting && fileInput.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if ((event.key === "Enter" || event.key === " ") && !posting) {
              event.preventDefault();
              fileInput.current?.click();
            }
          }}
        >
          <Icon name={mode === "reel" ? "reels" : "camera"} size={26} />
          <b>
            {file
              ? file.name
              : mode === "reel"
                ? "Drop a vertical video here"
                : "Drop an image or video here"}
          </b>
          <span>
            {mode === "reel"
              ? "Portrait video only · up to 25 MB"
              : "JPEG, PNG, WebP, GIF, MP4, WebM or MOV · up to 25 MB"}
          </span>
          <button type="button" className="btn secondary small" disabled={posting}>
            Choose file
          </button>
          <input
            ref={fileInput}
            type="file"
            hidden
            accept={mode === "reel" ? "video/*" : "image/*,video/*"}
            onChange={(event) => {
              onFileSelect(event.target.files?.[0] || null);
              event.target.value = "";
            }}
          />
        </div>

        {preview &&
          (isVideo ? (
            <div className={"upload-preview-frame " + (mode === "reel" ? "vertical" : "")}>
              <video
                src={preview}
                controls
                playsInline
                preload="metadata"
                className="upload-preview"
              />
            </div>
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

        {dimensions && (
          <div className="upload-dimensions">
            {dimensions.width} × {dimensions.height}
            {mode === "reel" && (
              <span>
                {dimensions.height > dimensions.width
                  ? " · Vertical ✓"
                  : " · Needs portrait orientation"}
              </span>
            )}
          </div>
        )}

        {mode === "reel" && (
          <label className="create-field">
            <span>Title</span>
            <input
              value={title}
              onChange={(event) => onTitleChange(event.target.value.slice(0, 120))}
              placeholder="Give your reel a title"
              maxLength={120}
            />
          </label>
        )}

        <label className="create-field">
          <span>Caption</span>
          <textarea
            value={caption}
            onChange={(event) => onCaptionChange(event.target.value.slice(0, 2200))}
            placeholder={
              mode === "story"
                ? "Add a story caption…"
                : mode === "reel"
                  ? "Tell people what this reel is about…"
                  : "What’s worth sharing?"
            }
            maxLength={2200}
          />
          <small>{caption.length}/2200</small>
        </label>

        <div className="create-meta-grid">
          <label className="create-field">
            <span>Hashtags</span>
            <input
              value={hashtags}
              onChange={(event) => onHashtagsChange(event.target.value.slice(0, 500))}
              placeholder="#avenzo #video"
            />
          </label>
          <label className="create-field">
            <span>Mentions</span>
            <input
              value={mentions}
              onChange={(event) => onMentionsChange(event.target.value.slice(0, 500))}
              placeholder="@username"
            />
          </label>
          <label className="create-field create-location-field">
            <span>Location</span>
            <input
              value={location}
              onChange={(event) => onLocationChange(event.target.value.slice(0, 160))}
              placeholder="Add location"
              maxLength={160}
            />
          </label>
        </div>

        {isVideo && (
          <div className="cover-picker">
            <div>
              <b>Cover image</b>
              <span>Optional. Choose the image shown before the video starts.</span>
            </div>
            <button
              type="button"
              className="btn secondary small"
              onClick={() => coverInput.current?.click()}
              disabled={posting}
            >
              {coverFile ? "Change cover" : "Choose cover"}
            </button>
            <input
              ref={coverInput}
              hidden
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => {
                onCoverSelect(event.target.files?.[0] || null);
                event.target.value = "";
              }}
            />
            {coverPreview && (
              <img className="cover-preview" src={coverPreview} alt="Video cover preview" />
            )}
          </div>
        )}

        {mode === "story" && (
          <p className="create-hint">
            Stories expire after 24 hours. Captions and metadata stay attached to the story while it is live.
          </p>
        )}

        {mode === "reel" && (
          <p className="create-hint">
            Reels require a portrait video. Views are counted per signed-in viewer and displayed publicly.
          </p>
        )}

        {posting && (
          <div className="upload-progress" aria-live="polite">
            <div>
              <b>Uploading</b>
              <span>{Math.max(0, Math.min(100, uploadProgress))}%</span>
            </div>
            <progress max={100} value={Math.max(0, Math.min(100, uploadProgress))} />
          </div>
        )}

        <div className="modal-actions">
          <button
            type="button"
            className="btn secondary"
            onClick={onClose}
            disabled={posting}
          >
            Cancel
          </button>
          <button
            className="btn"
            disabled={
              posting ||
              (mode === "reel" &&
                (!file || !dimensions || dimensions.height <= dimensions.width)) ||
              (mode === "story" && !file)
            }
          >
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
