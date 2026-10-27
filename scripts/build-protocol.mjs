// Renders PROTOCOL.md from shazow/apron into public/protocol.html, served at
// /protocol, and copies the Markdown to public/protocol.md with each section's
// id in a comment above its heading. Also writes public/index.html from
// templates/index.html with the spec's version and FAQ.md's questions, and
// public/llms-full.txt: public/llms.txt followed by PROTOCOL.md and HISTORY.md.
// Run: npm run build
//
// APRON_REF picks the branch, tag or commit to render (default main).
// APRON_PROTOCOL renders a local file instead, such as ../apron/PROTOCOL.md,
// with the HISTORY.md and FAQ.md beside it.
//
// Anything missing fails the build before it writes a file, so a deploy keeps
// the last good site rather than publishing a broken one.

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { Marked } from "marked";
import { gfmHeadingId, getHeadingList } from "marked-gfm-heading-id";
import hljs from "highlight.js/lib/core";
import json from "highlight.js/lib/languages/json";
import typescript from "highlight.js/lib/languages/typescript";

const repo = "shazow/apron";
const at = path => new URL(`../${path}`, import.meta.url);

// The languages the spec's code blocks use: json and jsonc, and ts.
hljs.registerLanguage("json", json);
hljs.registerLanguage("typescript", typescript);
// Code blocks colored by highlight.js, at build time. A block in another
// language is left plain.
const escape = text => text.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const highlight = { renderer: { code({ text, lang }) {
  const code = lang && hljs.getLanguage(lang) ? hljs.highlight(text, { language: lang }).value : escape(text);
  return `<pre><code${lang ? ` class="language-${escape(lang)}"` : ""}>${code}</code></pre>\n`;
} } };

async function get(url) {
  const response = await fetch(url, { headers: { "User-Agent": "apron.chat-build" } });
  if (!response.ok) throw new Error(`${url}: ${response.status} ${response.statusText}`);
  return response.text();
}

// The spec and where it came from, pinned to a commit.
async function source() {
  if (process.env.APRON_PROTOCOL) {
    const markdown = readFileSync(process.env.APRON_PROTOCOL, "utf8");
    const beside = file => readFileSync(join(dirname(process.env.APRON_PROTOCOL), file), "utf8");
    const main = `https://github.com/${repo}/blob/main`;
    return { markdown, history: beside("HISTORY.md"), faq: beside("FAQ.md"), label: "local", url: `https://github.com/${repo}`,
      historyUrl: `${main}/HISTORY.md`, faqUrl: `${main}/FAQ.md` };
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
  const [markdown, history, faq] = await Promise.all([raw("PROTOCOL.md"), raw("HISTORY.md"), raw("FAQ.md")]);
  const label = /^[0-9a-f]{40}$/.test(commit) ? commit.slice(0, 7) : commit;
  const blob = `https://github.com/${repo}/blob/${commit}`;
  return { markdown, history, faq, label, url: `${blob}/PROTOCOL.md`, historyUrl: `${blob}/HISTORY.md`,
    // The FAQ by the name it was asked for, such as main, so links from the landing page stay readable.
    faqUrl: `https://github.com/${repo}/blob/${ref}/FAQ.md` };
}

// How much of the spec an implementation reads. Each tier runs from the section
// that starts it to the next tier's, and the first starts at the first section.
const tiers = [
  { key: "required", name: "Required" },
  { key: "optional", name: "Optional", starts: /^\d+\. Capabilities$/ },
  { key: "informative", name: "Informative", starts: /^\d+\. Security considerations$/ },
  { key: "draft", name: "Draft", starts: /^Appendix [A-Z] — Under consideration$/ },
];

const words = html => html.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
const count = n => n.toLocaleString("en-US");

// Sections by number, such as "§1–3" or "§5, A–B".
function numbers(sections) {
  const span = list => list.length > 1 ? `${list[0]}–${list.at(-1)}` : list[0];
  const numbered = sections.map(s => s.heading.raw.match(/^(\d+)\./)?.[1]).filter(Boolean);
  const lettered = sections.map(s => s.heading.raw.match(/^Appendix ([A-Z])/)?.[1]).filter(Boolean);
  return [numbered.length && `§${span(numbered)}`, lettered.length && span(lettered)].filter(Boolean).join(", ");
}

// A line under each capability's heading: what it adds and what clients do
// without it, from the table in the Capabilities section
// (| capability | adds | fallback | spec |). For features with no capability,
// how a server turns them on, from the list after it.
function capabilities(html) {
  const notes = new Map();
  for (const [, table] of html.matchAll(/<table>([\s\S]*?)<\/table>/g)) {
    const head = [...table.matchAll(/<th>([\s\S]*?)<\/th>/g)].map(m => m[1]);
    if (head.join() !== "capability,adds,fallback,spec") continue;
    for (const [, row] of table.matchAll(/<tr>([\s\S]*?)<\/tr>/g)) {
      const [, adds, fallback, spec] = [...row.matchAll(/<td>([\s\S]*?)<\/td>/g)].map(m => m[1]);
      const id = spec?.match(/href="#([^"]+)"/)?.[1];
      if (id) notes.set(id, `<span class="adds"><i>Adds</i> ${adds}</span><span><i>Without it</i> ${fallback}</span>`);
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

// The spec's front matter: "key: value" lines between --- rules, and the
// Markdown after it. A spec from before front matter has none, and a
// | Protocol Version | N | table under its title instead.
function frontMatter(markdown) {
  const match = markdown.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) return { meta: {}, body: markdown };
  const meta = {};
  for (const line of match[1].split("\n")) {
    const [, key, value] = line.match(/^(\w+): (.+)$/) ?? [];
    if (!key) throw new Error(`Front matter line "${line}" in PROTOCOL.md is not "key: value"`);
    meta[key] = value;
  }
  return { meta, body: markdown.slice(match[0].length) };
}

// The Markdown with each heading's id from the page in a comment above it,
// such as <!-- #a4-links -->, so an agent reading /protocol.md can find the
// section a /protocol#a4-links link names.
function anchored(markdown) {
  new Marked(gfmHeadingId()).parse(markdown);
  const ids = getHeadingList().map(heading => heading.id);
  const tokens = new Marked().lexer(markdown);
  if (tokens.map(token => token.raw).join("") !== markdown) throw new Error("PROTOCOL.md's tokens don't add up to the file");
  const headings = tokens.filter(token => token.type === "heading");
  // A heading inside a list or quote would put every id after it on the wrong section.
  if (headings.length !== ids.length) throw new Error(`Found ${ids.length} headings in PROTOCOL.md but ${headings.length} at the top level`);
  return tokens.map(token => (token.type === "heading" ? `<!-- #${ids.shift()} -->\n` : "") + token.raw).join("");
}

function render(markdown, history, historyUrl) {
  let html = new Marked(gfmHeadingId(), highlight).parse(markdown);
  const headings = getHeadingList().filter(heading => heading.level >= 2 && heading.level <= 4);
  if (!headings.some(heading => heading.level === 2)) throw new Error("No sections (## headings) in PROTOCOL.md");

  // A link on each section heading to share it, and on top-level sections a
  // link back to the contents.
  html = html.replace(/<h([2-4]) id="([^"]+)">([\s\S]*?)<\/h\1>/g, (_, level, id, text) =>
    `<h${level} id="${id}">${text}<a class="anchor" href="#${id}" aria-label="Link to this section">#</a>` +
    (level === "2" ? '<a class="up" href="#contents">↑ contents</a>' : "") + `</h${level}>`);
  // Wide tables scroll on their own instead of widening the page.
  html = html.replace(/<table>/g, '<div class="table"><table>').replace(/<\/table>/g, "</table></div>");
  // Bold the requirement keywords: MUST and MUST NOT in color, SHOULD and
  // SHOULD NOT plain. MAY stays as it is. Code and tags are left alone.
  html = html.replace(/(<pre>[\s\S]*?<\/pre>|<code>[\s\S]*?<\/code>|<[^>]+>)|\b(MUST|SHOULD)( NOT)?\b/g, (_, skip, word, not = "") =>
    skip ?? `<strong class="${word.toLowerCase()}">${word}${not}</strong>`);

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

  // The contents go after the title, and an older spec's version table under
  // it, before the introduction. Under the title, a link to HISTORY.md names
  // its newest entry.
  const title = html.match(/^[\s\S]*?<\/h1>\s*(?:<div class="table">[\s\S]*?<\/table><\/div>)?/)?.[0];
  if (!title) throw new Error("No title (# heading) in PROTOCOL.md");
  const split = title.length;
  const latest = history.match(/^## (v\d+ \(.*?\))$/m)?.[1];
  if (!latest) throw new Error("No ## vN (date) entry in HISTORY.md");
  const head = title + `<a class="history" href="${escape(historyUrl)}" target="_blank" rel="noopener"><span class="label">Protocol History</span> <b>${escape(latest)}</b><span class="go">HISTORY.md →</span></a>\n`;
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
  const note = id => notes.has(id) ? `<p class="capability">${notes.get(id)}</p>` : "";
  for (const s of run("optional").sections) {
    const [top, ...subsections] = s.html.split(/(?=<h3 id=")/);
    s.html = top + subsections.map(sub => {
      const end = sub.indexOf("</h3>") + "</h3>".length;
      const id = sub.match(/^<h3 id="([^"]+)"/)[1];
      const rest = sub.slice(end).replace(/<h4 id="([^"]+)">[\s\S]*?<\/h4>/g, (h4, id) => h4 + note(id));
      return `<details class="fold" open>\n<summary>${sub.slice(0, end)}${note(id)}<span class="bar"><span class="toggle" aria-hidden="true"></span><span class="length">${count(words(sub))} words</span></span></summary>\n${rest}</details>\n`;
    }).join("");
  }

  // Each tier under a tab that names it, with its length.
  const body = intro + runs.map(r =>
    `<div class="tier" data-tier="${r.tier.key}">\n<p class="tier-tab"><b>${r.tier.name}</b><span class="share">${r.share}</span></p>\n` +
    r.sections.map(s => s.html).join("") + "</div>\n").join("");

  // Above the contents, the tiers drawn to scale by length.
  const map = `<div class="map">
<div class="map-bar">${runs.map(r => `<a href="#${r.sections[0].heading.id}" data-tier="${r.tier.key}" style="flex-grow: ${r.words}" aria-label="${r.tier.name}: ${r.share}"></a>`).join("")}</div>
<ul>
${runs.map(r => `<li data-tier="${r.tier.key}"><a href="#${r.sections[0].heading.id}"><b>${r.tier.name}</b> <span>${numbers(r.sections)}</span></a></li>`).join("\n")}
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

// The landing page's FAQ: each question (## heading) in FAQ.md, linked to its
// answer on GitHub, whose heading ids the slugger in marked-gfm-heading-id matches.
function questions(faq, faqUrl) {
  new Marked(gfmHeadingId()).parse(faq);
  const list = getHeadingList().filter(heading => heading.level === 2);
  if (!list.length) throw new Error("No questions (## headings) in FAQ.md");
  return `<ul class="faq">\n${list.map(q => `<li><a href="${escape(faqUrl)}#${q.id}">${q.text}</a></li>`).join("\n")}\n</ul>`;
}

const { markdown, history, faq, label, url, historyUrl, faqUrl } = await source();
const { meta, body } = frontMatter(markdown);
const { head, html, map, toc } = render(body, history, historyUrl);
// The spec with its section ids, after the front matter, for agents.
const spec = markdown.slice(0, markdown.length - body.length) + anchored(body);
// The version, from the front matter (or an older spec's version table). Fail
// rather than publish a page without it.
const version = meta.version ?? markdown.match(/\|\s*Protocol Version\s*\|\s*(\d+)\s*\|/)?.[1];
if (!/^\d+$/.test(version ?? "")) throw new Error(`No "version: N" in PROTOCOL.md's front matter at ${label}`);
const values = { head, content: html, map, toc, version, faq: questions(faq, faqUrl), faq_url: faqUrl, source: label, source_url: url };
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
  "public/protocol.md": spec,
  "public/llms-full.txt": [index, `<!-- ${note} -->`, spec.trimEnd(), history.trimEnd()].join("\n\n---\n\n") + "\n",
};
for (const [path, text] of Object.entries(files)) writeFileSync(at(path), text);
console.log(`Rendered PROTOCOL.md v${version} from ${repo}@${label} into public/protocol.html`);
