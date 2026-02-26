import { useState, useRef, useCallback, useEffect } from "react";
import {
  Crosshair,
  Plus,
  Settings,
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
} from "lucide-react";
import type { MissionType, Loadout, SlotValue } from "./types";
import { SLOTS, MISSION_TYPES, MISSION_COLORS, createEmptyLoadout } from "./data";
import { useLoadouts, exportAllData, importAllData, exportSingleLoadout, importSingleLoadout } from "./hooks";
import type { UexItem } from "./uex-api";
import { getItems, clearUexCache } from "./uex-api";
import ItemCombobox from "./ItemCombobox";

/* ─── Header ─── */
function Header({
  count,
  onToggleSettings,
  settingsOpen,
  settingsRef,
  uexLoading,
  uexItemCount,
}: {
  count: number;
  onToggleSettings: () => void;
  settingsOpen: boolean;
  settingsRef: React.RefObject<HTMLButtonElement | null>;
  uexLoading: boolean;
  uexItemCount: number;
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
          <button
            ref={settingsRef}
            onClick={() => { onToggleSettings(); setNavOpen(false); }}
            className="p-2 rounded-lg hover:bg-dark-800 transition-colors"
            aria-label="Settings"
          >
            <Settings
              className={`w-5 h-5 transition-transform duration-200 ${
                settingsOpen ? "rotate-90 text-accent-amber" : "text-text-dim"
              }`}
            />
          </button>
          <div className="relative" ref={navRef}>
            <button
              onClick={() => { setNavOpen(!navOpen); if (settingsOpen) onToggleSettings(); }}
              className={`p-2 rounded-lg transition-all duration-200 ${
                navOpen ? "text-text bg-dark-700" : "text-text-muted hover:text-text hover:bg-dark-800"
              }`}
              title="Menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            {navOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 p-2 shadow-xl z-50 rounded-xl border border-dark-700 bg-dark-900">
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

/* ─── Settings Dropdown ─── */
function SettingsDropdown({
  onClose,
  onReset,
  onRefreshData,
  isRefreshing,
  toggleRef,
}: {
  onClose: () => void;
  onReset: () => void;
  onRefreshData: () => void;
  isRefreshing: boolean;
  toggleRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (toggleRef.current?.contains(e.target as Node)) return;
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose, toggleRef]);

  const handleImport = useCallback(() => {
    fileRef.current?.click();
  }, []);

  const handleFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await importAllData(file);
    } catch (err) {
      alert((err as Error).message);
    }
  }, []);

  const handleReset = useCallback(() => {
    if (confirm("Delete all loadouts? This cannot be undone.")) {
      onReset();
    }
  }, [onReset]);

  return (
    <div
      ref={ref}
      className="absolute right-4 top-14 z-40 card flex flex-col gap-2 min-w-[180px] animate-in fade-in"
    >
      <button
        onClick={onRefreshData}
        disabled={isRefreshing}
        className="btn-ghost flex items-center gap-2 w-full justify-start disabled:opacity-50"
      >
        <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
        {isRefreshing ? "Refreshing…" : "Refresh Item Data"}
      </button>
      <hr className="border-dark-700" />
      <button onClick={exportAllData} className="btn-ghost flex items-center gap-2 w-full justify-start">
        <Download className="w-4 h-4" /> Export JSON
      </button>
      <button onClick={handleImport} className="btn-ghost flex items-center gap-2 w-full justify-start">
        <Upload className="w-4 h-4" /> Import JSON
      </button>
      <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleFile} />
      <hr className="border-dark-700" />
      <button
        onClick={handleReset}
        className="btn-ghost flex items-center gap-2 w-full justify-start text-accent-red hover:text-accent-red hover:border-accent-red/50"
      >
        <RotateCcw className="w-4 h-4" /> Reset All
      </button>
    </div>
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
const UTILITY_SLOTS = SLOTS.filter((s) => s.group === "utilities");

/* ─── Slot Group ─── */
const GROUP_ICONS = {
  armor: Shield,
  weapons: Sword,
  utilities: Wrench,
} as const;

const GROUP_LABELS = {
  armor: "Armor",
  weapons: "Weapons",
  utilities: "Utilities & Consumables",
} as const;

function SlotGroup({
  group,
  slots,
  values,
  onChange,
  allItems,
}: {
  group: "armor" | "weapons" | "utilities";
  slots: typeof SLOTS;
  values: Record<string, SlotValue>;
  onChange: (slotId: string, value: SlotValue) => void;
  allItems: UexItem[];
}) {
  const Icon = GROUP_ICONS[group];
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-text-muted" />
        <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
          {GROUP_LABELS[group]}
        </h4>
      </div>
      <div className="grid gap-2">
        {slots.map((slot) => {
          const val = values[slot.id] || { item: "", notes: "" };
          return (
            <div key={slot.id} className="grid grid-cols-1 sm:grid-cols-[120px_1fr] gap-1 sm:gap-2 sm:items-start">
              <span className="text-sm text-text-dim truncate mt-2">{slot.label}</span>
              <ItemCombobox
                value={val.item}
                onChange={(v) => onChange(slot.id, { ...val, item: v })}
                placeholder={slot.placeholder}
                slotId={slot.id}
                allItems={allItems}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Loadout Card ─── */
function LoadoutCard({
  loadout,
  onUpdate,
  onDelete,
  onDuplicate,
  allItems,
}: {
  loadout: Loadout;
  onUpdate: (id: string, updates: Partial<Loadout>) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  allItems: UexItem[];
}) {
  const [expanded, setExpanded] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(loadout.name);
  const nameRef = useRef<HTMLInputElement>(null);

  const filledSlots = Object.values(loadout.slots).filter((v) => v.item.trim()).length;
  const totalSlots = SLOTS.length;

  useEffect(() => {
    if (editingName) nameRef.current?.focus();
  }, [editingName]);

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
    onUpdate(loadout.id, {
      slots: { ...loadout.slots, [slotId]: value },
    });
  };

  const handleNotesChange = (notes: string) => {
    onUpdate(loadout.id, { notes });
  };

  const handleDelete = () => {
    if (confirm(`Delete "${loadout.name}"?`)) onDelete(loadout.id);
  };

  return (
    <div className="card">
      {/* Card Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {editingName ? (
              <input
                ref={nameRef}
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                onBlur={handleNameBlur}
                onKeyDown={handleNameKey}
                className="slot-input text-base font-semibold !p-1 !px-2 max-w-[260px]"
              />
            ) : (
              <button
                type="button"
                className="text-base font-semibold hover:text-accent-amber transition-colors truncate text-left bg-transparent border-none p-0 text-text"
                onClick={() => setEditingName(true)}
                title="Click to rename"
              >
                {loadout.name}
              </button>
            )}
            <span className={`mission-badge ${MISSION_COLORS[loadout.missionType]}`}>
              {loadout.missionType}
            </span>
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
            onClick={() => setExpanded(!expanded)}
            className="p-1.5 rounded hover:bg-dark-800 text-text-muted hover:text-text transition-colors"
            aria-label={expanded ? "Collapse loadout" : "Expand loadout"}
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Collapsed Preview */}
      {!expanded && filledSlots > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {SLOTS.filter((s) => loadout.slots[s.id]?.item.trim()).map((s) => (
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
          <SlotGroup group="armor" slots={ARMOR_SLOTS} values={loadout.slots} onChange={handleSlotChange} allItems={allItems} />
          <SlotGroup group="weapons" slots={WEAPON_SLOTS} values={loadout.slots} onChange={handleSlotChange} allItems={allItems} />
          <SlotGroup group="utilities" slots={UTILITY_SLOTS} values={loadout.slots} onChange={handleSlotChange} allItems={allItems} />

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
        <p className="text-[10px] text-text-muted/50">Unofficial fan-made tool. Not affiliated with Cloud Imperium Games.</p>
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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [filter, setFilter] = useState<MissionType | "All">("All");
  const settingsRef = useRef<HTMLButtonElement>(null);
  const importFileRef = useRef<HTMLInputElement>(null);
  const [uexItems, setUexItems] = useState<UexItem[]>([]);
  const [uexLoading, setUexLoading] = useState(false);

  useEffect(() => {
    setUexLoading(true);
    getItems()
      .then(setUexItems)
      .catch(() => {})
      .finally(() => setUexLoading(false));
  }, []);

  const handleRefreshData = useCallback(() => {
    clearUexCache();
    setUexLoading(true);
    getItems(true)
      .then(setUexItems)
      .catch(() => {})
      .finally(() => {
        setUexLoading(false);
        setSettingsOpen(false);
      });
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
        onToggleSettings={() => setSettingsOpen(!settingsOpen)}
        settingsOpen={settingsOpen}
        settingsRef={settingsRef}
        uexLoading={uexLoading}
        uexItemCount={uexItems.length}
      />

      {settingsOpen && (
        <SettingsDropdown
          onClose={() => setSettingsOpen(false)}
          onReset={resetAll}
          onRefreshData={handleRefreshData}
          isRefreshing={uexLoading}
          toggleRef={settingsRef}
        />
      )}

      <main className="flex-1 max-w-[900px] w-full mx-auto px-4 py-6">
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
                <button
                  onClick={() => setShowNew(true)}
                  className="btn-primary flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" /> New Loadout
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              {filtered.map((l) => (
                <LoadoutCard
                  key={l.id}
                  loadout={l}
                  onUpdate={updateLoadout}
                  onDelete={deleteLoadout}
                  onDuplicate={duplicateLoadout}
                  allItems={uexItems}
                />
              ))}
              {filtered.length === 0 && (
                <p className="text-center text-text-muted py-8 text-sm">
                  No loadouts match this filter.
                </p>
              )}
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
