import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { POST } from './app/api/search/route.js';
import { POST as TEMPLATE_POST } from './app/api/template/route.js';

const root = fileURLToPath(new URL('.', import.meta.url));
const types = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };

async function handleRequest(request, response) {
  try {
    if ((request.url === '/api/search' || request.url === '/api/template') && request.method === 'POST') {
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      // Multipart uploads are binary. Keep the request body as Buffer so HWP/HWPX/PDF/Office bytes are not corrupted.
      const body = Buffer.concat(chunks);
      const handler = request.url === '/api/template' ? TEMPLATE_POST : POST;
      const contentType = request.headers['content-type'] || 'application/octet-stream';
      const result = await handler(new Request(`http://localhost${request.url}`, { method: 'POST', headers: { 'content-type': contentType }, body }));
      response.writeHead(result.status, Object.fromEntries(result.headers));
      response.end(await result.text());
      return;
    }
    const requested = request.url === '/' ? 'index.html' : request.url.replace(/^\//, '');
    const filePath = normalize(join(root, requested));
    if (!filePath.startsWith(root)) { response.writeHead(403); response.end(); return; }
    const file = await readFile(filePath);
    response.writeHead(200, { 'content-type': types[extname(filePath)] || 'application/octet-stream' });
    response.end(file);
  } catch (error) {
    response.writeHead(error.code === 'ENOENT' ? 404 : 500, { 'content-type': 'text/plain; charset=utf-8' });
    response.end(error.code === 'ENOENT' ? 'Not found' : 'Server error');
  }
}

export default handleRequest;

if (process.env.VERCEL !== '1') createServer(handleRequest).listen(4173, () => {});
