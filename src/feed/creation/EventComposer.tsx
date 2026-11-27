import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Icon } from "../../ui/chrome";
import { Button, InlineMessage, SelectField, TextAreaField, TextField } from "../../settings/ui";
import { CreationHeader, LocalMedia, PreviewNote } from "./ui";
import {
  emptyEvent,
  eventErrors,
  eventFormats,
  localTimezone,
  type EventDraft,
  type FeedPreview,
} from "./model";

export function EventComposer({
  draft,
  setDraft,
  onClose,
  onPreview,
}: {
  draft: EventDraft;
  setDraft: (event: EventDraft) => void;
  onClose: () => void;
  onPreview: (event: FeedPreview) => void;
}) {
  const [review, setReview] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [coverError, setCoverError] = useState("");
  const [coverBusy, setCoverBusy] = useState(false);
  const coverInput = useRef<HTMLInputElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const coverRequest = useRef(0);
  const mounted = useRef(true);
  const latestDraft = useRef(draft);
  latestDraft.current = draft;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (attempt) form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [attempt]);
  const timezones = useMemo(() => {
    const api = Intl as typeof Intl & { supportedValuesOf?: (key: "timeZone") => string[] };
    return [
      ...new Set([
        "UTC",
        localTimezone(),
        ...(api.supportedValuesOf?.("timeZone") ?? [
          "Asia/Kolkata",
          "Asia/Singapore",
          "Europe/London",
          "America/New_York",
          "Australia/Sydney",
        ]),
      ]),
    ];
  }, []);
  const errors = eventErrors(draft);
  const show = (key: keyof EventDraft) => (attempt ? errors[key] : undefined);
  const set = <K extends keyof EventDraft>(key: K, value: EventDraft[K]) =>
    setDraft({ ...draft, [key]: value });
  async function addCover(file: File) {
    const request = ++coverRequest.current;
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      !file.size ||
      file.size > 5 * 1024 * 1024
    ) {
      setCoverBusy(false);
      setCoverError("Choose a JPG, PNG or WebP image no larger than 5 MB.");
      return;
    }
    setCoverBusy(true);
    setCoverError("");
    const url = URL.createObjectURL(file);
    try {
      const width = await new Promise<number>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image.naturalWidth);
        image.onerror = () => reject(new Error("Unreadable image"));
        image.src = url;
      });
      if (!mounted.current || request !== coverRequest.current) return;
      if (width < 480) setCoverError("Choose an image at least 480 pixels wide.");
      else setDraft({ ...latestDraft.current, cover: file });
    } catch {
      if (mounted.current && request === coverRequest.current)
        setCoverError("This image could not be read. Please choose another file.");
    } finally {
      URL.revokeObjectURL(url);
      if (mounted.current && request === coverRequest.current) setCoverBusy(false);
    }
  }
  function next(event: FormEvent) {
    event.preventDefault();
    setAttempt((value) => value + 1);
    if (coverBusy || coverError || Object.keys(eventErrors(draft)).length) return;
    setReview(true);
  }
  if (review)
    return (
      <main className="screen fc-screen">
        <CreationHeader title="Review event" onBack={() => setReview(false)} />
        <div className="fc-event-review">
          {draft.cover && <LocalMedia file={draft.cover} />}
          <p className="eyebrow">
            {draft.type} · {draft.format}
          </p>
          <h2>{draft.name}</h2>
          <dl className="fc-event-summary">
            <div>
              <dt>Timezone</dt>
              <dd>{draft.timezone}</dd>
            </div>
            <div>
              <dt>Starts</dt>
              <dd>
                {draft.startDate} · {draft.startTime}
              </dd>
            </div>
            {draft.hasEnd && (
              <div>
                <dt>Ends</dt>
                <dd>
                  {draft.endDate} · {draft.endTime}
                </dd>
              </div>
            )}
          </dl>
          {draft.description && <p className="fc-review-description">{draft.description}</p>}
          <PreviewNote />
          {Object.keys(errors).length > 0 && (
            <InlineMessage tone="error">
              The event dates are no longer valid. Go back to update them.
            </InlineMessage>
          )}
          <Button
            className="set-button--block"
            disabled={Boolean(Object.keys(errors).length)}
            onClick={() => {
              if (Object.keys(eventErrors(draft)).length) {
                setReview(false);
                setAttempt((value) => value + 1);
                return;
              }
              onPreview({
                id: crypto.randomUUID(),
                kind: "event",
                text: draft.name,
                files: draft.cover ? [draft.cover] : [],
                audience: "MSGI alumni",
                comments: "Anyone",
                collaborators: [],
                partnership: false,
                scheduledAt: "",
                event: { ...draft },
              });
              setDraft(emptyEvent());
            }}
          >
            Add event preview to Feed
          </Button>
          <Button variant="ghost" className="set-button--block" onClick={() => setReview(false)}>
            Edit event
          </Button>
        </div>
      </main>
    );
  return (
    <main className="screen fc-screen fc-event-screen">
      <form ref={form} onSubmit={next} noValidate>
        <CreationHeader
          title="Create an event"
          onBack={onClose}
          action={
            <Button type="submit" className="fc-publish" disabled={coverBusy}>
              Next
            </Button>
          }
        />
        <div className="fc-cover">
          {draft.cover && <LocalMedia file={draft.cover} />}
          <Button
            variant="ghost"
            className="fc-cover-upload"
            busy={coverBusy}
            aria-label={coverBusy ? "Checking cover image" : undefined}
            onClick={() => coverInput.current?.click()}
          >
            <Icon name="image" size={27} />
            <b>{draft.cover ? "Change cover image" : "Upload cover image"}</b>
            <small>Minimum width 480 pixels, 16:9 recommended</small>
          </Button>
          <input
            ref={coverInput}
            type="file"
            tabIndex={-1}
            className="set-visually-hidden"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void addCover(file);
              event.target.value = "";
            }}
          />
          {draft.cover && (
            <Button
              variant="ghost"
              onClick={() => {
                set("cover", null);
                setCoverError("");
              }}
            >
              Remove cover image
            </Button>
          )}
        </div>
        <div className="fc-event-fields">
          {coverError && <InlineMessage tone="error">{coverError}</InlineMessage>}
          <fieldset className="fc-event-type">
            <legend>Event type</legend>
            {(["Online", "In person"] as const).map((type) => (
              <label key={type}>
                <input
                  type="radio"
                  name="event-type"
                  value={type}
                  checked={draft.type === type}
                  onChange={() => setDraft({ ...draft, type, format: "" })}
                />
                {type}
              </label>
            ))}
          </fieldset>
          <SelectField
            id="fc-event-format"
            label="Event format"
            required
            value={draft.format}
            onChange={(event) => set("format", event.target.value)}
            error={show("format")}
          >
            <option value="" disabled>
              Select a format
            </option>
            {eventFormats[draft.type].map((format) => (
              <option key={format}>{format}</option>
            ))}
          </SelectField>
          <TextField
            id="fc-event-name"
            label="Event name"
            required
            maxLength={75}
            value={draft.name}
            hint={`${draft.name.length}/75`}
            onChange={(event) => set("name", event.target.value)}
            error={show("name")}
          />
          <SelectField
            id="fc-event-timezone"
            label="Timezone"
            required
            value={draft.timezone}
            onChange={(event) => set("timezone", event.target.value)}
            error={show("timezone")}
          >
            {timezones.map((zone) => (
              <option key={zone} value={zone}>
                {zone.replace(/_/g, " ")}
              </option>
            ))}
          </SelectField>
          <div className="fc-date-row">
            <TextField
              id="fc-event-start-date"
              label="Start date"
              type="date"
              required
              value={draft.startDate}
              onChange={(event) => set("startDate", event.target.value)}
              error={show("startDate")}
            />
            <TextField
              id="fc-event-start-time"
              label="Start time"
              type="time"
              required
              value={draft.startTime}
              onChange={(event) => set("startTime", event.target.value)}
              error={show("startTime")}
            />
          </div>
          <label className="fc-check">
            <input
              type="checkbox"
              checked={draft.hasEnd}
              onChange={(event) => set("hasEnd", event.target.checked)}
            />
            Add end date and time
          </label>
          {draft.hasEnd && (
            <div className="fc-date-row">
              <TextField
                id="fc-event-end-date"
                label="End date"
                type="date"
                required
                value={draft.endDate}
                onChange={(event) => set("endDate", event.target.value)}
                error={show("endDate")}
              />
              <TextField
                id="fc-event-end-time"
                label="End time"
                type="time"
                required
                value={draft.endTime}
                onChange={(event) => set("endTime", event.target.value)}
                error={show("endTime")}
              />
            </div>
          )}
          <TextAreaField
            id="fc-event-description"
            label="Description"
            value={draft.description}
            rows={5}
            placeholder="Tell attendees what to expect"
            onChange={(event) => set("description", event.target.value)}
          />
          <PreviewNote />
        </div>
      </form>
    </main>
  );
}
