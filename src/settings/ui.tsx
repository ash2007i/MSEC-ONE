import { createPortal } from "react-dom";
import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { FrostedIcon, Icon, TopBar, type IconName } from "../ui/chrome";
import type { Translator } from "./i18n";
import { NetworkError, type ResolvedTheme, type SettingsSection, type UserSettings } from "./model";

export type SettingsRoute =
  | "main"
  | "appearance"
  | "notifications"
  | "language"
  | "storage"
  | "account"
  | "share"
  | "privacy"
  | "blocked"
  | "security"
  | "community"
  | "help"
  | "contact"
  | "report-problem"
  | "report-user"
  | "guidelines"
  | "terms"
  | "about";

export type ToastTone = "success" | "error" | "info";
export type ReportablePerson = { id: number; name: string; dept: string; year: string };

export type SettingsContextValue = {
  settings: UserSettings;
  update: <K extends SettingsSection>(
    section: K,
    next: UserSettings[K] | ((current: UserSettings[K]) => UserSettings[K]),
  ) => void;
  t: Translator;
  locale: string;
  systemTheme: ResolvedTheme;
  navigate: (route: SettingsRoute) => void;
  back: () => void;
  notify: (message: string, tone?: ToastTone) => void;
  logout: (notice?: string) => void;
  deleteAccount: () => void;
  previewProfile: () => void;
  profileUrl: string;
  reportablePeople: ReportablePerson[];
  /** Sheets render outside the scaled scroll content so they stay anchored to the phone frame. */
  sheetHost: HTMLElement | null;
};

export const SettingsContext = createContext<SettingsContextValue | null>(null);

export function useSettings() {
  const value = useContext(SettingsContext);
  if (!value) throw new Error("useSettings must be used inside SettingsContext");
  return value;
}

export function errorMessage(error: unknown, t: Translator) {
  return error instanceof NetworkError ? t("error.network") : t("error.saveFailed");
}

/** Re-renders periodically so time-based states (quiet hours, "active now") stay current. */
export function useNow(intervalMs = 30000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}

export function SettingsPage({
  title,
  description,
  children,
  footer,
  onBack,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  onBack?: () => void;
}) {
  const { t, back } = useSettings();
  return (
    <div className={`screen set-screen ${footer ? "set-screen--footer" : ""}`}>
      <TopBar title={title} onBack={onBack ?? back} backLabel={t("common.back")} />
      <div className="content set-content">
        {description && <p className="set-intro">{description}</p>}
        {children}
      </div>
      {footer && <div className="set-footer">{footer}</div>}
    </div>
  );
}

export function Section({
  title,
  children,
  note,
  plain = false,
  groupProps,
}: {
  title?: string;
  children: ReactNode;
  note?: ReactNode;
  plain?: boolean;
  groupProps?: HTMLAttributes<HTMLDivElement>;
}) {
  const id = useId();
  return (
    <section className="set-section" aria-labelledby={title ? id : undefined}>
      {title && (
        <h2 className="set-label" id={id}>
          {title}
        </h2>
      )}
      {plain ? (
        children
      ) : (
        <div className="glass-panel set-group" {...groupProps}>
          {children}
        </div>
      )}
      {note && <div className="set-note">{note}</div>}
    </section>
  );
}

function RowText({ title, description }: { title: ReactNode; description?: ReactNode }) {
  return (
    <span className="set-row__text">
      <b>{title}</b>
      {description && <small>{description}</small>}
    </span>
  );
}

export function NavRow({
  icon,
  title,
  description,
  value,
  onClick,
  tone,
}: {
  icon?: IconName;
  title: ReactNode;
  description?: ReactNode;
  value?: ReactNode;
  onClick: () => void;
  tone?: "danger";
}) {
  return (
    <button
      type="button"
      className={`set-row ${icon ? "" : "set-row--plain"} ${tone ? `set-row--${tone}` : ""}`}
      onClick={onClick}
    >
      {icon && <FrostedIcon name={icon} />}
      <span className="set-row__main">
        <RowText title={title} description={description} />
        <span className="set-row__trail">
          {value !== undefined && <span className="set-row__value">{value}</span>}
          <Icon name="chevron" size={16} className="set-row__chevron" />
        </span>
      </span>
    </button>
  );
}

export function ToggleRow({
  icon,
  title,
  description,
  checked,
  onChange,
  disabled = false,
}: {
  icon?: IconName;
  title: ReactNode;
  description?: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      className={`set-row ${icon ? "" : "set-row--plain"}`}
      onClick={() => onChange(!checked)}
    >
      {icon && <FrostedIcon name={icon} />}
      <span className="set-row__main">
        <RowText title={title} description={description} />
        <span className="set-row__trail">
          <span className={`toggle ${checked ? "on" : ""}`} aria-hidden>
            <span />
          </span>
        </span>
      </span>
    </button>
  );
}

export function RadioRow({
  icon,
  title,
  description,
  selected,
  onSelect,
  extra,
}: {
  icon?: IconName;
  title: ReactNode;
  description?: ReactNode;
  selected: boolean;
  onSelect: () => void;
  extra?: ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      className={`set-row ${icon ? "" : "set-row--plain"} ${selected ? "is-selected" : ""}`}
      onClick={onSelect}
    >
      {icon && <FrostedIcon name={icon} />}
      <span className="set-row__main">
        <span className="set-row__text">
          <b>{title}</b>
          {description && <small>{description}</small>}
          {extra}
        </span>
        <span className="set-row__trail">
          <span className={`set-radio ${selected ? "is-on" : ""}`} aria-hidden />
        </span>
      </span>
    </button>
  );
}

export function DetailRow({
  icon,
  label,
  value,
  onClick,
  trailing,
}: {
  icon?: IconName;
  label: ReactNode;
  value: ReactNode;
  onClick?: () => void;
  trailing?: ReactNode;
}) {
  const body = (
    <>
      {icon && <FrostedIcon name={icon} />}
      <span className="set-row__main">
        <span className="set-row__text set-row__text--detail">
          <small>{label}</small>
          <b>{value}</b>
        </span>
        <span className="set-row__trail">
          {trailing}
          {onClick && <Icon name="chevron" size={16} className="set-row__chevron" />}
        </span>
      </span>
    </>
  );
  const className = `set-row ${icon ? "" : "set-row--plain"}`;
  return onClick ? (
    <button type="button" className={className} onClick={onClick}>
      {body}
    </button>
  ) : (
    <div className={className}>{body}</div>
  );
}

export function InlineMessage({
  tone = "info",
  children,
  action,
}: {
  tone?: ToastTone | "warning";
  children: ReactNode;
  action?: ReactNode;
}) {
  const icon: IconName =
    tone === "success" ? "check" : tone === "error" ? "alert" : tone === "warning" ? "alert" : "info";
  return (
    <div className={`set-message set-message--${tone}`} role={tone === "error" ? "alert" : undefined}>
      <Icon name={icon} size={17} />
      <div>
        {children}
        {action}
      </div>
    </div>
  );
}

export function Button({
  children,
  variant = "primary",
  busy = false,
  className = "",
  ...props
}: {
  children: ReactNode;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  busy?: boolean;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      disabled={busy || props.disabled}
      aria-busy={busy || undefined}
      className={`set-button set-button--${variant} ${className}`}
    >
      {busy ? <span className="set-spinner" aria-hidden /> : children}
    </button>
  );
}

export function Sheet({
  title,
  eyebrow,
  onClose,
  children,
}: {
  title: string;
  eyebrow?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const { t, sheetHost } = useSettings();
  const ref = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const titleId = useId();
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const selector =
      'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]';
    (
      ref.current?.querySelector<HTMLElement>("input:not([readonly]), textarea, select") ||
      ref.current?.querySelector<HTMLElement>(".set-sheet__body, button")
    )?.focus({ preventScroll: true });
    function keydown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const elements = [...(ref.current?.querySelectorAll<HTMLElement>(selector) || [])];
      if (!elements.length) return;
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", keydown);
    return () => {
      document.removeEventListener("keydown", keydown);
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);
  const markup = (
    <div className="sheet-backdrop set-sheet-backdrop" onClick={() => closeRef.current()}>
      <section
        ref={ref}
        className="bottom-sheet set-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sheet-handle" />
        <div className="sheet-head">
          <div>
            {eyebrow && <p className="eyebrow">{eyebrow}</p>}
            <h2 id={titleId}>{title}</h2>
          </div>
          <button type="button" onClick={() => closeRef.current()} aria-label={t("common.close")}>
            <Icon name="close" />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
  return sheetHost ? createPortal(markup, sheetHost) : markup;
}

export function SheetActions({ children }: { children: ReactNode }) {
  return <div className="set-sheet__actions">{children}</div>;
}

/** Confirmation dialog with loading and failure states. `onConfirm` closes it on success. */
export function ConfirmSheet({
  title,
  body,
  confirmLabel,
  tone = "primary",
  onConfirm,
  onClose,
  children,
  confirmDisabled = false,
  cancelLabel,
}: {
  title: string;
  body?: ReactNode;
  confirmLabel: string;
  tone?: "primary" | "danger";
  onConfirm: () => unknown | Promise<unknown>;
  onClose: () => void;
  children?: ReactNode;
  confirmDisabled?: boolean;
  cancelLabel?: string;
}) {
  const { t } = useSettings();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function confirm() {
    setBusy(true);
    setError("");
    try {
      await onConfirm();
    } catch (caught) {
      setError(errorMessage(caught, t));
    } finally {
      // Multi-step flows keep this sheet mounted, so the next step must start idle.
      setBusy(false);
    }
  }
  return (
    <Sheet title={title} onClose={() => !busy && onClose()}>
      {body && (
        <div className="set-sheet__body" tabIndex={-1}>
          {body}
        </div>
      )}
      {children}
      {error && <InlineMessage tone="error">{error}</InlineMessage>}
      <SheetActions>
        <Button variant="secondary" onClick={onClose} disabled={busy}>
          {cancelLabel ?? t("common.cancel")}
        </Button>
        <Button
          variant={tone === "danger" ? "danger" : "primary"}
          busy={busy}
          disabled={confirmDisabled}
          onClick={confirm}
        >
          {confirmLabel}
        </Button>
      </SheetActions>
    </Sheet>
  );
}

export function ChoiceSheet<T extends string>({
  title,
  options,
  value,
  onSelect,
  onClose,
}: {
  title: string;
  options: { value: T; label: string; description?: string }[];
  value: T;
  onSelect: (value: T) => void;
  onClose: () => void;
}) {
  return (
    <Sheet title={title} onClose={onClose}>
      <div className="set-group set-group--sheet" role="radiogroup" aria-label={title}>
        {options.map((option) => (
          <RadioRow
            key={option.value}
            title={option.label}
            description={option.description}
            selected={option.value === value}
            onSelect={() => {
              onSelect(option.value);
              onClose();
            }}
          />
        ))}
      </div>
    </Sheet>
  );
}

type FieldBase = {
  id: string;
  label: string;
  error?: string;
  hint?: ReactNode;
  optional?: boolean;
};

function FieldFrame({
  id,
  label,
  error,
  hint,
  optional,
  children,
  counter,
}: FieldBase & { children: ReactNode; counter?: ReactNode }) {
  const { t } = useSettings();
  return (
    <div className="field set-field">
      <label htmlFor={id}>
        {label}
        {optional && <em>{t("common.optional")}</em>}
      </label>
      {children}
      {(error || hint || counter) && (
        <div className="set-field__meta">
          {error ? (
            <p className="field-error" id={`${id}-error`}>
              {error}
            </p>
          ) : (
            hint && (
              <p className="set-hint" id={`${id}-hint`}>
                {hint}
              </p>
            )
          )}
          {counter}
        </div>
      )}
    </div>
  );
}

const describedBy = (id: string, error?: string, hint?: ReactNode) =>
  error ? `${id}-error` : hint ? `${id}-hint` : undefined;

export function TextField({
  id,
  label,
  error,
  hint,
  optional,
  icon,
  trailing,
  ...input
}: FieldBase & {
  icon?: IconName;
  trailing?: ReactNode;
} & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <FieldFrame id={id} label={label} error={error} hint={hint} optional={optional}>
      <div className={`input-wrap ${error ? "input-wrap--error" : ""}`}>
        {icon && <Icon name={icon} size={18} />}
        <input
          id={id}
          {...input}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy(id, error, hint)}
        />
        {trailing}
      </div>
    </FieldFrame>
  );
}

export function TextAreaField({
  id,
  label,
  error,
  hint,
  optional,
  max,
  value,
  ...input
}: FieldBase & { max?: number; value: string } & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const length = value.trim().length;
  return (
    <FieldFrame
      id={id}
      label={label}
      error={error}
      hint={hint}
      optional={optional}
      counter={
        max ? (
          <span className={`set-counter ${length > max ? "is-over" : ""}`} aria-live="polite">
            {length}/{max}
          </span>
        ) : undefined
      }
    >
      <textarea
        id={id}
        value={value}
        {...input}
        className={error ? "set-textarea--error" : ""}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy(id, error, hint)}
      />
    </FieldFrame>
  );
}

export function SelectField({
  id,
  label,
  error,
  hint,
  optional,
  children,
  ...select
}: FieldBase & { children: ReactNode } & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <FieldFrame id={id} label={label} error={error} hint={hint} optional={optional}>
      <div className={`input-wrap set-select ${error ? "input-wrap--error" : ""}`}>
        <select
          id={id}
          {...select}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy(id, error, hint)}
        >
          {children}
        </select>
        <Icon name="chevron" size={16} className="set-select__chevron" />
      </div>
    </FieldFrame>
  );
}

export function PasswordField(
  props: Omit<Parameters<typeof TextField>[0], "type" | "trailing" | "icon"> & { visible: boolean },
) {
  const { visible, ...rest } = props;
  return <TextField {...rest} icon="lock" type={visible ? "text" : "password"} />;
}

export function ChipGroup<T extends string>({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: { value: T; label: string }[];
  selected: readonly T[];
  onToggle: (value: T) => void;
}) {
  return (
    <div className="chips set-chips" role="group" aria-label={label}>
      {options.map((option) => {
        const active = selected.includes(option.value);
        return (
          <button
            type="button"
            key={option.value}
            className={active ? "active" : ""}
            aria-pressed={active}
            onClick={() => onToggle(option.value)}
          >
            {active && <Icon name="check" size={13} />}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: IconName;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state set-empty">
      <div>
        <Icon name={icon} />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}

export function SuccessPanel({
  title,
  body,
  note,
  action,
}: {
  title: string;
  body: ReactNode;
  note?: ReactNode;
  action: ReactNode;
}) {
  return (
    <div className="glass-panel set-success" role="status">
      <span className="set-success__icon">
        <Icon name="check" size={26} />
      </span>
      <h2>{title}</h2>
      <p>{body}</p>
      {note && <small>{note}</small>}
      {action}
    </div>
  );
}

export function toggleInList<T>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}
