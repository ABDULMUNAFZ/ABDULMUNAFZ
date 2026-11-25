// Regenerates README.md from data/profile.json. Each card's <img title> carries the details its
// hover interaction reveals, because GitHub renders README SVGs as static images.
// Usage: node scripts/readme.mjs
import { readFile, writeFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const profile = JSON.parse(await readFile(new URL("data/profile.json", root), "utf8"));
const RAW = "https://raw.githubusercontent.com/ABDULMUNAFZ/ABDULMUNAFZ/output";

const attr = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function card({ name, alt, tooltip, detail }) {
  // GitHub blocks scripts in profile READMEs. Native <details> keeps every card
  // interactive in the profile itself instead of sending visitors to another page.
  const title = attr([...tooltip.filter(Boolean), "Click to expand this section here."].join("\n"));
  return `<details>
<summary>
<img width="100%" alt="${attr(alt)}" title="${title}" src="${RAW}/${name}-dark.svg" />
</summary>

${detail}
</details>

<br/>
`;
}

const { about, hackathons, projects, stack, certifications } = profile;
const linked = projects.filter((p) => p.url);

const cards = [
  card({
    name: "calendar-3d",
    alt: "3D contribution calendar for the last 12 months",
    tooltip: ["CONTRIBUTIONS · LAST 12 MONTHS", "Taller, brighter blocks = busier days."],
    detail: "<p><strong>Contribution calendar.</strong> Taller and brighter blocks mark busier days. This section refreshes from live GitHub data every 12 hours.</p>",
  }),
  card({
    name: "about",
    alt: `About: ${about.whoami}`,
    tooltip: ["ABOUT", about.whoami, ...about.rows.map((r) => `${r.key}: ${r.value} (${r.note})`)],
    detail: `<p><strong>${attr(about.whoami)}</strong></p><ul>${about.rows.map((r) => `<li><code>${attr(r.key)}</code> — ${attr(r.value)} <em>(${attr(r.note)})</em></li>`).join("")}</ul>`,
  }),
  card({
    name: "hackathons",
    alt: `Hackathons: ${hackathons.map((h) => `${h.result} ${h.short} (${h.year})`).join(", ")}`,
    tooltip: ["HACKATHONS", ...hackathons.map((h) => `${h.result} · ${h.event} — ${h.venue}, ${h.year}`)],
    detail: `<ul>${hackathons.map((h) => `<li><strong>${attr(h.result)}</strong> · ${attr(h.event)} — ${attr(h.venue)} (${h.year})</li>`).join("")}</ul>`,
  }),
  card({
    name: "work",
    alt: `Selected work: ${projects.map((p) => p.title).join(", ")}`,
    tooltip: ["SELECTED WORK", ...projects.flatMap((p, k) => [`${String(k + 1).padStart(2, "0")} ${p.title} — ${p.description}`, `    ${p.stack.join(" · ")}`])],
    detail: `<ul>${projects.map((p) => `<li><strong>${attr(p.title)}</strong> — ${attr(p.description)}<br/><code>${attr(p.stack.join(" · "))}</code></li>`).join("")}</ul>`,
  }),
  card({
    name: "stack",
    alt: `Tech stack: ${stack.map((g) => g.items.join(", ")).join(", ")}`,
    tooltip: ["STACK", ...stack.map((g) => `${g.name}: ${g.items.join(", ")}`)],
    detail: `<ul>${stack.map((g) => `<li><strong>${attr(g.name)}</strong> — ${attr(g.items.join(" · "))}</li>`).join("")}</ul>`,
  }),
  card({
    name: "certifications",
    alt: `Certifications: ${certifications.map((c) => c.issuer).join(", ")}`,
    tooltip: ["CERTIFICATIONS", ...certifications.map((c) => `${c.issuer} — ${c.area}`)],
    detail: `<ul>${certifications.map((c) => `<li><strong>${attr(c.issuer)}</strong> — ${attr(c.area)}</li>`).join("")}</ul>`,
  }),
  card({
    name: "languages",
    alt: "Languages by code share, plus public repos, stars, followers and pull requests",
    tooltip: ["LANGUAGES & NUMBERS", "Code share across public repos, refreshed every 12 hours."],
    detail: "<p><strong>Languages &amp; numbers.</strong> The visual is refreshed every 12 hours from public GitHub data, including code share and profile activity.</p>",
  }),
];

const readme = `<img src="./assets/hero-buildathon.svg" width="100%" alt="Abdul Munaf Z — front-end engineer building interfaces that see, think and speak" />

<p align="center">
  <img src="./koi/koi.gif" width="256" alt="A koi generated from Abdul Munaf Z's public GitHub activity" />
</p>
<p align="center"><sub>My koi evolves with my public GitHub activity.</sub></p>

<p align="center">
  <a href="https://www.abdulmunaf.in/"><img src="https://img.shields.io/badge/Portfolio-abdulmunaf.in-1B1B1B?style=flat-square&labelColor=FF4A1C" alt="Portfolio" /></a>
  <a href="https://linkedin.com/in/abdul-munaf-z-6380a8251"><img src="https://img.shields.io/badge/LinkedIn-Abdul_Munaf_Z-1B1B1B?style=flat-square&labelColor=2E2E2E" alt="LinkedIn" /></a>
  <a href="mailto:z.abdulmunaf@gmail.com"><img src="https://img.shields.io/badge/Email-z.abdulmunaf@gmail.com-1B1B1B?style=flat-square&logo=gmail&logoColor=FF4A1C&labelColor=2E2E2E" alt="Email" /></a>
  <img src="https://komarev.com/ghpvc/?username=ABDULMUNAFZ&label=views&color=1B1B1B&style=flat-square" alt="Profile views" />
  <img src="https://img.shields.io/github/followers/ABDULMUNAFZ?label=followers&style=flat-square&color=1B1B1B&labelColor=2E2E2E" alt="Followers" />
</p>

<br/>

${cards.join("\n")}
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="${RAW}/snake-dark.svg" />
  <source media="(prefers-color-scheme: light)" srcset="${RAW}/snake.svg" />
  <img width="100%" alt="Contribution snake" src="${RAW}/snake.svg" />
</picture>

<p align="center"><sub>Every graphic here is generated by <a href="./scripts"><code>scripts/</code></a> from <a href="./data/profile.json"><code>data/profile.json</code></a> and live GitHub data, refreshed every 12 hours.</sub></p>
`;

await writeFile(new URL("README.md", root), readme);
console.log("wrote README.md");
