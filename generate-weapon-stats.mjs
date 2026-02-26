import { writeFileSync } from "fs";

const BASE = "https://docs.google.com/spreadsheets/d/1fl17G0rP2ZIEED_-A43PVYZONc7EdPI8XLSAdoUnTcQ/gviz/tq?tqx=out:csv";

function parseCsv(csv) {
  const lines = csv.split("\n");
  return lines.map(line => {
    const cols = [];
    let cur = "";
    let inQ = false;
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ; continue; }
      if (ch === "," && !inQ) { cols.push(cur.trim()); cur = ""; continue; }
      cur += ch;
    }
    cols.push(cur.trim());
    return cols;
  });
}

// Fetch Item tab
const itemRes = await fetch(`${BASE}&sheet=Item`);
const allRows = parseCsv(await itemRes.text());

// Find data start (first row with a weapon name + numeric mass)
let dataStart = -1;
for (let i = 0; i < allRows.length; i++) {
  const name = allRows[i][0];
  const mass = parseFloat(allRows[i][5]);
  if (name && mass > 0 && !name.includes("Scale") && !name.includes("(s)") && !name.includes("(m/s)")) {
    dataStart = i;
    break;
  }
}

// Fetch TTK tab
const ttkRes = await fetch(`${BASE}&sheet=TTK`);
const ttkRows = parseCsv(await ttkRes.text());

// Build TTK map: weapon name -> TTK data
const ttkMap = {};
for (const r of ttkRows) {
  const name = r[0];
  if (!name) continue;
  const fireMode = r[1] || "";
  const vals = r.slice(2, 12).map(v => parseFloat(v) || null);
  if (vals.some(v => v !== null)) {
    const key = name.toLowerCase();
    if (!ttkMap[key]) ttkMap[key] = [];
    ttkMap[key].push({ fireMode, ttk: vals });
  }
}

// Item categories to ignore
const IGNORE = new Set(["gadget", "mine", "debug"]);

// Parse weapons
const weapons = {};
for (let i = dataStart; i < allRows.length; i++) {
  const r = allRows[i];
  const name = r[0];
  const mass = parseFloat(r[5]);
  if (!name || isNaN(mass) || mass <= 0) continue;

  const fireMode = (r[7] || "").trim();
  
  // Skip items without fire mode (consumables, knives, etc. already in weapon-mass.json)
  // But keep tools/medical for reference
  const ammoCount = parseInt(r[1]) || 0;
  const ammoSpeed = parseInt(r[8]) || 0;
  const range = parseFloat(r[10]?.replace(/,/g, "")) || 0;
  const pellets = parseInt(r[12]) || 1;
  const dmgPerPellet = parseFloat(r[14]) || 0;
  const dmgPerShot = parseFloat(r[15]) || 0;
  const rpm = parseFloat(r[17]) || 0;
  const dps = parseFloat(r[18]) || 0;
  const dpsSustained = parseFloat(r[19]) || 0;
  const dpsBurst = parseFloat(r[20]) || 0;

  // Determine category
  let category = "other";
  const nl = name.toLowerCase();
  if (nl.includes("rifle") && !nl.includes("sniper")) category = "assault_rifle";
  else if (nl.includes("sniper") || nl.includes("arrowhead") || nl.includes("atzkav") || nl.includes("p6-lr") || nl.includes("zenith")) category = "sniper_rifle";
  else if (nl.includes("lmg")) category = "lmg";
  else if (nl.includes("pistol")) category = "pistol";
  else if (nl.includes("shotgun")) category = "shotgun";
  else if (nl.includes("smg")) category = "smg";
  else if (nl.includes("grenade launcher") || nl.includes("railgun") || nl.includes("rocket") || nl.includes("missile")) category = "heavy";
  else if (nl.includes("gatling") || nl.includes("bulldog") || nl.includes("repeater")) category = "mounted";
  else if (nl.includes("knife") || nl.includes("blade") || nl.includes("shiv")) category = "melee";
  else if (nl.includes("pen") || nl.includes("injector") || nl.includes("authorizer") || nl.includes("pick") || nl.includes("funt") || nl.includes("slam") || nl.includes("tigersclaw") || nl.includes("walesko") || nl.includes("ripper") && !nl.includes("smg") || nl.includes("placeholder") || nl.includes("decryption")) category = "consumable";
  else if (nl.includes("multi-tool") || nl.includes("tractor") || nl.includes("cambio") || nl.includes("extinguisher") || nl.includes("paramed") || nl.includes("rangefinder")) category = "tool";
  else if (nl.includes("grenade") || nl.includes("fuse") || nl.includes("flare") || nl.includes("light stick")) category = "throwable";
  else if (nl.includes("optimax") || nl.includes("waveshift") || nl.includes("okunis") || nl.includes("sabir") || nl.includes("boremax") || nl.includes("stalwart")) category = "gadget";

  // Skip gadgets, mines, debug
  if (IGNORE.has(category)) continue;
  // Skip consumables, throwables (already tracked differently)
  if (category === "consumable" || category === "throwable") continue;

  const key = name.toLowerCase();
  
  // Get TTK data if available
  const ttkData = ttkMap[key] || [];
  const ttk = ttkData.length > 0 ? ttkData[0].ttk : null;

  weapons[key] = {
    name,
    category,
    mass,
    massWithMags: parseFloat(r[6]) || mass,
    ammoCount,
    fireMode: fireMode || null,
    ammoSpeed,
    range,
    pellets,
    dmgPerPellet,
    dmgPerShot: dmgPerShot || dmgPerPellet * pellets,
    rpm,
    dps,
    dpsSustained: dpsSustained || null,
    dpsBurst: dpsBurst || null,
    ttk,
  };
}

writeFileSync("src/weapon-stats.json", JSON.stringify(weapons, null, 2));
console.log(`Generated weapon-stats.json: ${Object.keys(weapons).length} items`);

// Print summary by category
const cats = {};
for (const w of Object.values(weapons)) {
  cats[w.category] = (cats[w.category] || 0) + 1;
}
console.log("\nBy category:");
for (const [cat, count] of Object.entries(cats).sort()) {
  console.log(`  ${cat}: ${count}`);
}

// Print top weapons by DPS
console.log("\n=== TOP 10 by DPS ===");
const byDps = Object.values(weapons).filter(w => w.dps > 0).sort((a, b) => b.dps - a.dps);
for (const w of byDps.slice(0, 10)) {
  console.log(`  ${w.name.padEnd(30)} ${w.dps} DPS | ${w.dmgPerShot} dmg/shot | ${w.rpm} RPM | ${w.range}m | ${w.mass}kg`);
}

// Print top weapons by fastest TTK
console.log("\n=== FASTEST TTK (first kill) ===");
const byTtk = Object.values(weapons).filter(w => w.ttk && w.ttk[0] !== null).sort((a, b) => a.ttk[0] - b.ttk[0]);
for (const w of byTtk.slice(0, 15)) {
  console.log(`  ${w.name.padEnd(30)} ${w.ttk[0]}s TTK | ${w.dps} DPS | ${w.mass}kg`);
}
