import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button, InlineMessage, SelectField, TextField } from "../settings/ui";
import { IconAction, PageHeading, RecoveryShell, useInvalidFocus } from "../network/ui";
import { useServiceAction } from "../network/useServiceAction";
import { requireService } from "../network/services";
import { validateEmail } from "../settings/model";
import { Icon } from "../ui/chrome";
import googleLogo from "./google.svg";
import { AccessCodeVerification } from "./AccessCodeVerification";
import {
  AuthFlowError,
  detailErrors,
  institutions,
  registrationErrors,
  validateSession,
  type MembershipAuthService,
  type MembershipDetails,
  type MembershipSession,
  type Registration,
} from "./model";
import "./auth.css";

const disconnected =
  "Authentication is not connected. Email/password registration, Google sign-in and membership access-code verification require a configured backend. No account has been created or verified.";
const blank: Registration = {
  fullName: "",
  birthYear: "",
  graduationYear: "",
  institution: "",
  email: "",
  password: "",
};
type Verified = Extract<MembershipSession, { status: "verified" }>;
type Pending = Extract<MembershipSession, { status: "pending" }>;

function GoogleButton({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {
  return (
    <Button
      variant="secondary"
      className="google-auth-button"
      onClick={onClick}
      disabled={disabled}
    >
      <img src={googleLogo} alt="" className="membership-google-logo" /> Continue with Google
    </Button>
  );
}

export function AuthFlow({
  service,
  onVerified,
  onPreview,
  onForgotPassword,
  onSupport,
  notice,
  initialView = "register",
}: {
  service?: MembershipAuthService;
  onVerified: (session: Verified) => void;
  onPreview?: () => void;
  onForgotPassword: () => void;
  onSupport: () => void;
  notice?: string | null;
  initialView?: "register" | "login";
}) {
  const [view, setView] = useState<"register" | "login">(initialView);
  const [form, setForm] = useState<Registration>(blank);
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState<Pending | null>(null);
  const [verifiedView, setVerifiedView] = useState(false);
  const [checking, setChecking] = useState(Boolean(service));
  const [restoreError, setRestoreError] = useState("");
  const [restoreRetry, setRestoreRetry] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [visible, setVisible] = useState({ password: false, confirm: false });
  const action = useServiceAction();
  const ref = useInvalidFocus(attempt);
  const complete = useRef(onVerified);
  complete.current = onVerified;
  const currentYear = new Date().getFullYear();
  const years = (start: number) =>
    Array.from({ length: currentYear - start + 1 }, (_, index) => String(currentYear - index));
  const missing = pending ? detailErrors(pending.details) : null;
  const detailsMode = Boolean(pending && missing && Object.keys(missing).length);
  const errors = detailsMode ? detailErrors(form) : registrationErrors(form, confirm);
  const show = (key: keyof typeof errors) => (attempt ? errors[key] : undefined);
  function set<K extends keyof Registration>(key: K, value: Registration[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }
  function accept(value: MembershipSession) {
    const session = validateSession(value);
    setForm({ ...blank });
    setConfirm("");
    setAttempt(0);
    if (session.status === "verified") {
      complete.current(session);
      return;
    }
    setPending(session);
    setForm({ ...blank, ...session.details, email: session.email });
    setVerifiedView(Object.keys(detailErrors(session.details)).length === 0);
  }
  useEffect(() => {
    if (!service) {
      setChecking(false);
      return;
    }
    const controller = new AbortController();
    setChecking(true);
    setRestoreError("");
    void (async () => {
      try {
        const session = await service.getSession(controller.signal);
        if (!controller.signal.aborted && session) accept(session);
      } catch {
        if (!controller.signal.aborted)
          setRestoreError("Your session could not be checked. Please try again before continuing.");
      } finally {
        if (!controller.signal.aborted) setChecking(false);
      }
    })();
    return () => controller.abort();
  }, [service, restoreRetry]);

  function switchView(next: "register" | "login") {
    setView(next);
    setPending(null);
    setVerifiedView(false);
    setForm({ ...blank });
    setConfirm("");
    setAttempt(0);
    action.setError("");
  }
  function google() {
    if (action.busy || checking || restoreError) return;
    if (!service && onPreview) {
      setVerifiedView(true);
      return;
    }
    void action.run(async (signal) => {
      const auth = requireService(service, disconnected);
      return auth.signInGoogle(signal);
    }, accept);
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    if (action.busy || checking || restoreError) return;
    if (!service && onPreview) {
      if (view === "register") setVerifiedView(true);
      else onPreview();
      return;
    }
    setAttempt((value) => value + 1);
    action.setError("");
    if (detailsMode || view === "register") {
      if (Object.keys(errors).length) return;
    } else if (validateEmail(form.email) || !form.password) return;
    void action.run(async (signal) => {
      const auth = requireService(service, disconnected);
      if (detailsMode) {
        const { fullName, birthYear, graduationYear, institution } = form;
        const result = validateSession(
          await auth.completeProfile(
            { fullName: fullName.trim(), birthYear, graduationYear, institution },
            signal,
          ),
        );
        if (result.status !== "pending") throw new AuthFlowError("registration-failed");
        return result;
      }
      if (view === "login")
        return auth.signIn({ email: form.email.trim(), password: form.password }, signal);
      const result = validateSession(
        await auth.register(
          { ...form, fullName: form.fullName.trim(), email: form.email.trim() },
          signal,
        ),
      );
      if (result.status !== "pending") throw new AuthFlowError("registration-failed");
      return result;
    }, accept);
  }
  if (verifiedView && ((pending && service) || (!service && onPreview)))
    return (
      <AccessCodeVerification
        service={service}
        onVerified={onVerified}
        onPreview={!service ? onPreview : undefined}
        backLabel={!service && view === "register" ? "Back to Create Profile" : "Back to Login"}
        onBack={() => {
          if (!service) setVerifiedView(false);
          else switchView("login");
        }}
      />
    );
  const register = detailsMode || view === "register";
  const visibleDetail = (key: keyof MembershipDetails) =>
    register && (!detailsMode || Boolean(missing?.[key]));
  const disabled = action.busy || checking || Boolean(restoreError);
  return (
    <RecoveryShell compactTagline grainBackground>
      <h1 className="membership-welcome">
        {register ? "Welcome to " : "Welcome back to "}
        <span className="membership-brand-name">MSGI ONE</span>
      </h1>
      <form
        className="auth-card network-form membership-auth"
        noValidate
        onSubmit={submit}
        ref={ref}
      >
        <PageHeading
          eyebrow={register ? "JOIN THE NETWORK" : "MEMBER ACCESS"}
          title={
            detailsMode ? (
              "Complete Your Profile"
            ) : register ? (
              "Create Profile"
            ) : (
              <>
                Log in to <span className="membership-brand-name">MSGI ONE</span>
              </>
            )
          }
          description={
            register
              ? "Join the MSGI alumni network and connect with your community."
              : "Log in to reconnect with your alumni community."
          }
        />
        {notice && <InlineMessage>{notice}</InlineMessage>}
        {!service && !onPreview && <InlineMessage>{disconnected}</InlineMessage>}
        {checking && <InlineMessage>Checking your authentication session…</InlineMessage>}
        {restoreError && (
          <InlineMessage
            tone="error"
            action={
              <Button variant="ghost" onClick={() => setRestoreRetry((value) => value + 1)}>
                Try again
              </Button>
            }
          >
            {restoreError}
          </InlineMessage>
        )}
        {detailsMode && (
          <InlineMessage>
            Authenticated as {pending?.email}. Complete only the missing membership details below.
            Google authentication alone does not verify MSGI membership.
          </InlineMessage>
        )}
        {visibleDetail("fullName") && (
          <TextField
            id="membership-name"
            label="Full Name"
            placeholder="Enter your name, which is the same as your college record."
            autoComplete="name"
            value={form.fullName}
            required
            disabled={disabled}
            onChange={(event) => set("fullName", event.target.value)}
            error={show("fullName")}
          />
        )}
        {visibleDetail("birthYear") && (
          <SelectField
            id="membership-birth-year"
            label="Birth Year"
            value={form.birthYear}
            required
            disabled={disabled}
            error={show("birthYear")}
            onChange={(event) => set("birthYear", event.target.value)}
          >
            <option value="" disabled>
              Choose Birth Year
            </option>
            {years(1900).map((year) => (
              <option key={year}>{year}</option>
            ))}
          </SelectField>
        )}
        {visibleDetail("graduationYear") && (
          <SelectField
            id="membership-graduation-year"
            label="Graduation Year / Batch"
            value={form.graduationYear}
            required
            disabled={disabled}
            error={show("graduationYear")}
            onChange={(event) => set("graduationYear", event.target.value)}
          >
            <option value="" disabled>
              Choose Graduation Year / Batch
            </option>
            {years(2000).map((year) => (
              <option key={year}>{year}</option>
            ))}
          </SelectField>
        )}
        {visibleDetail("institution") && (
          <SelectField
            id="membership-institution"
            label="Institution"
            value={form.institution}
            required
            disabled={disabled}
            error={show("institution")}
            onChange={(event) => set("institution", event.target.value)}
          >
            <option value="" disabled>
              Choose Institution
            </option>
            {institutions.map((institution) => (
              <option key={institution}>{institution}</option>
            ))}
          </SelectField>
        )}
        {!detailsMode && (
          <>
            <TextField
              id="membership-email"
              label={register ? "Email Address" : "Registered Email Address"}
              icon="mail"
              type="email"
              autoComplete="email"
              value={form.email}
              required
              disabled={disabled}
              placeholder="Enter your email address"
              onChange={(event) => set("email", event.target.value)}
              error={
                attempt
                  ? validateEmail(form.email)
                    ? "Enter a valid email address."
                    : undefined
                  : undefined
              }
            />
            <TextField
              id="membership-password"
              label="Password"
              icon="lock"
              type={visible.password ? "text" : "password"}
              value={form.password}
              required
              disabled={disabled}
              placeholder="Enter your password"
              autoComplete={register ? "new-password" : "current-password"}
              onChange={(event) => set("password", event.target.value)}
              error={
                attempt
                  ? register
                    ? registrationErrors(form, confirm).password
                    : !form.password
                      ? "Enter your password."
                      : undefined
                  : undefined
              }
              trailing={
                <IconAction
                  icon={visible.password ? "eyeOff" : "eye"}
                  label={visible.password ? "Hide password" : "Show password"}
                  pressed={visible.password}
                  onClick={() => setVisible((value) => ({ ...value, password: !value.password }))}
                />
              }
            />
            {register && (
              <TextField
                id="membership-confirm"
                label="Confirm Password"
                icon="lock"
                type={visible.confirm ? "text" : "password"}
                value={confirm}
                required
                disabled={disabled}
                placeholder="Confirm your password"
                autoComplete="new-password"
                hint="Use 8–128 characters including a letter and a number."
                onChange={(event) => setConfirm(event.target.value)}
                error={attempt ? registrationErrors(form, confirm).confirm : undefined}
                trailing={
                  <IconAction
                    icon={visible.confirm ? "eyeOff" : "eye"}
                    label={
                      visible.confirm ? "Hide confirmation password" : "Show confirmation password"
                    }
                    pressed={visible.confirm}
                    onClick={() => setVisible((value) => ({ ...value, confirm: !value.confirm }))}
                  />
                }
              />
            )}
          </>
        )}
        {!register && (
          <Button
            variant="ghost"
            className="forgot membership-text-link membership-login-light-ink"
            style={{ color: "rgba(216, 188, 131, 0.8)" }}
            disabled={disabled}
            onClick={onForgotPassword}
          >
            Forgot Password?
          </Button>
        )}
        {action.error && <InlineMessage tone="error">{action.error}</InlineMessage>}
        <Button
          type="submit"
          className="set-button--block"
          busy={action.busy}
          disabled={checking || Boolean(restoreError)}
          aria-label={action.busy ? "Processing authentication" : undefined}
        >
          {register ? "Continue" : "Login"} <Icon name="arrow" size={17} />
        </Button>
        {!detailsMode && <GoogleButton onClick={google} disabled={disabled} />}
        <div className="auth-switch">
          <span>{register ? "Already have an account?" : "Don't have an account?"}</span>
          <Button
            variant="ghost"
            className="membership-text-link membership-login-light-ink"
            style={!register ? { color: "rgba(216, 188, 131, 0.8)" } : undefined}
            disabled={disabled}
            onClick={() => switchView(register ? "login" : "register")}
          >
            {register ? "Login" : "Create Profile"}
          </Button>
        </div>
      </form>
      <div className="auth-support membership-support">
        Need Help?{" "}
        <Button
          variant="ghost"
          className="membership-text-link"
          onClick={onSupport}
          disabled={disabled}
        >
          Contact Alumni Support
        </Button>
      </div>
    </RecoveryShell>
  );
}
