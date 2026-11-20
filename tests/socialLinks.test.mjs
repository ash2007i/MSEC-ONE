import test from "node:test";
import assert from "node:assert/strict";
import {
  getSharedSocialLinks,
  normalizeSocialLink,
  toSocialLinksDraft,
  validateSocialLinks,
} from "../src/profile/socialLinks.ts";

test("normalizes valid social and website links", () => {
  const draft = {
    ...toSocialLinksDraft(),
    linkedin: " linkedin.com/in/aarav-kumar ",
    x: "https://twitter.com/aarav",
    website: "aarav.design",
  };
  const { links, errors } = validateSocialLinks(draft);
  assert.deepEqual(errors, {});
  assert.deepEqual(links, {
    linkedin: "https://linkedin.com/in/aarav-kumar",
    x: "https://twitter.com/aarav",
    website: "https://aarav.design/",
  });
});

test("omits empty fields from saved links and public links", () => {
  const { links } = validateSocialLinks({ ...toSocialLinksDraft(), instagram: "   " });
  assert.deepEqual(links, {});
  assert.deepEqual(getSharedSocialLinks(links), []);
});

test("rejects unsafe, malformed, mismatched, and incomplete profile links", () => {
  assert.match(normalizeSocialLink("website", "javascript:alert(1)").error, /http/);
  assert.match(normalizeSocialLink("website", "not a url").error, /spaces/);
  assert.match(normalizeSocialLink("linkedin", "https://example.com/aarav").error, /LinkedIn/);
  assert.match(normalizeSocialLink("youtube", "youtube.com").error, /profile path/);
  assert.match(normalizeSocialLink("website", "localhost").error, /complete/);
});

test("keeps links isolated by alumni account", () => {
  const accounts = {
    100: validateSocialLinks({ ...toSocialLinksDraft(), linkedin: "linkedin.com/in/aarav" }).links,
  };
  assert.equal(getSharedSocialLinks(accounts[1]).length, 0);
  assert.equal(getSharedSocialLinks(accounts[100])[0].url, "https://linkedin.com/in/aarav");
});
