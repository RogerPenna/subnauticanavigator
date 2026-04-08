/**
 * Subnautica Map & Navigation - Grist Widget
 */

const viewport = document.getElementById('compass-viewport');
const ribbon = document.getElementById('compass-ribbon');
const slideDist = document.getElementById('slideDist');
const canvas = document.getElementById('map-canvas');
const ctx = canvas.getContext('2d');

// State
let angle = 0;
let dist = 0;
let calComp = 0;
let calMapX = 0;
let calMapZ = 0;
let gristToken = "";
let gristBaseUrl = "";
let mapRange = 2000;
let maps = [];
let markers = [];
let markerTypes = []; // From Tipos_Marcadores table
let currentMapId = null;
let currentMarkerId = null;
let zoomLevel = 1;
let mapOffsetX = 0;
let mapOffsetZ = 0;
let markerScale = 1;

/**
 * Updates the global scale for all marker icons
 */
function updateMarkerScale(val) {
  markerScale = parseFloat(val);
  calculate();
}

// Constants
const tickWidth = 60;
const pxPerDeg = tickWidth / 15;
const mapImg = new Image();

/**
 * Updates the zoom level and redraws the map
 */
function updateZoom(val) {
  zoomLevel = parseFloat(val);
  document.getElementById('zoom-bar').value = zoomLevel;
  if (zoomLevel === 1) {
    mapOffsetX = 0;
    mapOffsetZ = 0;
  }
  calculate();
}

/**
 * Toggles the side panel menu for maps
 */
function toggleMenu() {
  const panel = document.getElementById('side-panel');
  panel.classList.toggle('open');
  if (panel.classList.contains('open')) {
    loadMaps();
    document.getElementById('markers-panel').classList.remove('open');
  }
}

/**
 * Toggles the side panel menu for markers
 */
function toggleMarkersMenu() {
  const panel = document.getElementById('markers-panel');
  panel.classList.toggle('open');
  if (panel.classList.contains('open')) {
    loadMarkers();
    document.getElementById('side-panel').classList.remove('open');
  }
}

/**
 * Loads marker types from the Tipos_Marcadores table
 */
async function loadMarkerTypes() {
  try {
    const records = await grist.docApi.fetchTable('Tipos_Marcadores');
    markerTypes = records.id.map((id, index) => ({
      id: id,
      Nome: records.Nome[index],
      Cor: records.Cor[index]
    }));
    updateTypesDropdowns();
  } catch (e) {
    console.error("Error loading types:", e);
  }
}

function updateTypesDropdowns() {
  const select = document.getElementById('m-type');
  select.innerHTML = '';
  markerTypes.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t.Nome;
    opt.innerText = t.Nome;
    select.appendChild(opt);
  });
}

/**
 * Loads markers from the Marcadores table
 */
async function loadMarkers() {
  try {
    const records = await grist.docApi.fetchTable('Marcadores');
    markers = records.id.map((id, index) => {
      const record = {};
      for (const key in records) {
        record[key] = records[key][index];
      }
      return record;
    });
    renderMarkersList();
  } catch (e) {
    console.error("Error loading markers:", e);
  }
}

/**
 * Renders the markers list
 */
function renderMarkersList() {
  const list = document.getElementById('markers-list');
  list.innerHTML = '';
  markers.forEach(m => {
    const item = document.createElement('div');
    item.className = `map-item ${m.id === currentMarkerId ? 'active' : ''}`;
    if (m.Concluido) item.style.borderLeft = "4px solid var(--sub-green)";
    
    const mX = m.X || 0;
    const mZ = m.Z || 0;
    const mDist = Math.round(Math.sqrt(mX**2 + mZ**2));
    const typeColor = markerTypes.find(t => t.Nome === m.Type)?.Cor || "#ffffff";

    item.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: start;">
        <div>
          <div style="font-weight: bold; color: white;">${m.Nome || `Ponto #${m.id}`}</div>
          <div class="marker-type" style="color: ${typeColor}">${m.Type || 'SEM TIPO'}</div>
        </div>
        <button class="cal-btn" style="padding: 2px 5px;" onclick="event.stopPropagation(); openMarkerModal(${JSON.stringify(m).replace(/"/g, '&quot;')})">✎</button>
      </div>
      <div class="marker-info">
        <span>X: ${Math.round(mX)}</span>
        <span>Z: ${Math.round(mZ)}</span>
        <span>PROF: ${Math.round(m.Y || 0)}</span>
        <span style="color: var(--sub-blue)">DIST: ${mDist}m</span>
      </div>
    `;
    item.onclick = () => selectMarker(m);
    list.appendChild(item);
  });
}

/**
 * Selects a marker and updates the coordinates
 */
function selectMarker(m) {
  currentMarkerId = m.id;
  const mX = m.X || 0;
  const mZ = m.Z || 0;
  dist = Math.round(Math.sqrt(mX**2 + mZ**2));
  angle = (Math.atan2(-mX, -mZ) * 180 / Math.PI + 360) % 360;
  slideDist.value = dist;
  if (m.Y !== undefined) {
    document.getElementById('valY').innerText = Math.round(m.Y);
  }
  renderMarkersList();
  calculate();
}

/**
 * Loads the list of maps from the Config_Mapa table
 */
async function loadMaps() {
  try {
    const records = await grist.docApi.fetchTable('Config_Mapa');
    maps = records.id.map((id, index) => {
      const record = {};
      for (const key in records) {
        record[key] = records[key][index];
      }
      return record;
    }).filter(m => m.EmUso === true);
    renderMapList();
  } catch (e) {
    console.error("Error loading maps:", e);
  }
}

function renderMapList() {
  const list = document.getElementById('map-list');
  list.innerHTML = '';
  maps.forEach(map => {
    const item = document.createElement('div');
    item.className = `map-item ${map.id === currentMapId ? 'active' : ''}`;
    item.innerText = map.Nome || `Mapa #${map.id}`;
    item.onclick = () => selectMap(map);
    list.appendChild(item);
  });
}

async function selectMap(map) {
  currentMapId = map.id;
  calMapX = map.CalMapX || 0;
  calMapZ = map.CalMapZ || 0;
  calComp = map.CalComp || 0;
  mapRange = map.MapRange || 2000;
  document.getElementById('valCalComp').innerText = calComp;
  document.getElementById('valCalMapX').innerText = calMapX;
  document.getElementById('valCalMapZ').innerText = calMapZ;
  document.getElementById('currentRange').innerText = mapRange;
  const att = map.ImagemMapa;
  let fileId = Array.isArray(att) ? (att[0] === 'L' ? att[1] : att[0]) : att;
  if (fileId && gristBaseUrl && gristToken) {
    mapImg.src = `${gristBaseUrl}/attachments/${fileId}/download?auth=${gristToken}`;
  }
  renderMapList();
  calculate();
  toggleMenu();
}

function createCompass() {
  ribbon.innerHTML = '';
  const subTickDeg = 45 / 6; 
  const totalTicks = 360 / subTickDeg;
  for (let loop = 0; loop < 7; loop++) {
    for (let i = 0; i < totalTicks; i++) {
      const currentAngle = i * subTickDeg;
      const div = document.createElement('div');
      div.className = 'tick';
      let label = "";
      if (Math.abs(currentAngle - 0) < 0.1) { label = "N"; div.classList.add('major'); }
      else if (Math.abs(currentAngle - 45) < 0.1) { label = "NE"; div.classList.add('ordinal'); }
      else if (Math.abs(currentAngle - 90) < 0.1) { label = "E"; div.classList.add('major'); }
      else if (Math.abs(currentAngle - 135) < 0.1) { label = "SE"; div.classList.add('ordinal'); }
      else if (Math.abs(currentAngle - 180) < 0.1) { label = "S"; div.classList.add('major'); }
      else if (Math.abs(currentAngle - 225) < 0.1) { label = "SW"; div.classList.add('ordinal'); }
      else if (Math.abs(currentAngle - 270) < 0.1) { label = "W"; div.classList.add('major'); }
      else if (Math.abs(currentAngle - 315) < 0.1) { label = "NW"; div.classList.add('ordinal'); }
      div.innerText = label;
      div.style.width = "30px"; 
      ribbon.appendChild(div);
    }
  }
}

function adjustCal(type, amt) {
  if (type === 'comp') calComp += amt;
  if (type === 'mapX') calMapX += amt;
  if (type === 'mapZ') calMapZ += amt;
  document.getElementById('valCalComp').innerText = calComp;
  document.getElementById('valCalMapX').innerText = calMapX;
  document.getElementById('valCalMapZ').innerText = calMapZ;
  calculate();
}

function manualScaleFix() {
  if (dist === 0) { alert("Clique em um ponto do mapa primeiro!"); return; }
  const realDist = prompt("Qual a distância real no jogo para este ponto?", dist);
  if (realDist !== null && !isNaN(realDist) && realDist > 0) {
    const ratio = dist / mapRange;
    mapRange = Math.round(realDist / ratio);
    document.getElementById('currentRange').innerText = mapRange;
    dist = parseInt(realDist);
    slideDist.value = dist;
    calculate();
  }
}

function calculate() {
  const cleanAngle = Math.round(angle);
  const rad = (cleanAngle * Math.PI) / 180;
  const x = Math.round(-dist * Math.sin(rad));
  const z = Math.round(-dist * Math.cos(rad));
  document.getElementById('valX').innerText = Object.is(x, -0) ? 0 : x;
  document.getElementById('valZ').innerText = Object.is(z, -0) ? 0 : z;
  document.getElementById('txtDist').innerText = dist;
  document.getElementById('txtAng').innerText = cleanAngle;
  const viewportWidth = viewport.getBoundingClientRect().width;
  const centerPoint = viewportWidth / 2;
  const scrollPos = (angle * (30/(45/6))) + (3 * 360 * (30/(45/6))) - centerPoint + calComp;
  ribbon.style.transform = `translateX(${-scrollPos}px)`;
  drawMap(x, z);
}

function drawPin(ctx, x, y, color, scale = 1, isCompleted = false) {
  const size = 15 * scale;
  ctx.save();
  ctx.translate(x, y);
  if (isCompleted) ctx.globalAlpha = 0.4;
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.beginPath(); ctx.ellipse(0, 0, size * 0.5, size * 0.2, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = color; ctx.strokeStyle = "white"; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(0, 0); 
  ctx.bezierCurveTo(-size * 0.6, -size * 0.6, -size * 0.6, -size * 1.5, 0, -size * 1.5);
  ctx.bezierCurveTo(size * 0.6, -size * 1.5, size * 0.6, -size * 0.6, 0, 0);
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = isCompleted ? "#00ff41" : "white";
  ctx.beginPath(); ctx.arc(0, -size * 1.1, size * 0.25, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawMap(x, z) {
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  const centerX = w / 2;
  const centerY = h / 2;
  const scale = (centerX / mapRange) * zoomLevel;
  ctx.save();
  ctx.translate(centerX + mapOffsetX, centerY + mapOffsetZ);
  ctx.scale(zoomLevel, zoomLevel);
  ctx.translate(-centerX, -centerY);
  if (mapImg.complete && mapImg.naturalWidth !== 0) {
    ctx.drawImage(mapImg, calMapX, calMapZ, w, h);
  }
  markers.forEach(m => {
    const mx = m.X || 0; const mz = m.Z || 0;
    const mvx = centerX + (mx * scale / zoomLevel);
    const mvz = centerY - (mz * scale / zoomLevel);
    const typeColor = markerTypes.find(t => t.Nome === m.Type)?.Cor || "#ffffff";
    drawPin(ctx, mvx, mvz, typeColor, markerScale, m.Concluido);
  });
  ctx.restore();
  const vx = centerX + (x * scale) + mapOffsetX;
  const vz = centerY - (z * scale) + mapOffsetZ;
  drawPin(ctx, vx, vz, "#f4d03f", markerScale * 1.5, currentMarkerId !== null);
  ctx.strokeStyle = "rgba(255, 255, 0, 0.5)"; ctx.setLineDash([5, 5]);
  ctx.beginPath(); ctx.moveTo(vx, vz); ctx.lineTo(centerX + mapOffsetX, centerY + mapOffsetZ); ctx.stroke();
  ctx.setLineDash([]);
}

let editingMarkerId = null;

function openMarkerModal(m = null) {
  const btn = document.getElementById('btn-create-marker');
  const title = document.querySelector('#marker-modal h4');
  if (m) {
    editingMarkerId = m.id;
    title.innerText = "Editar Marcador"; btn.innerText = "SALVAR";
    document.getElementById('m-nome').value = m.Nome || '';
    document.getElementById('m-x').value = m.X || 0;
    document.getElementById('m-z').value = m.Z || 0;
    document.getElementById('m-y').value = m.Y || 0;
    document.getElementById('m-type').value = m.Type || 'Base';
    document.getElementById('m-done').checked = m.Concluido || false;
  } else {
    editingMarkerId = null;
    title.innerText = "Novo Marcador"; btn.innerText = "CRIAR";
    const cleanAngle = Math.round(angle);
    const rad = (cleanAngle * Math.PI) / 180;
    document.getElementById('m-nome').value = '';
    document.getElementById('m-x').value = Math.round(-dist * Math.sin(rad));
    document.getElementById('m-z').value = Math.round(-dist * Math.cos(rad));
    document.getElementById('m-y').value = document.getElementById('valY').innerText;
    document.getElementById('m-done').checked = false;
  }
  document.getElementById('marker-modal').style.display = 'flex';
}

function closeMarkerModal() { document.getElementById('marker-modal').style.display = 'none'; }

async function addMarker() {
  const fields = {
    Nome: document.getElementById('m-nome').value,
    X: parseFloat(document.getElementById('m-x').value),
    Z: parseFloat(document.getElementById('m-z').value),
    Y: parseFloat(document.getElementById('m-y').value),
    Type: document.getElementById('m-type').value,
    Concluido: document.getElementById('m-done').checked
  };
  if (!fields.Nome) { alert("Dê um nome!"); return; }
  try {
    if (editingMarkerId) {
      await grist.docApi.applyUserActions([['UpdateRecord', 'Marcadores', editingMarkerId, fields]]);
    } else {
      await grist.docApi.applyUserActions([['AddRecord', 'Marcadores', null, fields]]);
    }
    closeMarkerModal(); loadMarkers();
  } catch (e) { console.error(e); }
}

/**
 * Types Management
 */
function openTypesModal() {
  renderTypesList();
  document.getElementById('types-modal').style.display = 'flex';
}

function closeTypesModal() {
  document.getElementById('types-modal').style.display = 'none';
}

function renderTypesList() {
  const container = document.getElementById('types-list-container');
  container.innerHTML = '';
  markerTypes.forEach((t, i) => {
    const row = document.createElement('div');
    row.className = 'form-group';
    row.style.display = 'flex';
    row.style.gap = '10px';
    row.style.alignItems = 'center';
    row.innerHTML = `
      <input type="text" value="${t.Nome}" onchange="updateTypeData(${i}, 'Nome', this.value)" style="flex: 2;">
      <input type="color" value="${t.Cor}" onchange="updateTypeData(${i}, 'Cor', this.value)" style="flex: 1; height: 35px;">
      <button class="cal-btn" onclick="deleteTypeRow(${i})" style="color: #ff4d4d;">✖</button>
    `;
    container.appendChild(row);
  });
}

function updateTypeData(index, key, val) {
  markerTypes[index][key] = val;
}

function addTypeRow() {
  markerTypes.push({ Nome: "Novo Tipo", Cor: "#ffffff" });
  renderTypesList();
}

function deleteTypeRow(index) {
  markerTypes.splice(index, 1);
  renderTypesList();
}

async function saveTypes() {
  try {
    // This is a bit brute-force for a prototype: clear and re-add or sync.
    // For Grist, we'll map current markerTypes to Update/Add actions.
    const actions = [];
    // 1. Clear existing table (if you want full sync)
    const existing = await grist.docApi.fetchTable('Tipos_Marcadores');
    if (existing.id && existing.id.length > 0) {
      actions.push(['BulkRemoveRecord', 'Tipos_Marcadores', existing.id]);
    }
    // 2. Add current state
    markerTypes.forEach(t => {
      actions.push(['AddRecord', 'Tipos_Marcadores', null, { Nome: t.Nome, Cor: t.Cor }]);
    });

    await grist.docApi.applyUserActions(actions);
    alert("Tipos salvos!");
    loadMarkerTypes(); // Refresh global state
  } catch (e) {
    console.error("Error saving types:", e);
  }
}

// Interaction Listeners
let isDragging = false; let lastX = 0;
viewport.onpointerdown = (e) => { isDragging = true; lastX = e.clientX; viewport.setPointerCapture(e.pointerId); };
window.onpointermove = (e) => { if (isDragging) { angle = (angle - (e.clientX - lastX) / (60/15) + 360) % 360; lastX = e.clientX; calculate(); } };
window.onpointerup = () => { isDragging = false; };
function updateUI() { dist = slideDist.value; calculate(); }
let isPanning = false; let startPanX = 0; let startPanZ = 0;
canvas.onpointerdown = (e) => {
  const rect = canvas.getBoundingClientRect(); const x = e.clientX - rect.left; const y = e.clientY - rect.top;
  isPanning = true; startPanX = x - mapOffsetX; startPanZ = y - mapOffsetZ; canvas.setPointerCapture(e.pointerId);
  canvas.dataset.startX = x; canvas.dataset.startY = y;
};
window.onpointermove = (e) => { if (isPanning) { const rect = canvas.getBoundingClientRect(); mapOffsetX = (e.clientX - rect.left) - startPanX; mapOffsetZ = (e.clientY - rect.top) - startPanZ; calculate(); } };
window.onpointerup = (e) => {
  if (!isPanning) return; isPanning = false;
  const rect = canvas.getBoundingClientRect(); const x = e.clientX - rect.left; const y = e.clientY - rect.top;
  const startX = parseFloat(canvas.dataset.startX); const startY = parseFloat(canvas.dataset.startY);
  const moveDist = Math.hypot(x - startX, y - startY);
  
  if (moveDist < 10) { // Increased tolerance for click
    const scaleFactor = canvas.width / rect.width;
    const mapScale = ((canvas.width / 2) / mapRange) * zoomLevel;
    
    // Convert click position to world coordinates, accounting for pan and scale
    const clickWorldX = (x * scaleFactor - (canvas.width / 2) - mapOffsetX) / mapScale;
    const clickWorldZ = -((y * scaleFactor - (canvas.height / 2) - mapOffsetZ) / mapScale);

    // Hitbox detection: 40 pixels radius converted to game-world units
    const hitThreshold = (40 * markerScale) / mapScale; 
    let markerClicked = null;
    
    for (const m of markers) {
      const mx = m.X || 0; const mz = m.Z || 0;
      if (Math.hypot(clickWorldX - mx, clickWorldZ - mz) < hitThreshold) {
        markerClicked = m; break;
      }
    }

    if (markerClicked) {
      selectMarker(markerClicked);
    } else {
      dist = Math.round(Math.sqrt(clickWorldX**2 + clickWorldZ**2));
      slideDist.value = dist;
      angle = (Math.atan2(-clickWorldX, -clickWorldZ) * 180 / Math.PI + 360) % 360;
      currentMarkerId = null;
      calculate();
    }
  }
};

canvas.onwheel = (e) => { e.preventDefault(); const delta = e.deltaY > 0 ? -0.5 : 0.5; updateZoom(Math.min(Math.max(zoomLevel + delta, 1), 10)); };

grist.ready({
  requiredAccess: 'full',
  columns: [
    { name: "ImagemMapa", title: "Mapa", type: "Any" },
    { name: "EmUso", title: "Em Uso", type: "Bool" },
    { name: "CalComp", title: "Cal. Bússola", type: "Numeric", optional: true },
    { name: "CalMapX", title: "Cal. Mapa X", type: "Numeric", optional: true },
    { name: "CalMapZ", title: "Cal. Mapa Z", type: "Numeric", optional: true },
    { name: "MapRange", title: "Raio do Mapa", type: "Numeric", optional: true },
    { name: "Profundidade", title: "Profundidade", type: "Numeric", optional: true },
    { name: "Concluido", title: "Concluído", type: "Bool", optional: true }
  ]
});

async function updateToken() {
  try {
    const response = await grist.docApi.getAccessToken({ readOnly: true });
    gristBaseUrl = response.baseUrl; gristToken = response.token;
  } catch (e) {}
}

grist.onRecord(async (record) => {
  if (!gristToken) await updateToken();
  if (markerTypes.length === 0) await loadMarkerTypes();
  if (record.EmUso === false) {
    if (!currentMapId) await loadInitialActiveMap();
    return;
  }
  selectMap(record);
});

async function loadInitialActiveMap() {
  try {
    const records = await grist.docApi.fetchTable('Config_Mapa');
    const numRecords = records.id ? records.id.length : 0;
    for (let i = 0; i < numRecords; i++) {
      if (records.EmUso && records.EmUso[i] === true) {
        const mapRecord = {}; for (const key in records) { mapRecord[key] = records[key][i]; }
        selectMap(mapRecord); return true;
      }
    }
  } catch (e) {}
  return false;
}

mapImg.onload = calculate;
window.adjustCal = adjustCal; window.manualScaleFix = manualScaleFix; window.updateUI = updateUI; window.toggleMenu = toggleMenu; window.toggleMarkersMenu = toggleMarkersMenu; window.updateZoom = updateZoom; window.saveConfig = saveConfig; window.openMarkerModal = openMarkerModal; window.closeMarkerModal = closeMarkerModal; window.addMarker = addMarker; window.updateMarkerScale = updateMarkerScale; window.openTypesModal = openTypesModal; window.closeTypesModal = closeTypesModal; window.addTypeRow = addTypeRow; window.deleteTypeRow = deleteTypeRow; window.saveTypes = saveTypes; window.updateTypeData = updateTypeData;
createCompass(); calculate();
loadMarkerTypes();
