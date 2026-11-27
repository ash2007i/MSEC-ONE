export type LocationCountry = {
  code: string;
  name: string;
  regions: { code: string; name: string; cities: string[]; searchNames?: string[] }[];
};
export type LocationSuggestion = {
  id: string;
  label: string;
  kind: "Country" | "State / region" | "City";
  country: LocationCountry;
  region?: LocationCountry["regions"][number];
  city?: string;
};
export type LocationSelection = {
  label: string;
  cityNames: ReadonlySet<string>;
  text?: string;
};

export function normalizeLocation(value: string) {
  const normalized = value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
  return normalized === "bangalore" ? "bengaluru" : normalized;
}

export function findLocations(countries: LocationCountry[], query: string) {
  const search = normalizeLocation(query);
  if (!search)
    return countries.slice(0, 12).map((country): LocationSuggestion => ({
      id: country.code,
      label: country.name,
      kind: "Country",
      country,
    }));
  const matches: LocationSuggestion[][] = [[], []];
  const cityMatches: LocationSuggestion[][] = [[], [], []];
  for (const country of countries) {
    const countryName = normalizeLocation(country.name);
    const countryMatch = countryName.includes(search) || country.code.toLowerCase() === search;
    if (countryMatch && matches[0].length < 4)
      matches[0].push({
        id: country.code,
        label: country.name,
        kind: "Country",
        country,
      });
    for (const region of country.regions) {
      const regionName = normalizeLocation(region.name);
      const regionMatch = Boolean(region.name) && regionName.includes(search);
      if (regionMatch && matches[1].length < 4)
        matches[1].push({
          id: `${country.code}-${region.code}`,
          label: `${region.name}, ${country.name}`,
          kind: "State / region",
          country,
          region,
        });
      for (let index = 0; index < region.cities.length; index++) {
        const city = region.cities[index];
        const cityName = region.searchNames?.[index] ?? normalizeLocation(city);
        const bucket =
          cityName === search
            ? cityMatches[0]
            : cityName.includes(search)
              ? cityMatches[1]
              : countryMatch || regionMatch
                ? cityMatches[2]
                : null;
        if (bucket && bucket.length < 12) {
          bucket.push({
            id: `${country.code}-${region.code}-${city}`,
            label: [city, region.name, country.name].filter(Boolean).join(", "),
            kind: "City",
            country,
            region,
            city,
          });
        }
      }
    }
  }
  return [...matches.flat(), ...cityMatches.flat().slice(0, 12)];
}

export function selectLocation(suggestion: LocationSuggestion): LocationSelection {
  const cities = suggestion.city
    ? [suggestion.city]
    : suggestion.region
      ? suggestion.region.cities
      : suggestion.country.regions.flatMap((region) => region.cities);
  return { label: suggestion.label, cityNames: new Set(cities.map(normalizeLocation)) };
}

export function matchesLocation(city: string, selection: LocationSelection | null) {
  if (!selection) return true;
  const normalized = normalizeLocation(city);
  return selection.text
    ? normalized.includes(normalizeLocation(selection.text))
    : selection.cityNames.has(normalized);
}
