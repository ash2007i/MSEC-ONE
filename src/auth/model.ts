import type { AccountInfo } from "../settings/model.ts";
import { validateEmail, validateFullName } from "../settings/model.ts";
import { ServiceUnavailableError } from "../network/services.ts";

export const institutions = [
  "Meenakshi Sundararajan Engineering College",
  "Meenakshi Sundararajan School of Management",
  "Meenakshi College for Women",
] as const;
export type MembershipDetails = {
  fullName: string;
  birthYear: string;
  graduationYear: string;
  institution: string;
};
export type Registration = MembershipDetails & { email: string; password: string };
export type MembershipSession =
  | { status: "pending"; details: Partial<MembershipDetails>; email: string }
  | { status: "verified"; account: AccountInfo };

/** All operations use the provider's current server-side session, never a browser-supplied user ID. */
export type MembershipAuthService = {
  getSession: (signal: AbortSignal) => Promise<MembershipSession | null>;
  register: (input: Registration, signal: AbortSignal) => Promise<MembershipSession>;
  signIn: (
    input: { email: string; password: string },
    signal: AbortSignal,
  ) => Promise<MembershipSession>;
  signInGoogle: (signal: AbortSignal) => Promise<MembershipSession>;
  completeProfile: (details: MembershipDetails, signal: AbortSignal) => Promise<MembershipSession>;
  verifyAccessCode: (code: string, signal: AbortSignal) => Promise<MembershipSession>;
  signOut: (signal: AbortSignal) => Promise<void>;
};
export const authErrors = {
  "email-registered": "This email is already registered. Please log in or reset your password.",
  "invalid-credentials": "The email or password is incorrect. Please try again.",
  "google-cancelled": "Google sign-in was cancelled. You can try again or use email and password.",
  "google-failed": "Google sign-in could not be completed. Please try again.",
  "account-exists":
    "An account already uses this email. Sign in using its existing method to securely link Google.",
  "invalid-code": "This access code is invalid. Please check it and try again.",
  "used-code": "This access code has already been used.",
  "expired-code": "This access code has expired.",
  "revoked-code": "This access code has been revoked.",
  "institution-mismatch": "The access code does not match your selected institution.",
  "membership-mismatch":
    "Your details do not match the membership record. Check your college-record details.",
  "registration-failed": "Registration could not be completed. Please try again.",
  "verification-failed": "Membership verification could not be completed. Please try again.",
  network: "You’re offline or the service is unreachable. Check your connection and try again.",
  server: "The authentication service could not complete this request. Please try again.",
} as const;
/** Adapters map provider errors to these safe codes; never expose raw provider responses. */
export class AuthFlowError extends ServiceUnavailableError {
  readonly code: keyof typeof authErrors;
  constructor(code: keyof typeof authErrors) {
    super(authErrors[code]);
    this.code = code;
  }
}
export function detailErrors(
  details: Partial<MembershipDetails>,
  currentYear = new Date().getFullYear(),
) {
  const errors: Partial<Record<keyof MembershipDetails, string>> = {};
  if (validateFullName(details.fullName ?? ""))
    errors.fullName = "Enter your full name as shown in your college record.";
  const birth = Number(details.birthYear);
  const graduation = Number(details.graduationYear);
  if (!details.birthYear || !Number.isInteger(birth) || birth < 1900 || birth > currentYear)
    errors.birthYear = "Choose a valid birth year.";
  if (
    !details.graduationYear ||
    !Number.isInteger(graduation) ||
    graduation < 2000 ||
    graduation > currentYear
  )
    errors.graduationYear = "Choose a valid graduation year.";
  if (birth && graduation && birth >= graduation)
    errors.birthYear = "Birth year must be before graduation year.";
  if (!(institutions as readonly string[]).includes(details.institution ?? ""))
    errors.institution = "Choose your institution.";
  return errors;
}
export function registrationErrors(input: Registration, confirm: string) {
  const errors: Partial<Record<keyof Registration | "confirm", string>> = detailErrors(input);
  if (validateEmail(input.email)) errors.email = "Enter a valid email address.";
  if (
    input.password.length < 8 ||
    input.password.length > 128 ||
    !/\p{L}/u.test(input.password) ||
    !/\d/.test(input.password)
  )
    errors.password = "Use 8–128 characters including a letter and a number.";
  if (!confirm || confirm !== input.password) errors.confirm = "Your passwords must match.";
  return errors;
}
export function validateSession(value: MembershipSession): MembershipSession {
  if (
    value?.status === "pending" &&
    value.details &&
    typeof value.email === "string" &&
    !validateEmail(value.email)
  )
    return value;
  if (
    value?.status === "verified" &&
    value.account?.verified === true &&
    Number.isSafeInteger(value.account.id) &&
    value.account.id > 0 &&
    typeof value.account.fullName === "string" &&
    !validateEmail(value.account.email)
  )
    return value;
  throw new AuthFlowError("server");
}
export function requireVerified(value: MembershipSession) {
  const session = validateSession(value);
  if (session.status !== "verified") throw new AuthFlowError("verification-failed");
  return session;
}
