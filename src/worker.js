// Serves Markdown to agents that ask for it. A request for / or /protocol
// that prefers text/markdown or text/plain over text/html gets llms.txt or
// the spec's Markdown; everything else is the static site in public/.
// wrangler.jsonc runs this only for those two paths.

const markdown = {
  "/": "/llms.txt",
  "/protocol": "/protocol.md",
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const source = markdown[url.pathname];
    if (!source) return env.ASSETS.fetch(request);

    const type = preferredText(request.headers.get("Accept"));
    const response = await env.ASSETS.fetch(type ? new Request(new URL(source, url), request) : request);
    const headers = new Headers(response.headers);
    headers.append("Vary", "Accept");
    if (type && response.ok) headers.set("Content-Type", `${type}; charset=utf-8`);
    return new Response(response.body, { status: response.status, headers });
  },
};

// The text type an Accept header ranks above HTML: text/markdown (for either
// Markdown type) or text/plain, else null. A wildcard counts for neither, so
// browsers and plain `curl` get HTML. On a tie, the type listed first wins.
export function preferredText(accept) {
  if (!accept) return null;
  let text = { q: 0, at: Infinity };
  let html = { q: 0, at: Infinity };
  accept.split(",").forEach((part, at) => {
    const [type, ...params] = part.trim().toLowerCase().split(";");
    const qParam = params.map(p => p.trim()).find(p => p.startsWith("q="));
    const q = qParam ? Number(qParam.slice(2)) || 0 : 1;
    const entry = { q, at, type: type.trim() === "text/plain" ? "text/plain" : "text/markdown" };
    if (["text/markdown", "text/x-markdown", "text/plain"].includes(type.trim())) {
      if (q > text.q || (q === text.q && at < text.at)) text = entry;
    } else if (["text/html", "application/xhtml+xml"].includes(type.trim())) {
      if (q > html.q || (q === html.q && at < html.at)) html = entry;
    }
  });
  return text.q > 0 && (text.q > html.q || (text.q === html.q && text.at < html.at)) ? text.type : null;
}
