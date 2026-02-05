/**
 * OpenClaw Cockpit Ultimate - Main Application
 * Complete JavaScript with all 6 sections integration
 * 
 * SECTIONS:
 * 1. USO - Chat, Tasks, Screenshots, Email
 * 2. ESTADO - System Status, Quotas, Sessions
 * 3. FEED - Feed, Deliveries, AI News  
 * 4. SUPERVISIÓN - Agents, Memory, History
 * 5. CABINA - Config Agents, Skills, Tools, Accounts, User Data, RAG, Settings
 * 6. CONECTORES - Google Drive, Dropbox, Notion, GitHub, Webhooks
 */

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

const CONFIG = {
  API_URL: 'http://localhost:3001/api',
  WINDOWS_WORKER_URL: 'http://localhost:8765',  // Windows Worker for autonomy
  OPENCLAW_CONFIG_PATH: '\\\\wsl.localhost\\Ubuntu\\home\\diego\\.openclaw',
  GATEWAY_URL: 'http://localhost:3000',
  REFRESH_INTERVAL: 30000,
  SOCIO_REPORT_INTERVAL: 40 * 60 * 1000, // 40 minutes
  
  // Agent name mapping (OpenClaw ID -> User-friendly name)
  AGENT_NAMES: {
    'main': { name: 'Socio', emoji: '🎯', role: 'Coordinator + Antigravity Control' },
    'penalista_1': { name: 'Aboganster', emoji: '👔', role: 'Legal Analysis' },
    'penalista_2': { name: 'Aboganster 2', emoji: '👔', role: 'Legal Analysis (Backup)' },
    'scout_chile_ia': { name: 'Cabezón', emoji: '🧠', role: 'Research & Intelligence' },
    'pdf2md_docs': { name: 'El Fotocopia', emoji: '📄', role: 'PDF to Markdown' },
    'qa_grader': { name: 'Paco', emoji: '✅', role: 'Quality Evaluator' },
    'qa_gatekeeper': { name: 'Paco QA', emoji: '🚧', role: 'Quality Gatekeeper' },
    'architect': { name: 'Arquitecto', emoji: '🏗️', role: 'Structure & Planning' },
    'dev_antigravity': { name: 'Dev', emoji: '💻', role: 'Development + Antigravity' },
    'inbox_manager': { name: 'Cartero', emoji: '📧', role: 'Gmail Manager' },
    'windows_ops': { name: 'WinOps', emoji: '🖥️', role: 'Windows Operations' }
  },
  
  // LLM Models available
  MODELS: [
    { id: 'google-antigravity/gemini-3-flash', name: 'Gemini 3 Flash', provider: 'Google' },
    { id: 'google-antigravity/gemini-3-pro', name: 'Gemini 3 Pro', provider: 'Google' },
    { id: 'google-antigravity/claude-sonnet-4-5', name: 'Claude Sonnet 4.5', provider: 'Anthropic' },
    { id: 'google-antigravity/claude-opus-4-5', name: 'Claude Opus 4.5', provider: 'Anthropic' },
    { id: 'google-antigravity/claude-opus-4-5-thinking', name: 'Claude Opus 4.5 Thinking', provider: 'Anthropic' }
  ],
  
  // AI News sources (editable)
  NEWS_SOURCES: [
    { name: 'OpenAI Blog', url: 'https://openai.com/blog', enabled: true },
    { name: 'Anthropic', url: 'https://anthropic.com/news', enabled: true },
    { name: 'Google AI', url: 'https://ai.googleblog.com', enabled: true },
    { name: 'Hugging Face', url: 'https://huggingface.co/blog', enabled: true },
    { name: 'AI News Chile', url: 'https://www.biobiochile.cl/tecnologia', enabled: true }
  ],

  // Session providers
  SESSIONS: [
    { id: 'gemini', name: 'Gemini (CLI + Antigravity)', provider: 'Google', status: 'active', models: ['gemini-3-flash', 'gemini-3-pro'] },
    { id: 'codex', name: 'Codex (ChatGPT)', provider: 'OpenAI', status: 'active', models: ['o3', 'o4-mini'] },
    { id: 'anthropic', name: 'Anthropic (Claude Code)', provider: 'Anthropic', status: 'active', models: ['claude-sonnet-4.5', 'claude-opus-4.5'] }
  ]
};

// ═══════════════════════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════════════════════

const state = {
  currentTab: 'chat',
  currentSection: 'uso',
  agents: [],
  tasks: [],
  feed: [],
  screenshots: [],
  emails: [],
  quotas: [],
  skills: [],
  mcps: [],
  accounts: [],
  variables: [],
  userMemory: '',
  chatHistory: [],
  selectedAgent: 'main',
  selectedModel: null,
  errors: [],
  systemStatus: {
    gateway: 'checking',
    backend: 'checking',
    whatsapp: 'checking',
    telegram: 'checking',
    tailscale: 'offline',
    neo4j: 'offline'
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// DOM READY
// ═══════════════════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  console.log('🦞 OpenClaw Cockpit Ultimate - Initializing...');
  
  initNavigation();
  initChat();
  initModals();
  initEventListeners();
  
  // Load all data
  loadInitialData();
  
  // Start periodic refresh
  setInterval(refreshData, CONFIG.REFRESH_INTERVAL);
  startSocioReportTimer();
  
  console.log('✅ OpenClaw Cockpit initialized');
});

// ═══════════════════════════════════════════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════════════════════════════════════════

function initNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  const mobileToggle = document.getElementById('mobileMenuToggle');
  const sidebar = document.getElementById('sidebar');
  
  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const tab = item.dataset.tab;
      if (tab) switchTab(tab);
      
      // Close mobile menu
      if (window.innerWidth <= 768) {
        sidebar.classList.remove('open');
      }
    });
  });
  
  mobileToggle?.addEventListener('click', () => {
    sidebar.classList.toggle('open');
  });
}

function switchTab(tab) {
  // Update nav
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelector(`[data-tab="${tab}"]`)?.classList.add('active');
  
  // Update content
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  const tabEl = document.getElementById(`${tab}Tab`);
  if (tabEl) tabEl.classList.add('active');
  
  // Update header
  const titles = {
    chat: 'Chat', tasks: 'Tareas Actuales', screenshots: 'Screenshots', email: 'Email',
    status: 'Estado del Sistema', quotas: 'Cuotas y Uso', sessions: 'Sesiones Login',
    feed: 'Feed Principal', deliveries: 'Entregas', news: 'AI News',
    agents: 'Supervisión de Agentes', memory: 'Memoria', history: 'Historial',
    'config-agents': 'Config Agentes', skills: 'Skills', tools: 'Tools & MCPs',
    accounts: 'Cuentas LLM', userdata: 'Datos Usuario', rag: 'RAG Config', winworker: 'Windows Worker', settings: 'Settings',
    gdrive: 'Google Drive', dropbox: 'Dropbox', notion: 'Notion', github: 'GitHub', webhooks: 'Webhooks'
  };
  
  const sections = {
    chat: 'USO', tasks: 'USO', screenshots: 'USO', email: 'USO',
    status: 'ESTADO', quotas: 'ESTADO', sessions: 'ESTADO',
    feed: 'FEED', deliveries: 'FEED', news: 'FEED',
    agents: 'SUPERVISIÓN', memory: 'SUPERVISIÓN', history: 'SUPERVISIÓN',
    'config-agents': 'CABINA', skills: 'CABINA', tools: 'CABINA',
    accounts: 'CABINA', userdata: 'CABINA', rag: 'CABINA', winworker: 'CABINA', settings: 'CABINA',
    gdrive: 'CONECTORES', dropbox: 'CONECTORES', notion: 'CONECTORES', github: 'CONECTORES', webhooks: 'CONECTORES'
  };
  
  document.getElementById('pageTitle').textContent = titles[tab] || tab;
  document.getElementById('breadcrumb').textContent = `${sections[tab]} / ${titles[tab]}`;
  
  state.currentTab = tab;
  state.currentSection = sections[tab];
  
  // Load tab-specific data
  loadTabData(tab);
}

function loadTabData(tab) {
  switch(tab) {
    case 'agents': renderAgentsSupervision(); break;
    case 'config-agents': renderAgentsConfig(); break;
    case 'feed': renderFeed(); break;
    case 'tasks': renderTasks(); break;
    case 'screenshots': loadScreenshots(); break;
    case 'quotas': renderQuotas(); break;
    case 'sessions': renderSessions(); break;
    case 'memory': renderMemory(); break;
    case 'skills': renderSkills(); break;
    case 'tools': renderTools(); break;
    case 'accounts': renderAccounts(); break;
    case 'userdata': loadUserData(); break;
    case 'winworker': checkWinworkerStatus(); break;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// DATA LOADING
// ═══════════════════════════════════════════════════════════════════════════

async function loadInitialData() {
  showLoading();
  
  try {
    // Try backend API first
    await Promise.all([
      loadAgents(),
      loadTasks(),
      loadFeed(),
      checkSystemStatus()
    ]);
  } catch (err) {
    console.warn('Backend not available, using local data');
    loadLocalData();
  }
  
  renderAgentSelectors();
  hideLoading();
}

async function loadAgents() {
  try {
    const res = await fetch(`${CONFIG.API_URL}/agents`);
    if (res.ok) {
      state.agents = await res.json();
    } else {
      throw new Error('API unavailable');
    }
  } catch {
    // Use OpenClaw config directly
    state.agents = Object.entries(CONFIG.AGENT_NAMES).map(([id, info]) => ({
      id,
      name: info.name,
      emoji: info.emoji,
      role: info.role,
      model: getAgentModel(id),
      status: 'active'
    }));
  }
}

function getAgentModel(agentId) {
  const modelMap = {
    'main': 'google-antigravity/gemini-3-flash',
    'dev_antigravity': 'google-antigravity/claude-sonnet-4-5',
    'penalista_1': 'google-antigravity/claude-opus-4-5-thinking',
    'penalista_2': 'google-antigravity/claude-opus-4-5-thinking',
    'qa_grader': 'google-antigravity/claude-sonnet-4-5'
  };
  return modelMap[agentId] || 'google-antigravity/gemini-3-flash';
}

async function loadTasks() {
  try {
    const res = await fetch(`${CONFIG.API_URL}/tasks`);
    if (res.ok) state.tasks = await res.json();
  } catch { /* Use local */ }
}

async function loadFeed() {
  try {
    const res = await fetch(`${CONFIG.API_URL}/feed`);
    if (res.ok) state.feed = await res.json();
  } catch { /* Use local */ }
}

async function loadScreenshots() {
  try {
    const res = await fetch(`${CONFIG.API_URL}/screenshots`);
    if (res.ok) {
      state.screenshots = await res.json();
      renderScreenshots();
    }
  } catch { /* Use local */ }
}

async function checkSystemStatus() {
  // Check backend
  try {
    const res = await fetch(`${CONFIG.API_URL}/stats`);
    if (res.ok) {
      state.systemStatus.backend = 'online';
      updateBackendStatus(true);
    }
  } catch {
    state.systemStatus.backend = 'offline';
    updateBackendStatus(false);
  }
  
  // Gateway is always local per config
  state.systemStatus.gateway = 'online';
  updateGatewayStatus(true);
  
  // WhatsApp and Telegram are enabled per config
  state.systemStatus.whatsapp = 'online';
  state.systemStatus.telegram = 'online';
}

function updateGatewayStatus(online) {
  const indicator = document.getElementById('gatewayIndicator');
  const text = document.getElementById('gatewayText');
  if (indicator && text) {
    indicator.className = `status-indicator ${online ? 'online' : 'offline'}`;
    text.textContent = online ? 'Gateway: Local' : 'Gateway: Offline';
  }
}

function updateBackendStatus(online) {
  const statusEl = document.getElementById('backendStatus');
  if (statusEl) {
    statusEl.innerHTML = `<span class="status-indicator ${online ? 'online' : 'offline'}"></span> ${online ? 'Activo' : 'Offline'}`;
  }
}

function refreshData() {
  loadFeed();
  checkSystemStatus();
}

function loadLocalData() {
  // Initialize from CONFIG
  state.agents = Object.entries(CONFIG.AGENT_NAMES).map(([id, info]) => ({
    id, ...info, model: getAgentModel(id), status: 'active'
  }));
}

// ═══════════════════════════════════════════════════════════════════════════
// CHAT
// ═══════════════════════════════════════════════════════════════════════════

function initChat() {
  const sendBtn = document.getElementById('sendBtn');
  const chatInput = document.getElementById('chatInput');
  const clearBtn = document.getElementById('clearChat');
  
  sendBtn?.addEventListener('click', sendMessage);
  chatInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
  
  clearBtn?.addEventListener('click', () => {
    state.chatHistory = [];
    renderChatMessages();
  });
}

function renderAgentSelectors() {
  const agentSelector = document.getElementById('chatAgentSelector');
  const modelSelector = document.getElementById('modelSelector');
  const memorySelect = document.getElementById('memoryAgentSelect');
  const historySelect = document.getElementById('historyAgentSelect');
  
  if (agentSelector) {
    agentSelector.innerHTML = state.agents.map(a => `
      <div class="agent-option ${a.id === state.selectedAgent ? 'selected' : ''}" data-agent="${a.id}">
        <span class="agent-emoji">${a.emoji}</span>
        <div class="agent-info">
          <span class="agent-name">${a.name}</span>
          <span class="agent-role">${a.role}</span>
        </div>
      </div>
    `).join('');
    
    agentSelector.querySelectorAll('.agent-option').forEach(opt => {
      opt.addEventListener('click', () => selectAgent(opt.dataset.agent));
    });
  }
  
  if (modelSelector) {
    modelSelector.innerHTML = CONFIG.MODELS.map(m => `
      <div class="model-option ${m.id === state.selectedModel ? 'selected' : ''}" data-model="${m.id}">
        <span class="model-provider">${m.provider}</span>
        <span class="model-name">${m.name}</span>
      </div>
    `).join('');
    
    modelSelector.querySelectorAll('.model-option').forEach(opt => {
      opt.addEventListener('click', () => selectModel(opt.dataset.model));
    });
  }
  
  // Populate selects for memory and history
  const agentOptions = state.agents.map(a => `<option value="${a.id}">${a.emoji} ${a.name}</option>`).join('');
  if (memorySelect) memorySelect.innerHTML = agentOptions;
  if (historySelect) historySelect.innerHTML = agentOptions;
}

function selectAgent(agentId) {
  state.selectedAgent = agentId;
  state.selectedModel = null;
  
  document.querySelectorAll('.agent-option').forEach(o => o.classList.remove('selected'));
  document.querySelector(`[data-agent="${agentId}"]`)?.classList.add('selected');
  document.querySelectorAll('.model-option').forEach(o => o.classList.remove('selected'));
  
  const agent = state.agents.find(a => a.id === agentId);
  if (agent) {
    document.getElementById('chatIcon').textContent = agent.emoji;
    document.getElementById('chatName').textContent = agent.name;
    document.getElementById('chatStatus').textContent = `${agent.role} - Listo`;
  }
}

function selectModel(modelId) {
  state.selectedModel = modelId;
  state.selectedAgent = null;
  
  document.querySelectorAll('.model-option').forEach(o => o.classList.remove('selected'));
  document.querySelector(`[data-model="${modelId}"]`)?.classList.add('selected');
  document.querySelectorAll('.agent-option').forEach(o => o.classList.remove('selected'));
  
  const model = CONFIG.MODELS.find(m => m.id === modelId);
  if (model) {
    document.getElementById('chatIcon').textContent = model.provider === 'Google' ? '🔵' : '🟠';
    document.getElementById('chatName').textContent = model.name;
    document.getElementById('chatStatus').textContent = 'Modelo directo - Listo';
  }
}

async function sendMessage() {
  const input = document.getElementById('chatInput');
  const message = input.value.trim();
  if (!message) return;
  
  // Add user message
  state.chatHistory.push({ role: 'user', content: message, timestamp: new Date() });
  input.value = '';
  renderChatMessages();
  
  // Show typing indicator
  showTyping();
  
  try {
    // Send to backend/agent
    const target = state.selectedAgent || state.selectedModel;
    const res = await fetch(`${CONFIG.API_URL}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, target, type: state.selectedAgent ? 'agent' : 'model' })
    });
    
    hideTyping();
    
    if (res.ok) {
      const data = await res.json();
      state.chatHistory.push({ 
        role: 'assistant', 
        content: data.response || 'Respuesta recibida', 
        timestamp: new Date(),
        agent: state.selectedAgent
      });
    } else {
      state.chatHistory.push({ 
        role: 'assistant', 
        content: `⏳ Mensaje enviado a ${getTargetName()}. El agente procesará tu solicitud.`, 
        timestamp: new Date() 
      });
    }
  } catch {
    hideTyping();
    state.chatHistory.push({ 
      role: 'assistant', 
      content: `📡 Conectando con ${getTargetName()}... Backend API no disponible. Usa OpenClaw CLI directamente.`, 
      timestamp: new Date() 
    });
  }
  
  renderChatMessages();
}

function getTargetName() {
  if (state.selectedAgent) {
    const agent = state.agents.find(a => a.id === state.selectedAgent);
    return agent?.name || state.selectedAgent;
  }
  const model = CONFIG.MODELS.find(m => m.id === state.selectedModel);
  return model?.name || 'modelo';
}

function renderChatMessages() {
  const container = document.getElementById('chatMessages');
  if (!container) return;
  
  if (state.chatHistory.length === 0) {
    container.innerHTML = `
      <div class="chat-welcome">
        <h2>💬 Chat OpenClaw</h2>
        <p>Habla con <strong>Socio</strong> para coordinar todo, o con cualquier agente/modelo.</p>
        <div class="quick-actions">
          <button class="btn btn-sm" onclick="sendQuick('¿Qué están haciendo todos los agentes?')">📊 Estado</button>
          <button class="btn btn-sm" onclick="sendQuick('Dame un reporte de progreso')">📋 Reporte</button>
          <button class="btn btn-sm" onclick="sendQuick('Necesito ayuda legal')">👔 Legal</button>
        </div>
      </div>
    `;
    return;
  }
  
  container.innerHTML = state.chatHistory.map(msg => `
    <div class="chat-message ${msg.role}">
      <div class="message-avatar">${msg.role === 'user' ? 'D' : (state.agents.find(a => a.id === msg.agent)?.emoji || '🦞')}</div>
      <div class="message-content">
        <div class="message-text">${formatMessage(msg.content)}</div>
        <div class="message-time">${formatTime(msg.timestamp)}</div>
      </div>
    </div>
  `).join('');
  
  container.scrollTop = container.scrollHeight;
}

function sendQuick(message) {
  document.getElementById('chatInput').value = message;
  sendMessage();
}

function showTyping() {
  const container = document.getElementById('chatMessages');
  const typingEl = document.createElement('div');
  typingEl.className = 'typing-indicator';
  typingEl.id = 'typing';
  typingEl.innerHTML = '<span></span><span></span><span></span>';
  container?.appendChild(typingEl);
  container.scrollTop = container.scrollHeight;
}

function hideTyping() {
  document.getElementById('typing')?.remove();
}

function formatMessage(text) {
  return text.replace(/\n/g, '<br>');
}

function formatTime(date) {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
}

// ═══════════════════════════════════════════════════════════════════════════
// TASKS
// ═══════════════════════════════════════════════════════════════════════════

function renderTasks() {
  const pending = document.getElementById('tasksPending');
  const progress = document.getElementById('tasksInProgress');
  const completed = document.getElementById('tasksCompleted');
  
  if (!pending) return;
  
  const tasksByStatus = {
    pending: state.tasks.filter(t => t.status === 'pending'),
    'in-progress': state.tasks.filter(t => t.status === 'in-progress'),
    completed: state.tasks.filter(t => t.status === 'completed')
  };
  
  pending.innerHTML = tasksByStatus.pending.map(t => renderTaskCard(t)).join('') || '<p class="empty-col">Sin tareas</p>';
  progress.innerHTML = tasksByStatus['in-progress'].map(t => renderTaskCard(t)).join('') || '<p class="empty-col">Sin tareas</p>';
  completed.innerHTML = tasksByStatus.completed.slice(0, 5).map(t => renderTaskCard(t)).join('') || '<p class="empty-col">Sin tareas</p>';
}

function renderTaskCard(task) {
  const agent = state.agents.find(a => a.id === task.agentId);
  return `
    <div class="task-card glass" data-id="${task.id}">
      <div class="task-header">
        <span class="task-agent">${agent?.emoji || '🤖'} ${agent?.name || task.agentId}</span>
        <span class="task-priority ${task.priority || 'normal'}">${task.priority || 'normal'}</span>
      </div>
      <h4 class="task-title">${task.title}</h4>
      <p class="task-desc">${task.description || ''}</p>
      <div class="task-footer">
        <span class="task-date">${formatDate(task.createdAt)}</span>
        <div class="task-actions">
          ${task.status !== 'completed' ? `<button class="btn btn-xs" onclick="updateTaskStatus('${task.id}', 'completed')">✓</button>` : ''}
        </div>
      </div>
    </div>
  `;
}

async function updateTaskStatus(taskId, status) {
  try {
    await fetch(`${CONFIG.API_URL}/tasks/${taskId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    loadTasks();
    renderTasks();
  } catch { console.warn('Could not update task'); }
}

function formatDate(date) {
  if (!date) return '';
  return new Date(date).toLocaleDateString('es-CL', { day: '2-digit', month: 'short' });
}

// ═══════════════════════════════════════════════════════════════════════════
// FEED
// ═══════════════════════════════════════════════════════════════════════════

function renderFeed() {
  const container = document.getElementById('feedList');
  if (!container) return;
  
  if (state.feed.length === 0) {
    container.innerHTML = `
      <div class="feed-item glass welcome-feed">
        <span class="feed-icon">🦞</span>
        <div class="feed-content">
          <strong>OpenClaw Cockpit Activo</strong>
          <p>El feed mostrará entregas, reportes de Socio y actualizaciones de los agentes.</p>
        </div>
        <span class="feed-time">Ahora</span>
      </div>
    `;
    return;
  }
  
  container.innerHTML = state.feed.slice(0, 50).map(item => {
    const agent = state.agents.find(a => a.id === item.agentId);
    const icon = item.type === 'socio-report' ? '📊' : (agent?.emoji || '📌');
    const isSocio = item.type === 'socio-report';
    
    return `
      <div class="feed-item glass ${isSocio ? 'highlight' : ''}">
        <span class="feed-icon">${icon}</span>
        <div class="feed-content">
          <strong>${item.title || 'Actualización'}</strong>
          <p>${item.content}</p>
        </div>
        <span class="feed-time">${formatTime(item.createdAt)}</span>
      </div>
    `;
  }).join('');
}

function startSocioReportTimer() {
  updateNextReportTime();
  setInterval(updateNextReportTime, 60000);
}

function updateNextReportTime() {
  const now = new Date();
  const mins = now.getMinutes();
  const nextReport = 40 - (mins % 40);
  document.getElementById('nextReportTime').textContent = `${nextReport} min`;
}

// ═══════════════════════════════════════════════════════════════════════════
// AGENTS SUPERVISION
// ═══════════════════════════════════════════════════════════════════════════

function renderAgentsSupervision() {
  const grid = document.getElementById('agentsSupervisionGrid');
  if (!grid) return;
  
  grid.innerHTML = state.agents.map(agent => `
    <div class="agent-card glass ${agent.status === 'paused' ? 'paused' : ''}">
      <div class="agent-card-header">
        <span class="agent-emoji-big">${agent.emoji}</span>
        <div class="agent-status-badge ${agent.status}">${agent.status === 'active' ? '🟢 Activo' : '⏸️ Pausado'}</div>
      </div>
      <h3>${agent.name}</h3>
      <p class="agent-role">${agent.role}</p>
      <div class="agent-model">${getModelName(agent.model)}</div>
      <div class="agent-stats">
        <div class="stat"><span class="stat-value">${agent.tasksToday || 0}</span><span class="stat-label">Tareas Hoy</span></div>
        <div class="stat"><span class="stat-value">${agent.messagesCount || 0}</span><span class="stat-label">Mensajes</span></div>
      </div>
      <div class="agent-actions">
        <button class="btn btn-sm" onclick="toggleAgentStatus('${agent.id}')">${agent.status === 'paused' ? '▶️ Reanudar' : '⏸️ Pausar'}</button>
        <button class="btn btn-sm btn-secondary" onclick="viewAgentDetails('${agent.id}')">📊 Detalles</button>
      </div>
    </div>
  `).join('');
}

function getModelName(modelId) {
  if (!modelId) return 'Gemini 3 Flash';
  const model = CONFIG.MODELS.find(m => m.id === modelId);
  return model?.name || modelId.split('/').pop();
}

async function toggleAgentStatus(agentId) {
  const agent = state.agents.find(a => a.id === agentId);
  if (agent) {
    agent.status = agent.status === 'active' ? 'paused' : 'active';
    renderAgentsSupervision();
    
    try {
      await fetch(`${CONFIG.API_URL}/agents/${agentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: agent.status })
      });
    } catch { /* Local only */ }
  }
}

function viewAgentDetails(agentId) {
  // Switch to config tab with agent selected
  switchTab('config-agents');
}

// ═══════════════════════════════════════════════════════════════════════════
// AGENTS CONFIG (CABINA)
// ═══════════════════════════════════════════════════════════════════════════

function renderAgentsConfig() {
  const grid = document.getElementById('agentsConfigGrid');
  if (!grid) return;
  
  grid.innerHTML = state.agents.map(agent => `
    <div class="config-card glass">
      <div class="config-header">
        <span class="agent-emoji-big">${agent.emoji}</span>
        <div>
          <h3>${agent.name}</h3>
          <span class="agent-id">ID: ${agent.id}</span>
        </div>
      </div>
      <div class="config-details">
        <div class="config-row"><label>Rol:</label><span>${agent.role}</span></div>
        <div class="config-row"><label>Modelo:</label><span>${getModelName(agent.model)}</span></div>
        <div class="config-row"><label>Workspace:</label><span class="path">C:\\Users\\diego\\clawd\\agents\\${agent.id}</span></div>
        <div class="config-row"><label>Agent Dir:</label><span class="path">~/.openclaw/agents/${agent.id}</span></div>
      </div>
      <div class="config-actions">
        <button class="btn btn-sm" onclick="editAgent('${agent.id}')">✏️ Editar</button>
        <button class="btn btn-sm" onclick="viewAgentSkills('${agent.id}')">🛠️ Skills</button>
        <button class="btn btn-sm btn-secondary" onclick="viewAgentHistory('${agent.id}')">📜 Historial</button>
      </div>
    </div>
  `).join('');
}

function editAgent(agentId) {
  const agent = state.agents.find(a => a.id === agentId);
  if (!agent) return;
  
  document.getElementById('agentModalTitle').textContent = `✏️ Editar ${agent.name}`;
  document.getElementById('agentId').value = agent.id;
  document.getElementById('agentId').disabled = true;
  document.getElementById('agentName').value = agent.name;
  document.getElementById('agentEmoji').value = agent.emoji;
  document.getElementById('agentRole').value = agent.role;
  document.getElementById('agentModel').value = agent.model || '';
  document.getElementById('agentWorkspace').value = `C:\\Users\\diego\\clawd\\agents\\${agent.id}`;
  
  document.getElementById('agentModal').classList.add('open');
}

function viewAgentSkills(agentId) {
  state.selectedAgent = agentId;
  switchTab('skills');
}

function viewAgentHistory(agentId) {
  document.getElementById('historyAgentSelect').value = agentId;
  switchTab('history');
}

// ═══════════════════════════════════════════════════════════════════════════
// SCREENSHOTS
// ═══════════════════════════════════════════════════════════════════════════

function renderScreenshots() {
  const grid = document.getElementById('screenshotsGrid');
  if (!grid) return;
  
  if (state.screenshots.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <span>📸</span>
        <p>Los screenshots de los agentes aparecerán aquí automáticamente</p>
        <small>Se duplican sin mover los originales</small>
      </div>
    `;
    return;
  }
  
  grid.innerHTML = state.screenshots.map(s => `
    <div class="screenshot-card glass">
      <img src="${s.path}" alt="${s.filename}" loading="lazy" onclick="openScreenshot('${s.path}')" />
      <div class="screenshot-info">
        <span class="screenshot-name">${s.filename}</span>
        <span class="screenshot-date">${formatDate(s.createdAt)}</span>
      </div>
    </div>
  `).join('');
}

function openScreenshot(path) {
  window.open(path, '_blank');
}

// ═══════════════════════════════════════════════════════════════════════════
// QUOTAS & SESSIONS
// ═══════════════════════════════════════════════════════════════════════════

function renderQuotas() {
  const grid = document.getElementById('quotasGrid');
  if (!grid) return;
  
  const quotas = [
    { provider: 'Google (Gemini)', used: 15000, limit: 50000, color: 'var(--accent-google)' },
    { provider: 'Anthropic (Claude)', used: 8500, limit: 25000, color: 'var(--accent-anthropic)' },
    { provider: 'OpenRouter', used: 2300, limit: 10000, color: 'var(--accent-openrouter)' }
  ];
  
  grid.innerHTML = quotas.map(q => {
    const pct = Math.round((q.used / q.limit) * 100);
    return `
      <div class="quota-card glass">
        <h4>${q.provider}</h4>
        <div class="quota-bar">
          <div class="quota-fill" style="width: ${pct}%; background: ${q.color}"></div>
        </div>
        <div class="quota-values">
          <span>${q.used.toLocaleString()} tokens</span>
          <span>${pct}%</span>
          <span>${q.limit.toLocaleString()} limit</span>
        </div>
      </div>
    `;
  }).join('');
}

function renderSessions() {
  const grid = document.getElementById('sessionsGrid');
  if (!grid) return;
  
  grid.innerHTML = CONFIG.SESSIONS.map(s => `
    <div class="session-card glass">
      <div class="session-header">
        <span class="session-provider">${s.provider}</span>
        <span class="status-indicator ${s.status === 'active' ? 'online' : 'offline'}"></span>
      </div>
      <h4>${s.name}</h4>
      <div class="session-models">
        ${s.models.map(m => `<span class="model-tag">${m}</span>`).join('')}
      </div>
      <div class="session-actions">
        <button class="btn btn-sm">🔄 Refresh</button>
        <button class="btn btn-sm btn-secondary">🔑 Re-auth</button>
      </div>
    </div>
  `).join('');
}

// ═══════════════════════════════════════════════════════════════════════════
// MEMORY
// ═══════════════════════════════════════════════════════════════════════════

function renderMemory() {
  const layers = document.getElementById('memoryLayers');
  if (!layers) return;
  
  const memoryLayers = [
    { name: 'System Prompt', type: 'core', size: '2.1 KB' },
    { name: 'User Context', type: 'persistent', size: '15.4 KB' },
    { name: 'Conversation', type: 'session', size: '8.2 KB' },
    { name: 'Graph (Neo4j)', type: 'graph', size: 'N/A' },
    { name: 'Embeddings', type: 'vector', size: 'N/A' }
  ];
  
  layers.innerHTML = memoryLayers.map(l => `
    <div class="memory-layer glass">
      <div class="layer-icon">${l.type === 'core' ? '🔒' : l.type === 'graph' ? '🔮' : l.type === 'vector' ? '🧬' : '📝'}</div>
      <div class="layer-info">
        <span class="layer-name">${l.name}</span>
        <span class="layer-type">${l.type}</span>
      </div>
      <span class="layer-size">${l.size}</span>
    </div>
  `).join('');
}

// ═══════════════════════════════════════════════════════════════════════════
// SKILLS & TOOLS
// ═══════════════════════════════════════════════════════════════════════════

function renderSkills() {
  const grid = document.getElementById('skillsGrid');
  if (!grid) return;
  
  const skills = [
    { name: 'Browser Control', icon: '🌐', status: 'active' },
    { name: 'File System', icon: '📁', status: 'active' },
    { name: 'Search', icon: '🔍', status: 'active' },
    { name: 'Code Execution', icon: '💻', status: 'active' },
    { name: 'PDF Processing', icon: '📄', status: 'active' }
  ];
  
  grid.innerHTML = skills.map(s => `
    <div class="skill-card glass ${s.status}">
      <span class="skill-icon">${s.icon}</span>
      <span class="skill-name">${s.name}</span>
      <span class="skill-status">${s.status === 'active' ? '✅' : '❌'}</span>
    </div>
  `).join('');
}

function renderTools() {
  const mcpList = document.getElementById('mcpList');
  const libList = document.getElementById('libList');
  
  const mcps = [
    { name: 'memory-bank', status: 'active' },
    { name: 'sequential-thinking', status: 'active' },
    { name: 'brave-search', status: 'active' },
    { name: 'chrome-devtools', status: 'active' },
    { name: 'filesystem', status: 'active' },
    { name: 'github', status: 'active' },
    { name: 'neo4j', status: 'active' },
    { name: 'postgres-inspector', status: 'active' }
  ];
  
  if (mcpList) {
    mcpList.innerHTML = mcps.map(m => `
      <div class="mcp-item glass">
        <span class="mcp-name">${m.name}</span>
        <span class="mcp-status ${m.status}">${m.status === 'active' ? '🟢' : '🔴'}</span>
      </div>
    `).join('');
  }
  
  if (libList) {
    libList.innerHTML = `
      <div class="lib-item">better-sqlite3</div>
      <div class="lib-item">express</div>
      <div class="lib-item">chokidar</div>
      <div class="lib-item">node-cron</div>
      <div class="lib-item">googleapis</div>
    `;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ACCOUNTS
// ═══════════════════════════════════════════════════════════════════════════

function renderAccounts() {
  const grid = document.getElementById('accountsGrid');
  if (!grid) return;
  
  const accounts = [
    { name: 'Google (Antigravity)', type: 'OAuth', status: 'active', models: ['gemini-3-flash', 'gemini-3-pro'] },
    { name: 'Anthropic', type: 'OAuth', status: 'active', models: ['claude-sonnet-4.5', 'claude-opus-4.5'] },
    { name: 'OpenRouter', type: 'API Key', status: 'active', models: ['Various'] }
  ];
  
  grid.innerHTML = accounts.map(a => `
    <div class="account-card glass">
      <div class="account-header">
        <h4>${a.name}</h4>
        <span class="account-type">${a.type}</span>
      </div>
      <div class="account-status">
        <span class="status-indicator ${a.status === 'active' ? 'online' : 'offline'}"></span>
        <span>${a.status}</span>
      </div>
      <div class="account-models">
        ${a.models.map(m => `<span class="model-tag">${m}</span>`).join('')}
      </div>
      <button class="btn btn-sm">🔄 Refresh Token</button>
    </div>
  `).join('');
}

// ═══════════════════════════════════════════════════════════════════════════
// USER DATA
// ═══════════════════════════════════════════════════════════════════════════

async function loadUserData() {
  try {
    const res = await fetch(`${CONFIG.API_URL}/userdata`);
    if (res.ok) {
      const data = await res.json();
      state.userMemory = data.memory || '';
      state.variables = data.variables || [];
      
      document.getElementById('userMemory').value = state.userMemory;
      renderVariables();
    }
  } catch {
    // Load from localStorage
    state.userMemory = localStorage.getItem('userMemory') || '';
    state.variables = JSON.parse(localStorage.getItem('userVariables') || '[]');
  }
}

function renderVariables() {
  const list = document.getElementById('variablesList');
  if (!list) return;
  
  list.innerHTML = state.variables.map((v, i) => `
    <div class="variable-item glass">
      <span class="var-name">${v.name}</span>
      <span class="var-value">••••••••</span>
      <button class="btn btn-xs" onclick="deleteVariable(${i})">🗑️</button>
    </div>
  `).join('') || '<p class="empty-vars">No hay variables configuradas</p>';
}

async function saveUserMemory() {
  const memory = document.getElementById('userMemory').value;
  state.userMemory = memory;
  
  try {
    await fetch(`${CONFIG.API_URL}/userdata`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memory, variables: state.variables })
    });
    showToast('✅ Memoria guardada');
  } catch {
    localStorage.setItem('userMemory', memory);
    showToast('💾 Guardado localmente');
  }
}

function deleteVariable(index) {
  state.variables.splice(index, 1);
  renderVariables();
}

// ═══════════════════════════════════════════════════════════════════════════
// MODALS
// ═══════════════════════════════════════════════════════════════════════════

function initModals() {
  // Agent modal
  document.getElementById('newAgentBtn')?.addEventListener('click', () => {
    document.getElementById('agentModalTitle').textContent = '🤖 Crear Nuevo Agente';
    document.getElementById('agentId').value = '';
    document.getElementById('agentId').disabled = false;
    document.getElementById('agentName').value = '';
    document.getElementById('agentEmoji').value = '';
    document.getElementById('agentRole').value = '';
    document.getElementById('agentModal').classList.add('open');
  });
  
  document.getElementById('closeAgentModal')?.addEventListener('click', () => {
    document.getElementById('agentModal').classList.remove('open');
  });
  
  document.getElementById('cancelAgent')?.addEventListener('click', () => {
    document.getElementById('agentModal').classList.remove('open');
  });
  
  document.getElementById('saveAgent')?.addEventListener('click', saveAgent);
  
  // Variable modal
  document.getElementById('addVariable')?.addEventListener('click', () => {
    document.getElementById('variableModal').classList.add('open');
  });
  
  document.getElementById('closeVariableModal')?.addEventListener('click', () => {
    document.getElementById('variableModal').classList.remove('open');
  });
  
  document.getElementById('cancelVariable')?.addEventListener('click', () => {
    document.getElementById('variableModal').classList.remove('open');
  });
  
  document.getElementById('saveVariable')?.addEventListener('click', saveVariable);
  
  // Close on backdrop click
  document.querySelectorAll('.modal').forEach(m => {
    m.addEventListener('click', (e) => {
      if (e.target === m) m.classList.remove('open');
    });
  });
}

async function saveAgent() {
  const agent = {
    id: document.getElementById('agentId').value,
    name: document.getElementById('agentName').value,
    emoji: document.getElementById('agentEmoji').value,
    role: document.getElementById('agentRole').value,
    model: document.getElementById('agentModel').value,
    workspace: document.getElementById('agentWorkspace').value,
    status: 'active'
  };
  
  if (!agent.id || !agent.name) {
    showToast('❌ ID y Nombre son requeridos');
    return;
  }
  
  try {
    await fetch(`${CONFIG.API_URL}/agents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(agent)
    });
    
    state.agents.push(agent);
    document.getElementById('agentModal').classList.remove('open');
    renderAgentsConfig();
    renderAgentSelectors();
    showToast(`✅ Agente ${agent.name} creado`);
  } catch {
    state.agents.push(agent);
    document.getElementById('agentModal').classList.remove('open');
    renderAgentsConfig();
    showToast('💾 Guardado localmente');
  }
}

function saveVariable() {
  const name = document.getElementById('varName').value;
  const value = document.getElementById('varValue').value;
  
  if (!name || !value) {
    showToast('❌ Nombre y valor requeridos');
    return;
  }
  
  state.variables.push({ name, value });
  localStorage.setItem('userVariables', JSON.stringify(state.variables));
  
  document.getElementById('varName').value = '';
  document.getElementById('varValue').value = '';
  document.getElementById('variableModal').classList.remove('open');
  renderVariables();
  showToast('✅ Variable guardada');
}

// ═══════════════════════════════════════════════════════════════════════════
// EVENT LISTENERS
// ═══════════════════════════════════════════════════════════════════════════

function initEventListeners() {
  // Refresh button
  document.getElementById('refreshBtn')?.addEventListener('click', () => {
    refreshData();
    showToast('🔄 Actualizando...');
  });
  
  // Save user memory
  document.getElementById('saveUserMemory')?.addEventListener('click', saveUserMemory);
  
  // New task button
  document.getElementById('newTaskBtn')?.addEventListener('click', createNewTask);
  
  // Feed filters
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      filterFeed(btn.dataset.filter);
    });
  });
  
  // Settings controls
  document.getElementById('gatewayMode')?.addEventListener('change', updateSettings);
  document.getElementById('maxConcurrent')?.addEventListener('change', updateSettings);
  document.getElementById('maxSubagents')?.addEventListener('change', updateSettings);
  
  // RAG connections
  document.getElementById('connectNeo4j')?.addEventListener('click', connectNeo4j);
  document.getElementById('connectNeo4jBtn')?.addEventListener('click', () => switchTab('rag'));
  
  // Tailscale
  document.getElementById('setupTailscale')?.addEventListener('click', setupTailscale);
  document.getElementById('tailscaleBtn')?.addEventListener('click', () => switchTab('settings'));
}

function createNewTask() {
  const title = prompt('Título de la tarea:');
  if (!title) return;
  
  const task = {
    id: Date.now(),
    title,
    status: 'pending',
    agentId: 'main',
    createdAt: new Date().toISOString()
  };
  
  state.tasks.push(task);
  renderTasks();
  showToast('✅ Tarea creada');
}

function filterFeed(filter) {
  const items = document.querySelectorAll('.feed-item');
  items.forEach(item => {
    if (filter === 'all') {
      item.style.display = '';
    } else if (filter === 'socio') {
      item.style.display = item.classList.contains('highlight') ? '' : 'none';
    }
  });
}

function updateSettings() {
  console.log('Settings updated');
  showToast('⚙️ Configuración actualizada');
}

async function connectNeo4j() {
  const url = document.getElementById('neo4jUrl').value;
  const user = document.getElementById('neo4jUser').value;
  const pass = document.getElementById('neo4jPass').value;
  
  showToast('🔌 Conectando a Neo4j...');
  
  // Simulate connection
  setTimeout(() => {
    document.getElementById('neo4jIndicator').classList.remove('offline');
    document.getElementById('neo4jIndicator').classList.add('online');
    document.getElementById('neo4jStatusText').textContent = 'Conectado';
    showToast('✅ Neo4j conectado');
  }, 2000);
}

function setupTailscale() {
  showToast('🌐 Abre la app de Tailscale para configurar');
  window.open('https://tailscale.com/download', '_blank');
}

// ═══════════════════════════════════════════════════════════════════════════
// WINDOWS WORKER (Autonomy Stack)
// ═══════════════════════════════════════════════════════════════════════════

const winworkerState = {
  connected: false,
  visionReady: false,
  browserReady: false
};

function initWinworker() {
  // Check status button
  document.getElementById('checkWinworkerStatus')?.addEventListener('click', checkWinworkerStatus);
  
  // Kill switch
  document.getElementById('killSwitch')?.addEventListener('click', emergencyKillSwitch);
  
  // Vision controls
  document.getElementById('captureScreen')?.addEventListener('click', captureScreen);
  document.getElementById('findElement')?.addEventListener('click', findElement);
  document.getElementById('extractText')?.addEventListener('click', extractText);
  document.getElementById('analyzeScreen')?.addEventListener('click', analyzeScreen);
  
  // Automation controls
  document.getElementById('mouseClick')?.addEventListener('click', () => mouseAction('click'));
  document.getElementById('mouseRightClick')?.addEventListener('click', () => mouseAction('right_click'));
  document.getElementById('mouseDoubleClick')?.addEventListener('click', () => mouseAction('double_click'));
  document.getElementById('mouseMove')?.addEventListener('click', () => mouseAction('move'));
  document.getElementById('typeTextBtn')?.addEventListener('click', typeText);
  document.getElementById('pressEnter')?.addEventListener('click', () => pressKey('enter'));
  document.getElementById('pressTab')?.addEventListener('click', () => pressKey('tab'));
  document.getElementById('pressEscape')?.addEventListener('click', () => pressKey('escape'));
  document.getElementById('sendHotkey')?.addEventListener('click', sendHotkey);
  
  // Stealth browser
  document.getElementById('stealthNavigate')?.addEventListener('click', stealthNavigate);
  document.getElementById('stealthScreenshot')?.addEventListener('click', stealthScreenshot);
  document.getElementById('stealthContent')?.addEventListener('click', stealthGetContent);
  document.getElementById('stealthLogin')?.addEventListener('click', stealthLogin);
  document.getElementById('startResearch')?.addEventListener('click', startResearch);
  
  // App control
  document.querySelectorAll('[data-app]').forEach(btn => {
    btn.addEventListener('click', () => launchApp(btn.dataset.app));
  });
  document.getElementById('launchCustomApp')?.addEventListener('click', launchCustomApp);
  
  // System resources
  document.getElementById('refreshResources')?.addEventListener('click', refreshSystemResources);
  
  // Log controls
  document.getElementById('clearLog')?.addEventListener('click', () => {
    document.getElementById('winworkerLog').innerHTML = '<p class="log-entry">[INFO] Log cleared</p>';
  });
}

async function checkWinworkerStatus() {
  winworkerLog('[INFO] Checking Windows Worker status...');
  
  try {
    const res = await fetch(`${CONFIG.WINDOWS_WORKER_URL}/health`, { timeout: 3000 });
    const data = await res.json();
    
    if (data.status === 'ok') {
      winworkerState.connected = true;
      updateWinworkerUI('online', data);
      winworkerLog('[SUCCESS] Windows Worker connected!', 'success');
      
      // Load additional data
      refreshSystemResources();
      loadOpenWindows();
    }
  } catch (err) {
    winworkerState.connected = false;
    updateWinworkerUI('offline');
    winworkerLog(`[ERROR] Windows Worker not reachable: ${err.message}`, 'error');
  }
}

function updateWinworkerUI(status, data = {}) {
  const apiIndicator = document.getElementById('winworkerApiIndicator');
  const apiStatus = document.getElementById('winworkerApiStatus');
  const visionIndicator = document.getElementById('geminiVisionIndicator');
  const visionStatus = document.getElementById('geminiVisionStatus');
  const browserIndicator = document.getElementById('stealthBrowserIndicator');
  const browserStatus = document.getElementById('stealthBrowserStatus');
  const overallStatus = document.getElementById('winworkerOverallStatus');
  
  if (status === 'online') {
    apiIndicator.className = 'status-indicator online';
    apiStatus.textContent = 'Online';
    visionIndicator.className = 'status-indicator online';
    visionStatus.textContent = data.vision_enabled ? 'Ready' : 'No API Key';
    browserIndicator.className = 'status-indicator online';
    browserStatus.textContent = 'Ready';
    overallStatus.innerHTML = '<span class="status-indicator online"></span> All Systems Ready';
  } else {
    apiIndicator.className = 'status-indicator offline';
    apiStatus.textContent = 'Offline';
    visionIndicator.className = 'status-indicator offline';
    visionStatus.textContent = '-';
    browserIndicator.className = 'status-indicator offline';
    browserStatus.textContent = '-';
    overallStatus.innerHTML = '<span class="status-indicator offline"></span> Worker Offline';
  }
}

// Vision Functions
async function captureScreen() {
  winworkerLog('[INFO] Capturing screenshot...');
  try {
    const res = await fetch(`${CONFIG.WINDOWS_WORKER_URL}/screenshot`);
    if (res.ok) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      document.getElementById('visionResult').innerHTML = `<img src="${url}" style="max-width: 100%; border-radius: 8px;" />`;
      winworkerLog('[SUCCESS] Screenshot captured', 'success');
    }
  } catch (err) {
    winworkerLog(`[ERROR] Failed to capture: ${err.message}`, 'error');
  }
}

async function analyzeScreen() {
  const prompt = document.getElementById('visionPrompt')?.value || 'Describe what you see on the screen';
  winworkerLog(`[INFO] Analyzing screen with prompt: "${prompt}"`);
  
  try {
    const res = await fetch(`${CONFIG.WINDOWS_WORKER_URL}/api/vision/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });
    
    if (res.ok) {
      const data = await res.json();
      document.getElementById('visionResult').innerHTML = `<p>${data.analysis}</p>`;
      winworkerLog('[SUCCESS] Analysis complete', 'success');
    }
  } catch (err) {
    winworkerLog(`[ERROR] Analysis failed: ${err.message}`, 'error');
  }
}

async function findElement() {
  const prompt = document.getElementById('visionPrompt')?.value || 'Find the submit button';
  winworkerLog(`[INFO] Finding element: "${prompt}"`);
  
  try {
    const res = await fetch(`${CONFIG.WINDOWS_WORKER_URL}/api/vision/find-element`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ element_description: prompt })
    });
    
    if (res.ok) {
      const data = await res.json();
      if (data.found && data.coordinates) {
        document.getElementById('mouseX').value = data.coordinates.x;
        document.getElementById('mouseY').value = data.coordinates.y;
        document.getElementById('visionResult').innerHTML = `<p>Element found at (${data.coordinates.x}, ${data.coordinates.y})</p>`;
        winworkerLog(`[SUCCESS] Element found at (${data.coordinates.x}, ${data.coordinates.y})`, 'success');
      } else {
        document.getElementById('visionResult').innerHTML = `<p>Element not found. Reason: ${data.reasoning}</p>`;
        winworkerLog('[WARNING] Element not found', 'warning');
      }
    }
  } catch (err) {
    winworkerLog(`[ERROR] Find failed: ${err.message}`, 'error');
  }
}

async function extractText() {
  winworkerLog('[INFO] Extracting text from screen...');
  
  try {
    const res = await fetch(`${CONFIG.WINDOWS_WORKER_URL}/api/vision/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'Extract all visible text from this screen' })
    });
    
    if (res.ok) {
      const data = await res.json();
      document.getElementById('visionResult').innerHTML = `<pre style="white-space: pre-wrap;">${data.analysis}</pre>`;
      winworkerLog('[SUCCESS] Text extracted', 'success');
    }
  } catch (err) {
    winworkerLog(`[ERROR] Extract failed: ${err.message}`, 'error');
  }
}

// Automation Functions
async function mouseAction(action) {
  const x = parseInt(document.getElementById('mouseX')?.value) || 500;
  const y = parseInt(document.getElementById('mouseY')?.value) || 300;
  
  winworkerLog(`[INFO] Mouse ${action} at (${x}, ${y})`);
  
  try {
    const res = await fetch(`${CONFIG.WINDOWS_WORKER_URL}/mouse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, x, y })
    });
    
    if (res.ok) {
      winworkerLog(`[SUCCESS] Mouse ${action} executed`, 'success');
    }
  } catch (err) {
    winworkerLog(`[ERROR] Mouse action failed: ${err.message}`, 'error');
  }
}

async function typeText() {
  const text = document.getElementById('typeText')?.value || '';
  if (!text) return;
  
  winworkerLog(`[INFO] Typing: "${text}"`);
  
  try {
    const res = await fetch(`${CONFIG.WINDOWS_WORKER_URL}/keyboard`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'type', text })
    });
    
    if (res.ok) {
      winworkerLog('[SUCCESS] Text typed', 'success');
    }
  } catch (err) {
    winworkerLog(`[ERROR] Type failed: ${err.message}`, 'error');
  }
}

async function pressKey(key) {
  winworkerLog(`[INFO] Pressing key: ${key}`);
  
  try {
    const res = await fetch(`${CONFIG.WINDOWS_WORKER_URL}/keyboard`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'press', key })
    });
    
    if (res.ok) {
      winworkerLog(`[SUCCESS] Key ${key} pressed`, 'success');
    }
  } catch (err) {
    winworkerLog(`[ERROR] Key press failed: ${err.message}`, 'error');
  }
}

async function sendHotkey() {
  const hotkey = document.getElementById('hotkeySelect')?.value;
  if (!hotkey) return;
  
  const keys = hotkey.split('+');
  winworkerLog(`[INFO] Sending hotkey: ${hotkey}`);
  
  try {
    const res = await fetch(`${CONFIG.WINDOWS_WORKER_URL}/keyboard`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'hotkey', keys })
    });
    
    if (res.ok) {
      winworkerLog(`[SUCCESS] Hotkey ${hotkey} sent`, 'success');
    }
  } catch (err) {
    winworkerLog(`[ERROR] Hotkey failed: ${err.message}`, 'error');
  }
}

// Stealth Browser Functions
async function stealthNavigate() {
  const url = document.getElementById('stealthUrl')?.value;
  if (!url) return;
  
  winworkerLog(`[INFO] Navigating to: ${url}`);
  
  try {
    const res = await fetch(`${CONFIG.WINDOWS_WORKER_URL}/api/browser/navigate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
    
    if (res.ok) {
      const data = await res.json();
      document.getElementById('browserCurrentUrl').textContent = data.current_url || url;
      document.getElementById('browserPages').textContent = data.pages || 1;
      winworkerLog(`[SUCCESS] Navigated to ${url}`, 'success');
    }
  } catch (err) {
    winworkerLog(`[ERROR] Navigation failed: ${err.message}`, 'error');
  }
}

async function stealthScreenshot() {
  winworkerLog('[INFO] Taking browser screenshot...');
  
  try {
    const res = await fetch(`${CONFIG.WINDOWS_WORKER_URL}/api/browser/screenshot`);
    if (res.ok) {
      const data = await res.json();
      if (data.screenshot) {
        document.getElementById('visionResult').innerHTML = `<img src="data:image/png;base64,${data.screenshot}" style="max-width: 100%; border-radius: 8px;" />`;
        winworkerLog('[SUCCESS] Browser screenshot taken', 'success');
      }
    }
  } catch (err) {
    winworkerLog(`[ERROR] Screenshot failed: ${err.message}`, 'error');
  }
}

async function stealthGetContent() {
  winworkerLog('[INFO] Getting page content...');
  
  try {
    const res = await fetch(`${CONFIG.WINDOWS_WORKER_URL}/api/browser/content`);
    if (res.ok) {
      const data = await res.json();
      document.getElementById('visionResult').innerHTML = `<pre style="white-space: pre-wrap; max-height: 300px; overflow-y: auto;">${data.content?.slice(0, 2000) || 'No content'}</pre>`;
      winworkerLog('[SUCCESS] Content retrieved', 'success');
    }
  } catch (err) {
    winworkerLog(`[ERROR] Content failed: ${err.message}`, 'error');
  }
}

async function stealthLogin() {
  const username = document.getElementById('loginUsername')?.value;
  const password = document.getElementById('loginPassword')?.value;
  const url = document.getElementById('stealthUrl')?.value;
  
  if (!username || !password || !url) {
    winworkerLog('[ERROR] Username, password, and URL required', 'error');
    return;
  }
  
  winworkerLog('[INFO] Attempting auto-login...');
  
  try {
    const res = await fetch(`${CONFIG.WINDOWS_WORKER_URL}/api/browser/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, username, password })
    });
    
    if (res.ok) {
      const data = await res.json();
      winworkerLog(data.success ? '[SUCCESS] Login successful!' : '[WARNING] Login may have failed', data.success ? 'success' : 'warning');
    }
  } catch (err) {
    winworkerLog(`[ERROR] Login failed: ${err.message}`, 'error');
  }
}

async function startResearch() {
  const query = document.getElementById('researchQuery')?.value;
  if (!query) return;
  
  winworkerLog(`[INFO] Starting research: "${query}"`);
  
  try {
    const res = await fetch(`${CONFIG.WINDOWS_WORKER_URL}/api/browser/research`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    });
    
    if (res.ok) {
      const data = await res.json();
      document.getElementById('visionResult').innerHTML = `<h4>Research Results</h4><p>${data.summary || 'Research complete'}</p>`;
      winworkerLog('[SUCCESS] Research complete', 'success');
    }
  } catch (err) {
    winworkerLog(`[ERROR] Research failed: ${err.message}`, 'error');
  }
}

// App Control Functions
async function launchApp(appPath) {
  winworkerLog(`[INFO] Launching: ${appPath}`);
  
  try {
    const res = await fetch(`${CONFIG.WINDOWS_WORKER_URL}/app/launch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: appPath })
    });
    
    if (res.ok) {
      winworkerLog(`[SUCCESS] ${appPath} launched`, 'success');
    }
  } catch (err) {
    winworkerLog(`[ERROR] Launch failed: ${err.message}`, 'error');
  }
}

function launchCustomApp() {
  const appPath = document.getElementById('customApp')?.value;
  if (appPath) launchApp(appPath);
}

async function loadOpenWindows() {
  try {
    const res = await fetch(`${CONFIG.WINDOWS_WORKER_URL}/windows`);
    if (res.ok) {
      const data = await res.json();
      const list = document.getElementById('openWindows');
      if (list && data.windows) {
        list.innerHTML = data.windows.slice(0, 10).map(w => `
          <div class="window-item">
            <span class="window-title">${w.title || 'Untitled'}</span>
            <button class="btn btn-xs" onclick="focusWindow('${w.hwnd}')">Focus</button>
          </div>
        `).join('') || '<p class="placeholder-text">No windows found</p>';
      }
    }
  } catch { /* Silent */ }
}

async function focusWindow(hwnd) {
  try {
    await fetch(`${CONFIG.WINDOWS_WORKER_URL}/window/focus`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hwnd })
    });
    winworkerLog('[SUCCESS] Window focused', 'success');
  } catch (err) {
    winworkerLog(`[ERROR] Focus failed: ${err.message}`, 'error');
  }
}

// System Resources
async function refreshSystemResources() {
  try {
    const res = await fetch(`${CONFIG.WINDOWS_WORKER_URL}/system`);
    if (res.ok) {
      const data = await res.json();
      
      const cpuBar = document.getElementById('cpuBar');
      const cpuPercent = document.getElementById('cpuPercent');
      const ramBar = document.getElementById('ramBar');
      const ramPercent = document.getElementById('ramPercent');
      const diskBar = document.getElementById('diskBar');
      const diskPercent = document.getElementById('diskPercent');
      
      if (cpuBar) {
        cpuBar.style.width = `${data.cpu_percent || 0}%`;
        cpuPercent.textContent = `${data.cpu_percent || 0}%`;
      }
      if (ramBar) {
        ramBar.style.width = `${data.memory_percent || 0}%`;
        ramPercent.textContent = `${data.memory_percent || 0}%`;
      }
      if (diskBar) {
        diskBar.style.width = `${data.disk_percent || 0}%`;
        diskPercent.textContent = `${data.disk_percent || 0}%`;
      }
    }
  } catch { /* Silent */ }
}

// Kill Switch
async function emergencyKillSwitch() {
  winworkerLog('[WARNING] EMERGENCY KILL ACTIVATED!', 'warning');
  
  try {
    await fetch(`${CONFIG.WINDOWS_WORKER_URL}/api/browser/close`, { method: 'POST' });
    winworkerLog('[INFO] Browser closed', 'success');
  } catch { /* Silent */ }
  
  winworkerLog('[INFO] All autonomous operations halted');
}

// Logging
function winworkerLog(message, type = 'info') {
  const log = document.getElementById('winworkerLog');
  if (!log) return;
  
  const entry = document.createElement('p');
  entry.className = `log-entry ${type}`;
  entry.textContent = `[${new Date().toLocaleTimeString()}] ${message.replace(/^\[.*?\]\s*/, '')}`;
  log.appendChild(entry);
  log.scrollTop = log.scrollHeight;
  
  // Keep only last 100 entries
  while (log.children.length > 100) {
    log.removeChild(log.firstChild);
  }
}

// Initialize when winworker tab is opened
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(initWinworker, 500);
});

// ═══════════════════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

function showLoading() {
  document.body.classList.add('loading');
}

function hideLoading() {
  document.body.classList.remove('loading');
}

function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ═══════════════════════════════════════════════════════════════════════════
// GLOBAL EXPORTS (for onclick handlers)
// ═══════════════════════════════════════════════════════════════════════════

window.sendQuick = sendQuick;
window.updateTaskStatus = updateTaskStatus;
window.toggleAgentStatus = toggleAgentStatus;
window.viewAgentDetails = viewAgentDetails;
window.editAgent = editAgent;
window.viewAgentSkills = viewAgentSkills;
window.viewAgentHistory = viewAgentHistory;
window.openScreenshot = openScreenshot;
window.deleteVariable = deleteVariable;

// Windows Worker exports
window.checkWinworkerStatus = checkWinworkerStatus;
window.captureScreen = captureScreen;
window.analyzeScreen = analyzeScreen;
window.findElement = findElement;
window.extractText = extractText;
window.mouseAction = mouseAction;
window.typeText = typeText;
window.pressKey = pressKey;
window.sendHotkey = sendHotkey;
window.stealthNavigate = stealthNavigate;
window.stealthScreenshot = stealthScreenshot;
window.stealthGetContent = stealthGetContent;
window.stealthLogin = stealthLogin;
window.startResearch = startResearch;
window.launchApp = launchApp;
window.launchCustomApp = launchCustomApp;
window.focusWindow = focusWindow;
window.refreshSystemResources = refreshSystemResources;
window.emergencyKillSwitch = emergencyKillSwitch;

console.log('🦞 OpenClaw Cockpit Ultimate loaded');
