import Link from "next/link";
import { avatarFor } from "../lib/profile";
import type { Profile } from "../types";

export default function PersonCard({
  person,
  following,
  onFollow,
  onMessage,
}: {
  person: Profile;
  following: boolean;
  onFollow: () => void;
  onMessage: () => void;
}) {
  return (
    <article className="person-card">
      <Link className="person-profile-link" href={"/u/" + encodeURIComponent(person.username)}>
        <img className="person-avatar" src={avatarFor(person)} alt="" />
        <div className="person-copy">
          <b>{person.display_name}</b>
          <span>@{person.username}</span>
          <p>{person.bio || "New to AVENZO."}</p>
        </div>
      </Link>
      <div className="person-actions">
        <button className="btn small" onClick={onFollow}>
          {following ? "Following" : "Follow"}
        </button>
        <button className="btn secondary small" onClick={onMessage}>
          Message
        </button>
      </div>
    </article>
  );
}

