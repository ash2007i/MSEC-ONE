import { useEffect, useState, type FormEvent } from "react";
import { Icon } from "../ui/chrome";
import { Button, InlineMessage, SuccessPanel, TextField } from "../settings/ui";
import { requireAcknowledgement, requireService, type AuthService } from "./services";
import { emailError, passwordRules, resetErrors } from "./model";
import { IconAction, PageHeading, RecoveryShell, useInvalidFocus } from "./ui";
import { useServiceAction } from "./useServiceAction";

const disconnected =
  "Password recovery is not connected yet. No reset email has been sent and no password has been changed.";

export function ForgotPassword({
  service,
  resetRequested = false,
  token = null,
  onLogin,
}: {
  service?: AuthService;
  resetRequested?: boolean;
  token?: string | null;
  onLogin: () => void;
}) {
  const [step, setStep] = useState<"request" | "reset" | "updated">(
    resetRequested ? "reset" : "request",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [visible, setVisible] = useState({ password: false, confirm: false });
  const [attempt, setAttempt] = useState(0);
  const [accepted, setAccepted] = useState(false);
  const [verification, setVerification] = useState<
    "checking" | "valid" | "invalid" | "expired" | "unavailable"
  >("checking");
  const [retry, setRetry] = useState(0);
  const action = useServiceAction();
  const formRef = useInvalidFocus(attempt);
  const errors = resetErrors(password, confirm);
  const rules = passwordRules(password, confirm);

  useEffect(() => {
    if (step !== "reset") return;
    if (!token) {
      setVerification("invalid");
      return;
    }
    if (!service) {
      setVerification("unavailable");
      return;
    }
    const controller = new AbortController();
    setVerification("checking");
    service.validateResetToken(token, controller.signal).then(
      (status) => {
        if (!controller.signal.aborted)
          setVerification(
            ["valid", "invalid", "expired"].includes(status) ? status : "unavailable",
          );
      },
      () => {
        if (!controller.signal.aborted) setVerification("unavailable");
      },
    );
    return () => controller.abort();
  }, [step, token, service, retry]);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (action.busy) return;
    setAttempt((value) => value + 1);
    action.setError("");
    if (step === "request") {
      if (emailError(email) || accepted) return;
      void action.run(
        async (signal) => {
          const auth = requireService(service, disconnected);
          const redirectUrl = new URL(window.location.href);
          redirectUrl.search = "";
          redirectUrl.hash = "/reset-password";
          const receipt = await auth.requestPasswordReset(email.trim(), {
            redirectUrl: redirectUrl.toString(),
            signal,
          });
          requireAcknowledgement(receipt?.accepted);
        },
        () => setAccepted(true),
      );
    } else {
      if (verification !== "valid" || !token || errors.password || errors.confirm) return;
      void action.run(
        async (signal) => {
          const auth = requireService(service, disconnected);
          const receipt = await auth.resetPassword({ token, password }, signal);
          requireAcknowledgement(receipt?.updated);
        },
        () => {
          setPassword("");
          setConfirm("");
          window.history.replaceState(
            null,
            "",
            `${window.location.pathname}${window.location.search}`,
          );
          setStep("updated");
        },
      );
    }
  }

  if (step === "updated") {
    return (
      <RecoveryShell key="updated">
        <SuccessPanel
          title="Password Updated Successfully"
          body="Your password has been updated. You can now sign in with your new password."
          action={<Button onClick={onLogin}>Return to Login</Button>}
        />
      </RecoveryShell>
    );
  }
  const reset = step === "reset";
  return (
    <RecoveryShell key={step}>
      <form className="auth-card network-form" noValidate onSubmit={submit} ref={formRef}>
        <PageHeading
          eyebrow="MEMBER RECOVERY"
          title={reset ? "Reset Password" : "Forgot Password?"}
          description={
            reset
              ? "Choose a new password to securely return to your MSGI One community."
              : "Enter your registered email address. We’ll send you a secure link to reset your password."
          }
        />
        {!service && <InlineMessage>{disconnected}</InlineMessage>}
        {reset ? (
          <>
            <div aria-live="polite">
              {verification === "checking" && (
                <InlineMessage>
                  <span className="set-spinner" aria-hidden /> Checking your reset link…
                </InlineMessage>
              )}
              {(verification === "invalid" || verification === "expired") && (
                <InlineMessage tone="error">
                  {verification === "expired"
                    ? "This reset link has expired. Please request a new link."
                    : "This reset link is invalid or has already been used. Please request a new link."}
                </InlineMessage>
              )}
              {verification === "unavailable" && service && (
                <InlineMessage
                  tone="error"
                  action={
                    <Button variant="ghost" onClick={() => setRetry((value) => value + 1)}>
                      Check link again
                    </Button>
                  }
                >
                  We couldn’t verify this link. No password has been changed.
                </InlineMessage>
              )}
            </div>
            <TextField
              id="recovery-password"
              label="New Password"
              icon="lock"
              type={visible.password ? "text" : "password"}
              value={password}
              autoComplete="new-password"
              required
              maxLength={128}
              placeholder="Enter a new password"
              disabled={action.busy || verification !== "valid"}
              onChange={(event) => setPassword(event.target.value)}
              error={attempt ? errors.password : undefined}
              trailing={
                <IconAction
                  icon={visible.password ? "eyeOff" : "eye"}
                  label={visible.password ? "Hide new password" : "Show new password"}
                  pressed={visible.password}
                  onClick={() => setVisible((value) => ({ ...value, password: !value.password }))}
                />
              }
            />
            <TextField
              id="recovery-confirm"
              label="Confirm Password"
              icon="lock"
              type={visible.confirm ? "text" : "password"}
              value={confirm}
              autoComplete="new-password"
              required
              maxLength={128}
              placeholder="Re-enter your new password"
              disabled={action.busy || verification !== "valid"}
              onChange={(event) => setConfirm(event.target.value)}
              error={attempt ? errors.confirm : undefined}
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
            <ul className="network-password-rules" aria-label="Password requirements">
              {(
                [
                  [rules.length, "Between 8 and 128 characters"],
                  [rules.mix, "Includes a letter and a number"],
                  [rules.match, "Both passwords match"],
                ] as const
              ).map(([met, label]) => (
                <li key={label} className={met ? "is-met" : ""}>
                  <Icon name={met ? "check" : "minus"} size={14} />
                  {label}
                  {met && <span className="set-visually-hidden"> — met</span>}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <TextField
            id="recovery-email"
            label="Registered Email Address"
            icon="mail"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            value={email}
            placeholder="Enter your registered email"
            disabled={action.busy || accepted}
            onChange={(event) => setEmail(event.target.value)}
            error={attempt ? emailError(email) : undefined}
          />
        )}
        {action.error && <InlineMessage tone="error">{action.error}</InlineMessage>}
        {accepted && (
          <div role="status">
            <InlineMessage tone="success">
              If an account matches this email address, you’ll receive a reset link. Check your
              inbox and spam folder. For your security, we don’t disclose whether an email is
              registered.
            </InlineMessage>
          </div>
        )}
        <Button
          type="submit"
          className="set-button--block"
          busy={action.busy}
          aria-label={
            action.busy ? (reset ? "Updating password" : "Requesting reset link") : undefined
          }
          disabled={accepted || (reset && verification !== "valid")}
        >
          {reset ? "Update Password" : accepted ? "Reset Link Requested" : "Send Reset Link"}
          <Icon name="arrow" size={17} />
        </Button>
        {reset && verification !== "checking" && (
          <Button
            variant="ghost"
            className="set-button--block"
            disabled={action.busy}
            onClick={() => {
              setStep("request");
              setAttempt(0);
              action.setError("");
              window.history.replaceState(
                null,
                "",
                `${window.location.pathname}${window.location.search}`,
              );
            }}
          >
            Request a new reset link
          </Button>
        )}
        <Button variant="ghost" className="set-button--block" onClick={onLogin}>
          <Icon name="arrow" size={16} className="back-icon" /> Back to Login
        </Button>
      </form>
    </RecoveryShell>
  );
}
