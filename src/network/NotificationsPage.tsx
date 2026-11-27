import { useEffect, useState } from "react";
import { Avatar, FrostedIcon, Icon, GlassPanel, type IconName } from "../ui/chrome";
import { Button, ChipGroup, EmptyState, InlineMessage } from "../settings/ui";
import {
  notificationCategories,
  requireAcknowledgement,
  type NetworkNotification,
  type NotificationCategory,
  type NotificationService,
  type NotificationTarget,
} from "./services";
import {
  filterNotifications,
  markNotificationsRead,
  notificationPresentation,
  validateNotifications,
} from "./model";
import { IconAction, NetworkPage } from "./ui";
import { useServiceAction } from "./useServiceAction";

export function NotificationCard({
  item,
  busy,
  onRead,
  onDismiss,
  onOpen,
}: {
  item: NetworkNotification;
  busy: boolean;
  onRead: () => void;
  onDismiss: () => void;
  onOpen: () => void;
}) {
  const presentation = notificationPresentation[item.kind];
  const date = new Date(item.createdAt);
  const dateLabel = date.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  return (
    <article className={`glass-panel network-notification ${item.read ? "is-read" : "is-unread"}`}>
      <div className="network-notification__avatar">
        {item.actor.image ? (
          <Avatar person={item.actor} />
        ) : (
          <FrostedIcon name={presentation.icon as IconName} />
        )}
      </div>
      <div className="network-notification__body">
        <div className="network-notification__meta">
          <span>{presentation.category}</span>
          <span className="network-read-status">
            {!item.read && <i aria-hidden />}
            {item.read ? "Read" : "Unread"}
          </span>
        </div>
        <p>
          <strong>{item.actor.name}</strong> {presentation.description}
        </p>
        {item.subject && <p className="network-notification__subject">{item.subject}</p>}
        <time dateTime={item.createdAt}>{dateLabel}</time>
        <div className="network-notification__actions">
          {item.target && (
            <Button
              variant="ghost"
              className="set-button--compact"
              disabled={busy}
              onClick={onOpen}
            >
              {presentation.action} <Icon name="chevron" size={14} />
            </Button>
          )}
          {!item.read && (
            <Button
              variant="ghost"
              className="set-button--compact"
              disabled={busy}
              onClick={onRead}
            >
              <Icon name="check" size={14} /> Mark as Read
            </Button>
          )}
        </div>
      </div>
      <IconAction
        icon="close"
        label={`Dismiss notification from ${item.actor.name}`}
        disabled={busy}
        onClick={onDismiss}
      />
    </article>
  );
}

export function NotificationsPage({
  service,
  onBack,
  onNavigate,
  onUnreadChange,
}: {
  service?: NotificationService;
  onBack: () => void;
  onNavigate: (target: NotificationTarget) => string | null;
  onUnreadChange: (unread: number) => void;
}) {
  const [items, setItems] = useState<NetworkNotification[]>([]);
  const [category, setCategory] = useState<NotificationCategory>("All");
  const [loading, setLoading] = useState(Boolean(service));
  const [loadError, setLoadError] = useState("");
  const [reload, setReload] = useState(0);
  const [notice, setNotice] = useState("");
  const action = useServiceAction();
  const unread = items.filter((item) => !item.read).length;
  const filtered = filterNotifications(items, category);
  useEffect(() => {
    if (!service) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setLoadError("");
    void (async () => {
      try {
        const response = validateNotifications(await service.list(controller.signal));
        if (!controller.signal.aborted) setItems(response);
      } catch {
        if (!controller.signal.aborted)
          setLoadError("We couldn’t load your notifications. Please try again.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [service, reload]);
  useEffect(() => {
    if (!loading && !loadError) onUnreadChange(unread);
  }, [unread, loading, loadError, onUnreadChange]);

  function markRead(ids: string[], target?: NotificationTarget) {
    if (!service || action.busy) return;
    setNotice("");
    void action.run(
      async (signal) => {
        if (ids.length) requireAcknowledgement((await service.markRead(ids, signal))?.saved);
      },
      () => {
        const next = markNotificationsRead(items, ids);
        setItems(next);
        // Navigation may unmount this page before its count effect can run.
        onUnreadChange(next.filter((item) => !item.read).length);
        if (target) {
          const problem = onNavigate(target);
          if (problem) action.setError(problem);
        } else
          setNotice(
            ids.length > 1 ? "All notifications marked as read." : "Notification marked as read.",
          );
      },
    );
  }
  function dismiss(item: NetworkNotification) {
    if (!service || action.busy) return;
    setNotice("");
    void action.run(
      async (signal) => {
        requireAcknowledgement((await service.dismiss(item.id, signal))?.saved);
      },
      () => {
        setItems((current) => current.filter((entry) => entry.id !== item.id));
        setNotice("Notification dismissed.");
      },
    );
  }

  return (
    <NetworkPage title="Notifications" onBack={onBack}>
      <p className="set-intro">Stay updated with what's happening across your network.</p>
      <ChipGroup
        label="Notification categories"
        options={notificationCategories.map((value) => ({ value, label: value }))}
        selected={[category]}
        onToggle={(next) => {
          setCategory(next);
          setNotice("");
        }}
      />
      <div className="network-notification-toolbar">
        <span aria-live="polite">{loading ? "Loading updates…" : `${unread} unread`}</span>
        <Button
          variant="ghost"
          className="set-button--compact"
          disabled={!unread || action.busy || loading || Boolean(loadError)}
          onClick={() => markRead(items.filter((item) => !item.read).map((item) => item.id))}
        >
          <Icon name="check" size={15} /> Mark All as Read
        </Button>
      </div>
      {!service && (
        <InlineMessage>
          Live notifications are not connected yet. No activity has been invented, and no read or
          dismiss actions will be saved until a notification service is connected.
        </InlineMessage>
      )}
      {loadError && (
        <InlineMessage
          tone="error"
          action={
            <Button variant="ghost" onClick={() => setReload((value) => value + 1)}>
              Try again
            </Button>
          }
        >
          {loadError}
        </InlineMessage>
      )}
      {action.error && <InlineMessage tone="error">{action.error}</InlineMessage>}
      <div className="set-visually-hidden" role="status">
        {notice}
      </div>
      {loading ? (
        <GlassPanel>
          <div className="network-notification-loading" role="status">
            <span className="set-spinner" aria-hidden /> Loading your notifications…
          </div>
        </GlassPanel>
      ) : (
        !loadError &&
        (filtered.length ? (
          <div
            className="network-notification-list"
            aria-label={`${category} notifications`}
            aria-busy={action.busy}
          >
            {filtered.map((item) => (
              <NotificationCard
                key={item.id}
                item={item}
                busy={action.busy}
                onRead={() => markRead([item.id])}
                onDismiss={() => dismiss(item)}
                onOpen={() => markRead(item.read ? [] : [item.id], item.target)}
              />
            ))}
          </div>
        ) : (
          <GlassPanel>
            <EmptyState
              icon="bell"
              title={
                category === "All"
                  ? "You’re all caught up"
                  : `No ${category.toLowerCase()} notifications`
              }
              description={
                service
                  ? "When there’s something new across your network, you’ll find it here."
                  : "Your network updates will appear here once live notifications are connected."
              }
              action={
                category !== "All" && (
                  <Button variant="ghost" onClick={() => setCategory("All")}>
                    View All Notifications
                  </Button>
                )
              }
            />
          </GlassPanel>
        ))
      )}
    </NetworkPage>
  );
}
