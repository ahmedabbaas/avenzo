import EmptyState from "./empty-state";
import { avatarFor, formatRelativeTime } from "../lib/profile";
import type { Post, Profile, ProfileStats, Reel } from "../types";
import AvatarImage from "./avatar-image";
import UserMediaImage from "./user-media-image";

export default function ProfileView({
  profile,
  posts,
  reels,
  media,
  stats,
  onEdit,
  onCreatePost,
  onCreateReel,
  onCreateStory,
}: {
  profile: Profile;
  posts: Post[];
  reels: Reel[];
  media: (path: string) => string;
  stats: ProfileStats;
  onEdit: () => void;
  onCreatePost: () => void;
  onCreateReel: () => void;
  onCreateStory: () => void;
}) {
  return (
    <div className="profile-page">
      <section className="profile-hero">
        <AvatarImage
          src={avatarFor(profile)}
          alt={profile.display_name}
          size={180}
        />

        <div className="profile-hero-copy">
          <div className="profile-title-row">
            <div className="profile-identity">
              <div className="eyebrow">@{profile.username}</div>
              <h1>{profile.display_name}</h1>
            </div>

            <button className="btn secondary small profile-edit" onClick={onEdit}>
              Edit profile
            </button>
          </div>

          <p className="profile-bio">{profile.bio || "Welcome to AVENZO."}</p>

          <div className="profile-stats" aria-label="Profile statistics">
            <span>
              <b>{stats.posts}</b>
              <small>Posts</small>
            </span>
            <span>
              <b>{stats.followers}</b>
              <small>Followers</small>
            </span>
            <span>
              <b>{stats.following}</b>
              <small>Following</small>
            </span>
          </div>

          <div className="profile-create-actions" aria-label="Create content">
            <button className="btn small" onClick={onCreatePost}>
              Create Post
            </button>
            <button className="btn secondary small" onClick={onCreateReel}>
              Create Reel
            </button>
            <button className="btn secondary small" onClick={onCreateStory}>
              Create Story
            </button>
          </div>
        </div>
      </section>

      <section className="profile-content-section" aria-labelledby="profile-posts-title">
        <div className="profile-section-head">
          <div>
            <div className="eyebrow">CONTENT</div>
            <h2 id="profile-posts-title">Posts</h2>
          </div>
          <span className="profile-section-count">{stats.posts}</span>
        </div>

        {posts.length > 0 ? (
          <div className="profile-grid">
            {posts.map((post) => {
              if (!post.media_path) {
                return (
                  <article className="profile-text-post" key={post.id}>
                    <span>TEXT POST</span>
                    <p>{post.caption}</p>
                    <small>{formatRelativeTime(post.created_at)}</small>
                  </article>
                );
              }

              return post.media_type === "video" ? (
                <video
                  key={post.id}
                  src={media(post.media_path)}
                  preload="metadata"
                  controls
                  muted
                  playsInline
                />
              ) : (
                <UserMediaImage
                  key={post.id}
                  src={media(post.media_path)}
                  alt={post.caption || "AVENZO post"}
                  width={post.media_width}
                  height={post.media_height}
                />
              );
            })}
          </div>
        ) : (
          <EmptyState
            title="No posts yet."
            text="Your profile starts empty. Publish your first real post when you’re ready."
            action={onCreatePost}
            actionLabel="Create Post"
          />
        )}
      </section>

      <section className="profile-content-section" aria-labelledby="profile-reels-title">
        <div className="profile-section-head">
          <div>
            <div className="eyebrow">VIDEO</div>
            <h2 id="profile-reels-title">Reels</h2>
          </div>
          <span className="profile-section-count">{reels.length}</span>
        </div>

        {reels.length > 0 ? (
          <div className="profile-grid reel-profile-grid">
            {reels.map((reel) => (
              <video
                key={reel.id}
                src={media(reel.media_path)}
                preload="metadata"
                controls
                muted
                playsInline
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No reels yet."
            text="Your reels will appear here after you upload a real video."
            action={onCreateReel}
            actionLabel="Create Reel"
          />
        )}
      </section>
    </div>
  );
}
