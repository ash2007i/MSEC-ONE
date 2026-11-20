import { useState } from "react";
import {
  Avatar,
  Icon,
  MainHeader,
  type AvatarPerson,
  type IconName,
} from "../ui/chrome";
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

const creationActions: { label: string; icon: IconName }[] = [
  { label: "Create a Post", icon: "image" },
  { label: "Write an Article", icon: "file" },
  { label: "Post an Opportunity", icon: "briefcase" },
  { label: "Create an Event", icon: "calendar" },
];

function FeedPost({
  post,
  index,
}: {
  post: (typeof posts)[number];
  index: number;
}) {
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
    <article className="feed-post">
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
}: {
  profile: AvatarPerson;
  onProfile: () => void;
}) {
  const [filter, setFilter] = useState<FeedFilter>("For You");
  const [createOpen, setCreateOpen] = useState(false);

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
            Share something with your network...
          </button>
          <div className="feed-composer__attachments">
            <button aria-label="Attach image">
              <Icon name="image" />
            </button>
            <button aria-label="Attach video">
              <Icon name="video" />
            </button>
            <button aria-label="Attach document">
              <Icon name="file" />
            </button>
          </div>
        </section>
        <div className="feed-list">
          {posts.map((post, index) => (
            <FeedPost post={post} index={index} key={post.author.name} />
          ))}
        </div>
      </main>

      <div className={`feed-create ${createOpen ? "open" : ""}`}>
        {createOpen && (
          <div className="feed-create__menu" role="menu">
            {creationActions.map((action) => (
              <button role="menuitem" key={action.label}>
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
          onClick={() => setCreateOpen((value) => !value)}
          aria-label={createOpen ? "Close creation menu" : "Open creation menu"}
          aria-expanded={createOpen}
        >
          <Icon name={createOpen ? "close" : "plus"} />
        </button>
      </div>
    </div>
  );
}
