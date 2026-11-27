import { useRef, useState, type FormEvent } from "react";
import {
  Button,
  InlineMessage,
  SelectField,
  SuccessPanel,
  TextAreaField,
  TextField,
} from "../settings/ui";
import { formatBytes, validateAttachment } from "../settings/model";
import { Icon } from "../ui/chrome";
import {
  issueCategories,
  requireService,
  requireSupportReceipt,
  type SupportInput,
  type SupportService,
} from "./services";
import { supportErrors } from "./model";
import { IconAction, NetworkPage, PageHeading, useInvalidFocus } from "./ui";
import { useServiceAction } from "./useServiceAction";

const disconnected =
  "Support submission is not connected yet. You can complete the form, but your request and attachment will not be sent or saved.";

function AttachmentField({
  file,
  error,
  disabled,
  onChange,
}: {
  file: File | null;
  error?: string;
  disabled: boolean;
  onChange: (file: File | null) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="field set-field">
      <label htmlFor="network-attachment">
        Attachment <em>Optional</em>
      </label>
      {file ? (
        <div className="set-attachment">
          <Icon name="paperclip" size={18} />
          <span>
            <b className="set-ellipsis">{file.name}</b>
            <small>{formatBytes(file.size, "en-IN")} · Not uploaded</small>
          </span>
          <IconAction
            icon="close"
            label="Remove attachment"
            disabled={disabled}
            onClick={() => {
              onChange(null);
              if (input.current) input.current.value = "";
            }}
          />
        </div>
      ) : (
        <Button
          variant="secondary"
          className="set-upload"
          disabled={disabled}
          aria-describedby={error ? "network-attachment-error" : "network-attachment-hint"}
          aria-invalid={Boolean(error)}
          onClick={() => input.current?.click()}
        >
          <Icon name="upload" size={20} />
          <span>
            <b>Attach a screenshot or file</b>
            <small id="network-attachment-hint">PNG, JPG or PDF · Up to 5 MB</small>
          </span>
        </Button>
      )}
      <input
        ref={input}
        id="network-attachment"
        type="file"
        className="set-visually-hidden"
        accept="image/png,image/jpeg,application/pdf"
        disabled={disabled}
        aria-describedby={error ? "network-attachment-error" : undefined}
        onChange={(event) => {
          onChange(event.target.files?.[0] ?? null);
          event.target.value = "";
        }}
      />
      {error && (
        <p id="network-attachment-error" className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}

export function SupportPage({
  account,
  service,
  onBack,
  onReturn,
  initialCategory = "",
}: {
  account?: { fullName: string; email: string };
  service?: SupportService;
  onBack: () => void;
  onReturn: () => void;
  initialCategory?: string;
}) {
  const [form, setForm] = useState<SupportInput>({
    fullName: account?.fullName ?? "",
    email: account?.email ?? "",
    category: initialCategory,
    subject: "",
    description: "",
    attachment: null,
  });
  const [attempt, setAttempt] = useState(0);
  const [attachmentError, setAttachmentError] = useState("");
  const [reference, setReference] = useState("");
  const action = useServiceAction();
  const formRef = useInvalidFocus(attempt);
  const errors = supportErrors(form);
  const show = (key: keyof SupportInput) => (attempt ? errors[key] : undefined);
  const set = <K extends keyof SupportInput>(key: K, value: SupportInput[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  function submit(event: FormEvent) {
    event.preventDefault();
    if (action.busy) return;
    setAttempt((value) => value + 1);
    action.setError("");
    if (Object.keys(errors).length || attachmentError) {
      action.setError("Please check the highlighted fields before submitting.");
      return;
    }
    void action.run(
      async (signal) => {
        const support = requireService(service, disconnected);
        return requireSupportReceipt(
          await support.submit(
            {
              ...form,
              fullName: form.fullName.trim(),
              email: form.email.trim(),
              subject: form.subject.trim(),
              description: form.description.trim(),
            },
            signal,
          ),
        );
      },
      (receipt) => {
        setReference(receipt);
        set("attachment", null);
      },
    );
  }
  return (
    <NetworkPage title="MSGI Support" onBack={onBack}>
      {reference ? (
        <SuccessPanel
          title="Your Request Has Been Received!"
          body="Your support request has been submitted. Our support team will review your request."
          note={
            <>
              Your support reference: <strong>{reference}</strong>
              <br />
              Keep this number for follow-up.
            </>
          }
          action={<Button onClick={onReturn}>Return to the Application</Button>}
        />
      ) : (
        <>
          <PageHeading
            title="How Can We Help You?"
            description="Tell us about the issue you're experiencing. Our support team will review your request."
          />
          {!service && <InlineMessage>{disconnected}</InlineMessage>}
          <form
            className="glass-panel set-form network-form network-support"
            noValidate
            onSubmit={submit}
            ref={formRef}
          >
            <TextField
              id="network-name"
              label="Full Name"
              value={form.fullName}
              required
              maxLength={60}
              autoComplete="name"
              icon="user"
              placeholder="Enter your full name"
              disabled={action.busy}
              onChange={(event) => set("fullName", event.target.value)}
              error={show("fullName")}
            />
            <TextField
              id="network-email"
              label="Email Address"
              value={form.email}
              required
              type="email"
              maxLength={254}
              autoComplete="email"
              icon="mail"
              placeholder="Enter your registered email"
              disabled={action.busy}
              onChange={(event) => set("email", event.target.value)}
              error={show("email")}
            />
            <SelectField
              id="network-category"
              label="Issue Category"
              value={form.category}
              required
              disabled={action.busy}
              error={show("category")}
              onChange={(event) => set("category", event.target.value)}
            >
              <option value="" disabled>
                Select an issue category
              </option>
              {issueCategories.map((category) => (
                <option key={category}>{category}</option>
              ))}
            </SelectField>
            <TextField
              id="network-subject"
              label="Subject"
              value={form.subject}
              required
              maxLength={120}
              disabled={action.busy}
              placeholder="A short summary of the issue"
              error={show("subject")}
              onChange={(event) => set("subject", event.target.value)}
            />
            <TextAreaField
              id="network-description"
              label="Describe Your Problem"
              value={form.description}
              required
              rows={9}
              max={5000}
              maxLength={5000}
              disabled={action.busy}
              error={show("description")}
              hint="Include what happened, what you expected and any steps that help us reproduce it. Don’t include passwords or private codes."
              placeholder="Please explain the problem you're experiencing in detail..."
              onChange={(event) => set("description", event.target.value)}
            />
            <AttachmentField
              file={form.attachment}
              disabled={action.busy}
              error={attachmentError || show("attachment")}
              onChange={(file) => {
                const problem = file ? validateAttachment(file) : null;
                setAttachmentError(
                  problem === "attachmentType"
                    ? "Attach a PNG, JPG or PDF file."
                    : problem === "attachmentSize"
                      ? "Choose a file no larger than 5 MB."
                      : "",
                );
                set("attachment", problem ? null : file);
              }}
            />
            {action.error && <InlineMessage tone="error">{action.error}</InlineMessage>}
            <Button
              type="submit"
              className="set-button--block"
              busy={action.busy}
              aria-label={action.busy ? "Submitting support request" : undefined}
            >
              <Icon name="send" size={17} /> Submit Support Request
            </Button>
            <p className="set-form__note">
              {service
                ? "Your request is only confirmed after the support service saves it."
                : "Nothing is submitted until the support service is connected."}
            </p>
          </form>
        </>
      )}
    </NetworkPage>
  );
}
