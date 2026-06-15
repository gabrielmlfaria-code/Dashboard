import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const roots = ["src", "scripts", "test"];
const suspiciousPatterns = [
  /\u00c3[\u0080-\u00bf]/gu,
  /\u00c2[\u0080-\u00bf]/gu,
  /\u00e2[\u0080-\u20ff]/gu,
  /\ufffd/gu,
  /\u00f0[\u0080-\u20ff]/gu,
];
const textExtensions = new Set([
  ".css",
  ".html",
  ".js",
  ".jsx",
  ".json",
  ".md",
  ".mjs",
  ".ts",
  ".tsx",
]);
const fail = process.argv.includes("--fail");
const hits = [];

function extensionOf(file) {
  const index = file.lastIndexOf(".");
  return index >= 0 ? file.slice(index).toLowerCase() : "";
}

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    if ([".git", "dist", "node_modules"].includes(entry)) continue;
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      walk(fullPath);
      continue;
    }
    if (!textExtensions.has(extensionOf(fullPath))) continue;

    const text = readFileSync(fullPath, "utf8");
    const lines = text.split(/\r?\n/);
    lines.forEach((line, index) => {
      if (suspiciousPatterns.some((pattern) => pattern.test(line))) {
        hits.push({
          file: relative(process.cwd(), fullPath),
          line: index + 1,
          text: line.trim().slice(0, 180),
        });
      }
      suspiciousPatterns.forEach((pattern) => {
        pattern.lastIndex = 0;
      });
    });
  }
}

for (const root of roots) {
  try {
    walk(join(process.cwd(), root));
  } catch {
    // Optional roots may not exist in copied workspaces.
  }
}

if (!hits.length) {
  console.log("Nenhum padrao suspeito de encoding encontrado.");
  process.exit(0);
}

console.log(`Possiveis problemas de encoding encontrados: ${hits.length}`);
for (const hit of hits.slice(0, 120)) {
  console.log(`${hit.file}:${hit.line} ${hit.text}`);
}
if (hits.length > 120) {
  console.log(`... ${hits.length - 120} ocorrencia(s) omitida(s).`);
}

if (fail) process.exit(1);
