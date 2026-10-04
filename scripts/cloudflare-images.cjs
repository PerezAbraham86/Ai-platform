'use strict';
// A dependency-free MCP stdio bridge to Cloudflare's FLUX.1 Schnell.
// Credentials come only from the Render environment. stdout is JSON-RPC only.
const readline = require('node:readline');
const { createHash } = require('node:crypto');
const tool = {
  name: 'generate_image',
  description: 'Generate one image from a text description using FLUX.1 Schnell. Returns the actual image and a permanent Cloudinary URL. Include the exact returned permanent URL as a clickable link in your answer. Text-to-image only; cannot edit an existing image.',
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
  const cloud = process.env.CLOUDINARY_CLOUD_NAME;
  const cloudKey = process.env.CLOUDINARY_API_KEY;
  const cloudSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloud || !/^[a-z0-9_-]+$/i.test(cloud) || !cloudKey || !cloudSecret) {
    return { isError: true, content: [{ type: 'text', text: 'Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in Render before generating images.' }] };
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
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = createHash('sha256').update('timestamp=' + timestamp + cloudSecret).digest('hex');
    const form = new FormData();
    form.set('file', new Blob([bytes], { type: mimeType }), mimeType === 'image/png' ? 'generated.png' : 'generated.jpg');
    form.set('api_key', cloudKey);
    form.set('timestamp', timestamp);
    form.set('signature', signature);
    const upload = await fetch('https://api.cloudinary.com/v1_1/' + cloud + '/image/upload', {
      method: 'POST', body: form, signal: AbortSignal.timeout(20000),
    });
    const saved = await upload.json();
    if (!upload.ok) {
      return { isError: true, content: [{ type: 'text', text: 'The image was generated, but Cloudinary storage failed (HTTP ' + upload.status + '). Check the Cloudinary credentials and free storage allowance. The image was not saved; no retry or paid fallback was attempted.' }] };
    }
    const permanent = new URL(saved.secure_url);
    if (permanent.protocol !== 'https:' || permanent.hostname !== 'res.cloudinary.com' || !permanent.pathname.startsWith('/' + cloud + '/')) {
      throw new Error('Invalid storage URL');
    }
    return { content: [
      { type: 'image', data: encoded, mimeType },
      { type: 'text', text: 'Image generated with FLUX.1 Schnell and saved to Cloudinary. Permanent image link: ' + permanent.href + '\\nInclude this exact link in your answer. This saved original survives Render restarts. Anyone with the link can view it.' },
    ] };
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
      result = { protocolVersion: message.params?.protocolVersion || '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'cloudflare-images', version: '1.1.0' } };
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
