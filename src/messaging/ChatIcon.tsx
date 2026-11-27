import type { ReactNode } from "react";

const paths = {
  back: <path d="m14 6-6 6 6 6M8 12h12" />,
  more: (
    <>
      <circle cx="5" cy="12" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
    </>
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </>
  ),
  close: <path d="m6 6 12 12M18 6 6 18" />,
  plus: <path d="M12 5v14M5 12h14" />,
  smile: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 14a4.5 4.5 0 0 0 8 0M8 9h.01M16 9h.01" />
    </>
  ),
  react: (
    <>
      <path d="M20.5 14a8.7 8.7 0 1 1-11-10.5M7 13a5 5 0 0 0 7 4M7.5 8.5h.01M13 8.5h.01M18 2v8M14 6h8" />
    </>
  ),
  reply: <path d="m10 5-7 6 7 6v-4h3a7 7 0 0 1 8 6v-4a8 8 0 0 0-8-8h-3Z" />,
  forward: <path d="m14 5 7 6-7 6v-4h-3a7 7 0 0 0-8 6v-4a8 8 0 0 1 8-8h3Z" />,
  edit: (
    <>
      <path d="M13 20h8M15 4l5 5M4 16 16 4a2 2 0 0 1 4 4L8 20l-5 1Z" />
    </>
  ),
  copy: (
    <>
      <rect x="8" y="8" width="12" height="13" rx="3" />
      <path d="M15 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h3" />
    </>
  ),
  pin: (
    <>
      <path d="m8 3 8 0-1 7 4 4v2H5v-2l4-4ZM12 16v6" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6M12 7h.01" />
    </>
  ),
  trash: (
    <>
      <path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7" />
    </>
  ),
  video: (
    <>
      <rect x="3" y="5" width="12" height="14" rx="3" />
      <path d="m15 10 6-4v12l-6-4" />
    </>
  ),
  phone: (
    <path d="m9 4-4-1a2 2 0 0 0-2 2c0 9 7 16 16 16a2 2 0 0 0 2-2l-1-4-5-1-2 3a13 13 0 0 1-6-6l3-2Z" />
  ),
  mic: (
    <>
      <rect x="9" y="2" width="6" height="13" rx="3" />
      <path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8" />
    </>
  ),
  send: (
    <>
      <path d="m20 3-16 6a1 1 0 0 0 0 2l6 2 3 7a1 1 0 0 0 2 0l6-16a1 1 0 0 0-1-1ZM20 4l-10 9" />
    </>
  ),
  upload: (
    <>
      <path d="M12 16V3m-5 5 5-5 5 5M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M8 3v4M16 3v4M3 11h18" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  checks: (
    <>
      <path d="m2 12 4 4L16 6M10 16l2 2L22 8" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  shield: (
    <>
      <path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z" />
      <path d="m8 12 3 3 5-6" />
    </>
  ),
  file: (
    <>
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9ZM14 3v6h6M8 13h8M8 17h5" />
    </>
  ),
  briefcase: (
    <>
      <rect x="3" y="7" width="18" height="14" rx="3" />
      <path d="M8 7V3h8v4M3 12a22 22 0 0 0 18 0M12 12v3" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="7" r="4" />
      <path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" />
    </>
  ),
  nature: (
    <>
      <path d="M20 4C8 1 1 10 7 17c8 7 15-1 13-13ZM5 21 17 8" />
    </>
  ),
  food: (
    <>
      <path d="M4 3v6a3 3 0 0 0 6 0V3M7 3v18M19 3c-4 0-5 10 0 10v8M19 3v10" />
    </>
  ),
  activity: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m7 4 3 5-5 5 2 6M18 5l-4 5 5 6-3 5" />
    </>
  ),
  travel: (
    <>
      <path d="m3 17 7-5V4a2 2 0 0 1 4 0v8l7 5v3l-7-3v4h-4v-4l-7 3Z" />
    </>
  ),
  object: (
    <>
      <path d="M8 16a7 7 0 1 1 8 0l-1 3H9ZM9 22h6M10 19h4" />
    </>
  ),
  symbol: (
    <>
      <path d="M4 8h16M3 16h16M10 3 6 21M18 3l-4 18" />
    </>
  ),
  flag: (
    <>
      <path d="M5 22V3c4-3 10 4 15 0v12c-5 4-11-3-15 0" />
    </>
  ),
  download: (
    <>
      <path d="M12 3v13m-5-5 5 5 5-5M4 17v4h16v-4" />
    </>
  ),
  retry: (
    <>
      <path d="M20 8a8 8 0 1 0 1 7M20 3v5h-5" />
    </>
  ),
} satisfies Record<string, ReactNode>;
export type ChatIconName = keyof typeof paths;
export function ChatIcon({ name, size = 20 }: { name: ChatIconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
