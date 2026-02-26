/**
 * Generates static armor data from CStone API.
 * Run: node generate-armor-data.mjs
 * Output: src/armor-data.json (full stats), src/armor-classes.json (class map)
 */

const clean = (s) => s.replace(/\s*\([^)]*\)\s*$/, "").trim();
const parseCargo = (desc) => {
  const m = (desc ?? "").match(/Carrying Capacity:\s*([\d.]+)/);
  return m ? parseFloat(m[1]) : 0;
};
const parseClass = (s) => {
  const l = (s ?? "").toLowerCase();
  if (l.includes("light")) return "light";
  if (l.includes("medium")) return "medium";
  if (l.includes("heavy")) return "heavy";
  return null;
};

const CATEGORIES = ["Helmets", "Arms", "Torsos", "Legs", "Backpacks", "Undersuits"];

const allItems = {};
const classMap = {};
let total = 0;

for (const cat of CATEGORIES) {
  const r = await fetch(`https://finder.cstone.space/GetArmors/${cat}`);
  const items = await r.json();
  console.log(`  ${cat}: ${items.length} items`);

  for (const item of items) {
    if (!item.Name) continue;
    total++;

    const name = clean(item.Name);
    const key = name.toLowerCase();
    const ac = parseClass(item.Atype);

    if (ac && !classMap[key]) classMap[key] = ac;
    const rawKey = item.Name.toLowerCase();
    if (ac && rawKey !== key && !classMap[rawKey]) classMap[rawKey] = ac;

    if (!allItems[key]) {
      allItems[key] = {
        name,
        category: cat.replace(/s$/, "").toLowerCase(),
        manufacturer: item.Manu ?? null,
        armorClass: ac,
        dmgReduction: item.Dmgred ?? 0,
        tempMin: item.Wearmintemp ?? null,
        tempMax: item.Wearmaxtemp ?? null,
        radResistance: item.Radresistance ?? 0,
        radScrubRate: item.Radscrubrate ?? 0,
        resistance: {
          physical: item.ArmordmgreductionPhysicalResistance ?? 1,
          energy: item.ArmordmgreductionEnergyResistance ?? 1,
          distortion: item.ArmordmgreductionDistortionResistance ?? 1,
          thermal: item.ArmordmgreductionThermalResistance ?? 1,
          biochemical: item.ArmordmgreductionBiochemicalResistance ?? 1,
          stun: item.ArmordmgreductionStunResistance ?? 1,
        },
        volume: item.Volume ?? 0,
        cargo: parseCargo(item.Desc),
        grade: item.Grade ?? null,
      };
    }
  }
}

const { writeFileSync } = await import("fs");

writeFileSync("src/armor-data.json", JSON.stringify(allItems, null, 2));
console.log(`\nGenerated armor-data.json: ${Object.keys(allItems).length} unique items (from ${total} total)`);

writeFileSync("src/armor-classes.json", JSON.stringify(classMap, null, 2));
console.log(`Generated armor-classes.json: ${Object.keys(classMap).length} entries`);
