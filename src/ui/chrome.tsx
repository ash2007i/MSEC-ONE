import type { ReactNode } from "react";
import institutionLogo from "../assets/msgi-institution-logo.png";
import msgiOneLogo from "../assets/msgi-one-logo.png";

export type AvatarPerson = { name: string; role?: string; image?: string };

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export type IconName =
  | "home"
  | "users"
  | "map"
  | "message"
  | "user"
  | "bell"
  | "search"
  | "sliders"
  | "briefcase"
  | "pin"
  | "calendar"
  | "arrow"
  | "check"
  | "send"
  | "paperclip"
  | "chevron"
  | "eye"
  | "lock"
  | "linkedin"
  | "instagram"
  | "x"
  | "facebook"
  | "youtube"
  | "globe"
  | "external"
  | "edit"
  | "settings"
  | "logout"
  | "close"
  | "compass"
  | "spark"
  | "shield"
  | "mail"
  | "palette"
  | "help"
  | "file"
  | "info"
  | "database"
  | "share"
  | "qr"
  | "moon"
  | "sun"
  | "monitor"
  | "type"
  | "motion"
  | "smartphone"
  | "laptop"
  | "key"
  | "alert"
  | "copy"
  | "download"
  | "wifi"
  | "trash"
  | "link"
  | "clock"
  | "flag"
  | "book"
  | "phone"
  | "building"
  | "eyeOff"
  | "refresh"
  | "upload"
  | "plus"
  | "minus"
  | "userX"
  | "history"
  | "heart"
  | "lifebuoy"
  | "chat"
  | "feed"
  | "image"
  | "video"
  | "bookmark"
  | "repost"
  | "more";

const iconPaths: Record<IconName, ReactNode> = {
  home: (
    <>
      <path d="m3.5 10 7.2-6a2 2 0 0 1 2.6 0l7.2 6V19a2 2 0 0 1-2 2H15v-6a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v6H5.5a2 2 0 0 1-2-2Z" />
    </>
  ),
  users: (
    <>
      <path d="M15.5 20v-1.5a4 4 0 0 0-4-4h-5a4 4 0 0 0-4 4V20M21.5 20v-1.5a4 4 0 0 0-3.5-4" />
      <circle cx="9" cy="7" r="3.5" />
      <path d="M16 3.7a3.5 3.5 0 0 1 0 6.6" />
    </>
  ),
  map: (
    <>
      <path d="m9 3 6 3 4.6-2.3a1 1 0 0 1 1.4.9v12.8a1 1 0 0 1-.6.9L15 21l-6-3-4.6 2.3a1 1 0 0 1-1.4-.9V6.6a1 1 0 0 1 .6-.9Z" />
      <path d="M9 3v15M15 6v15" />
    </>
  ),
  message: (
    <>
      <path d="M20.5 14.5a4 4 0 0 1-4 4H9L4 21V7.5a4 4 0 0 1 4-4h8.5a4 4 0 0 1 4 4Z" />
      <path d="M8 9h8M8 13h5" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="7.5" r="3.5" />
      <path d="M4.5 20v-1a5 5 0 0 1 5-5h5a5 5 0 0 1 5 5v1" />
    </>
  ),
  bell: (
    <>
      <path d="M18 9a6 6 0 0 0-12 0v3.5l-1.5 3a1 1 0 0 0 .9 1.5h13.2a1 1 0 0 0 .9-1.5l-1.5-3ZM10 21h4" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </>
  ),
  sliders: (
    <>
      <path d="M3 7h4m4 0h10M3 17h10m4 0h4" />
      <circle cx="9" cy="7" r="2" />
      <circle cx="15" cy="17" r="2" />
    </>
  ),
  briefcase: (
    <>
      <rect x="3" y="7" width="18" height="13" rx="3" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12a20 20 0 0 0 18 0M12 12v3" />
    </>
  ),
  pin: (
    <>
      <path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M16 3v4M8 3v4M3 10h18" />
    </>
  ),
  arrow: (
    <>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  send: (
    <>
      <path d="m20 3-16 6a1 1 0 0 0 0 1.9l6.5 2.6 2.6 6.5a1 1 0 0 0 1.9 0l6-16a.8.8 0 0 0-1-1ZM20 4l-9.5 9.5" />
    </>
  ),
  paperclip: (
    <path d="m21.4 11.6-8.9 8.9a6 6 0 0 1-8.5-8.5l9.6-9.6a4 4 0 0 1 5.7 5.7l-9.6 9.6a2 2 0 0 1-2.8-2.8l8.9-8.9" />
  ),
  chevron: <path d="m9 18 6-6-6-6" />,
  eye: (
    <>
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
      <circle cx="12" cy="12" r="2.5" />
    </>
  ),
  lock: (
    <>
      <rect x="4" y="10" width="16" height="11" rx="3" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </>
  ),
  linkedin: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <path d="M8 10v7M8 7v.01M12 17v-4a3 3 0 0 1 6 0v4M12 10v7" />
    </>
  ),
  instagram: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <path d="M17.5 6.5v.01" />
    </>
  ),
  x: <path d="M4 4l16 16M20 4l-6.6 6.6M10.6 13.4 4 20" />,
  facebook: (
    <path d="M15 3h-2.5A4.5 4.5 0 0 0 8 7.5V10H5.5v4H8v7h4v-7h3l1-4h-4V7.8c0-.6.4-.8 1-.8h2Z" />
  ),
  youtube: (
    <>
      <rect x="2.5" y="5" width="19" height="14" rx="4" />
      <path d="m10 9 5 3-5 3Z" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
    </>
  ),
  external: (
    <>
      <path d="M14 4h6v6M20 4l-9 9" />
      <path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" />
    </>
  ),
  edit: (
    <>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" />
    </>
  ),
  logout: (
    <>
      <path d="M10 17l5-5-5-5M15 12H3" />
      <path d="M14 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5" />
    </>
  ),
  close: (
    <>
      <path d="m6 6 12 12M18 6 6 18" />
    </>
  ),
  compass: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m16 8-2.5 5.5L8 16l2.5-5.5Z" />
    </>
  ),
  spark: (
    <>
      <path d="m12 3 1.4 4.6L18 9l-4.6 1.4L12 15l-1.4-4.6L6 9l4.6-1.4Z" />
      <path d="m19 15 .7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7Z" />
    </>
  ),
  shield: (
    <>
      <path d="M12 21s8-3.8 8-9.5V6a1 1 0 0 0-.7-1l-7-2.5a1 1 0 0 0-.6 0L4.7 5a1 1 0 0 0-.7 1v5.5C4 17.2 12 21 12 21Z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="3" />
      <path d="m3 7 9 6 9-6" />
    </>
  ),
  palette: (
    <>
      <path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.8-.9 1.8-1.9 0-.5-.2-.9-.5-1.3-.3-.3-.5-.8-.5-1.3 0-1 .8-1.8 1.8-1.8H17a4 4 0 0 0 4-4C21 6.4 17 3 12 3Z" />
      <path d="M7.5 11.5h.01M10 7.5h.01M14.5 7.5h.01M17 11h.01" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.2a2.6 2.6 0 0 1 5 .8c0 1.8-2.5 2.2-2.5 3.8M12 17h.01" />
    </>
  ),
  file: (
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
      <path d="M14 3v5h5M9 13h6M9 17h4" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6M12 7.5h.01" />
    </>
  ),
  database: (
    <>
      <ellipse cx="12" cy="5.5" rx="7.5" ry="2.5" />
      <path d="M4.5 5.5v13c0 1.4 3.4 2.5 7.5 2.5s7.5-1.1 7.5-2.5v-13M4.5 12c0 1.4 3.4 2.5 7.5 2.5s7.5-1.1 7.5-2.5" />
    </>
  ),
  share: (
    <>
      <circle cx="18" cy="5" r="2.5" />
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="19" r="2.5" />
      <path d="m8.2 10.8 7.6-4.6M8.2 13.2l7.6 4.6" />
    </>
  ),
  qr: (
    <>
      <rect x="3.5" y="3.5" width="6" height="6" rx="1.5" />
      <rect x="14.5" y="3.5" width="6" height="6" rx="1.5" />
      <rect x="3.5" y="14.5" width="6" height="6" rx="1.5" />
      <path d="M14.5 14.5h2.5v2.5M20.5 14.5v.01M14.5 20.5h.01M17.5 20.5h3v-3" />
    </>
  ),
  moon: <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" />
    </>
  ),
  monitor: (
    <>
      <rect x="3" y="4" width="18" height="12" rx="2.5" />
      <path d="M8.5 20h7M12 16v4" />
    </>
  ),
  type: <path d="M4 7V5h16v2M12 5v14M9 19h6" />,
  motion: (
    <>
      <path d="M3 8h9a3 3 0 1 0-3-3M3 16h13a3 3 0 1 1-3 3M3 12h17" />
    </>
  ),
  smartphone: (
    <>
      <rect x="6.5" y="2.5" width="11" height="19" rx="2.5" />
      <path d="M11 18.5h2" />
    </>
  ),
  laptop: (
    <>
      <rect x="4.5" y="4.5" width="15" height="10.5" rx="2" />
      <path d="M2.5 19.5h19" />
    </>
  ),
  key: (
    <>
      <circle cx="8" cy="15" r="4.5" />
      <path d="m11.2 11.8 8.3-8.3M16.5 6.5l2.5 2.5M14 9l2 2" />
    </>
  ),
  alert: (
    <>
      <path d="M10.3 4.2 2.8 17.5A2 2 0 0 0 4.5 20.5h15a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9.5v4M12 17h.01" />
    </>
  ),
  copy: (
    <>
      <rect x="8.5" y="8.5" width="12" height="12" rx="2.5" />
      <path d="M15.5 8.5V6a2.5 2.5 0 0 0-2.5-2.5H6A2.5 2.5 0 0 0 3.5 6v7A2.5 2.5 0 0 0 6 15.5h2.5" />
    </>
  ),
  download: <path d="M12 3.5v12M7 10.5l5 5 5-5M4.5 20.5h15" />,
  wifi: (
    <>
      <path d="M2.5 9a14 14 0 0 1 19 0M5.5 12.5a9.5 9.5 0 0 1 13 0M8.5 16a5 5 0 0 1 7 0" />
      <path d="M12 19.5h.01" />
    </>
  ),
  trash: <path d="M3.5 6.5h17M9 6.5V4h6v2.5M6 6.5l1 14h10l1-14M10 10.5v6M14 10.5v6" />,
  link: (
    <>
      <path d="M10 14a4.5 4.5 0 0 0 6.4 0l3.2-3.2a4.5 4.5 0 0 0-6.4-6.4L12 5.6" />
      <path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3.2 3.2a4.5 4.5 0 0 0 6.4 6.4l1.2-1.2" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </>
  ),
  flag: <path d="M5 21V4.5M5 4.5h11l-2 4 2 4H5" />,
  book: (
    <>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5Z" />
      <path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5M8.5 7.5h7" />
    </>
  ),
  phone: (
    <path d="M20.5 16.6v2.6a2 2 0 0 1-2.2 2A17.5 17.5 0 0 1 2.8 5.7a2 2 0 0 1 2-2.2h2.6a1.5 1.5 0 0 1 1.5 1.2l.6 3a1.5 1.5 0 0 1-.4 1.4L7.7 10.5a14 14 0 0 0 5.8 5.8l1.4-1.4a1.5 1.5 0 0 1 1.4-.4l3 .6a1.5 1.5 0 0 1 1.2 1.5Z" />
  ),
  building: (
    <>
      <path d="M3 21h18M5 21V9.5L12 4l7 5.5V21" />
      <path d="M9 21v-6h6v6M9 11h.01M15 11h.01" />
    </>
  ),
  eyeOff: (
    <>
      <path d="M3 3l18 18M10.6 6.1A10.7 10.7 0 0 1 12 6c6.5 0 10 6 10 6a17 17 0 0 1-3.2 3.9M6.6 6.6C3.8 8.4 2 12 2 12s3.5 6 10 6a9.7 9.7 0 0 0 4.4-1" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 11a8 8 0 0 0-14.3-4.6L3.5 9M4 13a8 8 0 0 0 14.3 4.6L20.5 15" />
      <path d="M3.5 4v5h5M20.5 20v-5h-5" />
    </>
  ),
  upload: <path d="M12 15.5v-12M7 8.5l5-5 5 5M4.5 20.5h15" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  userX: (
    <>
      <circle cx="9.5" cy="7.5" r="3.5" />
      <path d="M2.5 20v-1a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v1M16.5 7.5l5 5M21.5 7.5l-5 5" />
    </>
  ),
  history: (
    <>
      <path d="M3.5 12a8.5 8.5 0 1 0 2.5-6L3.5 8.5" />
      <path d="M3.5 3.5v5h5M12 8v4.5l3 1.8" />
    </>
  ),
  heart: (
    <path d="M12 20s-7.5-4.4-7.5-10A4.3 4.3 0 0 1 12 7.3 4.3 4.3 0 0 1 19.5 10c0 5.6-7.5 10-7.5 10Z" />
  ),
  lifebuoy: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="3.5" />
      <path d="m5.6 5.6 3.9 3.9M14.5 14.5l3.9 3.9M18.4 5.6l-3.9 3.9M9.5 14.5l-3.9 3.9" />
    </>
  ),
  chat: (
    <>
      <path d="M20.5 14.5a4 4 0 0 1-4 4H9L4 21V7.5a4 4 0 0 1 4-4h8.5a4 4 0 0 1 4 4Z" />
    </>
  ),
  feed: (
    <>
      <path
        d="M2.5 19.5V5l8 4.8L18.5 5v14.5h-4V11l-4 2.4-4-2.4v8.5Z"
        fill="currentColor"
        stroke="none"
      />
      <path d="m14.5 13 7-3.6v3l-7 3.6Zm0 4 7-3.6v3l-7 3.6Zm0 4 7-3.6v3l-7 3.6Z" fill="var(--gold)" stroke="none" />
    </>
  ),
  image: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <circle cx="8.5" cy="9" r="1.5" />
      <path d="m4.5 18 5-5 3.5 3.5 2.5-2.5 4 4" />
    </>
  ),
  video: (
    <>
      <rect x="3" y="6" width="13" height="12" rx="3" />
      <path d="m16 10 5-3v10l-5-3Z" />
    </>
  ),
  bookmark: <path d="M6 4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21l-6-3.5L6 21Z" />,
  repost: (
    <>
      <path d="m17 2.5 3.5 3.5L17 9.5M20.5 6H8a4 4 0 0 0-4 4v1" />
      <path d="m7 21.5-3.5-3.5L7 14.5M3.5 18H16a4 4 0 0 0 4-4v-1" />
    </>
  ),
  more: (
    <>
      <circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" />
    </>
  ),
};

export function Icon({
  name,
  size = 20,
  className = "",
}: {
  name: IconName;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {iconPaths[name]}
    </svg>
  );
}


export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand ${compact ? "brand--compact" : ""}`}>
      <img
        className="brand__institution"
        src={institutionLogo}
        alt="Meenakshi Sundararajan Group of Institutions"
      />
      <img className="brand__one" src={msgiOneLogo} alt="MSGI One — Alumni Network & Community" />
    </div>
  );
}

export function BrandBar({ action }: { action?: ReactNode }) {
  return (
    <div className="brand-bar">
      <Logo compact />
      {action && <div className="brand-bar__action">{action}</div>}
    </div>
  );
}

export function MainHeader({
  person,
  onProfile,
  onNotifications,
}: {
  person: AvatarPerson;
  onProfile: () => void;
  onNotifications?: () => void;
}) {
  return (
    <div className="main-header">
      <button className="main-header__profile" onClick={onProfile} aria-label="Open profile">
        <Avatar person={person} size="md" />
      </button>
      <Logo compact />
      <button className="notification" onClick={onNotifications} aria-label="Notifications">
        <Icon name="bell" />
        <span />
      </button>
    </div>
  );
}

export function GlassPanel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`glass-panel ${className}`}>{children}</section>;
}

export function FrostedIcon({ name }: { name: IconName }) {
  return (
    <span className="frosted-icon">
      <Icon name={name} />
    </span>
  );
}

export function Avatar({
  person,
  size = "md",
  online = false,
}: {
  person: AvatarPerson;
  size?: "sm" | "md" | "lg" | "xl";
  online?: boolean;
}) {
  return (
    <div className={`avatar avatar--${size}`}>
      {person.image ? (
        <img src={person.image} alt={person.role ? `${person.name}, ${person.role}` : person.name} />
      ) : (
        <span className="avatar__initials" aria-label={person.name}>
          {initials(person.name)}
        </span>
      )}
      {online && <span className="online-dot" />}
    </div>
  );
}

export function VerifyBadge({ label = "Verified alumni" }: { label?: string }) {
  return (
    <span className="verified">
      <Icon name="check" size={11} />
      {label}
    </span>
  );
}

export function TopBar({
  title,
  onBack,
  action,
  backLabel = "Go back",
}: {
  title: string;
  onBack?: () => void;
  action?: ReactNode;
  backLabel?: string;
}) {
  return (
    <header className="topbar curved-header">
      <BrandBar />
      <div className="header-title-row">
        <div className="topbar__side">
          {onBack && (
            <button className="icon-button" onClick={onBack} aria-label={backLabel}>
              <Icon name="arrow" className="back-icon" />
            </button>
          )}
        </div>
        <h1>{title}</h1>
        <div className="topbar__side topbar__side--right">{action}</div>
      </div>
    </header>
  );
}
