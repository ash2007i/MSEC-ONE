import { validateAttachment, validateEmail, validateFullName } from "../settings/model.ts";
import {
  issueCategories,
  type NetworkNotification,
  type NotificationCategory,
  type NotificationKind,
  type SupportInput,
} from "./services.ts";

export function emailError(email: string) {
  return validateEmail(email)
    ? email.trim()
      ? "Enter a valid email address."
      : "Enter your registered email address."
    : undefined;
}

export function passwordRules(password: string, confirm: string) {
  return {
    length: password.length >= 8 && password.length <= 128,
    mix: /\p{L}/u.test(password) && /\d/.test(password),
    match: Boolean(confirm) && password === confirm,
  };
}

export function resetErrors(password: string, confirm: string) {
  const rules = passwordRules(password, confirm);
  return {
    password: !password
      ? "Enter a new password."
      : !rules.length
        ? "Use between 8 and 128 characters."
        : !rules.mix
          ? "Include at least one letter and one number."
          : undefined,
    confirm: !confirm
      ? "Confirm your new password."
      : !rules.match
        ? "Your passwords do not match."
        : undefined,
  };
}

export function supportErrors(input: SupportInput) {
  const errors: Partial<Record<keyof SupportInput, string>> = {};
  if (validateFullName(input.fullName)) errors.fullName = "Enter your full name (2–60 characters).";
  if (emailError(input.email)) errors.email = emailError(input.email);
  if (!(issueCategories as readonly string[]).includes(input.category))
    errors.category = "Choose an issue category.";
  const subject = input.subject.trim();
  if (subject.length < 5 || subject.length > 120)
    errors.subject = "Enter a subject between 5 and 120 characters.";
  const description = input.description.trim();
  if (description.length < 20 || description.length > 5000)
    errors.description = "Describe your problem in 20–5,000 characters.";
  if (input.attachment) {
    const problem = validateAttachment(input.attachment);
    if (problem)
      errors.attachment =
        problem === "attachmentType"
          ? "Attach a PNG, JPG or PDF file."
          : "Choose a file no larger than 5 MB.";
  }
  return errors;
}

/** Tokens stay in the URL fragment, never in localStorage or a notification record. */
export function parseResetLink(hash: string): { requested: boolean; token: string | null } {
  const [route, query = ""] = hash.split("?");
  const requested = route === "#/reset-password";
  const token = requested ? new URLSearchParams(query).get("token") : null;
  return { requested, token: token?.trim() || null };
}

export const notificationPresentation: Record<
  NotificationKind,
  { category: NotificationCategory; icon: string; description: string; action: string }
> = {
  "connection-request": {
    category: "Connections",
    icon: "users",
    description: "sent you a connection request.",
    action: "View profile",
  },
  "connection-accepted": {
    category: "Connections",
    icon: "check",
    description: "accepted your connection request.",
    action: "View profile",
  },
  "post-liked": {
    category: "Feed",
    icon: "heart",
    description: "liked your post.",
    action: "View post",
  },
  "post-commented": {
    category: "Feed",
    icon: "chat",
    description: "commented on your post.",
    action: "View post",
  },
  "post-mentioned": {
    category: "Feed",
    icon: "user",
    description: "mentioned you in a post.",
    action: "View post",
  },
  message: {
    category: "Messages",
    icon: "message",
    description: "sent you a new message.",
    action: "Open message",
  },
  opportunity: {
    category: "Opportunities",
    icon: "briefcase",
    description: "posted a new opportunity.",
    action: "View opportunity",
  },
  event: {
    category: "Events",
    icon: "calendar",
    description: "announced an upcoming event.",
    action: "View event",
  },
};

export function filterNotifications(items: NetworkNotification[], category: NotificationCategory) {
  return items.filter(
    (item) => category === "All" || notificationPresentation[item.kind].category === category,
  );
}

export function markNotificationsRead(items: NetworkNotification[], ids: readonly string[]) {
  const selected = new Set(ids);
  return items.map((item) => (selected.has(item.id) ? { ...item, read: true } : item));
}

/** Reject malformed responses rather than rendering misleading activity or destinations. */
export function validateNotifications(value: NetworkNotification[]) {
  if (!Array.isArray(value)) throw new Error("Invalid notification response.");
  const ids = new Set<string>();
  for (const item of value) {
    if (
      !item ||
      typeof item.id !== "string" ||
      !item.id ||
      ids.has(item.id) ||
      !Object.prototype.hasOwnProperty.call(notificationPresentation, item.kind) ||
      typeof item.actor?.name !== "string" ||
      !item.actor.name.trim() ||
      typeof item.read !== "boolean" ||
      !Number.isFinite(Date.parse(item.createdAt))
    )
      throw new Error("Invalid notification response.");
    if (item.target) {
      const { type, id } = item.target;
      if (
        !["profile", "message", "feed", "opportunity", "event"].includes(type) ||
        (type === "profile" || type === "message"
          ? !Number.isSafeInteger(id) || Number(id) <= 0
          : typeof id !== "string" || !id.trim())
      )
        throw new Error("Invalid notification destination.");
    }
    ids.add(item.id);
  }
  return value;
}
