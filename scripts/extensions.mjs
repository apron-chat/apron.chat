// Renders EXTENSIONS.md and each extension it lists, from shazow/apron's
// extensions/, into the /extensions page and its Markdown. Called by
// build-protocol.mjs, which fetches the files.
//
// Like the spec, anything missing fails the build: an index with no list of
// extensions, or an extension whose heading isn't its capability.

import { Marked } from "marked";
import { gfmHeadingId, getHeadingList } from "marked-gfm-heading-id";

const escape = text => text.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const words = html => html.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
const count = n => n.toLocaleString("en-US");
const plain = html => html.replace(/<[^>]+>/g, "");

// The files that EXTENSIONS.md links to, in its order, such as ["ext_bio.md"].
export function extensionFiles(index) {
  const files = [...new Set([...index.matchAll(/\]\(extensions\/(ext_\w+\.md)\)/g)].map(([, file]) => file))];
  if (!files.length) throw new Error("No extensions (links to extensions/ext_*.md) in EXTENSIONS.md");
  return files;
}

// "ext_auth_external.md" is ext:auth_external, at #ext-auth_external.
const capability = file => `ext:${file.replace(/^ext_|\.md$/g, "")}`;
const anchor = file => capability(file).replace(":", "-");

// Points each link in an extension's Markdown (or the index's, with no file)
// where it leads from apron.chat: the spec to /protocol, another extension to
// its section here, a heading in the same file to its prefixed id, and
// anything else in the repository to GitHub. site is "/" for the page and
// "https://apron.chat/" for the Markdown.
function relink(markdown, { file, site, blob }) {
  return markdown.replace(/\]\(([^)\s]+)\)/g, (link, target) => {
    if (/^[a-z]+:/.test(target)) return link;
    if (target.startsWith("#")) return file ? `](#${anchor(file)}-${target.slice(1)})` : link;
    const [, relative, hash = ""] = target.match(/^([^#]*)(#.*)?$/);
    const path = file ? new URL(relative, "https://x/extensions/").pathname.slice(1) : relative;
    if (path === "PROTOCOL.md") return `](${site}protocol${hash})`;
    const other = path.match(/^extensions\/(ext_\w+\.md)$/);
    if (other) return `](#${anchor(other[1])})`;
    // A folder, such as extensions/, under tree/ rather than blob/.
    return `](${path.endsWith("/") ? blob.replace(/\/blob\//, "/tree/") : blob}/${path}${hash})`;
  });
}

// The spec's sections that a piece of Markdown links to, in order, as
// [id, "§3.3 Identity"], from its links such as [§3.3](../PROTOCOL.md#33-identity).
function specLinks(markdown, titles) {
  const ids = [...new Set([...markdown.matchAll(/\]\((?:\.\.\/)?PROTOCOL\.md#([^)\s]+)\)/g)].map(([, id]) => id))];
  for (const id of ids) if (!titles.has(id)) console.warn(`Warning: an extension links to PROTOCOL.md#${id}, which has no heading`);
  return ids.filter(id => titles.has(id)).map(id => [id, `§${titles.get(id).replace(/`/g, "")}`]);
}

// Where an extension's data lives, from the comment on each class in its ts
// block, such as `class Media { // server.ext.media`.
const places = markdown => [...new Set([...markdown.matchAll(/^class \w+ \{\s*\/\/ ([^,\n]+)/gm)].map(([, place]) => place.trim()))];

// The same touches the spec's page gets: a link on each heading, scrolling
// tables, and the requirement keywords in bold.
function polish(html) {
  html = html.replace(/<h([2-4]) id="([^"]+)">([\s\S]*?)<\/h\1>/g, (_, level, id, text) =>
    `<h${level} id="${id}">${text}<a class="anchor" href="#${id}" aria-label="Link to this section">#</a></h${level}>`);
  html = html.replace(/<table>/g, '<div class="table"><table>').replace(/<\/table>/g, "</table></div>");
  html = html.replace(/(<pre>[\s\S]*?<\/pre>|<code>[\s\S]*?<\/code>|<[^>]+>)|\b(MUST|SHOULD)( NOT)?\b/g, (_, skip, word, not = "") =>
    skip ?? `<strong class="${word.toLowerCase()}">${word}${not}</strong>`);
  // What clients and servers do without the extension, marked so it can be
  // found at a glance.
  return html.replace(/<(li|p)>(Without )/g, '<$1 class="fallback">$2');
}

// One extension: its section on the page, its entry in the contents, and its
// Markdown with its headings a level down and their ids in a comment above.
function extension(file, markdown, { highlight, titles, blob }) {
  const id = anchor(file);
  const tokens = new Marked().lexer(markdown);
  const [title] = tokens;
  if (title?.type !== "heading" || title.depth !== 1 || title.text !== `\`${capability(file)}\``)
    throw new Error(`extensions/${file} doesn't start with its capability as its heading: # \`${capability(file)}\``);

  // The page: the heading and the line under it are drawn by the page, then the rest.
  const local = relink(markdown, { file, site: "/", blob });
  let html = new Marked(gfmHeadingId(), highlight).parse(local);
  const headings = getHeadingList();
  html = html.replace(/^<h1[^>]*>[\s\S]*?<\/h1>\s*/, "");
  const lead = html.match(/^<p>([\s\S]*?)<\/p>\s*/);
  if (!lead) throw new Error(`extensions/${file} has no sentence under its heading`);
  html = html.slice(lead[0].length);
  // Its ## sections are subsections of the page, with ids under the extension's.
  html = html.replace(/<h2 id="([^"]+)">([\s\S]*?)<\/h2>/g, (_, sub, text) => `<h3 id="${id}-${sub}">${text}</h3>`);
  const subsections = headings.filter(h => h.level === 2).map(h => ({ id: `${id}-${h.id}`, text: h.text }));
  html = polish(html);

  const builds = specLinks(markdown, titles);
  const data = places(markdown);
  const length = words(lead[1] + html);
  const meta = [
    builds.length && `<span class="builds"><i>Builds on</i> ${builds.map(([to, label]) => `<a href="/protocol#${to}">${escape(label)}</a>`).join(" ")}</span>`,
    data.length && `<span class="data"><i>Data in</i> ${data.map(place => `<code>${escape(place)}</code>`).join(" ")}</span>`,
  ].filter(Boolean).join("");
  const section = `<section class="extension" aria-labelledby="${id}">
<h2 id="${id}"><code>${capability(file)}</code><a class="anchor" href="#${id}" aria-label="Link to this extension">#</a><a class="up" href="#contents">↑ contents</a></h2>
<p class="ext-lead">${lead[1]}</p>
${meta ? `<p class="ext-meta">${meta}</p>\n` : ""}${html}<p class="ext-source"><a href="${escape(blob)}/extensions/${file}">extensions/${file}</a> · ${count(length)} words</p>
</section>\n`;

  // The Markdown, headed by the extension's id as the spec's is.
  const site = relink(markdown, { file, site: "https://apron.chat/", blob });
  new Marked(gfmHeadingId()).parse(site);
  const ids = getHeadingList().map(h => h.level === 1 ? id : `${id}-${h.id}`);
  const text = new Marked().lexer(site).map(token =>
    token.type === "heading" ? `<!-- #${ids.shift()} -->\n${token.raw.replace(/^#+/, m => m + "#")}` : token.raw).join("");

  return { file, id, name: capability(file), section, subsections, data, length, text };
}

// The index's catalog as cards: each extension's name, the line on it from
// EXTENSIONS.md (with its links flattened, since the card is a link), where
// its data lives, and its length.
function cards(list, extensions) {
  return `<ul class="ext-cards">\n${extensions.map(ext => {
    const item = list.items.find(item => item.raw.includes(`(#${ext.id})`));
    if (!item) throw new Error(`EXTENSIONS.md lists no line for ${ext.name}`);
    const desc = new Marked().parseInline(item.text.replace(/^\[[^\]]*\]\([^)]*\):\s*/, "")).replace(/<\/?a\b[^>]*>/g, "");
    return `<li><a class="ext-card" href="#${ext.id}"><code class="name">${ext.name}</code>` +
      `<span class="desc">${desc}</span>` +
      `<span class="foot">${ext.data.length ? `<span class="data">${ext.data.map(place => `<code>${escape(place)}</code>`).join(" ")}</span>` : ""}<span class="length">${count(ext.length)} words</span></span></a></li>`;
  }).join("\n")}\n</ul>`;
}

// The whole page's parts for templates/extensions.html, and its Markdown.
// index is EXTENSIONS.md, files maps each file it lists to its Markdown, and
// titles maps each of the spec's heading ids to its text.
export function renderExtensions({ index, files, titles, highlight, blob }) {
  const extensions = extensionFiles(index).map(file => extension(file, files.get(file), { highlight, titles, blob }));

  // EXTENSIONS.md: its title, an introduction and the general rules, then a
  // paragraph that leads into the list of extensions, which the cards replace.
  const local = relink(index, { site: "/", blob });
  const tokens = new Marked().lexer(local);
  const title = tokens.find(token => token.type === "heading" && token.depth === 1);
  const at = tokens.findIndex(token => token.type === "list" && /\]\(#ext-/.test(token.raw));
  if (!title || at < 0) throw new Error("EXTENSIONS.md has no title, or no list of extensions");
  const body = tokens.slice(tokens.indexOf(title) + 1, at).filter(token => token.type !== "space");
  const lead = body.at(-1)?.type === "paragraph" ? body.pop() : null;
  let intro = polish(new Marked(highlight).parser(body));
  // The rules that apply to every extension, set apart from the introduction.
  intro = intro.replace(/<ul>([\s\S]*?)<\/ul>/, '<div class="ext-rules"><p class="ext-rules-title">Every extension</p>\n<ul>$1</ul></div>');
  const caption = lead ? new Marked().parseInline(lead.text) : "";

  const total = extensions.reduce((n, ext) => n + ext.length, 0);
  const contents = `<p class="contents-title">${extensions.length} extensions · ${count(total)} words</p>
${caption ? `<p class="ext-caption">${caption}</p>\n` : ""}${cards(tokens[at], extensions)}`;

  // The contents in the bar's dropdown: each extension, with its sections.
  const toc = `<ol class="toc ext-toc">\n${extensions.map(ext =>
    `<li><a href="#${ext.id}"><code>${ext.name}</code></a>${ext.subsections.length
      ? `\n<ol>\n${ext.subsections.map(s => `<li class="l3"><a href="#${s.id}">${s.text}</a></li>`).join("\n")}\n</ol>` : ""}</li>`).join("\n")}\n</ol>`;

  // The Markdown: the index, then each extension, with its links pointed at
  // apron.chat or the sections below.
  const markdown = [relink(index, { site: "https://apron.chat/", blob }).trimEnd(),
    ...extensions.map(ext => ext.text.trimEnd())].join("\n\n---\n\n") + "\n";

  return {
    title: plain(new Marked().parseInline(title.text)),
    intro,
    contents,
    sections: extensions.map(ext => ext.section).join(""),
    toc,
    markdown,
    ids: extensions.map(ext => `#${ext.id}`).join(" "),
  };
}
