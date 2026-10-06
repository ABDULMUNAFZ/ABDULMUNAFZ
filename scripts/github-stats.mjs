// Renders language share and headline GitHub numbers as an interactive donut card.
// Usage: GITHUB_TOKEN=... node scripts/github-stats.mjs <login> [outDir]
//        node scripts/github-stats.mjs --sample [outDir]   (offline preview)
import { MONO, SANS, THEMES, esc, frame, graphql, hoverRules, mix, writeVariants } from "./lib/svg.mjs";

const MAX_SLICES = 7;

async function fetchStats(login) {
  const query = `query($login:String!){user(login:$login){
    followers{totalCount}
    pullRequests{totalCount}
    repositories(first:100,ownerAffiliations:OWNER,isFork:false,privacy:PUBLIC){totalCount nodes{stargazerCount
      languages(first:10,orderBy:{field:SIZE,direction:DESC}){edges{size node{name}}}}}}}`;
  const { user } = await graphql({ query, variables: { login } });
  const bytes = new Map();
  for (const repo of user.repositories.nodes) {
    for (const { size, node } of repo.languages.edges) bytes.set(node.name, (bytes.get(node.name) ?? 0) + size);
  }
  return {
    languages: [...bytes].map(([name, size]) => ({ name, size })),
    numbers: [
      { label: "PUBLIC REPOS", value: user.repositories.totalCount },
      { label: "STARS", value: user.repositories.nodes.reduce((s, r) => s + r.stargazerCount, 0) },
      { label: "FOLLOWERS", value: user.followers.totalCount },
      { label: "PULL REQUESTS", value: user.pullRequests.totalCount },
    ],
  };
}

const sampleStats = () => ({
  languages: [
    { name: "Python", size: 420000 },
    { name: "JavaScript", size: 310000 },
    { name: "TypeScript", size: 190000 },
    { name: "HTML", size: 120000 },
    { name: "CSS", size: 80000 },
    { name: "Jupyter Notebook", size: 40000 },
    { name: "Shell", size: 8000 },
    { name: "Dockerfile", size: 3000 },
  ],
  numbers: [
    { label: "PUBLIC REPOS", value: 24 },
    { label: "STARS", value: 18 },
    { label: "FOLLOWERS", value: 30 },
    { label: "PULL REQUESTS", value: 12 },
  ],
});

function slices(languages) {
  const sorted = [...languages].sort((a, b) => b.size - a.size);
  const top = sorted.slice(0, MAX_SLICES);
  const rest = sorted.slice(MAX_SLICES).reduce((s, l) => s + l.size, 0);
  if (rest > 0) top.push({ name: "Other", size: rest });
  const total = top.reduce((s, l) => s + l.size, 0) || 1;
  return top.map((l) => ({ ...l, share: l.size / total }));
}

function render({ stats, login, theme, fullPage }) {
  const t = THEMES[theme];
  const W = 880;
  const H = 424;
  const parts = slices(stats.languages);
  const [cx, cy, r0, r1] = [196, 236, 82, 132];
  // Rank-ordered ramp: the biggest language gets the accent, smaller ones fade toward the surface.
  const colorOf = (k) => mix({ from: t.accent, to: t.line, amount: parts.length > 1 ? (k / (parts.length - 1)) * 0.82 : 0 });

  let angle = -Math.PI / 2;
  const arcs = [];
  const pops = [];
  for (const [k, p] of parts.entries()) {
    const sweep = Math.max(p.share * Math.PI * 2 - 0.02, 0.001);
    const [a0, a1] = [angle + 0.01, angle + 0.01 + sweep];
    angle += p.share * Math.PI * 2;
    const at = (rad, a) => `${(cx + rad * Math.cos(a)).toFixed(2)},${(cy + rad * Math.sin(a)).toFixed(2)}`;
    const large = sweep > Math.PI ? 1 : 0;
    const mid = (a0 + a1) / 2;
    pops.push(`#g${k}:hover{transform:translate(${(Math.cos(mid) * 10).toFixed(1)}px,${(Math.sin(mid) * 10).toFixed(1)}px)}`);
    arcs.push(
      `<path id="g${k}" class="seg" style="animation-delay:${(0.1 + k * 0.08).toFixed(2)}s" fill="${colorOf(k)}" ` +
        `d="M${at(r1, a0)} A${r1},${r1} 0 ${large} 1 ${at(r1, a1)} L${at(r0, a1)} A${r0},${r0} 0 ${large} 0 ${at(r0, a0)} Z"/>`,
    );
  }

  const pct = (s) => `${(s * 100).toFixed(s < 0.1 ? 1 : 0)}%`;
  const lx = 400;
  const rowY = (k) => 96 + k * 24;
  const legend = parts
    .map(
      (p, k) =>
        `<g id="l${k}" class="lg"><rect class="hl" x="${lx - 10}" y="${rowY(k) - 17}" width="${W - lx - 22}" height="24" rx="6"/>` +
        `<rect x="${lx}" y="${rowY(k) - 10}" width="10" height="10" rx="2" fill="${colorOf(k)}"/>` +
        `<text x="${lx + 22}" y="${rowY(k)}" class="txt">${esc(p.name)}</text>` +
        `<rect x="${lx + 190}" y="${rowY(k) - 7}" width="${(W - lx - 300) * (p.share / parts[0].share)}" height="4" rx="2" fill="${colorOf(k)}"/>` +
        `<text x="${W - 40}" y="${rowY(k)}" text-anchor="end" class="num">${pct(p.share)}</text></g>`,
    )
    .join("\n");
  const centers = parts
    .map(
      (p, k) =>
        `<g id="c${k}" class="cc"><text x="${cx}" y="${cy + 2}" text-anchor="middle" class="pct">${pct(p.share)}</text>` +
        `<text x="${cx}" y="${cy + 24}" text-anchor="middle" class="sub">${esc(p.name)}</text></g>`,
    )
    .join("");

  const tileW = (W - lx - 32) / stats.numbers.length;
  const tiles = stats.numbers
    .map(
      (n, k) =>
        `<g class="tile" transform="translate(${lx - 10 + k * tileW} ${H - 112})"><rect width="${tileW - 10}" height="72" rx="10"/>` +
        `<text x="14" y="38" class="tv">${n.value.toLocaleString("en-US")}</text>` +
        `<text x="14" y="58" class="tl">${n.label}</text></g>`,
    )
    .join("");

  const css = `
  .seg{transition:transform .2s cubic-bezier(.2,.8,.2,1),filter .2s;animation:grow .7s cubic-bezier(.2,.8,.2,1) both;transform-box:view-box}
  @keyframes grow{from{opacity:0}to{opacity:1}}
  .seg:hover{filter:brightness(1.2)}
  ${pops.join("\n  ")}
  .num{font:600 12px ${MONO};fill:${t.muted}}
  .pct{font:800 34px ${SANS};fill:${t.text};letter-spacing:-1px}
  .hl{fill:${t.raised};opacity:0;transition:opacity .15s}
  ${parts.map((_, k) => `#g${k}:hover~#l${k} .hl`).join(",")}{opacity:1}
  .lg:hover .hl{opacity:1}
  .cc{opacity:0;transition:opacity .15s}
  .seg:hover~#center #cdef{opacity:0}
  ${hoverRules({ triggers: ["g"], panel: "center", target: "c", count: parts.length })}
  .tile rect{fill:${t.panel};stroke:${t.line};transition:stroke .2s}
  .tile:hover rect{stroke:${t.accent}}
  .tv{font:700 22px ${SANS};fill:${t.text}}
  .tl{font:600 9.5px ${MONO};letter-spacing:.1em;fill:${t.muted}}`;

  const body = `<circle cx="${cx}" cy="${cy}" r="${r1 + 14}" fill="none" stroke="${t.line}" stroke-dasharray="2 6"/>
${arcs.join("\n")}
${legend}
<g id="center"><g id="cdef" class="fade"><text x="${cx}" y="${cy + 2}" text-anchor="middle" class="pct">${stats.languages.length}</text>
<text x="${cx}" y="${cy + 24}" text-anchor="middle" class="sub">languages</text></g>${centers}</g>
<text x="${lx - 10}" y="${H - 124}" class="lbl">BY THE NUMBERS · @${esc(login)}</text>
${tiles}`;
  return frame({ W, H, theme, fullPage, label: "06 — LANGUAGES", aria: `Languages: ${parts.map((p) => `${p.name} ${pct(p.share)}`).join(", ")}`, css, body });
}

const args = process.argv.slice(2);
const sample = args[0] === "--sample";
const login = sample ? "ABDULMUNAFZ" : args[0];
const outDir = args[1] ?? "dist";
if (!login) {
  console.error("usage: node scripts/github-stats.mjs <login> [outDir]");
  process.exit(1);
}
const stats = sample ? sampleStats() : await fetchStats(login);
await writeVariants({ outDir, name: "languages", render: ({ theme, fullPage }) => render({ stats, login, theme, fullPage }) });
console.log(`wrote languages-{dark,light,full}.svg to ${outDir}`);
