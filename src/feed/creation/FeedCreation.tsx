import { Button, EmptyState } from "../../settings/ui";
import type { AvatarPerson } from "../../ui/chrome";
import { PostComposer } from "./PostComposer";
import { EventComposer } from "./EventComposer";
import { CreationHeader } from "./ui";
import type { CreationKind, EventDraft, FeedPreview, PostDraft } from "./model";

export function FeedCreation(props: {
  kind: CreationKind;
  profile: AvatarPerson;
  members: AvatarPerson[];
  post: PostDraft;
  setPost: (post: PostDraft) => void;
  event: EventDraft;
  setEvent: (event: EventDraft) => void;
  onClose: () => void;
  onPreview: (preview: FeedPreview) => void;
  initialAttachments?: boolean;
}) {
  if (props.kind === "post")
    return (
      <PostComposer
        profile={props.profile}
        members={props.members}
        draft={props.post}
        setDraft={props.setPost}
        onClose={props.onClose}
        onPreview={props.onPreview}
        initialAttachments={props.initialAttachments}
      />
    );
  if (props.kind === "event")
    return (
      <EventComposer
        draft={props.event}
        setDraft={props.setEvent}
        onClose={props.onClose}
        onPreview={props.onPreview}
      />
    );
  const article = props.kind === "article";
  return (
    <main className="screen fc-screen">
      <CreationHeader
        title={article ? "Write an Article" : "Find an Opportunity"}
        onBack={props.onClose}
      />
      <div className="fc-pending-reference">
        <EmptyState
          icon={article ? "file" : "briefcase"}
          title="Ready for your reference"
          description={`This is the separate ${article ? "article" : "opportunity"} workflow. Its detailed ${article ? "editor" : "interface"} will be built once you provide its reference image.`}
          action={
            <Button variant="secondary" onClick={props.onClose}>
              Back to Feed
            </Button>
          }
        />
      </div>
    </main>
  );
}
