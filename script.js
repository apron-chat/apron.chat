"use strict";

// These illustrative frames follow protocol v8. No connection is opened.
const walkthrough = {
  hello: {
    direction: "SERVER → CLIENT",
    frame: { method: "server", params: { apron: 8, capabilities: ["rooms", "history"], auth: ["guest", "token"] } },
    caption: "The server says hello. It tells you what it supports."
  },
  auth: {
    direction: "CLIENT → SERVER",
    frame: { method: "auth", id: "c1", params: { scheme: "guest", name: "Ada" } },
    caption: "Ask to sign in as a guest. The server assigns your identity in its reply."
  },
  message: {
    direction: "CLIENT → SERVER",
    frame: { method: "message", id: "c2", params: { room_id: "general", body: { text: "Hello, good company." } } },
    caption: "Post to a room after authentication. The server broadcasts the message and confirms its message_id."
  }
};

const tabs = Array.from(document.querySelectorAll('[role="tab"]'));
const panel = document.getElementById("wire-panel");
const code = document.getElementById("wire-code");

function formatFrame(value, depth = 0) {
  if (Array.isArray(value)) return "[" + value.map(item => JSON.stringify(item)).join(", ") + "]";
  if (value !== null && typeof value === "object") {
    const indent = "  ".repeat(depth);
    return "{\n" + Object.entries(value).map(([key, item]) =>
      indent + "  " + JSON.stringify(key) + ": " + formatFrame(item, depth + 1)
    ).join(",\n") + "\n" + indent + "}";
  }
  return JSON.stringify(value);
}

function renderCode(frame) {
  const json = formatFrame(frame);
  const lines = json.split("\n").map(line => {
    const element = document.createElement("span");
    element.className = "line";
    const tokens = /("(?:[^"\\]|\\.)*")(\s*:)?|\b(\d+)\b/g;
    let end = 0;
    for (const match of line.matchAll(tokens)) {
      element.append(document.createTextNode(line.slice(end, match.index)));
      const token = document.createElement("span");
      token.className = match[3] ? "number" : match[2] ? "key" : "string";
      token.textContent = match[1] || match[3];
      element.append(token);
      if (match[2]) element.append(document.createTextNode(match[2]));
      end = match.index + match[0].length;
    }
    element.append(document.createTextNode(line.slice(end)));
    return element;
  });
  code.replaceChildren(...lines);
}

function selectTab(tab, moveFocus = false) {
  const step = walkthrough[tab.dataset.step];
  tabs.forEach(item => {
    const selected = item === tab;
    item.setAttribute("aria-selected", String(selected));
    item.tabIndex = selected ? 0 : -1;
  });
  panel.setAttribute("aria-labelledby", tab.id);
  const direction = document.getElementById("frame-direction");
  const arrow = document.createElement("span");
  arrow.setAttribute("aria-hidden", "true");
  arrow.textContent = tab.dataset.step === "hello" ? "←" : "→";
  direction.replaceChildren(arrow, document.createTextNode(" " + step.direction));
  renderCode(step.frame);
  document.getElementById("frame-caption").textContent = step.caption;
  if (moveFocus) tab.focus();
}

tabs.forEach((tab, index) => {
  tab.addEventListener("click", () => selectTab(tab));
  tab.addEventListener("keydown", event => {
    let next;
    if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
    if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = tabs.length - 1;
    if (next !== undefined) {
      event.preventDefault();
      selectTab(tabs[next], true);
    }
  });
});

document.getElementById("copy-prompt").addEventListener("click", async () => {
  const prompt = document.getElementById("implementation-prompt").textContent.trim();
  const status = document.getElementById("copy-status");
  try {
    await navigator.clipboard.writeText(prompt);
    status.textContent = "Copied. Paste it into your coding assistant.";
  } catch {
    document.querySelector(".prompt-fallback").open = true;
    const range = document.createRange();
    range.selectNodeContents(document.getElementById("implementation-prompt"));
    const selection = window.getSelection();
    if (selection) { selection.removeAllRanges(); selection.addRange(range); }
    status.textContent = "Select and copy the prompt below with your keyboard or device menu.";
  }
});
