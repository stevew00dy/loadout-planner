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

export interface Loadout {
  id: string;
  name: string;
  missionType: MissionType;
  slots: Record<string, SlotValue>;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface SlotDefinition {
  id: string;
  label: string;
  group: "armor" | "weapons" | "utilities";
  placeholder: string;
}
