import test from "node:test";
import assert from "node:assert/strict";
import {
  buildProfileShareUrl,
  checkPassword,
  clearStoredSettings,
  createDefaultSettings,
  createSampleAccount,
  getNotificationDecision,
  isWithinQuietHours,
  loadSettings,
  nextQuietHoursChange,
  parseSharedProfileId,
  resolveTheme,
  saveSettings,
  settingsStorageKey,
  validateAttachment,
  validateFullName,
  validatePhone,
  validateQuietHours,
  validateSupportRequest,
} from "../src/settings/model.ts";
import { createTranslator } from "../src/settings/i18n.ts";

function memoryStorage() {
  const items = new Map();
  return {
    getItem: (key) => (items.has(key) ? items.get(key) : null),
    setItem: (key, value) => items.set(key, String(value)),
    removeItem: (key) => items.delete(key),
    items,
  };
}

// Monday 6 January 2025, local time.
const at = (day, hours, minutes = 0) => new Date(2025, 0, 6 + day, hours, minutes);

test("persists settings per account and restores them after reload", () => {
  const storage = memoryStorage();
  const account = createSampleAccount();
  const settings = createDefaultSettings(account);
  settings.appearance.theme = "dark";
  settings.language = "ta";
  settings.account.fullName = "Aarav K";
  settings.security.sessions.unshift({
    id: "session-current",
    device: "Chrome on macOS",
    type: "laptop",
    location: "Chennai",
    lastActive: new Date().toISOString(),
    current: true,
  });
  assert.equal(saveSettings(settings, storage), true);

  const stored = JSON.parse(storage.getItem(settingsStorageKey(account.id)));
  assert.equal(stored.security.sessions.some((session) => session.current), false);

  const restored = loadSettings(account, storage);
  assert.equal(restored.appearance.theme, "dark");
  assert.equal(restored.language, "ta");
  assert.equal(restored.account.fullName, "Aarav K");
  assert.equal(loadSettings({ ...account, id: 200 }, storage).language, "en");

  clearStoredSettings(account.id, storage);
  assert.equal(loadSettings(account, storage).appearance.theme, "system");
});

test("rejects malformed stored values and keeps institution-verified fields locked", () => {
  const storage = memoryStorage();
  const account = createSampleAccount();
  storage.setItem(
    settingsStorageKey(account.id),
    JSON.stringify({
      appearance: { theme: "neon", textSize: "huge", reduceMotion: "yes" },
      language: "fr",
      account: { department: "Edited", graduationYear: "1999", fullName: "Aarav Kumar" },
      community: { industries: ["saas", "invented"] },
      notifications: { quietHours: { days: [1, 9, "2", 3] } },
    }),
  );
  const settings = loadSettings(account, storage);
  assert.equal(settings.appearance.theme, "system");
  assert.equal(settings.appearance.textSize, "default");
  assert.equal(settings.appearance.reduceMotion, false);
  assert.equal(settings.language, "en");
  assert.equal(settings.account.department, account.department);
  assert.equal(settings.account.graduationYear, account.graduationYear);
  assert.deepEqual(settings.community.industries, ["saas"]);
  assert.deepEqual(settings.notifications.quietHours.days, [1, 3]);

  storage.setItem(settingsStorageKey(account.id), "{not json");
  assert.equal(loadSettings(account, storage).language, "en");
});

test("resolves Light, Dark and System Default themes", () => {
  assert.equal(resolveTheme("light", true), "light");
  assert.equal(resolveTheme("dark", false), "dark");
  assert.equal(resolveTheme("system", true), "dark");
  assert.equal(resolveTheme("system", false), "light");
});

test("applies overnight Do Not Disturb schedules by start day", () => {
  const quiet = { enabled: true, start: "22:00", end: "07:00", days: [1] };
  assert.equal(isWithinQuietHours(quiet, at(0, 23)), true);
  assert.equal(isWithinQuietHours(quiet, at(1, 6, 59)), true);
  assert.equal(isWithinQuietHours(quiet, at(1, 7)), false);
  assert.equal(isWithinQuietHours(quiet, at(1, 23)), false);
  assert.equal(isWithinQuietHours({ ...quiet, enabled: false }, at(0, 23)), false);

  assert.deepEqual(nextQuietHoursChange(quiet, at(0, 23)), at(1, 7));
  assert.deepEqual(nextQuietHoursChange(quiet, at(1, 12)), at(7, 22));
  assert.equal(validateQuietHours({ ...quiet, end: "22:00" }), "sameTime");
  assert.equal(validateQuietHours({ ...quiet, days: [] }), "noDays");
  assert.equal(nextQuietHoursChange({ ...quiet, days: [] }, at(0, 12)), null);
});

test("notification decisions respect the master switch, categories, channels and quiet hours", () => {
  const settings = createDefaultSettings().notifications;
  const paused = { ...settings, enabled: false };
  assert.deepEqual(getNotificationDecision(paused, "newMessages", at(0, 12)), {
    deliver: false,
    reason: "paused",
  });
  assert.equal(paused.categories.newMessages, true, "pausing keeps category choices");

  assert.equal(
    getNotificationDecision(
      { ...settings, categories: { ...settings.categories, newMessages: false } },
      "newMessages",
      at(0, 12),
    ).reason,
    "categoryOff",
  );
  assert.deepEqual(getNotificationDecision({ ...settings, email: false }, "newMessages", at(0, 12)), {
    deliver: true,
    channels: ["push", "inApp"],
  });

  const quiet = { ...settings, quietHours: { enabled: true, start: "22:00", end: "07:00", days: [1] } };
  const decision = getNotificationDecision(quiet, "newMessages", at(0, 23));
  assert.equal(decision.reason, "quietHours");
  assert.deepEqual(decision.until, at(1, 7));
});

test("validates account, password and support input", () => {
  assert.equal(validateFullName("  "), "required");
  assert.equal(validateFullName("A1"), "nameFormat");
  assert.equal(validateFullName("Aarav O'Neil-Kumar"), null);
  assert.equal(validatePhone("+91 98765 43210", "+91 98765 43210"), "phoneSame");
  assert.equal(validatePhone("12345"), "phone");
  assert.equal(checkPassword("old-pass1", "newpass12", "newpass12").valid, true);
  assert.equal(checkPassword("same1234", "same1234", "same1234").rules.different, false);

  assert.equal(validateAttachment({ type: "image/gif", size: 10 }), "attachmentType");
  assert.equal(validateAttachment({ type: "application/pdf", size: 5 * 1024 * 1024 + 1 }), "attachmentSize");
  assert.equal(validateAttachment({ type: "image/png", size: 5 * 1024 * 1024 }), null);
  assert.deepEqual(
    validateSupportRequest({ subject: "Hi", category: "nope", description: "short" }),
    { subject: "subjectLength", category: "required", description: "descriptionShort" },
  );
});

test("builds unique profile links that deep-link back to the member", () => {
  const url = buildProfileShareUrl(
    { id: 100, fullName: "Aarav Kumar" },
    "https://alumni.example/app/?alumni=old#top",
  );
  assert.equal(url, "https://alumni.example/app/?alumni=aarav-kumar-100");
  assert.equal(parseSharedProfileId(new URL(url).search), 100);
  assert.equal(parseSharedProfileId("?alumni=priya-raman-1"), 1);
  assert.equal(parseSharedProfileId("?alumni=not-a-profile"), null);
  assert.equal(parseSharedProfileId(""), null);
});

test("English and Tamil share one complete translation map", () => {
  const en = createTranslator("en");
  const ta = createTranslator("ta");
  for (const key of ["nav.home", "nav.profile", "settings.title", "logout.description"])
    assert.notEqual(ta(key), en(key), key);
  assert.equal(en("logout.description"), "Are you sure you want to log out of your MSGI One account?");
  assert.equal(en("account.classOf", { year: 2020 }), "Class of 2020");
});
