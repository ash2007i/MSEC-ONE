import { useEffect, useMemo, useState } from "react";
import type { EmojiMartData } from "@emoji-mart/data";
import { ChatIcon, type ChatIconName } from "./ChatIcon";

const categories: { id: string; label: string; icon: ChatIconName }[] = [
  { id: "people", label: "Smileys & people", icon: "smile" },
  { id: "nature", label: "Animals & nature", icon: "nature" },
  { id: "foods", label: "Food & drink", icon: "food" },
  { id: "activity", label: "Activities", icon: "activity" },
  { id: "places", label: "Travel & places", icon: "travel" },
  { id: "objects", label: "Objects", icon: "object" },
  { id: "symbols", label: "Symbols", icon: "symbol" },
  { id: "flags", label: "Flags", icon: "flag" },
];
let recent = ["❤️", "🎉", "👍", "😂", "🔥", "💯", "😊", "👏"];

export function EmojiPicker({ onSelect }: { onSelect: (emoji: string) => void }) {
  const [data, setData] = useState<EmojiMartData | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("people");
  const [skin, setSkin] = useState(0);
  useEffect(() => {
    let active = true;
    setError(false);
    import("@emoji-mart/data/sets/15/native.json")
      .then((module) => {
        if (active) setData(module.default as EmojiMartData);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [attempt]);
  const emojis = useMemo(() => {
    if (!data) return [];
    const ids = query.trim()
      ? Object.keys(data.emojis)
      : data.categories.find((c) => c.id === category)?.emojis || [];
    return ids
      .map((id) => data.emojis[id])
      .filter(
        (emoji) =>
          emoji &&
          (!query.trim() ||
            `${emoji.name} ${emoji.id} ${emoji.keywords.join(" ")}`
              .toLowerCase()
              .includes(query.trim().toLowerCase())),
      );
  }, [data, query, category]);
  function choose(emoji: string) {
    recent = [emoji, ...recent.filter((item) => item !== emoji)].slice(0, 16);
    onSelect(emoji);
  }
  return (
    <div className="msg-emoji-picker">
      <label className="msg-search">
        <ChatIcon name="search" size={17} />
        <input
          autoFocus
          placeholder="Search emojis"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      <div className="msg-emoji-categories" role="tablist" aria-label="Emoji categories">
        {categories.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-label={item.label}
            aria-selected={category === item.id && !query}
            title={item.label}
            onClick={() => {
              setCategory(item.id);
              setQuery("");
            }}
          >
            <ChatIcon name={item.icon} size={18} />
          </button>
        ))}
      </div>
      <div
        className="msg-emoji-scroll"
        role="tabpanel"
        aria-label={
          query ? "Emoji search results" : categories.find((c) => c.id === category)?.label
        }
      >
        {!query && (
          <>
            <p className="msg-overline">Recently used</p>
            <div className="msg-emoji-grid">
              {recent.map((emoji) => (
                <button
                  className="msg-native-emoji"
                  key={emoji}
                  aria-label={`Recent ${emoji}`}
                  onClick={() => choose(emoji)}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </>
        )}
        <div className="msg-emoji-label">
          <p className="msg-overline">
            {query ? `${emojis.length} results` : categories.find((c) => c.id === category)?.label}
          </p>
          <select
            aria-label="Emoji skin tone"
            value={skin}
            onChange={(e) => setSkin(Number(e.target.value))}
          >
            <option value={0}>Default tone</option>
            <option value={1}>Light</option>
            <option value={2}>Medium-light</option>
            <option value={3}>Medium</option>
            <option value={4}>Medium-dark</option>
            <option value={5}>Dark</option>
          </select>
        </div>
        {!data ? (
          <p className="msg-panel-note" role="status">
            {error ? (
              <>
                <span>Emojis couldn’t load.</span>
                <button className="msg-text-button" onClick={() => setAttempt(attempt + 1)}>
                  Try again
                </button>
              </>
            ) : (
              "Loading emojis…"
            )}
          </p>
        ) : (
          <div className="msg-emoji-grid">
            {emojis.map((emoji) => {
              const native = (emoji.skins[skin] || emoji.skins[0]).native;
              return (
                <button
                  className="msg-native-emoji"
                  key={emoji.id}
                  title={emoji.name}
                  aria-label={emoji.name}
                  onClick={() => choose(native)}
                >
                  {native}
                </button>
              );
            })}
          </div>
        )}
        {data && !emojis.length && (
          <p className="msg-panel-note">No emojis found. Try “smile”, “celebrate” or “heart”.</p>
        )}
      </div>
    </div>
  );
}
