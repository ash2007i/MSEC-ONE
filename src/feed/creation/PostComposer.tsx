import { useRef, useState } from "react";
import { Avatar, Icon, type AvatarPerson } from "../../ui/chrome";
import { Button, InlineMessage, TextField } from "../../settings/ui";
import { ActionIcon, CreationSheet, LocalMedia, PreviewNote } from "./ui";
import { attachmentError, emptyPost, postError, type FeedPreview, type PostDraft } from "./model";

type Sheet =
  | "settings"
  | "audience"
  | "comments"
  | "collaborators"
  | "schedule"
  | "improve"
  | "attachments"
  | "partnership"
  | "profile"
  | "close"
  | null;
const audiences = ["Anyone", "MSGI alumni", "Connections", "Only me"];
const permissions = ["Anyone", "Connections", "No one"];

export function PostComposer({
  profile,
  members,
  draft,
  setDraft,
  onClose,
  onPreview,
  initialAttachments = false,
}: {
  profile: AvatarPerson;
  members: AvatarPerson[];
  draft: PostDraft;
  setDraft: (draft: PostDraft) => void;
  onClose: () => void;
  onPreview: (post: FeedPreview) => void;
  initialAttachments?: boolean;
}) {
  const [sheet, setSheet] = useState<Sheet>(initialAttachments ? "attachments" : null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [schedule, setSchedule] = useState(draft.scheduledAt);
  const input = useRef<HTMLInputElement>(null);
  const [accept, setAccept] = useState(
    "image/jpeg,image/png,image/webp,video/mp4,video/webm,application/pdf",
  );
  const set = <K extends keyof PostDraft>(key: K, value: PostDraft[K]) =>
    setDraft({ ...draft, [key]: value });
  const invalid = postError(draft);
  const requestClose = () => {
    if (draft.text || draft.files.length || draft.collaborators.length || draft.scheduledAt)
      setSheet("close");
    else onClose();
  };
  function chooseFile(types: string) {
    setAccept(types);
    if (input.current) {
      input.current.accept = types;
      input.current.click();
    }
  }
  function addFiles(files: File[]) {
    const problem = files.map(attachmentError).find(Boolean);
    if (problem) {
      setError(problem);
      return;
    }
    if (draft.files.length + files.length > 5) {
      setError("Add up to five attachments per preview.");
      return;
    }
    set("files", [...draft.files, ...files]);
    setError("");
    setSheet(null);
  }
  const row = (
    icon: "globe" | "users" | "user" | "clock",
    title: string,
    subtitle: string,
    next: Sheet,
  ) => (
    <Button variant="ghost" className="fc-setting-row" onClick={() => setSheet(next)}>
      <span className="fc-setting-icon">
        <Icon name={icon} />
      </span>
      <span>
        <b>{title}</b>
        <small>{subtitle}</small>
      </span>
      <Icon name="chevron" size={16} />
    </Button>
  );
  return (
    <main className="screen fc-screen fc-post-screen">
      <header className="fc-post-header">
        <ActionIcon name="close" label="Close post composer" onClick={requestClose} />
        <div className="fc-author">
          <Avatar person={profile} size="sm" />
          <div>
            <Button variant="ghost" className="fc-audience" onClick={() => setSheet("settings")}>
              {draft.audience}
              <Icon name="chevron" size={12} />
            </Button>
            <Button
              variant="ghost"
              className="fc-collaborator-link"
              onClick={() => setSheet("collaborators")}
            >
              {draft.collaborators.length
                ? `${draft.collaborators.length} collaborator${draft.collaborators.length > 1 ? "s" : ""}`
                : "Add collaborators"}
            </Button>
          </div>
        </div>
        <ActionIcon
          name="clock"
          label="Schedule post"
          onClick={() => {
            setSchedule(draft.scheduledAt);
            setSheet("schedule");
          }}
        />
        <Button
          className="fc-publish"
          disabled={Boolean(invalid)}
          onClick={() => {
            const problem = postError(draft);
            if (problem) {
              setError(problem);
              return;
            }
            onPreview({ ...draft, kind: "post", id: crypto.randomUUID() });
            setDraft(emptyPost());
          }}
        >
          Post
        </Button>
      </header>
      <h1 className="set-visually-hidden">Create a Post</h1>
      <div className="fc-composition">
        <textarea
          autoFocus
          aria-label="Post content"
          placeholder="Share your thoughts ..."
          value={draft.text}
          onChange={(event) => set("text", event.target.value)}
        />
        {draft.files.length > 0 && (
          <div className="fc-attachments">
            {draft.files.map((file, index) => (
              <div className="fc-attachment" key={`${file.name}-${index}`}>
                <LocalMedia file={file} />
                <ActionIcon
                  name="close"
                  label={`Remove ${file.name}`}
                  onClick={() =>
                    set(
                      "files",
                      draft.files.filter((_, i) => i !== index),
                    )
                  }
                />
              </div>
            ))}
          </div>
        )}
      </div>
      {draft.scheduledAt && (
        <div className="fc-schedule-summary">
          <Icon name="clock" size={15} />
          Preview date: {new Date(draft.scheduledAt).toLocaleString()}
        </div>
      )}
      {draft.partnership && (
        <p className="fc-schedule-summary">Brand partnership disclosure enabled</p>
      )}
      {error && <InlineMessage tone="error">{error}</InlineMessage>}
      <PreviewNote />
      <footer className="fc-post-footer">
        <div>
          <ActionIcon
            name="image"
            label="Add image or video"
            onClick={() => chooseFile("image/jpeg,image/png,image/webp,video/mp4,video/webm")}
          />
          <ActionIcon
            name="plus"
            label="More attachments"
            onClick={() => setSheet("attachments")}
          />
        </div>
      </footer>
      <input
        ref={input}
        className="set-visually-hidden"
        tabIndex={-1}
        type="file"
        multiple
        accept={accept}
        onChange={(event) => {
          addFiles(Array.from(event.target.files ?? []));
          event.target.value = "";
        }}
      />

      {sheet === "settings" && (
        <CreationSheet title="Post settings" onClose={() => setSheet(null)}>
          <Button variant="ghost" className="fc-setting-row" onClick={() => setSheet("profile")}>
            <Avatar person={profile} size="sm" />
            <span>
              <b>{profile.name}</b>
            </span>
            <Icon name="chevron" size={16} />
          </Button>
          {row("globe", "Who can see your post?", draft.audience, "audience")}
          {row("globe", "Who can comment on your post?", draft.comments, "comments")}
          {row(
            "users",
            "Add collaborators",
            draft.collaborators.length ? draft.collaborators.join(", ") : "Invite members or pages",
            "collaborators",
          )}
          <div className="fc-partnership">
            <div>
              <b>Brand Partnership</b>
              <Button variant="ghost" onClick={() => setSheet("partnership")}>
                Learn more
              </Button>
            </div>
            <Button
              variant="ghost"
              role="switch"
              aria-checked={draft.partnership}
              aria-label="Brand Partnership"
              onClick={() => set("partnership", !draft.partnership)}
            >
              <span>{draft.partnership ? "On" : "Off"}</span>
              <span className={`toggle ${draft.partnership ? "on" : ""}`} aria-hidden>
                <span />
              </span>
            </Button>
          </div>
        </CreationSheet>
      )}
      {(sheet === "audience" || sheet === "comments") && (
        <CreationSheet
          title={sheet === "audience" ? "Who can see your post?" : "Who can comment on your post?"}
          onClose={() => setSheet("settings")}
        >
          <div
            role="radiogroup"
            aria-label={sheet === "audience" ? "Post audience" : "Comment permissions"}
          >
            {(sheet === "audience" ? audiences : permissions).map((option) => (
              <Button
                key={option}
                variant="ghost"
                className="fc-setting-row"
                role="radio"
                aria-checked={(sheet === "audience" ? draft.audience : draft.comments) === option}
                onClick={() => {
                  set(sheet === "audience" ? "audience" : "comments", option);
                  setSheet("settings");
                }}
              >
                <Icon name={option === "Only me" || option === "No one" ? "lock" : "globe"} />
                <span>{option}</span>
                {(sheet === "audience" ? draft.audience : draft.comments) === option && (
                  <Icon name="check" size={18} />
                )}
              </Button>
            ))}
          </div>
        </CreationSheet>
      )}
      {sheet === "collaborators" && (
        <CreationSheet title="Add collaborators" onClose={() => setSheet(null)}>
          <TextField
            id="fc-collaborator-search"
            label="Find members"
            placeholder="Search your network"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <p className="fc-note">Selections are part of this draft; no invitations are sent.</p>
          {members
            .filter((member) => member.name.toLowerCase().includes(query.toLowerCase()))
            .map((member) => (
              <Button
                key={member.name}
                variant="ghost"
                className="fc-setting-row"
                aria-pressed={draft.collaborators.includes(member.name)}
                onClick={() =>
                  set(
                    "collaborators",
                    draft.collaborators.includes(member.name)
                      ? draft.collaborators.filter((name) => name !== member.name)
                      : [...draft.collaborators, member.name],
                  )
                }
              >
                <Avatar person={member} size="sm" />
                <span>{member.name}</span>
                {draft.collaborators.includes(member.name) && <Icon name="check" />}
              </Button>
            ))}
          {!members.some((member) => member.name.toLowerCase().includes(query.toLowerCase())) && (
            <p className="fc-note">No members match this search.</p>
          )}
          <Button className="set-button--block" onClick={() => setSheet(null)}>
            Done
          </Button>
        </CreationSheet>
      )}
      {sheet === "schedule" && (
        <CreationSheet title="Schedule your post" onClose={() => setSheet(null)}>
          <TextField
            id="fc-post-schedule"
            type="datetime-local"
            label="Date and time"
            value={schedule}
            onChange={(event) => setSchedule(event.target.value)}
          />
          <p className="fc-note">
            Your device timezone: {Intl.DateTimeFormat().resolvedOptions().timeZone}. This creates a
            scheduled preview, not an automatic publication.
          </p>
          {schedule &&
            (!Number.isFinite(new Date(schedule).getTime()) ||
              new Date(schedule).getTime() <= Date.now()) && (
              <InlineMessage tone="error">Choose a future date and time.</InlineMessage>
            )}
          <Button
            className="set-button--block"
            disabled={
              !schedule ||
              !Number.isFinite(new Date(schedule).getTime()) ||
              new Date(schedule).getTime() <= Date.now()
            }
            onClick={() => {
              set("scheduledAt", schedule);
              setSheet(null);
            }}
          >
            Apply date
          </Button>
          {draft.scheduledAt && (
            <Button
              variant="ghost"
              onClick={() => {
                set("scheduledAt", "");
                setSheet(null);
              }}
            >
              Remove schedule
            </Button>
          )}
        </CreationSheet>
      )}
      {sheet === "attachments" && (
        <CreationSheet title="Add to your post" onClose={() => setSheet(null)}>
          <Button
            variant="ghost"
            className="fc-setting-row"
            onClick={() => chooseFile("image/jpeg,image/png,image/webp")}
          >
            <Icon name="image" />
            Add images
          </Button>
          <Button
            variant="ghost"
            className="fc-setting-row"
            onClick={() => chooseFile("video/mp4,video/webm")}
          >
            <Icon name="video" />
            Add a video
          </Button>
          <Button
            variant="ghost"
            className="fc-setting-row"
            onClick={() => chooseFile("application/pdf")}
          >
            <Icon name="file" />
            Add a PDF
          </Button>
          <p className="fc-note">Up to 5 files, 25 MB each. Files stay on this device.</p>
        </CreationSheet>
      )}
      {sheet === "improve" && (
        <CreationSheet title="Improve your post" onClose={() => setSheet(null)}>
          <p className="fc-note">
            Start with your main idea, add useful context and finish with a clear question or
            invitation.
          </p>
          <p className="fc-note">
            This local tool tidies spacing only; it does not generate text or contact an AI service.
          </p>
          <Button
            className="set-button--block"
            disabled={!draft.text.trim()}
            onClick={() => {
              set(
                "text",
                draft.text
                  .trim()
                  .replace(/[ \t]+/g, " ")
                  .replace(/\n{3,}/g, "\n\n"),
              );
              setSheet(null);
            }}
          >
            Tidy spacing
          </Button>
        </CreationSheet>
      )}
      {sheet === "partnership" && (
        <CreationSheet title="Brand Partnership" onClose={() => setSheet("settings")}>
          <p className="fc-note">
            Enable this disclosure when your post includes a paid or sponsored partnership. The
            setting is included in your preview; it does not contact or notify a brand.
          </p>
        </CreationSheet>
      )}
      {sheet === "profile" && (
        <CreationSheet title="Posting as" onClose={() => setSheet("settings")}>
          <div className="fc-profile-summary">
            <Avatar person={profile} size="lg" />
            <b>{profile.name}</b>
            <p>{profile.role}</p>
          </div>
        </CreationSheet>
      )}
      {sheet === "close" && (
        <CreationSheet title="Leave this post?" onClose={() => setSheet(null)}>
          <p className="fc-note">
            Your draft can stay here while you explore other creation options. Leaving Feed or
            reloading clears local drafts.
          </p>
          <Button className="set-button--block" onClick={() => setSheet(null)}>
            Keep editing
          </Button>
          <Button variant="secondary" className="set-button--block" onClick={onClose}>
            Keep draft and close
          </Button>
          <Button
            variant="ghost"
            className="set-button--block"
            onClick={() => {
              setDraft(emptyPost());
              onClose();
            }}
          >
            Discard draft
          </Button>
        </CreationSheet>
      )}
    </main>
  );
}
