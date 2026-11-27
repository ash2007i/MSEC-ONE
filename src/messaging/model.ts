export type Contact = {
  id: number;
  name: string;
  company: string;
  role: string;
  image: string;
  preview: string;
  time: string;
  unread: number;
  online: boolean;
};

export type Delivery = "sending" | "sent" | "delivered" | "seen" | "failed";
export type Attachment = { name: string; url: string; type: string; size: number };
export type Quote = { id: string; sender: string; text: string };
export type Message = {
  id: string;
  sender: "me" | "contact";
  text: string;
  time: string;
  status: Delivery;
  reactions: { emoji: string; users: string[] }[];
  reply?: Quote;
  attachment?: Attachment;
  forwarded?: boolean;
  edited?: boolean;
  pinned?: boolean;
  deleted?: boolean;
  opportunity?: boolean;
};
type Snapshot = { threads: Record<number, Message[]>; unread: Record<number, number> };
export const currentUser = "Aarav Kumar";
let sequence = 0;
const nextId = () => `message-${Date.now()}-${++sequence}`;
const now = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

/** Session-only prototype store. An API adapter can replace these operations later. */
export function createMessagingStore(contacts: Contact[]) {
  const listeners = new Set<() => void>();
  const resources = new Set<string>();
  const timers = new Set<ReturnType<typeof setTimeout>>();
  let snapshot: Snapshot = {
    threads: Object.fromEntries(
      contacts.map((c) => [
        c.id,
        [
          {
            id: `initial-${c.id}-1`,
            sender: "contact",
            text: "Hi Aarav, I saw your note about product roles in Chennai.",
            time: "10:28",
            status: "seen",
            reactions: [],
          },
          {
            id: `initial-${c.id}-2`,
            sender: "me",
            text: `Hi ${c.name.split(" ")[0]}! Yes, I’m exploring opportunities in B2B software.`,
            time: "10:30",
            status: "seen",
            reactions: [],
          },
          {
            id: `initial-${c.id}-3`,
            sender: "me",
            text: "That would be wonderful, thank you!",
            time: "10:31",
            status: "seen",
            reactions: [{ emoji: "❤️", users: [c.name] }],
          },
          {
            id: `initial-${c.id}-4`,
            sender: "contact",
            text:
              c.id === 1
                ? "I can introduce you to our hiring team."
                : c.preview.replace(/^You: /, ""),
            time: c.time,
            status: "seen",
            reactions: [],
          },
          ...(c.id === 1
            ? [
                {
                  id: "opportunity-1",
                  sender: "contact",
                  text: "Senior Product Engineer",
                  time: "10:32",
                  status: "seen",
                  reactions: [],
                  opportunity: true,
                },
              ]
            : []),
        ],
      ]),
    ),
    unread: Object.fromEntries(contacts.map((c) => [c.id, c.unread])),
  } as Snapshot;
  const publish = (next: Snapshot) => {
    snapshot = next;
    listeners.forEach((fn) => fn());
  };
  const updateThread = (id: number, fn: (messages: Message[]) => Message[]) =>
    publish({
      ...snapshot,
      threads: { ...snapshot.threads, [id]: fn(snapshot.threads[id] || []) },
    });
  const update = (id: number, messageId: string, patch: Partial<Message>) =>
    updateThread(id, (messages) =>
      messages.map((m) => (m.id === messageId ? { ...m, ...patch } : m)),
    );
  const later = (fn: () => void, ms: number) => {
    const timer = setTimeout(() => {
      timers.delete(timer);
      fn();
    }, ms);
    timers.add(timer);
  };
  function deliver(id: number, messageId: string) {
    if (!navigator.onLine) {
      update(id, messageId, { status: "failed" });
      return;
    }
    update(id, messageId, { status: "sending" });
    later(() => update(id, messageId, { status: navigator.onLine ? "sent" : "failed" }), 300);
    later(() => {
      const m = snapshot.threads[id]?.find((m) => m.id === messageId);
      if (m?.status === "sent") update(id, messageId, { status: "delivered" });
    }, 750);
    later(() => {
      const m = snapshot.threads[id]?.find((m) => m.id === messageId);
      if (m?.status === "delivered" && contacts.find((c) => c.id === id)?.online)
        update(id, messageId, { status: "seen" });
    }, 1500);
  }
  function send(
    id: number,
    payload: Pick<Message, "text"> &
      Partial<Pick<Message, "reply" | "attachment" | "forwarded" | "opportunity">>,
  ) {
    const message: Message = {
      id: nextId(),
      sender: "me",
      time: now(),
      reactions: [],
      status: "sending",
      ...payload,
    };
    updateThread(id, (messages) => [...messages, message]);
    deliver(id, message.id);
    return message.id;
  }
  return {
    contacts,
    subscribe(fn: () => void) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    getSnapshot: () => snapshot,
    send,
    retry: deliver,
    markRead(id: number) {
      if (snapshot.unread[id]) publish({ ...snapshot, unread: { ...snapshot.unread, [id]: 0 } });
    },
    edit(id: number, messageId: string, text: string) {
      const m = snapshot.threads[id]?.find((m) => m.id === messageId);
      if (m?.sender === "me" && !m.deleted && text.trim())
        update(id, messageId, { text: text.trim(), edited: true });
    },
    react(id: number, messageId: string, emoji: string) {
      updateThread(id, (messages) =>
        messages.map((m) => {
          if (m.id !== messageId || m.deleted) return m;
          const existing = m.reactions.find((r) => r.emoji === emoji);
          const hadReaction = existing?.users.includes(currentUser);
          const reactions = m.reactions
            .map((r) => ({ ...r, users: r.users.filter((u) => u !== currentUser) }))
            .filter((r) => r.users.length);
          if (!hadReaction) {
            const target = reactions.find((r) => r.emoji === emoji);
            if (target) target.users.push(currentUser);
            else reactions.push({ emoji, users: [currentUser] });
          }
          return { ...m, reactions };
        }),
      );
    },
    pin(id: number, messageId: string) {
      const m = snapshot.threads[id]?.find((m) => m.id === messageId);
      if (m && !m.deleted) update(id, messageId, { pinned: !m.pinned });
    },
    remove(id: number, messageId: string, everyone: boolean) {
      const m = snapshot.threads[id]?.find((m) => m.id === messageId);
      if (!m || (everyone && m.sender !== "me")) return;
      if (everyone)
        update(id, messageId, {
          text: "",
          deleted: true,
          pinned: false,
          reactions: [],
          attachment: undefined,
          opportunity: false,
          reply: undefined,
        });
      else updateThread(id, (messages) => messages.filter((m) => m.id !== messageId));
    },
    clear(id: number) {
      updateThread(id, () => []);
    },
    forward(message: Message, recipients: number[]) {
      if (message.deleted) return;
      recipients.forEach((id) =>
        send(id, {
          text: message.text,
          attachment: message.attachment,
          opportunity: message.opportunity,
          forwarded: true,
        }),
      );
    },
    objectURL(blob: Blob) {
      const url = URL.createObjectURL(blob);
      resources.add(url);
      return url;
    },
    dispose() {
      timers.forEach(clearTimeout);
      resources.forEach((url) => URL.revokeObjectURL(url));
      timers.clear();
      resources.clear();
      listeners.clear();
    },
  };
}
export type MessagingStore = ReturnType<typeof createMessagingStore>;
export function messagePreview(message?: Message) {
  if (!message) return "No messages yet. Start a conversation.";
  if (message.deleted) return "Message deleted";
  if (message.attachment?.type.startsWith("audio/")) return "Voice message";
  return message.text || message.attachment?.name || "Attachment";
}
