// Paolo: per-agent effort and team leads (an agent with `manages` delegates to its own team).
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const SERVER = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8").split("\r").join("");
const block = (from, to) => { const i = SERVER.indexOf(from); assert.ok(i > -1, "not found: " + from.slice(0, 40)); const j = SERVER.indexOf(to, i + from.length); return SERVER.slice(i, j > -1 ? j : i + 6000); };

test("brainRoute adds --effort only for a valid level on the Claude brain", () => {
  const br = block("function brainRoute(agentId, override) {", "const EFFORT_LEVELS");
  assert.match(br, /EFFORT_LEVELS\.includes\(a\.effort\)/);
  assert.match(br, /provider === "claude"/);
  assert.match(br, /"--effort", eff/);
  assert.match(SERVER, /const EFFORT_LEVELS = \["low", "medium", "high", "xhigh", "max"\];/);
});

test("the registry keeps effort and manages", () => {
  const ra = block('req.url === "/registry/agent") {', '} else if (req.method === "POST" && req.url === "/registry/agent/delete")');
  assert.match(ra, /effort: p\.effort !== undefined/);
  assert.match(ra, /manages: Array\.isArray\(p\.manages\)/);
});

test("a team lead can delegate only to its own team; the Director to anyone", () => {
  const cd = block("function canDelegate(mgr, tgt) {", "\n}\n");
  assert.match(cd, /tgt === "ceo" \|\| tgt === "main" \|\| tgt === mgr/);
  assert.match(cd, /mgr === "main" \? true : managesList\(mgr\)\.includes\(tgt\)/);
  const f = block("function makeDelegateFilter(depth, session, onHit, mgr = \"main\") {", "// Optional QA gate");
  assert.match(f, /if \(tgt && canDelegate\(mgr, tgt\)\)/);
  assert.match(f, /mgr === "main" && ln\.match\(\/\^\\s\*PROJECT:/, "only the Director creates projects");
  assert.match(f, /if \(m && mgr === "main" && \/\^codex\$\/i/, "only the Director calls Codex");
});

test("results go back to whoever delegated", () => {
  assert.match(SERVER, /function reportBack\(mgr, fromId, text, ok, depth, session\) \{\n\s+if \(!mgr \|\| mgr === "main" \|\| !reg\.agents\[mgr\]\) return reportToMain/);
  const rm = block("function reportToManager(", "function reportToMain(");
  assert.match(rm, /makeDelegateFilter\(depth \+ 1, \(\) => keyRef\.key, \(\) => \{ dele\.hit = true; \}, mgr\)/);
  assert.match(rm, /reportBack\(up\.mgr, mgr,/);
});
