import { useCallback, useEffect, useMemo, useState, type ComponentType } from "react";
import "./settings.css";
import { Avatar, Icon, VerifyBadge } from "../ui/chrome";
import { AccountScreen, BlockedScreen, PrivacyScreen, SecurityScreen, ShareScreen } from "./AccountScreens";
import {
  AppearanceScreen,
  CommunityScreen,
  LanguageScreen,
  NotificationsScreen,
  StorageScreen,
} from "./PreferenceScreens";
import {
  AboutScreen,
  ContactScreen,
  GuidelinesScreen,
  HelpScreen,
  ReportProblemScreen,
  ReportUserScreen,
  TermsScreen,
} from "./SupportScreens";
import { APP_VERSION, formatBytes, isWithinQuietHours } from "./model";
import {
  ConfirmSheet,
  NavRow,
  Section,
  SettingsContext,
  SettingsPage,
  useNow,
  useSettings,
  type SettingsContextValue,
  type SettingsRoute,
  type ToastTone,
} from "./ui";

function MainSettings() {
  const { settings, t, navigate, logout, locale } = useSettings();
  const [confirmLogout, setConfirmLogout] = useState(false);
  const now = useNow();
  const { account, notifications, privacy, security, storage } = settings;
  const notificationValue = !notifications.enabled
    ? t("notifications.value.paused")
    : isWithinQuietHours(notifications.quietHours, now)
      ? t("notifications.value.quiet")
      : t("notifications.value.on");
  const storageUsed = storage.cacheBytes + storage.media.reduce((sum, item) => sum + item.bytes, 0);

  return (
    <SettingsPage title={t("settings.title")}>
      <button
        type="button"
        className="glass-panel set-account-card"
        onClick={() => navigate("account")}
      >
        <Avatar person={{ name: account.fullName, role: account.role, image: account.avatar }} size="lg" />
        <span className="set-account-card__text">
          <b>{account.fullName}</b>
          <span>
            {account.department} · {t("account.classOf", { year: account.graduationYear })}
          </span>
          {account.verified && <VerifyBadge label={t("account.alumni")} />}
          <small>{t("settings.manageAccount")}</small>
        </span>
        <Icon name="chevron" size={16} className="set-row__chevron" />
      </button>

      <Section title={t("settings.group.preferences")}>
        <NavRow
          icon="palette"
          title={t("appearance.title")}
          description={t("appearance.row")}
          value={t(`theme.${settings.appearance.theme}`)}
          onClick={() => navigate("appearance")}
        />
        <NavRow
          icon="bell"
          title={t("notifications.title")}
          description={t("notifications.row")}
          value={notificationValue}
          onClick={() => navigate("notifications")}
        />
        <NavRow
          icon="globe"
          title={t("language.title")}
          value={settings.language === "ta" ? "தமிழ்" : "English"}
          onClick={() => navigate("language")}
        />
        <NavRow
          icon="database"
          title={t("storage.title")}
          description={t("storage.row")}
          value={formatBytes(storageUsed, locale)}
          onClick={() => navigate("storage")}
        />
      </Section>

      <Section title={t("settings.group.account")}>
        <NavRow
          icon="user"
          title={t("account.title")}
          description={t("account.row")}
          onClick={() => navigate("account")}
        />
        <NavRow
          icon="qr"
          title={t("share.title")}
          description={t("share.row")}
          onClick={() => navigate("share")}
        />
        <NavRow
          icon="shield"
          title={t("privacy.title")}
          description={t("privacy.row")}
          value={t(`visibility.${privacy.profileVisibility}`)}
          onClick={() => navigate("privacy")}
        />
        <NavRow
          icon="lock"
          title={t("security.title")}
          description={t("security.row")}
          value={security.twoFactor ? t("security.value.on") : t("security.value.off")}
          onClick={() => navigate("security")}
        />
        <NavRow
          icon="users"
          title={t("community.title")}
          description={t("community.row")}
          onClick={() => navigate("community")}
        />
      </Section>

      <Section title={t("settings.group.support")}>
        <NavRow
          icon="help"
          title={t("help.title")}
          description={t("help.row")}
          onClick={() => navigate("help")}
        />
        <NavRow
          icon="file"
          title={t("terms.title")}
          description={t("terms.row")}
          onClick={() => navigate("terms")}
        />
        <NavRow
          icon="info"
          title={t("about.title")}
          description={t("about.row")}
          onClick={() => navigate("about")}
        />
      </Section>

      <div className="glass-panel set-group set-logout-group">
        <button type="button" className="set-logout" onClick={() => setConfirmLogout(true)}>
          <Icon name="logout" size={18} />
          {t("logout.action")}
        </button>
      </div>
      <p className="set-version">{t("settings.version", { version: APP_VERSION })}</p>
      <p className="set-footnote">{t("settings.localNote")}</p>

      {confirmLogout && (
        <ConfirmSheet
          title={t("logout.title")}
          body={t("logout.description")}
          confirmLabel={t("logout.confirm")}
          tone="danger"
          onConfirm={() => logout()}
          onClose={() => setConfirmLogout(false)}
        />
      )}
    </SettingsPage>
  );
}

const screens: Record<SettingsRoute, ComponentType> = {
  main: MainSettings,
  appearance: AppearanceScreen,
  notifications: NotificationsScreen,
  language: LanguageScreen,
  storage: StorageScreen,
  account: AccountScreen,
  share: ShareScreen,
  privacy: PrivacyScreen,
  blocked: BlockedScreen,
  security: SecurityScreen,
  community: CommunityScreen,
  help: HelpScreen,
  contact: ContactScreen,
  "report-problem": ReportProblemScreen,
  "report-user": ReportUserScreen,
  guidelines: GuidelinesScreen,
  terms: TermsScreen,
  about: AboutScreen,
};

export type SettingsFlowProps = Omit<SettingsContextValue, "notify" | "sheetHost"> & {
  route: SettingsRoute;
  depth: number;
};

export default function SettingsFlow({ route, depth, ...context }: SettingsFlowProps) {
  const [toast, setToast] = useState<{ id: number; message: string; tone: ToastTone } | null>(
    null,
  );
  const notify = useCallback(
    (message: string, tone: ToastTone = "success") =>
      setToast({ id: Date.now(), message, tone }),
    [],
  );
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);
  const [sheetHost, setSheetHost] = useState<HTMLDivElement | null>(null);
  const value = useMemo(() => ({ ...context, notify, sheetHost }), [context, notify, sheetHost]);
  const Screen = screens[route];
  return (
    <SettingsContext.Provider value={value}>
      <Screen key={`${route}-${depth}`} />
      <div ref={setSheetHost} className="set-sheet-host" />
      {toast && (
        <div
          key={toast.id}
          className={`set-toast set-toast--${toast.tone}`}
          role={toast.tone === "error" ? "alert" : "status"}
        >
          <Icon name={toast.tone === "error" ? "alert" : toast.tone === "info" ? "info" : "check"} size={16} />
          {toast.message}
        </div>
      )}
    </SettingsContext.Provider>
  );
}
