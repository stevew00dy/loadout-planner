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
  utility1: [16, 17],
  utility2: [16, 17],
  utility3: [16, 17],
  utility4: [16, 17],
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

export function getItemsForSlot(items: UexItem[], slotId: string): UexItem[] {
  const cats = SLOT_CATEGORIES[slotId];
  if (!cats) return items;
  return items.filter((item) => cats.includes(item.categoryId));
}

export function clearUexCache() {
  localStorage.removeItem(CACHE_KEY);
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(PRICE_CACHE_PREFIX)) keysToRemove.push(key);
  }
  keysToRemove.forEach((k) => localStorage.removeItem(k));
  _itemsPromise = null;
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
