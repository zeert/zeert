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

let readme = readFileSync(README, "utf8");
const block = `${START}${table}${END}`;
readme = readme.replace(
  new RegExp(`${START}[\\s\\S]*?${END}`),
  block
);
writeFileSync(README, readme);
console.log(`README actualizado con ${repos.length} repos.`);
