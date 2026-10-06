import Link from "next/link";
import { avatarFor } from "../lib/profile";
import type { Profile } from "../types";
import AvatarImage from "./avatar-image";

export default function PersonCard({
  person,
  following,
  requested = false,
  onFollow,
  onMessage,
  compact = false,
  own = false,
}: {
  person: Profile;
  following: boolean;
  requested?: boolean;
  onFollow: () => void;
  onMessage: () => void;
  compact?: boolean;
  own?: boolean;
}) {
  return (
    <article className={"person-card" + (compact ? " person-search-row" : "")}>
      <Link className="person-profile-link" href={"/u/" + encodeURIComponent(person.username)}>
        <AvatarImage className="person-avatar" src={avatarFor(person)} alt={person.display_name} size={80} />
        <div className="person-copy">
          <b>{compact ? person.username : person.display_name}</b>
          <span>{compact ? person.display_name : "@" + person.username}</span>
          {!compact && person.bio && <p>{person.bio}</p>}
        </div>
      </Link>
      {!own && <div className="person-actions">
        <button
          className={"btn small " + (requested ? "requested" : "")}
          onClick={onFollow}
        >
          {following ? "Following" : requested ? "Requested" : "Follow"}
        </button>
        {!compact && <button className="btn secondary small" onClick={onMessage}>
          Message
        </button>}
      </div>}
    </article>
  );
}
