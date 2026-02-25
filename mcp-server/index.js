#!/usr/bin/env node
/**
 * Spectrum MCP Server
 *
 * Exposes Spectrum Outfitters Calendar API and docs to Cursor via MCP.
 * Set SPECTRUM_API_BASE_URL and optionally SPECTRUM_ADMIN_TOKEN in env (or in Cursor MCP server env).
 *
 * Tools: spectrum_health, spectrum_active_sessions, spectrum_login_events, spectrum_security_stats
 * Resources: spectrum://docs/DEPLOYMENT, spectrum://docs/GO_LIVE_CHECKLIST
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import z from 'zod';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const API_BASE = (process.env.SPECTRUM_API_BASE_URL || '').replace(/\/+$/, '');
const ADMIN_TOKEN = process.env.SPECTRUM_ADMIN_TOKEN || '';
const PROJECT_ROOT = process.env.SPECTRUM_PROJECT_ROOT || path.resolve(__dirname, '..');

async function apiFetch(endpoint, options = {}) {
  if (!API_BASE) {
    throw new Error('SPECTRUM_API_BASE_URL is not set (e.g. https://login.spectrumoutfitters.com/api)');
  }
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
  const headers = {
    'User-Agent': 'SpectrumMCP/1.0',
    ...(options.headers || {})
  };
  if (ADMIN_TOKEN) headers.Authorization = `Bearer ${ADMIN_TOKEN}`;
  const res = await fetch(url, { ...options, headers, signal: AbortSignal.timeout(15000) });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 400)}`);
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

const server = new McpServer({
  name: 'spectrum-mcp',
  version: '1.0.0'
}, {
  capabilities: {
    tools: { listChanged: true },
    resources: { listChanged: true }
  }
});

// --- Tools ---

server.tool('spectrum_health', 'Check Spectrum API health (no auth required)', async () => {
  const data = await apiFetch('/health');
  return {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }]
  };
});

server.tool('spectrum_active_sessions', 'List active user sessions (admin token required)', async () => {
  const data = await apiFetch('/admin/security/active-sessions');
  const sessions = data.sessions || [];
  const text = sessions.length === 0
    ? 'No active sessions.'
    : JSON.stringify(sessions, null, 2);
  return {
    content: [{ type: 'text', text }]
  };
});

server.registerTool('spectrum_login_events', {
  description: 'Get recent login events (admin token required). Optional limit and offset for pagination.',
  inputSchema: {
    limit: z.number().min(1).max(200).optional().describe('Max events to return (default 50)'),
    offset: z.number().min(0).optional().describe('Offset for pagination')
  }
}, async ({ limit = 50, offset = 0 } = {}) => {
  const data = await apiFetch(`/admin/security/login-events?limit=${limit}&offset=${offset}`);
  const text = JSON.stringify(data, null, 2);
  return {
    content: [{ type: 'text', text }]
  };
});

server.tool('spectrum_security_stats', 'Get security overview: active sessions, logins today, failed logins (admin token required)', async () => {
  const data = await apiFetch('/admin/security/stats');
  return {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }]
  };
});

// --- Resources (docs) ---

const DOCS = {
  'spectrum://docs/DEPLOYMENT': { file: 'docs/DEPLOYMENT.md', name: 'Deployment guide' },
  'spectrum://docs/GO_LIVE_CHECKLIST': { file: 'docs/GO_LIVE_CHECKLIST.md', name: 'Go-live checklist' }
};

server.resource('Deployment guide', 'spectrum://docs/DEPLOYMENT', { description: 'Deploying Spectrum Outfitters online' }, async () => {
  const p = path.join(PROJECT_ROOT, 'docs', 'DEPLOYMENT.md');
  const text = await readFile(p, 'utf8').catch(() => 'File not found.');
  return { contents: [{ type: 'text', text }] };
});

server.resource('Go-live checklist', 'spectrum://docs/GO_LIVE_CHECKLIST', { description: 'Go-live checklist' }, async () => {
  const p = path.join(PROJECT_ROOT, 'docs', 'GO_LIVE_CHECKLIST.md');
  const text = await readFile(p, 'utf8').catch(() => 'File not found.');
  return { contents: [{ type: 'text', text }] };
});

// --- Run stdio transport ---

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Spectrum MCP server running on stdio');
}

main().catch((err) => {
  console.error('Spectrum MCP error:', err);
  process.exit(1);
});
