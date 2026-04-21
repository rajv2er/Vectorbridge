import { cp, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import process from "node:process";

const root = process.cwd();
const vendorRoot = join(root, "extension", "vendor");
const vectorbridgeTarget = join(vendorRoot, "vectorbridge");

await rm(vectorbridgeTarget, { recursive: true, force: true });
await mkdir(vendorRoot, { recursive: true });
await cp(join(root, "dist"), vectorbridgeTarget, { recursive: true });

process.stdout.write("Prepared extension bundle in extension/vendor/vectorbridge\n");
