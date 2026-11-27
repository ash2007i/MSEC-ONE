import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../src/dark.css", import.meta.url), "utf8");
const clean = css.replace(/\/\*[\s\S]*?\*\//g, "");
const rules = [...clean.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selector, body]) => ({
  selectors: selector
    .trim()
    .split(",")
    .map((part) => part.trim()),
  body,
}));
const root = rules[0].body;
const tokens = Object.fromEntries(
  [...root.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map(([, key, value]) => [key, value.trim()]),
);
function token(name) {
  const value = tokens[name];
  assert.ok(value, `Missing ${name}`);
  return value.startsWith("var(") ? token(value.slice(4, -1)) : value;
}
function rgb(hex) {
  return [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16));
}
function luminance(colour) {
  return colour
    .map((value) => value / 255)
    .map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4))
    .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
}
function contrast(foreground, background) {
  const [low, high] = [luminance(foreground), luminance(background)].sort((a, b) => a - b);
  return (high + 0.05) / (low + 0.05);
}
function blend(a, b, fraction) {
  return a.map((value, index) => value * fraction + b[index] * (1 - fraction));
}
function aa(foreground, background, label) {
  const ratio = contrast(foreground, background);
  assert.ok(ratio >= 4.5, `${label}: ${ratio.toFixed(2)}:1 is below AA normal-text contrast`);
}

test("all dark-theme rules are scoped; no geometry, spacing or typography is overridden", () => {
  for (const { selectors, body } of rules) {
    for (const selector of selectors)
      assert.ok(selector.startsWith('[data-theme="dark"]'), selector);
    assert.doesNotMatch(
      body,
      /(?:^|;)\s*(?:width|height|min-height|padding|margin|border-radius|font(?:-[\w-]+)?|position|inset|transform)\s*:/m,
    );
  }
});

test("Home header ivory and highlighted name meet AA across the entire gold gradient", () => {
  const stops = ["start", "mid", "end"].map((stop) => rgb(token(`--dark-header-gold-${stop}`)));
  for (let section = 0; section < stops.length - 1; section++) {
    for (let step = 0; step <= 100; step++) {
      const background = blend(stops[section + 1], stops[section], step / 100);
      aa(
        rgb(token("--dark-ivory-panel")),
        background,
        "Header greeting, date, statistics and labels",
      );
      aa(rgb("#fff3d6"), background, "Highlighted name");
    }
  }
});

test("body text, secondary labels, links and errors meet AA on dark cards and controls", () => {
  for (const background of ["--dark-bg", "--dark-secondary", "--dark-card", "--dark-elevated"]) {
    for (const foreground of ["--dark-text", "--dark-text-secondary", "--dark-link", "--danger"]) {
      aa(rgb(token(foreground)), rgb(token(background)), `${foreground} on ${background}`);
    }
  }
  for (const foreground of ["--dark-text", "--dark-text-secondary", "--dark-link", "--danger"])
    aa(rgb(token(foreground)), rgb("#406888"), `${foreground} on the brightest glass icon stop`);
  aa(rgb(token("--dark-text-muted")), rgb(token("--dark-elevated")), "Input placeholders");
  aa(rgb(token("--danger-on")), rgb(token("--danger")), "Danger button label");
});

test("navy foreground meets AA on retained pale and translucent surfaces", () => {
  const foreground = rgb(token("--dark-on-translucent"));
  const surfaces = [
    ["Ivory date tile", rgb(token("--dark-ivory-panel"))],
    ["Unread conversation", rgb(token("--dark-light-panel"))],
    ["Chat header gold edge", blend(rgb("#e9d9b8"), rgb(token("--dark-bg")), 0.48)],
    ["Pinned message", blend(rgb("#faf8f2"), rgb(token("--dark-bg")), 0.85)],
    ["Message input", blend(rgb("#ffffff"), rgb(token("--dark-elevated")), 0.64)],
    ["Message preview", blend(rgb("#dcebfa"), rgb(token("--dark-card")), 0.4)],
    ["Gold verification badge", blend(rgb("#e9d9b8"), rgb(token("--dark-card")), 0.5)],
    ["Profile contact/link", blend(rgb("#ffffff"), rgb(token("--dark-card")), 0.52)],
  ];
  for (const [label, background] of surfaces) aa(foreground, background, label);
});

test("existing blue gradients are unchanged and Gradient 6 primary labels meet AA", () => {
  assert.equal(token("--gradient-3"), "linear-gradient(160deg, #075cee, #0bcef4)");
  assert.equal(token("--gradient-5"), "linear-gradient(160deg, #0cd4ee, #0d86c0)");
  assert.equal(token("--gradient-6"), "linear-gradient(160deg, #0461f3, #045cfc)");
  const start = rgb(token("--gradient-6-start"));
  const end = rgb(token("--gradient-6-end"));
  for (let step = 0; step <= 100; step++)
    aa(rgb(token("--dark-text")), blend(start, end, step / 100), "Primary label");
});

test("semantic links use the readable dark-theme link rather than the blue background token", () => {
  assert.equal(tokens["--link"], "var(--dark-link)");
  assert.ok(
    rules.some(
      ({ selectors, body }) =>
        selectors.includes('[data-theme="dark"] .social-field .input-wrap input::placeholder') &&
        body.includes("var(--dark-text-muted)"),
    ),
  );
  assert.ok(
    rules.some(
      ({ selectors, body }) =>
        selectors.includes('[data-theme="dark"] .is-outgoing .msg-quote') &&
        body.includes("--ink: var(--white)"),
    ),
  );
});
