// Renders the contribution calendar as an isometric 3D SVG (dark + light).
// Usage: GITHUB_TOKEN=... node scripts/iso-calendar.mjs <login> <outDir>
//        node scripts/iso-calendar.mjs --sample <outDir>   (offline preview)
import { THEMES, frame, graphql, hoverRules, iso, writeVariants } from "./lib/svg.mjs";

const LEVEL_INDEX = {
  FIRST_QUARTILE: 0,
  SECOND_QUARTILE: 1,
  THIRD_QUARTILE: 2,
  FOURTH_QUARTILE: 3,
};

async function fetchCalendar(login) {
  const query = `query($login:String!){user(login:$login){contributionsCollection{contributionCalendar{totalContributions weeks{contributionDays{date contributionCount contributionLevel}}}}}}`;
  const data = await graphql({ query, variables: { login } });
  const cal = data.user.contributionsCollection.contributionCalendar;
  return cal.weeks.map((w) =>
    w.contributionDays.map((d) => ({
      date: d.date,
      count: d.contributionCount,
      level: LEVEL_INDEX[d.contributionLevel] ?? -1,
    })),
  );
}

// Deterministic fake year so the layout can be previewed without a token.
function sampleCalendar() {
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const start = new Date(Date.UTC(2025, 9, 5));
  const weeks = [];
  for (let w = 0; w < 53; w++) {
    const days = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(start.getTime() + (w * 7 + d) * 864e5);
      const busy = (w < 22 || w > 46) && rand() > 0.35;
      const count = busy ? Math.floor(rand() ** 3 * 40) + 1 : rand() > 0.96 ? 2 : 0;
      days.push({ date: date.toISOString().slice(0, 10), count, level: 0 });
    }
    weeks.push(days);
  }
  const max = Math.max(...weeks.flat().map((d) => d.count));
  for (const d of weeks.flat()) {
    d.level = d.count === 0 ? -1 : Math.min(3, Math.floor((d.count / max) * 4));
  }
  return weeks;
}

function computeStats(weeks) {
  const days = weeks.flat();
  const today = new Date().toISOString().slice(0, 10);
  const past = days.filter((d) => d.date <= today);
  let best = 0;
  let run = 0;
  for (const d of past) {
    run = d.count > 0 ? run + 1 : 0;
    best = Math.max(best, run);
  }
  // A streak stays "current" until a full day passes without a contribution.
  let current = 0;
  let i = past.length - 1;
  if (i >= 0 && past[i].count === 0) i--;
  for (; i >= 0 && past[i].count > 0; i--) current++;
  const total = past.reduce((s, d) => s + d.count, 0);
  const peak = past.reduce((m, d) => (d.count > m.count ? d : m), { count: 0, date: "" });
  return {
    total,
    best,
    current,
    peak,
    average: past.length ? total / past.length : 0,
    activeDays: past.filter((d) => d.count > 0).length,
    from: days[0]?.date ?? "",
    to: past.at(-1)?.date ?? "",
  };
}

const fmtDate = (iso) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

const fmtDay = (iso) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

function render({ weeks, stats, theme, login, fullPage = false }) {
  const t = THEMES[theme];
  const W = 880;
  const H = 440;
  const size = 11;
  const maxBar = 64;
  const { pt, poly, box } = iso({ ox: 40 + 7 * size * Math.cos(Math.PI / 6), oy: 30 + maxBar, size });
  const maxCount = Math.max(1, ...weeks.flat().map((d) => d.count));
  const heightOf = (count) => (count === 0 ? 0 : 3 + Math.pow(count / maxCount, 0.55) * (maxBar - 3));

  const sx = 560;
  const [tipX, tipY] = [40, 300];
  const cells = [];
  weeks.forEach((week, i) =>
    week.forEach((day, j) => {
      cells.push({ i, j, ...day });
    }),
  );
  // Painter's order: farther cells (smaller i + j) first.
  cells.sort((a, b) => a.i + a.j - (b.i + b.j) || a.i - b.i);

  const g = 0.9; // inset so neighbouring tiles read as separate blocks
  // Cells stay flat siblings of #tips so `#dN:hover ~ #tips #tN` can reveal each day's details.
  const shapes = [];
  const tips = [];
  for (const [n, c] of cells.entries()) {
    const plural = c.count === 1 ? "contribution" : "contributions";
    tips.push(
      `<g id="t${n}" class="tip"><text x="${tipX}" y="${tipY + 30}" class="val">${c.count}<tspan class="sub" dx="10">${plural}</tspan></text>` +
        `<text x="${tipX}" y="${tipY + 50}" class="sub">${fmtDay(c.date)}</text></g>`,
    );
    const i0 = c.i + (1 - g) / 2;
    const j0 = c.j + (1 - g) / 2;
    const [i1, j1] = [i0 + g, j0 + g];
    const h = heightOf(c.count);
    if (h === 0) {
      shapes.push(
        `<polygon id="d${n}" class="c e" points="${poly([pt(i0, j0), pt(i1, j0), pt(i1, j1), pt(i0, j1)])}" fill="${t.empty}" stroke="${t.emptyEdge}" stroke-width="0.6"/>`,
      );
      continue;
    }
    const delay = (c.i * 0.025 + c.j * 0.01).toFixed(3);
    shapes.push(
      `<g id="d${n}" class="c b" style="animation-delay:${delay}s">${box({ i0, j0, i1, j1, h1: h, color: t.levels[Math.max(0, c.level)] })}</g>`,
    );
  }

  const stat = (y, label, value, sub) =>
    `<text x="${sx}" y="${y}" class="lbl">${label}</text>` +
    `<text x="${sx}" y="${y + 30}" class="val">${value}${sub ? `<tspan class="sub" dx="10">${sub}</tspan>` : ""}</text>`;

  const legend = t.levels
    .map((c, k) => `<rect x="${92 + k * 16}" y="${H - 34}" width="11" height="11" rx="2" fill="${c}"/>`)
    .join("");

  const css = `  .b{animation:rise .7s cubic-bezier(.2,.8,.2,1) both}
  @keyframes rise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
  .c:hover{filter:brightness(1.35)}
  .e:hover{fill:${t.accent};stroke:${t.accent}}
  .tip{opacity:0}
  .c:hover~#tips #hint{opacity:0}
  ${hoverRules({ triggers: ["d"], panel: "tips", target: "t", count: cells.length })}`;
  const body = `${shapes.join("\n")}
<g id="tips"><text x="${tipX}" y="${tipY}" class="lbl">DAY DETAILS</text>
<text id="hint" x="${tipX}" y="${tipY + 30}" class="sub">Hover any block</text>
${tips.join("\n")}</g>
<line x1="${sx - 24}" y1="40" x2="${sx - 24}" y2="270" stroke="${t.line}"/>
<circle cx="${sx + 4}" cy="44" r="4" fill="${t.accent}"/>
<text x="${sx + 16}" y="48" class="lbl" style="fill:${t.accent}">LAST 12 MONTHS</text>
${stat(72, "CONTRIBUTIONS", stats.total.toLocaleString("en-US"), `${stats.activeDays} active days`)}
${stat(130, "STREAK  CURRENT / BEST", `${stats.current} / ${stats.best}`, "days")}
${stat(188, "PEAK DAY", stats.peak.count, stats.peak.date ? `on ${fmtDate(stats.peak.date)}` : "")}
<text x="${sx}" y="262" class="lbl">AVG / DAY</text>
<text x="${sx + 92}" y="262" class="lbl" style="fill:${t.text}">${stats.average.toFixed(2)}</text>
<text x="40" y="${H - 54}" class="ttl">@${login}</text>
<text x="40" y="${H - 25}" class="cap">less</text>${legend}<text x="${92 + 4 * 16 + 4}" y="${H - 25}" class="cap">more</text>
<text x="${W - 24}" y="${H - 25}" class="cap" text-anchor="end">${fmtDate(stats.from)} → ${fmtDate(stats.to)}</text>`;
  return frame({ W, H, theme, fullPage, aria: `${login}: ${stats.total} contributions in the last year`, css, body });
}

const args = process.argv.slice(2);
const sample = args[0] === "--sample";
const login = sample ? "ABDULMUNAFZ" : args[0];
const outDir = args[1] ?? "dist";
if (!login) {
  console.error("usage: node scripts/iso-calendar.mjs <login> [outDir]");
  process.exit(1);
}
const weeks = sample ? sampleCalendar() : await fetchCalendar(login);
const stats = computeStats(weeks);
await writeVariants({ outDir, name: "calendar-3d", render: ({ theme, fullPage }) => render({ weeks, stats, theme, login, fullPage }) });
console.log(`wrote calendar-3d-{dark,light,full}.svg to ${outDir}`, stats);
