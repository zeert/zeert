// Actualiza la sección "Últimos proyectos" del README con los repos
// públicos actualizados más recientemente. Sin dependencias externas.
import { readFileSync, writeFileSync } from "node:fs";

const USER = "zeert";
const START = "<!--START_SECTION:repos-->";
const END = "<!--END_SECTION:repos-->";
const README = "README.md";
const MAX = 6;

const token = process.env.GITHUB_TOKEN;
const headers = {
  "Accept": "application/vnd.github+json",
  "User-Agent": USER,
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
};

const res = await fetch(
  `https://api.github.com/users/${USER}/repos?sort=pushed&per_page=100&type=owner`,
  { headers }
);
if (!res.ok) throw new Error(`GitHub API ${res.status}`);

const repos = (await res.json())
  .filter((r) => !r.fork && !r.archived && r.name !== USER)
  .slice(0, MAX);

const esc = (s) => (s || "").replace(/\|/g, "\\|");
const rows = repos
  .map((r) => {
    const desc = esc(r.description) || "—";
    const lang = r.language ? `\`${r.language}\`` : "";
    return `| [**${r.name}**](${r.html_url}) | ${desc} | ${lang} |`;
  })
  .join("\n");

const table = `\n| Repo | Descripción | Lenguaje |\n| :--- | :--- | :--- |\n${rows}\n`;

// --- Lenguajes: repos recientes (últimos 18 meses), personales + org,
//     normalizados por repo para que ningún monolito viejo domine. ---
const ORG = "ZetalabsCL";
const MONTHS = 18;
const cutoff = Date.now() - MONTHS * 30 * 24 * 3600 * 1000;

async function fetchAll(url) {
  const r = await fetch(url, { headers });
  return r.ok ? await r.json() : [];
}

const personal = await fetchAll(
  `https://api.github.com/users/${USER}/repos?per_page=100&type=owner&sort=pushed`
);
const orgRepos = await fetchAll(
  `https://api.github.com/orgs/${ORG}/repos?per_page=100&type=all&sort=pushed`
);

const seen = new Set();
let scan = [...personal, ...orgRepos].filter((r) => {
  if (!r || r.fork || r.archived || seen.has(r.full_name)) return false;
  seen.add(r.full_name);
  return new Date(r.pushed_at).getTime() >= cutoff;
});
// Si quedan muy pocos repos recientes, relaja el filtro de fecha.
if (scan.length < 4) {
  seen.clear();
  scan = [...personal, ...orgRepos].filter((r) => {
    if (!r || r.fork || r.archived || seen.has(r.full_name)) return false;
    seen.add(r.full_name);
    return true;
  });
}

// Peso por recencia: media vida de 12 meses (lo reciente pesa más).
const totals = {};
for (const r of scan) {
  const lr = await fetch(r.languages_url, { headers });
  if (!lr.ok) continue;
  const langs = await lr.json();
  const repoBytes = Object.values(langs).reduce((a, b) => a + b, 0);
  if (!repoBytes) continue;
  const monthsAgo = (Date.now() - new Date(r.pushed_at).getTime()) / (30 * 24 * 3600 * 1000);
  const weight = Math.pow(0.5, monthsAgo / 12);
  for (const [name, bytes] of Object.entries(langs)) {
    totals[name] = (totals[name] || 0) + (bytes / repoBytes) * weight;
  }
}

console.log(`Repos escaneados para lenguajes: ${scan.length}`);
const grand = Object.values(totals).reduce((a, b) => a + b, 0) || 1;
const top = Object.entries(totals)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 8);

const BARW = 22;
const pad = Math.max(...top.map(([n]) => n.length));
const langBlock = top
  .map(([name, bytes]) => {
    const pct = (bytes / grand) * 100;
    const filled = Math.round((pct / 100) * BARW);
    const bar = "█".repeat(filled) + "░".repeat(BARW - filled);
    return `${name.padEnd(pad)}  ${bar}  ${pct.toFixed(1).padStart(5)}%`;
  })
  .join("\n");
const LANG_START = "<!--START_SECTION:langs-->";
const LANG_END = "<!--END_SECTION:langs-->";
const langSection = `${LANG_START}\n\`\`\`text\n${langBlock}\n\`\`\`\n${LANG_END}`;

let readme = readFileSync(README, "utf8");
readme = readme.replace(new RegExp(`${START}[\\s\\S]*?${END}`), `${START}${table}${END}`);
readme = readme.replace(new RegExp(`${LANG_START}[\\s\\S]*?${LANG_END}`), langSection);
writeFileSync(README, readme);
console.log(`README actualizado: ${repos.length} repos, ${top.length} lenguajes.`);
