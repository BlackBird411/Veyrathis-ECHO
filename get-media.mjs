import fs from "node:fs";
const SB = "https://fdiounclxvaescxfkcnt.supabase.co";
const KEY = "sb_publishable_pTmK9ZuSQHh915Ke4IAhIA_ib2ip80H";
const res = await fetch(SB + "/rest/v1/team_hierarchy?select=data", { headers: { apikey: KEY } });
const text = JSON.stringify(await res.json());
const names = [...new Set(text.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:jpe?g|png|webp|gif|mp4|webm|mov)/gi) || [])];
fs.mkdirSync("m", { recursive: true });
for (const n of names) {
  if (fs.existsSync("m/" + n)) continue;
  const r = await fetch(SB + "/storage/v1/object/public/site-media/" + n);
  if (!r.ok) { console.log("FAILED", n, r.status); continue; }
  fs.writeFileSync("m/" + n, Buffer.from(await r.arrayBuffer()));
  console.log("saved", n);
}
console.log(names.length + " files referenced");
