const STORAGE_KEY = "pickerWheelState";

const TEAM_A = [
  "Karol Jaskowiec",
  "Michal Ertner",
  "Konrad Zwierzchowski",
  "Grzegorz Pawlik",
  "Tomasz Wicherski",
];

const TEAM_B = [
  "Jakub Galas",
  "Patryk Latka",
  "Maciej Bryl",
  "Dominik Oleksy",
  "Patryk Gegotek",
  "Yaroslav Andreiev",
  "Miroslaw Kozaczka",
  "Mariusz Sokolowski",
];

const FULL_IMW_EXTRA = [
  "Arkadiusz Mika",
  "Daniel Jewiarz",
  "Michal Mucek",
  "Vladyslav Honcharenko",
];

const DEFAULT_PRESETS = {
  teamA: TEAM_A,
  teamB: TEAM_B,
  teamAB: [...TEAM_A, ...TEAM_B],
  fullIMW: [...TEAM_A, ...TEAM_B, ...FULL_IMW_EXTRA],
};

const PRESET_KEYS = ["teamA", "teamB", "teamAB", "fullIMW", "custom"];

const THEME_META = {
  white: { brand: "◎", spinLabel: "SPIN", decor: [] },
  black: { brand: "✦", spinLabel: "SPIN", decor: [] },
  casino: {
    brand: "🎰",
    spinLabel: "🎲 SPIN 🎲",
    decor: ["🎰", "🃏", "♠️", "♥️", "💰", "🎲", "🪙", "💎", "🎰"],
  },
  radio: {
    brand: "📡",
    spinLabel: "📶 SPIN 📶",
    decor: ["📡", "📶", "🛰️", "📻", "🔊", "💚", "⚡", "🌐", "📡"],
  },
};

const THEMES = ["white", "black", "casino", "radio"];

const WHEEL_COLORS = {
  white: ["#2563eb", "#6366f1", "#0ea5e9", "#14b8a6", "#8b5cf6", "#ec4899", "#f59e0b"],
  black: ["#8b5cf6", "#a78bfa", "#6366f1", "#818cf8", "#c084fc", "#e879f9", "#22d3ee"],
  casino: ["#b91c1c", "#15803d", "#ca8a04", "#991b1b", "#166534", "#eab308", "#7f1d1d", "#14532d"],
  radio: ["#06b6d4", "#22c55e", "#0ea5e9", "#10b981", "#0284c7", "#14b8a6", "#0891b2", "#059669"],
};

let nextId = 1;

function createParticipant(name, active = true) {
  return { id: `p_${nextId++}_${Date.now()}`, name: name.trim(), active };
}

function namesToParticipants(names) {
  return names.map((name) => createParticipant(name, true));
}

function cloneParticipants(list) {
  return list.map((p) => ({ ...p }));
}

const state = {
  preset: "teamA",
  theme: "white",
  participants: [],
  presetOverrides: {
    teamA: null,
    teamB: null,
    teamAB: null,
    fullIMW: null,
  },
  customParticipants: [],
  winnerHistory: [],
  lastWinnerId: null,
  wheelRotation: 0,
};

let isSpinning = false;
let animationFrame = null;

const canvas = document.getElementById("wheelCanvas");
const ctx = canvas.getContext("2d");
const spinBtn = document.getElementById("spinBtn");
const presetSelect = document.getElementById("presetSelect");
const themeSelect = document.getElementById("themeSelect");
const resetPresetBtn = document.getElementById("resetPresetBtn");
const resetAllBtn = document.getElementById("resetAllBtn");
const participantList = document.getElementById("participantList");
const activeCountEl = document.getElementById("activeCount");
const addPersonBtn = document.getElementById("addPersonBtn");
const addPersonRow = document.getElementById("addPersonRow");
const newPersonInput = document.getElementById("newPersonInput");
const confirmAddBtn = document.getElementById("confirmAddBtn");
const cancelAddBtn = document.getElementById("cancelAddBtn");
const wheelEmpty = document.getElementById("wheelEmpty");
const winnerArea = document.getElementById("winnerArea");
const winnerName = document.getElementById("winnerName");
const winnerLabel = document.getElementById("winnerLabel");
const winnerThemeTag = document.getElementById("winnerThemeTag");
const winnerFx = document.getElementById("winnerFx");
const removeWinnerBtn = document.getElementById("removeWinnerBtn");
const keepWinnerBtn = document.getElementById("keepWinnerBtn");
const winnerHistoryEl = document.getElementById("winnerHistory");
const confettiLayer = document.getElementById("confettiLayer");
const brandIcon = document.querySelector(".brand-icon");
const themeDecor = document.getElementById("themeDecor");

function getActiveParticipants() {
  return state.participants.filter((p) => p.active && p.name.length > 0);
}

function persistPresetSnapshot() {
  const snapshot = cloneParticipants(state.participants);
  if (state.preset === "custom") {
    state.customParticipants = snapshot;
  } else if (state.presetOverrides[state.preset] !== undefined) {
    state.presetOverrides[state.preset] = snapshot;
  }
}

function getDefaultParticipantsForPreset(preset) {
  if (preset === "custom") {
    if (state.customParticipants.length) {
      return cloneParticipants(state.customParticipants);
    }
    return [];
  }
  const override = state.presetOverrides[preset];
  if (override !== null && override !== undefined) {
    return cloneParticipants(override);
  }
  return namesToParticipants(DEFAULT_PRESETS[preset]);
}

function loadPreset(preset, skipSave = false) {
  if (!skipSave && state.participants.length) {
    persistPresetSnapshot();
  }
  state.preset = preset;
  state.participants = getDefaultParticipantsForPreset(preset);
  presetSelect.value = preset;
  saveState();
  renderParticipants();
  drawWheel();
  updateSpinButton();
}

function resetPreset() {
  const preset = state.preset;
  if (preset === "custom") {
    if (!confirm("Clear the custom participant list?")) return;
    state.customParticipants = [];
    state.participants = [];
  } else {
    state.presetOverrides[preset] = null;
    state.participants = namesToParticipants(DEFAULT_PRESETS[preset]);
  }
  saveState();
  renderParticipants();
  drawWheel();
  updateSpinButton();
}

function resetAll() {
  if (
    !confirm(
      "Reset everything? This clears all custom data, overrides, history, and restores defaults.",
    )
  ) {
    return;
  }
  localStorage.removeItem(STORAGE_KEY);
  location.reload();
}

function saveState() {
  try {
    const payload = {
      preset: state.preset,
      theme: state.theme,
      participants: state.participants,
      presetOverrides: state.presetOverrides,
      customParticipants: state.customParticipants,
      winnerHistory: state.winnerHistory.slice(0, 20),
      lastWinnerId: state.lastWinnerId,
      wheelRotation: state.wheelRotation,
      nextId,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (e) {
    console.warn("Could not save state", e);
  }
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      state.participants = namesToParticipants(DEFAULT_PRESETS.teamA);
      return;
    }
    const data = JSON.parse(raw);
    if (data.nextId) nextId = data.nextId;
    if (THEMES.includes(data.theme)) state.theme = data.theme;
    let loadedPreset = data.preset;
    if (loadedPreset === "full") loadedPreset = "teamAB";
    if (PRESET_KEYS.includes(loadedPreset)) {
      state.preset = loadedPreset;
    }
    if (data.presetOverrides && typeof data.presetOverrides === "object") {
      const o = data.presetOverrides;
      state.presetOverrides = {
        teamA: o.teamA ?? null,
        teamB: o.teamB ?? null,
        teamAB: o.teamAB ?? o.full ?? null,
        fullIMW: o.fullIMW ?? null,
      };
    }
    if (Array.isArray(data.customParticipants)) {
      state.customParticipants = data.customParticipants;
    }
    if (Array.isArray(data.winnerHistory)) {
      state.winnerHistory = data.winnerHistory.slice(0, 20);
    }
    state.lastWinnerId = data.lastWinnerId ?? null;
    state.wheelRotation = typeof data.wheelRotation === "number" ? data.wheelRotation : 0;

    if (Array.isArray(data.participants) && data.participants.length) {
      state.participants = data.participants.map((p) => ({
        id: p.id || createParticipant(p.name || "Unknown").id,
        name: String(p.name || "").trim(),
        active: p.active !== false,
      }));
    } else {
      state.participants = getDefaultParticipantsForPreset(state.preset);
    }
  } catch (e) {
    console.warn("Corrupted storage, using defaults", e);
    state.participants = namesToParticipants(DEFAULT_PRESETS.teamA);
  }
}

function renderThemeDecor(theme) {
  if (!themeDecor) return;
  themeDecor.innerHTML = "";
  const meta = THEME_META[theme];
  if (!meta || !meta.decor.length) return;
  meta.decor.forEach((emoji, i) => {
    const span = document.createElement("span");
    span.className = "theme-float-emoji";
    span.textContent = emoji;
    span.style.setProperty("--i", String(i));
    span.style.left = `${8 + (i * 10) % 84}%`;
    span.style.animationDelay = `${i * 0.35}s`;
    themeDecor.appendChild(span);
  });
}

function applyTheme(theme) {
  if (!THEMES.includes(theme)) theme = "white";
  state.theme = theme;
  document.body.setAttribute("data-theme", theme);
  themeSelect.value = theme;
  const meta = THEME_META[theme] || THEME_META.white;
  if (brandIcon) brandIcon.textContent = meta.brand;
  if (!isSpinning && spinBtn) spinBtn.textContent = meta.spinLabel;
  renderThemeDecor(theme);
  drawWheel();
  saveState();
}

function truncateLabel(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + "…").width > maxWidth) {
    t = t.slice(0, -1);
  }
  return t + "…";
}

function drawWheel(rotation = state.wheelRotation) {
  const dpr = window.devicePixelRatio || 1;
  const size = canvas.clientWidth || 480;
  if (canvas.width !== size * dpr) {
    canvas.width = size * dpr;
    canvas.height = size * dpr;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const w = size;
  const h = size;
  const cx = w / 2;
  const cy = h / 2;
  const radius = Math.min(w, h) / 2 - 8;

  ctx.clearRect(0, 0, w, h);

  const active = getActiveParticipants();
  if (active.length === 0) {
    wheelEmpty.classList.remove("hidden");
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = getComputedStyle(document.body).getPropertyValue("--bg-card").trim() || "#fff";
    ctx.fill();
    ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue("--wheel-border").trim();
    ctx.lineWidth = 2;
    ctx.stroke();
    return;
  }

  wheelEmpty.classList.add("hidden");
  const n = active.length;
  const slice = (Math.PI * 2) / n;
  const palette = WHEEL_COLORS[state.theme] || WHEEL_COLORS.white;
  const alt = getComputedStyle(document.body).getPropertyValue("--segment-alt").trim();

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotation);

  for (let i = 0; i < n; i++) {
    const start = -Math.PI / 2 + i * slice;
    const end = start + slice;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, radius, start, end);
    ctx.closePath();
    const useAlt = i % 2 === 1;
    ctx.fillStyle = useAlt && alt ? alt : palette[i % palette.length];
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.15)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.save();
    ctx.rotate(start + slice / 2);
    ctx.textAlign = "right";
    ctx.fillStyle = useAlt && state.theme === "white" ? "#1a1d26" : "#ffffff";
    let fontSize = Math.min(16, Math.max(9, radius / (n > 12 ? 4 : 3.2)));
    if (n > 20) fontSize = Math.max(7, fontSize - 2);
    ctx.font = `600 ${fontSize}px system-ui, sans-serif`;
    const label = truncateLabel(ctx, active[i].name, radius * 0.85);
    ctx.fillText(label, radius - 12, fontSize * 0.35);
    ctx.restore();
  }

  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.12, 0, Math.PI * 2);
  ctx.fillStyle = getComputedStyle(document.body).getPropertyValue("--bg-card").trim() || "#fff";
  ctx.fill();
  ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue("--wheel-border").trim();
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.restore();
}

function normalizeAngle(angle) {
  const twoPi = Math.PI * 2;
  angle = angle % twoPi;
  if (angle < 0) angle += twoPi;
  return angle;
}

function computeTargetRotation(winnerIndex, total, currentRotation) {
  const slice = (Math.PI * 2) / total;
  const targetMod = normalizeAngle(-(winnerIndex + 0.5) * slice);
  const minSpins = 5 + Math.floor(Math.random() * 4);
  let delta = normalizeAngle(targetMod - normalizeAngle(currentRotation));
  if (delta < 0.01) delta = Math.PI * 2;
  return currentRotation + minSpins * Math.PI * 2 + delta;
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function spinWheel() {
  if (isSpinning) return;
  const active = getActiveParticipants();
  if (active.length < 2) return;

  isSpinning = true;
  spinBtn.disabled = true;
  hideWinner(false);

  const winnerIndex = Math.floor(Math.random() * active.length);
  const winner = active[winnerIndex];
  const startRot = state.wheelRotation;
  const endRot = computeTargetRotation(winnerIndex, active.length, startRot);
  const duration = 4000 + Math.random() * 1500;
  const startTime = performance.now();

  function frame(now) {
    const t = Math.min(1, (now - startTime) / duration);
    const eased = easeOutCubic(t);
    state.wheelRotation = startRot + (endRot - startRot) * eased;
    drawWheel(state.wheelRotation);
    if (t < 1) {
      animationFrame = requestAnimationFrame(frame);
    } else {
      state.wheelRotation = endRot;
      drawWheel(state.wheelRotation);
      isSpinning = false;
      selectWinner(winner);
      updateSpinButton();
      saveState();
    }
  }
  animationFrame = requestAnimationFrame(frame);
}

function selectWinner(participant) {
  state.lastWinnerId = participant.id;
  state.winnerHistory.unshift(participant.name);
  if (state.winnerHistory.length > 20) state.winnerHistory.pop();
  saveState();
  renderHistory();
  showWinner(participant);
}

function hideWinner(clearLast = true) {
  winnerArea.classList.add("hidden");
  winnerArea.classList.remove("winner-animate");
  winnerFx.innerHTML = "";
  clearConfetti();
  if (clearLast) state.lastWinnerId = null;
}

function showWinner(participant) {
  winnerName.textContent = participant.name;
  winnerLabel.textContent = "🎉 WINNER 🎉";
  winnerThemeTag.classList.add("hidden");
  winnerThemeTag.textContent = "";

  if (state.theme === "casino") {
    winnerLabel.textContent = "🎰 💰 WINNER 💰 🎰";
    winnerThemeTag.textContent = "🃏 JACKPOT! 🎲";
    winnerThemeTag.classList.remove("hidden");
  } else if (state.theme === "radio") {
    winnerLabel.textContent = "📡 📶 WINNER 📶 📡";
    winnerThemeTag.textContent = "🛰️ SIGNAL LOCKED ✅";
    winnerThemeTag.classList.remove("hidden");
  } else if (state.theme === "black") {
    winnerLabel.textContent = "✦ WINNER ✦";
  }

  winnerArea.classList.remove("hidden");
  void winnerArea.offsetWidth;
  winnerArea.classList.add("winner-animate");
  showWinnerAnimation();
}

function showWinnerAnimation() {
  winnerFx.innerHTML = "";
  clearConfetti();

  if (state.theme === "white") {
    spawnConfetti(60, ["#2563eb", "#6366f1", "#ec4899", "#f59e0b", "#14b8a6"]);
  } else if (state.theme === "black") {
    /* CSS glow handles most */
  } else if (state.theme === "casino") {
    spawnConfetti(100, ["#ffd700", "#d4af37", "#ef4444", "#22c55e", "#fff8dc", "#fbbf24"]);
    spawnEmojiBurst(["🪙", "💰", "🎲", "🃏", "💎"], 24);
  } else if (state.theme === "radio") {
    for (let i = 0; i < 5; i++) {
      const ring = document.createElement("div");
      ring.className = "radio-ring";
      winnerFx.appendChild(ring);
    }
    spawnEmojiBurst(["📶", "📡", "✅", "⚡", "🌐"], 18);
  }
}

function spawnEmojiBurst(emojis, count) {
  const layer = confettiLayer;
  const cx = window.innerWidth / 2;
  const cy = window.innerHeight * 0.45;
  for (let i = 0; i < count; i++) {
    const el = document.createElement("div");
    el.className = "emoji-burst";
    el.textContent = emojis[i % emojis.length];
    el.style.left = cx + "px";
    el.style.top = cy + "px";
    const angle = (Math.PI * 2 * i) / count;
    const dist = 80 + Math.random() * 120;
    el.style.setProperty("--tx", `${Math.cos(angle) * dist}px`);
    el.style.setProperty("--ty", `${Math.sin(angle) * dist}px`);
    el.style.animationDelay = Math.random() * 0.2 + "s";
    layer.appendChild(el);
    setTimeout(() => el.remove(), 2200);
  }
}

function spawnConfetti(count, colors) {
  const w = window.innerWidth;
  for (let i = 0; i < count; i++) {
    const el = document.createElement("div");
    el.className = "confetti-piece";
    el.style.left = Math.random() * w + "px";
    el.style.background = colors[i % colors.length];
    el.style.animationDuration = 2 + Math.random() * 2 + "s";
    el.style.animationDelay = Math.random() * 0.5 + "s";
    if (Math.random() > 0.5) el.style.borderRadius = "50%";
    confettiLayer.appendChild(el);
    setTimeout(() => el.remove(), 4500);
  }
}

function clearConfetti() {
  confettiLayer.innerHTML = "";
}

function renderHistory() {
  winnerHistoryEl.innerHTML = "";
  state.winnerHistory.forEach((name) => {
    const li = document.createElement("li");
    li.textContent = name;
    winnerHistoryEl.appendChild(li);
  });
}

function updateSpinButton() {
  const active = getActiveParticipants();
  spinBtn.disabled = isSpinning || active.length < 2;
  if (!isSpinning) {
    const meta = THEME_META[state.theme] || THEME_META.white;
    spinBtn.textContent = meta.spinLabel;
  }
}

function renderParticipants() {
  participantList.innerHTML = "";
  state.participants.forEach((p, index) => {
    const li = document.createElement("li");
    li.className = "participant-item";
    li.dataset.id = p.id;

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = p.active;
    cb.title = "Include on wheel";
    cb.addEventListener("change", () => {
      p.active = cb.checked;
      persistPresetSnapshot();
      saveState();
      drawWheel();
      updateSpinButton();
      updateActiveCount();
    });

    const nameSpan = document.createElement("span");
    nameSpan.className = "participant-name";
    nameSpan.textContent = p.name;
    nameSpan.title = "Double-click to edit";

    const editInput = document.createElement("input");
    editInput.type = "text";
    editInput.className = "participant-edit-input hidden";
    editInput.value = p.name;
    editInput.maxLength = 80;

    const actions = document.createElement("div");
    actions.className = "participant-actions";

    const upBtn = document.createElement("button");
    upBtn.type = "button";
    upBtn.className = "btn-reorder";
    upBtn.textContent = "↑";
    upBtn.title = "Move up";
    upBtn.disabled = index === 0;
    upBtn.addEventListener("click", () => moveParticipant(index, -1));

    const downBtn = document.createElement("button");
    downBtn.type = "button";
    downBtn.className = "btn-reorder";
    downBtn.textContent = "↓";
    downBtn.title = "Move down";
    downBtn.disabled = index === state.participants.length - 1;
    downBtn.addEventListener("click", () => moveParticipant(index, 1));

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "btn btn-sm btn-ghost";
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", () => startEdit(p, nameSpan, editInput, editBtn));
    nameSpan.addEventListener("dblclick", () => startEdit(p, nameSpan, editInput, editBtn));

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "btn btn-sm btn-secondary";
    removeBtn.textContent = "Remove";
    removeBtn.addEventListener("click", () => removeParticipant(p.id));

    editInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") finishEdit(p, nameSpan, editInput, editBtn, editInput.value);
      if (e.key === "Escape") cancelEdit(nameSpan, editInput, editBtn, p.name);
    });
    editInput.addEventListener("blur", () => {
      if (!editInput.classList.contains("hidden")) {
        finishEdit(p, nameSpan, editInput, editBtn, editInput.value);
      }
    });

    actions.append(upBtn, downBtn, editBtn, removeBtn);
    li.append(cb, nameSpan, editInput, actions);
    participantList.appendChild(li);
  });
  updateActiveCount();
}

function updateActiveCount() {
  const n = getActiveParticipants().length;
  activeCountEl.textContent = `${n} active`;
}

function startEdit(p, nameSpan, editInput, editBtn) {
  nameSpan.classList.add("hidden");
  editInput.classList.remove("hidden");
  editInput.value = p.name;
  editBtn.textContent = "Save";
  editInput.focus();
  editInput.select();
}

function finishEdit(p, nameSpan, editInput, editBtn, raw) {
  const name = raw.trim() || p.name;
  p.name = name;
  nameSpan.textContent = name;
  nameSpan.classList.remove("hidden");
  editInput.classList.add("hidden");
  editBtn.textContent = "Edit";
  persistPresetSnapshot();
  saveState();
  drawWheel();
}

function cancelEdit(nameSpan, editInput, editBtn, original) {
  editInput.value = original;
  nameSpan.classList.remove("hidden");
  editInput.classList.add("hidden");
  editBtn.textContent = "Edit";
}

function moveParticipant(index, dir) {
  const next = index + dir;
  if (next < 0 || next >= state.participants.length) return;
  const arr = state.participants;
  [arr[index], arr[next]] = [arr[next], arr[index]];
  persistPresetSnapshot();
  saveState();
  renderParticipants();
  drawWheel();
}

function addParticipant(name) {
  const trimmed = name.trim();
  if (!trimmed) return;
  state.participants.push(createParticipant(trimmed, true));
  persistPresetSnapshot();
  saveState();
  renderParticipants();
  drawWheel();
  updateSpinButton();
}

function removeParticipant(id) {
  if (isSpinning) return;
  state.participants = state.participants.filter((p) => p.id !== id);
  if (state.lastWinnerId === id) hideWinner();
  persistPresetSnapshot();
  saveState();
  renderParticipants();
  drawWheel();
  updateSpinButton();
}

function init() {
  loadState();
  applyTheme(state.theme);
  presetSelect.value = state.preset;
  renderParticipants();
  renderHistory();
  drawWheel();
  updateSpinButton();

  if (state.lastWinnerId) {
    const p = state.participants.find((x) => x.id === state.lastWinnerId);
    if (p && p.active) {
      winnerArea.classList.remove("hidden");
      winnerName.textContent = p.name;
    }
  }

  presetSelect.addEventListener("change", () => loadPreset(presetSelect.value));
  themeSelect.addEventListener("change", () => applyTheme(themeSelect.value));
  resetPresetBtn.addEventListener("click", resetPreset);
  resetAllBtn.addEventListener("click", resetAll);
  spinBtn.addEventListener("click", spinWheel);

  addPersonBtn.addEventListener("click", () => {
    addPersonRow.classList.remove("hidden");
    addPersonBtn.classList.add("hidden");
    newPersonInput.value = "";
    newPersonInput.focus();
  });
  confirmAddBtn.addEventListener("click", () => {
    addParticipant(newPersonInput.value);
    newPersonInput.value = "";
    addPersonRow.classList.add("hidden");
    addPersonBtn.classList.remove("hidden");
  });
  cancelAddBtn.addEventListener("click", () => {
    addPersonRow.classList.add("hidden");
    addPersonBtn.classList.remove("hidden");
  });
  newPersonInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") confirmAddBtn.click();
    if (e.key === "Escape") cancelAddBtn.click();
  });

  removeWinnerBtn.addEventListener("click", () => {
    if (!state.lastWinnerId) return;
    removeParticipant(state.lastWinnerId);
  });

  keepWinnerBtn.addEventListener("click", () => {
    hideWinner(false);
    spinWheel();
  });

  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => drawWheel(state.wheelRotation), 150);
  });
}

init();
