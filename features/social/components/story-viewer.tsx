"use client";

import AvatarImage from "./avatar-image";
import UserMediaImage from "./user-media-image";
import Icon from "./icon";
import { avatarFor, formatRelativeTime } from "../lib/profile";
import type { Profile, Story } from "../types";

export default function StoryViewer({
  story,
  fallbackProfile,
  mediaUrl,
  onClose,
  autoplayVideo = true,
  dataSaving = false,
}: {
  story: Story;
  fallbackProfile: Profile;
  mediaUrl: (path: string) => string;
  onClose: () => void;
  autoplayVideo?: boolean;
  dataSaving?: boolean;
}) {
  const author = story.profile || fallbackProfile;

  return (
    <div
      className="modal story-viewer-shell"
      role="dialog"
      aria-modal="true"
      aria-label="Story"
      onClick={onClose}
    >
      <div className="story-viewer" onClick={(event) => event.stopPropagation()}>
        <div className="story-viewer-head">
          <div className="person-line">
            <AvatarImage
              src={avatarFor(author)}
              alt={author.display_name}
              size={80}
            />
            <div>
              <b>{author.display_name}</b>
              <small>
                @{author.username} · {formatRelativeTime(story.created_at)}
              </small>
            </div>
          </div>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Close story"
          >
            <Icon name="close" />
          </button>
        </div>

        {story.media_type === "video" ? (
          <video
            src={mediaUrl(story.media_path)}
            controls
            autoPlay={autoplayVideo}
            muted={autoplayVideo}
            preload={dataSaving ? "none" : "metadata"}
            playsInline
            className="story-viewer-media"
          />
        ) : (
          <UserMediaImage
            src={mediaUrl(story.media_path)}
            alt="Story"
            className="story-viewer-media"
            width={story.media_width}
            height={story.media_height}
            loading="eager"
          />
        )}

        <small className="story-expiry">
          Expires {new Date(story.expires_at).toLocaleString()}
        </small>
      </div>
    </div>
  );
}
