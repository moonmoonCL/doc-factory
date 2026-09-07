import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = fileURLToPath(new URL("../", import.meta.url));
const output = "skills/doc-factory/scripts/doc-factory.mjs";
const result = await build({
  absWorkingDir: root, entryPoints: ["src/cli.ts"], bundle: true, platform: "node", format: "esm", target: "node22", outfile: output,
  legalComments: "inline", metafile: true, banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
});
const packages = new Set<string>();
for (const input of Object.keys(result.metafile.inputs)) {
  const match = /^(.*node_modules\/(?:@[^/]+\/)?[^/]+)\//u.exec(input);
  if (match) packages.add(match[1]!);
}
const notices = [...packages].sort().map(directory => {
  const absolute = path.join(root, directory);
  const metadata = JSON.parse(fs.readFileSync(path.join(absolute, "package.json"), "utf8")) as { name: string; version: string; license?: string };
  const licenses = fs.readdirSync(absolute).filter(file => /^(?:license|licence|copying|notice)(?:[._-]|$)/iu.test(file) && fs.statSync(path.join(absolute, file)).isFile());
  if (!licenses.length) throw new Error(`No license text found for bundled dependency ${metadata.name}`);
  return [`${metadata.name}@${metadata.version} (${metadata.license ?? "see license text"})`, ...licenses.sort().map(file => fs.readFileSync(path.join(absolute, file), "utf8").trim())].join("\n\n");
});
fs.writeFileSync(path.join(root, "skills/doc-factory/scripts/THIRD_PARTY_NOTICES.txt"), notices.join("\n\n========================================\n\n") + "\n");
console.log(JSON.stringify({ bundle: output, bundledPackages: packages.size }));
