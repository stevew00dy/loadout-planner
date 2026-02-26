import type { SlotDefinition, MissionType, Loadout, SlotValue, ArmorClass } from "./types";

export const ARMOR_CLASS_AMMO_SLOTS: Record<ArmorClass, number> = {
  light: 4,
  medium: 6,
  heavy: 8,
};

export const ARMOR_CLASS_THROWABLE_SLOTS: Record<ArmorClass, number> = {
  light: 2,
  medium: 3,
  heavy: 4,
};

export const ARMOR_CLASS_CONSUMABLE_SLOTS: Record<ArmorClass, number> = {
  light: 4,
  medium: 4,
  heavy: 4,
};

export const ARMOR_CLASS_PRESETS: Partial<Record<MissionType, ArmorClass>> = {
  Combat: "heavy",
  Stealth: "light",
  Mining: "medium",
  Medical: "medium",
  Salvage: "medium",
  EVA: "light",
  Exploration: "medium",
};

export function getEffectiveArmorClass(slotClasses: Partial<Record<string, ArmorClass>>): ArmorClass {
  return slotClasses.core ?? "medium";
}

export const MULTITOOL_OPTIONS = [
  { value: "", label: "None" },
  { value: "Mining", label: "Mining" },
  { value: "Salvage", label: "Salvage" },
  { value: "Cutter", label: "Cutter" },
  { value: "Tractor Beam", label: "Tractor Beam" },
  { value: "Medical", label: "Medical" },
] as const;

export const GRENADE_OPTIONS = [
  { value: "", label: "None" },
  { value: "Frag Grenade", label: "Frag Grenade" },
] as const;

export const SLOTS: SlotDefinition[] = [
  // Armor
  { id: "undersuit", label: "Undersuit", group: "armor", placeholder: "e.g. Odyssey II" },
  { id: "helmet", label: "Helmet", group: "armor", placeholder: "e.g. Morozov" },
  { id: "core", label: "Core / Chest", group: "armor", placeholder: "e.g. Paladin Heavy" },
  { id: "arms", label: "Arms", group: "armor", placeholder: "e.g. Paladin Arms" },
  { id: "legs", label: "Legs", group: "armor", placeholder: "e.g. Paladin Legs" },
  { id: "backpack", label: "Backpack", group: "armor", placeholder: "e.g. Pembroke Backpack" },
  // Weapons
  { id: "primary1", label: "Primary 1", group: "weapons", placeholder: "e.g. Gallant Rifle" },
  { id: "primary2", label: "Primary 2", group: "weapons", placeholder: "e.g. Devastator Shotgun" },
  { id: "sidearm", label: "Sidearm", group: "weapons", placeholder: "e.g. Arclight Pistol" },
  // Multitools
  { id: "multitool1", label: "Multitool L", group: "multitools", placeholder: "Select attachment…" },
  { id: "multitool2", label: "Multitool R", group: "multitools", placeholder: "Select attachment…" },
  // Ammo (max 8 for heavy)
  { id: "ammo1", label: "Mag 1", group: "ammo", placeholder: "e.g. 5.56mm magazine" },
  { id: "ammo2", label: "Mag 2", group: "ammo", placeholder: "e.g. 5.56mm magazine" },
  { id: "ammo3", label: "Mag 3", group: "ammo", placeholder: "e.g. Energy cell" },
  { id: "ammo4", label: "Mag 4", group: "ammo", placeholder: "e.g. Energy cell" },
  { id: "ammo5", label: "Mag 5", group: "ammo", placeholder: "e.g. Shotgun shells" },
  { id: "ammo6", label: "Mag 6", group: "ammo", placeholder: "e.g. Shotgun shells" },
  { id: "ammo7", label: "Mag 7", group: "ammo", placeholder: "Extra mag" },
  { id: "ammo8", label: "Mag 8", group: "ammo", placeholder: "Extra mag" },
  // Throwables (max 4 for heavy)
  { id: "throwable1", label: "Throwable 1", group: "throwables", placeholder: "e.g. Frag Grenade" },
  { id: "throwable2", label: "Throwable 2", group: "throwables", placeholder: "e.g. Flashbang" },
  { id: "throwable3", label: "Throwable 3", group: "throwables", placeholder: "e.g. Smoke Grenade" },
  { id: "throwable4", label: "Throwable 4", group: "throwables", placeholder: "e.g. Frag Grenade" },
  // Consumables (always 4 with legs)
  { id: "consumable1", label: "Consumable 1", group: "consumables", placeholder: "e.g. MedPen" },
  { id: "consumable2", label: "Consumable 2", group: "consumables", placeholder: "e.g. OxyPen" },
  { id: "consumable3", label: "Consumable 3", group: "consumables", placeholder: "e.g. AdrenaPen" },
  { id: "consumable4", label: "Consumable 4", group: "consumables", placeholder: "e.g. Food / Water" },
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
    throwable1: { item: "Frag Grenade", notes: "" },
    consumable1: { item: "MedPen", notes: "" },
    consumable2: { item: "MedPen", notes: "" },
  },
  Stealth: {
    core: { item: "", notes: "Light armor — low signature" },
    primary1: { item: "", notes: "Suppressed weapon" },
    sidearm: { item: "", notes: "Suppressed pistol" },
    consumable1: { item: "MedPen", notes: "" },
  },
  Mining: {
    core: { item: "", notes: "Light/medium with good temp range" },
    backpack: { item: "", notes: "Large backpack for ore" },
    multitool1: { item: "Mining", notes: "" },
    multitool2: { item: "Tractor Beam", notes: "" },
    consumable1: { item: "MedPen", notes: "" },
  },
  Medical: {
    core: { item: "", notes: "Support-category armor" },
    multitool1: { item: "Medical", notes: "" },
    consumable1: { item: "MedPen (Hemozal)", notes: "" },
    consumable2: { item: "AdrenaPen", notes: "" },
    consumable3: { item: "CorticoPen", notes: "" },
  },
  Salvage: {
    core: { item: "", notes: "Utility armor" },
    backpack: { item: "", notes: "Large backpack" },
    multitool1: { item: "Salvage", notes: "" },
    consumable1: { item: "MedPen", notes: "" },
  },
  EVA: {
    undersuit: { item: "", notes: "Good temp range essential" },
    helmet: { item: "", notes: "Required — no atmo" },
    core: { item: "", notes: "Light for mobility" },
    consumable1: { item: "OxyPen", notes: "" },
    consumable2: { item: "MedPen", notes: "" },
  },
  Exploration: {
    core: { item: "", notes: "Medium armor — balanced" },
    primary1: { item: "", notes: "Versatile weapon" },
    sidearm: { item: "", notes: "Backup" },
    multitool1: { item: "Cutter", notes: "" },
    consumable1: { item: "MedPen", notes: "" },
    consumable2: { item: "OxyPen", notes: "" },
    consumable3: { item: "Food / Water", notes: "" },
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
  const defaultClass = ARMOR_CLASS_PRESETS[missionType] ?? "medium";
  const slotClasses: Partial<Record<string, ArmorClass>> = {
    helmet: defaultClass,
    core: defaultClass,
    arms: defaultClass,
    legs: defaultClass,
    backpack: defaultClass,
  };
  return {
    id: crypto.randomUUID(),
    name,
    missionType,
    slotClasses,
    slots,
    notes: "",
    createdAt: now,
    updatedAt: now,
  };
}
