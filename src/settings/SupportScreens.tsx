import { useId, useRef, useState, type ReactNode } from "react";
import { Icon, Logo } from "../ui/chrome";
import { acknowledgements, guidelineSections, helpArticles, policySections, type HelpCategory } from "./content";
import {
  APP_BUILD,
  APP_VERSION,
  createReference,
  describeDevice,
  formatBytes,
  simulateRequest,
  supportCategories,
  validateAttachment,
  validateSupportRequest,
  type ValidationError,
} from "./model";
import {
  Button,
  DetailRow,
  EmptyState,
  InlineMessage,
  NavRow,
  RadioRow,
  Section,
  SelectField,
  SettingsPage,
  SuccessPanel,
  TextAreaField,
  TextField,
  ToggleRow,
  errorMessage,
  useSettings,
} from "./ui";

function Accordion({
  title,
  children,
  meta,
}: {
  title: string;
  children: ReactNode;
  meta?: string;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className={`set-accordion ${open ? "is-open" : ""}`}>
      <button
        type="button"
        className="set-row set-row--plain"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
      >
        <span className="set-row__main">
          <span className="set-row__text">
            <b>{title}</b>
            {meta && <small>{meta}</small>}
          </span>
          <span className="set-row__trail">
            <Icon name="chevron" size={16} className="set-accordion__chevron" />
          </span>
        </span>
      </button>
      {open && (
        <div className="set-accordion__panel" id={id}>
          {children}
        </div>
      )}
    </div>
  );
}

const helpCategories: ("all" | HelpCategory)[] = [
  "all",
  "account",
  "profile",
  "directory",
  "messaging",
  "events",
];

export function HelpScreen() {
  const { t, navigate, settings } = useSettings();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<"all" | HelpCategory>("all");
  const normalized = query.trim().toLowerCase();
  const results = helpArticles.filter(
    (article) =>
      (category === "all" || article.category === category) &&
      (!normalized || `${article.question} ${article.answer}`.toLowerCase().includes(normalized)),
  );
  return (
    <SettingsPage title={t("help.title")} description={t("help.description")}>
      <Section
        title={t("help.centre")}
        plain
        note={settings.language === "ta" && <p>{t("help.englishOnly")}</p>}
      >
        <div className="search-box set-search">
          <Icon name="search" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("help.search")}
            aria-label={t("help.search")}
          />
          {query && (
            <button type="button" onClick={() => setQuery("")} aria-label={t("common.close")}>
              <Icon name="close" size={17} />
            </button>
          )}
        </div>
        <div className="chips set-filter-chips" role="tablist" aria-label={t("help.centre")}>
          {helpCategories.map((key) => (
            <button
              type="button"
              key={key}
              role="tab"
              aria-selected={category === key}
              className={category === key ? "active" : ""}
              onClick={() => setCategory(key)}
            >
              {t(`help.category.${key}`)}
            </button>
          ))}
        </div>
        <div className="glass-panel set-group" lang="en">
          {results.length ? (
            results.map((article) => (
              <Accordion key={article.id} title={article.question}>
                <p>{article.answer}</p>
              </Accordion>
            ))
          ) : (
            <EmptyState
              icon="search"
              title={t("help.noResults")}
              description={t("help.noResults.desc")}
              action={
                <button type="button" onClick={() => navigate("contact")}>
                  {t("help.contact")}
                </button>
              }
            />
          )}
        </div>
      </Section>
      <Section title={t("help.getHelp")}>
        <NavRow
          icon="mail"
          title={t("help.contact")}
          description={t("help.contact.desc")}
          onClick={() => navigate("contact")}
        />
        <NavRow
          icon="alert"
          title={t("help.reportProblem")}
          description={t("help.reportProblem.desc")}
          onClick={() => navigate("report-problem")}
        />
        <NavRow
          icon="flag"
          title={t("help.reportUser")}
          description={t("help.reportUser.desc")}
          onClick={() => navigate("report-user")}
        />
      </Section>
      <Section title={t("help.community")}>
        <NavRow
          icon="book"
          title={t("help.guidelines")}
          description={t("help.guidelines.desc")}
          onClick={() => navigate("guidelines")}
        />
      </Section>
    </SettingsPage>
  );
}

export function ContactScreen() {
  const { t, settings, back, locale } = useSettings();
  const [form, setForm] = useState({ subject: "", category: "", description: "" });
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<ValidationError | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reference, setReference] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const errors = validateSupportRequest({ ...form, attachment: file });
  const show = (key: keyof typeof errors) =>
    submitted && errors[key] ? t(`error.${errors[key]!}`) : undefined;
  async function submit() {
    setSubmitted(true);
    setError("");
    if (Object.keys(errors).length) {
      setError(t("common.fixErrors"));
      return;
    }
    setBusy(true);
    try {
      setReference(await simulateRequest(createReference("MSGI"), { delay: 900 }));
    } catch (caught) {
      setError(errorMessage(caught, t));
    } finally {
      setBusy(false);
    }
  }
  if (reference)
    return (
      <SettingsPage title={t("contact.title")}>
        <SuccessPanel
          title={t("contact.success")}
          body={t("contact.success.body", { ref: reference, email: settings.account.email })}
          note={t("support.prototypeNote")}
          action={<Button onClick={back}>{t("support.backToHelp")}</Button>}
        />
      </SettingsPage>
    );
  return (
    <SettingsPage title={t("contact.title")} description={t("contact.description")}>
      <form
        className="glass-panel set-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <TextField
          id="support-subject"
          label={t("contact.subject")}
          value={form.subject}
          maxLength={120}
          placeholder={t("contact.subject.placeholder")}
          onChange={(event) => setForm({ ...form, subject: event.target.value })}
          error={show("subject")}
        />
        <SelectField
          id="support-category"
          label={t("contact.category")}
          value={form.category}
          onChange={(event) => setForm({ ...form, category: event.target.value })}
          error={show("category") && t("error.chooseOption")}
        >
          <option value="" disabled>
            {t("contact.category.placeholder")}
          </option>
          {supportCategories.map((category) => (
            <option key={category} value={category}>
              {t(`contact.category.${category}`)}
            </option>
          ))}
        </SelectField>
        <TextAreaField
          id="support-description"
          label={t("contact.details")}
          value={form.description}
          max={1000}
          placeholder={t("contact.details.placeholder")}
          onChange={(event) => setForm({ ...form, description: event.target.value })}
          error={show("description")}
        />
        <div className="field set-field">
          <label htmlFor="support-attachment">
            {t("contact.attachment")}
            <em>{t("common.optional")}</em>
          </label>
          {file ? (
            <div className="set-attachment">
              <Icon name="paperclip" size={17} />
              <span>
                <b className="set-ellipsis">{file.name}</b>
                <small>{formatBytes(file.size, locale)}</small>
              </span>
              <button
                type="button"
                className="set-icon-action"
                aria-label={t("contact.removeAttachment")}
                onClick={() => {
                  setFile(null);
                  setFileError(null);
                  if (fileInput.current) fileInput.current.value = "";
                }}
              >
                <Icon name="close" size={16} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              className={`set-upload ${fileError ? "input-wrap--error" : ""}`}
              onClick={() => fileInput.current?.click()}
            >
              <Icon name="upload" size={18} />
              <span>
                <b>{t("contact.attach")}</b>
                <small>{t("contact.attachment.hint")}</small>
              </span>
            </button>
          )}
          <input
            ref={fileInput}
            id="support-attachment"
            type="file"
            accept="image/png,image/jpeg,application/pdf"
            className="set-visually-hidden"
            onChange={(event) => {
              const selected = event.target.files?.[0];
              if (!selected) return;
              const problem = validateAttachment(selected);
              setFileError(problem);
              setFile(problem ? null : selected);
              if (problem) event.target.value = "";
            }}
          />
          {fileError && <p className="field-error">{t(`error.${fileError}`)}</p>}
        </div>
        {error && <InlineMessage tone="error">{error}</InlineMessage>}
        <Button type="submit" busy={busy} className="set-button--block">
          <Icon name="send" size={17} />
          {t("contact.submit")}
        </Button>
        <p className="set-form__note">{t("support.prototypeNote")}</p>
      </form>
    </SettingsPage>
  );
}

const problemTypes = ["technical", "incorrect", "login", "other"] as const;

export function ReportProblemScreen() {
  const { t, back } = useSettings();
  const device = describeDevice(typeof navigator === "undefined" ? "" : navigator.userAgent).device;
  const [type, setType] = useState<(typeof problemTypes)[number] | null>(null);
  const [details, setDetails] = useState("");
  const [includeDevice, setIncludeDevice] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reference, setReference] = useState("");
  const detailsLength = details.trim().length;
  const detailsError = !detailsLength
    ? "required"
    : detailsLength < 20
      ? "descriptionShort"
      : detailsLength > 1000
        ? "descriptionLong"
        : null;
  async function submit() {
    setSubmitted(true);
    setError("");
    if (!type || detailsError) {
      setError(t("common.fixErrors"));
      return;
    }
    setBusy(true);
    try {
      setReference(await simulateRequest(createReference("BUG"), { delay: 800 }));
    } catch (caught) {
      setError(errorMessage(caught, t));
    } finally {
      setBusy(false);
    }
  }
  if (reference)
    return (
      <SettingsPage title={t("problem.title")}>
        <SuccessPanel
          title={t("problem.success")}
          body={t("problem.success.body", { ref: reference })}
          note={t("support.prototypeNote")}
          action={<Button onClick={back}>{t("support.backToHelp")}</Button>}
        />
      </SettingsPage>
    );
  return (
    <SettingsPage title={t("problem.title")} description={t("problem.description")}>
      <Section
        title={t("problem.type")}
        groupProps={{ role: "radiogroup", "aria-label": t("problem.type") }}
        note={submitted && !type && <p className="field-error">{t("error.chooseOption")}</p>}
      >
        {problemTypes.map((option) => (
          <RadioRow
            key={option}
            title={t(`problem.${option}`)}
            description={t(`problem.${option}.desc`)}
            selected={type === option}
            onSelect={() => setType(option)}
          />
        ))}
      </Section>
      <Section plain>
        <div className="glass-panel set-form">
          <TextAreaField
            id="problem-details"
            label={t("problem.details")}
            value={details}
            max={1000}
            placeholder={t("contact.details.placeholder")}
            onChange={(event) => setDetails(event.target.value)}
            error={submitted && detailsError ? t(`error.${detailsError}`) : undefined}
          />
        </div>
      </Section>
      <Section>
        <ToggleRow
          icon="smartphone"
          title={t("problem.device")}
          description={device}
          checked={includeDevice}
          onChange={setIncludeDevice}
        />
      </Section>
      {error && <InlineMessage tone="error">{error}</InlineMessage>}
      <Button busy={busy} className="set-button--block" onClick={submit}>
        {t("problem.submit")}
      </Button>
      <p className="set-form__note">{t("support.prototypeNote")}</p>
    </SettingsPage>
  );
}

const reportReasons = ["spam", "harassment", "fake", "inappropriate", "privacy", "other"] as const;

export function ReportUserScreen() {
  const { t, back, reportablePeople, update, settings } = useSettings();
  const [personId, setPersonId] = useState("");
  const [reason, setReason] = useState<(typeof reportReasons)[number] | null>(null);
  const [explanation, setExplanation] = useState("");
  const [block, setBlock] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ reference: string; blockedName?: string } | null>(null);
  const person = reportablePeople.find((item) => String(item.id) === personId);
  const explanationError = explanation.trim().length > 1000 ? "descriptionLong" : null;
  async function submit() {
    setSubmitted(true);
    setError("");
    if (!person || !reason || explanationError) {
      setError(t("common.fixErrors"));
      return;
    }
    setBusy(true);
    try {
      const reference = await simulateRequest(createReference("RPT"), { delay: 800 });
      const blockId = `alumni-${person.id}`;
      if (block && !settings.privacy.blocked.some((item) => item.id === blockId))
        update("privacy", (current) => ({
          ...current,
          blocked: [
            ...current.blocked,
            { id: blockId, name: person.name, department: person.dept, year: person.year },
          ],
        }));
      setResult({ reference, blockedName: block ? person.name : undefined });
    } catch (caught) {
      setError(errorMessage(caught, t));
    } finally {
      setBusy(false);
    }
  }
  if (result)
    return (
      <SettingsPage title={t("reportUser.title")}>
        <SuccessPanel
          title={t("reportUser.success")}
          body={
            <>
              {t("reportUser.success.body", { ref: result.reference })}
              {result.blockedName && <> {t("reportUser.blocked", { name: result.blockedName })}</>}
            </>
          }
          note={t("support.prototypeNote")}
          action={<Button onClick={back}>{t("support.backToHelp")}</Button>}
        />
      </SettingsPage>
    );
  return (
    <SettingsPage title={t("reportUser.title")} description={t("reportUser.description")}>
      <Section plain>
        <div className="glass-panel set-form">
          <SelectField
            id="report-person"
            label={t("reportUser.person")}
            value={personId}
            onChange={(event) => setPersonId(event.target.value)}
            error={submitted && !person ? t("error.chooseOption") : undefined}
          >
            <option value="" disabled>
              {t("contact.category.placeholder")}
            </option>
            {reportablePeople.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · {item.dept}
              </option>
            ))}
          </SelectField>
        </div>
      </Section>
      <Section
        title={t("reportUser.reason")}
        groupProps={{ role: "radiogroup", "aria-label": t("reportUser.reason") }}
        note={submitted && !reason && <p className="field-error">{t("error.chooseOption")}</p>}
      >
        {reportReasons.map((option) => (
          <RadioRow
            key={option}
            title={t(`reportUser.${option}`)}
            selected={reason === option}
            onSelect={() => setReason(option)}
          />
        ))}
      </Section>
      <Section plain>
        <div className="glass-panel set-form">
          <TextAreaField
            id="report-explanation"
            label={t("reportUser.explanation")}
            optional
            value={explanation}
            max={1000}
            placeholder={t("reportUser.explanation.placeholder")}
            onChange={(event) => setExplanation(event.target.value)}
            error={explanationError ? t(`error.${explanationError}`) : undefined}
          />
        </div>
      </Section>
      <Section>
        <ToggleRow
          icon="userX"
          title={t("reportUser.block")}
          description={t("reportUser.block.desc")}
          checked={block}
          onChange={setBlock}
        />
      </Section>
      {error && <InlineMessage tone="error">{error}</InlineMessage>}
      <Button variant="danger" busy={busy} className="set-button--block" onClick={submit}>
        <Icon name="flag" size={17} />
        {t("reportUser.submit")}
      </Button>
      <p className="set-form__note">{t("support.prototypeNote")}</p>
    </SettingsPage>
  );
}

export function GuidelinesScreen() {
  const { t, settings } = useSettings();
  return (
    <SettingsPage title={t("guidelines.title")} description={t("guidelines.description")}>
      {settings.language === "ta" && (
        <InlineMessage tone="info">{t("help.englishOnly")}</InlineMessage>
      )}
      <ol className="set-guidelines" lang="en">
        {guidelineSections.map((section, index) => (
          <li className="glass-panel" key={section.title}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <div>
              <h2>{section.title}</h2>
              <p>{section.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </SettingsPage>
  );
}

export function TermsScreen() {
  const { t, navigate, locale, settings } = useSettings();
  const formatDate = (iso: string) =>
    new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric" }).format(
      new Date(`${iso}T00:00:00`),
    );
  return (
    <SettingsPage title={t("terms.title")} description={t("terms.description")}>
      <InlineMessage tone="info">
        {t("terms.prototype")}
        {settings.language === "ta" && <> {t("help.englishOnly")}</>}
      </InlineMessage>
      <Section>
        {policySections.map((section) => (
          <Accordion
            key={section.id}
            title={section.title}
            meta={t("terms.updated", { date: formatDate(section.updated) })}
          >
            <ul lang="en">
              {section.body.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            {section.id === "privacy" && (
              <button type="button" className="text-link" onClick={() => navigate("privacy")}>
                {t("terms.reviewPrivacy")}
              </button>
            )}
            {section.id === "data" && (
              <button type="button" className="text-link" onClick={() => navigate("storage")}>
                {t("terms.manageData")}
              </button>
            )}
            {section.id === "deletion" && (
              <button type="button" className="text-link" onClick={() => navigate("account")}>
                {t("terms.deleteAccount")}
              </button>
            )}
          </Accordion>
        ))}
      </Section>
    </SettingsPage>
  );
}

export function AboutScreen() {
  const { t } = useSettings();
  return (
    <SettingsPage title={t("about.title")}>
      <div className="set-brand-panel">
        <Logo />
      </div>
      <p className="set-about">{t("about.body")}</p>
      <Section title={t("about.details")}>
        <DetailRow
          icon="building"
          label={t("about.institution")}
          value="Meenakshi Sundararajan Group of Institutions"
        />
        <DetailRow icon="info" label={t("about.version")} value={APP_VERSION} />
        <DetailRow icon="settings" label={t("about.build")} value={APP_BUILD} />
      </Section>
      <Section title={t("about.acknowledgements")}>
        {acknowledgements.map((item) => (
          <div className="set-row set-row--plain" key={item}>
            <span className="set-row__main">
              <span className="set-row__text">
                <small lang="en">{item}</small>
              </span>
            </span>
          </div>
        ))}
      </Section>
      <p className="set-version">{t("about.copyright", { year: new Date().getFullYear() })}</p>
    </SettingsPage>
  );
}
