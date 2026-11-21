import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../backend/AuthContext";
import {
  addPostComment,
  createPost,
  deletePost,
  deletePostComment,
  getFeedPosts,
  getPostComments,
  togglePostLike,
  type FeedPost as BackendFeedPost,
  type PostComment,
} from "../backend/feed";
import {
  Avatar,
  Icon,
  MainHeader,
  type AvatarPerson,
  type IconName,
} from "../ui/chrome";
import "./feed.css";

type FeedFilter = "For You" | "My Posts";
const postCategories = [
  "General",
  "Career",
  "Events",
  "Mentorship",
  "Achievement",
];

function formatRelativeTime(iso: string): string {
  const diffSec = Math.max(
    0,
    Math.floor((Date.now() - new Date(iso).getTime()) / 1000),
  );
  if (diffSec < 60) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}

function FeedPostCard({
  post,
  index,
  currentUserId,
  onLikeToggle,
  onDeletePost,
  onCommentCountDelta,
  onOpenPerson,
}: {
  post: BackendFeedPost;
  index: number;
  currentUserId?: string;
  onLikeToggle: (postId: string) => Promise<void>;
  onDeletePost: (postId: string) => Promise<void>;
  onCommentCountDelta: (postId: string, delta: number) => void;
  onOpenPerson?: (userId: string) => void;
}) {
  const [bookmarked, setBookmarked] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [commentBusy, setCommentBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const isOwnPost = currentUserId === post.author_id;
  const authorName = post.author?.full_name || "MSGI Member";
  const authorRole =
    [post.author?.headline, post.author?.company].filter(Boolean).join(" · ") ||
    "MSGI Alumni";

  async function toggleComments() {
    const next = !commentsOpen;
    setCommentsOpen(next);
    if (next && comments.length === 0) {
      setCommentsLoading(true);
      try {
        const list = await getPostComments(post.id);
        setComments(list);
      } catch (err) {
        console.error("Failed to load comments:", err);
      } finally {
        setCommentsLoading(false);
      }
    }
  }

  async function handleAddComment(e: FormEvent) {
    e.preventDefault();
    const trimmed = commentText.trim();
    if (!trimmed || commentBusy) return;
    setCommentBusy(true);
    try {
      const created = await addPostComment(post.id, trimmed);
      setComments((prev) => [...prev, created]);
      setCommentText("");
      onCommentCountDelta(post.id, 1);
    } catch (err) {
      console.error("Failed to post comment:", err);
    } finally {
      setCommentBusy(false);
    }
  }

  async function handleDeleteComment(commentId: string) {
    try {
      await deletePostComment(commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      onCommentCountDelta(post.id, -1);
    } catch (err) {
      console.error("Failed to delete comment:", err);
    }
  }

  async function handleShare() {
    const text = `${authorName} on MSGI One: ${post.content}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "MSGI One", text });
        return;
      }
      await navigator.clipboard?.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Ignore cancelled share sheets.
    }
  }

  return (
    <article className="feed-post">
      <div className="feed-post__author">
        <button
          type="button"
          onClick={() => onOpenPerson?.(post.author_id)}
          aria-label={`View ${authorName}'s profile`}
          style={{
            background: "none",
            border: 0,
            padding: 0,
            cursor: "pointer",
          }}
        >
          <Avatar
            person={{
              name: authorName,
              role: post.author?.headline ?? undefined,
              image: post.author?.avatar_url ?? undefined,
            }}
            size="lg"
          />
        </button>
        <div>
          <strong>
            {authorName}
            {post.author?.is_verified && (
              <span className="feed-verified" title="Verified alumni">
                <Icon name="check" size={9} />
              </span>
            )}
          </strong>
          <small>{authorRole}</small>
          <small>
            {formatRelativeTime(post.created_at)}
            {post.category ? ` · ${post.category}` : ""} ·{" "}
            <Icon name="globe" size={11} />
          </small>
        </div>
        {isOwnPost && (
          <button
            type="button"
            aria-label={`Options for post ${index + 1}`}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <Icon name="more" />
          </button>
        )}
      </div>

      {menuOpen && isOwnPost && (
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            marginBottom: 8,
          }}
        >
          <button
            type="button"
            className="text-link"
            style={{
              color: "#dc2626",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
            }}
            onClick={() => {
              setMenuOpen(false);
              void onDeletePost(post.id);
            }}
          >
            <Icon name="trash" size={14} /> Delete post
          </button>
        </div>
      )}

      <p className="feed-post__text">{post.content}</p>
      {post.image_url && (
        <img
          className="feed-post__media"
          src={post.image_url}
          alt="Post attachment"
        />
      )}

      <div className="feed-post__actions">
        <button
          type="button"
          className={post.liked_by_me ? "active" : ""}
          onClick={() => void onLikeToggle(post.id)}
          aria-label={`Like post ${index + 1}`}
          aria-pressed={post.liked_by_me}
        >
          <Icon name="heart" size={17} />
          <span>{post.like_count}</span>
        </button>
        <button
          type="button"
          className={commentsOpen ? "active" : ""}
          onClick={() => void toggleComments()}
          aria-label={`Comment on post ${index + 1}`}
          aria-expanded={commentsOpen}
        >
          <Icon name="chat" size={17} />
          <span>{post.comment_count}</span>
        </button>
        <button
          type="button"
          onClick={() => void handleShare()}
          aria-label={`Share post ${index + 1}`}
        >
          <Icon name="share" size={17} />
          <span>{copied ? "Copied" : "Share"}</span>
        </button>
        <button
          type="button"
          className={bookmarked ? "active" : ""}
          onClick={() => setBookmarked((v) => !v)}
          aria-label={`Bookmark post ${index + 1}`}
          aria-pressed={bookmarked}
        >
          <Icon name="bookmark" size={17} />
        </button>
      </div>

      {commentsOpen && (
        <div
          style={{
            marginTop: 12,
            paddingTop: 12,
            borderTop: "1px solid rgba(148, 163, 184, 0.25)",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          {commentsLoading ? (
            <small>Loading comments…</small>
          ) : comments.length === 0 ? (
            <small>No comments yet. Start the discussion.</small>
          ) : (
            comments.map((c) => (
              <div
                key={c.id}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 8,
                  fontSize: 13,
                }}
              >
                <Avatar
                  person={{
                    name: c.author?.full_name || "Member",
                    image: c.author?.avatar_url ?? undefined,
                  }}
                  size="sm"
                />
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 8,
                    }}
                  >
                    <b>{c.author?.full_name || "MSGI Member"}</b>
                    <small>{formatRelativeTime(c.created_at)}</small>
                  </div>
                  <p style={{ margin: "2px 0 0" }}>{c.content}</p>
                </div>
                {currentUserId === c.author_id && (
                  <button
                    type="button"
                    aria-label="Delete comment"
                    onClick={() => void handleDeleteComment(c.id)}
                    style={{
                      background: "none",
                      border: 0,
                      cursor: "pointer",
                      opacity: 0.7,
                    }}
                  >
                    <Icon name="trash" size={14} />
                  </button>
                )}
              </div>
            ))
          )}

          <form
            onSubmit={handleAddComment}
            style={{ display: "flex", gap: 8, marginTop: 4 }}
          >
            <input
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Write a comment…"
              style={{
                flex: 1,
                borderRadius: 999,
                padding: "8px 14px",
                border: "1px solid rgba(148, 163, 184, 0.35)",
                background: "transparent",
                fontSize: 13,
              }}
            />
            <button
              type="submit"
              disabled={commentBusy || !commentText.trim()}
              aria-label="Post comment"
              style={{
                borderRadius: 999,
                padding: "8px 12px",
                border: 0,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
              }}
            >
              <Icon name="arrow" size={16} />
            </button>
          </form>
        </div>
      )}
    </article>
  );
}

export function CommunityFeed({
  profile,
  onProfile,
  onOpenPerson,
  onOpenEvents,
}: {
  profile: AvatarPerson;
  onProfile: () => void;
  onOpenPerson?: (userId: string) => void;
  onOpenEvents?: () => void;
}) {
  const { user } = useAuth();
  const [filter, setFilter] = useState<FeedFilter>("For You");
  const [posts, setPosts] = useState<BackendFeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [draftContent, setDraftContent] = useState("");
  const [draftCategory, setDraftCategory] = useState("General");
  const [draftImageUrl, setDraftImageUrl] = useState("");
  const [publishing, setPublishing] = useState(false);

  const loadPosts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await getFeedPosts({ limit: 40 });
      setPosts(list);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load community feed.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPosts();
  }, [loadPosts]);

  const displayedPosts =
    filter === "My Posts" && user
      ? posts.filter((p) => p.author_id === user.id)
      : posts;

  async function handlePublish(e: FormEvent) {
    e.preventDefault();
    if (!draftContent.trim() || publishing) return;
    setPublishing(true);
    setError(null);
    try {
      await createPost({
        content: draftContent.trim(),
        category: draftCategory,
        imageUrl: draftImageUrl.trim() || null,
      });
      setDraftContent("");
      setDraftImageUrl("");
      setDraftCategory("General");
      setComposerOpen(false);
      await loadPosts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not publish post.");
    } finally {
      setPublishing(false);
    }
  }

  async function handleLikeToggle(postId: string) {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? {
              ...p,
              liked_by_me: !p.liked_by_me,
              like_count: Math.max(0, p.like_count + (p.liked_by_me ? -1 : 1)),
            }
          : p,
      ),
    );
    try {
      await togglePostLike(postId);
    } catch (err) {
      console.error("Like toggle failed:", err);
      await loadPosts();
    }
  }

  async function handleDeletePost(postId: string) {
    try {
      await deletePost(postId);
      setPosts((prev) => prev.filter((p) => p.id !== postId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete post.");
    }
  }

  function handleCommentCountDelta(postId: string, delta: number) {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? { ...p, comment_count: Math.max(0, p.comment_count + delta) }
          : p,
      ),
    );
  }

  const creationActions: {
    label: string;
    icon: IconName;
    onClick: () => void;
  }[] = [
    {
      label: "Create a Post",
      icon: "image",
      onClick: () => {
        setCreateOpen(false);
        setDraftCategory("General");
        setComposerOpen(true);
      },
    },
    {
      label: "Share Career Update",
      icon: "briefcase",
      onClick: () => {
        setCreateOpen(false);
        setDraftCategory("Career");
        setComposerOpen(true);
      },
    },
    {
      label: "Events & Opportunities",
      icon: "calendar",
      onClick: () => {
        setCreateOpen(false);
        if (onOpenEvents) onOpenEvents();
        else {
          setDraftCategory("Events");
          setComposerOpen(true);
        }
      },
    },
  ];

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
          {(["For You", "My Posts"] as FeedFilter[]).map((item) => (
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
          <button
            className="feed-composer__prompt"
            onClick={() => {
              setDraftCategory("General");
              setComposerOpen(true);
            }}
          >
            Share something with your network...
          </button>
          <div className="feed-composer__attachments">
            <button
              aria-label="Attach image"
              onClick={() => setComposerOpen(true)}
            >
              <Icon name="image" />
            </button>
          </div>
        </section>

        {error && (
          <div className="error-banner" role="alert">
            <Icon name="alert" size={16} />
            {error}
          </div>
        )}

        {loading ? (
          <p style={{ textAlign: "center", padding: 24 }}>Loading live feed…</p>
        ) : displayedPosts.length === 0 ? (
          <div className="empty-state">
            <h3>
              {filter === "My Posts"
                ? "You haven’t posted yet"
                : "No posts yet"}
            </h3>
            <p>
              Start the conversation by sharing an update with the MSGI
              community.
            </p>
            <button onClick={() => setComposerOpen(true)}>
              Create first post
            </button>
          </div>
        ) : (
          <div className="feed-list">
            {displayedPosts.map((post, index) => (
              <FeedPostCard
                post={post}
                index={index}
                currentUserId={user?.id}
                onLikeToggle={handleLikeToggle}
                onDeletePost={handleDeletePost}
                onCommentCountDelta={handleCommentCountDelta}
                onOpenPerson={onOpenPerson}
                key={post.id}
              />
            ))}
          </div>
        )}
      </main>

      <div className={`feed-create ${createOpen ? "open" : ""}`}>
        {createOpen && (
          <div className="feed-create__menu" role="menu">
            {creationActions.map((action) => (
              <button
                role="menuitem"
                key={action.label}
                onClick={action.onClick}
              >
                <span>{action.label}</span>
                <i>
                  <Icon name={action.icon} size={17} />
                </i>
              </button>
            ))}
          </div>
        )}
        <button
          className="feed-create__trigger"
          onClick={() => setCreateOpen((v) => !v)}
          aria-label={createOpen ? "Close creation menu" : "Open creation menu"}
          aria-expanded={createOpen}
        >
          <Icon name={createOpen ? "close" : "plus"} />
        </button>
      </div>

      {composerOpen && (
        <div
          className="sheet-backdrop"
          onClick={() => !publishing && setComposerOpen(false)}
        >
          <section
            className="bottom-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Create a post"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sheet-handle" />
            <div className="sheet-head">
              <div>
                <p className="eyebrow">COMMUNITY FEED</p>
                <h2>Share with MSGI</h2>
              </div>
              <button
                type="button"
                onClick={() => setComposerOpen(false)}
                aria-label="Close composer"
              >
                <Icon name="close" />
              </button>
            </div>
            <form onSubmit={handlePublish} className="edit-form">
              <label className="field">
                <span>Category</span>
                <select
                  value={draftCategory}
                  onChange={(e) => setDraftCategory(e.target.value)}
                >
                  {postCategories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>What’s on your mind?</span>
                <textarea
                  rows={4}
                  placeholder="Share a milestone, opportunity, or campus memory…"
                  value={draftContent}
                  onChange={(e) => setDraftContent(e.target.value)}
                  required
                />
              </label>
              <label className="field">
                <span>Image URL (optional)</span>
                <input
                  type="url"
                  placeholder="https://..."
                  value={draftImageUrl}
                  onChange={(e) => setDraftImageUrl(e.target.value)}
                />
              </label>
              <button
                className="primary-button"
                type="submit"
                disabled={publishing || !draftContent.trim()}
              >
                {publishing ? "Publishing…" : "Publish post"}
              </button>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
