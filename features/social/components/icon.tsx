import type { ReactNode } from "react";

export type IconName =
  | "home"
  | "explore"
  | "messages"
  | "activity"
  | "saved"
  | "profile"
  | "settings"
  | "plus"
  | "logout"
  | "search"
  | "heart"
  | "comment"
  | "bookmark"
  | "send"
  | "close"
  | "camera"
  | "back"
  | "paperclip"
  | "smile"
  | "more"
  | "reels"
  | "eye"
  | "phone"
  | "mic"
  | "repost";


export default function Icon({ name, size = 19 }: { name: IconName; size?: number }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  const paths: Record<IconName, ReactNode> = {
    home: (
      <>
        <path d="M3.5 10.5 12 3l8.5 7.5" />
        <path d="M5.5 9.5V21h13V9.5" />
        <path d="M9.5 21v-7h5v7" />
      </>
    ),
    explore: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="m15.5 8.5-2.1 4.9-4.9 2.1 2.1-4.9 4.9-2.1Z" />
      </>
    ),
    messages: (
      <>
        <path d="M4 5.5h16v11H9l-5 4v-15Z" />
        <path d="M8 9.5h8M8 13h5" />
      </>
    ),
    activity: (
      <>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 8.5h18C21 15 18 15 18 8Z" />
        <path d="M9.5 20a3 3 0 0 0 5 0" />
      </>
    ),
    saved: <path d="M6.5 3.5h11v17L12 17l-5.5 3.5v-17Z" />,
    profile: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4.5 21c.8-4.2 3.2-6.2 7.5-6.2s6.7 2 7.5 6.2" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4v-.2a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    logout: (
      <>
        <path d="M10 5H5v14h5" />
        <path d="m14 8 4 4-4 4M18 12H9" />
      </>
    ),
    search: (
      <>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m15.5 15.5 5 5" />
      </>
    ),
    heart: <path d="M20.5 9c0 5-8.5 10-8.5 10S3.5 14 3.5 9A4.5 4.5 0 0 1 12 6.8 4.5 4.5 0 0 1 20.5 9Z" />,
    comment: <path d="M4 5h16v11H9l-5 4V5Z" />,
    bookmark: <path d="M6.5 3.5h11v17L12 17l-5.5 3.5v-17Z" />,
    send: (
      <>
        <path d="m3.5 4 17 8-17 8 3-8-3-8Z" />
        <path d="M6.5 12h14" />
      </>
    ),
    close: <path d="m6 6 12 12M18 6 6 18" />,
    camera: (
      <>
        <path d="M4 7.5h4l1.3-2h5.4l1.3 2h4v11H4v-11Z" />
        <circle cx="12" cy="13" r="3.5" />
      </>
    ),
    back: (
      <>
        <path d="m15 5-7 7 7 7" />
        <path d="M8 12h12" />
      </>
    ),
    paperclip: (
      <path d="m9.5 12.5 5.8-5.8a3 3 0 1 1 4.2 4.2l-7.8 7.8a5 5 0 0 1-7.1-7.1l7.4-7.4" />
    ),
    smile: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M9 10h.01M15 10h.01M8.5 14.5c1 1.2 2.1 1.8 3.5 1.8s2.5-.6 3.5-1.8" />
      </>
    ),
    more: (
      <>
        <circle cx="5" cy="12" r="1" />
        <circle cx="12" cy="12" r="1" />
        <circle cx="19" cy="12" r="1" />
      </>
    ),
    reels: (
      <>
        <rect x="5" y="3" width="14" height="18" rx="3" />
        <path d="m10 9 5 3-5 3V9Z" />
      </>
    ),
    eye: (
      <>
        <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
        <circle cx="12" cy="12" r="2.5" />
      </>
    ),
    phone: (
      <path d="M7 4.5 10 8 8.4 10.3a15.2 15.2 0 0 0 5.3 5.3L16 14l3.5 3c.5.4.6 1.1.2 1.6l-1.2 1.5c-.5.6-1.2.9-2 .8-6.7-.8-12.6-6.7-13.4-13.4-.1-.8.2-1.5.8-2l1.5-1.2c.5-.4 1.2-.3 1.6.2Z" />
    ),
    mic: (
      <>
        <rect x="9" y="3" width="6" height="11" rx="3" />
        <path d="M6.5 11.5a5.5 5.5 0 0 0 11 0M12 17v4M9 21h6" />
      </>
    ),
    repost: (
      <>
        <path d="M7 7h10.5l-2.6-2.6" />
        <path d="m17.5 7-2.6 2.6" />
        <path d="M17 17H6.5l2.6 2.6" />
        <path d="m6.5 17 2.6-2.6" />
        <path d="M18 8.5v4M6 15.5v-4" />
      </>
    ),
  };

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...common}>
      {paths[name]}
    </svg>
  );
}

