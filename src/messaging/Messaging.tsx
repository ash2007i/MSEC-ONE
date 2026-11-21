import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "../backend/AuthContext";
import {
  deleteMessage,
  getConversationMessages,
  getInboxConversations,
  getOrCreateDirectConversation,
  markMessagesAsRead,
  sendMessage,
  subscribeToConversation,
  type ChatMemberProfile,
  type ChatMessage,
  type InboxConversation,
} from "../backend/messaging";
import { listAlumniDirectory, type Profile } from "../backend/profile";
import { supabase } from "../backend/supabase";
import { ChatIcon, type ChatIconName } from "./ChatIcon";
import { EmojiPicker } from "./EmojiPicker";
import "./messaging.css";

function initialsOf(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("") || "M"
  );
}

function formatMessageTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatInboxTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const sameDay =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();
  if (sameDay) return formatMessageTime(iso);
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function MemberAvatar({
  name,
  image,
  small = false,
}: {
  name: string;
  image?: string | null;
  small?: boolean;
}) {
  return (
    <span className={`msg-avatar ${small ? "msg-avatar--small" : ""}`}>
      {image ? (
        <img src={image} alt="" />
      ) : (
        <span
          aria-hidden
          style={{
            width: "100%",
            height: "100%",
            borderRadius: "50%",
            display: "grid",
            placeItems: "center",
            background: "linear-gradient(135deg, #1e3a8a, #2563eb)",
            color: "#ffffff",
            fontWeight: 700,
            fontSize: small ? 13 : 16,
          }}
        >
          {initialsOf(name)}
        </span>
      )}
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
  return (
    <div className="msg-overlay" onClick={onClose}>
      <div
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

function EmptyState({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
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
  openChat,
  renderHeader,
  onUnreadChange,
}: {
  openChat: (
    conversationId: string,
    partner?: ChatMemberProfile | null,
    title?: string | null,
  ) => void;
  renderHeader: (compose: () => void, search: () => void) => ReactNode;
  onUnreadChange?: (count: number) => void;
}) {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<InboxConversation[]>([]);
  const [directory, setDirectory] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [compose, setCompose] = useState(false);
  const [contactSearch, setContactSearch] = useState("");
  const [startingId, setStartingId] = useState<string | null>(null);
  const searchInput = useRef<HTMLInputElement>(null);

  const loadInbox = useCallback(async () => {
    try {
      const [inboxList, alumniList] = await Promise.all([
        getInboxConversations(),
        listAlumniDirectory(),
      ]);
      setConversations(inboxList);
      setDirectory(alumniList.filter((p) => p.user_id !== user?.id));
      setError(null);
      const total = inboxList.reduce((sum, item) => sum + item.unreadCount, 0);
      onUnreadChange?.(total);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not load conversations.",
      );
    } finally {
      setLoading(false);
    }
  }, [user?.id, onUnreadChange]);

  useEffect(() => {
    void loadInbox();
    const channel = supabase
      .channel(`inbox-refresh:${user?.id ?? "anon"}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        () => {
          void loadInbox();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadInbox, user?.id]);

  const totalUnread = useMemo(
    () => conversations.reduce((sum, item) => sum + item.unreadCount, 0),
    [conversations],
  );

  function partnerFor(item: InboxConversation): ChatMemberProfile | null {
    return (
      item.members.find((m) => m.user_id !== user?.id) ??
      item.members[0] ??
      null
    );
  }

  async function startDirectChat(person: Profile) {
    if (startingId) return;
    setStartingId(person.user_id);
    setError(null);
    try {
      const conversationId = await getOrCreateDirectConversation(
        person.user_id,
      );
      setCompose(false);
      openChat(conversationId, {
        user_id: person.user_id,
        full_name: person.full_name,
        avatar_url: person.avatar_url,
        headline: person.headline,
        is_verified: person.is_verified,
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not start conversation.",
      );
    } finally {
      setStartingId(null);
    }
  }

  const filteredConversations = useMemo(() => {
    const term = query.trim().toLowerCase();
    return conversations.filter((item) => {
      if (unreadOnly && item.unreadCount === 0) return false;
      if (!term) return true;
      const partner = partnerFor(item);
      const label =
        `${item.conversation.title ?? ""} ${partner?.full_name ?? ""} ${item.lastMessage?.message_text ?? ""}`.toLowerCase();
      return label.includes(term);
    });
  }, [conversations, query, unreadOnly, user?.id]);

  const filteredDirectory = useMemo(() => {
    const term = contactSearch.trim().toLowerCase();
    if (!term) return directory;
    return directory.filter((p) =>
      `${p.full_name} ${p.company ?? ""} ${p.city ?? ""}`
        .toLowerCase()
        .includes(term),
    );
  }, [directory, contactSearch]);

  return (
    <div className="screen msg-inbox">
      {renderHeader(
        () => setCompose(true),
        () => {
          window.requestAnimationFrame(() => searchInput.current?.focus());
        },
      )}
      <div className="msg-inbox-content">
        <label className="msg-search msg-frost">
          <ChatIcon name="search" size={19} />
          <input
            ref={searchInput}
            placeholder="Search conversations"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              aria-label="Clear conversation search"
            >
              <ChatIcon name="close" size={16} />
            </button>
          )}
        </label>

        {error && (
          <p
            className="msg-panel-note"
            role="alert"
            style={{ color: "#dc2626" }}
          >
            {error}
          </p>
        )}

        {directory.length > 0 && (
          <section
            className="msg-active-panel msg-frost"
            aria-label="Message alumni"
          >
            <div className="msg-section-label">
              <span className="msg-overline">START A CHAT</span>
              <button
                type="button"
                className="msg-text-button"
                onClick={() => setCompose(true)}
              >
                New <ChatIcon name="plus" size={14} />
              </button>
            </div>
            <div className="msg-active-list">
              {directory.slice(0, 8).map((person) => (
                <button
                  key={person.user_id}
                  disabled={startingId === person.user_id}
                  onClick={() => void startDirectChat(person)}
                >
                  <MemberAvatar
                    name={person.full_name}
                    image={person.avatar_url}
                  />
                  <span>{person.full_name.split(" ")[0]}</span>
                </button>
              ))}
            </div>
          </section>
        )}

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

        {loading ? (
          <div
            className="msg-loading"
            role="status"
            aria-label="Loading conversations"
          >
            <span />
            <span />
            <span />
          </div>
        ) : (
          <div className="msg-conversations">
            {filteredConversations.map((item) => {
              const partner = partnerFor(item);
              const displayName =
                item.conversation.conversation_type === "group"
                  ? item.conversation.title || "Group chat"
                  : partner?.full_name || "MSGI Member";
              const last = item.lastMessage;
              const prefix = last && last.sender_id === user?.id ? "You: " : "";
              const preview = last
                ? `${prefix}${last.message_text || "Attachment"}`
                : "No messages yet. Say hello.";

              return (
                <button
                  className={`msg-conversation msg-frost ${item.unreadCount > 0 ? "is-unread" : ""}`}
                  key={item.conversation.id}
                  onClick={() =>
                    openChat(
                      item.conversation.id,
                      partner,
                      item.conversation.title,
                    )
                  }
                >
                  <MemberAvatar
                    name={displayName}
                    image={partner?.avatar_url}
                  />
                  <span className="msg-conversation-copy">
                    <span className="msg-conversation-top">
                      <strong>{displayName}</strong>
                      <time>
                        {formatInboxTime(
                          last?.created_at ?? item.conversation.updated_at,
                        )}
                      </time>
                    </span>
                    <span className="msg-contact-company">
                      {partner?.headline || "MSGI Alumni"}
                    </span>
                    <span className="msg-conversation-preview">{preview}</span>
                  </span>
                  {item.unreadCount > 0 && (
                    <b className="msg-unread-count">{item.unreadCount}</b>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {!loading && !filteredConversations.length && (
          <EmptyState
            title={unreadOnly ? "You’re all caught up" : "No conversations yet"}
          >
            {unreadOnly
              ? "There are no unread conversations."
              : "Tap New or pick an alumnus above to start a real-time chat."}
          </EmptyState>
        )}

        <p className="msg-session-note">
          <ChatIcon name="shield" size={13} />
          Private network · Protected by Supabase Row-Level Security
        </p>
      </div>

      {compose && (
        <Dialog title="New conversation" onClose={() => setCompose(false)}>
          <label className="msg-search">
            <ChatIcon name="search" size={18} />
            <input
              autoFocus
              placeholder="Search alumni by name, company, or city"
              value={contactSearch}
              onChange={(e) => setContactSearch(e.target.value)}
            />
          </label>
          <div className="msg-recipient-list">
            {filteredDirectory.map((person) => (
              <button
                key={person.user_id}
                disabled={startingId === person.user_id}
                onClick={() => void startDirectChat(person)}
              >
                <MemberAvatar
                  name={person.full_name}
                  image={person.avatar_url}
                  small
                />
                <span>
                  <strong>{person.full_name}</strong>
                  <small>
                    {person.company || person.city || "MSGI Alumni"}
                  </small>
                </span>
                <ChatIcon name="forward" size={17} />
              </button>
            ))}
            {!filteredDirectory.length && (
              <p className="msg-panel-note">No alumni match your search.</p>
            )}
          </div>
        </Dialog>
      )}
    </div>
  );
}

export function ConversationScreen({
  conversationId,
  partner,
  title,
  onBack,
  viewProfile,
}: {
  conversationId: string;
  partner?: ChatMemberProfile | null;
  title?: string | null;
  onBack: () => void;
  viewProfile?: (userId: string) => void;
}) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [headerMenu, setHeaderMenu] = useState(false);
  const [toast, setToast] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<ChatMessage | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);

  const displayName = title || partner?.full_name || "Conversation";

  const markIncomingRead = useCallback(
    async (list: ChatMessage[]) => {
      if (!user) return;
      const incomingIds = list
        .filter((m) => m.sender_id !== user.id)
        .map((m) => m.id);
      if (incomingIds.length > 0) {
        try {
          await markMessagesAsRead(incomingIds);
        } catch (err) {
          console.error("Failed to mark messages read:", err);
        }
      }
    },
    [user],
  );

  useEffect(() => {
    let active = true;
    setLoading(true);
    getConversationMessages(conversationId, 100)
      .then((list) => {
        if (!active) return;
        setMessages(list);
        void markIncomingRead(list);
      })
      .catch((err) => {
        if (active)
          setToast(
            err instanceof Error ? err.message : "Failed to load messages.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    const unsubscribe = subscribeToConversation(conversationId, (incoming) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === incoming.id)) return prev;
        return [...prev, incoming];
      });
      if (user && incoming.sender_id !== user.id) {
        void markMessagesAsRead([incoming.id]);
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [conversationId, markIncomingRead, user]);

  useEffect(() => {
    if (!loading) {
      scroller.current?.scrollTo({
        top: scroller.current.scrollHeight,
        behavior: "auto",
      });
    }
  }, [messages.length, loading]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  const displayedMessages = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return messages;
    return messages.filter((m) =>
      (m.message_text ?? "").toLowerCase().includes(term),
    );
  }, [messages, search]);

  async function handleSend() {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setDraft("");
    if (composer.current) composer.current.style.height = "auto";
    try {
      const created = await sendMessage(conversationId, text);
      setMessages((prev) =>
        prev.some((m) => m.id === created.id) ? prev : [...prev, created],
      );
    } catch (err) {
      setDraft(text);
      setToast(
        err instanceof Error ? err.message : "Message could not be sent.",
      );
    } finally {
      setSending(false);
      composer.current?.focus();
    }
  }

  async function handleDelete(msg: ChatMessage) {
    try {
      await deleteMessage(msg.id);
      setMessages((prev) => prev.filter((m) => m.id !== msg.id));
      setDeleteTarget(null);
      setToast("Message deleted");
    } catch (err) {
      setToast(
        err instanceof Error ? err.message : "Could not delete message.",
      );
    }
  }

  async function handleCopy(text: string) {
    try {
      await navigator.clipboard?.writeText(text);
      setToast("Message copied");
    } catch {
      setToast("Clipboard unavailable");
    }
  }

  function insertEmoji(emoji: string) {
    const start = composer.current?.selectionStart ?? draft.length;
    const end = composer.current?.selectionEnd ?? start;
    setDraft(draft.slice(0, start) + emoji + draft.slice(end));
    setEmojiOpen(false);
    requestAnimationFrame(() => composer.current?.focus());
  }

  return (
    <div className="screen msg-chat">
      <header className="msg-chat-header">
        <IconButton icon="back" label="Back to inbox" onClick={onBack} />
        <button
          className="msg-chat-contact"
          onClick={() => partner && viewProfile?.(partner.user_id)}
          aria-label={`View ${displayName}'s profile`}
        >
          <MemberAvatar name={displayName} image={partner?.avatar_url} small />
          <span>
            <strong>{displayName}</strong>
            <small>{partner?.headline || "MSGI One · Realtime"}</small>
          </span>
        </button>
        <div className="msg-call-actions">
          <IconButton
            icon="search"
            label="Search messages"
            active={searchOpen}
            onClick={() => setSearchOpen((v) => !v)}
          />
          <IconButton
            icon="more"
            label="Conversation options"
            active={headerMenu}
            onClick={() => setHeaderMenu((v) => !v)}
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
          <div
            className="msg-header-menu msg-frost"
            role="menu"
            aria-label="Conversation options"
          >
            {partner && viewProfile && (
              <button
                role="menuitem"
                onClick={() => {
                  setHeaderMenu(false);
                  viewProfile(partner.user_id);
                }}
              >
                <ChatIcon name="user" />
                View profile
              </button>
            )}
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

      <div className="msg-chat-scroll" ref={scroller}>
        <p className="msg-prototype-note">
          <ChatIcon name="shield" size={12} />
          Live Supabase Realtime chat
        </p>

        {loading ? (
          <div
            className="msg-loading"
            aria-label="Loading conversation"
            role="status"
          >
            <span />
            <span />
            <span />
          </div>
        ) : (
          <>
            {!messages.length && (
              <EmptyState title="Start the conversation">
                Send your first message to {displayName.split(" ")[0]}.
              </EmptyState>
            )}
            {messages.length > 0 && !displayedMessages.length && (
              <EmptyState title="No matching messages">
                Try another keyword or close search.
              </EmptyState>
            )}
            {displayedMessages.map((msg) => {
              const mine = msg.sender_id === user?.id;
              return (
                <div
                  key={msg.id}
                  className={`msg-message-row ${mine ? "is-outgoing" : "is-incoming"}`}
                >
                  <div
                    className="msg-message-toolbar msg-frost"
                    role="toolbar"
                    aria-label="Actions"
                  >
                    {msg.message_text && (
                      <IconButton
                        icon="copy"
                        label="Copy message"
                        onClick={() => void handleCopy(msg.message_text ?? "")}
                      />
                    )}
                    {mine && (
                      <IconButton
                        icon="trash"
                        label="Delete message"
                        onClick={() => setDeleteTarget(msg)}
                      />
                    )}
                  </div>
                  <div className="msg-bubble">
                    {msg.message_text && (
                      <p className="msg-message-text">{msg.message_text}</p>
                    )}
                    <span className="msg-receipt msg-receipt--sent">
                      <time>{formatMessageTime(msg.created_at)}</time>
                      {mine && <ChatIcon name="checks" size={13} />}
                    </span>
                  </div>
                </div>
              );
            })}
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
        <div className="msg-composer-row">
          <IconButton
            icon="smile"
            label="Open emoji picker"
            onClick={() => setEmojiOpen(true)}
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
                if (
                  e.key === "Enter" &&
                  !e.shiftKey &&
                  !e.nativeEvent.isComposing
                ) {
                  e.preventDefault();
                  void handleSend();
                }
              }}
            />
          </div>
          <button
            type="button"
            className={`msg-icon-button msg-send ${draft.trim() ? "is-ready" : ""}`}
            aria-label="Send message"
            disabled={!draft.trim() || sending}
            onClick={() => void handleSend()}
          >
            <ChatIcon name="send" />
          </button>
        </div>
      </div>

      {emojiOpen && (
        <Dialog
          title="Choose an emoji"
          onClose={() => setEmojiOpen(false)}
          className="msg-emoji-dialog"
        >
          <EmojiPicker onSelect={insertEmoji} />
        </Dialog>
      )}

      {deleteTarget && (
        <Dialog title="Delete message?" onClose={() => setDeleteTarget(null)}>
          <p className="msg-panel-note">
            This permanently deletes the message for everyone in this
            conversation.
          </p>
          <div className="msg-dialog-actions">
            <button
              className="msg-secondary"
              onClick={() => setDeleteTarget(null)}
            >
              Cancel
            </button>
            <button
              className="msg-primary"
              onClick={() => void handleDelete(deleteTarget)}
            >
              Delete
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
