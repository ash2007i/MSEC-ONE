import { useDeferredValue, useEffect, useId, useMemo, useRef, useState } from "react";
import { Icon } from "../ui/chrome";
import dataUrl from "./data/world-locations.json?url";
import {
  findLocations,
  selectLocation,
  type LocationCountry,
  type LocationSelection,
} from "./locations";
import "./location-filter.css";

let catalogue: Promise<LocationCountry[]> | null = null;
function loadCatalogue() {
  if (!catalogue) {
    catalogue = fetch(dataUrl)
      .then((response) => {
        if (!response.ok) throw new Error("Location data unavailable");
        return response.json() as Promise<LocationCountry[]>;
      })
      .catch((error) => {
        catalogue = null;
        throw error;
      });
  }
  return catalogue;
}

export function LocationFilter({
  value,
  onChange,
}: {
  value: LocationSelection | null;
  onChange: (value: LocationSelection | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const search = useDeferredValue(query);
  const [countries, setCountries] = useState<LocationCountry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  const options = useMemo(
    () => [
      { id: "all", label: "Any location", kind: "", select: () => onChange(null) },
      ...findLocations(countries, search).map((suggestion) => ({
        id: suggestion.id,
        label: suggestion.label,
        kind: suggestion.kind,
        select: () => onChange(selectLocation(suggestion)),
      })),
      ...(search.trim()
        ? [
            {
              id: "custom",
              label: `Use “${search.trim()}”`,
              kind: "Entered location",
              select: () =>
                onChange({
                  label: search.trim(),
                  text: search.trim(),
                  cityNames: new Set<string>(),
                }),
            },
          ]
        : []),
    ],
    [countries, search, onChange],
  );
  const activeIndex = Math.min(active, options.length - 1);

  useEffect(() => {
    if (!open) return;
    input.current?.focus({ preventScroll: true });
    let cancelled = false;
    setLoading(true);
    setError(false);
    void loadCatalogue()
      .then(
        (data) => {
          if (!cancelled) setCountries(data);
        },
        () => {
          if (!cancelled) setError(true);
        },
      )
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => {
      cancelled = true;
      document.removeEventListener("pointerdown", outside);
    };
  }, [open, retry]);
  useEffect(() => {
    if (open)
      document.getElementById(`${id}-option-${activeIndex}`)?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open, id]);

  function close() {
    setOpen(false);
    trigger.current?.focus({ preventScroll: true });
  }
  function choose(index: number) {
    options[index]?.select();
    close();
  }
  return (
    <div className="directory-location" ref={root}>
      <span id={`${id}-label`} className="directory-location__label">
        Location
      </span>
      <button
        type="button"
        ref={trigger}
        className="input-wrap directory-location__trigger"
        aria-labelledby={`${id}-label ${id}-value`}
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        onClick={() => {
          setQuery("");
          setActive(0);
          setOpen((current) => !current);
        }}
      >
        <Icon name="pin" size={18} />
        <span id={`${id}-value`}>{value?.label ?? "Any location"}</span>
        <Icon name="chevron" size={16} />
      </button>
      {open && (
        <div id={`${id}-panel`} className="directory-location__panel">
          <div className="search-box">
            <Icon name="search" size={18} />
            <input
              ref={input}
              type="search"
              role="combobox"
              aria-label="Search worldwide locations"
              aria-autocomplete="list"
              aria-expanded="true"
              aria-controls={`${id}-options`}
              aria-activedescendant={`${id}-option-${activeIndex}`}
              autoComplete="off"
              value={query}
              placeholder="Search city, state or country"
              onChange={(event) => {
                setQuery(event.target.value);
                setActive(event.target.value ? 1 : 0);
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                  event.preventDefault();
                  setActive(
                    (index) =>
                      (index + (event.key === "ArrowDown" ? 1 : -1) + options.length) %
                      options.length,
                  );
                } else if (event.key === "Enter") {
                  event.preventDefault();
                  if (query !== search && query.trim()) {
                    onChange({
                      label: query.trim(),
                      text: query.trim(),
                      cityNames: new Set<string>(),
                    });
                    close();
                  } else choose(activeIndex);
                } else if (event.key === "Escape") {
                  event.preventDefault();
                  event.stopPropagation();
                  close();
                }
              }}
            />
          </div>
          <div role="status" className="directory-location__status">
            {loading
              ? "Loading worldwide locations…"
              : error
                ? "Suggestions couldn’t load. You can still enter a location."
                : "Choose a city, state, region or country."}
            {error && (
              <button
                type="button"
                className="text-link"
                onClick={() => setRetry((current) => current + 1)}
              >
                Retry
              </button>
            )}
          </div>
          <div
            id={`${id}-options`}
            role="listbox"
            aria-label="Location suggestions"
            className="directory-location__options"
            aria-busy={loading}
          >
            {options.map((option, index) => (
              <button
                type="button"
                key={option.id}
                id={`${id}-option-${index}`}
                role="option"
                tabIndex={-1}
                aria-selected={index === activeIndex}
                className={`directory-location__option ${index === activeIndex ? "is-active" : ""}`}
                onPointerMove={() => setActive(index)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(index)}
              >
                <span>{option.label}</span>
                {option.kind && <small>{option.kind}</small>}
              </button>
            ))}
          </div>
          <small className="directory-location__attribution">
            Location data:{" "}
            <a href="https://www.geonames.org/" target="_blank" rel="noreferrer">
              GeoNames
            </a>
            {" · "}
            <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">
              CC BY 4.0
            </a>
          </small>
        </div>
      )}
    </div>
  );
}
