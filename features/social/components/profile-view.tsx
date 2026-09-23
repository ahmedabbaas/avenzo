import EmptyState from "./empty-state";
import { avatarFor } from "../lib/profile";
import type { Post, Profile, ProfileStats, Reel } from "../types";

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
  const mediaPosts = posts.filter((post) => post.media_path);

  return (
    <>
      <div className="profile-hero">
        <img src={avatarFor(profile)} alt="" />
        <div>
          <div className="profile-title-row">
            <div>
              <div className="eyebrow">@{profile.username}</div>
              <h1>{profile.display_name}</h1>
            </div>
            <button className="btn secondary small" onClick={onEdit}>
              Edit profile
            </button>
          </div>

          <p>{profile.bio || "Welcome to AVENZO."}</p>

          <div className="profile-stats">
            <span>
              <b>{stats.posts}</b> posts
            </span>
            <span>
              <b>{stats.followers}</b> followers
            </span>
            <span>
              <b>{stats.following}</b> following
            </span>
          </div>

          <div className="profile-create-actions">
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
      </div>

      <section className="profile-content-section">
        <div className="section-inline-head">
          <div>
            <div className="eyebrow">POSTS</div>
            <h3>{stats.posts} posts</h3>
          </div>
        </div>

        {mediaPosts.length > 0 ? (
          <div className="profile-grid">
            {mediaPosts.map((post) =>
              post.media_type === "video" ? (
                <video
                  key={post.id}
                  src={media(post.media_path!)}
                  preload="metadata"
                  controls
                  muted
                />
              ) : (
                <img
                  key={post.id}
                  src={media(post.media_path!)}
                  alt="Post"
                  loading="lazy"
                />
              )
            )}
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

      <section className="profile-content-section">
        <div className="section-inline-head">
          <div>
            <div className="eyebrow">REELS</div>
            <h3>{reels.length} reels</h3>
          </div>
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
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title="0 reels"
            text="Your reels will appear here after you upload a real video."
            action={onCreateReel}
            actionLabel="Create Reel"
          />
        )}
      </section>
    </>
  );
}
