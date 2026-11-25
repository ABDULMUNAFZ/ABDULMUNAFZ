import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

export const THEMES = {
  dark: {
    bg: "#161616",
    panel: "#1B1B1B",
    raised: "#24211F",
    line: "#2E2E2E",
    text: "#ECE6E0",
    muted: "#9C948C",
    accent: "#FF4A1C",
    empty: "#2A2725",
    emptyEdge: "#201E1C",
    levels: ["#3A2A1F", "#7A5333", "#D65A32", "#FF4A1C"],
  },
  light: {
    bg: "#F0EAE4",
    panel: "#FFFFFF",
    raised: "#FFFFFF",
    line: "#D9C9BB",
    text: "#1B1B1B",
    muted: "#746B64",
    accent: "#D94316",
    empty: "#E7DCD1",
    emptyEdge: "#D9C9BB",
    levels: ["#E7C6B0", "#C98762", "#A64B29", "#7A2D18"],
  },
};

export const SANS = "-apple-system,'Segoe UI',Inter,Helvetica,Arial,sans-serif";
export const MONO = "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace";

export function shade(hex, factor) {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) =>
    Math.max(0, Math.min(255, Math.round(c * factor))),
  );
  return `#${ch.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

export function mix({ from, to, amount }) {
  const a = parseInt(from.slice(1), 16);
  const b = parseInt(to.slice(1), 16);
  const ch = [16, 8, 0].map((s) => Math.round(((a >> s) & 255) * (1 - amount) + ((b >> s) & 255) * amount));
  return `#${ch.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

export const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function wrap(text, maxChars) {
  const lines = [];
  let line = "";
  for (const word of String(text).split(/\s+/)) {
    if (line && (line + " " + word).length > maxChars) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

// Isometric projection helper: i runs down-right, j down-left, h is height in px.
export function iso({ ox, oy, size }) {
  const cx = size * Math.cos(Math.PI / 6);
  const cy = size * Math.sin(Math.PI / 6);
  const pt = (i, j, h = 0) => [ox + (i - j) * cx, oy + (i + j) * cy - h];
  const poly = (pts) => pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  // Visible faces of a box spanning [i0,i1]x[j0,j1] from height h0 to h1.
  const box = ({ i0, j0, i1, j1, h0 = 0, h1, color, edge = "" }) =>
    `<polygon points="${poly([pt(i0, j1, h1), pt(i1, j1, h1), pt(i1, j1, h0), pt(i0, j1, h0)])}" fill="${shade(color, 0.72)}"${edge}/>` +
    `<polygon points="${poly([pt(i1, j0, h1), pt(i1, j1, h1), pt(i1, j1, h0), pt(i1, j0, h0)])}" fill="${shade(color, 0.52)}"${edge}/>` +
    `<polygon points="${poly([pt(i0, j0, h1), pt(i1, j0, h1), pt(i1, j1, h1), pt(i0, j1, h1)])}" fill="${shade(color, 1.08)}"${edge}/>`;
  return { cx, cy, pt, poly, box };
}

// Reveals `#<panel> #<target>N` while `#<trigger>N` is hovered; triggers must precede the panel as siblings.
export const hoverRules = ({ triggers, panel, target, count, css = "opacity:1", states = ["hover"] }) =>
  count === 0
    ? ""
    : `${Array.from({ length: count }, (_, n) => triggers.flatMap((tr) => states.map(state => `#${tr}${n}:${state}~#${panel} #${target}${n}`)).join(",")).join(",")}{${css}}`;

/**
 * Wraps a card body in the shared frame. `fullPage` drops fixed dimensions so the SVG fills the
 * browser window when opened directly; README images keep a fixed size.
 */
export function frame({ W, H, theme, fullPage, label, aria, css = "", body }) {
  const t = THEMES[theme];
  const pad = fullPage ? 24 : 0;
  const dims = fullPage ? "" : ` width="${W}" height="${H}"`;
  const header = label
    ? `<circle cx="48" cy="48" r="4" fill="${t.accent}"/><text x="60" y="52" class="lbl" style="fill:${t.text}">${esc(label)}</text>` +
      `<text x="${W - 44}" y="52" class="lbl" text-anchor="end">${fullPage ? "HOVER TO EXPLORE" : "OPEN CARD ↗"}</text>`
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg"${dims} viewBox="${-pad} ${-pad} ${W + 2 * pad} ${H + 2 * pad}" role="img" aria-label="${esc(aria)}">
<style>
${fullPage ? `  :root{background:${t.bg}}\n` : ""}  .lbl{font:600 11px ${MONO};letter-spacing:.12em;fill:${t.muted}}
  .val{font:700 26px ${SANS};fill:${t.text}}
  .sub{font:500 13px ${SANS};fill:${t.muted}}
  .ttl{font:700 15px ${SANS};fill:${t.text}}
  .cap{font:500 11px ${MONO};fill:${t.muted}}
  .txt{font:500 14px ${SANS};fill:${t.text}}
  .fade{transition:opacity .2s}
${css}
  @media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
</style>
<defs>
  <linearGradient id="shell" x1="0" x2="1" y1="0" y2="1"><stop stop-color="${t.panel}"/><stop offset="1" stop-color="${t.bg}"/></linearGradient>
  <radialGradient id="halo" cx="92%" cy="0%" r="70%"><stop stop-color="${t.accent}" stop-opacity=".16"/><stop offset="1" stop-color="${t.accent}" stop-opacity="0"/></radialGradient>
</defs>
<rect x="0" y="0" width="${W}" height="${H}" rx="24" fill="${t.bg}"/>
<rect x="12" y="12" width="${W - 24}" height="${H - 24}" rx="20" fill="url(#shell)" stroke="${t.line}"/>
<rect x="12" y="12" width="${W - 24}" height="${H - 24}" rx="20" fill="url(#halo)"/>
<line x1="36" y1="70" x2="${W - 36}" y2="70" stroke="${t.line}"/>
${header}
${body}
</svg>
`;
}

// Writes <name>-dark.svg / <name>-light.svg for the README and <name>-full.svg for the click-through view.
export async function writeVariants({ outDir, name, render }) {
  await mkdir(outDir, { recursive: true });
  for (const theme of Object.keys(THEMES)) {
    await writeFile(join(outDir, `${name}-${theme}.svg`), render({ theme, fullPage: false }));
  }
  await writeFile(join(outDir, `${name}-full.svg`), render({ theme: "dark", fullPage: true }));
}

export async function graphql({ query, variables }) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN is required");
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { Authorization: `bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`GraphQL HTTP ${res.status}: ${await res.text()}`);
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data;
}
