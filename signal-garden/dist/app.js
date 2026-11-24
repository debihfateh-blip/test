"use strict";

const STORAGE_KEY = "signal-garden-state-v1";
const CORRUPT_BACKUP_KEY = "signal-garden-corrupt-backup";
const SCHEMA_VERSION = 1;
const DAY_MS = 86_400_000;

const elements = {
  composer: document.querySelector("#composer-section"),
  openComposer: document.querySelector("#open-composer"),
  closeComposer: document.querySelector("#close-composer"),
  emptyAction: document.querySelector("#empty-action"),
  seedForm: document.querySelector("#seed-form"),
  gardenGrid: document.querySelector("#garden-grid"),
  emptyState: document.querySelector("#empty-state"),
  emptyTitle: document.querySelector("#empty-title"),
  emptyCopy: document.querySelector("#empty-copy"),
  resultCount: document.querySelector("#result-count"),
  searchInput: document.querySelector("#search-input"),
  sortSelect: document.querySelector("#sort-select"),
  stageFilters: document.querySelector(".stage-filters"),
  tagFilters: document.querySelector("#tag-filters"),
  sunlightSection: document.querySelector("#sunlight-section"),
  sunlightRow: document.querySelector("#sunlight-row"),
  weatherHeading: document.querySelector("#weather-heading"),
  weatherCopy: document.querySelector("#weather-copy"),
  weatherOrbit: document.querySelector("#weather-orbit"),
  statGrowing: document.querySelector("#stat-growing"),
  statBlooming: document.querySelector("#stat-blooming"),
  statSunlight: document.querySelector("#stat-sunlight"),
  exportButton: document.querySelector("#export-button"),
  importButton: document.querySelector("#import-button"),
  importInput: document.querySelector("#import-input"),
  tourButton: document.querySelector("#tour-button"),
  seedDialog: document.querySelector("#seed-dialog"),
  closeDialog: document.querySelector("#close-dialog"),
  editForm: document.querySelector("#edit-form"),
  dialogStage: document.querySelector("#dialog-stage"),
  dialogTitle: document.querySelector("#dialog-title"),
  editTitle: document.querySelector("#edit-title"),
  editNote: document.querySelector("#edit-note"),
  editNextStep: document.querySelector("#edit-next-step"),
  editStage: document.querySelector("#edit-stage"),
  editTag: document.querySelector("#edit-tag"),
  editEnergy: document.querySelector("#edit-energy"),
  editImpact: document.querySelector("#edit-impact"),
  seedMeta: document.querySelector("#seed-meta"),
  deleteSeed: document.querySelector("#delete-seed"),
  archiveSeed: document.querySelector("#archive-seed"),
  focusSeed: document.querySelector("#focus-seed"),
  focusDialog: document.querySelector("#focus-dialog"),
  closeFocus: document.querySelector("#close-focus"),
  focusTitle: document.querySelector("#focus-title"),
  focusNextStep: document.querySelector("#focus-next-step"),
  timerDisplay: document.querySelector("#timer-display"),
  timerToggle: document.querySelector("#timer-toggle"),
  timerReset: document.querySelector("#timer-reset"),
  timerPresets: document.querySelector(".timer-presets"),
  completeSession: document.querySelector("#complete-session"),
  toast: document.querySelector("#toast"),
};

let state = loadState();
let filters = { stage: "all", tag: "all", search: "", sort: "sunlight" };
let selectedSeedId = null;
let focusSeedId = null;
let timerSeconds = 15 * 60;
let timerDuration = 15 * 60;
let timerInterval = null;
let timerDeadline = null;
let toastTimeout = null;
let composerOpener = elements.openComposer;

function id() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return `seed-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isoDaysAgo(days) {
  return new Date(Date.now() - days * DAY_MS).toISOString();
}

function sampleState() {
  return {
    schemaVersion: SCHEMA_VERSION,
    seeds: [
      {
        id: id(),
        title: "Build a tiny ritual for better endings",
        note: "A five-minute reflection that closes the day without turning into another productivity system.",
        nextStep: "Write the three questions the ritual should ask.",
        tag: "life",
        energy: 2,
        impact: 4,
        stage: "sprout",
        touches: 1,
        sessions: 1,
        archived: false,
        createdAt: isoDaysAgo(12),
        updatedAt: isoDaysAgo(8),
        lastWateredAt: isoDaysAgo(8),
      },
      {
        id: id(),
        title: "A map of the questions I keep asking",
        note: "Group recurring questions into themes and look for the one that connects the rest.",
        nextStep: "Collect five questions from recent notes.",
        tag: "curious",
        energy: 3,
        impact: 5,
        stage: "seed",
        touches: 0,
        sessions: 0,
        archived: false,
        createdAt: isoDaysAgo(10),
        updatedAt: isoDaysAgo(10),
        lastWateredAt: isoDaysAgo(10),
      },
      {
        id: id(),
        title: "Design one meeting people leave with energy",
        note: "Prototype a meeting format that makes decisions visible and gives quiet thinkers room to contribute.",
        nextStep: "Sketch a 25-minute agenda and test it once.",
        tag: "work",
        energy: 4,
        impact: 4,
        stage: "bloom",
        touches: 3,
        sessions: 2,
        archived: false,
        createdAt: isoDaysAgo(18),
        updatedAt: isoDaysAgo(1),
        lastWateredAt: isoDaysAgo(1),
      },
    ],
  };
}

function cleanText(value, maxLength = 800) {
  return String(value ?? "").replace(/\u0000/g, "").trim().slice(0, maxLength);
}

function normalizeSeed(seed) {
  const now = new Date().toISOString();
  const stage = ["seed", "sprout", "bloom"].includes(seed?.stage) ? seed.stage : "seed";
  return {
    id: cleanText(seed?.id, 120) || id(),
    title: cleanText(seed?.title, 100) || "Untitled seed",
    note: cleanText(seed?.note, 800),
    nextStep: cleanText(seed?.nextStep, 180),
    tag: cleanText(seed?.tag, 28).replace(/^#+/, ""),
    energy: clampNumber(seed?.energy, 1, 5, 3),
    impact: clampNumber(seed?.impact, 1, 5, 3),
    stage,
    touches: clampNumber(seed?.touches, 0, 100_000, stage === "bloom" ? 3 : stage === "sprout" ? 1 : 0),
    sessions: clampNumber(seed?.sessions, 0, 100_000, 0),
    archived: Boolean(seed?.archived),
    createdAt: validDate(seed?.createdAt) || now,
    updatedAt: validDate(seed?.updatedAt) || now,
    lastWateredAt: validDate(seed?.lastWateredAt) || validDate(seed?.updatedAt) || now,
  };
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, Math.round(number))) : fallback;
}

function validDate(value) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function loadState() {
  let stored;
  try {
    stored = localStorage.getItem(STORAGE_KEY);
  } catch (_error) {
    queueMicrotask(() => showToast("Browser storage is unavailable; this garden will last only until the tab closes."));
    return sampleState();
  }
  if (!stored) {
    const initial = sampleState();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
    } catch (_error) {
      queueMicrotask(() => showToast("Browser storage is unavailable; changes may not survive a refresh."));
    }
    return initial;
  }

  try {
    const parsed = JSON.parse(stored);
    if (!parsed || !Array.isArray(parsed.seeds)) throw new Error("Invalid garden data");
    return {
      schemaVersion: SCHEMA_VERSION,
      seeds: parsed.seeds.slice(0, 1000).map(normalizeSeed),
    };
  } catch (_error) {
    try {
      localStorage.setItem(CORRUPT_BACKUP_KEY, stored);
    } catch (_backupError) {
      // The raw value remains untouched if storage cannot accept a backup.
    }
    queueMicrotask(() => showToast("Stored garden data was unreadable. A recovery copy was preserved."));
    return { schemaVersion: SCHEMA_VERSION, seeds: [] };
  }
}

function saveState(message) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    if (message) showToast(message);
    return true;
  } catch (_error) {
    showToast("Could not save. Export your garden before closing this tab.");
    return false;
  }
}

function showToast(message) {
  if (!elements.toast) return;
  window.clearTimeout(toastTimeout);
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  toastTimeout = window.setTimeout(() => elements.toast.classList.remove("show"), 3600);
}

function daysSince(date) {
  const time = Date.parse(date);
  if (!Number.isFinite(time)) return 0;
  return Math.max(0, Math.floor((Date.now() - time) / DAY_MS));
}

function relativeTime(date) {
  const days = daysSince(date);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 14) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 8) return `${weeks} ${weeks === 1 ? "week" : "weeks"} ago`;
  const months = Math.floor(days / 30);
  return `${months} ${months === 1 ? "month" : "months"} ago`;
}

function needsSunlight(seed) {
  return !seed.archived && seed.stage !== "bloom" && seed.impact >= 4 && daysSince(seed.lastWateredAt) >= 7;
}

function sunlightScore(seed) {
  return seed.impact * 4 + Math.min(daysSince(seed.lastWateredAt), 30) - seed.energy;
}

function stageForTouches(touches) {
  if (touches >= 3) return "bloom";
  if (touches >= 1) return "sprout";
  return "seed";
}

function minimumTouchesForStage(stage) {
  return stage === "bloom" ? 3 : stage === "sprout" ? 1 : 0;
}

function computeWeather(activeSeeds) {
  if (!activeSeeds.length) {
    return { title: "Fresh soil", copy: "Plant a thought to see your forecast.", kind: "clear" };
  }
  const thirsty = activeSeeds.filter(needsSunlight);
  const blooms = activeSeeds.filter((seed) => seed.stage === "bloom");
  const quiet = activeSeeds.filter((seed) => daysSince(seed.lastWateredAt) >= 14);
  const recent = activeSeeds.filter((seed) => daysSince(seed.lastWateredAt) <= 2);

  if (thirsty.length >= 2) {
    return {
      title: "Dry spell",
      copy: `${thirsty.length} high-impact seeds have been quiet for a week. Choose one to water.`,
      kind: "dry",
    };
  }
  if (quiet.length > activeSeeds.length / 2 && activeSeeds.length >= 3) {
    return {
      title: "Overgrown",
      copy: "Many threads are competing for light. Archive one, then tend one.",
      kind: "overgrown",
    };
  }
  if (blooms.length >= Math.max(2, Math.ceil(activeSeeds.length * 0.4))) {
    return {
      title: "Bloom season",
      copy: `${blooms.length} ideas are blooming. Capture what made them move.`,
      kind: "bloom",
    };
  }
  if (recent.length >= 2) {
    return {
      title: "Gentle rain",
      copy: "You have tended several ideas recently. Keep the smallest promise next.",
      kind: "clear",
    };
  }
  return {
    title: "Clear skies",
    copy: "The garden is balanced. Follow the idea with the strongest pull.",
    kind: "clear",
  };
}

function render() {
  const activeSeeds = state.seeds.filter((seed) => !seed.archived);
  const thirstySeeds = activeSeeds.filter(needsSunlight).sort((a, b) => sunlightScore(b) - sunlightScore(a));
  const weather = computeWeather(activeSeeds);

  elements.statGrowing.textContent = String(activeSeeds.length);
  elements.statBlooming.textContent = String(activeSeeds.filter((seed) => seed.stage === "bloom").length);
  elements.statSunlight.textContent = String(thirstySeeds.length);
  elements.weatherHeading.textContent = weather.title;
  elements.weatherCopy.textContent = weather.copy;
  elements.weatherOrbit.dataset.weather = weather.kind;

  renderSunlight(thirstySeeds);
  renderTags(filters.stage === "archived" ? state.seeds.filter((seed) => seed.archived) : activeSeeds);
  renderGarden();
}

function renderSunlight(seeds) {
  elements.sunlightRow.replaceChildren();
  if (!seeds.length) {
    const message = document.createElement("p");
    message.className = "sunlight-empty";
    message.textContent = "Everything has had enough light lately. Keep following the quiet pull.";
    elements.sunlightRow.append(message);
    return;
  }

  seeds.slice(0, 3).forEach((seed) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "sunlight-item";
    button.addEventListener("click", () => openSeed(seed.id));

    const text = document.createElement("span");
    const title = document.createElement("strong");
    title.textContent = seed.title;
    const meta = document.createElement("small");
    meta.textContent = `Quiet for ${daysSince(seed.lastWateredAt)} days · Impact ${seed.impact}/5`;
    text.append(title, meta);

    const prompt = document.createElement("span");
    prompt.textContent = "Tend";
    button.append(text, prompt);
    elements.sunlightRow.append(button);
  });
}

function renderTags(activeSeeds) {
  const tags = [...new Set(activeSeeds.map((seed) => seed.tag).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  elements.tagFilters.replaceChildren();
  if (filters.tag !== "all" && !tags.includes(filters.tag)) filters.tag = "all";
  if (!tags.length) {
    filters.tag = "all";
    return;
  }

  ["all", ...tags].forEach((tag) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `tag-button${filters.tag === tag ? " active" : ""}`;
    button.setAttribute("aria-pressed", filters.tag === tag ? "true" : "false");
    button.textContent = tag === "all" ? "All tags" : `#${tag}`;
    button.addEventListener("click", () => {
      filters.tag = tag;
      renderTags(activeSeeds);
      renderGarden();
    });
    elements.tagFilters.append(button);
  });
}

function filteredSeeds() {
  const query = filters.search.toLocaleLowerCase();
  const viewingArchive = filters.stage === "archived";
  const result = state.seeds.filter((seed) => {
    if (viewingArchive !== seed.archived) return false;
    if (!viewingArchive && filters.stage !== "all" && seed.stage !== filters.stage) return false;
    if (filters.tag !== "all" && seed.tag !== filters.tag) return false;
    if (query && !`${seed.title} ${seed.note} ${seed.nextStep} ${seed.tag}`.toLocaleLowerCase().includes(query)) return false;
    return true;
  });

  return result.sort((a, b) => {
    if (filters.sort === "recent") return Date.parse(b.lastWateredAt) - Date.parse(a.lastWateredAt);
    if (filters.sort === "impact") return b.impact - a.impact || a.energy - b.energy;
    if (filters.sort === "alpha") return a.title.localeCompare(b.title);
    return sunlightScore(b) - sunlightScore(a) || Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
  });
}

function renderGarden() {
  const seeds = filteredSeeds();
  elements.gardenGrid.replaceChildren();
  elements.resultCount.textContent = `${seeds.length} ${seeds.length === 1 ? "thought" : "thoughts"} in view`;
  elements.emptyState.hidden = seeds.length > 0;

  if (!seeds.length) {
    const hasAny = state.seeds.length > 0;
    elements.emptyTitle.textContent = hasAny ? "No thoughts match this view." : "Nothing is growing here yet.";
    elements.emptyCopy.textContent = hasAny ? "Try a different stage, tag, or search." : "Plant the thought you keep returning to.";
    elements.emptyAction.hidden = hasAny;
    return;
  }

  seeds.forEach((seed) => elements.gardenGrid.append(createSeedCard(seed)));
}

function createSeedCard(seed) {
  const card = document.createElement("article");
  card.className = "seed-card";
  card.dataset.stage = seed.stage;

  const top = document.createElement("div");
  top.className = "seed-card-top";
  const stage = document.createElement("span");
  stage.className = "stage-badge";
  stage.textContent = seed.archived ? "Archived" : seed.stage;
  const time = document.createElement("span");
  time.className = "seed-card-time";
  time.textContent = `Tended ${relativeTime(seed.lastWateredAt)}`;
  top.append(stage, time);

  const title = document.createElement("button");
  title.type = "button";
  title.className = "seed-title-button";
  title.textContent = seed.title;
  title.setAttribute("aria-label", `Open ${seed.title}`);
  title.addEventListener("click", () => openSeed(seed.id));
  const titleHeading = document.createElement("h3");
  titleHeading.className = "seed-card-title";
  titleHeading.append(title);

  const note = document.createElement("p");
  note.className = "seed-note";
  note.textContent = seed.note || "No notes yet. Open this seed to capture what is pulling you toward it.";

  card.append(top, titleHeading, note);

  if (seed.nextStep) {
    const next = document.createElement("p");
    next.className = "seed-next-step";
    const label = document.createElement("strong");
    label.textContent = "Next small step";
    next.append(label, document.createTextNode(seed.nextStep));
    card.append(next);
  }

  const footer = document.createElement("div");
  footer.className = "seed-card-footer";
  const metrics = document.createElement("div");
  metrics.className = "card-metrics";
  if (seed.tag) metrics.append(pill(`#${seed.tag}`, "tag-pill"));
  metrics.append(pill(`Impact ${seed.impact}`, "metric-pill"), pill(`Energy ${seed.energy}`, "metric-pill"));

  const actions = document.createElement("div");
  actions.className = "seed-card-actions";
  const focus = document.createElement("button");
  focus.type = "button";
  focus.className = "card-action";
  focus.textContent = "Focus";
  focus.setAttribute("aria-label", `Focus on ${seed.title}`);
  focus.addEventListener("click", () => openFocus(seed.id));

  const water = document.createElement("button");
  water.type = "button";
  water.className = "card-action water";
  water.textContent = seed.archived ? "Restore" : "Water";
  water.setAttribute("aria-label", seed.archived ? `Restore ${seed.title}` : `Water ${seed.title}`);
  water.addEventListener("click", () => seed.archived ? restoreSeed(seed.id) : waterSeed(seed.id));
  if (!seed.archived) actions.append(focus);
  actions.append(water);
  footer.append(metrics, actions);
  card.append(footer);
  return card;
}

function pill(text, className) {
  const node = document.createElement("span");
  node.className = className;
  node.textContent = text;
  return node;
}

function toggleComposer(forceOpen, opener = null) {
  const shouldOpen = forceOpen ?? elements.composer.hidden;
  if (shouldOpen && opener) composerOpener = opener;
  elements.composer.hidden = !shouldOpen;
  if (shouldOpen) {
    elements.composer.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => document.querySelector("#seed-title").focus(), 280);
  } else {
    (composerOpener?.isConnected ? composerOpener : elements.openComposer).focus();
  }
}

function plantSeed(event) {
  event.preventDefault();
  const data = new FormData(elements.seedForm);
  const title = cleanText(data.get("title"), 100);
  if (!title) return;
  const now = new Date().toISOString();
  state.seeds.unshift(normalizeSeed({
    id: id(),
    title,
    note: data.get("note"),
    tag: data.get("tag"),
    energy: data.get("energy"),
    impact: data.get("impact"),
    stage: "seed",
    touches: 0,
    sessions: 0,
    archived: false,
    createdAt: now,
    updatedAt: now,
    lastWateredAt: now,
  }));
  saveState(`Planted “${title}”.`);
  elements.seedForm.reset();
  toggleComposer(false);
  filters.stage = "all";
  syncStageButtons();
  render();
}

function openSeed(seedId) {
  const seed = state.seeds.find((item) => item.id === seedId);
  if (!seed) return;
  selectedSeedId = seed.id;
  elements.dialogStage.textContent = seed.archived ? "Archived" : seed.stage;
  elements.dialogTitle.textContent = seed.title;
  elements.editTitle.value = seed.title;
  elements.editNote.value = seed.note;
  elements.editNextStep.value = seed.nextStep;
  elements.editStage.value = seed.stage;
  elements.editTag.value = seed.tag;
  elements.editEnergy.value = String(seed.energy);
  elements.editImpact.value = String(seed.impact);
  elements.archiveSeed.textContent = seed.archived ? "Restore" : "Archive";
  elements.focusSeed.hidden = seed.archived;
  elements.seedMeta.textContent = `Planted ${relativeTime(seed.createdAt)} · ${seed.touches} waterings · ${seed.sessions} focus ${seed.sessions === 1 ? "session" : "sessions"}`;
  elements.seedDialog.showModal();
}

function closeSeedDialog() {
  selectedSeedId = null;
  elements.seedDialog.close();
}

function saveSeedEdits(event) {
  event.preventDefault();
  const seed = state.seeds.find((item) => item.id === selectedSeedId);
  if (!seed) return;
  const stage = elements.editStage.value;
  seed.title = cleanText(elements.editTitle.value, 100) || seed.title;
  seed.note = cleanText(elements.editNote.value, 800);
  seed.nextStep = cleanText(elements.editNextStep.value, 180);
  seed.tag = cleanText(elements.editTag.value, 28).replace(/^#+/, "");
  seed.energy = clampNumber(elements.editEnergy.value, 1, 5, 3);
  seed.impact = clampNumber(elements.editImpact.value, 1, 5, 3);
  seed.stage = stage;
  seed.touches = Math.max(seed.touches, minimumTouchesForStage(stage));
  if (stage === "seed") seed.touches = 0;
  if (stage === "sprout") seed.touches = Math.min(Math.max(seed.touches, 1), 2);
  seed.updatedAt = new Date().toISOString();
  saveState(`Saved “${seed.title}”.`);
  closeSeedDialog();
  render();
}

function waterSeed(seedId, options = {}) {
  const seed = state.seeds.find((item) => item.id === seedId);
  if (!seed) return;
  seed.touches += 1;
  seed.stage = stageForTouches(seed.touches);
  seed.lastWateredAt = new Date().toISOString();
  seed.updatedAt = seed.lastWateredAt;
  if (!options.silent) saveState(`Watered “${seed.title}”.`);
  else saveState();
  render();
}

function restoreSeed(seedId) {
  const seed = state.seeds.find((item) => item.id === seedId);
  if (!seed) return;
  seed.archived = false;
  seed.updatedAt = new Date().toISOString();
  saveState(`Restored “${seed.title}”.`);
  render();
}

function toggleArchive() {
  const seed = state.seeds.find((item) => item.id === selectedSeedId);
  if (!seed) return;
  seed.archived = !seed.archived;
  seed.updatedAt = new Date().toISOString();
  saveState(seed.archived ? `Archived “${seed.title}”.` : `Restored “${seed.title}”.`);
  closeSeedDialog();
  render();
}

function deleteSelectedSeed() {
  const seed = state.seeds.find((item) => item.id === selectedSeedId);
  if (!seed) return;
  if (!window.confirm(`Permanently delete “${seed.title}”? This cannot be undone.`)) return;
  state.seeds = state.seeds.filter((item) => item.id !== selectedSeedId);
  saveState(`Deleted “${seed.title}”.`);
  closeSeedDialog();
  render();
}

function syncStageButtons() {
  elements.stageFilters.querySelectorAll("[data-stage]").forEach((button) => {
    const active = button.dataset.stage === filters.stage;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });
}

function openFocus(seedId) {
  const seed = state.seeds.find((item) => item.id === seedId && !item.archived);
  if (!seed) return;
  if (elements.seedDialog.open) elements.seedDialog.close();
  focusSeedId = seed.id;
  elements.focusTitle.textContent = seed.title;
  elements.focusNextStep.value = seed.nextStep;
  resetTimer(false);
  elements.focusDialog.showModal();
}

function closeFocusDialog() {
  pauseTimer();
  focusSeedId = null;
  elements.focusDialog.close();
}

function setDuration(minutes) {
  pauseTimer();
  timerDuration = Number(minutes) * 60;
  timerSeconds = timerDuration;
  updateTimerDisplay();
  elements.timerPresets.querySelectorAll("[data-minutes]").forEach((button) => {
    const active = Number(button.dataset.minutes) === Number(minutes);
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });
}

function updateTimerDisplay() {
  const minutes = Math.floor(timerSeconds / 60);
  const seconds = timerSeconds % 60;
  elements.timerDisplay.textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  document.title = timerInterval ? `${elements.timerDisplay.textContent} · Signal Garden` : "Signal Garden — Grow the ideas worth returning to";
}

function toggleTimer() {
  if (timerInterval) {
    pauseTimer();
    return;
  }
  if (timerSeconds <= 0) {
    timerSeconds = timerDuration;
    updateTimerDisplay();
  }
  timerDeadline = Date.now() + timerSeconds * 1000;
  elements.timerToggle.textContent = "Pause";
  timerInterval = window.setInterval(() => {
    timerSeconds = Math.max(0, Math.ceil((timerDeadline - Date.now()) / 1000));
    updateTimerDisplay();
    if (timerSeconds === 0) {
      window.clearInterval(timerInterval);
      timerInterval = null;
      timerDeadline = null;
      elements.timerToggle.textContent = "Restart";
      document.title = "Signal Garden — Grow the ideas worth returning to";
      showToast("Focus complete. Mark the session complete when you are ready.");
    }
  }, 250);
}

function pauseTimer() {
  if (timerInterval && timerDeadline) {
    timerSeconds = Math.max(0, Math.ceil((timerDeadline - Date.now()) / 1000));
    updateTimerDisplay();
  }
  window.clearInterval(timerInterval);
  timerInterval = null;
  timerDeadline = null;
  elements.timerToggle.textContent = timerSeconds <= 0 ? "Restart" : timerSeconds === timerDuration ? "Start focus" : "Resume";
  document.title = "Signal Garden — Grow the ideas worth returning to";
}

function resetTimer(announce = true) {
  pauseTimer();
  timerSeconds = timerDuration;
  updateTimerDisplay();
  elements.timerToggle.textContent = "Start focus";
  if (announce) showToast("Focus timer reset.");
}

function completeFocusSession() {
  const seed = state.seeds.find((item) => item.id === focusSeedId);
  if (!seed) return;
  seed.nextStep = cleanText(elements.focusNextStep.value, 180);
  seed.sessions += 1;
  waterSeed(seed.id, { silent: true });
  showToast(`Session complete. “${seed.title}” has been watered.`);
  closeFocusDialog();
}

function exportGarden() {
  const payload = JSON.stringify({
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    seeds: state.seeds,
  }, null, 2);
  const blob = new Blob([payload], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `signal-garden-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast("Garden exported as JSON.");
}

async function importGarden(file) {
  if (!file) return;
  if (file.size > 2_000_000) {
    showToast("That file is too large. Signal Garden accepts exports under 2 MB.");
    return;
  }
  try {
    const parsed = JSON.parse(await file.text());
    if (parsed?.schemaVersion !== SCHEMA_VERSION || !Array.isArray(parsed?.seeds)) {
      throw new Error("Unsupported garden file");
    }
    if (parsed.seeds.length > 1000) throw new Error("Too many seeds");
    if (parsed.seeds.some((seed) => !seed || typeof seed !== "object" || !cleanText(seed.title, 100))) {
      throw new Error("Invalid seed record");
    }
    const importedIds = parsed.seeds.map((seed) => cleanText(seed.id, 120)).filter(Boolean);
    if (new Set(importedIds).size !== importedIds.length) throw new Error("Duplicate seed IDs");
    const imported = parsed.seeds.map(normalizeSeed);
    if (!window.confirm(`Replace this garden with ${imported.length} imported ${imported.length === 1 ? "seed" : "seeds"}? Export first if you want a backup.`)) return;
    state = { schemaVersion: SCHEMA_VERSION, seeds: imported };
    filters = { stage: "all", tag: "all", search: "", sort: "sunlight" };
    elements.searchInput.value = "";
    elements.sortSelect.value = "sunlight";
    syncStageButtons();
    saveState(`Imported ${imported.length} ${imported.length === 1 ? "seed" : "seeds"}.`);
    render();
  } catch (_error) {
    showToast("Could not import that file. Use an unedited Signal Garden export.");
  } finally {
    elements.importInput.value = "";
  }
}

elements.openComposer.addEventListener("click", (event) => toggleComposer(true, event.currentTarget));
elements.emptyAction.addEventListener("click", (event) => toggleComposer(true, event.currentTarget));
elements.closeComposer.addEventListener("click", () => toggleComposer(false));
elements.seedForm.addEventListener("submit", plantSeed);
elements.searchInput.addEventListener("input", (event) => {
  filters.search = event.target.value.trim();
  renderGarden();
});
elements.sortSelect.addEventListener("change", (event) => {
  filters.sort = event.target.value;
  renderGarden();
});
elements.stageFilters.addEventListener("click", (event) => {
  const button = event.target.closest("[data-stage]");
  if (!button) return;
  filters.stage = button.dataset.stage;
  filters.tag = "all";
  syncStageButtons();
  render();
});
elements.tourButton.addEventListener("click", () => {
  document.querySelector("#sunlight-section").scrollIntoView({ behavior: "smooth", block: "start" });
  showToast("Seeds become sprouts after one watering and bloom after three. Focus sessions water them too.");
});
elements.exportButton.addEventListener("click", exportGarden);
elements.importButton.addEventListener("click", () => elements.importInput.click());
elements.importInput.addEventListener("change", (event) => importGarden(event.target.files?.[0]));
elements.closeDialog.addEventListener("click", closeSeedDialog);
elements.editForm.addEventListener("submit", saveSeedEdits);
elements.archiveSeed.addEventListener("click", toggleArchive);
elements.deleteSeed.addEventListener("click", deleteSelectedSeed);
elements.focusSeed.addEventListener("click", () => openFocus(selectedSeedId));
elements.closeFocus.addEventListener("click", closeFocusDialog);
elements.timerToggle.addEventListener("click", toggleTimer);
elements.timerReset.addEventListener("click", () => resetTimer(true));
elements.timerPresets.addEventListener("click", (event) => {
  const button = event.target.closest("[data-minutes]");
  if (button) setDuration(button.dataset.minutes);
});
elements.completeSession.addEventListener("click", completeFocusSession);

elements.seedDialog.addEventListener("click", (event) => {
  if (event.target === elements.seedDialog) closeSeedDialog();
});
elements.focusDialog.addEventListener("click", (event) => {
  if (event.target === elements.focusDialog) closeFocusDialog();
});
elements.seedDialog.addEventListener("close", () => {
  selectedSeedId = null;
});
elements.focusDialog.addEventListener("close", () => {
  pauseTimer();
  focusSeedId = null;
});

window.addEventListener("storage", (event) => {
  if (event.key !== STORAGE_KEY || !event.newValue) return;
  try {
    const incoming = JSON.parse(event.newValue);
    if (Array.isArray(incoming.seeds)) {
      state = { schemaVersion: SCHEMA_VERSION, seeds: incoming.seeds.map(normalizeSeed) };
      render();
      showToast("Garden refreshed from another tab.");
    }
  } catch (_error) {
    // Ignore malformed cross-tab data and preserve the current in-memory garden.
  }
});

window.addEventListener("beforeunload", () => window.clearInterval(timerInterval));

if ("serviceWorker" in navigator && window.isSecureContext) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}

syncStageButtons();
render();
