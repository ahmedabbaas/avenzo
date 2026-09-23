import type { Profile } from "../types";

export function initialsAvatar(name: string) {
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "A";

  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160">' +
    '<rect width="160" height="160" rx="80" fill="#151a1e"/>' +
    '<circle cx="80" cy="80" r="78" fill="none" stroke="#dfff63" stroke-opacity=".4" stroke-width="2"/>' +
    '<text x="80" y="91" text-anchor="middle" font-family="Arial, sans-serif" font-size="48" font-weight="700" fill="#f6f7f8">' +
    initials +
    "</text></svg>";

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export function avatarFor(profile: Profile) {
  return profile.avatar_url || initialsAvatar(profile.display_name);
}

export function formatRelativeTime(value: string) {
  const time = new Date(value).getTime();
  const seconds = Math.max(1, Math.floor((Date.now() - time) / 1000));

  if (seconds < 60) return "now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;

  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
