import test from "node:test";
import assert from "node:assert/strict";
import { createMessagingStore, currentUser } from "../src/messaging/model.ts";

let online = true;
Object.defineProperty(globalThis, "navigator", {
  configurable: true,
  value: {
    get onLine() {
      return online;
    },
  },
});
const contacts = [
  {
    id: 1,
    name: "Priya Raman",
    company: "Zoho",
    role: "Software Engineer",
    image: "",
    preview: "I can introduce you to our hiring team.",
    time: "10:32",
    unread: 2,
    online: true,
  },
  {
    id: 2,
    name: "Karthik Raj",
    company: "Royal Enfield",
    role: "Program Manager",
    image: "",
    preview: "Shared an event: Chennai Alumni Circle",
    time: "09:15",
    unread: 0,
    online: true,
  },
];
const make = (t) => {
  const store = createMessagingStore(contacts);
  t.after(() => store.dispose());
  return store;
};

test("message ownership gates editing and deleting for everyone", (t) => {
  const store = make(t);
  store.edit(1, "initial-1-1", "not permitted");
  assert.notEqual(store.getSnapshot().threads[1][0].text, "not permitted");
  store.remove(1, "initial-1-1", true);
  assert.equal(store.getSnapshot().threads[1][0].deleted, undefined);
  store.edit(1, "initial-1-3", "Updated text");
  assert.equal(store.getSnapshot().threads[1][2].edited, true);
  store.remove(1, "initial-1-3", true);
  assert.equal(store.getSnapshot().threads[1][2].deleted, true);
  assert.equal(store.getSnapshot().threads[1][2].text, "");
});
test("reactions preserve other participants while changing or removing your reaction", (t) => {
  const store = make(t);
  store.react(1, "initial-1-3", "❤️");
  assert.equal(store.getSnapshot().threads[1][2].reactions[0].users.length, 2);
  store.react(1, "initial-1-3", "👍");
  let reactions = store.getSnapshot().threads[1][2].reactions;
  assert.deepEqual(reactions.find((r) => r.emoji === "❤️").users, ["Priya Raman"]);
  assert.deepEqual(reactions.find((r) => r.emoji === "👍").users, [currentUser]);
  store.react(1, "initial-1-3", "👍");
  reactions = store.getSnapshot().threads[1][2].reactions;
  assert.equal(reactions.length, 1);
});
test("forwarding preserves content and attachments without mutating the source", (t) => {
  const store = make(t);
  const attachment = { name: "notes.txt", url: "blob:local-test", type: "text/plain", size: 20 };
  const id = store.send(1, { text: "Notes from our conversation", attachment });
  const source = store.getSnapshot().threads[1].find((m) => m.id === id);
  store.forward(source, [2]);
  const forwarded = store.getSnapshot().threads[2].at(-1);
  assert.equal(forwarded.forwarded, true);
  assert.equal(forwarded.text, source.text);
  assert.deepEqual(forwarded.attachment, attachment);
  store.remove(1, id, false);
  assert.equal(
    store.getSnapshot().threads[1].some((m) => m.id === id),
    false,
  );
  assert.equal(store.getSnapshot().threads[2].at(-1).text, source.text);
  const opportunity = store.getSnapshot().threads[1].find((m) => m.opportunity);
  store.forward(opportunity, [2]);
  assert.equal(store.getSnapshot().threads[2].at(-1).opportunity, true);
});
test("quotes, pins, read counts, empty threads and observable updates", (t) => {
  const store = make(t);
  let updates = 0;
  const unsubscribe = store.subscribe(() => updates++);
  const original = store.getSnapshot().threads[1][0];
  const quote = { id: original.id, sender: "Priya Raman", text: original.text };
  const id = store.send(1, { text: "Thank you", reply: quote });
  assert.deepEqual(store.getSnapshot().threads[1].at(-1).reply, quote);
  store.pin(1, id);
  assert.equal(store.getSnapshot().threads[1].at(-1).pinned, true);
  store.pin(1, id);
  assert.equal(store.getSnapshot().threads[1].at(-1).pinned, false);
  store.markRead(1);
  assert.equal(store.getSnapshot().unread[1], 0);
  store.clear(1);
  assert.deepEqual(store.getSnapshot().threads[1], []);
  assert.ok(updates >= 5);
  unsubscribe();
});
test("offline sends fail and can be retried through sent, delivered and seen states", async (t) => {
  const store = make(t);
  online = false;
  const id = store.send(1, { text: "Retry me" });
  assert.equal(store.getSnapshot().threads[1].at(-1).status, "failed");
  online = true;
  store.retry(1, id);
  assert.equal(store.getSnapshot().threads[1].at(-1).status, "sending");
  await new Promise((resolve) => setTimeout(resolve, 1650));
  assert.equal(store.getSnapshot().threads[1].at(-1).status, "seen");
});
