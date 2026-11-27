/**
 * User-specific settings for MSGI One.
 *
 * Every group below has an initial value (`createDefaultSettings`), a current value
 * (`UserSettings`), available options (exported `*Options` constants), save behaviour
 * (`loadSettings` / `saveSettings`) and validation helpers. The prototype persists to
 * this device's localStorage; an API adapter can replace those two functions later.
 */

export const SETTINGS_VERSION = 1;
export const APP_VERSION = "1.0.0";
export const APP_BUILD = "2025.03";

export const themeOptions = ["light", "dark", "system"] as const;
export type ThemePreference = (typeof themeOptions)[number];
export type ResolvedTheme = "light" | "dark";
export const textSizeOptions = ["default", "large"] as const;
export type TextSize = (typeof textSizeOptions)[number];
export const languageOptions = ["en", "ta"] as const;
export type Language = (typeof languageOptions)[number];

export type AppearanceSettings = {
  theme: ThemePreference;
  textSize: TextSize;
  reduceMotion: boolean;
};

export const notificationGroups = [
  { key: "messaging", items: ["newMessages", "messageRequests"] },
  {
    key: "networking",
    items: ["connectionRequests", "connectionAccepted", "profileInteractions"],
  },
  {
    key: "events",
    items: [
      "upcomingEvents",
      "eventReminders",
      "jobOpportunities",
      "internshipOpportunities",
      "mentorshipRequests",
    ],
  },
  {
    key: "institution",
    items: ["institutionalAnnouncements", "communityUpdates", "importantAnnouncements"],
  },
] as const;
export type NotificationGroup = (typeof notificationGroups)[number]["key"];
export type NotificationCategory = (typeof notificationGroups)[number]["items"][number];
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export const weekdays: Weekday[] = [1, 2, 3, 4, 5, 6, 0];

export type QuietHours = { enabled: boolean; start: string; end: string; days: Weekday[] };
export type NotificationSettings = {
  /** Master switch. Turning it off pauses delivery but keeps individual choices. */
  enabled: boolean;
  categories: Record<NotificationCategory, boolean>;
  push: boolean;
  email: boolean;
  quietHours: QuietHours;
};

export const profileVisibilityOptions = ["alumni", "private", "public"] as const;
export type ProfileVisibility = (typeof profileVisibilityOptions)[number];
export const personalFields = [
  "email",
  "phone",
  "graduationYear",
  "department",
  "workplace",
  "designation",
  "location",
  "socialLinks",
] as const;
export type PersonalField = (typeof personalFields)[number];
export const audienceOptions = ["alumni", "connections", "none"] as const;
export type Audience = (typeof audienceOptions)[number];
export type BlockedUser = { id: string; name: string; department: string; year: string };
export type PrivacySettings = {
  profileVisibility: ProfileVisibility;
  fields: Record<PersonalField, boolean>;
  messageRequests: Audience;
  directContact: Audience;
  nonConnectionMessages: boolean;
  /** Only city and approximate distance are ever shared; precise location is never stored. */
  locationVisible: boolean;
  blocked: BlockedUser[];
};

export type DeviceType = "phone" | "laptop" | "tablet" | "desktop";
export type Session = {
  id: string;
  device: string;
  type: DeviceType;
  location: string;
  lastActive: string;
  current?: boolean;
};
export type LoginEvent = {
  id: string;
  device: string;
  type: DeviceType;
  location: string;
  time: string;
  status: "success" | "blocked";
};
export const twoFactorMethods = ["app", "sms"] as const;
export type TwoFactorMethod = (typeof twoFactorMethods)[number];
export type SecuritySettings = {
  twoFactor: boolean;
  twoFactorMethod: TwoFactorMethod;
  recoveryEmail: string;
  recoveryPhone: string;
  passwordChangedAt: string;
  suspiciousLoginAlerts: boolean;
  securityAlerts: boolean;
  sessions: Session[];
  loginActivity: LoginEvent[];
};

export const networkingInterestOptions = [
  "ai",
  "software",
  "entrepreneurship",
  "business",
  "research",
  "cybersecurity",
  "data",
  "design",
  "higherEd",
  "career",
] as const;
export const industryOptions = [
  "it",
  "saas",
  "manufacturing",
  "finance",
  "healthcare",
  "education",
  "consulting",
  "public",
] as const;
export const careerOptions = [
  "fulltime",
  "leadership",
  "remote",
  "freelance",
  "higherStudies",
] as const;
export const opportunityOptions = ["jobs", "internships", "startups", "research"] as const;
export const mentorshipOptions = [
  "mentoring",
  "seekingMentor",
  "networking",
  "careerGuidance",
] as const;
export const communicationOptions = ["inApp", "email", "video"] as const;
export const MENTORSHIP_NOTE_MAX = 280;
export type CommunitySettings = {
  networkingInterests: (typeof networkingInterestOptions)[number][];
  industries: (typeof industryOptions)[number][];
  careerPreferences: (typeof careerOptions)[number][];
  opportunities: Record<(typeof opportunityOptions)[number], boolean>;
  mentorship: Record<(typeof mentorshipOptions)[number], boolean>;
  mentorshipNote: string;
  communication: (typeof communicationOptions)[number];
  /** Community preferences stay private unless the member opts in. */
  shareOnProfile: boolean;
};

export type MediaItem = {
  id: string;
  name: string;
  kind: "image" | "document" | "video";
  bytes: number;
  source: string;
};
export type StorageSettings = {
  cacheBytes: number;
  media: MediaItem[];
  autoDownload: boolean;
  wifiOnly: boolean;
};

export type AccountInfo = {
  id: number;
  fullName: string;
  email: string;
  phone: string;
  department: string;
  graduationYear: string;
  institution: string;
  status: "alumni";
  verified: boolean;
  role: string;
  company: string;
  city: string;
  avatar: string;
  connectedAccounts: { linkedin: boolean; google: boolean };
};

export type UserSettings = {
  version: number;
  account: AccountInfo;
  appearance: AppearanceSettings;
  notifications: NotificationSettings;
  language: Language;
  privacy: PrivacySettings;
  security: SecuritySettings;
  community: CommunitySettings;
  storage: StorageSettings;
};
export type SettingsSection = Exclude<keyof UserSettings, "version">;

const daysAgo = (days: number, now = Date.now()) =>
  new Date(now - days * 24 * 60 * 60 * 1000).toISOString();
const hoursAgo = (hours: number, now = Date.now()) =>
  new Date(now - hours * 60 * 60 * 1000).toISOString();

/** Fictional sample member used until real authentication provides account data. */
export function createSampleAccount(): AccountInfo {
  return {
    id: 100,
    fullName: "Aarav Kumar",
    email: "aarav.kumar@example.com",
    phone: "+91 98765 43210",
    department: "Computer Science",
    graduationYear: "2020",
    institution: "Meenakshi Sundararajan Group of Institutions",
    status: "alumni",
    verified: true,
    role: "Senior Product Designer",
    company: "Freshworks",
    city: "Chennai",
    avatar:
      "https://images.unsplash.com/photo-1589386417686-0d34b5903d23?auto=format&fit=crop&w=300&q=85",
    connectedAccounts: { linkedin: true, google: false },
  };
}

export function createDefaultSettings(
  account: AccountInfo = createSampleAccount(),
  now = Date.now(),
): UserSettings {
  return {
    version: SETTINGS_VERSION,
    account,
    appearance: { theme: "system", textSize: "default", reduceMotion: false },
    notifications: {
      enabled: true,
      categories: {
        newMessages: true,
        messageRequests: true,
        connectionRequests: true,
        connectionAccepted: true,
        profileInteractions: false,
        upcomingEvents: true,
        eventReminders: true,
        jobOpportunities: true,
        internshipOpportunities: false,
        mentorshipRequests: true,
        institutionalAnnouncements: true,
        communityUpdates: false,
        importantAnnouncements: true,
      },
      push: true,
      email: true,
      quietHours: { enabled: false, start: "22:00", end: "07:00", days: [0, 1, 2, 3, 4, 5, 6] },
    },
    language: "en",
    privacy: {
      profileVisibility: "alumni",
      fields: {
        email: false,
        phone: false,
        graduationYear: true,
        department: true,
        workplace: true,
        designation: true,
        location: true,
        socialLinks: true,
      },
      messageRequests: "alumni",
      directContact: "connections",
      nonConnectionMessages: true,
      locationVisible: true,
      blocked: [
        { id: "blocked-1", name: "Rohan Varma", department: "Civil Engineering", year: "2017" },
        { id: "blocked-2", name: "Meera Iyer", department: "Business Administration", year: "2015" },
      ],
    },
    security: {
      twoFactor: false,
      twoFactorMethod: "app",
      recoveryEmail: "",
      recoveryPhone: account.phone,
      passwordChangedAt: daysAgo(96, now),
      suspiciousLoginAlerts: true,
      securityAlerts: true,
      sessions: [
        {
          id: "session-iphone",
          device: "iPhone 14",
          type: "phone",
          location: "Chennai, India",
          lastActive: hoursAgo(5, now),
        },
        {
          id: "session-windows",
          device: "Chrome on Windows",
          type: "laptop",
          location: "Bengaluru, India",
          lastActive: daysAgo(3, now),
        },
      ],
      loginActivity: [
        {
          id: "login-1",
          device: "iPhone 14",
          type: "phone",
          location: "Chennai, India",
          time: hoursAgo(5, now),
          status: "success",
        },
        {
          id: "login-2",
          device: "Chrome on Windows",
          type: "laptop",
          location: "Bengaluru, India",
          time: daysAgo(3, now),
          status: "success",
        },
        {
          id: "login-3",
          device: "Unknown Android device",
          type: "phone",
          location: "Outside India",
          time: daysAgo(12, now),
          status: "blocked",
        },
      ],
    },
    community: {
      networkingInterests: ["design", "software", "career"],
      industries: ["saas", "it"],
      careerPreferences: ["leadership"],
      opportunities: { jobs: true, internships: false, startups: true, research: false },
      mentorship: { mentoring: true, seekingMentor: false, networking: true, careerGuidance: true },
      mentorshipNote: "",
      communication: "inApp",
      shareOnProfile: false,
    },
    storage: {
      cacheBytes: 48.6 * 1024 * 1024,
      media: [
        {
          id: "media-1",
          name: "Leaders-Table-invite.pdf",
          kind: "document",
          bytes: 1.8 * 1024 * 1024,
          source: "Karthik Raj",
        },
        {
          id: "media-2",
          name: "Chennai-chapter-meetup.jpg",
          kind: "image",
          bytes: 3.4 * 1024 * 1024,
          source: "Priya Raman",
        },
        {
          id: "media-3",
          name: "Portfolio-review-notes.pdf",
          kind: "document",
          bytes: 0.9 * 1024 * 1024,
          source: "Anjali Krishnan",
        },
      ],
      autoDownload: true,
      wifiOnly: true,
    },
  };
}

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export const settingsStorageKey = (accountId: number) => `msgi-one.settings.v1.${accountId}`;

function browserStorage(): StorageLike | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

/** Keeps stored values only when they match the default's shape. */
function mergeWithDefaults<T>(defaults: T, stored: unknown): T {
  if (isPlainObject(defaults)) {
    if (!isPlainObject(stored)) return defaults;
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(defaults)) result[key] = mergeWithDefaults(value, stored[key]);
    return result as T;
  }
  if (Array.isArray(defaults)) return (Array.isArray(stored) ? stored : defaults) as T;
  return (typeof stored === typeof defaults ? stored : defaults) as T;
}

const oneOf = <T extends string>(options: readonly T[], value: string, fallback: T): T =>
  (options as readonly string[]).includes(value) ? (value as T) : fallback;

const pick = <T extends string>(options: readonly T[], values: readonly unknown[]): T[] =>
  options.filter((option) => values.includes(option));
const hasStrings = (value: unknown, keys: string[]) =>
  isPlainObject(value) && keys.every((key) => typeof value[key] === "string");

export function normalizeSettings(stored: unknown, account?: AccountInfo): UserSettings {
  const defaults = createDefaultSettings(account);
  const merged = mergeWithDefaults(defaults, stored);
  // The authenticated account owns identity and institution-verified fields.
  if (account) {
    merged.account = {
      ...merged.account,
      id: account.id,
      department: account.department,
      graduationYear: account.graduationYear,
      institution: account.institution,
      status: account.status,
      verified: account.verified,
    };
  }
  merged.version = SETTINGS_VERSION;
  merged.appearance.theme = oneOf(themeOptions, merged.appearance.theme, "system");
  merged.appearance.textSize = oneOf(textSizeOptions, merged.appearance.textSize, "default");
  merged.language = oneOf(languageOptions, merged.language, "en");
  merged.privacy.profileVisibility = oneOf(
    profileVisibilityOptions,
    merged.privacy.profileVisibility,
    "alumni",
  );
  merged.privacy.messageRequests = oneOf(audienceOptions, merged.privacy.messageRequests, "alumni");
  merged.privacy.directContact = oneOf(audienceOptions, merged.privacy.directContact, "connections");
  merged.security.twoFactorMethod = oneOf(twoFactorMethods, merged.security.twoFactorMethod, "app");
  merged.community.communication = oneOf(
    communicationOptions,
    merged.community.communication,
    "inApp",
  );
  merged.notifications.quietHours.days = weekdays.filter((day) =>
    merged.notifications.quietHours.days.includes(day),
  );
  const community = merged.community;
  community.networkingInterests = pick(networkingInterestOptions, community.networkingInterests);
  community.industries = pick(industryOptions, community.industries);
  community.careerPreferences = pick(careerOptions, community.careerPreferences);
  merged.privacy.blocked = merged.privacy.blocked.filter((user) =>
    hasStrings(user, ["id", "name", "department", "year"]),
  );
  merged.storage.media = merged.storage.media.filter(
    (item) => hasStrings(item, ["id", "name", "kind", "source"]) && Number.isFinite(item.bytes),
  );
  merged.storage.cacheBytes = Math.max(0, merged.storage.cacheBytes);
  merged.security.sessions = merged.security.sessions.filter(
    (session) =>
      hasStrings(session, ["id", "device", "type", "location", "lastActive"]) && !session.current,
  );
  merged.security.loginActivity = merged.security.loginActivity.filter((event) =>
    hasStrings(event, ["id", "device", "type", "location", "time", "status"]),
  );
  return merged;
}

export function loadSettings(
  account: AccountInfo,
  storage: StorageLike | null = browserStorage(),
): UserSettings {
  try {
    const raw = storage?.getItem(settingsStorageKey(account.id));
    return normalizeSettings(raw ? JSON.parse(raw) : undefined, account);
  } catch {
    return createDefaultSettings(account);
  }
}

export function saveSettings(
  settings: UserSettings,
  storage: StorageLike | null = browserStorage(),
): boolean {
  try {
    // The current-device session is derived at runtime, so it is not persisted.
    const persisted = {
      ...settings,
      security: {
        ...settings.security,
        sessions: settings.security.sessions.filter((session) => !session.current),
      },
    };
    storage?.setItem(settingsStorageKey(settings.account.id), JSON.stringify(persisted));
    return Boolean(storage);
  } catch {
    return false;
  }
}

export function clearStoredSettings(
  accountId: number,
  storage: StorageLike | null = browserStorage(),
) {
  try {
    storage?.removeItem(settingsStorageKey(accountId));
  } catch {
    // Storage may be unavailable in private browsing; nothing else to clear.
  }
}

export function resolveTheme(theme: ThemePreference, systemPrefersDark: boolean): ResolvedTheme {
  if (theme === "system") return systemPrefersDark ? "dark" : "light";
  return theme;
}

/* ---------- Do Not Disturb ---------- */

export function parseTime(value: string): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

export type QuietHoursError = "sameTime" | "noDays" | "invalidTime";
export function validateQuietHours(quiet: QuietHours): QuietHoursError | null {
  const start = parseTime(quiet.start);
  const end = parseTime(quiet.end);
  if (start === null || end === null) return "invalidTime";
  if (start === end) return "sameTime";
  if (!quiet.days.length) return "noDays";
  return null;
}

/** Days describe when a quiet period starts; overnight periods continue into the next day. */
export function isWithinQuietHours(quiet: QuietHours, date: Date): boolean {
  if (!quiet.enabled || validateQuietHours(quiet)) return false;
  const start = parseTime(quiet.start)!;
  const end = parseTime(quiet.end)!;
  const minutes = date.getHours() * 60 + date.getMinutes();
  const day = date.getDay() as Weekday;
  const previousDay = ((day + 6) % 7) as Weekday;
  if (start < end) return quiet.days.includes(day) && minutes >= start && minutes < end;
  if (minutes >= start) return quiet.days.includes(day);
  if (minutes < end) return quiet.days.includes(previousDay);
  return false;
}

/**
 * Returns the next start (when inactive) or the current end (when active).
 * State can only change at a start or end time, so only those boundaries are checked.
 */
export function nextQuietHoursChange(quiet: QuietHours, date: Date): Date | null {
  if (!quiet.enabled || validateQuietHours(quiet)) return null;
  const active = isWithinQuietHours(quiet, date);
  const boundaries = [parseTime(quiet.start)!, parseTime(quiet.end)!];
  for (let offset = 0; offset <= 8; offset++) {
    const candidates = boundaries
      .map((minutes) => {
        const candidate = new Date(date);
        candidate.setDate(date.getDate() + offset);
        candidate.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
        return candidate;
      })
      .filter((candidate) => candidate > date)
      .sort((a, b) => a.getTime() - b.getTime());
    for (const candidate of candidates)
      if (isWithinQuietHours(quiet, candidate) !== active) return candidate;
  }
  return null;
}

export type NotificationDecision =
  | { deliver: true; channels: ("push" | "email" | "inApp")[] }
  | { deliver: false; reason: "paused" | "categoryOff" | "quietHours"; until?: Date | null };

/** Single source of truth for whether a notification should alert the member right now. */
export function getNotificationDecision(
  settings: NotificationSettings,
  category: NotificationCategory,
  date: Date,
): NotificationDecision {
  if (!settings.enabled) return { deliver: false, reason: "paused" };
  if (!settings.categories[category]) return { deliver: false, reason: "categoryOff" };
  if (isWithinQuietHours(settings.quietHours, date))
    return {
      deliver: false,
      reason: "quietHours",
      until: nextQuietHoursChange(settings.quietHours, date),
    };
  const channels: ("push" | "email" | "inApp")[] = ["inApp"];
  if (settings.push) channels.unshift("push");
  if (settings.email) channels.push("email");
  return { deliver: true, channels };
}

/* ---------- Validation ---------- */

export type ValidationError =
  | "required"
  | "nameFormat"
  | "email"
  | "emailSame"
  | "phone"
  | "phoneSame"
  | "subjectLength"
  | "descriptionShort"
  | "descriptionLong"
  | "noteLong"
  | "attachmentType"
  | "attachmentSize";

export function validateFullName(value: string): ValidationError | null {
  const name = value.trim().replace(/\s+/g, " ");
  if (!name) return "required";
  if (name.length < 2 || name.length > 60 || !/^[\p{L}\p{M}][\p{L}\p{M} .'-]*$/u.test(name))
    return "nameFormat";
  return null;
}

export function validateEmail(value: string, current?: string): ValidationError | null {
  const email = value.trim();
  if (!email) return "required";
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return "email";
  if (current && email.toLowerCase() === current.toLowerCase()) return "emailSame";
  return null;
}

export const normalizePhone = (value: string) => value.replace(/[\s()-]/g, "");
export function validatePhone(value: string, current?: string): ValidationError | null {
  const phone = normalizePhone(value.trim());
  if (!phone) return "required";
  if (!/^\+?\d{10,15}$/.test(phone)) return "phone";
  if (current && phone === normalizePhone(current)) return "phoneSame";
  return null;
}

export type PasswordRule = "length" | "mix" | "different" | "match";
export function checkPassword(current: string, next: string, confirm: string) {
  const rules: Record<PasswordRule, boolean> = {
    length: next.length >= 8,
    mix: /\p{L}/u.test(next) && /\d/.test(next),
    different: Boolean(next) && next !== current,
    match: Boolean(next) && next === confirm,
  };
  return { rules, valid: Boolean(current) && Object.values(rules).every(Boolean) };
}

export const ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024;
export const attachmentTypes = ["image/png", "image/jpeg", "application/pdf"];
export function validateAttachment(file: { type: string; size: number }): ValidationError | null {
  if (!attachmentTypes.includes(file.type)) return "attachmentType";
  if (file.size > ATTACHMENT_MAX_BYTES) return "attachmentSize";
  return null;
}

export const supportCategories = [
  "account",
  "profile",
  "directory",
  "messaging",
  "events",
  "other",
] as const;
export type SupportRequest = {
  subject: string;
  category: string;
  description: string;
  attachment?: { type: string; size: number } | null;
};
export function validateSupportRequest(request: SupportRequest) {
  const errors: Partial<Record<keyof SupportRequest, ValidationError>> = {};
  const subject = request.subject.trim();
  if (!subject) errors.subject = "required";
  else if (subject.length < 5 || subject.length > 100) errors.subject = "subjectLength";
  if (!(supportCategories as readonly string[]).includes(request.category))
    errors.category = "required";
  const description = request.description.trim();
  if (!description) errors.description = "required";
  else if (description.length < 20) errors.description = "descriptionShort";
  else if (description.length > 1000) errors.description = "descriptionLong";
  const attachmentError = request.attachment ? validateAttachment(request.attachment) : null;
  if (attachmentError) errors.attachment = attachmentError;
  return errors;
}

export function validateMentorshipNote(note: string): ValidationError | null {
  return note.trim().length > MENTORSHIP_NOTE_MAX ? "noteLong" : null;
}

/* ---------- Profile sharing ---------- */

export function profileShareSlug(account: Pick<AccountInfo, "id" | "fullName">) {
  const name = account.fullName
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return name ? `${name}-${account.id}` : String(account.id);
}

/** Unique destination per member: the numeric ID is authoritative, the name is readable. */
export function buildProfileShareUrl(account: Pick<AccountInfo, "id" | "fullName">, base: string) {
  const url = new URL(base);
  url.search = "";
  url.hash = "";
  url.searchParams.set("alumni", profileShareSlug(account));
  return url.toString();
}

export function parseSharedProfileId(search: string): number | null {
  const value = new URLSearchParams(search).get("alumni");
  const match = value ? /(?:^|-)(\d{1,9})$/.exec(value.trim()) : null;
  return match ? Number(match[1]) : null;
}

/* ---------- Requests, devices and formatting ---------- */

export class NetworkError extends Error {
  constructor() {
    super("offline");
    this.name = "NetworkError";
  }
}

/**
 * Stands in for a server call. It fails when the browser is offline so failure
 * states are real, but nothing leaves the device.
 */
export function simulateRequest<T>(
  result: T,
  { delay = 650, isOnline = () => typeof navigator === "undefined" || navigator.onLine } = {},
): Promise<T> {
  return new Promise((resolve, reject) => {
    setTimeout(() => (isOnline() ? resolve(result) : reject(new NetworkError())), delay);
  });
}

export function describeDevice(userAgent: string): { device: string; type: DeviceType } {
  const browser = /Edg\//.test(userAgent)
    ? "Edge"
    : /Firefox\//.test(userAgent)
      ? "Firefox"
      : /Chrome\/|CriOS\//.test(userAgent)
        ? "Chrome"
        : /Safari\//.test(userAgent)
          ? "Safari"
          : "Browser";
  if (/iPhone/.test(userAgent)) return { device: `${browser} on iPhone`, type: "phone" };
  if (/iPad/.test(userAgent)) return { device: `${browser} on iPad`, type: "tablet" };
  if (/Android/.test(userAgent))
    return { device: `${browser} on Android`, type: /Mobile/.test(userAgent) ? "phone" : "tablet" };
  const os = /Mac OS X|Macintosh/.test(userAgent)
    ? "macOS"
    : /Windows/.test(userAgent)
      ? "Windows"
      : /CrOS/.test(userAgent)
        ? "ChromeOS"
        : /Linux/.test(userAgent)
          ? "Linux"
          : "this computer";
  return { device: `${browser} on ${os}`, type: "laptop" };
}

/** Approximate region from the time zone only; no geolocation permission is requested. */
export function approximateRegion(timeZone: string) {
  const city = timeZone.split("/").pop()?.replace(/_/g, " ");
  return city === "Calcutta" ? "Kolkata" : city || "";
}

export function createCurrentSession(now = new Date()): Session {
  const ua = typeof navigator === "undefined" ? "" : navigator.userAgent;
  const { device, type } = describeDevice(ua);
  let region = "";
  try {
    region = approximateRegion(Intl.DateTimeFormat().resolvedOptions().timeZone);
  } catch {
    region = "";
  }
  return {
    id: "session-current",
    device,
    type,
    location: region,
    lastActive: now.toISOString(),
    current: true,
  };
}

export function formatBytes(bytes: number, locale = "en") {
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value)} ${units[unit]}`;
}

export function formatRelative(iso: string, locale: string, now = Date.now()) {
  const diff = new Date(iso).getTime() - now;
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const minutes = Math.round(diff / 60000);
  if (Math.abs(minutes) < 60) return formatter.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return formatter.format(hours, "hour");
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 30) return formatter.format(days, "day");
  return formatter.format(Math.round(days / 30), "month");
}

export function formatClock(value: string, locale: string) {
  const minutes = parseTime(value);
  if (minutes === null) return value;
  const date = new Date(2025, 0, 6, Math.floor(minutes / 60), minutes % 60);
  return new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" }).format(date);
}

export function createReference(prefix: string) {
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}-${random}`;
}
