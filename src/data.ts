import type { SlotDefinition, MissionType, Loadout, SlotValue } from "./types";

export const SLOTS: SlotDefinition[] = [
  { id: "undersuit", label: "Undersuit", group: "armor", placeholder: "e.g. Odyssey II" },
  { id: "helmet", label: "Helmet", group: "armor", placeholder: "e.g. Morozov" },
  { id: "core", label: "Core / Chest", group: "armor", placeholder: "e.g. Paladin Heavy" },
  { id: "arms", label: "Arms", group: "armor", placeholder: "e.g. Paladin Arms" },
  { id: "legs", label: "Legs", group: "armor", placeholder: "e.g. Paladin Legs" },
  { id: "backpack", label: "Backpack", group: "armor", placeholder: "e.g. Pembroke Backpack" },
  { id: "primary1", label: "Primary 1", group: "weapons", placeholder: "e.g. Gallant Rifle" },
  { id: "primary2", label: "Primary 2", group: "weapons", placeholder: "e.g. Devastator Shotgun" },
  { id: "sidearm", label: "Sidearm", group: "weapons", placeholder: "e.g. Arclight Pistol" },
  { id: "multitool1", label: "Multitool 1 (Left)", group: "utilities", placeholder: "e.g. Multi-Tool (OreBit)" },
  { id: "multitool2", label: "Multitool 2 (Right)", group: "utilities", placeholder: "e.g. Multi-Tool (TruHold)" },
  { id: "utility1", label: "Utility 1", group: "utilities", placeholder: "e.g. MedPen" },
  { id: "utility2", label: "Utility 2", group: "utilities", placeholder: "e.g. Frag Grenade" },
  { id: "utility3", label: "Utility 3", group: "utilities", placeholder: "e.g. OxyPen" },
  { id: "utility4", label: "Utility 4", group: "utilities", placeholder: "e.g. Food / Water" },
];

export const MISSION_TYPES: MissionType[] = [
  "Combat",
  "Stealth",
  "Mining",
  "Medical",
  "Salvage",
  "EVA",
  "Exploration",
  "Uniform 1",
  "Uniform 2",
  "Custom",
];

export const MISSION_COLORS: Record<MissionType, string> = {
  Combat: "bg-accent-red/20 text-accent-red",
  Stealth: "bg-accent-purple/20 text-accent-purple",
  Mining: "bg-accent-amber/20 text-accent-amber",
  Medical: "bg-accent-green/20 text-accent-green",
  Salvage: "bg-accent-yellow/20 text-accent-yellow",
  EVA: "bg-accent-blue/20 text-accent-blue",
  Exploration: "bg-accent-blue/20 text-accent-blue",
  "Uniform 1": "bg-sky-400/20 text-sky-400",
  "Uniform 2": "bg-teal-400/20 text-teal-400",
  Custom: "bg-dark-600 text-text-dim",
};

export const MISSION_PRESETS: Record<string, Partial<Record<string, SlotValue>>> = {
  Combat: {
    core: { item: "", notes: "Heavy armor recommended" },
    primary1: { item: "", notes: "Assault rifle / LMG" },
    primary2: { item: "", notes: "Shotgun for CQB" },
    sidearm: { item: "", notes: "Backup pistol" },
    utility1: { item: "MedPen", notes: "" },
    utility2: { item: "MedPen", notes: "" },
    utility3: { item: "Frag Grenade", notes: "" },
  },
  Stealth: {
    core: { item: "", notes: "Light armor — low signature" },
    primary1: { item: "", notes: "Suppressed weapon" },
    sidearm: { item: "", notes: "Suppressed pistol" },
    utility1: { item: "MedPen", notes: "" },
  },
  Mining: {
    core: { item: "", notes: "Light/medium with good temp range" },
    backpack: { item: "", notes: "Large backpack for ore" },
    multitool1: { item: "Multi-Tool (OreBit)", notes: "Mining attachment" },
    multitool2: { item: "Multi-Tool (TruHold)", notes: "Tractor beam" },
    utility1: { item: "MedPen", notes: "" },
  },
  Medical: {
    core: { item: "", notes: "Support-category armor" },
    multitool1: { item: "CureLife Medical Tool", notes: "" },
    utility1: { item: "MedPen (Hemozal)", notes: "" },
    utility2: { item: "AdrenaPen", notes: "" },
    utility3: { item: "CorticoPen", notes: "" },
  },
  Salvage: {
    core: { item: "", notes: "Utility armor" },
    backpack: { item: "", notes: "Large backpack" },
    multitool1: { item: "Multi-Tool (Salvage)", notes: "" },
    utility1: { item: "MedPen", notes: "" },
  },
  EVA: {
    undersuit: { item: "", notes: "Good temp range essential" },
    helmet: { item: "", notes: "Required — no atmo" },
    core: { item: "", notes: "Light for mobility" },
    utility1: { item: "OxyPen", notes: "" },
    utility2: { item: "MedPen", notes: "" },
  },
  Exploration: {
    core: { item: "", notes: "Medium armor — balanced" },
    primary1: { item: "", notes: "Versatile weapon" },
    sidearm: { item: "", notes: "Backup" },
    multitool1: { item: "Multi-Tool", notes: "" },
    utility1: { item: "MedPen", notes: "" },
    utility2: { item: "OxyPen", notes: "" },
    utility3: { item: "Food / Water", notes: "" },
  },
  "Uniform 1": {
    undersuit: { item: "", notes: "Org-required undersuit" },
    helmet: { item: "", notes: "Org-required helmet" },
    core: { item: "", notes: "Org-required chest" },
    arms: { item: "", notes: "Org-required arms" },
    legs: { item: "", notes: "Org-required legs" },
    backpack: { item: "", notes: "Org-required backpack" },
  },
  "Uniform 2": {
    undersuit: { item: "", notes: "Org-required undersuit" },
    helmet: { item: "", notes: "Org-required helmet" },
    core: { item: "", notes: "Org-required chest" },
    arms: { item: "", notes: "Org-required arms" },
    legs: { item: "", notes: "Org-required legs" },
    backpack: { item: "", notes: "Org-required backpack" },
  },
};

export function createEmptyLoadout(name: string, missionType: MissionType): Loadout {
  const now = new Date().toISOString();
  const slots: Record<string, SlotValue> = {};
  for (const slot of SLOTS) {
    const preset = MISSION_PRESETS[missionType]?.[slot.id];
    slots[slot.id] = preset ? { ...preset } : { item: "", notes: "" };
  }
  return {
    id: crypto.randomUUID(),
    name,
    missionType,
    slots,
    notes: "",
    createdAt: now,
    updatedAt: now,
  };
}
