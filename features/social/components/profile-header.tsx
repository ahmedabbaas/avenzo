"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import AvatarImage from "./avatar-image";
import Icon from "./icon";
import { formatProfileStat, normalizeProfileWebsite } from "../lib/profile";
import type { ProfileStats } from "../types";

export default function ProfileHeader({ profile, avatar, stats, followersHref, followingHref, actions, onAddStory, notice }: {
  profile: { username: string; display_name: string; bio: string; website?: string | null };
  avatar: string;
  stats: ProfileStats;
  followersHref: string;
  followingHref: string;
  actions: ReactNode;
  onAddStory?: () => void;
  notice?: string;
}) {
  const website = normalizeProfileWebsite(profile.website);
  return <section className="profile-header-premium" aria-label="Profile overview">
    <div className="profile-header-avatar">
      <AvatarImage src={avatar} alt={profile.display_name} size={180} />
      {onAddStory && <button type="button" aria-label="Add moment" onClick={onAddStory}><Icon name="plus" size={18} /></button>}
    </div>
    <div className="profile-header-identity">
      <h1>{profile.display_name}</h1>
      <span>@{profile.username}</span>
      {profile.bio && <p>{profile.bio}</p>}
      {website && <a className="profile-header-website" href={website.href} target="_blank" rel="noopener noreferrer nofollow"><Icon name="link" size={16} /><span>{website.label}</span></a>}
    </div>
    <div className="profile-header-stats" aria-label="Profile statistics">
      <span><b>{formatProfileStat(stats.posts)}</b><small>Posts</small></span>
      <Link href={followersHref}><b>{formatProfileStat(stats.followers)}</b><small>Followers</small></Link>
      <Link href={followingHref}><b>{formatProfileStat(stats.following)}</b><small>Following</small></Link>
    </div>
    <div className="profile-header-actions">{actions}</div>
    {notice && <p className="profile-header-notice" role="status">{notice}</p>}
  </section>;
}
