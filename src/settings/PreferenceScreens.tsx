import { useId, useMemo, useState } from "react";
import { FrostedIcon, Icon, type IconName } from "../ui/chrome";
import { createTranslator } from "./i18n";
import {
  careerOptions,
  communicationOptions,
  formatBytes,
  formatClock,
  getNotificationDecision,
  industryOptions,
  isWithinQuietHours,
  mentorshipOptions,
  MENTORSHIP_NOTE_MAX,
  networkingInterestOptions,
  nextQuietHoursChange,
  notificationGroups,
  opportunityOptions,
  parseTime,
  simulateRequest,
  textSizeOptions,
  themeOptions,
  validateMentorshipNote,
  validateQuietHours,
  weekdays,
  type CommunitySettings,
  type Language,
  type MediaItem,
  type NotificationCategory,
  type QuietHours,
  type ThemePreference,
  type Weekday,
} from "./model";
import {
  Button,
  ChipGroup,
  ConfirmSheet,
  EmptyState,
  InlineMessage,
  RadioRow,
  Section,
  SettingsPage,
  TextAreaField,
  TextField,
  ToggleRow,
  errorMessage,
  toggleInList,
  useNow,
  useSettings,
} from "./ui";

const themeIcons: Record<ThemePreference, IconName> = {
  light: "sun",
  dark: "moon",
  system: "monitor",
};

export function AppearanceScreen() {
  const { settings, update, t, notify, systemTheme } = useSettings();
  const { appearance } = settings;
  const textSizeId = useId();
  const setTheme = (theme: ThemePreference) => {
    if (theme === appearance.theme) return;
    update("appearance", (current) => ({ ...current, theme }));
    notify(t("theme.applied", { theme: t(`theme.${theme}`) }));
  };
  return (
    <SettingsPage title={t("appearance.title")} description={t("appearance.description")}>
      <Section
        title={t("appearance.theme")}
        groupProps={{ role: "radiogroup", "aria-label": t("appearance.theme") }}
        note={
          appearance.theme === "system"
            ? t("theme.systemNow", {
                theme: t(systemTheme === "dark" ? "theme.dark" : "theme.light"),
              })
            : undefined
        }
      >
        {themeOptions.map((option) => (
          <RadioRow
            key={option}
            icon={themeIcons[option]}
            title={t(`theme.${option}`)}
            description={t(`theme.${option}.desc`)}
            selected={appearance.theme === option}
            onSelect={() => setTheme(option)}
          />
        ))}
      </Section>
      <Section title={t("appearance.display")}>
        <div className="set-row set-row--block">
          <FrostedIcon name="type" />
          <span className="set-row__main set-row__main--stack">
            <span className="set-row__text">
              <b id={textSizeId}>{t("appearance.textSize")}</b>
              <small>{t("appearance.textSize.desc")}</small>
            </span>
            <span className="segmented set-segmented" role="radiogroup" aria-labelledby={textSizeId}>
              {textSizeOptions.map((size) => (
                <button
                  type="button"
                  key={size}
                  role="radio"
                  aria-checked={appearance.textSize === size}
                  className={appearance.textSize === size ? "active" : ""}
                  onClick={() => update("appearance", (current) => ({ ...current, textSize: size }))}
                >
                  <span className={`set-text-sample set-text-sample--${size}`} aria-hidden>
                    Aa
                  </span>
                  {t(`textSize.${size}`)}
                </button>
              ))}
            </span>
          </span>
        </div>
        <ToggleRow
          icon="motion"
          title={t("appearance.reduceMotion")}
          description={t("appearance.reduceMotion.desc")}
          checked={appearance.reduceMotion}
          onChange={(reduceMotion) => update("appearance", (current) => ({ ...current, reduceMotion }))}
        />
      </Section>
    </SettingsPage>
  );
}

function dayLabel(day: Weekday, locale: string) {
  // 5 January 2025 is a Sunday, so day offsets map to Weekday values.
  return new Intl.DateTimeFormat(locale, { weekday: "short" }).format(new Date(2025, 0, 5 + day));
}

const sameDays = (a: Weekday[], b: Weekday[]) =>
  a.length === b.length && b.every((day) => a.includes(day));

function QuietHoursPanel() {
  const { settings, update, t, locale } = useSettings();
  const saved = settings.notifications.quietHours;
  const [draft, setDraft] = useState<QuietHours>(saved);
  const now = useNow(30000);
  const error = validateQuietHours(draft);
  const apply = (next: QuietHours) => {
    setDraft(next);
    // Invalid schedules stay as drafts; the last valid schedule remains in effect.
    // The Do Not Disturb switch owns `enabled`; schedule edits only change times and days.
    if (!validateQuietHours(next))
      update("notifications", (current) => ({
        ...current,
        quietHours: { ...next, enabled: current.quietHours.enabled },
      }));
  };
  const presets: { label: string; days: Weekday[] }[] = [
    { label: t("dnd.everyDay"), days: [0, 1, 2, 3, 4, 5, 6] },
    { label: t("dnd.weekdays"), days: [1, 2, 3, 4, 5] },
    { label: t("dnd.weekends"), days: [0, 6] },
  ];
  const daysText =
    presets.find((preset) => sameDays(saved.days, preset.days))?.label ??
    weekdays
      .filter((day) => saved.days.includes(day))
      .map((day) => dayLabel(day, locale))
      .join(", ");
  const active = isWithinQuietHours(saved, now);
  const change = nextQuietHoursChange(saved, now);
  const changeText = change
    ? new Intl.DateTimeFormat(locale, {
        ...(change.toDateString() === now.toDateString() ? {} : { weekday: "short" }),
        hour: "numeric",
        minute: "2-digit",
      }).format(change)
    : "";
  const overnight = (parseTime(draft.end) ?? 0) < (parseTime(draft.start) ?? 0);

  return (
    <div className="set-subpanel">
      <div className="set-time-grid">
        <TextField
          id="dnd-start"
          label={t("dnd.start")}
          type="time"
          value={draft.start}
          onChange={(event) => apply({ ...draft, start: event.target.value })}
        />
        <TextField
          id="dnd-end"
          label={t("dnd.end")}
          type="time"
          value={draft.end}
          hint={overnight ? t("dnd.nextDay") : undefined}
          onChange={(event) => apply({ ...draft, end: event.target.value })}
        />
      </div>
      <p className="set-field-label" id="dnd-days-label">
        {t("dnd.days")}
      </p>
      <div className="set-days" role="group" aria-labelledby="dnd-days-label">
        {weekdays.map((day) => {
          const selected = draft.days.includes(day);
          return (
            <button
              type="button"
              key={day}
              aria-pressed={selected}
              className={selected ? "active" : ""}
              onClick={() => apply({ ...draft, days: toggleInList(draft.days, day) })}
            >
              {dayLabel(day, locale)}
            </button>
          );
        })}
      </div>
      <div className="set-presets">
        {presets.map((preset) => (
          <button
            type="button"
            key={preset.label}
            className="text-link"
            aria-pressed={sameDays(draft.days, preset.days)}
            onClick={() => apply({ ...draft, days: preset.days })}
          >
            {preset.label}
          </button>
        ))}
      </div>
      {error ? (
        <InlineMessage tone="error">{t(`dnd.error.${error}`)}</InlineMessage>
      ) : (
        <div className="set-summary" aria-live="polite">
          <Icon name="moon" size={18} />
          <div>
            <b>
              {t("dnd.summary", {
                start: formatClock(saved.start, locale),
                end: formatClock(saved.end, locale),
                days: daysText,
              })}
            </b>
            <small className={active ? "is-active" : ""}>
              {active
                ? t("dnd.activeNow", { time: changeText })
                : t("dnd.inactiveNow", { time: changeText })}
            </small>
          </div>
        </div>
      )}
    </div>
  );
}

const describedCategories: Partial<Record<NotificationCategory, string>> = {
  profileInteractions: "notifications.profileInteractions.desc",
  importantAnnouncements: "notifications.importantAnnouncements.desc",
};

export function NotificationsScreen() {
  const { settings, update, t, notify, locale } = useSettings();
  const notifications = settings.notifications;
  const setCategory = (category: NotificationCategory, value: boolean) =>
    update("notifications", (current) => ({
      ...current,
      categories: { ...current.categories, [category]: value },
    }));
  const sendTest = () => {
    const decision = getNotificationDecision(notifications, "newMessages", new Date());
    if (decision.deliver) notify(t("notifications.test.delivered"), "success");
    else if (decision.reason === "quietHours")
      notify(
        t("notifications.test.quietHours", {
          time: decision.until
            ? new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" }).format(
                decision.until,
              )
            : "",
        }),
        "info",
      );
    else notify(t(`notifications.test.${decision.reason}`), "info");
  };

  return (
    <SettingsPage title={t("notifications.title")} description={t("notifications.description")}>
      <Section
        note={
          !notifications.enabled && (
            <InlineMessage tone="warning">{t("notifications.pausedNote")}</InlineMessage>
          )
        }
      >
        <ToggleRow
          icon="bell"
          title={t("notifications.allow")}
          description={t("notifications.allow.desc")}
          checked={notifications.enabled}
          onChange={(enabled) => update("notifications", (current) => ({ ...current, enabled }))}
        />
      </Section>
      {notificationGroups.map((group) => (
        <Section key={group.key} title={t(`notifications.group.${group.key}`)}>
          {group.items.map((category) => (
            <ToggleRow
              key={category}
              title={t(`notifications.${category}`)}
              description={
                describedCategories[category]
                  ? t(describedCategories[category] as Parameters<typeof t>[0])
                  : undefined
              }
              checked={notifications.categories[category]}
              disabled={!notifications.enabled}
              onChange={(value) => setCategory(category, value)}
            />
          ))}
        </Section>
      ))}
      <Section
        title={t("notifications.group.delivery")}
        note={
          <>
            {!notifications.push && !notifications.email && (
              <InlineMessage tone="warning">{t("notifications.noChannel")}</InlineMessage>
            )}
            <p>{t("notifications.deliveryNote")}</p>
          </>
        }
      >
        <ToggleRow
          icon="smartphone"
          title={t("notifications.push")}
          description={t("notifications.push.desc")}
          checked={notifications.push}
          onChange={(push) => update("notifications", (current) => ({ ...current, push }))}
        />
        <ToggleRow
          icon="mail"
          title={t("notifications.email")}
          description={t("notifications.email.desc", { email: settings.account.email })}
          checked={notifications.email}
          onChange={(email) => update("notifications", (current) => ({ ...current, email }))}
        />
        <ToggleRow
          icon="moon"
          title={t("dnd.title")}
          description={t("dnd.desc")}
          checked={notifications.quietHours.enabled}
          onChange={(enabled) =>
            update("notifications", (current) => ({
              ...current,
              quietHours: { ...current.quietHours, enabled },
            }))
          }
        />
        {notifications.quietHours.enabled && <QuietHoursPanel />}
      </Section>
      <Section plain>
        <Button variant="secondary" className="set-button--block" onClick={sendTest}>
          <Icon name="send" size={17} />
          {t("notifications.test")}
        </Button>
      </Section>
    </SettingsPage>
  );
}

export function LanguageScreen() {
  const { settings, update, t, notify } = useSettings();
  const select = (language: Language) => {
    if (language === settings.language) return;
    update("language", language);
    notify(createTranslator(language)("language.saved"));
  };
  return (
    <SettingsPage title={t("language.title")} description={t("language.description")}>
      <Section
        groupProps={{ role: "radiogroup", "aria-label": t("language.title") }}
        note={
          <>
            <p>{t("language.note")}</p>
            {settings.language === "ta" && <p>{t("language.coverage")}</p>}
          </>
        }
      >
        <RadioRow
          icon="globe"
          title={<span lang="en">English</span>}
          description={t("language.english")}
          selected={settings.language === "en"}
          onSelect={() => select("en")}
        />
        <RadioRow
          icon="globe"
          title={<span lang="ta">தமிழ்</span>}
          description={t("language.tamil")}
          selected={settings.language === "ta"}
          onSelect={() => select("ta")}
        />
      </Section>
    </SettingsPage>
  );
}

const mediaIcons: Record<MediaItem["kind"], IconName> = {
  image: "palette",
  document: "file",
  video: "monitor",
};

export function StorageScreen() {
  const { settings, update, t, notify, locale } = useSettings();
  const { storage } = settings;
  const [confirm, setConfirm] = useState<"cache" | "all" | MediaItem | null>(null);
  const mediaBytes = storage.media.reduce((sum, item) => sum + item.bytes, 0);
  // Account and settings data is measured from the real saved record and is never cleared here.
  const protectedBytes = useMemo(
    () => new TextEncoder().encode(JSON.stringify(settings)).length,
    [settings],
  );
  const total = storage.cacheBytes + mediaBytes + protectedBytes;
  const share = (bytes: number) => (total ? Math.max((bytes / total) * 100, bytes ? 2 : 0) : 0);
  const local = { isOnline: () => true, delay: 500 };

  return (
    <SettingsPage title={t("storage.title")} description={t("storage.description")}>
      <Section title={t("storage.usage")} note={<p>{t("storage.prototypeNote")}</p>}>
        <div className="set-usage">
          <p className="set-usage__total">{t("storage.total", { size: formatBytes(total, locale) })}</p>
          <div className="set-usage__bar" aria-hidden>
            <span className="is-cache" style={{ width: `${share(storage.cacheBytes)}%` }} />
            <span className="is-media" style={{ width: `${share(mediaBytes)}%` }} />
            <span className="is-protected" style={{ width: `${share(protectedBytes)}%` }} />
          </div>
          <ul className="set-usage__legend">
            <li>
              <i className="is-cache" />
              {t("storage.cache")}
              <b>{formatBytes(storage.cacheBytes, locale)}</b>
            </li>
            <li>
              <i className="is-media" />
              {t("storage.media")}
              <b>{formatBytes(mediaBytes, locale)}</b>
            </li>
            <li>
              <i className="is-protected" />
              {t("storage.protected")}
              <b>{formatBytes(protectedBytes, locale)}</b>
            </li>
          </ul>
          <p className="set-usage__protected">
            <Icon name="shield" size={15} />
            {t("storage.protectedNote")}
          </p>
        </div>
      </Section>
      <Section>
        <button
          type="button"
          className="set-row"
          onClick={() =>
            storage.cacheBytes
              ? setConfirm("cache")
              : notify(t("storage.clearCache.empty"), "info")
          }
        >
          <FrostedIcon name="refresh" />
          <span className="set-row__main">
            <span className="set-row__text">
              <b>{t("storage.clearCache")}</b>
              <small>{t("storage.clearCache.desc")}</small>
            </span>
            <span className="set-row__trail">
              <span className="set-row__value">{formatBytes(storage.cacheBytes, locale)}</span>
            </span>
          </span>
        </button>
      </Section>
      <Section
        title={t("storage.downloads")}
        note={
          storage.media.length > 0 && (
            <Button variant="ghost" className="set-danger-link" onClick={() => setConfirm("all")}>
              <Icon name="trash" size={16} />
              {t("storage.deleteAll")}
            </Button>
          )
        }
      >
        {storage.media.length ? (
          storage.media.map((item) => (
            <div className="set-row" key={item.id}>
              <FrostedIcon name={mediaIcons[item.kind]} />
              <span className="set-row__main">
                <span className="set-row__text">
                  <b className="set-ellipsis">{item.name}</b>
                  <small>
                    {formatBytes(item.bytes, locale)} · {t("storage.from", { name: item.source })}
                  </small>
                </span>
                <span className="set-row__trail">
                  <button
                    type="button"
                    className="set-icon-action"
                    aria-label={`${t("storage.deleteOne.confirm")} ${item.name}`}
                    onClick={() => setConfirm(item)}
                  >
                    <Icon name="trash" size={17} />
                  </button>
                </span>
              </span>
            </div>
          ))
        ) : (
          <EmptyState
            icon="download"
            title={t("storage.empty")}
            description={t("storage.empty.desc")}
          />
        )}
      </Section>
      <Section title={t("storage.autoDownloads")}>
        <ToggleRow
          icon="download"
          title={t("storage.auto")}
          description={t("storage.auto.desc")}
          checked={storage.autoDownload}
          onChange={(autoDownload) => update("storage", (current) => ({ ...current, autoDownload }))}
        />
        <ToggleRow
          icon="wifi"
          title={t("storage.wifiOnly")}
          description={t("storage.wifiOnly.desc")}
          checked={storage.wifiOnly}
          disabled={!storage.autoDownload}
          onChange={(wifiOnly) => update("storage", (current) => ({ ...current, wifiOnly }))}
        />
      </Section>

      {confirm === "cache" && (
        <ConfirmSheet
          title={t("storage.clearCache.title")}
          body={t("storage.clearCache.body", { size: formatBytes(storage.cacheBytes, locale) })}
          confirmLabel={t("storage.clearCache.confirm")}
          onClose={() => setConfirm(null)}
          onConfirm={async () => {
            await simulateRequest(null, local);
            update("storage", (current) => ({ ...current, cacheBytes: 0 }));
            setConfirm(null);
            notify(t("storage.clearCache.done"));
          }}
        />
      )}
      {confirm === "all" && (
        <ConfirmSheet
          title={t("storage.deleteAll.title")}
          body={t("storage.deleteAll.body", {
            count: storage.media.length,
            size: formatBytes(mediaBytes, locale),
          })}
          confirmLabel={t("storage.deleteAll")}
          tone="danger"
          onClose={() => setConfirm(null)}
          onConfirm={async () => {
            await simulateRequest(null, local);
            update("storage", (current) => ({ ...current, media: [] }));
            setConfirm(null);
            notify(t("storage.deleteAll.done"));
          }}
        />
      )}
      {confirm && typeof confirm === "object" && (
        <ConfirmSheet
          title={t("storage.deleteOne.title", { name: confirm.name })}
          body={t("storage.deleteOne.body")}
          confirmLabel={t("storage.deleteOne.confirm")}
          tone="danger"
          onClose={() => setConfirm(null)}
          onConfirm={async () => {
            await simulateRequest(null, local);
            update("storage", (current) => ({
              ...current,
              media: current.media.filter((item) => item.id !== confirm.id),
            }));
            setConfirm(null);
            notify(t("storage.deleteOne.done"));
          }}
        />
      )}
    </SettingsPage>
  );
}

export function CommunityScreen() {
  const { settings, update, t, notify, back } = useSettings();
  const [draft, setDraft] = useState<CommunitySettings>(settings.community);
  const [saving, setSaving] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [error, setError] = useState("");
  const dirty = JSON.stringify(draft) !== JSON.stringify(settings.community);
  const noteError = validateMentorshipNote(draft.mentorshipNote);
  const change = (patch: Partial<CommunitySettings>) => {
    setError("");
    setDraft((current) => ({ ...current, ...patch }));
  };
  async function save() {
    if (noteError) return;
    setSaving(true);
    setError("");
    try {
      const saved = await simulateRequest({ ...draft, mentorshipNote: draft.mentorshipNote.trim() });
      update("community", saved);
      setDraft(saved);
      notify(t("community.saved"));
    } catch (caught) {
      setError(errorMessage(caught, t));
    } finally {
      setSaving(false);
    }
  }
  const leave = () => (dirty ? setConfirmDiscard(true) : back());

  return (
    <SettingsPage
      title={t("community.title")}
      description={t("community.description")}
      onBack={leave}
      footer={
        <>
          {error && <InlineMessage tone="error">{error}</InlineMessage>}
          {dirty && !error && <p className="set-footer__status">{t("common.unsaved")}</p>}
          <Button busy={saving} disabled={!dirty || Boolean(noteError)} onClick={save}>
            {t("common.saveChanges")}
          </Button>
        </>
      }
    >
      <Section title={t("community.networking")} plain note={<p>{t("community.chooseAll")}</p>}>
        <div className="glass-panel set-group set-group--padded">
          <ChipGroup
            label={t("community.networking")}
            options={networkingInterestOptions.map((value) => ({
              value,
              label: t(`interest.${value}`),
            }))}
            selected={draft.networkingInterests}
            onToggle={(value) =>
              change({ networkingInterests: toggleInList(draft.networkingInterests, value) })
            }
          />
        </div>
      </Section>
      <Section title={t("community.industries")} plain>
        <div className="glass-panel set-group set-group--padded">
          <ChipGroup
            label={t("community.industries")}
            options={industryOptions.map((value) => ({ value, label: t(`industry.${value}`) }))}
            selected={draft.industries}
            onToggle={(value) => change({ industries: toggleInList(draft.industries, value) })}
          />
        </div>
      </Section>
      <Section title={t("community.career")} plain>
        <div className="glass-panel set-group set-group--padded">
          <ChipGroup
            label={t("community.career")}
            options={careerOptions.map((value) => ({ value, label: t(`career.${value}`) }))}
            selected={draft.careerPreferences}
            onToggle={(value) =>
              change({ careerPreferences: toggleInList(draft.careerPreferences, value) })
            }
          />
        </div>
      </Section>
      <Section title={t("community.opportunities")}>
        {opportunityOptions.map((option) => (
          <ToggleRow
            key={option}
            title={t(`opportunity.${option}`)}
            checked={draft.opportunities[option]}
            onChange={(value) => change({ opportunities: { ...draft.opportunities, [option]: value } })}
          />
        ))}
      </Section>
      <Section title={t("community.mentorship")}>
        {mentorshipOptions.map((option) => (
          <ToggleRow
            key={option}
            title={t(`mentorship.${option}`)}
            checked={draft.mentorship[option]}
            onChange={(value) => change({ mentorship: { ...draft.mentorship, [option]: value } })}
          />
        ))}
        <div className="set-subpanel">
          <TextAreaField
            id="mentorship-note"
            label={t("community.note")}
            optional
            max={MENTORSHIP_NOTE_MAX}
            value={draft.mentorshipNote}
            placeholder={t("community.note.placeholder")}
            error={noteError ? t(`error.${noteError}`) : undefined}
            onChange={(event) => change({ mentorshipNote: event.target.value })}
          />
        </div>
      </Section>
      <Section
        title={t("community.communication")}
        groupProps={{ role: "radiogroup", "aria-label": t("community.communication") }}
      >
        {communicationOptions.map((option) => (
          <RadioRow
            key={option}
            icon={option === "inApp" ? "chat" : option === "email" ? "mail" : "monitor"}
            title={t(`communication.${option}`)}
            selected={draft.communication === option}
            onSelect={() => change({ communication: option })}
          />
        ))}
      </Section>
      <Section title={t("community.sharing")} note={<p>{t("community.usage")}</p>}>
        <ToggleRow
          icon="eye"
          title={t("community.share")}
          description={t("community.share.desc")}
          checked={draft.shareOnProfile}
          onChange={(shareOnProfile) => change({ shareOnProfile })}
        />
      </Section>

      {confirmDiscard && (
        <ConfirmSheet
          title={t("common.discardTitle")}
          body={t("common.discardDescription")}
          confirmLabel={t("common.discard")}
          cancelLabel={t("common.keepEditing")}
          tone="danger"
          onClose={() => setConfirmDiscard(false)}
          onConfirm={back}
        />
      )}
    </SettingsPage>
  );
}
