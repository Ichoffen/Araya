const apiBase = 'http://localhost:3131';
const el = (id) => document.getElementById(id);
const ui = {
  projects: el('projects'),
  newProjectForm: el('newProjectForm'),
  newProjectName: el('newProjectName'),
  chat: el('chat'),
  input: el('input'),
  form: el('form'),
  model: el('model'),
  loadOlder: el('loadOlder'),
  attachBtn: el('attachBtn'),
  fileInput: el('fileInput'),
  openSettings: el('openSettings'),
  settingsModal: el('settingsModal'),
  apiKeyInput: el('apiKeyInput'),
  saveSettings: el('saveSettings'),
  closeSettings: el('closeSettings')
};
let state = { projectId: null, messages: [], oldestId: null, pendingAttachment: null, apiKey: '' };
async function fetchJSON(url, opts={}) { const res = await fetch(url, opts); if (!res.ok) throw new Error(await res.text()); return res.json(); }
async function init() { await loadProjects(); const settings = await fetchJSON(apiBase + '/api/settings'); state.apiKey = settings.apiKey || ''; if (!state.apiKey) openSettingsModal(); }
async function loadProjects() {
  const projs = await fetchJSON(apiBase + '/api/projects');
  ui.projects.innerHTML = '';
  projs.forEach(p => { const div = document.createElement('div'); div.className = 'project' + (state.projectId === p.id ? ' active' : ''); div.textContent = p.name; div.onclick = () => selectProject(p.id); ui.projects.appendChild(div); });
  if (!state.projectId && projs.length) selectProject(projs[0].id);
}
async function selectProject(id) { state.projectId = id; state.messages = []; state.oldestId = null; render(); await loadMessages(); }
async function loadMessages(beforeId=null) {
  const url = new URL(apiBase + '/api/messages'); url.searchParams.set('projectId', state.projectId); if (beforeId) url.searchParams.set('beforeId', beforeId); url.searchParams.set('limit', '50');
  const rows = await fetchJSON(url.toString()); if (rows.length) { state.oldestId = rows[0].id; state.messages = rows.concat(state.messages); } render();
}
function msgEl(m) { const div = document.createElement('div'); div.className = 'msg ' + m.role; const text = document.createElement('div'); text.textContent = m.content || ''; div.appendChild(text);
  if (m.attachment_path) { const img = document.createElement('img'); img.className = 'thumb'; img.src = apiBase + '/attachments/' + m.attachment_path.split('/').pop(); div.appendChild(img); } return div; }
function render() { ui.chat.innerHTML=''; for (const m of state.messages.slice(-50)) ui.chat.appendChild(msgEl(m)); ui.chat.scrollTop = ui.chat.scrollHeight; }
ui.loadOlder.addEventListener('click', async () => { if (!state.oldestId) return; await loadMessages(state.oldestId); });
ui.attachBtn.addEventListener('click', () => ui.fileInput.click());
ui.fileInput.addEventListener('change', async (e) => { const file = e.target.files[0]; if (!file) return; const base64 = await toDataURL(file); state.pendingAttachment = { dataUrl: base64, filename: file.name }; alert('Картинка прикреплена. Отправь сообщение, чтобы вложить.'); });
function toDataURL(file){ return new Promise((resolve)=>{ const r=new FileReader(); r.onload=()=>resolve(r.result); r.readAsDataURL(file); }); }
ui.form.addEventListener('submit', async (e) => {
  e.preventDefault(); const text = ui.input.value.trim(); if (!text && !state.pendingAttachment) return; ui.input.value='';
  const u = await fetchJSON(apiBase + '/api/messages', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ projectId: state.projectId, role:'user', content:text, attachment: state.pendingAttachment }) });
  state.pendingAttachment = null; state.messages.push(u); render();
  const placeholder = { id:-Date.now(), role:'assistant', content:'' }; state.messages.push(placeholder); render();
  const msgs = state.messages.map(m => ({ role: m.role, content: m.content }));
  const res = await fetch(apiBase + '/api/chat', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ projectId: state.projectId, model: ui.model.value, messages: msgs }) });
  const reader = res.body.getReader(); const decoder = new TextDecoder();
  while (true) { const { value, done } = await reader.read(); if (done) break; const chunk = decoder.decode(value); for (const part of chunk.split('\n\n')) { if (!part.startsWith('data:')) continue; const data = part.slice(5).trim(); if (data === '[DONE]') continue; try { const obj = JSON.parse(data); if (obj.delta) { placeholder.content += obj.delta; render(); } } catch {} } }
});
ui.newProjectForm.addEventListener('submit', async (e) => { e.preventDefault(); const name = ui.newProjectName.value.trim(); if (!name) return; ui.newProjectName.value=''; await fetchJSON(apiBase + '/api/projects', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ name }) }); await loadProjects(); });
function openSettingsModal(){ ui.apiKeyInput.value = state.apiKey || ''; ui.settingsModal.classList.remove('hidden'); }
function closeSettingsModal(){ ui.settingsModal.classList.add('hidden'); }
ui.openSettings.addEventListener('click', openSettingsModal);
ui.closeSettings.addEventListener('click', closeSettingsModal);
ui.saveSettings.addEventListener('click', async () => { const apiKey = ui.apiKeyInput.value.trim(); await fetchJSON(apiBase + '/api/settings', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ apiKey }) }); state.apiKey = apiKey; closeSettingsModal(); alert('Сохранено ✅'); });
init();
