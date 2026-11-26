import { useMemo, useRef, useState, type ChangeEvent } from "react";
import qrcode from "qrcode-generator";
import {
  Avatar,
  FrostedIcon,
  Icon,
  VerifyBadge,
  type IconName,
} from "../ui/chrome";
import { useAuth } from "../backend/AuthContext";
import {
  signIn as backendSignIn,
  updatePassword as backendUpdatePassword,
} from "../backend/auth";
import { updateMyProfile, upsertMyPrivateDetails } from "../backend/profile";
import { supabase } from "../backend/supabase";
import {
  audienceOptions,
  checkPassword,
  formatRelative,
  normalizePhone,
  personalFields,
  profileVisibilityOptions,
  simulateRequest,
  validateEmail,
  validateFullName,
  validatePhone,
  type Audience,
  type DeviceType,
  type ProfileVisibility,
  type Session,
  type TwoFactorMethod,
} from "./model";
import {
  Button,
  ChoiceSheet,
  ConfirmSheet,
  DetailRow,
  EmptyState,
  InlineMessage,
  NavRow,
  RadioRow,
  Section,
  SettingsPage,
  Sheet,
  SheetActions,
  TextField,
  ToggleRow,
  errorMessage,
  useNow,
  useSettings,
  type ToastTone,
} from "./ui";

/* ---------- Shared sheets ---------- */

function useAsyncAction() {
  const { t } = useSettings();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await action();
      return true;
    } catch (caught) {
      setError(errorMessage(caught, t));
      return false;
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, setError, run };
}

export function PasswordSheet({ onClose }: { onClose: () => void }) {
  const { t, settings, update, notify } = useSettings();
  const [values, setValues] = useState({ current: "", next: "", confirm: "" });
  const [visible, setVisible] = useState(false);
  const [touched, setTouched] = useState(false);
  const { busy, error, run } = useAsyncAction();
  const { rules, valid } = checkPassword(
    values.current,
    values.next,
    values.confirm,
  );
  const set =
    (key: keyof typeof values) => (event: ChangeEvent<HTMLInputElement>) =>
      setValues((current) => ({ ...current, [key]: event.target.value }));
  async function submit() {
    setTouched(true);
    if (!valid) return;
    const ok = await run(async () => {
      await backendSignIn(settings.account.email, values.current);
      await backendUpdatePassword(values.next);
    });
    if (!ok) return;
    update("security", (current) => ({
      ...current,
      passwordChangedAt: new Date().toISOString(),
    }));
    notify(t("password.saved"));
    onClose();
  }
  return (
    <Sheet title={t("password.title")} onClose={() => !busy && onClose()}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <TextField
          id="password-current"
          label={t("password.current")}
          icon="lock"
          type={visible ? "text" : "password"}
          autoComplete="current-password"
          value={values.current}
          onChange={set("current")}
          error={
            touched && !values.current ? t("error.passwordRequired") : undefined
          }
        />
        <TextField
          id="password-new"
          label={t("password.new")}
          icon="key"
          type={visible ? "text" : "password"}
          autoComplete="new-password"
          value={values.next}
          onChange={set("next")}
        />
        <TextField
          id="password-confirm"
          label={t("password.confirm")}
          icon="key"
          type={visible ? "text" : "password"}
          autoComplete="new-password"
          value={values.confirm}
          onChange={set("confirm")}
        />
        <ul className="set-checklist" aria-label={t("password.new")}>
          {(Object.keys(rules) as (keyof typeof rules)[]).map((rule) => (
            <li
              key={rule}
              className={rules[rule] ? "is-met" : touched ? "is-missing" : ""}
            >
              <Icon name={rules[rule] ? "check" : "minus"} size={14} />
              {t(`password.rule.${rule}`)}
            </li>
          ))}
        </ul>
        <label className="set-check">
          <input
            type="checkbox"
            checked={visible}
            onChange={(event) => setVisible(event.target.checked)}
          />
          {t("password.show")}
        </label>
        {error && <InlineMessage tone="error">{error}</InlineMessage>}
        <SheetActions>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" busy={busy}>
            {t("password.submit")}
          </Button>
        </SheetActions>
      </form>
    </Sheet>
  );
}

function NameSheet({ onClose }: { onClose: () => void }) {
  const { t, settings, update, notify } = useSettings();
  const { refreshProfile } = useAuth();
  const [name, setName] = useState(settings.account.fullName);
  const [touched, setTouched] = useState(false);
  const { busy, error, run } = useAsyncAction();
  const validation = validateFullName(name);
  async function save() {
    setTouched(true);
    if (validation) return;
    const fullName = name.trim().replace(/\s+/g, " ");
    const ok = await run(async () => {
      await updateMyProfile({ full_name: fullName });
      await refreshProfile();
    });
    if (!ok) return;
    update("account", (current) => ({ ...current, fullName }));
    notify(t("account.name.saved"));
    onClose();
  }
  return (
    <Sheet title={t("account.name.title")} onClose={() => !busy && onClose()}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <TextField
          id="account-name"
          label={t("account.fullName")}
          icon="user"
          autoComplete="name"
          value={name}
          maxLength={80}
          onChange={(event) => setName(event.target.value)}
          error={touched && validation ? t(`error.${validation}`) : undefined}
        />
        {error && <InlineMessage tone="error">{error}</InlineMessage>}
        <SheetActions>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            {t("common.cancel")}
          </Button>
          <Button
            type="submit"
            busy={busy}
            disabled={name.trim() === settings.account.fullName}
          >
            {t("common.save")}
          </Button>
        </SheetActions>
      </form>
    </Sheet>
  );
}

/** Email and phone changes require the current password and an explicit confirmation step. */
function ContactChangeSheet({
  kind,
  onClose,
}: {
  kind: "email" | "phone";
  onClose: () => void;
}) {
  const { t, settings, update, notify } = useSettings();
  const { refreshProfile } = useAuth();
  const current = settings.account[kind];
  const [value, setValue] = useState("");
  const [password, setPassword] = useState("");
  const [touched, setTouched] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const validation =
    kind === "email"
      ? validateEmail(value, current)
      : validatePhone(value, current);
  const formatted =
    kind === "email" ? value.trim() : value.trim().replace(/\s+/g, " ");
  if (confirming)
    return (
      <ConfirmSheet
        title={t(
          kind === "email"
            ? "account.email.confirmTitle"
            : "account.phone.confirmTitle",
        )}
        body={
          <>
            <p>
              {t(
                kind === "email"
                  ? "account.email.confirmBody"
                  : "account.phone.confirmBody",
                {
                  value: formatted,
                },
              )}
            </p>
            <p className="set-sheet__muted">{t("account.serverNote")}</p>
          </>
        }
        confirmLabel={t("account.confirmChange")}
        onClose={() => setConfirming(false)}
        onConfirm={async () => {
          await backendSignIn(settings.account.email, password);
          if (kind === "phone") {
            await upsertMyPrivateDetails({ phone: formatted });
            await refreshProfile();
          } else {
            const { error } = await supabase.auth.updateUser({
              email: formatted,
            });
            if (error) throw error;
          }
          update("account", (account) => ({ ...account, [kind]: formatted }));
          if (kind === "phone")
            update("security", (security) =>
              normalizePhone(security.recoveryPhone) === normalizePhone(current)
                ? { ...security, recoveryPhone: formatted }
                : security,
            );
          notify(
            t(kind === "email" ? "account.email.saved" : "account.phone.saved"),
          );
          onClose();
        }}
      />
    );
  return (
    <Sheet
      title={t(
        kind === "email" ? "account.changeEmail" : "account.changePhone",
      )}
      onClose={onClose}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setTouched(true);
          if (!validation && password) setConfirming(true);
        }}
      >
        <DetailRow
          icon={kind === "email" ? "mail" : "phone"}
          label={t(kind === "email" ? "account.email" : "account.phone")}
          value={current}
        />
        <TextField
          id={`account-${kind}`}
          label={t(
            kind === "email" ? "account.email.new" : "account.phone.new",
          )}
          icon={kind === "email" ? "mail" : "phone"}
          type={kind === "email" ? "email" : "tel"}
          inputMode={kind === "email" ? "email" : "tel"}
          autoComplete={kind === "email" ? "email" : "tel"}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          error={touched && validation ? t(`error.${validation}`) : undefined}
        />
        <TextField
          id={`account-${kind}-password`}
          label={t("account.currentPassword")}
          icon="lock"
          type="password"
          autoComplete="current-password"
          value={password}
          hint={t("account.passwordHint")}
          onChange={(event) => setPassword(event.target.value)}
          error={touched && !password ? t("error.passwordRequired") : undefined}
        />
        <SheetActions>
          <Button variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="submit">{t("common.continue")}</Button>
        </SheetActions>
      </form>
    </Sheet>
  );
}

function ConnectedAccountsSheet({ onClose }: { onClose: () => void }) {
  const { t, settings, update, notify } = useSettings();
  const [disconnecting, setDisconnecting] = useState<
    "linkedin" | "google" | null
  >(null);
  const [pending, setPending] = useState<"linkedin" | "google" | null>(null);
  const [error, setError] = useState("");
  const accounts = settings.account.connectedAccounts;
  const setConnected = (provider: "linkedin" | "google", value: boolean) =>
    update("account", (current) => ({
      ...current,
      connectedAccounts: { ...current.connectedAccounts, [provider]: value },
    }));
  if (disconnecting) {
    const provider = t(`connected.${disconnecting}`);
    return (
      <ConfirmSheet
        title={t("connected.disconnectTitle", { provider })}
        body={t("connected.disconnectBody", { provider })}
        confirmLabel={t("connected.disconnect")}
        tone="danger"
        onClose={() => setDisconnecting(null)}
        onConfirm={async () => {
          await simulateRequest(true);
          setConnected(disconnecting, false);
          notify(t("connected.disconnectedToast", { provider }));
          setDisconnecting(null);
        }}
      />
    );
  }
  async function connect(provider: "linkedin" | "google") {
    setPending(provider);
    setError("");
    try {
      await simulateRequest(true);
      setConnected(provider, true);
      notify(
        t("connected.connectedToast", { provider: t(`connected.${provider}`) }),
      );
    } catch (caught) {
      setError(errorMessage(caught, t));
    } finally {
      setPending(null);
    }
  }
  return (
    <Sheet title={t("connected.title")} onClose={onClose}>
      <p className="set-sheet__body">{t("connected.description")}</p>
      <div className="set-group set-group--sheet">
        {(["linkedin", "google"] as const).map((provider) => (
          <div className="set-row" key={provider}>
            <FrostedIcon
              name={provider === "linkedin" ? "linkedin" : "globe"}
            />
            <span className="set-row__main">
              <span className="set-row__text">
                <b>{t(`connected.${provider}`)}</b>
                <small>
                  {accounts[provider]
                    ? t("connected.on")
                    : t("connected.offState")}
                </small>
              </span>
              <span className="set-row__trail">
                <Button
                  variant={accounts[provider] ? "secondary" : "primary"}
                  className="set-button--compact"
                  busy={pending === provider}
                  onClick={() =>
                    accounts[provider]
                      ? setDisconnecting(provider)
                      : void connect(provider)
                  }
                >
                  {accounts[provider]
                    ? t("connected.disconnect")
                    : t("connected.connect")}
                </Button>
              </span>
            </span>
          </div>
        ))}
      </div>
      {error && <InlineMessage tone="error">{error}</InlineMessage>}
      <p className="set-sheet__muted">{t("connected.note")}</p>
    </Sheet>
  );
}

function DeleteAccountFlow({ onClose }: { onClose: () => void }) {
  const { t, deleteAccount } = useSettings();
  const [step, setStep] = useState<1 | 2>(1);
  const [typed, setTyped] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  if (step === 1)
    return (
      <ConfirmSheet
        title={t("delete.title")}
        body={
          <>
            <p>{t("delete.intro")}</p>
            <ul className="set-consequences">
              {(
                [
                  "delete.point1",
                  "delete.point2",
                  "delete.point3",
                  "delete.point4",
                ] as const
              ).map((key) => (
                <li key={key}>
                  <Icon name="alert" size={15} />
                  {t(key)}
                </li>
              ))}
            </ul>
          </>
        }
        confirmLabel={t("common.continue")}
        tone="danger"
        onClose={onClose}
        onConfirm={() => setStep(2)}
      />
    );
  return (
    <ConfirmSheet
      title={t("delete.confirmTitle")}
      confirmLabel={t("delete.confirm")}
      tone="danger"
      confirmDisabled={typed.trim() !== "DELETE" || !acknowledged}
      onClose={onClose}
      onConfirm={async () => {
        await simulateRequest(true, { delay: 900 });
        deleteAccount();
      }}
    >
      <TextField
        id="delete-confirm"
        label={t("delete.typeLabel")}
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        value={typed}
        onChange={(event) => setTyped(event.target.value)}
      />
      <label className="set-check">
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(event) => setAcknowledged(event.target.checked)}
        />
        {t("delete.acknowledge")}
      </label>
    </ConfirmSheet>
  );
}

/* ---------- Account information ---------- */

type AccountSheet =
  | "name"
  | "email"
  | "phone"
  | "password"
  | "connected"
  | "deactivate"
  | "delete";

export function AccountScreen() {
  const { t, settings, logout } = useSettings();
  const [sheet, setSheet] = useState<AccountSheet | null>(null);
  const { account } = settings;
  const close = () => setSheet(null);
  const editIcon = <Icon name="edit" size={16} className="set-row__chevron" />;
  return (
    <SettingsPage
      title={t("account.title")}
      description={t("account.description")}
    >
      <div className="glass-panel set-account-card set-account-card--static">
        <Avatar
          person={{
            name: account.fullName,
            role: account.role,
            image: account.avatar,
          }}
          size="lg"
        />
        <span className="set-account-card__text">
          <b>{account.fullName}</b>
          <span>{account.email}</span>
          {account.verified && <VerifyBadge label={t("account.alumni")} />}
        </span>
      </div>
      <Section title={t("account.details")}>
        <DetailRow
          icon="user"
          label={t("account.fullName")}
          value={account.fullName}
          trailing={editIcon}
          onClick={() => setSheet("name")}
        />
        <DetailRow
          icon="mail"
          label={t("account.email")}
          value={<span className="set-ellipsis">{account.email}</span>}
          trailing={editIcon}
          onClick={() => setSheet("email")}
        />
        <DetailRow
          icon="phone"
          label={t("account.phone")}
          value={account.phone}
          trailing={editIcon}
          onClick={() => setSheet("phone")}
        />
      </Section>
      <Section
        title={t("account.institutionDetails")}
        note={<p>{t("account.lockedNote")}</p>}
      >
        <DetailRow
          icon="book"
          label={t("account.department")}
          value={account.department}
          trailing={<Icon name="lock" size={15} className="set-row__chevron" />}
        />
        <DetailRow
          icon="calendar"
          label={t("account.graduationYear")}
          value={account.graduationYear}
          trailing={<Icon name="lock" size={15} className="set-row__chevron" />}
        />
        <DetailRow
          icon="building"
          label={t("account.institution")}
          value={account.institution}
        />
        <DetailRow
          icon="users"
          label={t("account.status")}
          value={t("account.alumni")}
        />
        <DetailRow
          icon="shield"
          label={t("account.verification")}
          value={
            account.verified ? (
              <span className="set-verified">
                <Icon name="check" size={14} />
                {t("account.verified")}
              </span>
            ) : (
              <span>Pending verification</span>
            )
          }
        />
      </Section>
      <Section title={t("account.actions")}>
        <NavRow
          icon="mail"
          title={t("account.changeEmail")}
          onClick={() => setSheet("email")}
        />
        <NavRow
          icon="phone"
          title={t("account.changePhone")}
          onClick={() => setSheet("phone")}
        />
        <NavRow
          icon="key"
          title={t("account.changePassword")}
          onClick={() => setSheet("password")}
        />
        <NavRow
          icon="link"
          title={t("account.connected")}
          onClick={() => setSheet("connected")}
        />
      </Section>
      <Section>
        <NavRow
          icon="eyeOff"
          title={t("account.deactivate")}
          tone="danger"
          onClick={() => setSheet("deactivate")}
        />
        <NavRow
          icon="trash"
          title={t("account.delete")}
          tone="danger"
          onClick={() => setSheet("delete")}
        />
      </Section>

      {sheet === "name" && <NameSheet onClose={close} />}
      {(sheet === "email" || sheet === "phone") && (
        <ContactChangeSheet kind={sheet} onClose={close} />
      )}
      {sheet === "password" && <PasswordSheet onClose={close} />}
      {sheet === "connected" && <ConnectedAccountsSheet onClose={close} />}
      {sheet === "deactivate" && (
        <ConfirmSheet
          title={t("deactivate.title")}
          body={t("deactivate.body")}
          confirmLabel={t("deactivate.confirm")}
          tone="danger"
          onClose={close}
          onConfirm={async () => {
            await simulateRequest(true, { delay: 800 });
            logout(t("deactivate.notice"));
          }}
        />
      )}
      {sheet === "delete" && <DeleteAccountFlow onClose={close} />}
    </SettingsPage>
  );
}

/* ---------- Share profile ---------- */

function QrCode({ value, label }: { value: string; label: string }) {
  const { path, size } = useMemo(() => {
    const qr = qrcode(0, "M");
    qr.addData(value);
    qr.make();
    const count = qr.getModuleCount();
    let d = "";
    for (let row = 0; row < count; row++)
      for (let col = 0; col < count; col++)
        if (qr.isDark(row, col)) d += `M${col} ${row}h1v1h-1z`;
    return { path: d, size: count };
  }, [value]);
  // Quiet zone of four modules keeps the code scannable; colours stay fixed in both themes.
  return (
    <svg
      className="set-qr"
      viewBox={`-4 -4 ${size + 8} ${size + 8}`}
      role="img"
      aria-label={label}
      shapeRendering="crispEdges"
      data-qr-value={value}
    >
      <rect x={-4} y={-4} width={size + 8} height={size + 8} fill="#ffffff" />
      <path d={path} fill="#0b1f45" />
    </svg>
  );
}

async function copyText(text: string, fallbackInput: HTMLInputElement | null) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the selection-based fallback.
  }
  if (!fallbackInput) return false;
  fallbackInput.focus();
  fallbackInput.select();
  try {
    return document.execCommand("copy");
  } catch {
    return false;
  }
}

export function ShareScreen() {
  const { t, settings, profileUrl, notify, navigate, previewProfile } =
    useSettings();
  const { account, privacy } = settings;
  const inputRef = useRef<HTMLInputElement>(null);
  async function copy(
    toastTone: ToastTone = "success",
    message = t("share.copied"),
  ) {
    const ok = await copyText(profileUrl, inputRef.current);
    if (ok) notify(message, toastTone);
    else {
      inputRef.current?.select();
      notify(t("share.copyFailed"), "error");
    }
  }
  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${account.fullName} · MSGI One`,
          text: t("share.shareText"),
          url: profileUrl,
        });
        return;
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === "AbortError")
          return;
      }
    }
    await copy("info", t("share.unsupported"));
  }
  const access = privacy.profileVisibility;
  return (
    <SettingsPage title={t("share.title")} description={t("share.description")}>
      <div className="glass-panel set-share-card">
        <div className="set-share-card__person">
          <Avatar
            person={{
              name: account.fullName,
              role: account.role,
              image: account.avatar,
            }}
            size="md"
          />
          <div>
            <b>{account.fullName}</b>
            <span>
              {account.department} ·{" "}
              {t("account.classOf", { year: account.graduationYear })}
            </span>
          </div>
        </div>
        <div className="set-qr-frame">
          <QrCode
            value={profileUrl}
            label={`${t("share.scan")}: ${profileUrl}`}
          />
        </div>
        <p className="set-share-card__caption">
          <Icon name="qr" size={15} />
          {t("share.scan")}
        </p>
      </div>
      <Section title={t("share.link")} plain>
        <div className="input-wrap set-link-field">
          <Icon name="link" size={18} />
          <input
            ref={inputRef}
            readOnly
            value={profileUrl}
            aria-label={t("share.link")}
            onFocus={(event) => event.currentTarget.select()}
          />
        </div>
        <div className="set-button-row">
          <Button variant="secondary" onClick={() => void copy()}>
            <Icon name="copy" size={17} />
            {t("share.copy")}
          </Button>
          <Button onClick={() => void share()}>
            <Icon name="share" size={17} />
            {t("share.share")}
          </Button>
        </div>
      </Section>
      <Section plain>
        <InlineMessage
          tone={access === "private" ? "warning" : "info"}
          action={
            access === "private" && (
              <button
                type="button"
                className="text-link set-inline-link"
                onClick={() => navigate("privacy")}
              >
                {t("share.changeVisibility")}
              </button>
            )
          }
        >
          {t(`share.access.${access}`)}
        </InlineMessage>
      </Section>
      <Section>
        <NavRow
          icon="eye"
          title={t("share.preview")}
          onClick={previewProfile}
        />
      </Section>
    </SettingsPage>
  );
}

/* ---------- Privacy ---------- */

const fieldIcons: Record<(typeof personalFields)[number], IconName> = {
  email: "mail",
  phone: "phone",
  graduationYear: "calendar",
  department: "book",
  workplace: "building",
  designation: "briefcase",
  location: "pin",
  socialLinks: "link",
};

export function PrivacyScreen() {
  const { t, settings, update, notify, navigate } = useSettings();
  const { privacy } = settings;
  const [picker, setPicker] = useState<
    "messageRequests" | "directContact" | null
  >(null);
  const setVisibility = (profileVisibility: ProfileVisibility) => {
    if (profileVisibility === privacy.profileVisibility) return;
    update("privacy", (current) => ({ ...current, profileVisibility }));
    notify(t("common.saved"));
  };
  const audienceChoices = audienceOptions.map((value) => ({
    value,
    label: t(`audience.${value}`),
  }));
  return (
    <SettingsPage
      title={t("privacy.title")}
      description={t("privacy.description")}
    >
      <Section
        title={t("privacy.profileVisibility")}
        groupProps={{
          role: "radiogroup",
          "aria-label": t("privacy.profileVisibility"),
        }}
      >
        {profileVisibilityOptions.map((option) => (
          <RadioRow
            key={option}
            icon={
              option === "alumni"
                ? "users"
                : option === "private"
                  ? "lock"
                  : "globe"
            }
            title={t(`visibility.${option}`)}
            description={t(`visibility.${option}.desc`)}
            extra={
              option === "public" && (
                <small className="set-policy">
                  {t("visibility.public.policy")}
                </small>
              )
            }
            selected={privacy.profileVisibility === option}
            onSelect={() => setVisibility(option)}
          />
        ))}
      </Section>
      <Section title={t("privacy.personalInfo")}>
        {personalFields.map((field) => (
          <ToggleRow
            key={field}
            icon={fieldIcons[field]}
            title={t(`privacy.field.${field}`)}
            description={
              privacy.fields[field] ? t("common.visible") : t("common.hidden")
            }
            checked={privacy.fields[field]}
            onChange={(value) =>
              update("privacy", (current) => ({
                ...current,
                fields: { ...current.fields, [field]: value },
              }))
            }
          />
        ))}
      </Section>
      <Section title={t("privacy.messaging")}>
        <NavRow
          icon="chat"
          title={t("privacy.messageRequests")}
          value={t(`audience.${privacy.messageRequests}`)}
          onClick={() => setPicker("messageRequests")}
        />
        <NavRow
          icon="message"
          title={t("privacy.directContact")}
          value={t(`audience.${privacy.directContact}`)}
          onClick={() => setPicker("directContact")}
        />
        <ToggleRow
          icon="users"
          title={t("privacy.nonConnections")}
          description={t("privacy.nonConnections.desc")}
          checked={privacy.nonConnectionMessages}
          onChange={(nonConnectionMessages) =>
            update("privacy", (current) => ({
              ...current,
              nonConnectionMessages,
            }))
          }
        />
      </Section>
      <Section
        title={t("privacy.location")}
        note={
          <p className="set-note__icon">
            <Icon name="shield" size={15} />
            {t("privacy.preciseNote")}
          </p>
        }
      >
        <ToggleRow
          icon="pin"
          title={t("privacy.locationVisible")}
          description={t("privacy.locationVisible.desc")}
          checked={privacy.locationVisible}
          onChange={(locationVisible) =>
            update("privacy", (current) => ({ ...current, locationVisible }))
          }
        />
      </Section>
      <Section>
        <NavRow
          icon="userX"
          title={t("privacy.blocked")}
          value={t("privacy.blockedCount", { count: privacy.blocked.length })}
          onClick={() => navigate("blocked")}
        />
      </Section>

      {picker && (
        <ChoiceSheet<Audience>
          title={t(`privacy.${picker}`)}
          options={audienceChoices}
          value={privacy[picker]}
          onClose={() => setPicker(null)}
          onSelect={(value) => {
            update("privacy", (current) => ({ ...current, [picker]: value }));
            notify(t("common.saved"));
          }}
        />
      )}
    </SettingsPage>
  );
}

export function BlockedScreen() {
  const { t, settings, update, notify } = useSettings();
  const [unblocking, setUnblocking] = useState<
    (typeof settings.privacy.blocked)[number] | null
  >(null);
  const blocked = settings.privacy.blocked;
  return (
    <SettingsPage
      title={t("blocked.title")}
      description={t("blocked.description")}
    >
      {blocked.length ? (
        <Section>
          {blocked.map((person) => (
            <div className="set-row" key={person.id}>
              <Avatar person={{ name: person.name }} size="sm" />
              <span className="set-row__main">
                <span className="set-row__text">
                  <b>{person.name}</b>
                  <small>
                    {person.department} ·{" "}
                    {t("account.classOf", { year: person.year })}
                  </small>
                </span>
                <span className="set-row__trail">
                  <Button
                    variant="secondary"
                    className="set-button--compact"
                    onClick={() => setUnblocking(person)}
                  >
                    {t("blocked.unblock")}
                  </Button>
                </span>
              </span>
            </div>
          ))}
        </Section>
      ) : (
        <EmptyState
          icon="userX"
          title={t("blocked.empty")}
          description={t("blocked.empty.desc")}
        />
      )}
      {unblocking && (
        <ConfirmSheet
          title={t("blocked.confirmTitle", { name: unblocking.name })}
          body={t("blocked.confirmBody", { name: unblocking.name })}
          confirmLabel={t("blocked.unblock")}
          onClose={() => setUnblocking(null)}
          onConfirm={async () => {
            await simulateRequest(true);
            update("privacy", (current) => ({
              ...current,
              blocked: current.blocked.filter(
                (person) => person.id !== unblocking.id,
              ),
            }));
            notify(t("blocked.done", { name: unblocking.name }));
            setUnblocking(null);
          }}
        />
      )}
    </SettingsPage>
  );
}

/* ---------- Security ---------- */

const deviceIcons: Record<DeviceType, IconName> = {
  phone: "smartphone",
  tablet: "smartphone",
  laptop: "laptop",
  desktop: "monitor",
};

function TwoFactorSheet({ onClose }: { onClose: () => void }) {
  const { t, settings, update, notify } = useSettings();
  const [method, setMethod] = useState<TwoFactorMethod>(
    settings.security.twoFactorMethod,
  );
  const { busy, error, run } = useAsyncAction();
  return (
    <Sheet
      title={t("security.2fa.enableTitle")}
      onClose={() => !busy && onClose()}
    >
      <p className="set-sheet__body">{t("security.2fa.enableBody")}</p>
      <div
        className="set-group set-group--sheet"
        role="radiogroup"
        aria-label={t("security.2fa")}
      >
        <RadioRow
          icon="smartphone"
          title={t("security.2fa.app")}
          description={t("security.2fa.app.desc")}
          selected={method === "app"}
          onSelect={() => setMethod("app")}
        />
        <RadioRow
          icon="chat"
          title={t("security.2fa.sms")}
          description={t("security.2fa.sms.desc", {
            phone: settings.account.phone,
          })}
          selected={method === "sms"}
          onSelect={() => setMethod("sms")}
        />
      </div>
      <p className="set-sheet__muted">{t("security.2fa.note")}</p>
      {error && <InlineMessage tone="error">{error}</InlineMessage>}
      <SheetActions>
        <Button variant="secondary" onClick={onClose} disabled={busy}>
          {t("common.cancel")}
        </Button>
        <Button
          busy={busy}
          onClick={async () => {
            const ok = await run(() => simulateRequest(true));
            if (!ok) return;
            update("security", (current) => ({
              ...current,
              twoFactor: true,
              twoFactorMethod: method,
            }));
            notify(t("security.2fa.enabled"));
            onClose();
          }}
        >
          {t("security.2fa.enable")}
        </Button>
      </SheetActions>
    </Sheet>
  );
}

function RecoverySheet({ onClose }: { onClose: () => void }) {
  const { t, settings, update, notify } = useSettings();
  const [email, setEmail] = useState(settings.security.recoveryEmail);
  const [phone, setPhone] = useState(settings.security.recoveryPhone);
  const [touched, setTouched] = useState(false);
  const { busy, error, run } = useAsyncAction();
  const emailError = email.trim() ? validateEmail(email) : null;
  const phoneError = phone.trim() ? validatePhone(phone) : null;
  async function save() {
    setTouched(true);
    if (emailError || phoneError) return;
    const ok = await run(() => simulateRequest(true));
    if (!ok) return;
    update("security", (current) => ({
      ...current,
      recoveryEmail: email.trim(),
      recoveryPhone: phone.trim().replace(/\s+/g, " "),
    }));
    notify(t("security.recovery.saved"));
    onClose();
  }
  return (
    <Sheet title={t("security.recovery")} onClose={() => !busy && onClose()}>
      <p className="set-sheet__body">{t("security.recovery.body")}</p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <TextField
          id="recovery-email"
          label={t("security.recovery.email")}
          optional
          icon="mail"
          type="email"
          inputMode="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={touched && emailError ? t(`error.${emailError}`) : undefined}
        />
        <TextField
          id="recovery-phone"
          label={t("security.recovery.phone")}
          optional
          icon="phone"
          type="tel"
          inputMode="tel"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          error={touched && phoneError ? t(`error.${phoneError}`) : undefined}
        />
        {error && <InlineMessage tone="error">{error}</InlineMessage>}
        <SheetActions>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" busy={busy}>
            {t("common.save")}
          </Button>
        </SheetActions>
      </form>
    </Sheet>
  );
}

type SecuritySheet =
  | "password"
  | "enable2fa"
  | "disable2fa"
  | "recovery"
  | "logoutOthers"
  | Session;

export function SecurityScreen() {
  const { t, settings, update, notify, locale } = useSettings();
  const { security } = settings;
  const [sheet, setSheet] = useState<SecuritySheet | null>(null);
  const now = useNow(60000);
  const close = () => setSheet(null);
  const current = security.sessions.find((session) => session.current);
  const others = security.sessions.filter((session) => !session.current);
  const relative = (iso: string) => formatRelative(iso, locale, now.getTime());
  const loginEntries = [
    ...(current
      ? [
          {
            ...current,
            time: current.lastActive,
            status: "success" as const,
            id: "login-current",
          },
        ]
      : []),
    ...security.loginActivity,
  ];
  return (
    <SettingsPage
      title={t("security.title")}
      description={t("security.description")}
    >
      <Section title={t("security.authentication")}>
        <NavRow
          icon="key"
          title={t("account.changePassword")}
          description={t("security.passwordChanged", {
            time: relative(security.passwordChangedAt),
          })}
          onClick={() => setSheet("password")}
        />
        <ToggleRow
          icon="shield"
          title={t("security.2fa")}
          description={
            security.twoFactor
              ? t("security.2fa.on", {
                  method: t(`security.2fa.${security.twoFactorMethod}`),
                })
              : t("security.2fa.off")
          }
          checked={security.twoFactor}
          onChange={(value) => setSheet(value ? "enable2fa" : "disable2fa")}
        />
        <NavRow
          icon="lifebuoy"
          title={t("security.recovery")}
          description={t("security.recovery.desc")}
          onClick={() => setSheet("recovery")}
        />
      </Section>

      <Section
        title={t("security.sessions")}
        note={
          others.length > 0 && (
            <Button
              variant="ghost"
              className="set-danger-link"
              onClick={() => setSheet("logoutOthers")}
            >
              <Icon name="logout" size={16} />
              {t("security.logoutOthers")}
            </Button>
          )
        }
      >
        {current && (
          <div className="set-row">
            <FrostedIcon name={deviceIcons[current.type]} />
            <span className="set-row__main">
              <span className="set-row__text">
                <b>{current.device}</b>
                <small>
                  {current.location || t("security.locationUnknown")} ·{" "}
                  {t("security.activeNow")}
                </small>
              </span>
              <span className="set-row__trail">
                <span className="set-pill">{t("security.thisDevice")}</span>
              </span>
            </span>
          </div>
        )}
        {others.map((session) => (
          <div className="set-row" key={session.id}>
            <FrostedIcon name={deviceIcons[session.type]} />
            <span className="set-row__main">
              <span className="set-row__text">
                <b>{session.device}</b>
                <small>
                  {t("security.session.meta", {
                    location: session.location || t("security.locationUnknown"),
                    time: relative(session.lastActive),
                  })}
                </small>
              </span>
              <span className="set-row__trail">
                <Button
                  variant="secondary"
                  className="set-button--compact"
                  onClick={() => setSheet(session)}
                >
                  {t("security.session.logout")}
                </Button>
              </span>
            </span>
          </div>
        ))}
        {!others.length && (
          <p className="set-row set-row--plain set-row--empty">
            {t("security.noSessions")}
          </p>
        )}
      </Section>

      <Section title={t("security.loginActivity")}>
        {loginEntries.map((entry) => (
          <div className="set-row" key={entry.id}>
            <FrostedIcon name={deviceIcons[entry.type]} />
            <span className="set-row__main">
              <span className="set-row__text">
                <b>{entry.device}</b>
                <small>
                  {entry.location || t("security.locationUnknown")} ·{" "}
                  {relative(entry.time)}
                </small>
              </span>
              <span className="set-row__trail">
                <span
                  className={`set-pill ${entry.status === "blocked" ? "set-pill--danger" : ""}`}
                >
                  {entry.status === "blocked"
                    ? t("security.login.blocked")
                    : t("security.login.success")}
                </span>
              </span>
            </span>
          </div>
        ))}
      </Section>

      <Section title={t("security.alerts")}>
        <ToggleRow
          icon="alert"
          title={t("security.suspicious")}
          description={t("security.suspicious.desc")}
          checked={security.suspiciousLoginAlerts}
          onChange={(suspiciousLoginAlerts) =>
            update("security", (value) => ({ ...value, suspiciousLoginAlerts }))
          }
        />
        <ToggleRow
          icon="bell"
          title={t("security.accountAlerts")}
          description={t("security.accountAlerts.desc")}
          checked={security.securityAlerts}
          onChange={(securityAlerts) =>
            update("security", (value) => ({ ...value, securityAlerts }))
          }
        />
      </Section>

      {sheet === "password" && <PasswordSheet onClose={close} />}
      {sheet === "enable2fa" && <TwoFactorSheet onClose={close} />}
      {sheet === "recovery" && <RecoverySheet onClose={close} />}
      {sheet === "disable2fa" && (
        <ConfirmSheet
          title={t("security.2fa.disableTitle")}
          body={t("security.2fa.disableBody")}
          confirmLabel={t("security.2fa.disable")}
          tone="danger"
          onClose={close}
          onConfirm={async () => {
            await simulateRequest(true);
            update("security", (value) => ({ ...value, twoFactor: false }));
            notify(t("security.2fa.disabled"));
            close();
          }}
        />
      )}
      {sheet === "logoutOthers" && (
        <ConfirmSheet
          title={t("security.logoutOthers.title")}
          body={t("security.logoutOthers.body", { count: others.length })}
          confirmLabel={t("security.logoutOthers.confirm")}
          tone="danger"
          onClose={close}
          onConfirm={async () => {
            const { error } = await supabase.auth.signOut({ scope: "others" });
            if (error) throw error;
            update("security", (value) => ({
              ...value,
              sessions: value.sessions.filter((session) => session.current),
            }));
            notify(t("security.logoutOthers.done"));
            close();
          }}
        />
      )}
      {sheet && typeof sheet === "object" && (
        <ConfirmSheet
          title={t("security.session.title", { device: sheet.device })}
          body={t("security.session.body")}
          confirmLabel={t("security.session.confirm")}
          tone="danger"
          onClose={close}
          onConfirm={async () => {
            await simulateRequest(true);
            update("security", (value) => ({
              ...value,
              sessions: value.sessions.filter(
                (session) => session.id !== sheet.id,
              ),
            }));
            notify(t("security.session.done", { device: sheet.device }));
            close();
          }}
        />
      )}
    </SettingsPage>
  );
}
