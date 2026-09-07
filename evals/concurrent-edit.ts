import fs from "node:fs";
import path from "node:path";

const runRoot = path.resolve(process.argv[2] ?? "");
if (!fs.existsSync(path.join(runRoot, "mutations.json"))) throw new Error("Run the fixture mutation first");
const file = path.join(runRoot, "partial-docs/docs/configuration.md");
const note = "Maintainer note: retain deterministic coverage when changing the size method.";
const before = fs.readFileSync(file, "utf8");
if (before.includes(note)) throw new Error("Concurrent edit already injected");
fs.appendFileSync(file, `\n${note}\n`);
console.log(JSON.stringify({ file, action: "Appended a human edit after the Agent read its draft baseline" }));
