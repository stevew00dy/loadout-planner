import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { MapPin, ChevronDown, X as XIcon } from "lucide-react";
import type { UexItem, ItemLocation, ThumbnailMap, BuyableSet, ArmorClassMap } from "./uex-api";
import { getItemsForSlot, findItemByName, fetchItemLocations } from "./uex-api";
import type { ArmorClass } from "./types";

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  slotId: string;
  allItems: UexItem[];
  thumbnails?: ThumbnailMap;
  buyable?: BuyableSet;
  classFilter?: ArmorClass;
  armorClassMap?: ArmorClassMap;
  detectedClass?: ArmorClass;
}

const MAX_RESULTS = 10;
const MAX_LOCATIONS = 5;
const SYSTEM_ORDER = ["Stanton", "Pyro", "Nyx"];

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

const CLASS_PILL_COLORS: Record<string, string> = {
  heavy: "bg-accent-red/15 text-accent-red",
  medium: "bg-accent-amber/15 text-accent-amber",
  light: "bg-accent-green/15 text-accent-green",
};

export default function ItemCombobox({
  value,
  onChange,
  placeholder,
  slotId,
  allItems,
  thumbnails,
  buyable,
  classFilter,
  armorClassMap,
  detectedClass,
}: Props) {
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const slotItems = useMemo(() => {
    let items = getItemsForSlot(allItems, slotId).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
    if (classFilter && armorClassMap) {
      items = items.filter((item) => {
        const ac = armorClassMap[item.name.toLowerCase()];
        return ac === classFilter;
      });
    }
    return items;
  }, [allItems, slotId, classFilter, armorClassMap]);

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
  const [showAllLocs, setShowAllLocs] = useState(false);
  const [lightbox, setLightbox] = useState(false);
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
    setShowAllLocs(false);
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
      setShowAllLocs(false);
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
  const hasLocs = matchedItem && !open && locations && locations.length > 0;
  const noLocs = matchedItem && !open && locations && locations.length === 0;

  const systems = useMemo(() => {
    if (!locations || locations.length === 0) return [];
    const set = new Set(locations.map((l) => l.system));
    return Array.from(set).sort(
      (a, b) =>
        (SYSTEM_ORDER.indexOf(a) === -1 ? 999 : SYSTEM_ORDER.indexOf(a)) -
        (SYSTEM_ORDER.indexOf(b) === -1 ? 999 : SYSTEM_ORDER.indexOf(b))
    );
  }, [locations]);

  const filteredLocs = useMemo(() => {
    if (!locations) return [];
    if (!systemFilter) return locations;
    return locations.filter((l) => l.system === systemFilter);
  }, [locations, systemFilter]);

  return (
    <div ref={wrapperRef} className="relative">
      <div
        className={`flex items-center bg-dark-800 border border-dark-700 transition-colors ${
          locsExpanded && hasLocs
            ? "rounded-t-lg border-b-0"
            : "rounded-lg"
        }`}
      >
        <input
          ref={inputRef}
          className="flex-1 bg-transparent px-3 py-2 text-sm text-text placeholder:text-text-muted outline-none min-w-0"
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
        {detectedClass && !open && (
          <span className={`text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded-full leading-none shrink-0 mr-1 ${CLASS_PILL_COLORS[detectedClass] ?? ""}`}>
            {detectedClass}
          </span>
        )}
        {loadingLocs && matchedItem && !open && (
          <span className="text-[11px] text-text-muted animate-pulse pr-3 shrink-0">loading…</span>
        )}
        {hasLocs && (
          <>
          <div className="w-px self-stretch bg-dark-700/60" />
          <button
            type="button"
            onClick={() => setLocsExpanded(!locsExpanded)}
            className="flex items-center gap-1.5 pr-3 pl-2.5 py-2 text-[11px] text-text-muted hover:text-accent-amber transition-colors shrink-0"
          >
            <MapPin className="w-3 h-3" />
            <span className="hidden sm:inline">
              {filteredLocs.length} <span className="text-text-muted/50">from</span>{" "}
              {(filteredLocs[0]?.price ?? 0).toLocaleString()} aUEC
            </span>
            <span className="sm:hidden">{filteredLocs.length}</span>
            <ChevronDown className={`w-3 h-3 transition-transform ${locsExpanded ? "rotate-180" : ""}`} />
          </button>
          </>
        )}
        {noLocs && (
          <span className="flex items-center gap-1 pr-3 text-[11px] text-text-muted/50 shrink-0">
            <MapPin className="w-3 h-3" /> —
          </span>
        )}
      </div>

      {locsExpanded && hasLocs && (
        <div className="bg-dark-800 border border-dark-700 border-t-0 rounded-b-lg px-3 pb-2 pt-1">
          {matchedItem && thumbnails?.[matchedItem.name] && (
            <div className="flex items-center gap-2.5 mb-2 pt-1">
              <img
                src={thumbnails[matchedItem.name].replace(/\/40px-/, "/80px-")}
                alt={matchedItem.name}
                className="w-16 h-12 object-contain rounded border border-dark-600 bg-dark-900 cursor-pointer hover:border-accent-amber transition-colors"
                loading="lazy"
                onClick={() => setLightbox(true)}
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
              <div className="min-w-0">
                <span className="text-xs text-text font-medium block truncate">{matchedItem.name}</span>
                <span className="text-[10px] text-text-muted">{matchedItem.company_name}</span>
              </div>
            </div>
          )}
          {systems.length > 0 && (
            <div className="flex gap-1 mb-1.5 flex-wrap">
              {systems.length > 1 && (
                <button
                  type="button"
                  onClick={() => setSystemFilter(null)}
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
                  onClick={() => setSystemFilter(systems.length === 1 ? null : sys)}
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
            {(showAllLocs ? filteredLocs : filteredLocs.slice(0, MAX_LOCATIONS)).map((loc, i) => (
              <div key={i} className="flex items-baseline justify-between text-[11px]">
                <span className="text-text-dim truncate">{loc.location}</span>
                <span className="text-text-muted font-mono ml-2 shrink-0">
                  {loc.price.toLocaleString()}
                </span>
              </div>
            ))}
            {!showAllLocs && filteredLocs.length > MAX_LOCATIONS && (
              <button
                type="button"
                onClick={() => setShowAllLocs(true)}
                className="text-[11px] text-accent-amber/70 hover:text-accent-amber transition-colors"
              >
                +{filteredLocs.length - MAX_LOCATIONS} more
              </button>
            )}
            {showAllLocs && filteredLocs.length > MAX_LOCATIONS && (
              <button
                type="button"
                onClick={() => setShowAllLocs(false)}
                className="text-[11px] text-text-muted hover:text-accent-amber transition-colors"
              >
                show less
              </button>
            )}
            {filteredLocs.length === 0 && systemFilter && (
              <span className="text-[11px] text-text-muted italic">
                Not available in {systemFilter}
              </span>
            )}
          </div>
        </div>
      )}

      {lightbox && matchedItem && thumbnails?.[matchedItem.name] && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setLightbox(false)}
        >
          <div
            className="relative max-w-[90vw] max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setLightbox(false)}
              className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-dark-800 border border-dark-600 flex items-center justify-center text-text-muted hover:text-text hover:border-accent-amber transition-colors z-10"
            >
              <XIcon className="w-4 h-4" />
            </button>
            <img
              src={thumbnails[matchedItem.name].replace(/\/\d+px-/, "/400px-")}
              alt={matchedItem.name}
              className="max-w-[80vw] max-h-[80vh] object-contain rounded-lg border border-dark-600"
            />
            <p className="text-center text-sm text-text-secondary mt-2">{matchedItem.name}</p>
          </div>
        </div>
      )}

      {showDropdown && (
        <ul
          ref={listRef}
          className="absolute z-50 left-0 right-0 mt-1 max-h-[240px] overflow-y-auto rounded-lg border border-dark-700 bg-dark-900 shadow-xl"
        >
          {matchedItem && !hasQuery && (
            <li
              className={`flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer transition-colors border-b border-dark-700 ${
                highlighted === -1
                  ? "bg-accent-red/10 text-accent-red"
                  : "text-text-muted hover:bg-dark-800 hover:text-accent-red"
              }`}
              onMouseDown={(e) => {
                e.preventDefault();
                select("");
              }}
              onMouseEnter={() => setHighlighted(-1)}
            >
              <XIcon className="w-3.5 h-3.5 shrink-0" />
              <span>None</span>
            </li>
          )}
          {filtered.length > 0 ? (
            filtered.map((item, i) => (
              <li
                key={item.id}
                className={`flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer transition-colors ${
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
                {buyable && (
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ml-auto shrink-0 ${
                    buyable.has(item.id)
                      ? "bg-accent-green/15 text-accent-green"
                      : "bg-accent-amber/15 text-accent-amber"
                  }`}>
                    {buyable.has(item.id) ? "Shop" : "Loot"}
                  </span>
                )}
              </li>
            ))
          ) : hasQuery ? (
            <li className="px-3 py-2 text-sm text-text-muted italic">
              No matches — type freely
            </li>
          ) : null}
        </ul>
      )}
    </div>
  );
}
