'use strict';
// A dependency-free MCP stdio bridge to Cloudflare's FLUX.1 Schnell.
// Credentials come only from the Render environment. stdout is JSON-RPC only.
const readline = require('node:readline');
const tool = {
  name: 'generate_image',
  description: 'Generate one image from a text description using FLUX.1 Schnell. Returns the actual image. Text-to-image only; cannot edit an existing image.',
  inputSchema: {
    type: 'object',
    properties: { prompt: { type: 'string', minLength: 1, maxLength: 2048 } },
    required: ['prompt'],
    additionalProperties: false,
  },
};
let busy = false;
async function generate(args) {
  if (!args || typeof args.prompt !== 'string' || !args.prompt.trim() || args.prompt.length > 2048) {
    return { isError: true, content: [{ type: 'text', text: 'Provide a nonempty image description of at most 2048 characters.' }] };
  }
  const account = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!account || !/^[a-f0-9]{32}$/i.test(account) || !token) {
    return { isError: true, content: [{ type: 'text', text: 'Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN in Render.' }] };
  }
  if (busy) return { isError: true, content: [{ type: 'text', text: 'An image is already generating. Wait for it to finish.' }] };
  busy = true;
  try {
    const response = await fetch(
      'https://api.cloudflare.com/client/v4/accounts/' + account + '/ai/run/@cf/black-forest-labs/flux-1-schnell',
      {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: args.prompt.trim(), steps: 4 }),
        signal: AbortSignal.timeout(120000),
      },
    );
    const data = await response.json();
    if (!response.ok || data.success === false) {
      const codes = (data.errors || []).map(e => e.code).filter(Boolean).join(', ');
      // Do not echo upstream messages, request headers, or secrets.
      return { isError: true, content: [{ type: 'text', text: 'Cloudflare image request failed (HTTP ' + response.status + (codes ? ', code ' + codes : '') + '). Check token permissions, free allowance, and model availability. No paid fallback was attempted.' }] };
    }
    const encoded = data.result && data.result.image;
    if (typeof encoded !== 'string' || !encoded.length) throw new Error('Missing image');
    const bytes = Buffer.from(encoded, 'base64');
    const mimeType = bytes[0] === 0x89 && bytes[1] === 0x50 ? 'image/png' : 'image/jpeg';
    return { content: [{ type: 'image', data: encoded, mimeType }, { type: 'text', text: 'Image generated with FLUX.1 Schnell.' }] };
  } catch {
    return { isError: true, content: [{ type: 'text', text: 'Image generation did not complete. Check the connection and try again.' }] };
  } finally {
    busy = false;
  }
}
async function handle(message) {
  if (!Object.hasOwn(message, 'id')) return; // Ignore notifications.
  let result;
  switch (message.method) {
    case 'initialize':
      result = { protocolVersion: message.params?.protocolVersion || '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'cloudflare-images', version: '1.0.0' } };
      break;
    case 'ping': result = {}; break;
    case 'tools/list': result = { tools: [tool] }; break;
    case 'tools/call':
      if (message.params?.name !== tool.name) return sendError(message.id, -32602, 'Unknown tool');
      result = await generate(message.params.arguments);
      break;
    default: return sendError(message.id, -32601, 'Method not found');
  }
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: message.id, result }) + '\n');
}
function sendError(id, code, message) {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } }) + '\n');
}
readline.createInterface({ input: process.stdin, crlfDelay: Infinity }).on('line', line => {
  let message;
  try { message = JSON.parse(line); } catch { return sendError(null, -32700, 'Parse error'); }
  handle(message).catch(() => sendError(message.id, -32603, 'Internal error'));
});
