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

// Constants
const tickWidth = 60;
const pxPerDeg = tickWidth / 15;
const mapImg = new Image();

/**
 * Initializes the compass ribbon with degree ticks and cardinal directions
 */
function createCompass() {
  ribbon.innerHTML = '';
  // Repeat the compass 7 times for seamless infinite scrolling
  for (let loop = 0; loop < 7; loop++) {
    for (let i = 0; i < 360; i += 15) {
      const div = document.createElement('div');
      div.className = 'tick';
      let label = i;

      if (i === 0) { label = "N"; div.classList.add('major'); }
      else if (i === 45) { label = "NE"; div.classList.add('ordinal'); }
      else if (i === 90) { label = "E"; div.classList.add('major'); }
      else if (i === 135) { label = "SE"; div.classList.add('ordinal'); }
      else if (i === 180) { label = "S"; div.classList.add('major'); }
      else if (i === 225) { label = "SW"; div.classList.add('ordinal'); }
      else if (i === 270) { label = "W"; div.classList.add('major'); }
      else if (i === 315) { label = "NW"; div.classList.add('ordinal'); }

      div.innerText = label;
      div.style.width = tickWidth + "px";
      ribbon.appendChild(div);
    }
  }
}

/**
 * Adjusts calibration values for compass or map alignment
 */
function adjustCal(type, amt) {
  if (type === 'comp') calComp += amt;
  if (type === 'mapX') calMapX += amt;
  if (type === 'mapZ') calMapZ += amt;

  document.getElementById('valCalComp').innerText = calComp;
  document.getElementById('valCalMapX').innerText = calMapX;
  document.getElementById('valCalMapZ').innerText = calMapZ;
  
  calculate();
}

/**
 * Calibrates the map scale based on a known real-world distance
 */
function manualScaleFix() {
  if (dist === 0) {
    alert("Clique em um ponto do mapa primeiro!");
    return;
  }

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

/**
 * Updates coordinates and UI based on current angle and distance
 */
function calculate() {
  const cleanAngle = Math.round(angle);
  const rad = (cleanAngle * Math.PI) / 180;
  
  // Subnautica coordinates (X, Z) based on distance and bearing
  const x = Math.round(-dist * Math.sin(rad));
  const z = Math.round(-dist * Math.cos(rad));

  document.getElementById('valX').innerText = Object.is(x, -0) ? 0 : x;
  document.getElementById('valZ').innerText = Object.is(z, -0) ? 0 : z;
  document.getElementById('txtDist').innerText = dist;
  document.getElementById('txtAng').innerText = cleanAngle;

  // Update Compass Ribbon
  const viewportWidth = viewport.getBoundingClientRect().width;
  const centerPoint = viewportWidth / 2;
  // Offset by 3 full rotations to start in the middle of the ribbon
  const scrollPos = (angle * pxPerDeg) + (3 * 360 * pxPerDeg) - centerPoint + calComp;
  ribbon.style.transform = `translateX(${-scrollPos}px)`;

  drawMap(x, z);
}

/**
 * Renders the map and the player's calculated position
 */
function drawMap(x, z) {
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  if (mapImg.complete && mapImg.naturalWidth !== 0) {
    ctx.drawImage(mapImg, calMapX, calMapZ, w, h);
  }

  const centerX = w / 2;
  const centerY = h / 2;
  const scale = centerX / mapRange;
  const mx = centerX + (x * scale);
  const mz = centerY - (z * scale);

  // Draw point
  ctx.shadowBlur = 15;
  ctx.shadowColor = "black";
  ctx.fillStyle = "var(--sub-yellow)";
  ctx.beginPath();
  ctx.arc(mx, mz, 12, 0, Math.PI * 2);
  ctx.fill();

  // Draw outline
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "white";
  ctx.lineWidth = 4;
  ctx.stroke();

  // Draw line to center
  ctx.strokeStyle = "rgba(255, 255, 0, 0.5)";
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.moveTo(mx, mz);
  ctx.lineTo(centerX, centerY);
  ctx.stroke();
  ctx.setLineDash([]);
}

// Grist API Integration
grist.ready({
  requiredAccess: 'full',
  columns: [
    { name: "ImagemMapa", title: "Mapa", type: "Any" },
    { name: "Profundidade", title: "Profundidade", type: "Numeric", optional: true }
  ]
});

async function updateToken() {
  try {
    const response = await grist.docApi.getAccessToken({ readOnly: true });
    gristBaseUrl = response.baseUrl;
    gristToken = response.token;
  } catch (e) {
    console.error("Failed to get Grist access token:", e);
  }
}

grist.onRecord(async (record) => {
  if (!gristToken) await updateToken();
  
  // Handle Map Image
  const att = record.ImagemMapa;
  let fileId = Array.isArray(att) ? (att[0] === 'L' ? att[1] : att[0]) : att;
  
  if (fileId && gristBaseUrl && gristToken) {
    const url = `${gristBaseUrl}/attachments/${fileId}/download?auth=${gristToken}`;
    if (mapImg.src !== url) {
      mapImg.src = url;
    }
  }

  // Handle Depth (Profundidade)
  if (record.Profundidade !== undefined) {
    document.getElementById('valY').innerText = Math.round(record.Profundidade);
  }
});

// Interaction Listeners
let isDragging = false;
let lastX = 0;

viewport.onpointerdown = (e) => {
  isDragging = true;
  lastX = e.clientX;
  viewport.setPointerCapture(e.pointerId);
};

window.onpointermove = (e) => {
  if (isDragging) {
    angle = (angle - (e.clientX - lastX) / pxPerDeg + 360) % 360;
    lastX = e.clientX;
    calculate();
  }
};

window.onpointerup = () => {
  isDragging = false;
};

function updateUI() {
  dist = slideDist.value;
  calculate();
}

canvas.onpointerdown = (e) => {
  const rect = canvas.getBoundingClientRect();
  const mapScale = (canvas.width / 2) / mapRange;
  const scaleFactor = canvas.width / rect.width;
  
  const clickX = e.clientX - rect.left;
  const clickY = e.clientY - rect.top;
  
  const worldX = (clickX - (rect.width / 2)) * scaleFactor / mapScale;
  const worldZ = -((clickY - (rect.height / 2)) * scaleFactor / mapScale);
  
  dist = Math.round(Math.sqrt(worldX**2 + worldZ**2));
  slideDist.value = dist;
  angle = (Math.atan2(-worldX, -worldZ) * 180 / Math.PI + 360) % 360;
  
  calculate();
};

mapImg.onload = calculate;

// Global exports for HTML handlers
window.adjustCal = adjustCal;
window.manualScaleFix = manualScaleFix;
window.updateUI = updateUI;

// Initial Setup
createCompass();
calculate();
