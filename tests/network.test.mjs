import test from "node:test";
import assert from "node:assert/strict";
import {
  emailError,
  filterNotifications,
  markNotificationsRead,
  notificationPresentation,
  parseResetLink,
  passwordRules,
  resetErrors,
  supportErrors,
  validateNotifications,
} from "../src/network/model.ts";
import {
  issueCategories,
  notificationCategories,
  requireAcknowledgement,
  requireService,
  requireSupportReceipt,
  ServiceUnavailableError,
} from "../src/network/services.ts";

const support = {
  fullName: "Aarav Kumar",
  email: "aarav@example.com",
  category: "Account and Login",
  subject: "Cannot access my profile",
  description: "When I open my profile I see an error instead of my account details.",
  attachment: null,
};
const notifications = Object.keys(notificationPresentation).map((kind, index) => ({
  id: `test-${index}`,
  kind,
  actor: { name: "Test Member" },
  createdAt: "2026-03-14T09:30:00Z",
  read: index === 0,
}));

test("email validation rejects empty, malformed and excessively long addresses", () => {
  for (const email of ["", " ", "name@", "name@host", "not an email", `${"a".repeat(255)}@x.com`])
    assert.ok(emailError(email), email);
  assert.equal(emailError("  name@example.com  "), undefined);
});

test("reset passwords require length, letters, numbers and matching confirmation", () => {
  assert.deepEqual(passwordRules("Alumni2026", "Alumni2026"), {
    length: true,
    mix: true,
    match: true,
  });
  assert.ok(resetErrors("", "").password);
  assert.ok(resetErrors("short1", "short1").password);
  assert.ok(resetErrors("onlyletters", "onlyletters").password);
  assert.ok(resetErrors("123456789", "123456789").password);
  assert.ok(resetErrors("Alumni2026", "").confirm);
  assert.ok(resetErrors("Alumni2026", "Different1").confirm);
  assert.ok(resetErrors(`${"a".repeat(128)}1`, "").password);
  assert.deepEqual(resetErrors("Alumni2026", "Alumni2026"), {
    password: undefined,
    confirm: undefined,
  });
});

test("reset links only request verification, never establish token validity", () => {
  assert.deepEqual(parseResetLink(""), { requested: false, token: null });
  assert.deepEqual(parseResetLink("#/reset-password"), { requested: true, token: null });
  assert.deepEqual(parseResetLink("#/reset-password?token=opaque%2Btoken"), {
    requested: true,
    token: "opaque+token",
  });
  assert.deepEqual(parseResetLink("#/profile?token=wrong-route"), {
    requested: false,
    token: null,
  });
});

test("support validates all required fields and supports every requested category", () => {
  assert.deepEqual(supportErrors(support), {});
  for (const category of issueCategories)
    assert.deepEqual(supportErrors({ ...support, category }), {});
  const errors = supportErrors({
    fullName: " ",
    email: "",
    category: "",
    subject: "",
    description: "",
    attachment: null,
  });
  assert.deepEqual(Object.keys(errors).sort(), [
    "category",
    "description",
    "email",
    "fullName",
    "subject",
  ]);
  assert.ok(supportErrors({ ...support, category: "invalid" }).category);
  assert.ok(supportErrors({ ...support, subject: "a".repeat(121) }).subject);
  assert.ok(supportErrors({ ...support, description: "Too short" }).description);
  assert.ok(supportErrors({ ...support, description: "a".repeat(5001) }).description);
  assert.deepEqual(supportErrors({ ...support, description: "a".repeat(5000) }), {});
});

test("support attachments enforce file types and the 5 MB limit", () => {
  for (const type of ["image/png", "image/jpeg", "application/pdf"])
    assert.deepEqual(supportErrors({ ...support, attachment: { type, size: 1024 } }), {});
  assert.ok(supportErrors({ ...support, attachment: { type: "text/html", size: 100 } }).attachment);
  assert.ok(
    supportErrors({
      ...support,
      attachment: { type: "image/png", size: 5 * 1024 * 1024 + 1 },
    }).attachment,
  );
});

test("missing services and unconfirmed responses can never produce success receipts", () => {
  assert.throws(() => requireService(undefined, "Not connected"), ServiceUnavailableError);
  for (const value of [undefined, null, false, 1, "true"])
    assert.throws(() => requireAcknowledgement(value));
  assert.doesNotThrow(() => requireAcknowledgement(true));
  assert.throws(() => requireSupportReceipt({ saved: false, reference: "not-saved" }));
  assert.throws(() => requireSupportReceipt({ saved: true, reference: " " }));
  assert.throws(() => requireSupportReceipt(undefined));
  assert.equal(requireSupportReceipt({ saved: true, reference: " SERVER-123 " }), "SERVER-123");
});

test("all eight notification types map to the six requested filters", () => {
  assert.equal(notifications.length, 8);
  assert.deepEqual(notificationCategories, [
    "All",
    "Connections",
    "Messages",
    "Feed",
    "Opportunities",
    "Events",
  ]);
  assert.equal(filterNotifications(notifications, "All").length, 8);
  assert.equal(filterNotifications(notifications, "Connections").length, 2);
  assert.equal(filterNotifications(notifications, "Messages").length, 1);
  assert.equal(filterNotifications(notifications, "Feed").length, 3);
  assert.equal(filterNotifications(notifications, "Opportunities").length, 1);
  assert.equal(filterNotifications(notifications, "Events").length, 1);
  assert.deepEqual(filterNotifications([], "All"), []);
});

test("mark-as-read changes only selected IDs without mutating records", () => {
  const next = markNotificationsRead(notifications, ["test-1", "test-2"]);
  assert.equal(notifications[1].read, false);
  assert.equal(next[1].read, true);
  assert.equal(next[2].read, true);
  assert.equal(next[3].read, false);
  assert.ok(
    markNotificationsRead(
      notifications,
      notifications.map(({ id }) => id),
    ).every(({ read }) => read),
  );
});

test("notification responses reject malformed data, duplicate IDs and invalid destinations", () => {
  assert.deepEqual(validateNotifications(notifications), notifications);
  for (const value of [
    null,
    {},
    [{ ...notifications[0], kind: "unknown" }],
    [{ ...notifications[0], createdAt: "invalid-date" }],
    [{ ...notifications[0], actor: null }],
    [notifications[0], notifications[0]],
    [{ ...notifications[0], target: { type: "external", id: "https://example.com" } }],
    [{ ...notifications[0], target: { type: "profile", id: -1 } }],
    [{ ...notifications[0], target: { type: "feed", id: "" } }],
  ])
    assert.throws(() => validateNotifications(value));
  for (const target of [
    { type: "profile", id: 1 },
    { type: "message", id: 1 },
    { type: "feed", id: "post" },
    { type: "opportunity", id: "job" },
    { type: "event", id: "gathering" },
  ])
    assert.doesNotThrow(() => validateNotifications([{ ...notifications[0], target }]));
});
