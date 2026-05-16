const NAMES = [
  '감성준', '힘웃사', '그그달', '레전드', '다람쥐',
  '레몬', '혜지', '영호', '꽉낄라', '파우스트',
  '천사', '키노카노', '황정호',
  '윈드', '망객', '브이', '실버', '민초',
  '밴치'
];

const STAT_KEYS = ['라인전', '한타', '뇌지컬', '오더', '멘탈', '충성심', '챔프폭'];
const DEFAULT_STATS = [0, 0, 0, 0, 0, 0, 0];

let placements = JSON.parse(localStorage.getItem('tl_data') || '{}');
let statData = JSON.parse(localStorage.getItem('tl_stats_v2') || '{}');
let selectedName = null;

placements = Object.fromEntries(
  Object.entries(placements).filter(([name]) => NAMES.includes(name))
);

statData = Object.fromEntries(
  Object.entries(statData).filter(([name]) => NAMES.includes(name))
);

function save() {
  localStorage.setItem('tl_data', JSON.stringify(placements));
}

function saveStats() {
  localStorage.setItem('tl_stats_v2', JSON.stringify(statData));
}

function getStats(name) {
  if (!statData[name]) statData[name] = [...DEFAULT_STATS];
  statData[name] = STAT_KEYS.map((_, i) => Number(statData[name][i] || 0));
  return statData[name];
}

function makeCard(name) {
  const el = document.createElement('div');
  el.className = 'card';
  el.textContent = name;
  el.dataset.name = name;
  el.draggable = true;
  el.addEventListener('click', e => {
    e.stopPropagation();
    selectMember(name);
  });
  return el;
}

let dragging = null;
let ghost = null;
let ghostOX = 0, ghostOY = 0;

function setupDrag(card) {
  card.addEventListener('dragstart', e => {
    dragging = card;
    card.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', card.dataset.name);

    ghost = card.cloneNode(true);
    ghost.classList.remove('dragging');
    ghost.classList.add('drag-ghost');
    document.body.appendChild(ghost);

    const r = card.getBoundingClientRect();
    ghostOX = e.clientX - r.left;
    ghostOY = e.clientY - r.top;
    ghost.style.left = (e.clientX - ghostOX) + 'px';
    ghost.style.top  = (e.clientY - ghostOY) + 'px';
    e.dataTransfer.setDragImage(new Image(), 0, 0);
  });

  card.addEventListener('dragend', () => {
    card.classList.remove('dragging');
    dragging = null;
    if (ghost) { ghost.remove(); ghost = null; }
    updateHints();
    save();
  });
}

document.addEventListener('dragover', e => {
  e.preventDefault();
  if (ghost) {
    ghost.style.left = (e.clientX - ghostOX) + 'px';
    ghost.style.top  = (e.clientY - ghostOY) + 'px';
  }
});

function setupZone(zone) {
  zone.addEventListener('click', e => {
    if (!e.target.closest('.card')) hideStatsPanel();
  });

  zone.addEventListener('dragover', e => {
    e.preventDefault();
    zone.classList.add('drag-over');
    const row = zone.closest('.tier-row');
    if (row) row.classList.add('drag-over');
  });

  zone.addEventListener('dragleave', e => {
    if (!zone.contains(e.relatedTarget)) {
      zone.classList.remove('drag-over');
      const row = zone.closest('.tier-row');
      if (row) row.classList.remove('drag-over');
    }
  });

  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const row = zone.closest('.tier-row');
    if (row) row.classList.remove('drag-over');
    if (!dragging) return;

    const name = dragging.dataset.name;
    const zoneId = zone.dataset.zone;

    const cards = [...zone.querySelectorAll('.card:not(.dragging)')];
    let insertBefore = null;
    for (const c of cards) {
      const r = c.getBoundingClientRect();
      if (e.clientX < r.left + r.width / 2) { insertBefore = c; break; }
    }

    if (insertBefore) zone.insertBefore(dragging, insertBefore);
    else zone.appendChild(dragging);

    placements[name] = zoneId;
    updateHints();
    save();
  });
}

function updateHints() {
  document.querySelectorAll('[data-zone]').forEach(z => {
    let hint = z.querySelector('.empty-hint');
    const hasCards = z.querySelector('.card');
    if (!hasCards) {
      if (!hint) {
        hint = document.createElement('div');
        hint.className = 'empty-hint';
        hint.textContent = z.id === 'pool' ? '모두 배치됨' : '여기에 드래그';
        z.appendChild(hint);
      }
    } else {
      if (hint) hint.remove();
    }
  });
}

function polarPoint(center, radius, index, total) {
  const angle = -Math.PI / 2 + (Math.PI * 2 * index) / total;
  return {
    x: center + Math.cos(angle) * radius,
    y: center + Math.sin(angle) * radius
  };
}

function drawRadar(name) {
  const svg = document.getElementById('radarChart');
  const stats = getStats(name);
  const center = 130;
  const maxRadius = 82;
  const total = STAT_KEYS.length;

  svg.innerHTML = '';

  for (let level = 1; level <= 5; level++) {
    const radius = maxRadius * level / 5;
    const points = STAT_KEYS.map((_, i) => {
      const p = polarPoint(center, radius, i, total);
      return `${p.x},${p.y}`;
    }).join(' ');
    const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    polygon.setAttribute('points', points);
    polygon.setAttribute('class', 'radar-grid');
    svg.appendChild(polygon);
  }

  STAT_KEYS.forEach((label, i) => {
    const axisEnd = polarPoint(center, maxRadius, i, total);
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', center);
    line.setAttribute('y1', center);
    line.setAttribute('x2', axisEnd.x);
    line.setAttribute('y2', axisEnd.y);
    line.setAttribute('class', 'radar-axis');
    svg.appendChild(line);

    const labelPoint = polarPoint(center, maxRadius + 28, i, total);
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', labelPoint.x);
    text.setAttribute('y', labelPoint.y);
    text.setAttribute('class', 'radar-label');
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'middle');
    text.textContent = label;
    svg.appendChild(text);
  });

  const statPoints = stats.map((value, i) => {
    const p = polarPoint(center, maxRadius * value / 10, i, total);
    return `${p.x},${p.y}`;
  }).join(' ');

  const shape = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
  shape.setAttribute('points', statPoints);
  shape.setAttribute('class', 'radar-shape');
  svg.appendChild(shape);

  stats.forEach((value, i) => {
    const p = polarPoint(center, maxRadius * value / 10, i, total);
    const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    dot.setAttribute('cx', p.x);
    dot.setAttribute('cy', p.y);
    dot.setAttribute('r', 3.5);
    dot.setAttribute('class', 'radar-dot');
    svg.appendChild(dot);
  });
}

function renderStatControls(name) {
  const controls = document.getElementById('statControls');
  const stats = getStats(name);

  controls.innerHTML = STAT_KEYS.map((key, i) => `
    <label class="stat-row">
      <span>${key}</span>
      <select data-stat-index="${i}">
        ${Array.from({ length: 11 }, (_, value) => {
          return `<option value="${value}" ${value === stats[i] ? 'selected' : ''}>${value}</option>`;
        }).join('')}
      </select>
    </label>
  `).join('');
}

function selectMember(name) {
  selectedName = name;
  document.getElementById('statsPanel').classList.add('is-open');
  document.getElementById('selectedName').textContent = name;
  document.querySelectorAll('.card').forEach(card => {
    card.classList.toggle('selected', card.dataset.name === name);
  });
  drawRadar(name);
  renderStatControls(name);
}

function hideStatsPanel() {
  selectedName = null;
  document.getElementById('statsPanel').classList.remove('is-open');
  document.querySelectorAll('.card').forEach(card => card.classList.remove('selected'));
}

function setupStats() {
  document.getElementById('statSave').addEventListener('click', () => {
    if (!selectedName) return;
    const inputs = [...document.querySelectorAll('[data-stat-index]')];
    statData[selectedName] = inputs.map(input => {
      const value = Number(input.value);
      if (Number.isNaN(value)) return 1;
      return Math.max(1, Math.min(10, value));
    });
    saveStats();
    selectMember(selectedName);
  });
}

function init() {
  const pool = document.getElementById('pool');
  NAMES.forEach(name => {
    const card = makeCard(name);
    setupDrag(card);
    const zone = placements[name];
    if (zone && zone !== 'pool') {
      const target = document.querySelector(`[data-zone="${zone}"]`);
      if (target) { target.appendChild(card); return; }
    }
    pool.appendChild(card);
  });

  document.querySelectorAll('[data-zone]').forEach(setupZone);
  setupStats();
  document.addEventListener('click', e => {
    if (!e.target.closest('.stats-panel') && !e.target.closest('.card')) hideStatsPanel();
  });
  hideStatsPanel();
  updateHints();
}

init();
