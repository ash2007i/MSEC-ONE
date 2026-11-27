import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  attachmentError,
  emptyEvent,
  emptyPost,
  eventErrors,
  eventFormats,
  postError,
  zonedInstant,
} from "../src/feed/creation/model.ts";

test("post validation requires text or attachments and rejects invalid schedules", () => {
  assert.ok(postError(emptyPost()));
  assert.equal(postError({ ...emptyPost(), text: "My alumni update" }), "");
  assert.equal(postError({ ...emptyPost(), files: [{ name: "image.png" }] }), "");
  assert.ok(postError({ ...emptyPost(), text: "Update", scheduledAt: "invalid" }));
  assert.ok(postError({ ...emptyPost(), text: "Update", scheduledAt: "2000-01-01T10:00" }));
  assert.equal(postError({ ...emptyPost(), text: "Update", scheduledAt: "2099-01-01T10:00" }), "");
  const first = emptyPost();
  first.collaborators.push("Test Member");
  assert.deepEqual(emptyPost().collaborators, []);
});

test("media validation rejects unsupported, empty and oversized files", () => {
  for (const type of [
    "image/jpeg",
    "image/png",
    "image/webp",
    "video/mp4",
    "video/webm",
    "application/pdf",
  ])
    assert.equal(attachmentError({ type, size: 1024 }), "");
  assert.ok(attachmentError({ type: "text/html", size: 1024 }));
  assert.ok(attachmentError({ type: "image/png", size: 0 }));
  assert.ok(attachmentError({ type: "video/mp4", size: 25 * 1024 * 1024 + 1 }));
});

const event = {
  ...emptyEvent(),
  format: "Webinar",
  name: "Alumni meetup",
  timezone: "Asia/Kolkata",
  startDate: "2099-01-15",
  startTime: "18:30",
};
test("event requires type-specific format, name, timezone and future start", () => {
  assert.deepEqual(eventErrors(event), {});
  const errors = eventErrors(emptyEvent());
  for (const key of ["format", "name", "startDate", "startTime"]) assert.ok(errors[key], key);
  assert.ok(eventErrors({ ...event, type: "In person" }).format);
  assert.ok(eventErrors({ ...event, timezone: "not-a-timezone" }).timezone);
  assert.ok(eventErrors({ ...event, startDate: "2000-01-01" }).startDate);
  assert.ok(eventErrors({ ...event, startDate: "2099-02-31" }).startTime);
  assert.ok(eventFormats.Online.includes("Webinar"));
  assert.ok(eventFormats["In person"].includes("Workshop"));
});

test("optional end date/time is validated only when enabled", () => {
  assert.deepEqual(eventErrors({ ...event, endDate: "2000-01-01", endTime: "00:00" }), {});
  assert.ok(eventErrors({ ...event, hasEnd: true }).endDate);
  assert.ok(
    eventErrors({ ...event, hasEnd: true, endDate: event.startDate, endTime: "18:00" }).endTime,
  );
  assert.deepEqual(
    eventErrors({ ...event, hasEnd: true, endDate: event.startDate, endTime: "19:30" }),
    {},
  );
});

test("event wall-clock times respect IANA zones and reject DST gaps", () => {
  assert.equal(
    zonedInstant("2030-01-01", "12:00", "Asia/Kolkata"),
    Date.parse("2030-01-01T06:30:00Z"),
  );
  assert.equal(zonedInstant("2030-01-01", "12:00", "UTC"), Date.parse("2030-01-01T12:00:00Z"));
  assert.equal(zonedInstant("2026-03-08", "02:30", "America/New_York"), null);
  assert.equal(zonedInstant("2030-02-30", "12:00", "UTC"), null);
});

test("four workflows stay separate and no creation option introduces a navigation destination", () => {
  const feed = readFileSync(new URL("../src/feed/CommunityFeed.tsx", import.meta.url), "utf8");
  for (const label of [
    "Create a Post",
    "Create an Event",
    "Find an Opportunity",
    "Write an Article",
  ])
    assert.ok(feed.includes(label));
  const routes = readFileSync(
    new URL("../src/feed/creation/FeedCreation.tsx", import.meta.url),
    "utf8",
  );
  assert.match(routes, /<PostComposer/);
  assert.match(routes, /<EventComposer/);
  assert.ok(routes.includes("Ready for your reference"));
  const eventSource = readFileSync(
    new URL("../src/feed/creation/EventComposer.tsx", import.meta.url),
    "utf8",
  );
  assert.ok(eventSource.includes("setReview(true)"));
  assert.ok(eventSource.includes("Add event preview to Feed"));
});
