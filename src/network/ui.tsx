import { useEffect, useRef, type ReactNode } from "react";
import { Icon, Logo, TopBar, type IconName } from "../ui/chrome";
import { Button } from "../settings/ui";
import "../settings/settings.css";
import "./network.css";

export function PageHeading({
  title,
  description,
  eyebrow,
}: {
  title: ReactNode;
  description: string;
  eyebrow?: string;
}) {
  return (
    <div className="auth-card__head network-heading">
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h1 tabIndex={-1}>{title}</h1>
      <p>{description}</p>
    </div>
  );
}

export function NetworkPage({
  title,
  onBack,
  children,
}: {
  title: string;
  onBack: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>("h1")?.focus({ preventScroll: true });
  }, []);
  return (
    <div className="screen network-screen" ref={ref}>
      <TopBar title={title} onBack={onBack} />
      <div className="content">{children}</div>
    </div>
  );
}

export function RecoveryShell({
  children,
  compactTagline = false,
  grainBackground = false,
}: {
  children: ReactNode;
  compactTagline?: boolean;
  grainBackground?: boolean;
}) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const heading = ref.current?.querySelector<HTMLElement>("h1, h2");
    heading?.setAttribute("tabindex", "-1");
    heading?.focus({ preventScroll: true });
  }, []);
  return (
    <main
      className={`auth-screen network-recovery${grainBackground ? " network-recovery--grain" : ""}`}
      ref={ref}
    >
      <section className="auth-intro">
        <Logo />
        <p className={compactTagline ? "network-tagline--compact" : undefined}>
          {compactTagline ? (
            "Your community. Always within reach."
          ) : (
            <>
              Your community.
              <br />
              Always within reach.
            </>
          )}
        </p>
      </section>
      {children}
    </main>
  );
}

export function IconAction({
  icon,
  label,
  onClick,
  disabled = false,
  pressed,
}: {
  icon: IconName;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  pressed?: boolean;
}) {
  return (
    <Button
      variant="ghost"
      className="network-icon-action"
      aria-label={label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
    >
      <Icon name={icon} size={18} />
    </Button>
  );
}

export function useInvalidFocus(attempt: number) {
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (attempt) {
      ref.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    }
  }, [attempt]);
  return ref;
}
