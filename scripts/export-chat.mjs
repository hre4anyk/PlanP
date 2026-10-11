#!/usr/bin/env node
// Lists your local Claude Code sessions, lets you pick one, and saves it
// as a plain-text file you can upload to the ACDC AI website.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import readline from "node:readline";

const args = process.argv.slice(2);
function argValue(name, fallback) {
  const i = args.indexOf(name);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
}
const outDir = argValue("--out", path.join(os.homedir(), "Desktop"));
const projectsDir = path.join(os.homedir(), ".claude", "projects");

function decodeProjectDir(name) {
  // Folder names are lossily encoded (both "/" and " " become "-"), so this
  // is an approximate, human-readable label rather than an exact path.
  return (name.startsWith("-") ? name.slice(1) : name).replaceAll("-", " / ");
}

function readMessages(filePath) {
  const lines = fs.readFileSync(filePath, "utf8").split("\n").filter(Boolean);
  const messages = [];
  for (const line of lines) {
    let d;
    try {
      d = JSON.parse(line);
    } catch {
      continue;
    }
    if (d.type === "user" || d.type === "assistant") messages.push(d);
  }
  return messages;
}

function firstUserText(messages) {
  for (const m of messages) {
    if (m.type !== "user") continue;
    const content = m.message?.content;
    if (typeof content === "string") return content.replace(/\s+/g, " ").trim();
    if (Array.isArray(content)) {
      const t = content.find((c) => c.type === "text");
      if (t?.text) return t.text.replace(/\s+/g, " ").trim();
    }
  }
  return "(no readable first message)";
}

function blockToText(block) {
  if (block.type === "text") return block.text;
  if (block.type === "tool_use") return `[used tool: ${block.name}]`;
  return null; // skip thinking, tool_result (raw output), etc.
}

function messageToText(m) {
  const role = m.message?.role === "assistant" ? "Assistant" : "You";
  const content = m.message?.content;
  let text = "";
  if (typeof content === "string") text = content;
  else if (Array.isArray(content)) text = content.map(blockToText).filter(Boolean).join("\n");
  text = text.trim();
  return text ? `${role}:\n${text}\n` : null;
}

function loadSessions() {
  const sessions = [];
  if (!fs.existsSync(projectsDir)) return sessions;
  for (const projectName of fs.readdirSync(projectsDir)) {
    const projectPath = path.join(projectsDir, projectName);
    if (!fs.statSync(projectPath).isDirectory()) continue;
    for (const file of fs.readdirSync(projectPath)) {
      if (!file.endsWith(".jsonl")) continue;
      const filePath = path.join(projectPath, file);
      const stat = fs.statSync(filePath);
      if (stat.size === 0) continue;
      sessions.push({ projectName, filePath, mtime: stat.mtime });
    }
  }
  return sessions.sort((a, b) => b.mtime - a.mtime);
}

const rl = readline.createInterface({ input: process.stdin });
const lines = rl[Symbol.asyncIterator]();

async function ask(prompt, max) {
  process.stdout.write(prompt);
  const { value = "" } = await lines.next();
  const n = Number(value.trim());
  if (!Number.isInteger(n) || n < 1 || n > max) {
    console.error("Not a valid number. Run the command again.");
    process.exit(1);
  }
  return n;
}

// Remembers, per session, the timestamp of the last message already exported,
// so a growing session can be exported in parts ("only what's new").
const statePath = path.join(os.homedir(), ".acdc-export-state.json");
function loadState() {
  try {
    return JSON.parse(fs.readFileSync(statePath, "utf8"));
  } catch {
    return {};
  }
}

function fmt(iso) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function stamp(date) {
  const p = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}-${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}`;
}

const sessions = loadSessions().slice(0, 20);
if (sessions.length === 0) {
  console.log("No Claude Code sessions found on this computer yet.");
  process.exit(0);
}

const state = loadState();
console.log("Your recent Claude Code sessions (most recent first):\n");
const loaded = sessions.map((s) => {
  const messages = readMessages(s.filePath).filter((m) => messageToText(m));
  const id = path.basename(s.filePath, ".jsonl");
  const last = state[id];
  const newCount = last ? messages.filter((m) => m.timestamp > last).length : messages.length;
  return { ...s, id, messages, last, newCount };
});
loaded.forEach((s, i) => {
  const preview = firstUserText(s.messages);
  const started = s.messages[0]?.timestamp;
  console.log(`${i + 1}. [${started ? fmt(started) : "?"} → ${fmt(s.mtime.toISOString())}] ${decodeProjectDir(s.projectName)}`);
  console.log(`   "${preview.slice(0, 70)}${preview.length > 70 ? "…" : ""}"`);
  console.log(
    s.last
      ? `   Exported before (up to ${fmt(s.last)}) — ${s.newCount} new messages since`
      : `   Never exported — ${s.messages.length} messages`,
  );
});

const chosen = loaded[(await ask(`\nWhich session? Type a number (1-${loaded.length}): `, loaded.length)) - 1];

let messages = chosen.messages;
let partial = false;
if (chosen.last) {
  if (chosen.newCount === 0) {
    console.log("\nNothing new since your last export. Keep working in that chat, then run this again.");
    process.exit(0);
  }
  console.log(`\n1. Only the new part (${chosen.newCount} messages since ${fmt(chosen.last)}) — best for a new slot`);
  console.log(`2. The whole session (${chosen.messages.length} messages) — to replace an existing slot`);
  if ((await ask("Type 1 or 2: ", 2)) === 1) {
    messages = chosen.messages.filter((m) => m.timestamp > chosen.last);
    partial = true;
  }
}

const from = messages[0].timestamp;
const to = messages[messages.length - 1].timestamp;
const header = `Claude Code session — ${decodeProjectDir(chosen.projectName)}\nPeriod: ${fmt(from)} → ${fmt(to)}${partial ? " (continuation of an earlier export)" : ""}\n\n`;
const transcript = header + messages.map(messageToText).join("\n");

fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, `claude-chat-${stamp(new Date())}${partial ? "-new-part" : ""}.txt`);
fs.writeFileSync(outPath, transcript, "utf8");

const latest = chosen.messages[chosen.messages.length - 1].timestamp;
fs.writeFileSync(statePath, JSON.stringify({ ...state, [chosen.id]: latest }, null, 2));

console.log(`\nSaved to: ${outPath}`);
console.log(`Covers ${fmt(from)} → ${fmt(to)}, ${messages.length} messages.`);
console.log("Upload that file on the ACDC AI website under 'AI work'.");
rl.close();
