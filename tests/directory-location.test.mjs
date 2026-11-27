import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  findLocations,
  matchesLocation,
  normalizeLocation,
  selectLocation,
} from "../src/directory/locations.ts";

const countries = JSON.parse(
  readFileSync(new URL("../src/directory/data/world-locations.json", import.meta.url), "utf8"),
);

test("location catalogue supports worldwide city searches", () => {
  assert.ok(countries.length >= 240);
  for (const name of ["Chennai", "London", "Tokyo", "Nairobi", "Sydney", "Toronto", "São Paulo"]) {
    const result = findLocations(countries, name);
    assert.ok(
      result.some((item) => item.city && normalizeLocation(item.city) === normalizeLocation(name)),
      name,
    );
    assert.ok(result.length <= 20);
  }
});

test("country and state selections filter directory cities", () => {
  const india = findLocations(countries, "India").find(
    (item) => item.kind === "Country" && item.country.code === "IN",
  );
  assert.ok(india);
  const selection = selectLocation(india);
  assert.equal(matchesLocation("Chennai", selection), true);
  assert.equal(matchesLocation("Bengaluru", selection), true);
  assert.equal(matchesLocation("London", selection), false);
  const state = findLocations(countries, "Tamil Nadu").find(
    (item) => item.kind === "State / region",
  );
  assert.ok(state);
  assert.equal(matchesLocation("Chennai", selectLocation(state)), true);
  assert.equal(matchesLocation("Bengaluru", selectLocation(state)), false);
});

test("city selection, diacritics, case and Bangalore alias match correctly", () => {
  const chennai = findLocations(countries, "chennai").find((item) => item.city === "Chennai");
  assert.ok(chennai);
  assert.equal(matchesLocation("CHENNAI", selectLocation(chennai)), true);
  assert.equal(matchesLocation("Bengaluru", selectLocation(chennai)), false);
  assert.equal(normalizeLocation("São Paulo"), normalizeLocation("sao paulo"));
  assert.equal(normalizeLocation("Bangalore"), normalizeLocation("Bengaluru"));
});

test("entered locations and clearing the location filter work without a service", () => {
  assert.equal(matchesLocation("Chennai", null), true);
  assert.equal(
    matchesLocation("Chennai", {
      label: "Chenn",
      text: "chenn",
      cityNames: new Set(),
    }),
    true,
  );
  assert.equal(
    matchesLocation("Chennai", {
      label: "Unlisted village",
      text: "Unlisted village",
      cityNames: new Set(),
    }),
    false,
  );
  assert.deepEqual(findLocations(countries, "zzzz-nonexistent-location"), []);
});
