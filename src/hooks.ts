import { useState, useCallback } from "react";
import type { Loadout } from "./types";

const STORAGE_KEY = "loadout-planner-data";

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveJson<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage quota exceeded — data is still in React state
  }
}

function migrateLoadout(l: any): Loadout {
  const slots = l.slots as Record<string, any>;
  if (slots.utility1 && !slots.consumable1) {
    slots.consumable1 = slots.utility1;
    delete slots.utility1;
  }
  if (slots.utility2 && !slots.consumable2) {
    slots.consumable2 = slots.utility2;
    delete slots.utility2;
  }
  if (slots.utility3 && !slots.throwable1) {
    slots.throwable1 = slots.utility3;
    delete slots.utility3;
  }
  if (slots.utility4 && !slots.consumable3) {
    slots.consumable3 = slots.utility4;
    delete slots.utility4;
  }
  if (!l.slotClasses) {
    const ac = l.armorClass ?? "medium";
    l.slotClasses = { helmet: ac, core: ac, arms: ac, legs: ac, backpack: ac };
  }
  delete l.armorClass;
  return l as Loadout;
}

export function useLoadouts() {
  const [loadouts, setLoadouts] = useState<Loadout[]>(() =>
    loadJson<Loadout[]>(STORAGE_KEY, []).map(migrateLoadout)
  );

  const persist = useCallback((updater: (prev: Loadout[]) => Loadout[]) => {
    setLoadouts((prev) => {
      const next = updater(prev);
      saveJson(STORAGE_KEY, next);
      return next;
    });
  }, []);

  const addLoadout = useCallback(
    (loadout: Loadout) => {
      persist((prev) => [loadout, ...prev]);
    },
    [persist]
  );

  const updateLoadout = useCallback(
    (id: string, updates: Partial<Loadout>) => {
      persist((prev) =>
        prev.map((l) =>
          l.id === id
            ? { ...l, ...updates, updatedAt: new Date().toISOString() }
            : l
        )
      );
    },
    [persist]
  );

  const deleteLoadout = useCallback(
    (id: string) => {
      persist((prev) => prev.filter((l) => l.id !== id));
    },
    [persist]
  );

  const duplicateLoadout = useCallback(
    (id: string) => {
      persist((prev) => {
        const source = prev.find((l) => l.id === id);
        if (!source) return prev;
        const now = new Date().toISOString();
        const copy: Loadout = {
          ...source,
          id: crypto.randomUUID(),
          name: `${source.name} (Copy)`,
          createdAt: now,
          updatedAt: now,
          slots: Object.fromEntries(
            Object.entries(source.slots).map(([k, v]) => [k, { ...v }])
          ),
        };
        return [copy, ...prev];
      });
    },
    [persist]
  );

  const resetAll = useCallback(() => {
    persist(() => []);
  }, [persist]);

  return { loadouts, addLoadout, updateLoadout, deleteLoadout, duplicateLoadout, resetAll };
}

export function exportSingleLoadout(loadout: Loadout) {
  const data = {
    version: 1,
    tool: "loadout-planner",
    type: "single",
    exportedAt: new Date().toISOString(),
    loadout,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const safeName = loadout.name.replace(/[^a-zA-Z0-9-_ ]/g, "").replace(/\s+/g, "-").toLowerCase();
  a.download = `loadout-${safeName}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importSingleLoadout(file: File): Promise<Loadout> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        if (typeof data !== "object" || !data) throw new Error("bad format");

        let loadout: Loadout;
        if (data.type === "single" && data.loadout) {
          loadout = data.loadout;
        } else if (Array.isArray(data.loadouts) && data.loadouts.length > 0) {
          loadout = data.loadouts[0];
        } else {
          throw new Error("No loadout found in file");
        }

        if (!loadout.name || !loadout.slots) throw new Error("Invalid loadout data");

        loadout.id = crypto.randomUUID();
        migrateLoadout(loadout);
        const now = new Date().toISOString();
        loadout.createdAt = now;
        loadout.updatedAt = now;

        resolve(loadout);
      } catch {
        reject(new Error("Invalid file. Expected a Loadout Planner JSON export."));
      }
    };
    reader.readAsText(file);
  });
}

export function exportAllData() {
  const data = {
    version: 1,
    tool: "loadout-planner",
    exportedAt: new Date().toISOString(),
    loadouts: JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"),
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `loadout-planner-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importAllData(file: File): Promise<void> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        if (typeof data !== "object" || !data) throw new Error("bad format");
        if (Array.isArray(data.loadouts)) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(data.loadouts));
        }
        window.location.reload();
        resolve();
      } catch {
        reject(new Error("Invalid backup file. Expected a Loadout Planner JSON export."));
      }
    };
    reader.readAsText(file);
  });
}
