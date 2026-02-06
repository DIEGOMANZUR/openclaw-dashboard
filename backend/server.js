/**
 * OpenClaw Cockpit Dashboard - Backend API
 * Express.js with JSON storage (SQLite optional)
 * Includes: 7 Agents, Screenshot Watcher, Socio 40-min Reports
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const cron = require('node-cron');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..')));

// JSON Data Storage
const dataPath = path.join(__dirname, 'data.json');
let data = {
  agents: [
    { id: 'aboganster', name: 'Aboganster', emoji: '👔', model: 'claude-opus-4-5', role: 'Legal Analysis', status: 'active' },
    { id: 'cabezon', name: 'Cabezón', emoji: '📚', model: 'gemini-3-pro', role: 'Research', status: 'active' },
    { id: 'el-fotocopia', name: 'El Fotocopia', emoji: '📄', model: 'gemini-3-flash', role: 'PDF→MD', status: 'active' },
    { id: 'paco', name: 'Paco', emoji: '⚖️', model: 'claude-sonnet-4-5', role: 'Evaluator', status: 'active' },
    { id: 'arquitecto', name: 'Arquitecto', emoji: '🏗️', model: 'gemini-3-pro', role: 'Structure', status: 'active' },
    { id: 'socio', name: 'Socio', emoji: '🎯', model: 'claude-opus-4-5', role: 'Coordinator + Antigravity Control', status: 'active' },
    { id: 'cartero', name: 'Cartero', emoji: '📧', model: 'gemini-3-flash', role: 'Gmail Manager', status: 'active' }
  ],
  tasks: [],
  feed: [],
  screenshots: [],
  accounts: [],
  sessions: [
    { id: 'gemini-cli', provider: 'Google', tool: 'Gemini CLI + Antigravity', status: 'active', models: ['gemini-3-pro', 'gemini-3-flash'] },
    { id: 'claude-code', provider: 'Anthropic', tool: 'Claude Code', status: 'active', models: ['claude-opus-4-5', 'claude-sonnet-4-5'] },
    { id: 'chatgpt-codex', provider: 'OpenAI', tool: 'ChatGPT Codex', status: 'active', models: ['gpt-5.2', 'gpt-5.2-thinking'] }
  ],
  skills: [],
  mcps: [
    { id: 'sequential-thinking', name: 'Sequential Thinking', enabled: true },
    { id: 'memory-bank', name: 'Memory Bank', enabled: true },
    { id: 'filesystem', name: 'Filesystem', enabled: true },
    { id: 'brave-search', name: 'Brave Search', enabled: true },
    { id: 'github', name: 'GitHub', enabled: true },
    { id: 'chrome-devtools', name: 'Chrome DevTools', enabled: true },
    { id: 'context7', name: 'Context7', enabled: true }
  ],
  news: [],
  memory: {},
  quotas: {}
};

// Load existing data
if (fs.existsSync(dataPath)) {
  try { data = { ...data, ...JSON.parse(fs.readFileSync(dataPath, 'utf8')) }; } catch(e) {}
}
const save = () => fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));

// ═══════════════════════════════════════
// API ROUTES
// ═══════════════════════════════════════

// AGENTS
app.get('/api/agents', (req, res) => res.json(data.agents));
app.get('/api/agents/:id', (req, res) => res.json(data.agents.find(a => a.id === req.params.id)));
app.post('/api/agents', (req, res) => { data.agents.push(req.body); save(); res.json({ success: true }); });
app.put('/api/agents/:id', (req, res) => {
  const i = data.agents.findIndex(a => a.id === req.params.id);
  if (i >= 0) { data.agents[i] = { ...data.agents[i], ...req.body }; save(); }
  res.json({ success: true });
});
app.post('/api/agents/:id/pause', (req, res) => {
  const a = data.agents.find(a => a.id === req.params.id);
  if (a) { a.status = 'paused'; save(); }
  res.json({ success: true });
});
app.post('/api/agents/:id/resume', (req, res) => {
  const a = data.agents.find(a => a.id === req.params.id);
  if (a) { a.status = 'active'; save(); }
  res.json({ success: true });
});

// TASKS
app.get('/api/tasks', (req, res) => res.json(data.tasks));
app.post('/api/tasks', (req, res) => {
  data.tasks.push({ id: Date.now(), ...req.body, status: 'pending', progress: 0, createdAt: new Date().toISOString() });
  save(); res.json({ success: true });
});
app.put('/api/tasks/:id', (req, res) => {
  const i = data.tasks.findIndex(t => t.id == req.params.id);
  if (i >= 0) { data.tasks[i] = { ...data.tasks[i], ...req.body }; save(); }
  res.json({ success: true });
});

// FEED
app.get('/api/feed', (req, res) => res.json(data.feed.slice(-100).reverse()));
app.post('/api/feed', (req, res) => {
  data.feed.push({ id: Date.now(), ...req.body, createdAt: new Date().toISOString() });
  save(); res.json({ success: true });
});

// SCREENSHOTS
app.get('/api/screenshots', (req, res) => res.json(data.screenshots));

// ACCOUNTS
app.get('/api/accounts', (req, res) => res.json(data.accounts));
app.post('/api/accounts', (req, res) => { data.accounts.push(req.body); save(); res.json({ success: true }); });

// SESSIONS
app.get('/api/sessions', (req, res) => res.json(data.sessions));

// MCPS
app.get('/api/mcps', (req, res) => res.json(data.mcps));
app.put('/api/mcps/:id', (req, res) => {
  const m = data.mcps.find(m => m.id === req.params.id);
  if (m) { m.enabled = req.body.enabled; save(); }
  res.json({ success: true });
});

// SKILLS
app.get('/api/skills', (req, res) => res.json(data.skills));

// MEMORY
app.get('/api/memory/:agentId', (req, res) => res.json(data.memory[req.params.agentId] || []));

// NEWS
app.get('/api/news', (req, res) => res.json(data.news));

// STATS
app.get('/api/stats', (req, res) => res.json({
  agents: data.agents.length,
  agentsActive: data.agents.filter(a => a.status === 'active').length,
  tasks: data.tasks.length,
  tasksPending: data.tasks.filter(t => t.status === 'pending').length,
  tasksCompleted: data.tasks.filter(t => t.status === 'completed').length,
  screenshots: data.screenshots.length,
  feedItems: data.feed.length
}));

// HEALTH
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// ═══════════════════════════════════════
// SOCIO 40-MINUTE REPORTS
// ═══════════════════════════════════════
cron.schedule('*/40 * * * *', () => {
  console.log('📊 Socio generating 40-minute report...');
  const report = {
    type: 'socio-report',
    agentId: 'socio',
    title: '📊 Reporte de Estado (40 min)',
    content: `Agentes activos: ${data.agents.filter(a => a.status === 'active').length}/${data.agents.length}\nTareas pendientes: ${data.tasks.filter(t => t.status === 'pending').length}\nTareas completadas: ${data.tasks.filter(t => t.status === 'completed').length}`
  };
  data.feed.push({ id: Date.now(), ...report, createdAt: new Date().toISOString() });
  save();
});

// ═══════════════════════════════════════
// START SERVER
// ═══════════════════════════════════════
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🦞 OpenClaw Backend API running on http://0.0.0.0:${PORT}\n`);
  save(); // Ensure initial data is saved
});
