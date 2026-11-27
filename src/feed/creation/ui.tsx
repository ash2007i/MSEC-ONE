import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Icon, type IconName } from "../../ui/chrome";
import { Button } from "../../settings/ui";
import { useAnimatedDismiss } from "../../ui/motion";
import "./creation.css";

export function ActionIcon({
  name,
  label,
  onClick,
  disabled = false,
}: {
  name: IconName;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Button
      variant="ghost"
      className="fc-icon"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      <Icon name={name} size={20} />
    </Button>
  );
}
export function CreationHeader({
  title,
  onBack,
  action,
}: {
  title: string;
  onBack: () => void;
  action?: ReactNode;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, []);
  return (
    <header className="fc-header">
      <ActionIcon name="arrow" label="Back to Feed" onClick={onBack} />
      <h1 ref={heading} tabIndex={-1}>
        {title}
      </h1>
      {action}
    </header>
  );
}
export function CreationSheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  const titleId = useId();
  const close = useAnimatedDismiss(ref, onClose);
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const selector =
      "button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]";
    ref.current
      ?.querySelector<HTMLElement>("input, select, textarea, button")
      ?.focus({ preventScroll: true });
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
      }
      if (event.key !== "Tab") return;
      const elements = Array.from(ref.current?.querySelectorAll<HTMLElement>(selector) ?? []);
      if (event.shiftKey && document.activeElement === elements[0]) {
        event.preventDefault();
        elements[elements.length - 1]?.focus();
      } else if (!event.shiftKey && document.activeElement === elements[elements.length - 1]) {
        event.preventDefault();
        elements[0]?.focus();
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);
  return (
    <div className="sheet-backdrop fc-backdrop" onClick={close}>
      <section
        ref={ref}
        className="bottom-sheet fc-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sheet-handle" />
        <div className="sheet-head">
          <h2 id={titleId}>{title}</h2>
          <ActionIcon name="close" label="Close settings" onClick={close} />
        </div>
        {children}
      </section>
    </div>
  );
}
export function useLocalFileUrl(file: File | null) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (!file) {
      setUrl("");
      return;
    }
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  return url;
}
export function LocalMedia({ file }: { file: File }) {
  const url = useLocalFileUrl(file);
  if (file.type.startsWith("image/"))
    return <img className="fc-media" src={url || undefined} alt={file.name} />;
  if (file.type.startsWith("video/"))
    return <video className="fc-media" src={url || undefined} controls aria-label={file.name} />;
  return (
    <div className="fc-file">
      <Icon name="file" />
      <span>{file.name}</span>
      {url && (
        <a href={url} target="_blank" rel="noreferrer">
          View PDF
        </a>
      )}
    </div>
  );
}
export function PreviewNote() {
  return (
    <p className="fc-preview-note">
      Local preview only · nothing is uploaded, published or scheduled.
    </p>
  );
}
