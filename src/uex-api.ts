const API_BASE = "https://api.uexcorp.uk/2.0";
const CACHE_KEY = "uex-items-cache";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export interface UexItem {
  id: number;
  name: string;
  company_name: string;
  category: string;
  categoryId: number;
}

interface CachePayload {
  items: UexItem[];
  fetchedAt: number;
}

const CATEGORIES_TO_FETCH = [1, 2, 3, 4, 5, 16, 17, 18, 24] as const;

const SLOT_CATEGORIES: Record<string, number[]> = {
  undersuit: [24],
  helmet: [3],
  core: [5],
  arms: [1],
  legs: [4],
  backpack: [2],
  primary1: [18],
  primary2: [18],
  sidearm: [18],
  consumable1: [16],
  consumable2: [16],
  consumable3: [16],
  consumable4: [16],
};

function readCache(): CachePayload | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const data: CachePayload = JSON.parse(raw);
    if (Date.now() - data.fetchedAt > CACHE_TTL_MS) return null;
    return data;
  } catch {
    return null;
  }
}

function writeCache(items: UexItem[]) {
  const payload: CachePayload = { items, fetchedAt: Date.now() };
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch {
    // quota exceeded — items still usable in memory
  }
}

async function fetchCategory(categoryId: number): Promise<UexItem[]> {
  const res = await fetch(`${API_BASE}/items/?id_category=${categoryId}`);
  if (!res.ok) return [];
  const json = await res.json();
  const raw: unknown[] = json.data ?? json;
  if (!Array.isArray(raw)) return [];
  return raw.map((r: any) => ({
    id: r.id,
    name: r.name ?? "",
    company_name: r.company_name ?? "",
    category: r.category ?? "",
    categoryId,
  }));
}

let _itemsPromise: Promise<UexItem[]> | null = null;

export async function getItems(force = false): Promise<UexItem[]> {
  if (!force) {
    const cached = readCache();
    if (cached) return cached.items;
  }

  if (!force && _itemsPromise) return _itemsPromise;

  _itemsPromise = (async () => {
    const results = await Promise.allSettled(
      CATEGORIES_TO_FETCH.map((cat) => fetchCategory(cat))
    );
    const items = results.flatMap((r) =>
      r.status === "fulfilled" ? r.value : []
    );
    if (items.length > 0) writeCache(items);
    _itemsPromise = null;
    return items;
  })();

  return _itemsPromise;
}

const CONSUMABLE_BLOCKLIST = /keycard|access:|cache access|maintenance access/i;

export function getItemsForSlot(items: UexItem[], slotId: string): UexItem[] {
  const cats = SLOT_CATEGORIES[slotId];
  if (!cats) return items;
  let filtered = items.filter((item) => cats.includes(item.categoryId));
  if (slotId.startsWith("consumable")) {
    filtered = filtered.filter((item) => !CONSUMABLE_BLOCKLIST.test(item.name));
  }
  return filtered;
}

export function clearUexCache() {
  localStorage.removeItem(CACHE_KEY);
  localStorage.removeItem(THUMB_CACHE_KEY);
  localStorage.removeItem(BUYABLE_CACHE_KEY);
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(PRICE_CACHE_PREFIX)) keysToRemove.push(key);
  }
  keysToRemove.forEach((k) => localStorage.removeItem(k));
  _itemsPromise = null;
  _thumbPromise = null;
  _buyablePromise = null;
}

export function isCacheStale(): boolean {
  return readCache() === null;
}

/* ─── Item Locations / Prices ─── */

export interface ItemLocation {
  location: string;
  price: number;
  system: string;
}

const PRICE_CACHE_PREFIX = "uex-price-";
const PRICE_TTL_MS = 24 * 60 * 60 * 1000;

interface PriceCacheEntry {
  locations: ItemLocation[];
  fetchedAt: number;
}

function readPriceCache(itemId: number): ItemLocation[] | null {
  try {
    const raw = localStorage.getItem(`${PRICE_CACHE_PREFIX}${itemId}`);
    if (!raw) return null;
    const data: PriceCacheEntry = JSON.parse(raw);
    if (Date.now() - data.fetchedAt > PRICE_TTL_MS) return null;
    if (data.locations.length > 0 && !data.locations[0].system) return null;
    return data.locations;
  } catch {
    return null;
  }
}

function writePriceCache(itemId: number, locations: ItemLocation[]) {
  try {
    const entry: PriceCacheEntry = { locations, fetchedAt: Date.now() };
    localStorage.setItem(`${PRICE_CACHE_PREFIX}${itemId}`, JSON.stringify(entry));
  } catch {}
}

function formatLocation(r: any): string {
  if (r.city_name) return `${r.terminal_name ?? r.city_name}, ${r.planet_name}`;
  if (r.space_station_name) return r.space_station_name;
  if (r.outpost_name) return `${r.outpost_name}, ${r.moon_name ?? r.planet_name}`;
  return r.terminal_name ?? r.planet_name ?? "Unknown";
}

export async function fetchItemLocations(itemId: number): Promise<ItemLocation[]> {
  const cached = readPriceCache(itemId);
  if (cached) return cached;

  try {
    const res = await fetch(`${API_BASE}/items_prices/?id_item=${itemId}`);
    if (!res.ok) return [];
    const json = await res.json();
    const raw: any[] = json.data ?? json;
    if (!Array.isArray(raw)) return [];

    const locations: ItemLocation[] = raw
      .filter((r) => r.price_buy > 0)
      .map((r) => ({
        location: formatLocation(r),
        price: r.price_buy,
        system: r.star_system_name ?? "Unknown",
      }))
      .sort((a, b) => a.price - b.price);

    writePriceCache(itemId, locations);
    return locations;
  } catch {
    return [];
  }
}

export function findItemByName(items: UexItem[], name: string): UexItem | undefined {
  if (!name.trim()) return undefined;
  const lower = name.toLowerCase();
  return items.find((item) => item.name.toLowerCase() === lower);
}

/* ─── Item Thumbnails (starcitizen.tools wiki) ─── */

const WIKI_API = "https://starcitizen.tools/api.php";
const THUMB_CACHE_KEY = "wiki-thumbs-cache";
const THUMB_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const THUMB_SIZE = 40;
const BATCH_SIZE = 50;

export type ThumbnailMap = Record<string, string>;

interface ThumbCachePayload {
  thumbs: ThumbnailMap;
  fetchedAt: number;
}

function readThumbCache(): ThumbCachePayload | null {
  try {
    const raw = localStorage.getItem(THUMB_CACHE_KEY);
    if (!raw) return null;
    const data: ThumbCachePayload = JSON.parse(raw);
    if (Date.now() - data.fetchedAt > THUMB_TTL_MS) return null;
    return data;
  } catch {
    return null;
  }
}

function writeThumbCache(thumbs: ThumbnailMap) {
  try {
    localStorage.setItem(THUMB_CACHE_KEY, JSON.stringify({ thumbs, fetchedAt: Date.now() }));
  } catch {}
}

async function fetchThumbBatch(titles: string[]): Promise<ThumbnailMap> {
  const joined = titles.map(encodeURIComponent).join("|");
  const url = `${WIKI_API}?action=query&titles=${joined}&prop=pageimages&piprop=thumbnail&pithumbsize=${THUMB_SIZE}&format=json&origin=*`;
  try {
    const res = await fetch(url);
    if (!res.ok) return {};
    const json = await res.json();
    const pages = json?.query?.pages;
    if (!pages) return {};
    const result: ThumbnailMap = {};
    for (const page of Object.values(pages) as any[]) {
      if (page.thumbnail?.source) {
        result[page.title] = page.thumbnail.source;
      }
    }
    return result;
  } catch {
    return {};
  }
}

let _thumbPromise: Promise<ThumbnailMap> | null = null;

export async function fetchThumbnails(items: UexItem[]): Promise<ThumbnailMap> {
  const cached = readThumbCache();
  if (cached) return cached.thumbs;

  if (_thumbPromise) return _thumbPromise;

  _thumbPromise = (async () => {
    const uniqueNames = [...new Set(items.map((i) => i.name))];
    const batches: string[][] = [];
    for (let i = 0; i < uniqueNames.length; i += BATCH_SIZE) {
      batches.push(uniqueNames.slice(i, i + BATCH_SIZE));
    }

    const all: ThumbnailMap = {};
    const results = await Promise.allSettled(
      batches.map((batch) => fetchThumbBatch(batch))
    );
    for (const r of results) {
      if (r.status === "fulfilled") Object.assign(all, r.value);
    }

    if (Object.keys(all).length > 0) writeThumbCache(all);
    _thumbPromise = null;
    return all;
  })();

  return _thumbPromise;
}

export function clearThumbCache() {
  localStorage.removeItem(THUMB_CACHE_KEY);
  _thumbPromise = null;
}

/* ─── Buyable Set (which items can be purchased in shops) ─── */

const BUYABLE_CACHE_KEY = "uex-buyable-cache";
const BUYABLE_TTL_MS = 24 * 60 * 60 * 1000;

export type BuyableSet = Set<number>;

interface BuyableCachePayload {
  ids: number[];
  fetchedAt: number;
}

function readBuyableCache(): BuyableSet | null {
  try {
    const raw = localStorage.getItem(BUYABLE_CACHE_KEY);
    if (!raw) return null;
    const data: BuyableCachePayload = JSON.parse(raw);
    if (Date.now() - data.fetchedAt > BUYABLE_TTL_MS) return null;
    return new Set(data.ids);
  } catch {
    return null;
  }
}

function writeBuyableCache(set: BuyableSet) {
  try {
    const payload: BuyableCachePayload = { ids: [...set], fetchedAt: Date.now() };
    localStorage.setItem(BUYABLE_CACHE_KEY, JSON.stringify(payload));
  } catch {}
}

async function fetchBuyableCategory(categoryId: number): Promise<number[]> {
  try {
    const res = await fetch(`${API_BASE}/items_prices/?id_category=${categoryId}`);
    if (!res.ok) return [];
    const json = await res.json();
    const raw: any[] = json.data ?? json;
    if (!Array.isArray(raw)) return [];
    const ids = new Set<number>();
    for (const r of raw) {
      if (r.price_buy > 0 && r.id_item) ids.add(r.id_item);
    }
    return [...ids];
  } catch {
    return [];
  }
}

let _buyablePromise: Promise<BuyableSet> | null = null;

export async function fetchBuyableSet(): Promise<BuyableSet> {
  const cached = readBuyableCache();
  if (cached) return cached;

  if (_buyablePromise) return _buyablePromise;

  _buyablePromise = (async () => {
    const results = await Promise.allSettled(
      CATEGORIES_TO_FETCH.map((cat) => fetchBuyableCategory(cat))
    );
    const set = new Set<number>();
    for (const r of results) {
      if (r.status === "fulfilled") {
        for (const id of r.value) set.add(id);
      }
    }
    if (set.size > 0) writeBuyableCache(set);
    _buyablePromise = null;
    return set;
  })();

  return _buyablePromise;
}

/* ─── Armor Class Map (pre-generated from CStone data) ─── */

import armorClassData from "./armor-classes.json";

export type ArmorClassMap = Record<string, "light" | "medium" | "heavy">;

export function getArmorClassMap(): ArmorClassMap {
  return armorClassData as ArmorClassMap;
}
