export type CreationKind = "post" | "event" | "opportunity" | "article";
export type PostDraft = {
  text: string;
  audience: string;
  comments: string;
  collaborators: string[];
  partnership: boolean;
  scheduledAt: string;
  files: File[];
};
export const emptyPost = (): PostDraft => ({
  text: "",
  audience: "Anyone",
  comments: "Anyone",
  collaborators: [],
  partnership: false,
  scheduledAt: "",
  files: [],
});
export const eventFormats = {
  Online: ["Live stream", "Webinar", "Online meeting"],
  "In person": ["Conference", "Meetup", "Workshop", "Networking"],
};
export type EventDraft = {
  type: keyof typeof eventFormats;
  format: string;
  name: string;
  timezone: string;
  startDate: string;
  startTime: string;
  hasEnd: boolean;
  endDate: string;
  endTime: string;
  description: string;
  cover: File | null;
};
export const localTimezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
export const emptyEvent = (): EventDraft => ({
  type: "Online",
  format: "",
  name: "",
  timezone: localTimezone(),
  startDate: "",
  startTime: "",
  hasEnd: false,
  endDate: "",
  endTime: "",
  description: "",
  cover: null,
});

const dateParts = (date: string, time: string) => {
  const value = new Date(`${date}T${time}:00Z`);
  if (!Number.isFinite(value.getTime()) || value.toISOString().slice(0, 16) !== `${date}T${time}`)
    return null;
  return value;
};
/** Convert wall-clock input in the selected IANA timezone, rejecting nonexistent DST times. */
export function zonedInstant(date: string, time: string, timezone: string): number | null {
  const target = dateParts(date, time);
  if (!target) return null;
  try {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    let result = target.getTime();
    for (let attempt = 0; attempt < 4; attempt++) {
      const parts = Object.fromEntries(
        formatter.formatToParts(new Date(result)).map((p) => [p.type, p.value]),
      );
      const rendered = Date.UTC(
        +parts.year,
        +parts.month - 1,
        +parts.day,
        +parts.hour,
        +parts.minute,
      );
      const delta = target.getTime() - rendered;
      if (!delta) return result;
      result += delta;
    }
    return null;
  } catch {
    return null;
  }
}
export function eventErrors(draft: EventDraft, now = Date.now()) {
  const errors: Partial<Record<keyof EventDraft, string>> = {};
  if (!eventFormats[draft.type].includes(draft.format)) errors.format = "Select an event format.";
  if (!draft.name.trim() || draft.name.trim().length > 75)
    errors.name = "Enter an event name (up to 75 characters).";
  if (!draft.startDate) errors.startDate = "Choose a start date.";
  if (!draft.startTime) errors.startTime = "Choose a start time.";
  const start = zonedInstant(draft.startDate, draft.startTime, draft.timezone);
  if (!draft.timezone) errors.timezone = "Choose a timezone.";
  else {
    try {
      new Intl.DateTimeFormat("en", { timeZone: draft.timezone }).format();
    } catch {
      errors.timezone = "Choose a valid timezone.";
    }
  }
  if (draft.startDate && draft.startTime) {
    if (start === null) errors.startTime = "This time is not valid in the selected timezone.";
    else if (start <= now) errors.startDate = "Choose a future start date and time.";
  }
  if (draft.hasEnd) {
    if (!draft.endDate) errors.endDate = "Choose an end date.";
    if (!draft.endTime) errors.endTime = "Choose an end time.";
    const end = zonedInstant(draft.endDate, draft.endTime, draft.timezone);
    if (draft.endDate && draft.endTime && (end === null || (start !== null && end <= start)))
      errors.endTime = "End time must be valid and after the start time.";
  }
  return errors;
}
export function postError(draft: PostDraft, now = Date.now()) {
  if (!draft.text.trim() && !draft.files.length) return "Write a post or add media to continue.";
  if (
    draft.scheduledAt &&
    (!Number.isFinite(new Date(draft.scheduledAt).getTime()) ||
      new Date(draft.scheduledAt).getTime() <= now)
  )
    return "Choose a future date and time.";
  return "";
}
export function attachmentError(file: Pick<File, "size" | "type">) {
  if (
    ![
      "image/jpeg",
      "image/png",
      "image/webp",
      "video/mp4",
      "video/webm",
      "application/pdf",
    ].includes(file.type)
  )
    return "Choose a JPG, PNG, WebP, MP4, WebM or PDF file.";
  if (file.size === 0 || file.size > 25 * 1024 * 1024)
    return "Choose a non-empty file no larger than 25 MB.";
  return "";
}
export type FeedPreview = {
  id: string;
  kind: "post" | "event";
  text: string;
  files: File[];
  audience: string;
  comments: string;
  collaborators: string[];
  partnership: boolean;
  scheduledAt: string;
  event?: EventDraft;
};
