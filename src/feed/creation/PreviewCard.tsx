import { Avatar, Icon, type AvatarPerson } from "../../ui/chrome";
import { Button } from "../../settings/ui";
import { LocalMedia } from "./ui";
import type { FeedPreview } from "./model";

export function PreviewCard({
  preview,
  profile,
  onRemove,
}: {
  preview: FeedPreview;
  profile: AvatarPerson;
  onRemove: () => void;
}) {
  return (
    <article className="feed-post fc-preview-card">
      <div className="fc-preview-heading">
        <Avatar person={profile} size="sm" />
        <div>
          <strong>{profile.name}</strong>
          <small>
            Local {preview.kind} preview · {preview.audience}
          </small>
        </div>
        <Button
          variant="ghost"
          aria-label="Remove local preview"
          className="fc-icon"
          onClick={onRemove}
        >
          <Icon name="close" size={18} />
        </Button>
      </div>
      {preview.scheduledAt && (
        <p className="fc-note">
          Scheduled draft: {new Date(preview.scheduledAt).toLocaleString()} · will not publish
          automatically
        </p>
      )}
      <p className="feed-post__text">{preview.text}</p>
      {preview.event && (
        <p className="fc-note">
          {preview.event.type} · {preview.event.format}
          <br />
          {preview.event.startDate} at {preview.event.startTime} · {preview.event.timezone}
          {preview.event.hasEnd && (
            <>
              {" "}
              – {preview.event.endDate} at {preview.event.endTime}
            </>
          )}
        </p>
      )}
      {preview.event?.description && (
        <p className="fc-review-description">{preview.event.description}</p>
      )}
      {preview.files.map((file, index) => (
        <LocalMedia key={`${file.name}-${index}`} file={file} />
      ))}
      {preview.collaborators.length > 0 && (
        <p className="fc-note">With {preview.collaborators.join(", ")}</p>
      )}
      {preview.partnership && <p className="fc-note">Brand partnership</p>}
      <p className="fc-preview-note">Not published · comments: {preview.comments}</p>
    </article>
  );
}
