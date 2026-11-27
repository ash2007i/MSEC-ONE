import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  institutions,
  detailErrors,
  registrationErrors,
  validateSession,
  requireVerified,
  AuthFlowError,
  authErrors,
} from "../src/auth/model.ts";
import { createSampleAccount } from "../src/settings/model.ts";

const details = {
  fullName: "Aarav Kumar",
  birthYear: "2000",
  graduationYear: "2021",
  institution: institutions[0],
};
const registration = { ...details, email: "member@example.com", password: "Password2026" };

test("registration validates membership fields, email, password and confirmation", () => {
  assert.deepEqual(registrationErrors(registration, registration.password), {});
  for (const field of Object.keys(registration)) {
    assert.ok(
      Object.keys(registrationErrors({ ...registration, [field]: "" }, registration.password))
        .length,
    );
  }
  assert.ok(registrationErrors({ ...registration, email: "invalid" }, registration.password).email);
  assert.ok(
    registrationErrors({ ...registration, password: "lettersOnly" }, "lettersOnly").password,
  );
  assert.ok(registrationErrors(registration, "wrong").confirm);
  assert.ok(detailErrors({ ...details, birthYear: "2025" }).birthYear);
  assert.ok(detailErrors({ ...details, graduationYear: "2099" }).graduationYear);
  assert.equal(institutions.length, 3);
  assert.deepEqual(Object.keys(detailErrors({ fullName: "Aarav Kumar" })).sort(), [
    "birthYear",
    "graduationYear",
    "institution",
  ]);
});

test("pending sessions never pass the verified-account guard", () => {
  const pending = { status: "pending", details, email: registration.email };
  assert.equal(validateSession(pending).status, "pending");
  assert.throws(() => requireVerified(pending));
  for (const value of [
    null,
    {},
    { status: "verified", account: { verified: false } },
    { status: "verified", account: { verified: true, id: 0 } },
  ]) {
    assert.throws(() => validateSession(value));
  }
  const verified = { status: "verified", account: createSampleAccount() };
  assert.equal(requireVerified(verified), verified);
});

test("every required provider error has a safe understandable message", () => {
  for (const [code, message] of Object.entries(authErrors)) {
    const error = new AuthFlowError(code);
    assert.equal(error.message, message);
    assert.equal(error.code, code);
  }
});

test("exactly one access-code field, screen and verification call serve both methods", () => {
  const shared = readFileSync(
    new URL("../src/auth/AccessCodeVerification.tsx", import.meta.url),
    "utf8",
  );
  const flow = readFileSync(new URL("../src/auth/AuthFlow.tsx", import.meta.url), "utf8");
  const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
  assert.equal((shared.match(/id="membership-access-code"/g) || []).length, 1);
  assert.equal((shared.match(/service\.verifyAccessCode\(/g) || []).length, 1);
  assert.equal((flow.match(/<AccessCodeVerification\b/g) || []).length, 1);
  assert.equal((flow.match(/auth\.signInGoogle\(/g) || []).length, 1);
  assert.doesNotMatch(shared, /maxLength=|inputMode="numeric"|pattern=|OTP|Resend/);
  assert.doesNotMatch(app, /readAuthSession|writeAuthSession|onClick=\{onSignIn\}/);
  assert.match(app, /const \[signedIn, setSignedIn\] = useState\(false\)/);
});
