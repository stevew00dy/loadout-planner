/**
 * Generates a static armor class map from CStone data.
 * Run: node generate-armor-classes.mjs
 * Output: src/armor-classes.json
 */
const clean = s => s.replace(/\s*\([^)]*\)\s*$/, '').trim().toLowerCase();
const parse = s => {
  const l = s.toLowerCase();
  if (l.includes('light')) return 'light';
  if (l.includes('medium')) return 'medium';
  if (l.includes('heavy')) return 'heavy';
  return null;
};

const categories = ['Helmets', 'Arms', 'Torsos', 'Legs', 'Backpacks'];
const map = {};

for (const cat of categories) {
  const r = await fetch(`https://finder.cstone.space/GetArmors/${cat}`);
  const items = await r.json();
  for (const item of items) {
    const ac = parse(item.Atype ?? '');
    if (ac && item.Name) {
      const cleaned = clean(item.Name);
      if (!map[cleaned]) map[cleaned] = ac;
      const raw = item.Name.toLowerCase();
      if (raw !== cleaned && !map[raw]) map[raw] = ac;
    }
  }
}

const { writeFileSync } = await import('fs');
writeFileSync('src/armor-classes.json', JSON.stringify(map, null, 2));
console.log(`Generated armor-classes.json with ${Object.keys(map).length} entries`);
