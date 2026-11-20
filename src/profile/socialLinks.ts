export type AlumniId = number;

export const socialPlatforms = [
  {
    key: "linkedin",
    label: "LinkedIn",
    placeholder: "linkedin.com/in/your-name",
    hosts: ["linkedin.com"],
  },
  {
    key: "instagram",
    label: "Instagram",
    placeholder: "instagram.com/your-handle",
    hosts: ["instagram.com"],
  },
  {
    key: "x",
    label: "X (Twitter)",
    placeholder: "x.com/your-handle",
    hosts: ["x.com", "twitter.com"],
  },
  {
    key: "facebook",
    label: "Facebook",
    placeholder: "facebook.com/your-name",
    hosts: ["facebook.com", "fb.com"],
  },
  {
    key: "youtube",
    label: "YouTube",
    placeholder: "youtube.com/@your-channel",
    hosts: ["youtube.com", "youtu.be"],
  },
  {
    key: "website",
    label: "Personal Website",
    placeholder: "yourwebsite.com",
    hosts: [],
  },
] as const;

export type SocialPlatform = (typeof socialPlatforms)[number]["key"];

/** Saved, normalized links. A missing key means the alumnus has not shared that platform. */
export type SocialLinks = Partial<Record<SocialPlatform, string>>;

/** Raw text currently in the edit form, including empty fields. */
export type SocialLinksDraft = Record<SocialPlatform, string>;

export type SocialLinkErrors = Partial<Record<SocialPlatform, string>>;

/** Server-ready payload shape for a future profile API. */
export type AlumniSocialLinksRecord = {
  alumniId: AlumniId;
  links: SocialLinks;
  updatedAt: string;
};

export function toSocialLinksDraft(links: SocialLinks = {}): SocialLinksDraft {
  return Object.fromEntries(
    socialPlatforms.map(({ key }) => [key, links[key] ?? ""]),
  ) as SocialLinksDraft;
}

function hostMatches(hostname: string, allowedHost: string) {
  return hostname === allowedHost || hostname.endsWith(`.${allowedHost}`);
}

/** Returns a normalized https/http URL, or an error message for a user-entered link. */
export function normalizeSocialLink(
  platform: SocialPlatform,
  value: string,
): { url?: string; error?: string } {
  const trimmed = value.trim();
  if (!trimmed) return {};
  if (/\s/.test(trimmed)) return { error: "Remove spaces from this link." };

  const hasScheme = /^[a-z][a-z\d+.-]*:/i.test(trimmed);
  const candidate = hasScheme ? trimmed : `https://${trimmed.replace(/^\/\//, "")}`;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return { error: "Enter a valid URL." };
  }

  if (url.protocol !== "https:" && url.protocol !== "http:")
    return { error: "Use a link that starts with http:// or https://." };
  if (url.username || url.password) return { error: "Remove login details from this link." };

  const hostname = url.hostname.toLowerCase();
  if (!hostname.includes(".") || hostname.startsWith(".") || hostname.endsWith("."))
    return { error: "Enter a complete website address." };

  const config = socialPlatforms.find((item) => item.key === platform)!;
  if (config.hosts.length) {
    if (!config.hosts.some((host) => hostMatches(hostname, host)))
      return { error: `Enter a ${config.label} link.` };
    if (url.pathname === "/" || !url.pathname.replace(/\//g, ""))
      return { error: `Include your ${config.label} profile path.` };
  }

  return { url: url.href };
}

export function validateSocialLinks(draft: SocialLinksDraft): {
  links: SocialLinks;
  errors: SocialLinkErrors;
} {
  const links: SocialLinks = {};
  const errors: SocialLinkErrors = {};
  for (const { key } of socialPlatforms) {
    const result = normalizeSocialLink(key, draft[key]);
    if (result.error) errors[key] = result.error;
    else if (result.url) links[key] = result.url;
  }
  return { links, errors };
}

export function getSharedSocialLinks(links: SocialLinks = {}) {
  return socialPlatforms.flatMap((platform) => {
    const url = links[platform.key];
    return url ? [{ ...platform, url }] : [];
  });
}
