# apron.chat

A dependency-free landing page for the Apron Chat Protocol, intended for https://github.com/apron-chat/apron.chat.

## Run locally

From this directory:

```sh
python3 -m http.server 8080
```

Open http://localhost:8080. There is no install or build step. The page also works as a local HTML file; clipboard access may require HTTPS or localhost, and a selectable prompt is provided as a fallback.

## Deploy

Serve this directory with any static host. For GitHub Pages, publish the repository root. Include index.html, style.css, script.js, favicon.svg, llms.txt, and PROTOCOL.md. All asset links are relative so the site also works under a repository subpath. No secrets, server, external fonts, analytics, or third-party scripts are needed.

## Content

Copy was grounded in shazow/apron README.md and PROTOCOL.md (version 8), retrieved 2026-10-18. PROTOCOL.md is an unmodified local snapshot; upstream remains authoritative. Refresh the snapshot and version labels together when the protocol changes. Appendix C proposals are not advertised as stable features.

The page links directly to the live demo, protocol specification, Go and Cloudflare servers, web client, and pull request bot. The wire walkthrough is illustrative and opens no live connection. Its tabs support arrow keys, Home, and End. Content and navigation work without JavaScript.

Website source: https://github.com/apron-chat/apron.chat
Protocol source: https://github.com/shazow/apron
License: MIT (retained from the destination repository).
