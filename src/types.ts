export type MissionType =
  | "Combat"
  | "Stealth"
  | "Mining"
  | "Medical"
  | "Salvage"
  | "EVA"
  | "Exploration"
  | "Uniform 1"
  | "Uniform 2"
  | "Custom";

export interface SlotValue {
  item: string;
  notes?: string;
}

export type ArmorClass = "light" | "medium" | "heavy";

export interface Loadout {
  id: string;
  name: string;
  missionType: MissionType;
  slotClasses: Partial<Record<string, ArmorClass>>;
  slots: Record<string, SlotValue>;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export type SlotGroup = "armor" | "weapons" | "multitools" | "ammo" | "throwables" | "consumables";

export interface SlotDefinition {
  id: string;
  label: string;
  group: SlotGroup;
  placeholder: string;
}
