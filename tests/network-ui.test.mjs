import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";

// Test-only loader: render the real TSX components without adding a runtime dependency.
registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith(".") && context.parentURL) {
      const url = new URL(specifier, context.parentURL);
      if (!/\.[a-z]+$/i.test(url.pathname)) {
        for (const extension of [".tsx", ".ts"]) {
          if (existsSync(fileURLToPath(url) + extension))
            return next(url.href + extension, context);
        }
      }
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (/\.(css|png|svg)$/.test(url))
      return {
        format: "module",
        source: `export default ${JSON.stringify(url)}`,
        shortCircuit: true,
      };
    if (/\.(ts|tsx)$/.test(url) && !url.includes("/node_modules/")) {
      const source = ts.transpileModule(readFileSync(new URL(url), "utf8"), {
        fileName: url,
        compilerOptions: {
          jsx: ts.JsxEmit.ReactJSX,
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2020,
        },
      }).outputText;
      return { format: "module", source, shortCircuit: true };
    }
    return next(url, context);
  },
});

const { ForgotPassword } = await import("../src/network/ForgotPassword.tsx");
const { SupportPage } = await import("../src/network/SupportPage.tsx");
const { NotificationsPage, NotificationCard } =
  await import("../src/network/NotificationsPage.tsx");
const { notificationPresentation } = await import("../src/network/model.ts");
const { NotificationNavigation } = await import("../src/network/navigation.ts");
const { MainHeader } = await import("../src/ui/chrome.tsx");
const noop = () => {};

test("forgot-password renders the registered email input, submit, return and honest service state", () => {
  const html = renderToStaticMarkup(h(ForgotPassword, { onLogin: noop }));
  for (const text of [
    "Forgot Password?",
    "Registered Email Address",
    "Send Reset Link",
    "Back to Login",
    "not connected",
  ])
    assert.ok(html.includes(text), text);
  assert.match(html, /type="email"/);
  assert.doesNotMatch(html, /Password Updated Successfully|Reset Link Requested/);
});

test("reset links render both password fields, visibility controls and validation requirements", () => {
  const html = renderToStaticMarkup(
    h(ForgotPassword, {
      resetRequested: true,
      token: "unverified-test-token",
      onLogin: noop,
    }),
  );
  for (const text of [
    "Reset Password",
    "New Password",
    "Confirm Password",
    "Show new password",
    "Show confirmation password",
    "Update Password",
    "Both passwords match",
  ])
    assert.ok(html.includes(text), text);
  assert.equal((html.match(/type="password"/g) || []).length, 2);
  assert.doesNotMatch(html, /Password Updated Successfully/);
});

test("support has the complete form, roomy description, eight categories and optional file input", () => {
  const html = renderToStaticMarkup(
    h(SupportPage, {
      account: { fullName: "Test Member", email: "member@example.com" },
      onBack: noop,
      onReturn: noop,
    }),
  );
  for (const text of [
    "MSGI Support",
    "How Can We Help You?",
    "Full Name",
    "Email Address",
    "Issue Category",
    "Subject",
    "Describe Your Problem",
    "Attachment",
    "Optional",
    "Submit Support Request",
    "Community Feed",
    "Technical Issues",
    "Notifications",
    "member@example.com",
    "Please explain the problem you&#x27;re experiencing in detail...",
  ])
    assert.ok(html.includes(text), text);
  assert.match(html, /rows="9"/);
  assert.match(html, /type="file"/);
  assert.doesNotMatch(html, /Your Request Has Been Received!/);
});

test("disconnected notification centre renders all filters and no invented cards", () => {
  const html = renderToStaticMarkup(
    h(NotificationsPage, {
      onBack: noop,
      onNavigate: () => null,
      onUnreadChange: noop,
    }),
  );
  for (const text of [
    "Notifications",
    "Connections",
    "Messages",
    "Feed",
    "Opportunities",
    "Events",
    "Mark All as Read",
    "not connected",
  ])
    assert.ok(html.includes(text), text);
  assert.ok(html.includes("You’re all caught up"));
  assert.doesNotMatch(html, /<article/);
});

test("every activity type renders an actionable card with timestamp and read state", () => {
  for (const [kind, presentation] of Object.entries(notificationPresentation)) {
    const html = renderToStaticMarkup(
      h(NotificationCard, {
        item: {
          id: kind,
          kind,
          actor: { name: "Test Member" },
          read: false,
          createdAt: "2026-03-14T09:30:00Z",
          target: { type: "profile", id: 1 },
        },
        busy: false,
        onRead: noop,
        onDismiss: noop,
        onOpen: noop,
      }),
    );
    for (const text of [
      "Test Member",
      presentation.description,
      presentation.action,
      "Unread",
      "Mark as Read",
      "Dismiss notification",
    ])
      assert.ok(html.includes(text), `${kind}: ${text}`);
    assert.match(html, /<time dateTime="2026-03-14T09:30:00Z"/);
  }
});

test("header keeps the original bell and avatar classes and exposes its notification action", () => {
  const html = renderToStaticMarkup(
    h(
      NotificationNavigation.Provider,
      {
        value: { open: noop, unread: 2 },
      },
      h(MainHeader, { person: { name: "Test Member" }, onProfile: noop }),
    ),
  );
  for (const text of ["main-header__profile", "notification", 'aria-label="Notifications"'])
    assert.ok(html.includes(text));
  assert.ok(html.indexOf("main-header__profile") < html.indexOf('class="notification"'));
});

const { AuthFlow } = await import("../src/auth/AuthFlow.tsx");
const { AccessCodeVerification } = await import("../src/auth/AccessCodeVerification.tsx");

test("new visitors see Create Profile with all fields and Google directly after Continue", () => {
  const html = renderToStaticMarkup(
    h(AuthFlow, {
      onVerified: noop,
      onForgotPassword: noop,
      onSupport: noop,
    }),
  );
  for (const text of [
    "Welcome to MSGI ONE",
    "Create Profile",
    "Full Name",
    "Birth Year",
    "Graduation Year / Batch",
    "Choose Institution",
    "Email Address",
    "Confirm Password",
    "Continue with Google",
    "Already have an account?",
    "Authentication is not connected",
  ])
    assert.ok(html.replace(/<[^>]*>/g, "").includes(text), text);
  assert.match(html, /class="membership-brand-name">MSGI ONE<\/span>/);
  for (const name of [
    "Meenakshi Sundararajan Engineering College",
    "Meenakshi Sundararajan School of Management",
    "Meenakshi College for Women",
  ])
    assert.ok(html.includes(name));
  assert.match(html, /google\.svg/);
  assert.ok(html.indexOf("set-button--primary") < html.indexOf("google-auth-button"));
  assert.doesNotMatch(html, /Verification Successful!/);
});

test("Login has credentials, Forgot Password, Google and Create Profile navigation", () => {
  const html = renderToStaticMarkup(
    h(AuthFlow, {
      initialView: "login",
      onVerified: noop,
      onForgotPassword: noop,
      onSupport: noop,
    }),
  );
  for (const text of [
    "Welcome back to MSGI ONE",
    "Log in to MSGI ONE",
    "Registered Email Address",
    "Password",
    "Forgot Password?",
    "Login",
    "Continue with Google",
    "Create Profile",
  ])
    assert.ok(html.replace(/<[^>]*>/g, "").includes(text), text);
  assert.match(html, /class="membership-brand-name">MSGI ONE<\/span>/);
  assert.doesNotMatch(html, /Confirm Password|Birth Year|membership-institution/);
  assert.equal((html.match(/Continue with Google/g) || []).length, 1);
});

test("the shared verification UI has one unrestricted access-code field and no false success", () => {
  const html = renderToStaticMarkup(
    h(AccessCodeVerification, {
      service: {},
      onVerified: noop,
      onBack: noop,
    }),
  );
  for (const text of ["Verify Your Access", "Access Code", "Enter your access code", "Verify Me"])
    assert.ok(html.includes(text), text);
  assert.equal((html.match(/<input /g) || []).length, 1);
  assert.doesNotMatch(html, /maxLength=|inputMode="numeric"|Verification Successful!|Resend/);
});

const { PostComposer } = await import("../src/feed/creation/PostComposer.tsx");
const { EventComposer } = await import("../src/feed/creation/EventComposer.tsx");
const { FeedCreation } = await import("../src/feed/creation/FeedCreation.tsx");
const { emptyPost, emptyEvent } = await import("../src/feed/creation/model.ts");

test("post composer matches reference structure with disabled empty Post and local-preview disclosure", () => {
  const html = renderToStaticMarkup(
    h(PostComposer, {
      profile: { name: "Test Member" },
      members: [],
      draft: emptyPost(),
      setDraft: noop,
      onClose: noop,
      onPreview: noop,
    }),
  );
  for (const text of [
    "Close post composer",
    "Anyone",
    "Add collaborators",
    "Schedule post",
    "Share your thoughts ...",
    "Improve your post",
    "Add image or video",
    "More attachments",
    "nothing is uploaded, published or scheduled",
  ])
    assert.ok(html.includes(text), text);
  assert.match(html, /disabled=""[^>]*>Post<\/button>/);
});

test("event form contains reference fields and optional end date checkbox", () => {
  const html = renderToStaticMarkup(
    h(EventComposer, {
      draft: emptyEvent(),
      setDraft: noop,
      onClose: noop,
      onPreview: noop,
    }),
  );
  for (const text of [
    "Create an event",
    "Next",
    "Upload cover image",
    "Minimum width 480 pixels",
    "Online",
    "In person",
    "Event format",
    "Event name",
    "Timezone",
    "Start date",
    "Start time",
    "Add end date and time",
    "Description",
  ])
    assert.ok(html.includes(text), text);
  assert.doesNotMatch(html, /id="fc-event-end-date"/);
  const withEnd = renderToStaticMarkup(
    h(EventComposer, {
      draft: { ...emptyEvent(), hasEnd: true },
      setDraft: noop,
      onClose: noop,
      onPreview: noop,
    }),
  );
  assert.match(withEnd, /id="fc-event-end-date"/);
  assert.match(withEnd, /id="fc-event-end-time"/);
});

test("Opportunity and Article have separate honest reference-pending pages, not invented forms", () => {
  for (const kind of ["opportunity", "article"]) {
    const html = renderToStaticMarkup(
      h(FeedCreation, {
        kind,
        profile: { name: "Test Member" },
        members: [],
        post: emptyPost(),
        setPost: noop,
        event: emptyEvent(),
        setEvent: noop,
        onClose: noop,
        onPreview: noop,
      }),
    );
    assert.ok(html.includes(kind === "article" ? "Write an Article" : "Find an Opportunity"));
    assert.ok(html.includes("Ready for your reference"));
    assert.doesNotMatch(html, /<form|<textarea/);
  }
});
