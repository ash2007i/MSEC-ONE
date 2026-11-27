/**
 * Integration boundary only. No default adapter, requests, demo receipts, or credentials.
 * A production adapter must bind all operations to the authenticated member on the server.
 */
export type AuthService = {
  requestPasswordReset: (
    email: string,
    options: { redirectUrl: string; signal: AbortSignal },
  ) => Promise<{ accepted: true }>;
  validateResetToken: (
    token: string,
    signal: AbortSignal,
  ) => Promise<"valid" | "invalid" | "expired">;
  resetPassword: (
    input: { token: string; password: string },
    signal: AbortSignal,
  ) => Promise<{ updated: true }>;
};

export const issueCategories = [
  "Account and Login",
  "Profile Issues",
  "Alumni Directory",
  "Community Feed",
  "Messaging and Inbox",
  "Notifications",
  "Technical Issues",
  "Other",
] as const;

export type SupportInput = {
  fullName: string;
  email: string;
  category: string;
  subject: string;
  description: string;
  attachment: File | null;
};

export type SupportReceipt = { saved: true; reference: string };
export type SupportService = {
  submit: (input: SupportInput, signal: AbortSignal) => Promise<SupportReceipt>;
};

export const notificationCategories = [
  "All",
  "Connections",
  "Messages",
  "Feed",
  "Opportunities",
  "Events",
] as const;
export type NotificationCategory = (typeof notificationCategories)[number];
export type NotificationKind =
  | "connection-request"
  | "connection-accepted"
  | "post-liked"
  | "post-commented"
  | "post-mentioned"
  | "message"
  | "opportunity"
  | "event";
export type NotificationTarget =
  | { type: "profile"; id: number }
  | { type: "message"; id: number }
  | { type: "feed"; id: string }
  | { type: "opportunity"; id: string }
  | { type: "event"; id: string };
export type NetworkNotification = {
  id: string;
  kind: NotificationKind;
  actor: { name: string; image?: string };
  createdAt: string;
  read: boolean;
  subject?: string;
  target?: NotificationTarget;
};
export type NotificationService = {
  list: (signal: AbortSignal) => Promise<NetworkNotification[]>;
  markRead: (ids: string[], signal: AbortSignal) => Promise<{ saved: true }>;
  dismiss: (id: string, signal: AbortSignal) => Promise<{ saved: true }>;
};
export type AppServices = {
  membershipAuth?: import("../auth/model").MembershipAuthService;
  auth?: AuthService;
  support?: SupportService;
  notifications?: NotificationService;
};

export class ServiceUnavailableError extends Error {}

export function requireService<T>(service: T | undefined, message: string): T {
  if (!service) throw new ServiceUnavailableError(message);
  return service;
}

export function requireAcknowledgement(confirmed: unknown) {
  if (confirmed !== true) {
    throw new Error("The service did not confirm this action. Please try again.");
  }
}

export function requireSupportReceipt(receipt: SupportReceipt) {
  requireAcknowledgement(receipt?.saved);
  if (typeof receipt.reference !== "string" || !receipt.reference.trim()) {
    throw new Error("The service did not return a support reference. Please try again.");
  }
  return receipt.reference.trim();
}
