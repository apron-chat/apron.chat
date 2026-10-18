// Renders PROTOCOL.md from shazow/apron into public/protocol.html, served at
// /protocol, and copies the Markdown to public/protocol.md.
// Run: npm run build
//
// APRON_REF picks the branch, tag or commit to render (default main).
// APRON_PROTOCOL renders a local file instead, such as ../apron/PROTOCOL.md.

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

// The spec and where it came from, pinned to a commit when GitHub says which.
async function source() {
  if (process.env.APRON_PROTOCOL) {
    return { markdown: readFileSync(process.env.APRON_PROTOCOL, "utf8"), label: "local", url: `https://github.com/${repo}` };
  }
  const ref = process.env.APRON_REF || "main";
  // git, not the GitHub API, which rate-limits shared build machines.
  let commit = ref;
  try {
    const refs = new Map(execFileSync("git", ["ls-remote", `https://github.com/${repo}`], { encoding: "utf8" })
      .trim().split("\n").map(line => line.split("\t").reverse()));
    // A branch or tag by its exact name (an annotated tag by its commit); a commit as given.
    commit = refs.get(`refs/heads/${ref}`) ?? refs.get(`refs/tags/${ref}^{}`) ?? refs.get(`refs/tags/${ref}`) ?? ref;
  } catch (error) {
    console.warn(`Rendering ${ref} unpinned: ${error.message}`);
  }
  const markdown = await get(`https://raw.githubusercontent.com/${repo}/${commit}/PROTOCOL.md`);
  const label = /^[0-9a-f]{40}$/.test(commit) ? commit.slice(0, 7) : commit;
  return { markdown, label, url: `https://github.com/${repo}/blob/${commit}/PROTOCOL.md` };
}

function render(markdown) {
  let html = new Marked(gfmHeadingId()).parse(markdown);
  const headings = getHeadingList().filter(heading => heading.level >= 2 && heading.level <= 4);

  // A link on each section heading, to share it.
  html = html.replace(/<h([2-4]) id="([^"]+)">([\s\S]*?)<\/h\1>/g,
    (_, level, id, text) => `<h${level} id="${id}">${text}<a class="anchor" href="#${id}" aria-label="Link to this section">#</a></h${level}>`);
  // Wide tables scroll on their own instead of widening the page.
  html = html.replace(/<table>/g, '<div class="table"><table>').replace(/<\/table>/g, "</table></div>");
  // Dim // comments in code, such as the arrows in examples and the notes in type sketches.
  html = html.replace(/<pre><code([^>]*)>([\s\S]*?)<\/code><\/pre>/g, (_, attrs, code) =>
    `<pre><code${attrs}>${code.replace(/(^|\s)(\/\/(?: .*)?)$/gm, '$1<span class="c">$2</span>')}</code></pre>`);

  const toc = headings.map(heading => `<li class="l${heading.level}"><a href="#${heading.id}">${heading.text}</a></li>`);
  return { html, toc: `<ol>\n${toc.join("\n")}\n</ol>` };
}

const { markdown, label, url } = await source();
const { html, toc } = render(markdown);
const version = markdown.match(/\|\s*Protocol Version\s*\|\s*(\d+)\s*\|/)?.[1] ?? "";
const values = { content: html, toc, version, source: label, source_url: url };
const page = readFileSync(at("templates/protocol.html"), "utf8").replace(/\{\{(\w+)\}\}/g, (_, key) => values[key] ?? "");

writeFileSync(at("public/protocol.html"), page);
writeFileSync(at("public/protocol.md"), markdown);
console.log(`Rendered PROTOCOL.md v${version} from ${repo}@${label} into public/protocol.html`);
