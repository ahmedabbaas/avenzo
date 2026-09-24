import Link from "next/link";
import { avatarFor } from "../lib/profile";
import type { Profile } from "../types";
import AvatarImage from "./avatar-image";
import VerifiedBadge from "./verified-badge";

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
        <AvatarImage className="person-avatar" src={avatarFor(person)} alt={person.display_name} size={80} />
        <div className="person-copy">
          <b>{person.display_name}</b>
          <span className="verified-line">@{person.username}<VerifiedBadge verified={person.verified} /></span>
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
