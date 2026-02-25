import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { MapPin } from "lucide-react";
import type { UexItem, ItemLocation } from "./uex-api";
import { getItemsForSlot, findItemByName, fetchItemLocations } from "./uex-api";

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  slotId: string;
  allItems: UexItem[];
}

const MAX_RESULTS = 10;

function HighlightMatch({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <span className="text-accent-amber font-semibold">{text.slice(idx, idx + query.length)}</span>
      {text.slice(idx + query.length)}
    </>
  );
}

const MAX_LOCATIONS = 5;

function LocationsStrip({
  locations,
  loading,
  expanded,
  onToggle,
  systemFilter,
  onSystemFilter,
}: {
  locations: ItemLocation[] | null;
  loading: boolean;
  expanded: boolean;
  onToggle: () => void;
  systemFilter: string | null;
  onSystemFilter: (s: string | null) => void;
}) {
  const systems = useMemo(() => {
    if (!locations || locations.length === 0) return [];
    const set = new Set(locations.map((l) => l.system));
    const order = ["Stanton", "Pyro", "Nyx"];
    return Array.from(set).sort(
      (a, b) => (order.indexOf(a) === -1 ? 999 : order.indexOf(a)) - (order.indexOf(b) === -1 ? 999 : order.indexOf(b))
    );
  }, [locations]);

  const filtered = useMemo(() => {
    if (!locations) return [];
    if (!systemFilter) return locations;
    return locations.filter((l) => l.system === systemFilter);
  }, [locations, systemFilter]);

  if (loading) {
    return (
      <div className="mt-1">
        <span className="text-[11px] text-text-muted animate-pulse">Loading locations…</span>
      </div>
    );
  }

  if (locations && locations.length === 0) {
    return (
      <div className="mt-1">
        <span className="text-[11px] text-text-muted flex items-center gap-1">
          <MapPin className="w-3 h-3" /> Not sold at shops
        </span>
      </div>
    );
  }

  if (!locations || locations.length === 0) return null;

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-1 text-[11px] text-text-muted hover:text-accent-amber transition-colors"
      >
        <MapPin className="w-3 h-3" />
        {filtered.length} location{filtered.length !== 1 ? "s" : ""}
        <span className="text-text-muted/60 ml-1">
          from {(filtered[0]?.price ?? 0).toLocaleString()} aUEC
        </span>
      </button>
      {expanded && (
        <div className="mt-1">
          {systems.length > 0 && (
            <div className="flex gap-1 mb-1 pl-4 flex-wrap">
              {systems.length > 1 && (
                <button
                  type="button"
                  onClick={() => onSystemFilter(null)}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
                    systemFilter === null
                      ? "bg-accent-amber/20 text-accent-amber"
                      : "text-text-muted hover:text-text-secondary"
                  }`}
                >
                  All
                </button>
              )}
              {systems.map((sys) => (
                <button
                  key={sys}
                  type="button"
                  onClick={() => onSystemFilter(systems.length === 1 ? null : sys)}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
                    systems.length === 1 || systemFilter === sys
                      ? "bg-accent-amber/20 text-accent-amber"
                      : "text-text-muted hover:text-text-secondary"
                  }`}
                >
                  {sys}
                </button>
              ))}
            </div>
          )}
          <div className="flex flex-col gap-0.5">
            {filtered.slice(0, MAX_LOCATIONS).map((loc, i) => (
              <span key={i} className="text-[11px] text-text-dim pl-4">
                {loc.location}
                <span className="text-text-muted ml-1.5 font-mono">
                  {loc.price.toLocaleString()} aUEC
                </span>
              </span>
            ))}
            {filtered.length > MAX_LOCATIONS && (
              <span className="text-[11px] text-text-muted pl-4 italic">
                +{filtered.length - MAX_LOCATIONS} more
              </span>
            )}
            {filtered.length === 0 && systemFilter && (
              <span className="text-[11px] text-text-muted pl-4 italic">
                Not available in {systemFilter}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ItemCombobox({
  value,
  onChange,
  placeholder,
  slotId,
  allItems,
}: Props) {
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const slotItems = useMemo(
    () =>
      getItemsForSlot(allItems, slotId).sort((a, b) =>
        a.name.localeCompare(b.name)
      ),
    [allItems, slotId]
  );

  const query = value.trim().toLowerCase();
  const hasQuery = query.length > 0;

  const filtered = useMemo(() => {
    if (!hasQuery) return slotItems.slice(0, MAX_RESULTS);
    const matches: UexItem[] = [];
    for (const item of slotItems) {
      if (item.name.toLowerCase().includes(query)) {
        matches.push(item);
        if (matches.length >= MAX_RESULTS) break;
      }
    }
    return matches;
  }, [query, hasQuery, slotItems]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    setHighlighted(-1);
  }, [filtered]);

  useEffect(() => {
    if (highlighted >= 0 && listRef.current) {
      const el = listRef.current.children[highlighted] as HTMLElement | undefined;
      el?.scrollIntoView({ block: "nearest" });
    }
  }, [highlighted]);

  const [locations, setLocations] = useState<ItemLocation[] | null>(null);
  const [loadingLocs, setLoadingLocs] = useState(false);
  const [locsExpanded, setLocsExpanded] = useState(false);
  const [systemFilter, setSystemFilter] = useState<string | null>(null);
  const prevItemIdRef = useRef<number | null>(null);

  const matchedItem = useMemo(
    () => findItemByName(allItems, value),
    [allItems, value]
  );

  useEffect(() => {
    if (!matchedItem || matchedItem.id === prevItemIdRef.current) return;
    prevItemIdRef.current = matchedItem.id;
    setLocations(null);
    setLocsExpanded(false);
    setSystemFilter(null);
    setLoadingLocs(true);
    fetchItemLocations(matchedItem.id)
      .then(setLocations)
      .finally(() => setLoadingLocs(false));
  }, [matchedItem]);

  useEffect(() => {
    if (!matchedItem) {
      prevItemIdRef.current = null;
      setLocations(null);
      setLocsExpanded(false);
      setSystemFilter(null);
    }
  }, [matchedItem]);

  const select = useCallback(
    (name: string) => {
      onChange(name);
      setOpen(false);
      inputRef.current?.blur();
    },
    [onChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
        setOpen(true);
        e.preventDefault();
        return;
      }
      if (!open) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setHighlighted((h) => (h < filtered.length - 1 ? h + 1 : 0));
          break;
        case "ArrowUp":
          e.preventDefault();
          setHighlighted((h) => (h > 0 ? h - 1 : filtered.length - 1));
          break;
        case "Enter":
          e.preventDefault();
          if (highlighted >= 0 && highlighted < filtered.length) {
            select(filtered[highlighted].name);
          } else {
            setOpen(false);
          }
          break;
        case "Tab":
          if (filtered.length > 0) {
            e.preventDefault();
            select(filtered[highlighted >= 0 ? highlighted : 0].name);
          }
          break;
        case "Escape":
          setOpen(false);
          break;
      }
    },
    [open, filtered, highlighted, select]
  );

  const showDropdown = open && slotItems.length > 0;

  return (
    <div ref={wrapperRef} className="relative">
      <input
        ref={inputRef}
        className="slot-input"
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        autoComplete="off"
      />
      {showDropdown && (
        <ul
          ref={listRef}
          className="absolute z-50 left-0 right-0 mt-1 max-h-[240px] overflow-y-auto rounded-lg border border-dark-700 bg-dark-900 shadow-xl"
        >
          {filtered.length > 0 ? (
            filtered.map((item, i) => (
              <li
                key={item.id}
                className={`flex items-baseline gap-2 px-3 py-1.5 text-sm cursor-pointer transition-colors ${
                  i === highlighted
                    ? "bg-accent-amber/15 text-accent-amber"
                    : "text-text hover:bg-dark-800"
                }`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  select(item.name);
                }}
                onMouseEnter={() => setHighlighted(i)}
              >
                <span className="truncate">
                  <HighlightMatch text={item.name} query={query} />
                </span>
                <span className="text-xs text-text-muted truncate ml-auto shrink-0">
                  {item.company_name}
                </span>
              </li>
            ))
          ) : hasQuery ? (
            <li className="px-3 py-2 text-sm text-text-muted italic">
              No matches — type freely
            </li>
          ) : null}
        </ul>
      )}
      {matchedItem && !open && (
        <LocationsStrip
          locations={locations}
          loading={loadingLocs}
          expanded={locsExpanded}
          onToggle={() => setLocsExpanded(!locsExpanded)}
          systemFilter={systemFilter}
          onSystemFilter={setSystemFilter}
        />
      )}
    </div>
  );
}
