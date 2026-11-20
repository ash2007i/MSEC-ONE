import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { ChatIcon, type ChatIconName } from "./ChatIcon";
import { EmojiPicker } from "./EmojiPicker";
import {
  currentUser,
  messagePreview,
  type Attachment,
  type Contact,
  type Message,
  type MessagingStore,
} from "./model";
import "./messaging.css";

function ContactAvatar({ contact, small = false }: { contact: Contact; small?: boolean }) {
  return (
    <span className={`msg-avatar ${small ? "msg-avatar--small" : ""}`}>
      <img src={contact.image} alt="" />
      {contact.online && <i title="Online" />}
    </span>
  );
}

function IconButton({
  icon,
  label,
  onClick,
  active = false,
  disabled = false,
}: {
  icon: ChatIconName;
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={`msg-icon-button ${active ? "is-active" : ""}`}
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
    >
      <ChatIcon name={icon} />
    </button>
  );
}

function Dialog({
  title,
  onClose,
  children,
  className = "",
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const selector = 'button:not(:disabled), input, select, textarea, a[href], [tabindex="0"]';
    (
      ref.current?.querySelector<HTMLElement>("input, textarea") ||
      ref.current?.querySelector<HTMLElement>("button")
    )?.focus();
    function keydown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        closeRef.current();
      }
      if (e.key !== "Tab") return;
      const elements = [...(ref.current?.querySelectorAll<HTMLElement>(selector) || [])].filter(
        (el) => el.getClientRects().length,
      );
      if (!elements.length) {
        e.preventDefault();
        return;
      }
      if (e.shiftKey && document.activeElement === elements[0]) {
        e.preventDefault();
        elements[elements.length - 1]?.focus();
      } else if (!e.shiftKey && document.activeElement === elements[elements.length - 1]) {
        e.preventDefault();
        elements[0].focus();
      }
    }
    document.addEventListener("keydown", keydown, true);
    return () => {
      document.removeEventListener("keydown", keydown, true);
      previous?.isConnected && previous.focus({ preventScroll: true });
    };
  }, []);
  return (
    <div className="msg-overlay" onClick={onClose}>
      <div
        ref={ref}
        className={`msg-dialog msg-frost ${className}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="msg-dialog-heading">
          <div>
            <span className="msg-overline">MSGI ONE · MESSAGING</span>
            <h2>{title}</h2>
          </div>
          <IconButton icon="close" label={`Close ${title}`} onClick={onClose} />
        </div>
        {children}
      </div>
    </div>
  );
}

function EmptyState({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="msg-empty">
      <span className="msg-empty-icon">
        <ChatIcon name="smile" size={26} />
      </span>
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}

export function MessagingInbox({
  store,
  openChat,
  renderHeader,
}: {
  store: MessagingStore;
  openChat: (id: number) => void;
  renderHeader: (compose: () => void, search: () => void) => ReactNode;
}) {
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const [tab, setTab] = useState("Messages");
  const [query, setQuery] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [compose, setCompose] = useState(false);
  const [contactSearch, setContactSearch] = useState("");
  const [announcement, setAnnouncement] = useState<string | null>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const totalUnread = Object.values(snapshot.unread).reduce((a, b) => a + b, 0);
  const list = store.contacts.filter(
    (contact) =>
      `${contact.name} ${contact.company}`.toLowerCase().includes(query.trim().toLowerCase()) &&
      (!unreadOnly || snapshot.unread[contact.id]),
  );
  return (
    <div className="screen msg-inbox">
      {renderHeader(
        () => setCompose(true),
        () => {
          setTab("Messages");
          window.requestAnimationFrame(() => searchInput.current?.focus());
        },
      )}
      <div className="msg-inbox-content">
        <div className="msg-tabs" role="tablist" aria-label="Inbox sections">
          {["Messages", "Announcements"].map((label) => (
            <button
              role="tab"
              key={label}
              aria-selected={tab === label}
              className={tab === label ? "is-active" : ""}
              onClick={() => setTab(label)}
            >
              {label}
              {label === "Messages" && totalUnread > 0 && <b>{totalUnread}</b>}
            </button>
          ))}
        </div>
        {tab === "Messages" ? (
          <>
            <label className="msg-search msg-frost">
              <ChatIcon name="search" size={19} />
              <input
                ref={searchInput}
                placeholder="Search conversations"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {query && (
                <button onClick={() => setQuery("")} aria-label="Clear conversation search">
                  <ChatIcon name="close" size={16} />
                </button>
              )}
            </label>
            <section className="msg-active-panel msg-frost" aria-label="Active alumni">
              <div className="msg-section-label">
                <span className="msg-overline">ACTIVE IN YOUR NETWORK</span>
                <span className="msg-live-count">
                  {store.contacts.filter((c) => c.online).length} online
                </span>
              </div>
              <div className="msg-active-list">
                {store.contacts
                  .filter((c) => c.online)
                  .map((c) => (
                    <button key={c.id} onClick={() => openChat(c.id)}>
                      <ContactAvatar contact={c} />
                      <span>{c.name.split(" ")[0]}</span>
                    </button>
                  ))}
              </div>
            </section>
            <div className="msg-list-heading">
              <h2>Conversations</h2>
              <button
                className={unreadOnly ? "is-active" : ""}
                aria-pressed={unreadOnly}
                onClick={() => setUnreadOnly(!unreadOnly)}
              >
                Unread{totalUnread > 0 && <span>{totalUnread}</span>}
              </button>
            </div>
            <div className="msg-conversations">
              {list.map((c) => {
                const messages = snapshot.threads[c.id] || [];
                const last = messages[messages.length - 1];
                const changed = last && !last.id.startsWith("initial-") && !last.opportunity;
                const preview = changed
                  ? `${last.sender === "me" ? "You: " : ""}${messagePreview(last)}`
                  : !messages.length
                    ? "No messages yet. Say hello."
                    : c.preview;
                return (
                  <button
                    className={`msg-conversation msg-frost ${snapshot.unread[c.id] ? "is-unread" : ""}`}
                    key={c.id}
                    onClick={() => openChat(c.id)}
                  >
                    <ContactAvatar contact={c} />
                    <span className="msg-conversation-copy">
                      <span className="msg-conversation-top">
                        <strong>{c.name}</strong>
                        <time>{changed ? last.time : c.time}</time>
                      </span>
                      <span className="msg-contact-company">{c.company} · MSGI alumni</span>
                      <span className="msg-conversation-preview">
                        {messages.some((m) => m.pinned) && <ChatIcon name="pin" size={12} />}
                        {preview}
                      </span>
                    </span>
                    {snapshot.unread[c.id] > 0 && (
                      <b className="msg-unread-count">{snapshot.unread[c.id]}</b>
                    )}
                  </button>
                );
              })}
            </div>
            {!list.length && (
              <EmptyState title={unreadOnly ? "You’re all caught up" : "No conversations found"}>
                {unreadOnly
                  ? "There are no unread conversations. Switch to all messages to keep connecting."
                  : "Try another alumni name or company."}
              </EmptyState>
            )}
            <p className="msg-session-note">
              <ChatIcon name="shield" size={13} />
              Private network. Meaningful conversations.
            </p>
          </>
        ) : (
          <div className="msg-announcements">
            {[
              {
                icon: "object" as const,
                date: "TODAY · MSGI",
                title: "Distinguished Alumni Awards",
                text: "Nominate an alumnus who is creating meaningful impact in their field.",
                action: "Read announcement",
              },
              {
                icon: "calendar" as const,
                date: "12 MAR · CHENNAI CHAPTER",
                title: "March community calendar",
                text: "Three new events have been added near you.",
                action: "View announcement",
              },
            ].map((item) => (
              <article key={item.title} className="msg-frost">
                <span className="msg-announcement-icon">
                  <ChatIcon name={item.icon} />
                </span>
                <div>
                  <p className="msg-overline">{item.date}</p>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                  <button className="msg-text-button" onClick={() => setAnnouncement(item.title)}>
                    {item.action}
                    <ChatIcon name="forward" size={15} />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
      {compose && (
        <Dialog title="New conversation" onClose={() => setCompose(false)}>
          <label className="msg-search">
            <ChatIcon name="search" size={18} />
            <input
              autoFocus
              placeholder="Search alumni or company"
              value={contactSearch}
              onChange={(e) => setContactSearch(e.target.value)}
            />
          </label>
          <div className="msg-recipient-list">
            {store.contacts
              .filter((c) =>
                `${c.name} ${c.company}`.toLowerCase().includes(contactSearch.toLowerCase()),
              )
              .map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    setCompose(false);
                    openChat(c.id);
                  }}
                >
                  <ContactAvatar contact={c} small />
                  <span>
                    <strong>{c.name}</strong>
                    <small>{c.company}</small>
                  </span>
                  <ChatIcon name="forward" size={17} />
                </button>
              ))}
            {!store.contacts.some((c) =>
              `${c.name} ${c.company}`.toLowerCase().includes(contactSearch.toLowerCase()),
            ) && <p className="msg-panel-note">No alumni match your search.</p>}
          </div>
        </Dialog>
      )}
      {announcement && (
        <Dialog title={announcement} onClose={() => setAnnouncement(null)}>
          <p className="msg-panel-note">
            {announcement === "Distinguished Alumni Awards"
              ? "Nominate an alumnus who is creating meaningful impact in their field. Nominations close 30 March."
              : "Three new events have been added near you. Visit the existing events calendar from Home to explore the current community schedule."}
          </p>
          <button className="msg-primary" onClick={() => setAnnouncement(null)}>
            Done
          </button>
        </Dialog>
      )}
    </div>
  );
}

type Popover = { kind: "reactions" | "menu"; messageId: string; top: number; left: number };
type Modal =
  | { kind: "emoji"; messageId?: string }
  | { kind: "forward" | "info" | "delete"; messageId: string; everyone?: boolean }
  | { kind: "call"; mode: "Audio" | "Video" | "Meet" }
  | { kind: "gif" | "clear" | "copy"; text?: string }
  | null;
const quickReactions = ["❤️", "😂", "👍", "😮", "😢", "🔥", "🎉", "💯"];

function Receipt({ message }: { message: Message }) {
  return (
    <span className={`msg-receipt msg-receipt--${message.status}`}>
      <time>{message.time}</time>
      {message.edited && <span>Edited</span>}
      {message.sender === "me" && (
        <>
          <ChatIcon
            name={
              message.status === "sending"
                ? "clock"
                : message.status === "failed"
                  ? "retry"
                  : message.status === "sent"
                    ? "check"
                    : "checks"
            }
            size={13}
          />
          <span>
            {message.status === "seen"
              ? "Seen"
              : message.status.charAt(0).toUpperCase() + message.status.slice(1)}
          </span>
        </>
      )}
    </span>
  );
}

function AttachmentView({ attachment }: { attachment: Attachment }) {
  return (
    <div className="msg-attachment-view">
      {attachment.type.startsWith("image/") && (
        <a
          href={attachment.url}
          target="_blank"
          rel="noreferrer"
          aria-label={`Open ${attachment.name}`}
        >
          <img src={attachment.url} alt={attachment.name} />
        </a>
      )}
      {attachment.type.startsWith("audio/") ? (
        <>
          <span className="msg-voice-label">
            <ChatIcon name="mic" size={15} />
            Voice message
          </span>
          <audio controls src={attachment.url} preload="metadata" aria-label="Voice message" />
        </>
      ) : (
        <a className="msg-file-link" href={attachment.url} download={attachment.name}>
          <ChatIcon name="file" size={19} />
          <span>
            {attachment.name}
            <small>
              {attachment.size < 1024 * 1024
                ? `${Math.max(1, Math.round(attachment.size / 1024))} KB`
                : `${(attachment.size / 1024 / 1024).toFixed(1)} MB`}{" "}
              · Local attachment
            </small>
          </span>
          <ChatIcon name="download" size={16} />
        </a>
      )}
    </div>
  );
}

export function ConversationScreen({
  id,
  store,
  onBack,
  viewProfile,
}: {
  id: number;
  store: MessagingStore;
  onBack: () => void;
  viewProfile: () => void;
}) {
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const contact = store.contacts.find((c) => c.id === id) || store.contacts[0];
  const messages = snapshot.threads[id] || [];
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [reply, setReply] = useState<Message | null>(null);
  const [editing, setEditing] = useState<Message | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [popover, setPopover] = useState<Popover | null>(null);
  const [modal, setModal] = useState<Modal>(null);
  const [attachmentMenu, setAttachmentMenu] = useState(false);
  const [headerMenu, setHeaderMenu] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState("");
  const [forwardSearch, setForwardSearch] = useState("");
  const [recipients, setRecipients] = useState<number[]>([]);
  const [gifSearch, setGifSearch] = useState("");
  const [recording, setRecording] = useState<"idle" | "requesting" | "recording">("idle");
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordingError, setRecordingError] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const messageElements = useRef(new Map<string, HTMLDivElement>());
  const longPress = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointerStart = useRef({ x: 0, y: 0 });
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const recordCancelled = useRef(false);
  const mounted = useRef(true);
  const previousCount = useRef(messages.length);
  const floating = useRef<HTMLDivElement>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const activeMessage =
    modal && "messageId" in modal ? messages.find((m) => m.id === modal.messageId) : undefined;
  const pinned = messages.filter((m) => m.pinned && !m.deleted);
  const displayedMessages = messages.filter(
    (m) => !search || messagePreview(m).toLowerCase().includes(search.toLowerCase()),
  );
  const closeModal = () => setModal(null);
  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 180);
    store.markRead(id);
    return () => clearTimeout(timer);
  }, [id, store]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      recordCancelled.current = true;
      recorder.current?.state === "recording" && recorder.current.stop();
      stream.current?.getTracks().forEach((track) => track.stop());
      if (longPress.current) clearTimeout(longPress.current);
    };
  }, []);
  useEffect(() => {
    if (!loading && messages.length >= previousCount.current)
      scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "auto" });
    previousCount.current = messages.length;
  }, [messages.length, loading]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 3000);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (!flash) return;
    const timer = setTimeout(() => setFlash(null), 1800);
    return () => clearTimeout(timer);
  }, [flash]);
  useEffect(() => {
    if (recording !== "recording") return;
    const interval = setInterval(() => setRecordingSeconds((n) => n + 1), 1000);
    return () => clearInterval(interval);
  }, [recording]);
  useEffect(() => {
    if (!popover) return;
    const previous = document.activeElement as HTMLElement | null;
    floating.current?.querySelector<HTMLButtonElement>("button")?.focus();
    function trap(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      const buttons = [...(floating.current?.querySelectorAll<HTMLButtonElement>("button") || [])];
      const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
      e.preventDefault();
      buttons[(index + (e.shiftKey ? -1 : 1) + buttons.length) % buttons.length]?.focus();
    }
    document.addEventListener("keydown", trap);
    return () => {
      document.removeEventListener("keydown", trap);
      if (
        previous?.isConnected &&
        (document.activeElement === document.body ||
          floating.current?.contains(document.activeElement))
      )
        previous.focus({ preventScroll: true });
    };
  }, [popover]);
  useEffect(() => {
    function dismiss(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setPopover(null);
        setSelected(null);
        setHeaderMenu(false);
        setAttachmentMenu(false);
      }
    }
    document.addEventListener("keydown", dismiss);
    return () => document.removeEventListener("keydown", dismiss);
  }, []);
  function jump(messageId: string) {
    const target = messageElements.current.get(messageId);
    if (!target) {
      if (messages.some((message) => message.id === messageId)) {
        setSearch("");
        requestAnimationFrame(() => {
          messageElements.current
            .get(messageId)
            ?.scrollIntoView({ behavior: "auto", block: "center" });
          setFlash(messageId);
        });
        return;
      }
      setToast("The original message is no longer available in this view.");
      return;
    }
    target.scrollIntoView({
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "center",
    });
    setFlash(messageId);
  }
  function openPopover(kind: Popover["kind"], message: Message) {
    setToast("");
    const bounds = root.current?.getBoundingClientRect();
    const anchor = messageElements.current.get(message.id)?.getBoundingClientRect();
    if (!bounds || !anchor) return;
    const height = kind === "reactions" ? 122 : message.sender === "me" ? 366 : 282;
    const width = Math.min(kind === "reactions" ? 318 : 254, bounds.width - 24);
    let top = anchor.top - bounds.top - height - 44;
    if (top < 80) top = anchor.bottom - bounds.top + 8;
    setSelected(message.id);
    setAttachmentMenu(false);
    setHeaderMenu(false);
    setPopover({
      kind,
      messageId: message.id,
      top: Math.max(12, Math.min(top, bounds.height - height - 12)),
      left: Math.max(12, Math.min(anchor.left - bounds.left, bounds.width - width - 12)),
    });
  }
  function startReply(message: Message) {
    setReply(message);
    setEditing(null);
    setPopover(null);
    setSelected(message.id);
    composer.current?.focus();
  }
  function send() {
    if (!draft.trim()) return;
    if (editing) {
      store.edit(id, editing.id, draft);
      setEditing(null);
      setToast("Message updated");
    } else
      store.send(id, {
        text: draft.trim(),
        ...(reply
          ? {
              reply: {
                id: reply.id,
                text: messagePreview(reply),
                sender: reply.sender === "me" ? currentUser : contact.name,
              },
            }
          : {}),
      });
    setDraft("");
    setReply(null);
    setSelected(null);
    if (composer.current) composer.current.style.height = "auto";
    composer.current?.focus();
  }
  async function copy(message: Message) {
    setPopover(null);
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(message.text || message.attachment?.name || "");
      setToast("Message text copied");
    } catch {
      setModal({ kind: "copy", text: message.text || message.attachment?.name || "" });
    }
  }
  function addEmoji(emoji: string) {
    if (modal?.kind === "emoji" && modal.messageId) store.react(id, modal.messageId, emoji);
    else {
      const start = composer.current?.selectionStart ?? draft.length;
      const end = composer.current?.selectionEnd ?? start;
      setDraft(draft.slice(0, start) + emoji + draft.slice(end));
      requestAnimationFrame(() => {
        composer.current?.focus();
        composer.current?.setSelectionRange(start + emoji.length, start + emoji.length);
      });
    }
    closeModal();
  }
  function upload(file?: File) {
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      setToast("Choose a file smaller than 20 MB.");
      return;
    }
    const attachment: Attachment = {
      name: file.name,
      type: file.type || "application/octet-stream",
      size: file.size,
      url: store.objectURL(file),
    };
    store.send(id, {
      text: "",
      attachment,
      ...(reply
        ? {
            reply: {
              id: reply.id,
              sender: reply.sender === "me" ? currentUser : contact.name,
              text: messagePreview(reply),
            },
          }
        : {}),
    });
    setReply(null);
    setAttachmentMenu(false);
    closeModal();
    setToast("Attachment added to this session only");
  }
  async function startRecording() {
    setRecordingError("");
    setAttachmentMenu(false);
    setRecording("requesting");
    recordCancelled.current = false;
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined")
        throw new Error("unsupported");
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mounted.current || recordCancelled.current) {
        media.getTracks().forEach((track) => track.stop());
        return;
      }
      stream.current = media;
      const device = new MediaRecorder(media);
      recorder.current = device;
      const chunks: Blob[] = [];
      device.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      device.onstop = () => {
        media.getTracks().forEach((track) => track.stop());
        if (!recordCancelled.current && mounted.current && chunks.length) {
          const blob = new Blob(chunks, { type: device.mimeType || "audio/webm" });
          store.send(id, {
            text: "",
            attachment: {
              name: "Voice message.webm",
              type: blob.type,
              size: blob.size,
              url: store.objectURL(blob),
            },
          });
        }
        if (mounted.current) setRecording("idle");
      };
      device.onerror = () => {
        recordCancelled.current = true;
        media.getTracks().forEach((track) => track.stop());
        setRecording("idle");
        setRecordingError("Recording stopped. Please try again.");
      };
      device.start();
      setRecordingSeconds(0);
      setRecording("recording");
    } catch {
      if (mounted.current) {
        setRecording("idle");
        setRecordingError(
          "Microphone unavailable. Allow microphone access in your browser to record a local voice message.",
        );
      }
    }
  }
  function stopRecording(cancel: boolean) {
    recordCancelled.current = cancel;
    if (recorder.current?.state === "recording") recorder.current.stop();
    else {
      stream.current?.getTracks().forEach((track) => track.stop());
      setRecording("idle");
    }
    if (cancel) {
      setRecording("idle");
      setToast("Recording cancelled");
    }
  }
  function clearLongPress() {
    if (longPress.current) clearTimeout(longPress.current);
  }
  function pressStart(e: ReactPointerEvent, messageId: string) {
    if (e.pointerType === "mouse" || (e.target as HTMLElement).closest("button,a,audio")) return;
    clearLongPress();
    pointerStart.current = { x: e.clientX, y: e.clientY };
    longPress.current = setTimeout(() => {
      setSelected(messageId);
      navigator.vibrate?.(15);
    }, 450);
  }
  function pressMove(e: ReactPointerEvent) {
    if (Math.hypot(e.clientX - pointerStart.current.x, e.clientY - pointerStart.current.y) > 10)
      clearLongPress();
  }
  const menuMessage = messages.find((m) => m.id === popover?.messageId);
  return (
    <div className="screen msg-chat" ref={root}>
      <header className="msg-chat-header">
        <IconButton icon="back" label="Back to inbox" onClick={onBack} />
        <button
          className="msg-chat-contact"
          onClick={viewProfile}
          aria-label={`View ${contact.name}'s profile`}
        >
          <ContactAvatar contact={contact} small />
          <span>
            <strong>{contact.name}</strong>
            <small>{contact.online ? "Online now" : "Last active yesterday"}</small>
          </span>
        </button>
        <div className="msg-call-actions">
          <IconButton
            icon="video"
            label="Video call"
            onClick={() => setModal({ kind: "call", mode: "Video" })}
          />
          <IconButton
            icon="phone"
            label="Audio call"
            onClick={() => setModal({ kind: "call", mode: "Audio" })}
          />
          <IconButton
            icon="more"
            label="Conversation options"
            active={headerMenu}
            onClick={() => {
              setHeaderMenu(!headerMenu);
              setAttachmentMenu(false);
            }}
          />
        </div>
      </header>
      {headerMenu && (
        <>
          <button
            className="msg-dismiss"
            aria-label="Dismiss conversation options"
            onClick={() => setHeaderMenu(false)}
          />
          <div className="msg-header-menu msg-frost" role="menu" aria-label="Conversation options">
            <button
              role="menuitem"
              onClick={() => {
                setHeaderMenu(false);
                viewProfile();
              }}
            >
              <ChatIcon name="user" />
              View profile
            </button>
            <button
              role="menuitem"
              onClick={() => {
                setHeaderMenu(false);
                setSearchOpen(true);
              }}
            >
              <ChatIcon name="search" />
              Search messages
            </button>
            <button
              role="menuitem"
              onClick={() => {
                setHeaderMenu(false);
                setModal({ kind: "clear" });
              }}
            >
              <ChatIcon name="trash" />
              Clear messages for me
            </button>
          </div>
        </>
      )}
      {searchOpen && (
        <div className="msg-chat-search">
          <label className="msg-search">
            <ChatIcon name="search" size={17} />
            <input
              autoFocus
              placeholder="Search this conversation"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <IconButton
            icon="close"
            label="Close message search"
            onClick={() => {
              setSearchOpen(false);
              setSearch("");
            }}
          />
        </div>
      )}
      {pinned.length > 0 && (
        <button className="msg-pinned-bar" onClick={() => jump(pinned[pinned.length - 1].id)}>
          <ChatIcon name="pin" size={16} />
          <span>
            <b>Pinned message{pinned.length > 1 ? ` · ${pinned.length}` : ""}</b>
            <small>{messagePreview(pinned[pinned.length - 1])}</small>
          </span>
          <ChatIcon name="forward" size={15} />
        </button>
      )}
      <div className="msg-chat-scroll" ref={scroller} onScroll={() => popover && setPopover(null)}>
        <div className="msg-conversation-date">
          <span />
          Today, 14 March
          <span />
        </div>
        <p className="msg-prototype-note">
          <ChatIcon name="shield" size={12} />
          Session preview · no messages leave this browser
        </p>
        {loading ? (
          <div className="msg-loading" aria-label="Loading conversation" role="status">
            <span />
            <span />
            <span />
          </div>
        ) : (
          <>
            {!messages.length && (
              <EmptyState title="Start a meaningful conversation">
                Say hello to {contact.name.split(" ")[0]}. Shared experiences are a great place to
                start.
              </EmptyState>
            )}
            {messages.length > 0 && !displayedMessages.length && (
              <EmptyState title="No matching messages">
                Try a different word or close conversation search.
              </EmptyState>
            )}
            {displayedMessages.map((message) => (
              <div
                key={message.id}
                className={`msg-message-row ${message.sender === "me" ? "is-outgoing" : "is-incoming"} ${selected === message.id ? "is-selected" : ""} ${flash === message.id ? "is-flashing" : ""}`}
                ref={(el) => {
                  if (el) messageElements.current.set(message.id, el);
                  else messageElements.current.delete(message.id);
                }}
                data-message-id={message.id}
              >
                {!message.deleted && (
                  <div
                    className="msg-message-toolbar msg-frost"
                    role="toolbar"
                    aria-label="Message actions"
                  >
                    <IconButton
                      icon="react"
                      label="Add reaction"
                      onClick={() => openPopover("reactions", message)}
                    />
                    <IconButton
                      icon="reply"
                      label="Reply to message"
                      onClick={() => startReply(message)}
                    />
                    <IconButton
                      icon="more"
                      label="More message options"
                      onClick={() => openPopover("menu", message)}
                    />
                  </div>
                )}
                <div
                  className={`msg-bubble ${message.deleted ? "is-deleted" : ""}`}
                  tabIndex={0}
                  aria-label={`${message.sender === "me" ? "You" : contact.name}: ${messagePreview(message)}`}
                  onPointerDown={(e) => pressStart(e, message.id)}
                  onPointerMove={pressMove}
                  onPointerUp={clearLongPress}
                  onPointerCancel={clearLongPress}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    if (matchMedia("(pointer: coarse)").matches) setSelected(message.id);
                    else openPopover("menu", message);
                  }}
                  onKeyDown={(e) => {
                    if (e.target !== e.currentTarget) return;
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelected(selected === message.id ? null : message.id);
                    }
                    if (e.key === "F10" && e.shiftKey) {
                      e.preventDefault();
                      openPopover("menu", message);
                    }
                  }}
                >
                  {message.forwarded && (
                    <span className="msg-forwarded">
                      <ChatIcon name="forward" size={13} />
                      Forwarded
                    </span>
                  )}
                  {message.pinned && (
                    <span className="msg-forwarded">
                      <ChatIcon name="pin" size={12} />
                      Pinned
                    </span>
                  )}
                  {message.reply && (
                    <button className="msg-quote" onClick={() => jump(message.reply!.id)}>
                      <b>{message.reply.sender}</b>
                      <span>{message.reply.text}</span>
                    </button>
                  )}
                  {message.deleted ? (
                    <p className="msg-deleted-text">
                      <ChatIcon name="trash" size={15} />
                      This message was deleted
                    </p>
                  ) : (
                    <>
                      {message.opportunity ? (
                        <div className="msg-opportunity">
                          <span>
                            <ChatIcon name="briefcase" size={23} />
                          </span>
                          <div>
                            <small>SHARED OPPORTUNITY</small>
                            <strong>Senior Product Engineer</strong>
                            <p>Zoho · Chennai</p>
                          </div>
                        </div>
                      ) : (
                        message.text && <p className="msg-message-text">{message.text}</p>
                      )}
                      {message.attachment && <AttachmentView attachment={message.attachment} />}
                    </>
                  )}
                  <Receipt message={message} />
                </div>
                {message.reactions.length > 0 && (
                  <div className="msg-reaction-badges">
                    {message.reactions.map((reaction) => (
                      <button
                        className={reaction.users.includes(currentUser) ? "is-mine" : ""}
                        key={reaction.emoji}
                        onClick={() => store.react(id, message.id, reaction.emoji)}
                        aria-label={`${reaction.emoji}, ${reaction.users.length} reaction${reaction.users.length > 1 ? "s" : ""}${reaction.users.includes(currentUser) ? ", including you. Remove reaction" : ". Add your reaction"}`}
                        title={reaction.users.join(", ")}
                      >
                        <span className="msg-native-emoji">{reaction.emoji}</span>
                        <b>{reaction.users.length}</b>
                      </button>
                    ))}
                  </div>
                )}
                {message.status === "failed" && (
                  <button className="msg-send-failed" onClick={() => store.retry(id, message.id)}>
                    <ChatIcon name="retry" size={13} />
                    Not sent. Tap to retry.
                  </button>
                )}
              </div>
            ))}
          </>
        )}
      </div>
      {toast && (
        <div className="msg-toast msg-frost" role="status">
          <ChatIcon name="check" size={16} />
          {toast}
        </div>
      )}
      <div className="msg-composer">
        {recordingError && (
          <div className="msg-recording-error" role="alert">
            {recordingError}
            <button aria-label="Dismiss microphone notice" onClick={() => setRecordingError("")}>
              <ChatIcon name="close" size={15} />
            </button>
          </div>
        )}
        {(reply || editing) && (
          <div className="msg-reply-preview">
            <ChatIcon name={editing ? "edit" : "reply"} size={18} />
            <div>
              <b>
                {editing
                  ? "Editing message"
                  : `Replying to ${reply?.sender === "me" ? currentUser : contact.name}`}
              </b>
              <p>{messagePreview(editing || reply || undefined)}</p>
            </div>
            <IconButton
              icon="close"
              label={editing ? "Cancel editing" : "Cancel reply"}
              onClick={() => {
                setReply(null);
                if (editing) setDraft("");
                setEditing(null);
                setSelected(null);
              }}
            />
          </div>
        )}
        {attachmentMenu && (
          <>
            <button
              className="msg-dismiss"
              aria-label="Dismiss attachment menu"
              onClick={() => setAttachmentMenu(false)}
            />
            <div className="msg-attachment-menu msg-frost" role="menu" aria-label="Attachments">
              <button
                role="menuitem"
                onClick={() => {
                  setAttachmentMenu(false);
                  setModal({ kind: "call", mode: "Meet" });
                }}
              >
                <ChatIcon name="calendar" />
                Meet
              </button>
              <button role="menuitem" onClick={() => fileInput.current?.click()}>
                <ChatIcon name="upload" />
                Upload<small>Up to 20 MB</small>
              </button>
            </div>
          </>
        )}
        <input
          type="file"
          ref={fileInput}
          className="msg-visually-hidden"
          tabIndex={-1}
          aria-label="Upload attachment"
          onChange={(e) => {
            upload(e.target.files?.[0]);
            e.currentTarget.value = "";
          }}
        />
        <div className="msg-composer-row">
          {recording !== "idle" ? (
            <>
              <IconButton
                icon="trash"
                label="Cancel recording"
                onClick={() => stopRecording(true)}
              />
              <div className="msg-recording-state" role="status">
                <span className="msg-recording-dot" />
                <strong>
                  {recording === "requesting" ? "Requesting microphone…" : "Recording"}
                </strong>
                <span>{`${Math.floor(recordingSeconds / 60)}:${String(recordingSeconds % 60).padStart(2, "0")}`}</span>
              </div>
              <IconButton
                icon="send"
                label="Send voice message"
                disabled={recording !== "recording"}
                onClick={() => stopRecording(false)}
              />
            </>
          ) : (
            <>
              <IconButton
                icon="plus"
                label="Add attachment"
                active={attachmentMenu}
                onClick={() => {
                  setAttachmentMenu(!attachmentMenu);
                  setPopover(null);
                  setHeaderMenu(false);
                }}
              />
              <button
                className="msg-icon-button msg-gif-button"
                aria-label="Open GIF picker"
                title="GIF"
                onClick={() => setModal({ kind: "gif" })}
              >
                GIF
              </button>
              <IconButton
                icon="smile"
                label="Open emoji picker"
                onClick={() => setModal({ kind: "emoji" })}
              />
              <div className="msg-input-shell">
                <textarea
                  ref={composer}
                  rows={1}
                  value={draft}
                  placeholder="Message"
                  aria-label="Message"
                  onChange={(e) => {
                    setDraft(e.target.value);
                    e.currentTarget.style.height = "auto";
                    e.currentTarget.style.height = `${Math.min(e.currentTarget.scrollHeight, 112)}px`;
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      send();
                    }
                  }}
                />
              </div>
              <button
                className={`msg-icon-button msg-send ${draft.trim() ? "is-ready" : ""}`}
                aria-label={
                  draft.trim()
                    ? editing
                      ? "Save message"
                      : "Send message"
                    : "Record voice message"
                }
                onClick={() => (draft.trim() ? send() : startRecording())}
              >
                <ChatIcon name={draft.trim() ? "send" : "mic"} />
              </button>
            </>
          )}
        </div>
      </div>
      {popover && menuMessage && (
        <>
          <button
            className="msg-dismiss"
            aria-label="Close message actions"
            onClick={() => {
              setPopover(null);
              setSelected(null);
            }}
          />
          <div
            ref={floating}
            className={`msg-floating msg-frost ${popover.kind === "reactions" ? "msg-quick-reactions" : "msg-context-menu"}`}
            style={{ top: popover.top, left: popover.left }}
            role={popover.kind === "reactions" ? "dialog" : "menu"}
            aria-label={popover.kind === "reactions" ? "Choose a reaction" : "Message options"}
            onKeyDown={(e) => {
              const buttons = [...e.currentTarget.querySelectorAll<HTMLButtonElement>("button")];
              const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
              if (e.key === "ArrowDown" || e.key === "ArrowRight") {
                e.preventDefault();
                buttons[(index + 1) % buttons.length]?.focus();
              }
              if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
                e.preventDefault();
                buttons[(index - 1 + buttons.length) % buttons.length]?.focus();
              }
            }}
          >
            {popover.kind === "reactions" ? (
              <>
                <p className="msg-overline">ADD A REACTION</p>
                <div>
                  {quickReactions.map((emoji) => (
                    <button
                      className="msg-native-emoji"
                      key={emoji}
                      aria-label={`React ${emoji}`}
                      onClick={() => {
                        store.react(id, menuMessage.id, emoji);
                        setPopover(null);
                      }}
                    >
                      {emoji}
                    </button>
                  ))}
                  <button
                    aria-label="More emojis"
                    onClick={() => {
                      setModal({ kind: "emoji", messageId: menuMessage.id });
                      setPopover(null);
                    }}
                  >
                    <ChatIcon name="more" />
                  </button>
                </div>
              </>
            ) : (
              <>
                {!menuMessage.deleted && (
                  <>
                    <button role="menuitem" autoFocus onClick={() => startReply(menuMessage)}>
                      <ChatIcon name="reply" />
                      Reply
                    </button>
                    <button
                      role="menuitem"
                      onClick={() => {
                        setModal({ kind: "forward", messageId: menuMessage.id });
                        setRecipients([]);
                        setForwardSearch("");
                        setPopover(null);
                      }}
                    >
                      <ChatIcon name="forward" />
                      Forward
                    </button>
                    {menuMessage.sender === "me" &&
                      !menuMessage.deleted &&
                      !menuMessage.attachment && (
                        <button
                          role="menuitem"
                          onClick={() => {
                            setEditing(menuMessage);
                            setReply(null);
                            setDraft(menuMessage.text);
                            setPopover(null);
                            composer.current?.focus();
                          }}
                        >
                          <ChatIcon name="edit" />
                          Edit message
                        </button>
                      )}
                    <button role="menuitem" onClick={() => copy(menuMessage)}>
                      <ChatIcon name="copy" />
                      Copy message text
                    </button>
                    <button
                      role="menuitem"
                      onClick={() => {
                        store.pin(id, menuMessage.id);
                        setPopover(null);
                        setToast(menuMessage.pinned ? "Message unpinned" : "Message pinned");
                      }}
                    >
                      <ChatIcon name="pin" />
                      {menuMessage.pinned ? "Unpin" : "Pin"}
                    </button>
                  </>
                )}
                <button
                  role="menuitem"
                  onClick={() => {
                    setModal({ kind: "info", messageId: menuMessage.id });
                    setPopover(null);
                  }}
                >
                  <ChatIcon name="info" />
                  Info
                </button>
                <div className="msg-menu-divider" />
                <button
                  className="msg-destructive"
                  role="menuitem"
                  onClick={() => {
                    setModal({ kind: "delete", messageId: menuMessage.id, everyone: false });
                    setPopover(null);
                  }}
                >
                  <ChatIcon name="trash" />
                  Delete for me
                </button>
                {menuMessage.sender === "me" && !menuMessage.deleted && (
                  <button
                    className="msg-destructive"
                    role="menuitem"
                    onClick={() => {
                      setModal({ kind: "delete", messageId: menuMessage.id, everyone: true });
                      setPopover(null);
                    }}
                  >
                    <ChatIcon name="trash" />
                    Delete for everyone
                  </button>
                )}
              </>
            )}
          </div>
        </>
      )}
      {modal?.kind === "emoji" && (
        <Dialog
          title={modal.messageId ? "React to message" : "Choose an emoji"}
          onClose={closeModal}
          className="msg-emoji-dialog"
        >
          <EmojiPicker onSelect={addEmoji} />
        </Dialog>
      )}
      {modal?.kind === "forward" && activeMessage && (
        <Dialog title="Forward message" onClose={closeModal}>
          <div className="msg-original-preview">
            <span className="msg-overline">ORIGINAL MESSAGE</span>
            <p>{messagePreview(activeMessage)}</p>
            {activeMessage.attachment && <small>Attachment will be included.</small>}
          </div>
          <label className="msg-search">
            <ChatIcon name="search" size={17} />
            <input
              autoFocus
              placeholder="Search contacts"
              value={forwardSearch}
              onChange={(e) => setForwardSearch(e.target.value)}
            />
          </label>
          <div className="msg-recipient-list">
            {store.contacts
              .filter((c) =>
                `${c.name} ${c.company}`.toLowerCase().includes(forwardSearch.toLowerCase()),
              )
              .map((c) => (
                <button
                  aria-pressed={recipients.includes(c.id)}
                  key={c.id}
                  onClick={() =>
                    setRecipients(
                      recipients.includes(c.id)
                        ? recipients.filter((r) => r !== c.id)
                        : [...recipients, c.id],
                    )
                  }
                >
                  <ContactAvatar contact={c} small />
                  <span>
                    <strong>{c.name}</strong>
                    <small>{c.company}</small>
                  </span>
                  <i className={recipients.includes(c.id) ? "is-checked" : ""}>
                    {recipients.includes(c.id) && <ChatIcon name="check" size={15} />}
                  </i>
                </button>
              ))}
            {!store.contacts.some((c) =>
              `${c.name} ${c.company}`.toLowerCase().includes(forwardSearch.toLowerCase()),
            ) && <p className="msg-panel-note">No matching contacts.</p>}
          </div>
          <div className="msg-dialog-actions">
            <button className="msg-secondary" onClick={closeModal}>
              Cancel
            </button>
            <button
              className="msg-primary"
              disabled={!recipients.length}
              onClick={() => {
                store.forward(activeMessage, recipients);
                closeModal();
                setToast(
                  `Forwarded to ${recipients.length} conversation${recipients.length > 1 ? "s" : ""}`,
                );
              }}
            >
              Forward{recipients.length ? ` (${recipients.length})` : ""}
              <ChatIcon name="forward" size={16} />
            </button>
          </div>
        </Dialog>
      )}
      {modal?.kind === "info" && activeMessage && (
        <Dialog title="Message information" onClose={closeModal}>
          <div className="msg-original-preview">
            <p>{messagePreview(activeMessage)}</p>
          </div>
          <dl className="msg-info">
            <div>
              <dt>Sender</dt>
              <dd>{activeMessage.sender === "me" ? currentUser : contact.name}</dd>
            </div>
            <div>
              <dt>Time</dt>
              <dd>Today, {activeMessage.time}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{activeMessage.status === "seen" ? "Seen" : activeMessage.status}</dd>
            </div>
            {activeMessage.edited && (
              <div>
                <dt>Edited</dt>
                <dd>Yes</dd>
              </div>
            )}
            {activeMessage.forwarded && (
              <div>
                <dt>Forwarded</dt>
                <dd>Yes</dd>
              </div>
            )}
            <div>
              <dt>Reactions</dt>
              <dd>{activeMessage.reactions.reduce((count, r) => count + r.users.length, 0)}</dd>
            </div>
          </dl>
          <p className="msg-panel-note">
            Delivery and seen states are illustrative in this session-only prototype.
          </p>
        </Dialog>
      )}
      {modal?.kind === "delete" && (
        <Dialog
          title={modal.everyone ? "Delete for everyone?" : "Delete for you?"}
          onClose={closeModal}
        >
          <p className="msg-panel-note">
            {modal.everyone
              ? "The message content will be replaced with a deleted-message notice in this prototype conversation."
              : "This removes the message from your conversation view only. Forwarded copies are not affected."}
          </p>
          <div className="msg-dialog-actions">
            <button className="msg-secondary" onClick={closeModal}>
              Cancel
            </button>
            <button
              className="msg-primary"
              onClick={() => {
                store.remove(id, modal.messageId, !!modal.everyone);
                if (reply?.id === modal.messageId) setReply(null);
                if (editing?.id === modal.messageId) {
                  setEditing(null);
                  setDraft("");
                }
                closeModal();
                setSelected(null);
                setToast("Message deleted");
              }}
            >
              Delete message
            </button>
          </div>
        </Dialog>
      )}
      {modal?.kind === "clear" && (
        <Dialog title="Clear this conversation?" onClose={closeModal}>
          <p className="msg-panel-note">
            Remove all messages from your local session view. This does not delete messages for any
            other participant.
          </p>
          <div className="msg-dialog-actions">
            <button className="msg-secondary" onClick={closeModal}>
              Cancel
            </button>
            <button
              className="msg-primary"
              onClick={() => {
                store.clear(id);
                setReply(null);
                setEditing(null);
                setDraft("");
                closeModal();
              }}
            >
              Clear for me
            </button>
          </div>
        </Dialog>
      )}
      {modal?.kind === "copy" && (
        <Dialog title="Copy message text" onClose={closeModal}>
          <p className="msg-panel-note">
            Your browser blocked clipboard access. Select and copy the text below.
          </p>
          <textarea
            className="msg-copy-text"
            readOnly
            value={modal.text}
            onFocus={(e) => e.currentTarget.select()}
            aria-label="Message text to copy"
          />
        </Dialog>
      )}
      {modal?.kind === "call" && (
        <Dialog
          title={modal.mode === "Meet" ? "Meet preview" : `${modal.mode} call preview`}
          onClose={closeModal}
        >
          <div className="msg-call-preview">
            <ContactAvatar contact={contact} />
            <h3>{contact.name}</h3>
            <span className="msg-call-mode">
              <ChatIcon name={modal.mode === "Audio" ? "phone" : "video"} size={24} />
            </span>
            <p>
              {modal.mode === "Meet"
                ? "Meeting scheduling isn’t connected yet."
                : "No calling provider is connected."}{" "}
              This preview does not contact anyone.
            </p>
            <button className="msg-primary" onClick={closeModal}>
              {modal.mode === "Meet" ? "Close meeting preview" : "End call preview"}
            </button>
          </div>
        </Dialog>
      )}
      {modal?.kind === "gif" && (
        <Dialog title="GIFs" onClose={closeModal}>
          <label className="msg-search">
            <ChatIcon name="search" size={17} />
            <input
              autoFocus
              placeholder="Search GIFs"
              value={gifSearch}
              onChange={(e) => setGifSearch(e.target.value)}
            />
          </label>
          <EmptyState title="GIF service not connected">
            {gifSearch
              ? `Live results for “${gifSearch}” need a connected GIF provider.`
              : "GIF search is an unconnected prototype control. You can still upload a GIF from your device."}
          </EmptyState>
          <button className="msg-primary" onClick={() => fileInput.current?.click()}>
            <ChatIcon name="upload" size={18} />
            Upload a GIF or image
          </button>
        </Dialog>
      )}
    </div>
  );
}
