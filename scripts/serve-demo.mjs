import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import process from "node:process";

const root = process.cwd();
const port = 4173;

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

createServer(async (request, response) => {
  try {
    if (request.url === "/") {
      response.writeHead(302, { Location: "/demo/index.html" });
      response.end();
      return;
    }
    const safePath = normalize(request.url).replace(/^(\.\.[/\\])+/, "");
    const filePath = join(root, safePath);
    const body = await readFile(filePath);
    const contentType = contentTypes[extname(filePath)] ?? "application/octet-stream";

    response.writeHead(200, {
      "Content-Type": contentType,
      "Cache-Control": "no-store",
    });
    response.end(body);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
}).listen(port, () => {
  process.stdout.write(`VectorBridge demo running at http://localhost:${port}\n`);
});
