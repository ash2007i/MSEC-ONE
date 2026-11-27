import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button, InlineMessage, SuccessPanel, TextField } from "../settings/ui";
import { PageHeading, RecoveryShell, useInvalidFocus } from "../network/ui";
import { useServiceAction } from "../network/useServiceAction";
import {
  AuthFlowError,
  detailErrors,
  requireVerified,
  validateSession,
  type MembershipAuthService,
  type MembershipSession,
} from "./model";

/** The only access-code screen and the only call site for access-code verification. */
export function AccessCodeVerification({
  service,
  onVerified,
  onBack,
  onPreview,
  backLabel = "Back to Login",
}: {
  service?: MembershipAuthService;
  onVerified: (session: Extract<MembershipSession, { status: "verified" }>) => void;
  onBack: () => void;
  onPreview?: () => void;
  backLabel?: string;
}) {
  const [code, setCode] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [confirmed, setConfirmed] = useState<Extract<
    MembershipSession,
    { status: "verified" }
  > | null>(null);
  const action = useServiceAction();
  const ref = useInvalidFocus(attempt);
  const complete = useRef(onVerified);
  complete.current = onVerified;
  useEffect(() => {
    if (!confirmed) return;
    const timer = window.setTimeout(() => complete.current(confirmed), 1600);
    return () => window.clearTimeout(timer);
  }, [confirmed]);
  function submit(event: FormEvent) {
    event.preventDefault();
    if (action.busy) return;
    setAttempt((value) => value + 1);
    if (!code.trim()) return;
    if (!service) {
      if (onPreview) onPreview();
      else action.setError("Verification is unavailable. Please return to Login.");
      return;
    }
    void action.run(
      async (signal) => {
        const current = await service.getSession(signal);
        if (!current) throw new AuthFlowError("verification-failed");
        const session = validateSession(current);
        if (session.status === "verified") return requireVerified(session);
        if (Object.keys(detailErrors(session.details)).length)
          throw new AuthFlowError("membership-mismatch");
        // Do not normalize, truncate, restrict or invent a format for an existing access code.
        return requireVerified(await service.verifyAccessCode(code, signal));
      },
      (session) => {
        setCode("");
        setConfirmed(session);
      },
    );
  }
  return (
    <RecoveryShell grainBackground>
      {confirmed ? (
        <SuccessPanel
          title="Verification Successful!"
          body="Your MSGI membership has been verified. Welcome to MSGI One."
          action={<Button onClick={() => onVerified(confirmed)}>Continue to Home</Button>}
        />
      ) : (
        <form className="auth-card network-form" noValidate onSubmit={submit} ref={ref}>
          <PageHeading
            eyebrow={!service && onPreview ? "PREVIEW" : undefined}
            title="Verify Your Access"
            description="Enter the access code sent to the email address you provided."
          />
          <TextField
            id="membership-access-code"
            label="Access Code"
            placeholder="Enter your access code"
            value={code}
            required
            autoComplete="off"
            disabled={action.busy}
            autoCapitalize="none"
            spellCheck={false}
            onChange={(event) => setCode(event.target.value)}
            error={attempt && !code.trim() ? "Enter your access code." : undefined}
          />
          {action.error && <InlineMessage tone="error">{action.error}</InlineMessage>}
          <Button
            type="submit"
            busy={action.busy}
            className="set-button--block"
            aria-label={action.busy ? "Verifying membership" : undefined}
          >
            Verify Me
          </Button>
          <Button
            variant="ghost"
            className="set-button--block"
            disabled={action.busy}
            onClick={onBack}
          >
            {backLabel}
          </Button>
        </form>
      )}
    </RecoveryShell>
  );
}
