import { useEffect, useRef, useState } from "react";
import { FeedCreation } from "./creation/FeedCreation";
import { PreviewCard } from "./creation/PreviewCard";
import { emptyEvent, emptyPost, type CreationKind, type FeedPreview } from "./creation/model";
import { Avatar, Icon, MainHeader, type AvatarPerson, type IconName } from "../ui/chrome";
import campusImage from "./community-campus.png";
import "./feed.css";

type FeedFilter = "For You" | "Following";

const feedPeople = [
  {
    name: "Priya Raman",
    role: "Product Designer",
    company: "Zoho",
    year: "2022",
    image:
      "https://images.unsplash.com/photo-1655249493799-9cee4fe983bb?auto=format&fit=crop&w=160&q=85",
  },
  {
    name: "Karthik Raj",
    role: "Software Engineer",
    company: "Royal Enfield",
    year: "2021",
    image:
      "https://images.unsplash.com/photo-1589386417686-0d34b5903d23?auto=format&fit=crop&w=160&q=85",
  },
  {
    name: "Anjali Krishnan",
    role: "Software Engineer",
    company: "Infosys",
    year: "2020",
    image:
      "https://images.unsplash.com/photo-1609371497456-3a55a205d5eb?auto=format&fit=crop&w=160&q=85",
  },
];

const posts = [
  {
    author: feedPeople[0],
    time: "2h ago",
    text: "Excited to share that I’ve completed my first year at Zoho! Grateful for the opportunities, mentorship and experiences along the way.",
    image: campusImage,
    imageAlt: "A modern technology campus in warm morning light",
    counts: ["245", "32", "18", "12"],
  },
  {
    author: feedPeople[1],
    time: "4h ago",
    text: "Your college network can become one of your most valuable professional resources. Always stay connected, share opportunities and support one another.",
    counts: ["180", "24", "11", "8"],
  },
  {
    author: feedPeople[2],
    time: "1d ago",
    text: "Some of the best memories started right here at MSGI. Looking forward to reconnecting with everyone at our next alumni gathering.",
    counts: ["132", "19", "9", "6"],
  },
];

const postIds = ["priya-first-year", "karthik-network", "anjali-memories"];
export const feedPostExists = (id: string) => postIds.includes(id);

const creationActions: { key: CreationKind; label: string; icon: IconName }[] = [
  { key: "post", label: "Create a Post", icon: "image" },
  { key: "event", label: "Create an Event", icon: "calendar" },
  { key: "opportunity", label: "Find an Opportunity", icon: "briefcase" },
  { key: "article", label: "Write an Article", icon: "file" },
];

function FeedPost({ post, index }: { post: (typeof posts)[number]; index: number }) {
  const [liked, setLiked] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const actions: { icon: IconName; label: string; count: string; onClick?: () => void }[] = [
    {
      icon: "heart",
      label: "Like",
      count: String(Number(post.counts[0]) + (liked ? 1 : 0)),
      onClick: () => setLiked((value) => !value),
    },
    { icon: "chat", label: "Comment", count: post.counts[1] },
    { icon: "repost", label: "Repost", count: post.counts[2] },
    { icon: "share", label: "Share", count: post.counts[3] },
  ];

  return (
    <article className="feed-post" id={`network-post-${postIds[index]}`} tabIndex={-1}>
      <div className="feed-post__author">
        <Avatar person={post.author} size="lg" />
        <div>
          <strong>
            {post.author.name}
            <span className="feed-verified" title="Verified alumni">
              <Icon name="check" size={9} />
            </span>
          </strong>
          <small>
            {post.author.role} at {post.author.company} · Batch {post.author.year}
          </small>
          <small>
            {post.time} · <Icon name="globe" size={11} />
          </small>
        </div>
        <button aria-label={`More options for ${post.author.name}`}>
          <Icon name="more" />
        </button>
      </div>
      <p className="feed-post__text">{post.text}</p>
      {post.image && <img className="feed-post__media" src={post.image} alt={post.imageAlt} />}
      <div className="feed-post__actions">
        {actions.map((action) => (
          <button
            className={action.label === "Like" && liked ? "active" : ""}
            onClick={action.onClick}
            aria-label={`${action.label} post ${index + 1}`}
            aria-pressed={action.label === "Like" ? liked : undefined}
            key={action.label}
          >
            <Icon name={action.icon} size={17} />
            <span>{action.count}</span>
          </button>
        ))}
        <button
          className={bookmarked ? "active" : ""}
          onClick={() => setBookmarked((value) => !value)}
          aria-label={`Bookmark post ${index + 1}`}
          aria-pressed={bookmarked}
        >
          <Icon name="bookmark" size={17} />
        </button>
      </div>
    </article>
  );
}

export function CommunityFeed({
  profile,
  onProfile,
  focusPostId,
  onCreationChange,
}: {
  profile: AvatarPerson;
  onProfile: () => void;
  focusPostId?: string | null;
  onCreationChange?: (open: boolean) => void;
}) {
  const [filter, setFilter] = useState<FeedFilter>("For You");
  const [createOpen, setCreateOpen] = useState(false);
  const [workflow, setWorkflow] = useState<CreationKind | null>(null);
  const [postDraft, setPostDraft] = useState(emptyPost);
  const [eventDraft, setEventDraft] = useState(emptyEvent);
  const [previews, setPreviews] = useState<FeedPreview[]>([]);
  const [initialAttachments, setInitialAttachments] = useState(false);
  const creationMenu = useRef<HTMLDivElement>(null);
  const menuTrigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    onCreationChange?.(Boolean(workflow));
    return () => onCreationChange?.(false);
  }, [workflow, onCreationChange]);
  useEffect(() => {
    if (!createOpen) return;
    creationMenu.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const outside = (event: PointerEvent) => {
      if (!creationMenu.current?.contains(event.target as Node)) setCreateOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [createOpen]);
  function openCreation(kind: CreationKind, attachments = false) {
    setInitialAttachments(attachments);
    setCreateOpen(false);
    setWorkflow(kind);
  }
  useEffect(() => {
    if (!focusPostId) return;
    const post = document.getElementById(`network-post-${focusPostId}`);
    post?.scrollIntoView({ block: "center" });
    post?.focus({ preventScroll: true });
  }, [focusPostId]);

  if (workflow)
    return (
      <FeedCreation
        kind={workflow}
        profile={profile}
        members={feedPeople}
        post={postDraft}
        setPost={setPostDraft}
        event={eventDraft}
        setEvent={setEventDraft}
        onClose={() => setWorkflow(null)}
        initialAttachments={initialAttachments}
        onPreview={(preview) => {
          setPreviews((current) => [preview, ...current]);
          setWorkflow(null);
        }}
      />
    );

  return (
    <div className="screen feed-screen">
      <section className="feed-hero curved-header">
        <MainHeader person={profile} onProfile={onProfile} />
        <div className="feed-heading">
          <h1>
            Community <em>Feed</em>
          </h1>
        </div>
        <div className="feed-filters" aria-label="Feed categories">
          {(["For You", "Following"] as FeedFilter[]).map((item) => (
            <button
              className={filter === item ? "active" : ""}
              onClick={() => setFilter(item)}
              aria-pressed={filter === item}
              key={item}
            >
              {item}
            </button>
          ))}
        </div>
      </section>

      <main className="feed-content">
        <section className="feed-composer" aria-label="Create a post">
          <Avatar person={profile} size="md" />
          <button className="feed-composer__prompt" onClick={() => setCreateOpen(true)}>
            Create a Post
          </button>
          <div className="feed-composer__attachments">
            <button aria-label="Attach image" onClick={() => openCreation("post", true)}>
              <Icon name="image" />
            </button>
            <button aria-label="Attach video" onClick={() => openCreation("post", true)}>
              <Icon name="video" />
            </button>
            <button aria-label="Attach document" onClick={() => openCreation("post", true)}>
              <Icon name="file" />
            </button>
          </div>
        </section>
        <div className="feed-list">
          {previews.map((preview) => (
            <PreviewCard
              key={preview.id}
              preview={preview}
              profile={profile}
              onRemove={() =>
                setPreviews((current) => current.filter((item) => item.id !== preview.id))
              }
            />
          ))}
          {posts.map((post, index) => (
            <FeedPost post={post} index={index} key={post.author.name} />
          ))}
        </div>
      </main>

      <div ref={creationMenu} className={`feed-create ${createOpen ? "open" : ""}`}>
        {createOpen && (
          <div
            className="feed-create__menu"
            role="menu"
            aria-label="Content creation options"
            onKeyDown={(event) => {
              const items = Array.from(
                event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'),
              );
              const current = items.indexOf(document.activeElement as HTMLButtonElement);
              if (event.key === "Escape") {
                setCreateOpen(false);
                menuTrigger.current?.focus();
              } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault();
                items[
                  (current + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length
                ]?.focus();
              }
            }}
          >
            {creationActions.map((action) => (
              <button role="menuitem" key={action.key} onClick={() => openCreation(action.key)}>
                <span>{action.label}</span>
                <i>
                  <Icon name={action.icon} size={17} />
                </i>
              </button>
            ))}
          </div>
        )}
        <button
          ref={menuTrigger}
          className="feed-create__trigger"
          onClick={() => setCreateOpen((value) => !value)}
          aria-label={createOpen ? "Close creation menu" : "Create a Post"}
          aria-expanded={createOpen}
        >
          <Icon name={createOpen ? "close" : "plus"} />
        </button>
      </div>
    </div>
  );
}
