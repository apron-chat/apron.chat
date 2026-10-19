// Renders PROTOCOL.md from shazow/apron into public/protocol.html, served at
// /protocol, and copies the Markdown to public/protocol.md. Also writes
// public/index.html from templates/index.html with the spec's version, and
// public/llms-full.txt: public/llms.txt followed by PROTOCOL.md and HISTORY.md.
// Run: npm run build
//
// APRON_REF picks the branch, tag or commit to render (default main).
// APRON_PROTOCOL renders a local file instead, such as ../apron/PROTOCOL.md.
//
// Anything missing fails the build before it writes a file, so a deploy keeps
// the last good site rather than publishing a broken one.

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { Marked } from "marked";
import { gfmHeadingId, getHeadingList } from "marked-gfm-heading-id";

const repo = "shazow/apron";
const at = path => new URL(`../${path}`, import.meta.url);

async function get(url) {
  const response = await fetch(url, { headers: { "User-Agent": "apron.chat-build" } });
  if (!response.ok) throw new Error(`${url}: ${response.status} ${response.statusText}`);
  return response.text();
}

// The spec and where it came from, pinned to a commit.
async function source() {
  if (process.env.APRON_PROTOCOL) {
    const markdown = readFileSync(process.env.APRON_PROTOCOL, "utf8");
    const history = readFileSync(new URL("HISTORY.md", `file://${process.env.APRON_PROTOCOL}`), "utf8");
    return { markdown, history, label: "local", url: `https://github.com/${repo}` };
  }
  const ref = process.env.APRON_REF || "main";
  // git, not the GitHub API, which rate-limits shared build machines.
  const refs = new Map(execFileSync("git", ["ls-remote", `https://github.com/${repo}`], { encoding: "utf8" })
    .trim().split("\n").map(line => line.split("\t").reverse()));
  // A branch or tag by its exact name (an annotated tag by its commit); a commit as given.
  const commit = refs.get(`refs/heads/${ref}`) ?? refs.get(`refs/tags/${ref}^{}`) ?? refs.get(`refs/tags/${ref}`) ??
    (/^[0-9a-f]{7,40}$/.test(ref) ? ref : undefined);
  if (!commit) throw new Error(`No branch, tag or commit named ${ref} in ${repo}`);
  const raw = file => get(`https://raw.githubusercontent.com/${repo}/${commit}/${file}`);
  const [markdown, history] = await Promise.all([raw("PROTOCOL.md"), raw("HISTORY.md")]);
  const label = /^[0-9a-f]{40}$/.test(commit) ? commit.slice(0, 7) : commit;
  return { markdown, history, label, url: `https://github.com/${repo}/blob/${commit}/PROTOCOL.md` };
}

// How much of the spec an implementation reads. Each tier runs from the section
// that starts it to the next tier's, and the first starts at the first section.
// `about` says what the tier is, given its sections, such as "§1–3".
const tiers = [
  { key: "required", name: "Required", about: s => `${s}. Every server implements these, and every client can rely on them.` },
  { key: "optional", name: "Optional", starts: /^\d+\. Capabilities$/,
    about: s => `${s}. Each capability stands alone and says what to do without it. Read the ones you build.` },
  { key: "informative", name: "Informative", starts: /^\d+\. Security considerations$/,
    about: s => `${s}. Background and worked examples. No new rules.` },
  { key: "draft", name: "Draft", starts: /^Appendix [A-Z] — Under consideration$/, about: s => `${s}. Not part of the protocol yet.` },
];

const words = html => html.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
const count = n => n.toLocaleString("en-US");

// Sections by number, such as "§1–3" and "Appendices A–B", or short, "§1–3" and "A–B".
function numbers(sections, short) {
  const span = list => list.length > 1 ? `${list[0]}–${list.at(-1)}` : list[0];
  const numbered = sections.map(s => s.heading.raw.match(/^(\d+)\./)?.[1]).filter(Boolean);
  const lettered = sections.map(s => s.heading.raw.match(/^Appendix ([A-Z])/)?.[1]).filter(Boolean);
  return [
    numbered.length && `§${span(numbered)}`,
    lettered.length && (short ? span(lettered) : `Appendi${lettered.length > 1 ? "ces" : "x"} ${span(lettered)}`),
  ].filter(Boolean).join(short ? ", " : " and ");
}

// A line under each capability's heading: how a server turns it on, what it
// adds and what clients do without it. These come from the table in the
// Capabilities section (| capability | adds | fallback | spec |), and for
// features with no capability, from the list after it.
function capabilities(html) {
  const notes = new Map();
  for (const [, table] of html.matchAll(/<table>([\s\S]*?)<\/table>/g)) {
    const head = [...table.matchAll(/<th>([\s\S]*?)<\/th>/g)].map(m => m[1]);
    if (head.join() !== "capability,adds,fallback,spec") continue;
    for (const [, row] of table.matchAll(/<tr>([\s\S]*?)<\/tr>/g)) {
      const [name, adds, fallback, spec] = [...row.matchAll(/<td>([\s\S]*?)<\/td>/g)].map(m => m[1]);
      const id = spec?.match(/href="#([^"]+)"/)?.[1];
      if (id) notes.set(id, `<span class="how">${name} in <code>server.capabilities</code></span>` +
        `<span><i>Adds</i> ${adds}</span><span><i>Without it</i> ${fallback}</span>`);
    }
  }
  if (!notes.size) throw new Error("No capability table (| capability | adds | fallback | spec |) in the Capabilities section");
  // "<code>server.push</code> enables push (§4.9)." without the reference.
  const list = html.match(/no capability:<\/p>\s*<ul>([\s\S]*?)<\/ul>/)?.[1] ?? "";
  for (const [, item] of list.matchAll(/<li>([\s\S]*?)<\/li>/g)) {
    const text = item.replace(/\s*\([^()]*\)\.?\s*$/, ".");
    for (const [, id] of item.matchAll(/href="#([^"]+)"/g)) if (!notes.has(id)) notes.set(id, `<span class="how">${text}</span>`);
  }
  return notes;
}

function render(markdown) {
  let html = new Marked(gfmHeadingId()).parse(markdown);
  const headings = getHeadingList().filter(heading => heading.level >= 2 && heading.level <= 4);
  if (!headings.some(heading => heading.level === 2)) throw new Error("No sections (## headings) in PROTOCOL.md");

  // A link on each section heading to share it, and on top-level sections a
  // link back to the contents.
  html = html.replace(/<h([2-4]) id="([^"]+)">([\s\S]*?)<\/h\1>/g, (_, level, id, text) =>
    `<h${level} id="${id}">${text}<a class="anchor" href="#${id}" aria-label="Link to this section">#</a>` +
    (level === "2" ? '<a class="up" href="#contents">↑ contents</a>' : "") + `</h${level}>`);
  // Wide tables scroll on their own instead of widening the page.
  html = html.replace(/<table>/g, '<div class="table"><table>').replace(/<\/table>/g, "</table></div>");
  // Dim // comments in code, such as the arrows in examples and the notes in type sketches.
  html = html.replace(/<pre><code([^>]*)>([\s\S]*?)<\/code><\/pre>/g, (_, attrs, code) =>
    `<pre><code${attrs}>${code.replace(/(^|\s)(\/\/(?: .*)?)$/gm, '$1<span class="c">$2</span>')}</code></pre>`);

  // Each top-level section, with its subsections, and the tier it belongs to.
  const sections = [];
  for (const heading of headings) {
    if (heading.level === 2) sections.push({ heading, children: [] });
    else sections.at(-1)?.children.push(heading);
  }
  let start = 0;
  for (const [i, tier] of tiers.entries()) {
    const at = i && sections.findIndex(s => tier.starts.test(s.heading.raw));
    if (i && at <= start) throw new Error(`No "${tier.name}" tier: no section matching ${tier.starts}, or it comes before the "${tiers[i - 1].name}" tier`);
    start = at;
    for (const s of sections.slice(at)) s.tier = tier;
  }

  // The contents go after the title and version table, before the introduction.
  const table = html.indexOf("</table></div>");
  if (table < 0) throw new Error("No version table at the top of PROTOCOL.md");
  const split = table + "</table></div>".length;
  const head = html.slice(0, split);
  // The rest is the introduction, then each top-level section, without the rule before it.
  const [intro, ...parts] = html.slice(split).split(/(?:<hr>\s*)?(?=<h2 id=")/);
  if (parts.length !== sections.length) throw new Error(`Found ${parts.length} sections in PROTOCOL.md but ${sections.length} ## headings`);
  sections.forEach((s, i) => { s.html = parts[i]; s.words = words(parts[i]); });

  const runs = [];
  for (const s of sections) {
    if (runs.at(-1)?.tier === s.tier) runs.at(-1).sections.push(s);
    else runs.push({ tier: s.tier, sections: [s] });
  }
  const total = sections.reduce((n, s) => n + s.words, 0);
  for (const run of runs) {
    run.words = run.sections.reduce((n, s) => n + s.words, 0);
    run.share = `${count(run.words)} words · ${Math.round(100 * run.words / total)}% of the spec`;
  }
  const run = key => runs.find(r => r.tier.key === key);

  // Optional sections: each subsection folds to its heading, a line on what the
  // capability adds, and its length. Without the page's script, they stay open.
  const notes = capabilities(run("optional").sections.map(s => s.html).join(""));
  const note = (id, length) => notes.has(id) || length
    ? `<p class="capability">${notes.get(id) ?? ""}${length ? `<span class="length">${count(length)} words</span>` : ""}</p>` : "";
  for (const s of run("optional").sections) {
    const [top, ...subsections] = s.html.split(/(?=<h3 id=")/);
    s.html = top + subsections.map(sub => {
      const end = sub.indexOf("</h3>") + "</h3>".length;
      const id = sub.match(/^<h3 id="([^"]+)"/)[1];
      const rest = sub.slice(end).replace(/<h4 id="([^"]+)">[\s\S]*?<\/h4>/g, (h4, id) => h4 + note(id));
      return `<details class="fold" open>\n<summary>${sub.slice(0, end)}${note(id, words(sub))}<span class="toggle" aria-hidden="true"></span></summary>\n${rest}</details>\n`;
    }).join("");
  }

  // After the required tier, a note that it's all an implementation needs.
  const required = run("required"), optional = run("optional"), informative = run("informative"), draft = run("draft");
  const checklist = required.sections.flatMap(s => s.children).find(h => /conformance checklist$/i.test(h.raw));
  const finish = `<aside class="finish" aria-labelledby="end-of-required">
<p class="kicker">End of the required spec</p>
<p class="title" id="end-of-required">You have a complete chat.</p>
<p>${numbers(required.sections)} are all a server must implement, and all a client can count on: ${count(required.words)} words, ${Math.round(100 * required.words / total)}% of this page.${checklist ? ` Check your work against the <a href="#${checklist.id}">${checklist.raw.replace(/^[\d.]+ /, "").toLowerCase()}</a>.` : ""}</p>
<p>Everything below is optional. Each capability in ${numbers(optional.sections)} stands alone and says what clients do without it, so read only the ones you build. ${numbers(informative.sections)} explain the rules above and add none. ${numbers(draft.sections)} is not part of the protocol yet.</p>
<p class="links"><a class="button" href="#${optional.sections[0].heading.id}">Choose capabilities ↓</a><a href="#${informative.sections[0].heading.id}">Skip to ${informative.sections[0].heading.raw.replace(/^\d+\. /, "").toLowerCase()}</a></p>
</aside>`;
  const body = intro + runs.map(r => (r === optional ? finish : "") +
    `<div class="tier" data-tier="${r.tier.key}">\n<p class="tier-tab"><b>${r.tier.name}</b><span>${r.tier.about(numbers(r.sections))}</span><span class="share">${r.share}</span></p>\n` +
    r.sections.map(s => s.html).join("") + "</div>\n").join("");

  // Above the contents, the tiers drawn to scale by length.
  const map = `<div class="map">
<div class="map-bar">${runs.map(r => `<a href="#${r.sections[0].heading.id}" data-tier="${r.tier.key}" style="flex-grow: ${r.words}" aria-label="${r.tier.name}: ${r.share}"></a>`).join("")}</div>
<ul>
${runs.map(r => `<li data-tier="${r.tier.key}"><a href="#${r.sections[0].heading.id}"><b>${r.tier.name}</b> <span>${numbers(r.sections, true)}</span></a></li>`).join("\n")}
</ul>
</div>`;

  // The contents: each top-level section, with its subsections nested under it,
  // and each tier's name before its first section. Optional sections list
  // their capabilities, not what's inside them.
  // "Appendix A — Conventions (informative)" is listed as "A. Conventions".
  const item = heading => `<a href="#${heading.id}">${heading.text.replace(/^Appendix ([A-Z]) — (.*?)(?: \(informative\))?$/, "$1. $2")}</a>`;
  const toc = sections.map(({ heading, children, tier }, i) =>
    (sections[i - 1]?.tier === tier ? "" : `<li class="label" data-tier="${tier.key}">${tier.name}</li>\n`) +
    (children.length
      ? `<li data-tier="${tier.key}">${item(heading)}\n<ol>\n${children.map(child =>
        `<li class="l${child.level}${tier.key === "optional" && child.level === 4 ? " folded" : ""}">${item(child)}</li>`).join("\n")}\n</ol></li>`
      : `<li data-tier="${tier.key}">${item(heading)}</li>`));

  return { head, html: body, map, toc: `<ol class="toc">\n${toc.join("\n")}\n</ol>` };
}

const { markdown, history, label, url } = await source();
const { head, html, map, toc } = render(markdown);
// The version table at the top of the spec. Fail rather than publish a page without it.
const version = markdown.match(/\|\s*Protocol Version\s*\|\s*(\d+)\s*\|/)?.[1];
if (!version) throw new Error(`No "| Protocol Version | N |" row in PROTOCOL.md at ${label}`);
if (!history.trim()) throw new Error(`HISTORY.md at ${label} is empty`);
const values = { head, content: html, map, toc, version, source: label, source_url: url };
// A placeholder with no value is a typo in the template, or a value the build failed to make.
const fill = template => readFileSync(at(`templates/${template}`), "utf8").replace(/\{\{(\w+)\}\}/g, (_, key) => {
  if (!values[key]) throw new Error(`templates/${template}: no value for {{${key}}}`);
  return values[key];
});
// llms-full.txt (llmstxt.org): the index, then every document it leads with, in full.
const index = readFileSync(at("public/llms.txt"), "utf8").trimEnd();
const note = `Rendered from ${url}`;
const files = {
  "public/protocol.html": fill("protocol.html"),
  "public/index.html": fill("index.html"),
  "public/protocol.md": markdown,
  "public/llms-full.txt": [index, `<!-- ${note} -->`, markdown.trimEnd(), history.trimEnd()].join("\n\n---\n\n") + "\n",
};
for (const [path, text] of Object.entries(files)) writeFileSync(at(path), text);
console.log(`Rendered PROTOCOL.md v${version} from ${repo}@${label} into public/protocol.html`);
