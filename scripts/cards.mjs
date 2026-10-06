// Renders the static profile sections from data/profile.json as interactive SVG cards.
// Usage: node scripts/cards.mjs [outDir]
import { readFile } from "node:fs/promises";
import { MONO, SANS, THEMES, esc, frame, hoverRules, iso, wrap, writeVariants } from "./lib/svg.mjs";

const W = 880;
const profile = JSON.parse(await readFile(new URL("../data/profile.json", import.meta.url), "utf8"));

function chips({ items, x, y, maxWidth, t }) {
  let [cx, cy] = [x, y];
  return items
    .map((item) => {
      const w = item.length * 6.9 + 18;
      if (cx + w > x + maxWidth) [cx, cy] = [x, cy + 28];
      const out =
        `<rect x="${cx}" y="${cy}" width="${w}" height="22" rx="11" fill="none" stroke="${t.line}"/>` +
        `<text x="${cx + w / 2}" y="${cy + 15}" text-anchor="middle" class="chip">${esc(item)}</text>`;
      cx += w + 8;
      return out;
    })
    .join("");
}

const chipCss = (t) => `  .chip{font:500 11.5px ${MONO};fill:${t.text}}`;

// 01 — terminal that types itself; hovering a line reveals an inline comment.
function about({ theme, fullPage }) {
  const t = THEMES[theme];
  const { whoami, rows } = profile.about;
  const [x, lh, cw] = [60, 26, 8.4];
  const lineY = (k) => 150 + k * lh;
  const promptLine = 4 + rows.length;
  const H = lineY(promptLine) + 52;
  const keyWidth = Math.max(...rows.map((r) => r.key.length)) + 1;
  const valueCol = x + (keyWidth + 2) * cw;
  const noteCol = valueCol + (Math.max(...rows.map((r) => r.value.length)) + 3) * cw;

  const typed = ({ k, cmd, begin }) => {
    const chars = cmd.length + 2;
    const steps = Array.from({ length: chars + 1 }, (_, n) => (n === chars ? 900 : n * cw).toFixed(1)).join(";");
    return (
      `<clipPath id="ty${k}"><rect x="${x - 2}" y="${lineY(k) - 17}" height="24" width="0">` +
      `<animate attributeName="width" values="${steps}" dur="${(chars * 0.06).toFixed(2)}s" begin="${begin}s" fill="freeze" calcMode="discrete"/></rect></clipPath>` +
      `<text x="${x}" y="${lineY(k)}" class="tm" clip-path="url(#ty${k})"><tspan class="pr">$</tspan> ${esc(cmd)}</text>`
    );
  };
  const rowsStart = 2.5;
  const rowSvg = rows
    .map(
      (r, n) =>
        `<g id="r${n}" class="row ln" style="animation-delay:${(rowsStart + n * 0.12).toFixed(2)}s">` +
        `<rect class="hl" x="${x - 12}" y="${lineY(4 + n) - 18}" width="${W - 2 * (x - 12)}" height="${lh}" rx="6"/>` +
        `<text x="${x}" y="${lineY(4 + n)}" class="tm"><tspan class="key">${esc(r.key)}</tspan>` +
        `<tspan class="dim" x="${x + keyWidth * cw}">:</tspan><tspan x="${valueCol}">${esc(r.value)}</tspan></text></g>`,
    )
    .join("\n");
  const notes = rows
    .map((r, n) => `<text id="n${n}" class="tm note" x="${noteCol}" y="${lineY(4 + n)}"># ${esc(r.note)}</text>`)
    .join("");
  const promptAt = (rowsStart + rows.length * 0.12 + 0.2).toFixed(2);

  const css = `${chipCss(t)}
  .tm{font:500 14px ${MONO};fill:${t.text}}
  .pr{fill:${t.accent};font-weight:700}
  .key{fill:${t.accent}}
  .dim{fill:${t.muted}}
  .out{fill:${t.muted}}
  .ln{animation:show .35s ease-out both}
  @keyframes show{from{opacity:0;transform:translateX(-6px)}to{opacity:1;transform:none}}
  .cur{animation:show .2s ${promptAt}s both,blink 1.1s ${promptAt}s steps(1) infinite}
  @keyframes blink{50%{opacity:0}}
  .hl{fill:${t.accent};opacity:0;transition:opacity .15s}
  .row:hover .hl{opacity:.1}
  .note{fill:${t.muted};opacity:0;transition:opacity .15s}
  ${hoverRules({ triggers: ["r"], panel: "notes", target: "n", count: rows.length })}`;

  const body = `
<rect x="32" y="76" width="${W - 64}" height="${H - 108}" rx="12" fill="${t.panel}" stroke="${t.line}"/>
<circle cx="54" cy="96" r="5" fill="${t.accent}"/><circle cx="72" cy="96" r="5" fill="${t.line}"/><circle cx="90" cy="96" r="5" fill="${t.line}"/>
<text x="${W / 2}" y="100" text-anchor="middle" class="cap">abdul@munaf: ~ — zsh</text>
<line x1="32" y1="114" x2="${W - 32}" y2="114" stroke="${t.line}"/>
${typed({ k: 0, cmd: "whoami", begin: 0.3 })}
<text x="${x}" y="${lineY(1)}" class="tm out ln" style="animation-delay:1s">${esc(whoami)}</text>
${typed({ k: 3, cmd: "cat profile.yml", begin: 1.4 })}
${rowSvg}
<g id="notes">${notes}</g>
<text x="${x}" y="${lineY(promptLine)}" class="tm ln" style="animation-delay:${promptAt}s"><tspan class="pr">$</tspan></text>
<rect class="cur" x="${x + 2 * cw}" y="${lineY(promptLine) - 14}" width="${cw}" height="18" fill="${t.accent}"/>`;
  return frame({ W, H, theme, fullPage, label: "01 — ABOUT", aria: `About: ${whoami}`, css, body });
}

// 02 — isometric podium; pillar height encodes placing, hover lifts it and names the venue.
function hackathons({ theme, fullPage }) {
  const t = THEMES[theme];
  const list = profile.hackathons;
  const H = 460;
  const { pt, poly, box } = iso({ ox: 100, oy: 212, size: 40 });
  const heightOf = (rank) => 48 + (4 - rank) * 26;
  const colorOf = (rank) => t.levels[4 - rank];
  const step = 2.1;
  const span = (list.length - 1) * step + 1;

  const floor = `<polygon points="${poly([pt(-0.4, -0.4), pt(span + 0.4, -0.4), pt(span + 0.4, 1.4), pt(-0.4, 1.4)])}" fill="${t.panel}" stroke="${t.line}"/>`;
  const pillars = list
    .map((h, k) => {
      const i0 = k * step;
      const h1 = heightOf(h.rank);
      const [lx, ly] = pt(i0 + 0.5, 0.5, h1);
      return (
        `<g id="h${k}" class="p" style="animation-delay:${(0.15 + k * 0.12).toFixed(2)}s"><g class="lift">` +
        box({ i0, j0: 0, i1: i0 + 1, j1: 1, h1, color: colorOf(h.rank) }) +
        `<g class="tag"><text x="${lx}" y="${ly - 50}" text-anchor="middle" class="rk">${esc(h.result)}</text>` +
        `<text x="${lx}" y="${ly - 34}" text-anchor="middle" class="cap">${h.year}</text></g></g></g>`
      );
    })
    .join("\n");

  const px = 484;
  const rowY = (k) => 84 + k * 56;
  const rows = list
    .map(
      (h, k) =>
        `<g id="r${k}" class="row"><rect class="hl" x="${px - 14}" y="${rowY(k)}" width="${W - px - 18}" height="50" rx="10"/>` +
        `<text x="${px}" y="${rowY(k) + 22}" class="rk" style="fill:${t.accent}">${esc(h.result)}</text>` +
        `<text x="${px + 70}" y="${rowY(k) + 22}" class="txt">${esc(h.short)}</text>` +
        `<text x="${px + 70}" y="${rowY(k) + 40}" class="sub">${esc(h.venue)}</text>` +
        `<text x="${W - 46}" y="${rowY(k) + 22}" text-anchor="end" class="cap">${h.year}</text></g>`,
    )
    .join("\n");
  const wins = list.filter((h) => h.rank === 1).length;
  const detailY = rowY(list.length) + 22;
  const details = list
    .map((h, k) => `<text id="d${k}" class="det txt" x="${px}" y="${detailY + 22}">${esc(h.event)}</text>`)
    .join("");

  const css = `
  .rk{font:700 13px ${MONO};fill:${t.text};letter-spacing:.06em}
  .p{animation:rise .8s cubic-bezier(.2,.8,.2,1) both}
  @keyframes rise{from{opacity:0;transform:translateY(40px)}to{opacity:1;transform:none}}
  .lift{transition:transform .25s cubic-bezier(.2,.8,.2,1),filter .25s}
  .p:hover .lift{transform:translateY(-14px);filter:brightness(1.2)}
  .hl{fill:${t.raised};stroke:${t.line};opacity:0;transition:opacity .15s}
  .row:hover .hl{opacity:1}
  ${list.map((_, k) => `#h${k}:hover~#r${k} .hl`).join(",")}{opacity:1}
  .det{opacity:0;transition:opacity .15s}
  .p:hover~#detail #dd,.row:hover~#detail #dd{opacity:0}
  ${hoverRules({ triggers: ["h", "r"], panel: "detail", target: "d", count: list.length })}`;

  const body = `${floor}
${pillars}
<line x1="${px - 24}" y1="80" x2="${px - 24}" y2="${H - 36}" stroke="${t.line}"/>
${rows}
<g id="detail"><text x="${px}" y="${detailY}" class="lbl">FULL TITLE</text>
<text id="dd" class="txt fade" x="${px}" y="${detailY + 22}"><tspan style="fill:${t.accent};font-weight:700">${wins}× winner</tspan> · ${list.length} podium finishes</text>
${details}</g>`;
  return frame({ W, H, theme, fullPage, label: "02 — HACKATHONS", aria: `${wins} hackathon wins, ${list.length} podium finishes`, css, body });
}

// 03 — fanned card deck; hovering a card slides it out and shows the project in the side panel.
function work({ theme, fullPage }) {
  const t = THEMES[theme];
  const list = profile.projects;
  const H = 460;
  const [pivotX, pivotY] = [322, 700];
  const angles = list.map((_, k) => (k - (list.length - 1) / 2) * 11);

  const cards = list
    .map((p, k) => {
      const tag = fullPage && p.url ? "a" : "g";
      const href = fullPage && p.url ? ` href="${esc(p.url)}"` : "";
      // Neighbouring cards cover all but a left strip, so the title runs up that strip like a book spine.
      const title = `<text transform="translate(-70 -470) rotate(-90)" text-anchor="end" class="spine">${esc(p.short)}</text>`;
      return (
        `<${tag} id="w${k}" class="card"${href}><g transform="rotate(${angles[k]} ${pivotX} ${pivotY})">` +
        `<animateTransform attributeName="transform" type="rotate" from="0 ${pivotX} ${pivotY}" to="${angles[k]} ${pivotX} ${pivotY}" dur="1s" begin="0.2s" fill="freeze" calcMode="spline" keySplines=".2 .8 .2 1"/>` +
        `<g transform="translate(${pivotX} ${pivotY})"><g class="slide">` +
        `<rect x="-100" y="-520" width="200" height="300" rx="14" class="face"/>` +
        `<text x="-82" y="-488" class="num">${String(k + 1).padStart(2, "0")}</text>` +
        title +
        `</g></g></g></${tag}>`
      );
    })
    .join("\n");

  const px = 640;
  const panelFor = (p, k, id, cls) => {
    const title = wrap(p.title, 22);
    const desc = wrap(p.description, 31);
    let y = 112;
    let out = `<g id="${id}" class="${cls}"><text x="${px}" y="${y - 18}" class="lbl">${String(k + 1).padStart(2, "0")} / ${String(list.length).padStart(2, "0")}</text>`;
    for (const l of title) out += `<text x="${px}" y="${(y += 24)}" class="big">${esc(l)}</text>`;
    y += 10;
    for (const l of desc) out += `<text x="${px}" y="${(y += 20)}" class="sub">${esc(l)}</text>`;
    out += chips({ items: p.stack, x: px, y: y + 18, maxWidth: W - px - 36, t });
    if (p.url) out += `<text x="${px}" y="${H - 44}" class="cap" style="fill:${t.accent}">${fullPage ? "CLICK THE CARD TO OPEN ↗" : "LIVE / SOURCE AVAILABLE ↗"}</text>`;
    return `${out}</g>`;
  };

  const css = `${chipCss(t)}
  .face{fill:${t.raised};stroke:${t.line};transition:stroke .2s}
  .num{font:700 12px ${MONO};fill:${t.accent};letter-spacing:.1em}
  .spine{font:700 16px ${SANS};fill:${t.text}}
  .big{font:700 20px ${SANS};fill:${t.text}}
  .slide{transition:transform .3s cubic-bezier(.2,.8,.2,1)}
  .card:hover .slide{transform:translateY(-34px)}
  .card:hover .face{stroke:${t.accent}}
  .pp{opacity:0;transition:opacity .2s}
  .card:hover~#panel #pdef{opacity:0}
  ${hoverRules({ triggers: ["w"], panel: "panel", target: "p", count: list.length })}`;

  const body = `<clipPath id="clip"><rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="15"/></clipPath>
<g clip-path="url(#clip)">
<line x1="${px - 24}" y1="80" x2="${px - 24}" y2="${H - 36}" stroke="${t.line}"/>
${cards}
<g id="panel">${panelFor(list[0], 0, "pdef", "fade")}
${list.map((p, k) => panelFor(p, k, `p${k}`, "pp")).join("\n")}</g>
</g>`;
  return frame({ W, H, theme, fullPage, label: "03 — SELECTED WORK", aria: `Selected work: ${list.map((p) => p.title).join(", ")}`, css, body });
}

// 04 — tilted orbits; tech pills circle the core and a hovered ring takes focus.
function stack({ theme, fullPage }) {
  const t = THEMES[theme];
  // Smaller groups take the tighter inner orbits so pills do not collide.
  const groups = [...profile.stack].sort((a, b) => a.items.length - b.items.length);
  const H = 470;
  const [ox, oy, tilt] = [340, 266, 0.4];
  const radii = [100, 157, 213, 270];
  const durations = [70, 95, 120, 150];

  const core = iso({ ox, oy: oy + 14, size: 26 });
  const rings = groups
    .map((g, k) => {
      const r = radii[k];
      const dir = k % 2 ? -360 : 360;
      const nodes = g.items
        .map((item, n) => {
          const a0 = (360 / g.items.length) * n + k * 17;
          const w = item.length * 7 + 20;
          return (
            `<g transform="rotate(${a0}) translate(${r} 0) rotate(${-a0})"><g>` +
            `<animateTransform attributeName="transform" type="rotate" from="0" to="${-dir}" dur="${durations[k]}s" repeatCount="indefinite"/>` +
            `<g transform="scale(1 ${(1 / tilt).toFixed(4)})" class="node"><rect x="${-w / 2}" y="-11" width="${w}" height="22" rx="11"/>` +
            `<text y="4" text-anchor="middle" class="chip">${esc(item)}</text></g></g></g>`
          );
        })
        .join("");
      return (
        `<g id="s${k}" class="ring">` +
        `<ellipse cx="${ox}" cy="${oy}" rx="${r}" ry="${r * tilt}" class="hit"/>` +
        `<ellipse cx="${ox}" cy="${oy}" rx="${r}" ry="${r * tilt}" class="orbit"/>` +
        `<g transform="translate(${ox} ${oy}) scale(1 ${tilt})"><g>` +
        `<animateTransform attributeName="transform" type="rotate" from="0" to="${dir}" dur="${durations[k]}s" repeatCount="indefinite"/>` +
        `${nodes}</g></g></g>`
      );
    })
    .join("\n");

  const px = 690;
  const legendY = (k) => 144 + k * 34;
  const legend = groups
    .map(
      (g, k) =>
        `<circle cx="${px + 4}" cy="${legendY(k) - 4}" r="4" fill="${t.levels[3 - k]}"/>` +
        `<text x="${px + 18}" y="${legendY(k)}" class="txt">${esc(g.name)}</text>` +
        `<text x="${W - 40}" y="${legendY(k)}" text-anchor="end" class="cap">${g.items.length}</text>`,
    )
    .join("");
  const total = groups.reduce((s, g) => s + g.items.length, 0);
  const focus = groups
    .map((g, k) => {
      let out = `<g id="c${k}" class="foc"><text x="${px}" y="104" class="lbl">ORBIT ${k + 1} / ${groups.length}</text>` +
        `<text x="${px}" y="138" class="big">${esc(g.name)}</text>`;
      g.items.forEach((item, n) => {
        out += `<text x="${px}" y="${176 + n * 24}" class="txt"><tspan style="fill:${t.accent}">→</tspan> ${esc(item)}</text>`;
      });
      return `${out}</g>`;
    })
    .join("\n");

  const css = `${chipCss(t)}
  .big{font:700 22px ${SANS};fill:${t.text}}
  .hit{fill:none;stroke:transparent;stroke-width:30}
  .orbit{fill:none;stroke:${t.line};stroke-dasharray:3 5;transition:stroke .2s}
  .node rect{fill:${t.raised};stroke:${t.line};transition:fill .2s}
  .node:hover rect{fill:${t.accent}}
  .node:hover text{fill:${t.bg}}
  .ring{transition:opacity .25s}
  #sys:hover .ring{opacity:.25}
  #sys .ring:hover{opacity:1}
  .ring:hover .orbit{stroke:${t.accent};stroke-dasharray:none}
  .foc{opacity:0;transition:opacity .2s}
  .ring:hover~#panel #pdef{opacity:0}
  .float{animation:float 4s ease-in-out infinite}
  @keyframes float{50%{transform:translateY(-6px)}}
  ${hoverRules({ triggers: ["s"], panel: "panel", target: "c", count: groups.length })}`;

  const body = `<defs><radialGradient id="glow"><stop offset="0" stop-color="${t.accent}" stop-opacity=".28"/><stop offset="1" stop-color="${t.accent}" stop-opacity="0"/></radialGradient></defs>
<ellipse cx="${ox}" cy="${oy}" rx="120" ry="70" fill="url(#glow)"/>
<g class="float">${core.box({ i0: -0.5, j0: -0.5, i1: 0.5, j1: 0.5, h1: 30, color: t.accent })}</g>
<line x1="${px - 24}" y1="80" x2="${px - 24}" y2="${H - 36}" stroke="${t.line}"/>
<g id="sys">
${rings}
<g id="panel"><g id="pdef" class="fade"><text x="${px}" y="104" class="lbl">${total} TOOLS · ${groups.length} ORBITS</text>${legend}
<text x="${px}" y="${legendY(groups.length) + 10}" class="sub">Hover an orbit</text><text x="${px}" y="${legendY(groups.length) + 30}" class="sub">to focus it.</text></g>
${focus}</g>
</g>`;
  return frame({ W, H, theme, fullPage, label: "04 — STACK", aria: `Tech stack: ${groups.map((g) => `${g.name}: ${g.items.join(", ")}`).join("; ")}`, css, body });
}

// 05 — honeycomb of certifications; each hex flips to its back face on hover.
function certifications({ theme, fullPage }) {
  const t = THEMES[theme];
  const list = profile.certifications;
  const H = 340;
  const R = 58;
  const hw = Math.sqrt(3) * R;
  const gap = 7;
  const perRow = Math.ceil(list.length / 2);
  const centers = list.map((_, k) => {
    const row = k < perRow ? 0 : 1;
    const col = row ? k - perRow : k;
    return [96 + col * (hw + gap) + (row ? (hw + gap) / 2 : 0), 152 + row * (1.5 * R + gap)];
  });
  const hex = ([x, y], r) =>
    Array.from({ length: 6 }, (_, n) => {
      const a = (Math.PI / 3) * n - Math.PI / 2;
      return `${(x + r * Math.cos(a)).toFixed(1)},${(y + r * Math.sin(a)).toFixed(1)}`;
    }).join(" ");

  const tiles = list
    .map((c, k) => {
      const [x, y] = centers[k];
      const name = wrap(c.issuer, 10);
      const nameSvg = (cls, y0) => name.map((l, n) => `<text x="${x}" y="${y0 + n * 15}" text-anchor="middle" class="${cls}">${esc(l)}</text>`).join("");
      return (
        `<g class="hx" style="animation-delay:${(0.1 + k * 0.08).toFixed(2)}s">` +
        `<g class="front"><polygon points="${hex([x, y], R)}" class="hf"/>` +
        `<text x="${x}" y="${y - 6}" text-anchor="middle" class="mark">${esc(c.mark)}</text>${nameSvg("cap", y + 18)}</g>` +
        `<g class="back"><polygon points="${hex([x, y], R)}" fill="${t.accent}"/>` +
        `${nameSvg("bk", y - 8 - (name.length - 1) * 7)}` +
        wrap(c.area.toUpperCase(), 11)
          .map((l, n) => `<text x="${x}" y="${y + 14 + (name.length - 1) * 7 + n * 12}" text-anchor="middle" class="bks">${esc(l)}</text>`)
          .join("") +
        `</g></g>`
      );
    })
    .join("\n");
  const shineClip = centers.map((c) => `<polygon points="${hex(c, R)}"/>`).join("");
  const px = 560;
  const areas = wrap(list.map((c) => c.area.toLowerCase()).join(" · "), 34);

  const css = `
  .mark{font:700 20px ${MONO};fill:${t.accent}}
  .hf{fill:${t.raised};stroke:${t.line}}
  .bk{font:700 14px ${SANS};fill:${t.bg}}
  .bks{font:600 9.5px ${MONO};letter-spacing:.1em;fill:${t.bg}}
  .front,.back,.hx{transform-box:fill-box;transform-origin:center}
  .front,.back{transition:transform .18s ease-in}
  .back{transform:scaleX(0)}
  .hx:hover .front{transform:scaleX(0)}
  .hx:hover .back{transform:scaleX(1);transition-delay:.18s;transition-timing-function:ease-out}
  .hx{animation:pop .5s cubic-bezier(.3,1.4,.5,1) both}
  @keyframes pop{from{opacity:0;transform:scale(.6)}to{opacity:1;transform:none}}
  .huge{font:800 72px ${SANS};fill:${t.text};letter-spacing:-2px}`;

  const body = `<defs><linearGradient id="shine" x1="0" x2="1" y1="0" y2="0.3">
<stop offset="0.35" stop-color="#FFFFFF" stop-opacity="0"/><stop offset="0.5" stop-color="#FFFFFF" stop-opacity="${theme === "dark" ? 0.07 : 0.45}"/><stop offset="0.65" stop-color="#FFFFFF" stop-opacity="0"/>
<animateTransform attributeName="gradientTransform" type="translate" values="-1 0;1 0;1 0" keyTimes="0;0.6;1" dur="5s" repeatCount="indefinite"/></linearGradient>
<clipPath id="hexes">${shineClip}</clipPath></defs>
${tiles}
<rect x="0" y="0" width="${px - 40}" height="${H}" fill="url(#shine)" clip-path="url(#hexes)" pointer-events="none"/>
<line x1="${px - 24}" y1="80" x2="${px - 24}" y2="${H - 36}" stroke="${t.line}"/>
<text x="${px}" y="174" class="huge">${String(list.length).padStart(2, "0")}</text>
<text x="${px}" y="204" class="ttl">certifications</text>
${areas.map((l, n) => `<text x="${px}" y="${232 + n * 20}" class="sub">${esc(l)}</text>`).join("")}`;
  return frame({ W, H, theme, fullPage, label: "05 — CERTIFICATIONS", aria: `Certifications: ${list.map((c) => c.issuer).join(", ")}`, css, body });
}

const outDir = process.argv[2] ?? "dist";
for (const [name, render] of Object.entries({ about, hackathons, work, stack, certifications })) {
  await writeVariants({ outDir, name, render });
}
console.log(`wrote about, hackathons, work, stack, certifications to ${outDir}`);
