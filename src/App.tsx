import { useState, useRef, useCallback, useEffect } from "react";
import {
  Crosshair,
  Plus,
  Copy,
  Trash2,
  ChevronDown,
  ChevronUp,
  Download,
  Upload,
  RotateCcw,
  RefreshCw,
  Shield,
  Sword,
  Wrench,
  X,
  Home,
  Menu,
  Bomb,
  Heart,
  Thermometer,
  Radiation,
  Activity,
  ShieldCheck,
  Package,
  Gauge,
  Info,
} from "lucide-react";
import type { MissionType, Loadout, SlotValue } from "./types";
import { SLOTS, MISSION_TYPES, MISSION_COLORS, MULTITOOL_OPTIONS, GRENADE_OPTIONS, ARMOR_CLASS_AMMO_SLOTS, ARMOR_CLASS_THROWABLE_SLOTS, ARMOR_CLASS_CONSUMABLE_SLOTS, getEffectiveArmorClass, createEmptyLoadout } from "./data";
import type { ArmorClass, SlotGroup as SlotGroupType } from "./types";
import { useLoadouts, exportAllData, importAllData, exportSingleLoadout, importSingleLoadout } from "./hooks";
import type { UexItem, ThumbnailMap, BuyableSet, ArmorClassMap } from "./uex-api";
import { getItems, clearUexCache, fetchThumbnails, fetchBuyableSet, getArmorClassMap } from "./uex-api";
import ItemCombobox from "./ItemCombobox";
import armorStatsData from "./armor-data.json";
import weaponStatsData from "./weapon-stats.json";

/* ─── Armor Stats ─── */

interface ArmorPieceStats {
  name: string;
  category: string;
  manufacturer: string | null;
  armorClass: string | null;
  dmgReduction: number;
  tempMin: number | null;
  tempMax: number | null;
  radResistance: number;
  radScrubRate: number;
  resistance: {
    physical: number;
    energy: number;
    distortion: number;
    thermal: number;
    biochemical: number;
    stun: number;
  };
  volume: number;
  cargo: number;
  grade: string | null;
}

type ArmorStatsMap = Record<string, ArmorPieceStats>;
const armorStats: ArmorStatsMap = armorStatsData as ArmorStatsMap;

const STAT_SLOTS = ["undersuit", "helmet", "core", "arms", "legs", "backpack"] as const;

interface WeaponStats {
  name: string;
  category: string;
  mass: number;
  massWithMags: number;
  ammoCount: number;
  fireMode: string | null;
  ammoSpeed: number;
  range: number;
  pellets: number;
  dmgPerPellet: number;
  dmgPerShot: number;
  rpm: number;
  dps: number;
  dpsSustained: number | null;
  dpsBurst: number | null;
  ttk: (number | null)[] | null;
}

type WeaponStatsMap = Record<string, WeaponStats>;
const weaponStats: WeaponStatsMap = weaponStatsData as WeaponStatsMap;

const WEAPON_WEIGHT_SLOTS = ["primary1", "primary2", "sidearm"] as const;

function findWeaponStats(name: string): WeaponStats | undefined {
  const key = name.toLowerCase();
  if (weaponStats[key]) return weaponStats[key];
  const base = key.replace(/"[^"]*"\s*/g, "").replace(/\s+/g, " ").trim();
  if (weaponStats[base]) return weaponStats[base];
  return Object.values(weaponStats).find((w) => key.includes(w.name.toLowerCase()));
}
const MULTITOOL_WEIGHT: Record<string, number> = {
  "Mining": 1.5,
  "Salvage": 1.5,
  "Cutter": 1.5,
  "Tractor Beam": 4,
  "Medical": 1.5,
};
const GRENADE_WEIGHT = 0.4;
const RESISTANCE_KEYS = ["physical", "energy", "distortion", "thermal", "biochemical", "stun"] as const;

const ARMOR_WEIGHT: Record<string, Record<string, number>> = {
  helmet:    { light: 5.05, medium: 5.05, heavy: 5.05 },
  torso:     { light: 3, medium: 5, heavy: 7 },
  arm:       { light: 2, medium: 4, heavy: 5 },
  leg:       { light: 3, medium: 6, heavy: 8 },
  backpack:  { light: 6, medium: 6, heavy: 6 },
  undersuit: {},
};

// Base clothing: hat 0.25 + gloves 0.1 + pants 0.4 + footwear 0.3 + mobiGlas 0.5 = 1.55kg
const BASE_WEIGHT = 1.55;
const BASE_SPEED = 8.06;
const SPEED_BREAKPOINTS = [
  { kg: 0,  pct: 100 },
  { kg: 15, pct: 95 },
  { kg: 25, pct: 90 },
  { kg: 35, pct: 85 },
  { kg: 45, pct: 80 },
  { kg: 55, pct: 75 },
  { kg: 60, pct: 70 },
  { kg: 65, pct: 65 },
  { kg: 70, pct: 60 },
  { kg: 75, pct: 55 },
  { kg: 80, pct: 50 },
];

function getSpeedPct(totalKg: number): number {
  for (let i = SPEED_BREAKPOINTS.length - 1; i >= 0; i--) {
    if (totalKg >= SPEED_BREAKPOINTS[i].kg) return SPEED_BREAKPOINTS[i].pct;
  }
  return 100;
}

interface WeightEntry { slot: string; label: string; weight: number }

interface AggregatedStats {
  dmgReduction: number;
  tempMin: number | null;
  tempMax: number | null;
  radResistance: number;
  radScrubRate: number;
  resistance: Record<string, number>;
  totalCargo: number;
  totalWeight: number;
  speedPct: number;
  effectiveSpeed: number;
  pieces: { slot: string; stats: ArmorPieceStats; weight: number }[];
  weightBreakdown: WeightEntry[];
  equippedWeapons: { slot: string; stats: WeaponStats }[];
}

function aggregateLoadoutStats(slots: Record<string, SlotValue>): AggregatedStats | null {
  const pieces: { slot: string; stats: ArmorPieceStats; weight: number }[] = [];
  for (const slotId of STAT_SLOTS) {
    const val = slots[slotId]?.item?.trim();
    if (!val) continue;
    const stats = armorStats[val.toLowerCase()];
    if (!stats) continue;
    const cat = stats.category;
    const ac = stats.armorClass ?? "light";
    const weight = ARMOR_WEIGHT[cat]?.[ac] ?? 0;
    pieces.push({ slot: slotId, stats, weight });
  }
  if (pieces.length === 0) return null;

  let dmgReduction = 0;
  let tempMin: number | null = null;
  let tempMax: number | null = null;
  let radResistance = 0;
  let radScrubRate = 0;
  let totalCargo = 0;
  let totalWeight = BASE_WEIGHT;
  const resistance: Record<string, number> = {};
  for (const k of RESISTANCE_KEYS) resistance[k] = 1;

  for (const { stats, weight } of pieces) {
    dmgReduction += stats.dmgReduction;
    if (stats.tempMin !== null) tempMin = tempMin === null ? stats.tempMin : Math.max(tempMin, stats.tempMin);
    if (stats.tempMax !== null) tempMax = tempMax === null ? stats.tempMax : Math.min(tempMax, stats.tempMax);
    radResistance += stats.radResistance;
    radScrubRate += stats.radScrubRate;
    totalCargo += stats.cargo;
    totalWeight += weight;
    for (const k of RESISTANCE_KEYS) resistance[k] *= stats.resistance[k];
  }

  const SLOT_LABEL: Record<string, string> = {
    undersuit: "Undersuit", helmet: "Helmet", core: "Core", arms: "Arms", legs: "Legs", backpack: "Backpack",
    primary1: "Primary", primary2: "Primary 2", sidearm: "Sidearm",
    multitool1: "Multitool", multitool2: "Multitool 2",
  };

  const weightBreakdown: WeightEntry[] = pieces
    .filter((p) => p.weight > 0)
    .map((p) => ({ slot: p.slot, label: SLOT_LABEL[p.slot] ?? p.slot, weight: p.weight }));

  for (const slotId of WEAPON_WEIGHT_SLOTS) {
    const val = slots[slotId]?.item?.trim();
    if (!val) continue;
    const w = findWeaponStats(val);
    if (w) {
      totalWeight += w.mass;
      weightBreakdown.push({ slot: slotId, label: SLOT_LABEL[slotId] ?? slotId, weight: w.mass });
    }
  }

  for (const slotId of ["multitool1", "multitool2"] as const) {
    const val = slots[slotId]?.item?.trim();
    if (val && MULTITOOL_WEIGHT[val]) {
      totalWeight += MULTITOOL_WEIGHT[val];
      weightBreakdown.push({ slot: slotId, label: SLOT_LABEL[slotId] ?? slotId, weight: MULTITOOL_WEIGHT[val] });
    }
  }

  for (let i = 1; i <= 4; i++) {
    const val = slots[`throwable${i}`]?.item?.trim();
    if (val) {
      totalWeight += GRENADE_WEIGHT;
      weightBreakdown.push({ slot: `throwable${i}`, label: "Throwable", weight: GRENADE_WEIGHT });
    }
  }

  const equippedWeapons: { slot: string; stats: WeaponStats }[] = [];
  for (const slotId of [...WEAPON_WEIGHT_SLOTS, "multitool1", "multitool2"] as const) {
    const val = slots[slotId]?.item?.trim();
    if (!val) continue;
    const ws = findWeaponStats(val);
    if (ws && ws.dps > 0) equippedWeapons.push({ slot: slotId, stats: ws });
  }

  totalWeight = Math.round(totalWeight * 100) / 100;
  const speedPct = getSpeedPct(totalWeight);
  const effectiveSpeed = Math.round((BASE_SPEED * speedPct) / 100 * 100) / 100;

  return { dmgReduction, tempMin, tempMax, radResistance, radScrubRate, totalCargo, totalWeight, speedPct, effectiveSpeed, resistance, pieces, weightBreakdown, equippedWeapons };
}

/* ─── Header ─── */
function Header({
  count,
  uexLoading,
  uexItemCount,
  onReset,
  onRefreshData,
  isRefreshing,
  onExport,
  onImport,
}: {
  count: number;
  uexLoading: boolean;
  uexItemCount: number;
  onReset: () => void;
  onRefreshData: () => void;
  isRefreshing: boolean;
  onExport: () => void;
  onImport: () => void;
}) {
  const [navOpen, setNavOpen] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!navOpen) return;
    function handleClick(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setNavOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [navOpen]);

  return (
    <header className="sticky top-0 z-30 border-b border-dark-700 bg-dark-950/90 backdrop-blur-sm">
      <div className="max-w-[1600px] mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Crosshair className="w-6 h-6 text-accent-amber" />
          <h1 className="text-lg font-semibold">SC Loadout Planner</h1>
          <span className="font-mono text-sm text-text-dim ml-1">
            {count} loadout{count !== 1 ? "s" : ""}
          </span>
          {uexLoading && (
            <span className="text-xs text-accent-amber animate-pulse ml-2">Loading items…</span>
          )}
          {!uexLoading && uexItemCount > 0 && (
            <span className="text-xs text-text-muted ml-2 hidden sm:inline">
              {uexItemCount.toLocaleString()} items
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <div className="relative" ref={navRef}>
            <button
              onClick={() => setNavOpen(!navOpen)}
              className={`p-2 rounded-lg transition-all duration-200 ${
                navOpen ? "text-text bg-dark-700" : "text-text-muted hover:text-text hover:bg-dark-800"
              }`}
              title="Menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            {navOpen && (
              <div className="fixed sm:absolute right-2 sm:right-0 top-14 sm:top-full sm:mt-2 w-[calc(100vw-1rem)] sm:w-64 max-w-[16rem] p-3 shadow-xl z-50 rounded-xl border border-dark-700 bg-dark-900">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-semibold text-text-dim uppercase tracking-wide">Progress</h3>
                  <button
                    onClick={() => setNavOpen(false)}
                    className="p-0.5 rounded text-text-muted hover:text-text transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="space-y-0.5 mb-2">
                  <button
                    onClick={() => { onRefreshData(); setNavOpen(false); }}
                    disabled={isRefreshing}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-text-dim hover:text-text hover:bg-dark-700 transition-all duration-200 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
                    {isRefreshing ? "Refreshing…" : "Refresh Item Data"}
                  </button>
                  <button
                    onClick={() => { onExport(); setNavOpen(false); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-text-dim hover:text-text hover:bg-dark-700 transition-all duration-200"
                  >
                    <Download className="w-3.5 h-3.5 text-accent-blue" />
                    Export JSON
                  </button>
                  <button
                    onClick={() => { onImport(); setNavOpen(false); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-text-dim hover:text-text hover:bg-dark-700 transition-all duration-200"
                  >
                    <Upload className="w-3.5 h-3.5 text-accent-amber" />
                    Import JSON
                  </button>
                  <button
                    onClick={() => {
                      if (confirm("Delete all loadouts? This cannot be undone.")) {
                        onReset();
                        setNavOpen(false);
                      }
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-text-muted hover:text-accent-red hover:bg-accent-red/10 transition-all duration-200"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Reset All
                  </button>
                </div>
                <div className="border-t border-dark-700 my-2" />
                <h3 className="text-[10px] font-semibold text-text-dim uppercase tracking-wide mb-1.5">Tools</h3>
                <a href="/" className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-text-dim hover:text-text hover:bg-dark-700 transition-all duration-200">
                  <Home className="w-3.5 h-3.5 text-accent-amber" />
                  undisputed noobs
                </a>
                <div className="border-t border-dark-700 my-1.5" />
                <a href="/armor-tracker/" className="block px-3 py-2 rounded-lg text-xs text-text-dim hover:text-text hover:bg-dark-700 transition-all duration-200">Rare Armor Tracker</a>
                <a href="/exec-hangar-tracker/" className="block px-3 py-2 rounded-lg text-xs text-text-dim hover:text-text hover:bg-dark-700 transition-all duration-200">Exec Hangar Tracker</a>
                <a href="/wikelo-tracker/" className="block px-3 py-2 rounded-lg text-xs text-text-dim hover:text-text hover:bg-dark-700 transition-all duration-200">Wikelo Tracker</a>
                <a href="/loadout-planner/" className="block px-3 py-2 rounded-lg text-xs text-accent-amber font-medium">FPS Loadout Tracker</a>
                <a href="/refining-tracker/" className="block px-3 py-2 rounded-lg text-xs text-text-dim hover:text-text hover:bg-dark-700 transition-all duration-200">Refining Tracker</a>
                <div className="border-t border-dark-700 my-1.5" />
                <a href="https://robertsspaceindustries.com/enlist?referral=STAR-23GB-5J3N" target="_blank" rel="noopener noreferrer" className="flex items-center justify-between px-3 py-2 rounded-lg text-xs text-accent-blue hover:bg-dark-700 transition-all duration-200">
                  Play Star Citizen
                  <span className="text-[10px] text-text-muted">↗</span>
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

/* ─── New Loadout Dialog ─── */
function NewLoadoutDialog({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (name: string, mission: MissionType) => void;
}) {
  const [name, setName] = useState("");
  const [mission, setMission] = useState<MissionType>("Combat");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim() || `${mission} Loadout`;
    onCreate(trimmed, mission);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="card w-full max-w-md flex flex-col gap-4"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">New Loadout</h2>
          <button type="button" onClick={onClose} className="p-1 hover:bg-dark-800 rounded" aria-label="Close">
            <X className="w-5 h-5 text-text-dim" />
          </button>
        </div>

        <div>
          <label className="text-sm text-text-dim block mb-1">Loadout Name</label>
          <input
            ref={inputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. My Bunker Kit"
            className="slot-input"
          />
        </div>

        <div>
          <label className="text-sm text-text-dim block mb-2">Mission Type</label>
          <div className="flex flex-wrap gap-2">
            {MISSION_TYPES.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMission(m)}
                className={`mission-badge transition-all ${MISSION_COLORS[m]} ${
                  mission === m ? "ring-1 ring-white/30 scale-105" : "opacity-60 hover:opacity-80"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2 justify-end pt-2">
          <button type="button" onClick={onClose} className="btn-ghost">
            Cancel
          </button>
          <button type="submit" className="btn-primary">
            Create Loadout
          </button>
        </div>
      </form>
    </div>
  );
}

const ARMOR_SLOTS = SLOTS.filter((s) => s.group === "armor");
const WEAPON_SLOTS = SLOTS.filter((s) => s.group === "weapons");
const MULTITOOL_SLOTS = SLOTS.filter((s) => s.group === "multitools");
const AMMO_SLOTS = SLOTS.filter((s) => s.group === "ammo");
const THROWABLE_SLOTS = SLOTS.filter((s) => s.group === "throwables");
const CONSUMABLE_SLOTS = SLOTS.filter((s) => s.group === "consumables");

/* ─── Slot Group ─── */
const GROUP_ICONS: Record<SlotGroupType, typeof Shield> = {
  armor: Shield,
  weapons: Sword,
  multitools: Wrench,
  ammo: Crosshair,
  throwables: Bomb,
  consumables: Heart,
};

const GROUP_LABELS: Record<SlotGroupType, string> = {
  armor: "Armor",
  weapons: "Weapons",
  multitools: "Multitools",
  ammo: "Ammo / Magazines",
  throwables: "Throwables",
  consumables: "Consumables",
};

function getMaxSlots(group: SlotGroupType, armorClass?: ArmorClass): number {
  if (!armorClass) return 99;
  switch (group) {
    case "ammo": return ARMOR_CLASS_AMMO_SLOTS[armorClass];
    case "throwables": return ARMOR_CLASS_THROWABLE_SLOTS[armorClass];
    case "consumables": return ARMOR_CLASS_CONSUMABLE_SLOTS[armorClass];
    default: return 99;
  }
}

const ARMOR_FILTER_SLOTS = new Set(["helmet", "core", "arms", "legs", "backpack"]);

const CLASS_FILTERS: { value: ArmorClass; short: string }[] = [
  { value: "light", short: "L" },
  { value: "medium", short: "M" },
  { value: "heavy", short: "H" },
];

function SlotGroup({
  group,
  slots,
  values,
  onChange,
  allItems,
  thumbnails,
  buyable,
  armorClass,
  slotClasses,
  onSlotClassChange,
  armorClassMap,
}: {
  group: SlotGroupType;
  slots: typeof SLOTS;
  values: Record<string, SlotValue>;
  onChange: (slotId: string, value: SlotValue) => void;
  allItems: UexItem[];
  thumbnails: ThumbnailMap;
  buyable?: BuyableSet;
  armorClass?: ArmorClass;
  slotClasses?: Partial<Record<string, ArmorClass>>;
  onSlotClassChange?: (slotId: string, ac: ArmorClass | undefined) => void;
  armorClassMap?: ArmorClassMap;
}) {
  const Icon = GROUP_ICONS[group];
  const maxSlots = getMaxSlots(group, armorClass);

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-text-muted" />
        <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
          {GROUP_LABELS[group]}
        </h4>
        {(group === "ammo" || group === "throwables" || group === "consumables") && armorClass && (
          <span className="text-[10px] text-text-muted/60 font-mono">{maxSlots} slots</span>
        )}
      </div>
      <div className="grid gap-2">
        {slots.map((slot, idx) => {
          const val = values[slot.id] || { item: "", notes: "" };
          const isMultitool = slot.id.startsWith("multitool");
          const isThrowable = slot.group === "throwables";
          const isBackpack = slot.id === "backpack";
          const hasFilter = group === "armor" && ARMOR_FILTER_SLOTS.has(slot.id);
          const backpackClass = isBackpack && val.item.trim() && armorClassMap
            ? armorClassMap[val.item.trim().toLowerCase()]
            : undefined;
          const CLASS_RANK: Record<string, number> = { light: 1, medium: 2, heavy: 3 };
          const backpackWarning = isBackpack && backpackClass && armorClass
            && (CLASS_RANK[backpackClass] ?? 0) > (CLASS_RANK[armorClass] ?? 0);
          const selectOptions = isMultitool ? MULTITOOL_OPTIONS : isThrowable ? GRENADE_OPTIONS : null;
          const activeFilter = hasFilter ? slotClasses?.[slot.id] : undefined;
          const detectedClass = hasFilter && val.item.trim() && armorClassMap
            ? armorClassMap[val.item.trim().toLowerCase()]
            : undefined;

          if (idx >= maxSlots) return null;

          return (
            <div key={slot.id}>
              <div className="grid grid-cols-1 sm:grid-cols-[120px_1fr] gap-1 sm:gap-2 sm:items-start">
                <span className="text-sm text-text-dim truncate mt-2">{slot.label}</span>
                <div className={hasFilter ? "flex gap-1.5 items-start" : ""}>
                  <div className={hasFilter ? "flex-1 min-w-0" : ""}>
                    {selectOptions ? (
                      <select
                        value={val.item}
                        onChange={(e) => onChange(slot.id, { ...val, item: e.target.value })}
                        className="w-full bg-dark-800 border border-dark-700 rounded-lg px-3 py-2 text-sm text-text outline-none appearance-none cursor-pointer hover:border-dark-600 transition-colors"
                      >
                        {selectOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <ItemCombobox
                        value={val.item}
                        onChange={(v) => onChange(slot.id, { ...val, item: v })}
                        placeholder={slot.placeholder}
                        slotId={slot.id}
                        allItems={allItems}
                        thumbnails={thumbnails}
                        buyable={buyable}
                        classFilter={activeFilter}
                        armorClassMap={armorClassMap}
                        detectedClass={detectedClass}
                      />
                    )}
                  </div>
                  {hasFilter && onSlotClassChange && (
                    <div className="flex rounded border border-dark-700 overflow-hidden shrink-0 self-center">
                      {CLASS_FILTERS.map((ac) => (
                        <button
                          key={ac.value}
                          type="button"
                          onClick={() => onSlotClassChange(slot.id, activeFilter === ac.value ? undefined : ac.value)}
                          className={`px-1.5 py-0.5 text-[10px] font-semibold transition-colors ${
                            activeFilter === ac.value
                              ? "bg-accent-amber/20 text-accent-amber"
                              : "bg-dark-800 text-text-muted/50 hover:text-text-muted"
                          }`}
                          title={`Filter: ${ac.value}`}
                        >
                          {ac.short}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              {backpackWarning && (
                <p className="text-[10px] text-accent-amber mt-0.5 sm:ml-[128px]">
                  ⚠ {backpackClass} backpack requires {backpackClass} or heavier chest armor
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Loadout Card ─── */
/* ─── Stats Panel ─── */

const RESISTANCE_LABELS: Record<string, { label: string; color: string }> = {
  physical: { label: "Physical", color: "text-text-secondary" },
  energy: { label: "Energy", color: "text-accent-blue" },
  distortion: { label: "Distortion", color: "text-accent-purple" },
  thermal: { label: "Thermal", color: "text-accent-red" },
  biochemical: { label: "Biochemical", color: "text-accent-green" },
  stun: { label: "Stun", color: "text-accent-yellow" },
};

function StatsSidebar({ stats, loadoutName }: { stats: AggregatedStats | null; loadoutName?: string }) {
  const [showWeightInfo, setShowWeightInfo] = useState(false);
  const [showWeaponInfo, setShowWeaponInfo] = useState(false);
  if (!stats) {
    return (
      <div className="card flex flex-col items-center justify-center py-10 text-center">
        <Activity className="w-8 h-8 text-dark-600 mb-3" />
        <p className="text-sm text-text-muted">Expand a loadout with armor equipped to see stats</p>
      </div>
    );
  }

  const dmgPct = Math.round(stats.dmgReduction * 100);

  return (
    <div className="card flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Activity className="w-4 h-4 text-accent-amber" />
        <span className="text-xs text-text-muted uppercase tracking-wider font-semibold">Stats</span>
      </div>
      {loadoutName && (
        <p className="text-sm font-medium text-text truncate -mt-1">{loadoutName}</p>
      )}

      {/* Weight & Speed */}
      <div className="bg-dark-800/60 rounded-lg p-2.5 border border-dark-700/50 relative">
        <div className="flex items-center gap-1.5 mb-1.5">
          <Gauge className="w-3.5 h-3.5 text-accent-amber" />
          <span className="text-[11px] text-text-muted font-medium">Weight & Speed</span>
          <button
            onClick={() => setShowWeightInfo((v) => !v)}
            className="ml-auto w-4 h-4 flex items-center justify-center rounded-full hover:bg-dark-700/60 transition-colors"
            title="Weight milestones"
          >
            <Info className="w-3 h-3 text-text-muted" />
          </button>
        </div>
        <div className="flex items-baseline justify-between">
          <div>
            <span className="text-lg font-mono font-bold text-text">{stats.totalWeight}</span>
            <span className="text-[10px] text-text-muted ml-0.5">kg</span>
          </div>
          <div className="text-right">
            <span className={`text-lg font-mono font-bold ${
              stats.speedPct >= 90 ? "text-accent-green" : stats.speedPct >= 70 ? "text-accent-amber" : "text-accent-red"
            }`}>{stats.speedPct}%</span>
            <span className="text-[10px] text-text-muted block">{stats.effectiveSpeed} m/s</span>
          </div>
        </div>
        <div className="mt-1.5 h-1.5 bg-dark-900 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              stats.speedPct >= 90 ? "bg-accent-green/70" : stats.speedPct >= 70 ? "bg-accent-amber/70" : "bg-accent-red/70"
            }`}
            style={{ width: `${stats.speedPct}%` }}
          />
        </div>
        <div className="flex flex-col gap-0.5 mt-2">
          {stats.weightBreakdown.map((w, i) => (
            <div key={`${w.slot}-${i}`} className="flex justify-between text-[10px]">
              <span className="text-text-muted truncate mr-2">{w.label}</span>
              <span className="font-mono text-text-dim shrink-0">{w.weight} kg</span>
            </div>
          ))}
        </div>
        {showWeightInfo && (
          <div className="mt-2 bg-dark-900/80 rounded-md border border-dark-700/50 p-2">
            <table className="w-full text-[10px]">
              <thead>
                <tr className="text-text-muted">
                  <th className="text-left font-medium pb-1">Weight</th>
                  <th className="text-right font-medium pb-1">Speed</th>
                </tr>
              </thead>
              <tbody>
                {SPEED_BREAKPOINTS.map((bp) => (
                  <tr key={bp.kg} className={`${stats.speedPct === bp.pct ? "text-accent-amber font-bold" : bp.pct <= 60 ? "text-accent-red/70" : "text-text-dim"}`}>
                    <td>{bp.kg} kg</td><td className="text-right font-mono">{bp.pct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Damage Reduction */}
      <div className="bg-dark-800/60 rounded-lg p-2.5 border border-dark-700/50">
        <div className="flex items-center gap-1.5 mb-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-accent-green" />
          <span className="text-[11px] text-text-muted font-medium">Damage Reduction</span>
        </div>
        <span className="text-xl font-mono font-bold text-accent-green">{dmgPct}%</span>
        <div className="mt-1.5 h-1.5 bg-dark-900 rounded-full overflow-hidden">
          <div className="h-full bg-accent-green/70 rounded-full transition-all" style={{ width: `${Math.min(dmgPct, 100)}%` }} />
        </div>
      </div>

      {/* Temperature */}
      <div className="bg-dark-800/60 rounded-lg p-2.5 border border-dark-700/50">
        <div className="flex items-center gap-1.5 mb-1.5">
          <Thermometer className="w-3.5 h-3.5 text-accent-blue" />
          <span className="text-[11px] text-text-muted font-medium">Temperature</span>
        </div>
        {stats.tempMin !== null && stats.tempMax !== null ? (
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-mono font-bold text-accent-blue">{stats.tempMin}°</span>
            <span className="text-text-muted text-xs">to</span>
            <span className="text-lg font-mono font-bold text-accent-red">{stats.tempMax}°</span>
          </div>
        ) : (
          <span className="text-sm text-text-muted">—</span>
        )}
      </div>

      {/* Radiation */}
      <div className="bg-dark-800/60 rounded-lg p-2.5 border border-dark-700/50">
        <div className="flex items-center gap-1.5 mb-1.5">
          <Radiation className="w-3.5 h-3.5 text-accent-amber" />
          <span className="text-[11px] text-text-muted font-medium">Radiation</span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-lg font-mono font-bold text-accent-amber">{stats.radResistance.toLocaleString()}</span>
          <span className="text-[10px] text-text-muted">REM</span>
        </div>
        <div className="text-[10px] text-text-muted mt-0.5">
          Scrub: <span className="font-mono text-text-dim">{stats.radScrubRate.toFixed(1)}</span> REM/s
        </div>
      </div>

      {/* Resistances */}
      <div className="bg-dark-800/60 rounded-lg p-2.5 border border-dark-700/50">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-accent-purple" />
            <span className="text-[11px] text-text-muted font-medium">Resistances</span>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          {RESISTANCE_KEYS.map((key) => {
            const { label, color } = RESISTANCE_LABELS[key];
            const value = stats.resistance[key];
            const protection = Math.round((1 - value) * 100);
            return (
              <div key={key}>
                <div className="flex items-center justify-between mb-0.5">
                  <span className={`text-[11px] font-medium ${color}`}>{label}</span>
                  <span className="text-[11px] font-mono text-text-dim">{protection}%</span>
                </div>
                <div className="h-1.5 bg-dark-900 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      protection >= 50 ? "bg-accent-green/70" : protection >= 25 ? "bg-accent-amber/70" : "bg-accent-red/70"
                    }`}
                    style={{ width: `${protection}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Carry Capacity */}
      <div className="bg-dark-800/60 rounded-lg p-2.5 border border-dark-700/50">
        <div className="flex items-center gap-1.5 mb-2">
          <Package className="w-3.5 h-3.5 text-accent-blue" />
          <span className="text-[11px] text-text-muted font-medium">Carry Capacity</span>
          <span className="text-sm font-mono font-bold text-accent-blue ml-auto">
            {stats.totalCargo} µSCU
          </span>
        </div>
        <div className="flex flex-col gap-1">
          {stats.pieces.filter((p) => p.stats.cargo > 0).map((p) => (
            <div key={p.slot} className="flex justify-between text-[10px]">
              <span className="capitalize text-text-muted">{p.slot}</span>
              <span className="font-mono text-text-dim">{p.stats.cargo} µSCU</span>
            </div>
          ))}
        </div>
      </div>

      {/* Weapon Stats */}
      {stats.equippedWeapons.length > 0 && (
        <div className="bg-dark-800/60 rounded-lg p-2.5 border border-dark-700/50">
          <div className="flex items-center gap-1.5 mb-2">
            <Crosshair className="w-3.5 h-3.5 text-accent-red" />
            <span className="text-[11px] text-text-muted font-medium">Weapons</span>
            <button
              onClick={() => setShowWeaponInfo((v) => !v)}
              className="ml-auto w-4 h-4 flex items-center justify-center rounded-full hover:bg-dark-700/60 transition-colors"
              title="Stat abbreviations"
            >
              <Info className="w-3 h-3 text-text-muted" />
            </button>
          </div>
          <div className="flex flex-col gap-2.5">
            {stats.equippedWeapons.map((w) => {
              const SLOT_LABELS: Record<string, string> = { primary1: "Primary", primary2: "Secondary", sidearm: "Sidearm" };
              const slotLabel = SLOT_LABELS[w.slot] || w.slot;
              const catColors: Record<string, string> = {
                assault_rifle: "text-accent-blue",
                sniper_rifle: "text-accent-purple",
                lmg: "text-accent-amber",
                shotgun: "text-accent-red",
                smg: "text-accent-green",
                pistol: "text-text-dim",
                heavy: "text-accent-red",
              };
              const catLabels: Record<string, string> = {
                assault_rifle: "AR",
                sniper_rifle: "Sniper",
                lmg: "LMG",
                shotgun: "Shotgun",
                smg: "SMG",
                pistol: "Pistol",
                heavy: "Heavy",
                mounted: "Mounted",
              };
              return (
                <div key={w.slot} className="border-b border-dark-700/30 last:border-0 pb-2 last:pb-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-text-muted uppercase">{slotLabel}</span>
                    <span className={`text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded-full bg-dark-900/80 ${catColors[w.stats.category] ?? "text-text-dim"}`}>
                      {catLabels[w.stats.category] ?? w.stats.category}
                    </span>
                  </div>
                  <p className="text-xs font-medium text-text truncate mb-1.5">{w.stats.name}</p>
                  {(() => {
                    const stk = w.stats.dmgPerShot > 0 ? Math.ceil(100 / w.stats.dmgPerShot) : null;
                    return (
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                        <div className="flex justify-between text-[10px]">
                          <span className="text-text-muted">DPS</span>
                          <span className="font-mono text-accent-red font-bold">{Math.round(w.stats.dps)}</span>
                        </div>
                        <div className="flex justify-between text-[10px]">
                          <span className="text-text-muted">RPM</span>
                          <span className="font-mono text-text-dim">{w.stats.rpm}</span>
                        </div>
                        <div className="flex justify-between text-[10px]">
                          <span className="text-text-muted">Dmg/Shot</span>
                          <span className="font-mono text-text-dim">{w.stats.dmgPerShot}{w.stats.pellets > 1 ? ` (${w.stats.pellets}×${w.stats.dmgPerPellet})` : ""}</span>
                        </div>
                        {stk !== null && (
                          <div className="flex justify-between text-[10px]">
                            <span className="text-text-muted">STK <span className="text-[8px]">(no armor)</span></span>
                            <span className={`font-mono font-bold ${stk <= 3 ? "text-accent-red" : stk <= 6 ? "text-accent-amber" : "text-text-dim"}`}>{stk}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-[10px]">
                          <span className="text-text-muted">Range</span>
                          <span className="font-mono text-text-dim">{w.stats.range >= 1000 ? `${(w.stats.range / 1000).toFixed(1)}km` : `${w.stats.range}m`}</span>
                        </div>
                        <div className="flex justify-between text-[10px]">
                          <span className="text-text-muted">Ammo</span>
                          <span className="font-mono text-text-dim">{w.stats.ammoCount}</span>
                        </div>
                        {w.stats.ttk && w.stats.ttk[0] !== null && (
                          <div className="flex justify-between text-[10px] col-span-2 pt-0.5 border-t border-dark-700/30">
                            <span className="text-text-muted">TTK</span>
                            <span className="font-mono text-accent-amber font-bold">{w.stats.ttk[0]}s</span>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                  {w.stats.fireMode && (
                    <div className="text-[9px] text-text-muted mt-1">{w.stats.fireMode}</div>
                  )}
                </div>
              );
            })}
          </div>
          {showWeaponInfo && (
            <div className="mt-2 bg-dark-900/80 rounded-md border border-dark-700/50 p-2">
              <div className="flex flex-col gap-1 text-[10px]">
                <div className="flex justify-between"><span className="text-text-muted font-medium">DPS</span><span className="text-text-dim">Damage Per Second</span></div>
                <div className="flex justify-between"><span className="text-text-muted font-medium">RPM</span><span className="text-text-dim">Rounds Per Minute</span></div>
                <div className="flex justify-between"><span className="text-text-muted font-medium">Dmg/Shot</span><span className="text-text-dim">Damage Per Shot</span></div>
                <div className="flex justify-between"><span className="text-text-muted font-medium">STK</span><span className="text-text-dim">Shots To Kill</span></div>
                <div className="flex justify-between"><span className="text-text-muted font-medium">TTK</span><span className="text-text-dim">Time To Kill</span></div>
                <div className="flex justify-between"><span className="text-text-muted font-medium">Ammo</span><span className="text-text-dim">Magazine Size</span></div>
                <div className="flex justify-between"><span className="text-text-muted font-medium">Range</span><span className="text-text-dim">Effective Range</span></div>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}

function LoadoutCard({
  loadout,
  onUpdate,
  onDelete,
  onDuplicate,
  allItems,
  thumbnails,
  buyable,
  armorClassMap,
  expanded,
  onToggleExpanded,
}: {
  loadout: Loadout;
  onUpdate: (id: string, updates: Partial<Loadout>) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  allItems: UexItem[];
  thumbnails: ThumbnailMap;
  buyable?: BuyableSet;
  armorClassMap: ArmorClassMap;
  expanded: boolean;
  onToggleExpanded: () => void;
}) {
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(loadout.name);
  const [editingType, setEditingType] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const typeRef = useRef<HTMLDivElement>(null);

  const effectiveClass = getEffectiveArmorClass(loadout.slotClasses);
  const maxAmmo = ARMOR_CLASS_AMMO_SLOTS[effectiveClass];
  const maxThrowable = ARMOR_CLASS_THROWABLE_SLOTS[effectiveClass];
  const maxConsumable = ARMOR_CLASS_CONSUMABLE_SLOTS[effectiveClass];
  const visibleSlots = SLOTS.filter((s) => {
    const slotsInGroup = SLOTS.filter((x) => x.group === s.group);
    const idxInGroup = slotsInGroup.indexOf(s);
    if (s.group === "ammo") return idxInGroup < maxAmmo;
    if (s.group === "throwables") return idxInGroup < maxThrowable;
    if (s.group === "consumables") return idxInGroup < maxConsumable;
    return true;
  });
  const filledSlots = visibleSlots.filter((s) => loadout.slots[s.id]?.item.trim()).length;
  const totalSlots = visibleSlots.length;

  useEffect(() => {
    if (editingName) nameRef.current?.focus();
  }, [editingName]);

  useEffect(() => {
    if (!editingType) return;
    function handleClick(e: MouseEvent) {
      if (typeRef.current && !typeRef.current.contains(e.target as Node)) {
        setEditingType(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [editingType]);

  const handleNameBlur = () => {
    setEditingName(false);
    const trimmed = nameValue.trim();
    if (trimmed && trimmed !== loadout.name) {
      onUpdate(loadout.id, { name: trimmed });
    } else {
      setNameValue(loadout.name);
    }
  };

  const handleNameKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleNameBlur();
    if (e.key === "Escape") {
      setNameValue(loadout.name);
      setEditingName(false);
    }
  };

  const handleSlotChange = (slotId: string, value: SlotValue) => {
    const updates: Partial<Loadout> = {
      slots: { ...loadout.slots, [slotId]: value },
    };
    if (ARMOR_FILTER_SLOTS.has(slotId) && value.item.trim()) {
      const detected = armorClassMap[value.item.toLowerCase()];
      if (detected) {
        updates.slotClasses = { ...loadout.slotClasses, [slotId]: detected };
      }
    }
    onUpdate(loadout.id, updates);
  };

  const handleSlotClassChange = (slotId: string, ac: ArmorClass | undefined) => {
    const next = { ...loadout.slotClasses };
    if (ac === undefined) {
      delete next[slotId];
    } else {
      next[slotId] = ac;
    }
    onUpdate(loadout.id, { slotClasses: next });
  };

  const handleNotesChange = (notes: string) => {
    onUpdate(loadout.id, { notes });
  };

  const handleDelete = () => {
    if (confirm(`Delete "${loadout.name}"?`)) onDelete(loadout.id);
  };

  return (
    <div className="card">
      {/* Card Header — click anywhere to expand/collapse */}
      <div className="flex items-start justify-between gap-3">
        <div
          className="flex-1 min-w-0 cursor-pointer"
          onClick={onToggleExpanded}
        >
          <div className="flex items-center gap-2 flex-wrap">
            {editingName ? (
              <input
                ref={nameRef}
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                onBlur={handleNameBlur}
                onKeyDown={handleNameKey}
                onClick={(e) => e.stopPropagation()}
                className="slot-input text-base font-semibold !p-1 !px-2 max-w-[260px]"
              />
            ) : (
              <button
                type="button"
                className="text-base font-semibold hover:text-accent-amber transition-colors truncate text-left bg-transparent border-none p-0 text-text"
                onClick={(e) => { e.stopPropagation(); setEditingName(true); }}
                title="Click to rename"
              >
                {loadout.name}
              </button>
            )}
            <div ref={typeRef} className="relative" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => setEditingType(!editingType)}
                className={`mission-badge ${MISSION_COLORS[loadout.missionType]} hover:brightness-125 transition-all`}
                title="Click to change type"
              >
                {loadout.missionType}
              </button>
              {editingType && (
                <div className="absolute left-0 top-full mt-1 z-50 w-40 rounded-lg border border-dark-700 bg-dark-900/98 backdrop-blur-md shadow-2xl py-1">
                  {MISSION_TYPES.map((type) => (
                    <button
                      key={type}
                      onClick={() => {
                        onUpdate(loadout.id, { missionType: type });
                        setEditingType(false);
                      }}
                      className={`block w-full text-left px-3 py-1.5 text-xs transition-colors ${
                        type === loadout.missionType
                          ? "text-accent-amber font-medium bg-accent-amber/5"
                          : "text-text-secondary hover:bg-dark-700"
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xs text-text-muted font-mono">
              {filledSlots}/{totalSlots} slots filled
            </span>
            <div className="flex-1 max-w-[120px] h-1 bg-dark-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-accent-amber rounded-full transition-all"
                style={{ width: `${(filledSlots / totalSlots) * 100}%` }}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => exportSingleLoadout(loadout)}
            className="p-1.5 rounded hover:bg-dark-800 text-text-muted hover:text-text transition-colors"
            title="Export loadout"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDuplicate(loadout.id)}
            className="p-1.5 rounded hover:bg-dark-800 text-text-muted hover:text-text transition-colors"
            title="Duplicate"
          >
            <Copy className="w-4 h-4" />
          </button>
          <button
            onClick={handleDelete}
            className="p-1.5 rounded hover:bg-dark-800 text-text-muted hover:text-accent-red transition-colors"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            onClick={onToggleExpanded}
            className="p-1.5 rounded hover:bg-dark-800 text-text-muted hover:text-text transition-colors"
            aria-label={expanded ? "Collapse loadout" : "Expand loadout"}
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Collapsed Preview */}
      {!expanded && filledSlots > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5 cursor-pointer" onClick={onToggleExpanded}>
          {visibleSlots.filter((s) => loadout.slots[s.id]?.item.trim()).map((s) => (
            <span
              key={s.id}
              className="text-xs bg-dark-800 border border-dark-700 rounded px-2 py-0.5 text-text-dim"
            >
              <span className="text-text-muted">{s.label}:</span> {loadout.slots[s.id].item}
            </span>
          ))}
        </div>
      )}

      {/* Expanded Editor */}
      {expanded && (
        <div className="mt-4 flex flex-col gap-5">
          <SlotGroup group="armor" slots={ARMOR_SLOTS} values={loadout.slots} onChange={handleSlotChange} allItems={allItems} thumbnails={thumbnails} buyable={buyable} armorClass={effectiveClass} slotClasses={loadout.slotClasses} onSlotClassChange={handleSlotClassChange} armorClassMap={armorClassMap} />
          <SlotGroup group="weapons" slots={WEAPON_SLOTS} values={loadout.slots} onChange={handleSlotChange} allItems={allItems} thumbnails={thumbnails} buyable={buyable} armorClass={effectiveClass} />
          <SlotGroup group="multitools" slots={MULTITOOL_SLOTS} values={loadout.slots} onChange={handleSlotChange} allItems={allItems} thumbnails={thumbnails} buyable={buyable} armorClass={effectiveClass} />
          <SlotGroup group="ammo" slots={AMMO_SLOTS} values={loadout.slots} onChange={handleSlotChange} allItems={allItems} thumbnails={thumbnails} buyable={buyable} armorClass={effectiveClass} />
          <SlotGroup group="throwables" slots={THROWABLE_SLOTS} values={loadout.slots} onChange={handleSlotChange} allItems={allItems} thumbnails={thumbnails} buyable={buyable} armorClass={effectiveClass} />
          <SlotGroup group="consumables" slots={CONSUMABLE_SLOTS} values={loadout.slots} onChange={handleSlotChange} allItems={allItems} thumbnails={thumbnails} buyable={buyable} armorClass={effectiveClass} />

          <div>
            <label className="text-xs text-text-muted uppercase tracking-wider font-semibold block mb-2">
              Notes
            </label>
            <textarea
              className="slot-input min-h-[60px] resize-y"
              placeholder="Extra notes — ammo types, strategy, where to buy, etc."
              value={loadout.notes}
              onChange={(e) => handleNotesChange(e.target.value)}
            />
          </div>

        </div>
      )}
    </div>
  );
}

/* ─── Footer ─── */
function Footer() {
  return (
    <footer className="border-t border-dark-700 mt-12 py-6">
      <div className="max-w-[1600px] mx-auto px-4 flex flex-col items-center gap-3">
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1">
          <a href="/" className="text-xs text-text-muted hover:text-accent-amber transition-colors">Home</a>
          <a href="/armor-tracker/" className="text-xs text-text-muted hover:text-accent-amber transition-colors">Rare Armor Tracker</a>
          <a href="/exec-hangar-tracker/" className="text-xs text-text-muted hover:text-accent-amber transition-colors">Exec Hangar Tracker</a>
          <a href="/wikelo-tracker/" className="text-xs text-text-muted hover:text-accent-amber transition-colors">Wikelo Tracker</a>
          <a href="/loadout-planner/" className="text-xs text-accent-amber font-medium">FPS Loadout Tracker</a>
          <a href="/refining-tracker/" className="text-xs text-text-muted hover:text-accent-amber transition-colors">Refining Tracker</a>
          <a href="https://www.youtube.com/@undisputednoobs" target="_blank" rel="noopener noreferrer" className="text-xs text-text-muted hover:text-accent-amber transition-colors">YouTube</a>
        </div>
        <p className="text-[10px] text-text-muted/50">Unofficial fan-made tool. Not affiliated with Cloud Imperium Games. All data may be inaccurate — use at your own risk.</p>
      </div>
    </footer>
  );
}

/* ─── Empty State ─── */
function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <Crosshair className="w-12 h-12 text-dark-600" />
      <h2 className="text-lg font-semibold text-text-dim">No loadouts yet</h2>
      <p className="text-sm text-text-muted text-center max-w-sm">
        Create your first loadout to plan gear for combat, stealth, mining, or any mission type.
      </p>
      <button onClick={onCreate} className="btn-primary flex items-center gap-2 mt-2">
        <Plus className="w-4 h-4" /> Create Loadout
      </button>
    </div>
  );
}

/* ─── Filter Bar ─── */
function FilterBar({
  active,
  onSelect,
  counts,
}: {
  active: MissionType | "All";
  onSelect: (val: MissionType | "All") => void;
  counts: Record<string, number>;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => onSelect("All")}
        className={`mission-badge transition-all ${
          active === "All"
            ? "bg-dark-600 text-text ring-1 ring-white/20"
            : "bg-dark-800 text-text-muted hover:text-text-dim"
        }`}
      >
        All ({counts["All"] || 0})
      </button>
      {MISSION_TYPES.map((m) =>
        (counts[m] || 0) > 0 ? (
          <button
            key={m}
            onClick={() => onSelect(m)}
            className={`mission-badge transition-all ${MISSION_COLORS[m]} ${
              active === m ? "ring-1 ring-white/20" : "opacity-60 hover:opacity-80"
            }`}
          >
            {m} ({counts[m]})
          </button>
        ) : null
      )}
    </div>
  );
}

/* ─── App ─── */
export default function App() {
  const { loadouts, addLoadout, updateLoadout, deleteLoadout, duplicateLoadout, resetAll } =
    useLoadouts();
  const [showNew, setShowNew] = useState(false);
  const [filter, setFilter] = useState<MissionType | "All">("All");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const importFileRef = useRef<HTMLInputElement>(null);
  const fullImportRef = useRef<HTMLInputElement>(null);
  const [uexItems, setUexItems] = useState<UexItem[]>([]);
  const [uexLoading, setUexLoading] = useState(false);
  const [thumbs, setThumbs] = useState<ThumbnailMap>({});
  const [buyable, setBuyable] = useState<BuyableSet>(new Set());
  const [armorClassMap] = useState<ArmorClassMap>(() => getArmorClassMap());

  useEffect(() => {
    setUexLoading(true);
    getItems()
      .then((items) => {
        setUexItems(items);
        fetchThumbnails(items).then(setThumbs).catch(() => {});
        fetchBuyableSet().then(setBuyable).catch(() => {});
      })
      .catch(() => {})
      .finally(() => setUexLoading(false));
  }, []);

  useEffect(() => {
    if (Object.keys(armorClassMap).length === 0) return;
    for (const loadout of loadouts) {
      const newClasses = { ...loadout.slotClasses };
      let changed = false;
      for (const slotId of ["helmet", "core", "arms", "legs", "backpack"]) {
        const itemName = loadout.slots[slotId]?.item?.trim();
        if (!itemName) continue;
        const detected = armorClassMap[itemName.toLowerCase()];
        if (detected && newClasses[slotId] !== detected) {
          newClasses[slotId] = detected;
          changed = true;
        }
      }
      if (changed) updateLoadout(loadout.id, { slotClasses: newClasses });
    }
  }, [armorClassMap]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRefreshData = useCallback(() => {
    clearUexCache();
    setUexLoading(true);
    getItems(true)
      .then((items) => {
        setUexItems(items);
        fetchThumbnails(items).then(setThumbs).catch(() => {});
        fetchBuyableSet().then(setBuyable).catch(() => {});
      })
      .catch(() => {})
      .finally(() => setUexLoading(false));
  }, []);

  const counts: Record<string, number> = { All: loadouts.length };
  for (const l of loadouts) {
    counts[l.missionType] = (counts[l.missionType] || 0) + 1;
  }

  const filtered =
    filter === "All" ? loadouts : loadouts.filter((l) => l.missionType === filter);

  const handleCreate = (name: string, mission: MissionType) => {
    addLoadout(createEmptyLoadout(name, mission));
    setShowNew(false);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header
        count={loadouts.length}
        uexLoading={uexLoading}
        uexItemCount={uexItems.length}
        onReset={resetAll}
        onRefreshData={handleRefreshData}
        isRefreshing={uexLoading}
        onExport={exportAllData}
        onImport={() => fullImportRef.current?.click()}
      />

      <main className="flex-1 max-w-[1600px] w-full mx-auto px-4 py-6">
        {loadouts.length === 0 ? (
          <EmptyState onCreate={() => setShowNew(true)} />
        ) : (
          <>
            <div className="flex items-center justify-between gap-4 flex-wrap mb-5">
              <FilterBar active={filter} onSelect={setFilter} counts={counts} />
              <div className="flex items-center gap-2">
                <button
                  onClick={() => importFileRef.current?.click()}
                  className="btn-ghost flex items-center gap-2"
                  title="Import a loadout from JSON"
                >
                  <Upload className="w-4 h-4" /> Import
                </button>
                <input
                  ref={importFileRef}
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      const loadout = await importSingleLoadout(file);
                      addLoadout(loadout);
                    } catch (err) {
                      alert((err as Error).message);
                    }
                    e.target.value = "";
                  }}
                />
                <input
                  ref={fullImportRef}
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      await importAllData(file);
                    } catch (err) {
                      alert((err as Error).message);
                    }
                    e.target.value = "";
                  }}
                />
                <button
                  onClick={() => setShowNew(true)}
                  className="btn-primary flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" /> New Loadout
                </button>
              </div>
            </div>

            <div className="flex gap-6 items-start">
              <div className="flex-1 min-w-0 flex flex-col gap-4">
                {filtered.map((l) => (
                  <LoadoutCard
                    key={l.id}
                    loadout={l}
                    onUpdate={updateLoadout}
                    onDelete={deleteLoadout}
                    onDuplicate={duplicateLoadout}
                    allItems={uexItems}
                    thumbnails={thumbs}
                    buyable={buyable}
                    armorClassMap={armorClassMap}
                    expanded={expandedId === l.id}
                    onToggleExpanded={() => setExpandedId(expandedId === l.id ? null : l.id)}
                  />
                ))}
                {filtered.length === 0 && (
                  <p className="text-center text-text-muted py-8 text-sm">
                    No loadouts match this filter.
                  </p>
                )}
              </div>

              <div className="hidden lg:block w-[280px] shrink-0 sticky top-[65px]">
                <StatsSidebar
                  stats={expandedId ? aggregateLoadoutStats(loadouts.find((l) => l.id === expandedId)?.slots ?? {}) : null}
                  loadoutName={loadouts.find((l) => l.id === expandedId)?.name}
                />
              </div>
            </div>
          </>
        )}
      </main>

      {showNew && (
        <NewLoadoutDialog onClose={() => setShowNew(false)} onCreate={handleCreate} />
      )}

      <Footer />
    </div>
  );
}
