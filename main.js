const storageKey = 'story-workspace';
const canvas = document.getElementById('canvas');
const sceneListEl = document.getElementById('sceneList');
const variablesListEl = document.getElementById('variablesList');
const inspector = document.getElementById('inspector');
const inspectorBody = document.getElementById('inspectorBody');
const emptyInspector = document.getElementById('emptyInspector');

const sceneTitleInput = document.getElementById('sceneTitle');
const sceneBodyInput = document.getElementById('sceneBody');
const sceneBgInput = document.getElementById('sceneBg');
const sceneImageInput = document.getElementById('sceneImage');
const sceneAudioInput = document.getElementById('sceneAudio');
const sceneVideoInput = document.getElementById('sceneVideo');
const startSceneSelect = document.getElementById('startSceneSelect');

const choicesListEl = document.getElementById('choicesList');
const choiceTemplate = document.getElementById('choiceTemplate');

const addSceneBtn = document.getElementById('addSceneBtn');
const addChoiceBtn = document.getElementById('addChoiceBtn');
const deleteSceneBtn = document.getElementById('deleteSceneBtn');
const addVariableBtn = document.getElementById('addVariableBtn');

const previewBtn = document.getElementById('previewBtn');
const closePreviewBtn = document.getElementById('closePreviewBtn');
const previewModal = document.getElementById('preview');
const previewTitle = document.getElementById('previewTitle');
const previewSubtitle = document.getElementById('previewSubtitle');
const previewText = document.getElementById('previewText');
const previewChoices = document.getElementById('previewChoices');
const previewMedia = document.getElementById('previewMedia');
const previewVariables = document.getElementById('previewVariables');

const exportHtmlBtn = document.getElementById('exportHtmlBtn');
const exportJsonBtn = document.getElementById('exportJsonBtn');
const importJsonInput = document.getElementById('importJsonInput');
const shareBtn = document.getElementById('shareBtn');

let state = loadState();
let selectedSceneId = state.startSceneId || state.scenes[0]?.id;
let dragInfo = null;

function generateId(prefix = 'id') {
  return `${prefix}-${Math.random().toString(16).slice(2, 8)}`;
}

function loadState() {
  const urlParams = new URLSearchParams(window.location.search);
  const shared = urlParams.get('data');
  if (shared) {
    try {
      const decoded = JSON.parse(atob(shared));
      saveState(decoded);
      urlParams.delete('data');
      history.replaceState({}, '', `${location.pathname}${urlParams.toString() ? '?' + urlParams.toString() : ''}`);
      return decoded;
    } catch (e) {
      console.error('Cannot load shared data', e);
    }
  }
  const stored = localStorage.getItem(storageKey);
  if (stored) {
    try { return JSON.parse(stored); } catch (e) { console.warn(e); }
  }
  return createDefaultState();
}

function saveState(nextState = state) {
  state = nextState;
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function createDefaultState() {
  const firstSceneId = generateId('scene');
  const intro = {
    id: firstSceneId,
    title: 'Початок',
    body: 'Опишіть першу сцену, додайте вибори та мультимедіа.',
    choices: [],
    media: { bg: '', image: '', audio: '', video: '' },
    position: { x: 120, y: 120 }
  };
  return { scenes: [intro], variables: [{ name: 'score', value: 0 }], startSceneId: firstSceneId };
}

function setSelectedScene(id) {
  selectedSceneId = id;
  renderSceneList();
  renderCanvas();
  renderInspector();
  saveState();
}

function renderSceneList() {
  sceneListEl.innerHTML = '';
  state.scenes.forEach(scene => {
    const item = document.createElement('div');
    item.className = `scene-item ${scene.id === selectedSceneId ? 'active' : ''}`;
    item.innerHTML = `<strong>${scene.title || 'Без назви'}</strong><small>${scene.choices.length} варіант(и)</small>`;
    item.addEventListener('click', () => setSelectedScene(scene.id));
    sceneListEl.appendChild(item);
  });
}

function renderVariables() {
  variablesListEl.innerHTML = '';
  state.variables.forEach((variable, index) => {
    const row = document.createElement('div');
    row.className = 'variable-row';
    const name = document.createElement('input');
    name.value = variable.name;
    name.placeholder = 'імʼя';
    name.addEventListener('input', () => {
      variable.name = name.value;
      saveState();
      renderPreviewIfOpen();
    });

    const value = document.createElement('input');
    value.value = variable.value;
    value.placeholder = 'значення';
    value.addEventListener('input', () => {
      variable.value = parseValue(value.value);
      saveState();
    });

    const remove = document.createElement('button');
    remove.textContent = '×';
    remove.className = 'ghost danger';
    remove.addEventListener('click', () => {
      state.variables.splice(index, 1);
      saveState();
      renderVariables();
    });

    row.append(name, value, remove);
    variablesListEl.appendChild(row);
  });
}

function renderCanvas() {
  canvas.innerHTML = '';
  const lines = [];
  state.scenes.forEach(scene => {
    const node = document.createElement('div');
    node.className = 'node';
    node.style.left = `${scene.position?.x || 100}px`;
    node.style.top = `${scene.position?.y || 100}px`;
    node.dataset.id = scene.id;

    const header = document.createElement('div');
    header.className = 'node-header';
    const title = document.createElement('div');
    title.className = 'title';
    title.textContent = scene.title || 'Без назви';
    const badge = document.createElement('div');
    badge.className = 'badge';
    badge.textContent = `${scene.choices.length} виб.`;
    header.append(title, badge);

    const body = document.createElement('div');
    body.className = 'body';
    body.textContent = (scene.body || '').slice(0, 90);

    const startTag = document.createElement('div');
    if (scene.id === state.startSceneId) {
      startTag.className = 'linked';
      startTag.textContent = 'Старт';
    }

    node.append(header, body, startTag);
    node.addEventListener('mousedown', startDrag);
    node.addEventListener('click', () => setSelectedScene(scene.id));

    canvas.appendChild(node);

    scene.choices.forEach(choice => {
      if (choice.targetId) {
        lines.push({ from: scene.id, to: choice.targetId });
      }
    });
  });

  lines.forEach(line => drawConnection(line.from, line.to));
}

function drawConnection(fromId, toId) {
  const fromEl = canvas.querySelector(`[data-id="${fromId}"]`);
  const toEl = canvas.querySelector(`[data-id="${toId}"]`);
  if (!fromEl || !toEl) return;
  const fromRect = fromEl.getBoundingClientRect();
  const toRect = toEl.getBoundingClientRect();
  const canvasRect = canvas.getBoundingClientRect();

  const startX = fromRect.left + fromRect.width / 2 - canvasRect.left;
  const startY = fromRect.top + fromRect.height / 2 - canvasRect.top;
  const endX = toRect.left + toRect.width / 2 - canvasRect.left;
  const endY = toRect.top + toRect.height / 2 - canvasRect.top;

  const dx = endX - startX;
  const dy = endY - startY;
  const length = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx) * 180 / Math.PI;

  const link = document.createElement('div');
  link.className = 'link-line';
  link.style.width = `${length}px`;
  link.style.transform = `translate(${startX}px, ${startY}px) rotate(${angle}deg)`;
  canvas.appendChild(link);
}

function renderInspector() {
  const scene = state.scenes.find(s => s.id === selectedSceneId);
  if (!scene) {
    inspectorBody.classList.add('hidden');
    emptyInspector.classList.remove('hidden');
    return;
  }
  emptyInspector.classList.add('hidden');
  inspectorBody.classList.remove('hidden');

  sceneTitleInput.value = scene.title || '';
  sceneBodyInput.value = scene.body || '';
  sceneBgInput.value = scene.media?.bg || '';
  sceneImageInput.value = scene.media?.image || '';
  sceneAudioInput.value = scene.media?.audio || '';
  sceneVideoInput.value = scene.media?.video || '';

  renderStartSceneSelect();
  renderChoices(scene);
}

function renderStartSceneSelect() {
  startSceneSelect.innerHTML = '';
  state.scenes.forEach(scene => {
    const option = document.createElement('option');
    option.value = scene.id;
    option.textContent = scene.title || 'Без назви';
    if (scene.id === state.startSceneId) option.selected = true;
    startSceneSelect.appendChild(option);
  });
}

function renderChoices(scene) {
  choicesListEl.innerHTML = '';
  scene.choices.forEach((choice, index) => {
    const clone = choiceTemplate.content.cloneNode(true);
    const card = clone.querySelector('.choice-card');
    const textInput = clone.querySelector('.choice-text');
    const targetSelect = clone.querySelector('.choice-target');
    const conditionInput = clone.querySelector('.choice-condition');
    const variablesInput = clone.querySelector('.choice-variables');
    const removeBtn = clone.querySelector('.remove-choice');

    textInput.value = choice.text;
    conditionInput.value = choice.condition || '';
    variablesInput.value = choice.effects || '';

    state.scenes.forEach(sceneOption => {
      const opt = document.createElement('option');
      opt.value = sceneOption.id;
      opt.textContent = sceneOption.title || 'Без назви';
      if (sceneOption.id === choice.targetId) opt.selected = true;
      targetSelect.appendChild(opt);
    });

    textInput.addEventListener('input', () => { choice.text = textInput.value; saveState(); renderSceneList(); renderCanvas(); });
    targetSelect.addEventListener('change', () => { choice.targetId = targetSelect.value; saveState(); renderCanvas(); });
    conditionInput.addEventListener('input', () => { choice.condition = conditionInput.value; saveState(); });
    variablesInput.addEventListener('input', () => { choice.effects = variablesInput.value; saveState(); });
    removeBtn.addEventListener('click', () => { scene.choices.splice(index, 1); saveState(); renderInspector(); renderCanvas(); });

    choicesListEl.appendChild(clone);
  });
}

function startDrag(event) {
  if (!event.target.closest('.node')) return;
  dragInfo = {
    id: event.currentTarget.dataset.id,
    offsetX: event.offsetX,
    offsetY: event.offsetY
  };
  document.addEventListener('mousemove', onDrag);
  document.addEventListener('mouseup', endDrag);
}

function onDrag(event) {
  if (!dragInfo) return;
  const node = canvas.querySelector(`[data-id="${dragInfo.id}"]`);
  if (!node) return;
  const x = event.clientX - canvas.getBoundingClientRect().left - dragInfo.offsetX;
  const y = event.clientY - canvas.getBoundingClientRect().top - dragInfo.offsetY;
  node.style.left = `${x}px`;
  node.style.top = `${y}px`;
}

function endDrag(event) {
  if (!dragInfo) return;
  const scene = state.scenes.find(s => s.id === dragInfo.id);
  if (scene) {
    scene.position = {
      x: event.clientX - canvas.getBoundingClientRect().left - dragInfo.offsetX,
      y: event.clientY - canvas.getBoundingClientRect().top - dragInfo.offsetY
    };
    saveState();
    renderCanvas();
  }
  dragInfo = null;
  document.removeEventListener('mousemove', onDrag);
  document.removeEventListener('mouseup', endDrag);
}

function parseValue(input) {
  if (input === undefined) return '';
  if (typeof input === 'number') return input;
  const trimmed = String(input).trim();
  if (trimmed === '') return '';
  if (!isNaN(Number(trimmed))) return Number(trimmed);
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  return trimmed.replace(/^['"]|['"]$/g, '');
}

function addScene() {
  const id = generateId('scene');
  const scene = {
    id,
    title: 'Нова сцена',
    body: 'Опишіть події або діалоги.',
    choices: [],
    media: { bg: '', image: '', audio: '', video: '' },
    position: { x: 80 + state.scenes.length * 40, y: 80 + state.scenes.length * 20 }
  };
  state.scenes.push(scene);
  if (!state.startSceneId) state.startSceneId = id;
  saveState();
  renderSceneList();
  renderCanvas();
  setSelectedScene(id);
}

function addChoice() {
  const scene = state.scenes.find(s => s.id === selectedSceneId);
  if (!scene) return;
  scene.choices.push({ id: generateId('choice'), text: 'Новий вибір', targetId: state.startSceneId, condition: '', effects: '' });
  saveState();
  renderInspector();
  renderCanvas();
}

function deleteScene() {
  const index = state.scenes.findIndex(s => s.id === selectedSceneId);
  if (index === -1) return;
  state.scenes.splice(index, 1);
  if (state.startSceneId === selectedSceneId) {
    state.startSceneId = state.scenes[0]?.id;
  }
  selectedSceneId = state.scenes[0]?.id;
  saveState();
  renderSceneList();
  renderCanvas();
  renderInspector();
}

function updateSceneField(key, value) {
  const scene = state.scenes.find(s => s.id === selectedSceneId);
  if (!scene) return;
  if (key === 'media') {
    scene.media = { ...scene.media, ...value };
  } else {
    scene[key] = value;
  }
  saveState();
  renderSceneList();
  renderCanvas();
}

function addVariable() {
  state.variables.push({ name: `var${state.variables.length + 1}`, value: 0 });
  saveState();
  renderVariables();
}

function evaluateCondition(expr, vars) {
  if (!expr || !expr.trim()) return true;
  try {
    const fn = new Function('vars', `with(vars) { return ${expr}; }`);
    return Boolean(fn({ ...vars }));
  } catch (e) {
    console.warn('Condition error', e);
    return false;
  }
}

function applyVariableEffects(effects, vars) {
  if (!effects) return { ...vars };
  const next = { ...vars };
  effects.split(',').forEach(pair => {
    const [name, raw] = pair.split('=');
    if (!name || raw === undefined) return;
    const key = name.trim();
    const valueExpr = raw.trim();
    if (!key) return;
    try {
      const fn = new Function('vars', `with(vars) { return ${valueExpr}; }`);
      next[key] = fn(next);
    } catch (e) {
      next[key] = parseValue(valueExpr);
    }
  });
  return next;
}

function getInitialVariables() {
  const vars = {};
  state.variables.forEach(v => {
    if (v.name) vars[v.name] = v.value;
  });
  return vars;
}

function renderPreviewIfOpen() {
  if (!previewModal.classList.contains('hidden')) {
    openPreview(currentPreviewScene?.id || state.startSceneId, currentPreviewVars);
  }
}

let currentPreviewScene = null;
let currentPreviewVars = null;

function openPreview(sceneId = state.startSceneId, vars = getInitialVariables()) {
  currentPreviewVars = { ...vars };
  const scene = state.scenes.find(s => s.id === sceneId) || state.scenes[0];
  currentPreviewScene = scene;
  previewModal.classList.remove('hidden');
  if (!scene) return;

  previewTitle.textContent = scene.title || 'Без назви';
  previewSubtitle.textContent = scene.media?.bg ? 'Є фон та мультимедіа' : 'Без фону';
  previewText.textContent = scene.body || '';

  previewMedia.innerHTML = '';
  if (scene.media?.bg) {
    previewMedia.style.backgroundImage = `url(${scene.media.bg})`;
    previewMedia.style.backgroundSize = 'cover';
    previewMedia.style.backgroundPosition = 'center';
    previewMedia.style.minHeight = '120px';
    previewMedia.style.borderRadius = '12px';
  } else {
    previewMedia.style.backgroundImage = '';
    previewMedia.style.minHeight = '0';
  }
  if (scene.media?.image) {
    const img = document.createElement('img');
    img.src = scene.media.image;
    img.alt = 'зображення';
    previewMedia.appendChild(img);
  }
  if (scene.media?.video) {
    const video = document.createElement('video');
    video.src = scene.media.video;
    video.controls = true;
    video.autoplay = true;
    video.loop = true;
    previewMedia.appendChild(video);
  }
  if (scene.media?.audio) {
    const audio = document.createElement('audio');
    audio.src = scene.media.audio;
    audio.controls = true;
    audio.autoplay = true;
    audio.loop = true;
    previewMedia.appendChild(audio);
  }

  previewChoices.innerHTML = '';
  scene.choices.forEach(choice => {
    if (!evaluateCondition(choice.condition, currentPreviewVars)) return;
    const btn = document.createElement('button');
    btn.textContent = choice.text || 'Вибір';
    btn.addEventListener('click', () => {
      currentPreviewVars = applyVariableEffects(choice.effects, currentPreviewVars);
      openPreview(choice.targetId, currentPreviewVars);
    });
    previewChoices.appendChild(btn);
  });

  const varEntries = Object.entries(currentPreviewVars).map(([k, v]) => `${k}: ${v}`).join(' · ');
  previewVariables.textContent = `Змінні: ${varEntries || 'немає'}`;
}

function closePreview() {
  previewModal.classList.add('hidden');
}

function exportJSON() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'story.json';
  a.click();
  URL.revokeObjectURL(url);
}

function exportHTML() {
  const template = `<!DOCTYPE html>
<html lang="uk">
<head>
<meta charset="UTF-8" />
<title>Інтерактивна історія</title>
<style>
body { font-family: 'Inter', system-ui; background: #0c1023; color: #e7ecff; margin: 0; padding: 0; }
.container { max-width: 860px; margin: 0 auto; padding: 24px; }
header { display:flex; align-items:center; justify-content:space-between; gap:12px; }
button { background:#7c3aed; color:#fff; border:none; padding:10px 14px; border-radius:8px; cursor:pointer; font-weight:600; }
.card { background: #10162b; border:1px solid #22305c; padding: 16px; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.35); }
.media img, .media video { max-width: 100%; border-radius: 10px; }
.media audio { width: 100%; }
.choices { display:grid; gap:10px; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); margin-top:12px; }
.muted { color:#9aa9d6; font-size: 13px; }
</style>
</head>
<body>
<div class="container">
  <header>
    <div>
      <h1 id="viewerTitle">Історія</h1>
      <div class="muted">Експортовано з Bild Story Studio</div>
    </div>
    <button id="restartBtn">Почати спочатку</button>
  </header>
  <div class="card">
    <div id="viewerMedia" class="media"></div>
    <h2 id="viewerScene"></h2>
    <p id="viewerBody"></p>
    <div id="viewerChoices" class="choices"></div>
    <div class="muted" id="viewerVars"></div>
  </div>
</div>
<script>
const story = ${JSON.stringify(state)};
let vars = {};
let currentScene = null;
function reset() {
  vars = {};
  story.variables.forEach(v => { if (v.name) vars[v.name] = v.value; });
  openScene(story.startSceneId || story.scenes[0].id);
}
function evaluate(expr) {
  if (!expr) return true;
  try { return Boolean(Function('vars', `with(vars) { return ${expr}; }`)(vars)); } catch (e) { return false; }
}
function applyEffects(effects) {
  if (!effects) return;
  effects.split(',').forEach(pair => {
    const [name, raw] = pair.split('=');
    if (!name || raw === undefined) return;
    try {
      vars[name.trim()] = Function('vars', `with(vars) { return ${raw}; }`)(vars);
    } catch (e) {
      vars[name.trim()] = raw.trim();
    }
  });
}
function openScene(id) {
  currentScene = story.scenes.find(s => s.id === id) || story.scenes[0];
  if (!currentScene) return;
  document.getElementById('viewerScene').textContent = currentScene.title || 'Без назви';
  document.getElementById('viewerBody').textContent = currentScene.body || '';
  const media = document.getElementById('viewerMedia');
  media.innerHTML = '';
  if (currentScene.media?.image) { const img = document.createElement('img'); img.src = currentScene.media.image; media.appendChild(img); }
  if (currentScene.media?.video) { const video = document.createElement('video'); video.src = currentScene.media.video; video.controls = true; video.autoplay = true; video.loop = true; media.appendChild(video); }
  if (currentScene.media?.audio) { const audio = document.createElement('audio'); audio.src = currentScene.media.audio; audio.controls = true; audio.autoplay = true; audio.loop = true; media.appendChild(audio); }
  const choicesEl = document.getElementById('viewerChoices');
  choicesEl.innerHTML = '';
  currentScene.choices.forEach(choice => {
    if (!evaluate(choice.condition)) return;
    const btn = document.createElement('button');
    btn.textContent = choice.text || 'Продовжити';
    btn.onclick = () => { applyEffects(choice.effects); openScene(choice.targetId); updateVars(); };
    choicesEl.appendChild(btn);
  });
  updateVars();
}
function updateVars() {
  const list = Object.entries(vars).map(([k,v]) => `${k}: ${v}`).join(' · ');
  document.getElementById('viewerVars').textContent = 'Змінні: ' + (list || 'немає');
}
document.getElementById('restartBtn').addEventListener('click', reset);
reset();
</script>
</body>
</html>`;

  const blob = new Blob([template], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'story.html';
  a.click();
  URL.revokeObjectURL(url);
}

function importJSON(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      state = data;
      saveState();
      renderSceneList();
      renderVariables();
      renderCanvas();
      setSelectedScene(state.startSceneId || state.scenes[0]?.id);
    } catch (e) {
      alert('Не вдалося прочитати файл');
    }
  };
  reader.readAsText(file);
}

function shareProject() {
  const encoded = btoa(JSON.stringify(state));
  const url = `${location.origin}${location.pathname}?data=${encodeURIComponent(encoded)}`;
  navigator.clipboard.writeText(url).then(() => {
    shareBtn.textContent = 'Посилання скопійовано!';
    setTimeout(() => shareBtn.textContent = 'Скопіювати посилання на проєкт', 1800);
  });
}

addSceneBtn.addEventListener('click', addScene);
addChoiceBtn.addEventListener('click', addChoice);
deleteSceneBtn.addEventListener('click', deleteScene);
addVariableBtn.addEventListener('click', addVariable);
previewBtn.addEventListener('click', () => openPreview());
closePreviewBtn.addEventListener('click', closePreview);
exportJsonBtn.addEventListener('click', exportJSON);
exportHtmlBtn.addEventListener('click', exportHTML);
shareBtn.addEventListener('click', shareProject);
importJsonInput.addEventListener('change', (e) => {
  const file = e.target.files?.[0];
  if (file) importJSON(file);
});

startSceneSelect.addEventListener('change', () => {
  state.startSceneId = startSceneSelect.value;
  saveState();
  renderCanvas();
});

sceneTitleInput.addEventListener('input', () => updateSceneField('title', sceneTitleInput.value));
sceneBodyInput.addEventListener('input', () => updateSceneField('body', sceneBodyInput.value));
sceneBgInput.addEventListener('input', () => updateSceneField('media', { bg: sceneBgInput.value }));
sceneImageInput.addEventListener('input', () => updateSceneField('media', { image: sceneImageInput.value }));
sceneAudioInput.addEventListener('input', () => updateSceneField('media', { audio: sceneAudioInput.value }));
sceneVideoInput.addEventListener('input', () => updateSceneField('media', { video: sceneVideoInput.value }));

window.addEventListener('resize', () => renderCanvas());

renderSceneList();
renderVariables();
renderCanvas();
renderInspector();
