import { initTextType } from './text-type.js';
import { initShinyText } from './shiny-text.js';
import { initRibbons } from './ribbons.js';

const sections = Array.from(document.querySelectorAll('.section'));
const sectionIds = new Set(sections.map((section) => section.id));
const navLinks = Array.from(document.querySelectorAll('.nav-link'));
const header = document.querySelector('.site-header');
const navToggle = document.querySelector('.nav-toggle');
navToggle.setAttribute('aria-expanded', 'false');

const createForm = document.getElementById('create-form');
const topicInput = document.getElementById('topic-input');
const styleSelect = document.getElementById('style-select');
const styleInput = document.getElementById('style-input');
const generateResult = document.getElementById('generate-result');
const resultTitle = document.getElementById('result-title');
const resultDescription = document.getElementById('result-description');
const saveTrackBtn = document.getElementById('save-track-btn');
const previewAudio = document.getElementById('preview-audio');

const conceptInput = document.getElementById('conceptInput');
const addConceptButton = document.getElementById('addConcept');
const conceptListElement = document.getElementById('conceptList');
const topicSelect = document.getElementById('topic-select');
const notesInput = document.getElementById('notes-input');

const savedList = document.getElementById('saved-list');
const savedEmptyState = document.getElementById('saved-empty');

const menuCursorLayer = document.querySelector('.menu-cursor-layer');
const menuLink = document.querySelector('.nav-link[href="#menu"]');
const menuExperiences = document.querySelector('.menu-experiences');
const experienceButtons = Array.from(document.querySelectorAll('.experience-pill'));
const experiencePreview = document.querySelector('.experience-preview');
const experienceTitle = experiencePreview?.querySelector('[data-experience-title]');
const experienceCopy = experiencePreview?.querySelector('[data-experience-copy]');
const experienceTags = experiencePreview?.querySelector('[data-experience-tags]');
const experienceBpm = experiencePreview?.querySelector('[data-experience-bpm]');
const experienceAction = experiencePreview?.querySelector('[data-experience-action]');
const pulseButton = experiencePreview?.querySelector('[data-pulse-button]');
const sparklineBars = experiencePreview ? Array.from(experiencePreview.querySelectorAll('.experience-sparkline span')) : [];
const pulseTimerDisplay = experiencePreview?.querySelector('[data-pulse-timer]');

const STORAGE_KEYS = {
  tracks: 'memomusic-tracks',
  concepts: 'memomusic-concepts'
};

const MENU_CURSOR_CONFIG = {
  spacing: 55,
  maxPoints: 12,
  symbols: ['♪', '♫', '♬', '📘', '📗', '📙', '♩']
};

let conceptBuffer = loadConcepts();
let savedTracks = loadTracks();
let currentDraft = null;
let lastCursorPoint = null;
let cursorPoints = [];
let animateFn = null;
let customTopic = '';
let customStyle = '';
let previewTimerInterval = null;
let previewCountdown = 0;

function fallbackAnimate(element, keyframes, options) {
  const animation = element.animate(keyframes, options);
  const ensureFinished =
    animation.finished ||
    new Promise((resolve) => {
      animation.addEventListener('finish', resolve, { once: true });
    });
  return {
    finished: ensureFinished,
    stop: () => animation.cancel()
  };
}

async function initAnimationLibrary() {
  try {
    const motionModule = await import('https://cdn.jsdelivr.net/npm/motion@10/dist/motion.mjs');
    animateFn = motionModule.animate;
  } catch (error) {
    console.warn('Motion import failed, using fallback animation.', error);
    animateFn = fallbackAnimate;
  }
}

function getSectionIdFromHash(hash) {
  if (!hash) return null;
  const normalized = hash.startsWith('#') ? hash.slice(1) : hash;
  return sectionIds.has(normalized) ? normalized : null;
}

function setActiveNavLink(targetHash) {
  navLinks.forEach((link) => {
    const match = link.getAttribute('href') === targetHash;
    link.setAttribute('aria-current', match ? 'page' : 'false');
  });
}

function focusSection(section) {
  if (!section || !section.hasAttribute('tabindex')) return;
  window.requestAnimationFrame(() => {
    section.focus({ preventScroll: true });
  });
}

function scrollSectionIntoView(section, behavior = 'smooth') {
  if (!section) return;
  const headerHeight = header?.offsetHeight ?? 0;
  const targetOffset = section.getBoundingClientRect().top + window.scrollY - headerHeight - 24;
  const top = Math.max(targetOffset, 0);
  const scrollBehavior = behavior === 'auto' ? 'auto' : 'smooth';
  window.scrollTo({ top, behavior: scrollBehavior });
}

function ensureSectionsAreVisible() {
  sections.forEach((section) => {
    if (section.hidden) {
      section.hidden = false;
    }
  });
}

function activateSection(sectionId, { withScroll = true, behavior = 'smooth', updateHash = true } = {}) {
  if (!sectionIds.has(sectionId)) return;

  const targetHash = `#${sectionId}`;
  const targetSection = document.getElementById(sectionId);
  if (!targetSection) return;

  ensureSectionsAreVisible();
  sections.forEach((section) => {
    section.classList.toggle('active', section.id === sectionId);
  });
  setActiveNavLink(targetHash);

  if (updateHash && window.location.hash !== targetHash) {
    const method = window.location.hash ? 'pushState' : 'replaceState';
    window.history[method](null, '', targetHash);
  }

  if (withScroll) {
    scrollSectionIntoView(targetSection, behavior);
  }

  focusSection(targetSection);

  if (sectionId === 'menu') {
    initTextType({ restart: true });
  }

  header?.classList.remove('open');
  navToggle?.setAttribute('aria-expanded', 'false');
  navToggle?.classList.remove('active');
}

function handleHashChange(event) {
  const sectionId = getSectionIdFromHash(window.location.hash) || 'menu';
  const isNavigationEvent = event?.type === 'hashchange' || event?.type === 'popstate';
  const behavior = isNavigationEvent ? 'smooth' : 'auto';
  activateSection(sectionId, { withScroll: true, behavior, updateHash: false });
}

function toggleNav() {
  const isOpen = header.classList.toggle('open');
  navToggle.setAttribute('aria-expanded', String(isOpen));
  navToggle.classList.toggle('active', isOpen);
}

function loadTracks() {
  const raw = localStorage.getItem(STORAGE_KEYS.tracks);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn('Failed to parse tracks from storage', error);
    return [];
  }
}

function saveTracks() {
  localStorage.setItem(STORAGE_KEYS.tracks, JSON.stringify(savedTracks));
}

function renderSavedTracks() {
  savedList.innerHTML = '';
  if (!savedTracks.length) {
    savedEmptyState.hidden = false;
    return;
  }

  savedEmptyState.hidden = true;
  savedTracks.forEach((track) => {
    const card = document.createElement('article');
    card.className = 'saved-card';
    card.setAttribute('role', 'listitem');

    const title = document.createElement('h3');
    title.textContent = track.title;

    const description = document.createElement('p');
    description.textContent = track.description;

    const meta = document.createElement('p');
    meta.className = 'saved-meta';
    meta.textContent = `${track.style} • ${new Date(track.createdAt).toLocaleDateString()}`;

    const audio = document.createElement('audio');
    audio.controls = true;
    audio.preload = 'none';
    const source = document.createElement('source');
    source.src = track.audioUrl;
    source.type = 'audio/mpeg';
    audio.appendChild(source);

    const actions = document.createElement('div');
    actions.className = 'card-actions';

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'btn secondary';
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', () => {
      savedTracks = savedTracks.filter((item) => item.id !== track.id);
      saveTracks();
      renderSavedTracks();
    });

    actions.appendChild(deleteBtn);

    card.append(title, description);

    if (track.topic) {
      const topicLine = document.createElement('p');
      topicLine.className = 'saved-topic';
      topicLine.textContent = `Topic: ${track.topic}`;
      card.appendChild(topicLine);
    }

    if (track.notes) {
      const notesLine = document.createElement('p');
      notesLine.className = 'saved-notes';
      notesLine.textContent = `Notes: ${track.notes}`;
      card.appendChild(notesLine);
    }

    if (track.concepts && track.concepts.length) {
      const conceptsLine = document.createElement('p');
      conceptsLine.className = 'saved-concepts';
      conceptsLine.textContent = `Concept cues: ${track.concepts.join(', ')}`;
      card.appendChild(conceptsLine);
    }
    card.append(meta, audio, actions);
    savedList.appendChild(card);
  });
}

function loadConcepts() {
  const raw = localStorage.getItem(STORAGE_KEYS.concepts);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn('Failed to load concepts', error);
    return [];
  }
}

function saveConcepts() {
  localStorage.setItem(STORAGE_KEYS.concepts, JSON.stringify(conceptBuffer));
}

function renderConcepts() {
  conceptListElement.innerHTML = '';
  if (!conceptBuffer.length) {
    return;
  }
  conceptBuffer.forEach((concept, index) => {
    const chip = document.createElement('li');
    chip.textContent = concept;

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.setAttribute('aria-label', `Remove concept ${concept}`);
    removeBtn.textContent = '×';
    removeBtn.addEventListener('click', () => {
      conceptBuffer.splice(index, 1);
      saveConcepts();
      renderConcepts();
    });

    chip.appendChild(removeBtn);
    conceptListElement.appendChild(chip);
  });
}

function handleAddConcept() {
  const value = conceptInput.value.trim();
  if (!value) return;
  const alreadyExists = conceptBuffer.some((entry) => entry.toLowerCase() === value.toLowerCase());
  if (!alreadyExists) {
    conceptBuffer.push(value);
    saveConcepts();
    renderConcepts();
  }
  conceptInput.value = '';
  conceptInput.focus();
}

function setTopicInputState(value) {
  if (!topicSelect) return;
  if (value === 'Other') {
    topicInput.disabled = false;
    topicInput.setAttribute('aria-hidden', 'false');
    topicInput.value = customTopic;
    topicInput.placeholder = 'Describe your topic';
    topicInput.required = true;
    topicInput.focus();
  } else {
    topicInput.disabled = true;
    topicInput.setAttribute('aria-hidden', 'true');
    topicInput.placeholder = 'Topic auto-filled from list';
    topicInput.value = '';
    topicInput.required = false;
  }
}

function setStyleInputState(value) {
  if (!styleSelect || !styleInput) return;
  if (value === 'Other') {
    styleInput.disabled = false;
    styleInput.setAttribute('aria-hidden', 'false');
    styleInput.placeholder = 'Describe your style';
    styleInput.required = true;
    styleInput.value = customStyle;
    styleInput.focus();
  } else {
    styleInput.disabled = true;
    styleInput.setAttribute('aria-hidden', 'true');
    styleInput.placeholder = 'Style auto-filled from list';
    customStyle = styleInput.value.trim();
    styleInput.value = '';
    styleInput.required = false;
  }
}

function summarizeNotes(notes) {
  const clean = notes.replace(/\s+/g, ' ').trim();
  if (clean.length <= 140) return clean;
  return `${clean.slice(0, 137)}…`;
}

function spawnMenuCursorPoint(x, y) {
  if (!menuCursorLayer) return;

  const span = document.createElement('span');
  span.className = 'menu-cursor-item';
  span.textContent = MENU_CURSOR_CONFIG.symbols[Math.floor(Math.random() * MENU_CURSOR_CONFIG.symbols.length)];
  span.style.left = `${x}px`;
  span.style.top = `${y}px`;

  menuCursorLayer.appendChild(span);
  cursorPoints.push(span);
  if (cursorPoints.length > MENU_CURSOR_CONFIG.maxPoints) {
    const old = cursorPoints.shift();
    old?.remove();
  }

  const randomX = Math.random() * 20 - 10;
  const randomY = Math.random() * 20 - 10;
  const randomScale = 0.8 + Math.random() * 0.6;

  const animator = animateFn || fallbackAnimate;
  animator(
    span,
    {
      opacity: [0, 1, 0],
      transform: [
        'translate(-50%, -50%) scale(0.5)',
        `translate(calc(-50% + ${randomX}px), calc(-50% + ${randomY}px)) scale(${randomScale})`,
        'translate(-50%, -50%) scale(0.2)'
      ]
    },
    {
      duration: 1.6,
      easing: 'ease-out'
    }
  ).finished.then(() => {
    span.remove();
    cursorPoints = cursorPoints.filter((item) => item !== span);
  });
}

function handleMenuPointerMove(event) {
  if (!menuCursorLayer) return;
  const headerRect = header.getBoundingClientRect();
  const x = event.clientX - headerRect.left;
  const y = event.clientY - headerRect.top;

  if (!lastCursorPoint) {
    lastCursorPoint = { x, y };
    spawnMenuCursorPoint(x, y);
    return;
  }

  const dx = x - lastCursorPoint.x;
  const dy = y - lastCursorPoint.y;
  const distance = Math.hypot(dx, dy);

  if (distance >= MENU_CURSOR_CONFIG.spacing) {
    spawnMenuCursorPoint(x, y);
    lastCursorPoint = { x, y };
  }
}

function resetMenuCursorTrail() {
  cursorPoints.forEach((point) => point.remove());
  cursorPoints = [];
  lastCursorPoint = null;
}

function formatCountdown(seconds) {
  const safeSeconds = Math.max(0, Math.ceil(Number(seconds) || 0));
  return `00:${String(safeSeconds).padStart(2, '0')}`;
}

function stopPreviewTimer() {
  if (previewTimerInterval) {
    window.clearInterval(previewTimerInterval);
    previewTimerInterval = null;
  }
}

function resetPreviewTimer(duration) {
  const target = Number(duration) || 0;
  stopPreviewTimer();
  previewCountdown = target;
  if (pulseTimerDisplay) {
    pulseTimerDisplay.textContent = target ? formatCountdown(target) : '00:00';
    pulseTimerDisplay.setAttribute('data-active', 'false');
  }
}

function startPreviewTimer() {
  if (!pulseButton || !pulseTimerDisplay) return;
  const duration = Number(pulseButton.dataset.duration) || previewCountdown || 0;
  if (!duration) {
    resetPreviewTimer(duration);
    return;
  }
  stopPreviewTimer();
  previewCountdown = duration;
  pulseTimerDisplay.textContent = formatCountdown(previewCountdown);
  pulseTimerDisplay.setAttribute('data-active', 'true');
  previewTimerInterval = window.setInterval(() => {
    previewCountdown -= 1;
    if (previewCountdown <= 0) {
      pulseTimerDisplay.textContent = '00:00';
      pulseTimerDisplay.setAttribute('data-active', 'false');
      stopPreviewTimer();
      return;
    }
    pulseTimerDisplay.textContent = formatCountdown(previewCountdown);
  }, 1000);
}

function applyExperienceColors(button) {
  if (!menuExperiences) return;
  const colors = (button.dataset.colors || '').split(',').map((value) => value.trim()).filter(Boolean);
  if (!colors.length) return;
  const [primary, secondary] = colors;
  menuExperiences.style.setProperty('--experience-accent', primary || 'var(--accent)');
  menuExperiences.style.setProperty('--experience-accent-2', secondary || primary || 'var(--accent-2)');
}

function updateExperience(button) {
  if (!button || !experiencePreview) return;

  experienceButtons.forEach((pill) => {
    const isActive = pill === button;
    pill.classList.toggle('is-active', isActive);
    pill.setAttribute('aria-selected', String(isActive));
  });

  const title = button.dataset.title || button.textContent.trim();
  const description = button.dataset.copy || '';
  const bpm = button.dataset.bpm || '';
  const length = button.dataset.length || '';
  const actionLabel = button.dataset.action || 'Load preset';
  const tags = (button.dataset.tags || '').split('|').map((tag) => tag.trim()).filter(Boolean);

  if (experienceTitle) {
    experienceTitle.textContent = title;
  }
  if (experienceCopy) {
    experienceCopy.textContent = description;
  }
  if (experienceBpm) {
    experienceBpm.textContent = bpm;
  }
  if (experienceAction) {
    experienceAction.textContent = actionLabel;
    experienceAction.setAttribute('aria-label', `${actionLabel} – ${title}`);
  }

  if (experienceTags) {
    experienceTags.innerHTML = '';
    if (tags.length) {
      tags.forEach((tag) => {
        const item = document.createElement('li');
        item.textContent = tag;
        experienceTags.appendChild(item);
      });
    }
  }

  if (experiencePreview.dataset) {
    experiencePreview.dataset.selected = button.dataset.experience || button.id || '';
  }

  const previewDuration = Number(button.dataset.previewDuration) || 0;
  if (pulseButton) {
    pulseButton.dataset.duration = String(previewDuration);
  }
  resetPreviewTimer(previewDuration);

  applyExperienceColors(button);

  sparklineBars.forEach((bar) => {
    const duration = (1.6 + Math.random() * 1.2).toFixed(2);
    bar.style.animationDuration = `${duration}s`;
    bar.style.animationDelay = `${Math.random() * 0.6}s`;
  });
}

function focusExperienceButton(index) {
  if (!experienceButtons.length) return;
  const targetIndex = (index + experienceButtons.length) % experienceButtons.length;
  const button = experienceButtons[targetIndex];
  button.focus();
  updateExperience(button);
}

function handleExperienceKeyNav(event, index) {
  switch (event.key) {
    case 'ArrowRight':
    case 'ArrowDown':
      event.preventDefault();
      focusExperienceButton(index + 1);
      break;
    case 'ArrowLeft':
    case 'ArrowUp':
      event.preventDefault();
      focusExperienceButton(index - 1);
      break;
    case 'Home':
      event.preventDefault();
      focusExperienceButton(0);
      break;
    case 'End':
      event.preventDefault();
      focusExperienceButton(experienceButtons.length - 1);
      break;
    default:
      break;
  }
}

function triggerExperiencePulse() {
  if (!pulseButton || !experiencePreview) return;
  pulseButton.classList.add('is-pulsing');
  experiencePreview.classList.add('is-pulsing');

  sparklineBars.forEach((bar) => {
    const duration = (1.4 + Math.random()).toFixed(2);
    bar.style.animationDuration = `${duration}s`;
  });

  startPreviewTimer();

  window.setTimeout(() => {
    pulseButton.classList.remove('is-pulsing');
    experiencePreview.classList.remove('is-pulsing');
  }, 1100);
}

if (experienceButtons.length) {
  const initialButton = experienceButtons.find((button) => button.classList.contains('is-active')) || experienceButtons[0];
  updateExperience(initialButton);
  experienceButtons.forEach((button, index) => {
    button.addEventListener('click', () => updateExperience(button));
    button.addEventListener('keydown', (event) => handleExperienceKeyNav(event, index));
  });
}

if (pulseButton) {
  pulseButton.addEventListener('click', () => {
    triggerExperiencePulse();
  });
}

createForm.addEventListener('submit', (event) => {
  event.preventDefault();

  const selectedTopic = topicSelect.value;
  const topicValue = topicInput.value.trim();
  const topicLabel = topicSelect.options[topicSelect.selectedIndex]?.text || topicValue;
  const displayTopic = topicSelect.value === 'Other' ? (topicValue || 'Custom topic') : topicLabel;
  const notesValue = (notesInput?.value || '').trim();
  const selectedStyle = styleSelect.value;
  const styleCustom = styleInput ? styleInput.value.trim() : '';
  const displayStyle = selectedStyle === 'Other'
    ? styleCustom || 'Custom style'
    : styleSelect.options[styleSelect.selectedIndex]?.text || selectedStyle;

  if (topicSelect.value === 'Other') {
    customTopic = topicValue;
  }

  if (!selectedTopic) {
    topicSelect.focus();
    topicSelect.classList.add('input-error');
    window.setTimeout(() => topicSelect.classList.remove('input-error'), 900);
    return;
  }

  if (selectedTopic === 'Other' && !topicValue) {
    topicInput.focus();
    topicInput.classList.add('input-error');
    window.setTimeout(() => topicInput.classList.remove('input-error'), 900);
    return;
  }

  if (!selectedStyle) {
    styleSelect.focus();
    styleSelect.classList.add('input-error');
    window.setTimeout(() => styleSelect.classList.remove('input-error'), 900);
    return;
  }

  if (selectedStyle === 'Other' && !styleCustom) {
    if (styleInput) {
      styleInput.focus();
      styleInput.classList.add('input-error');
      window.setTimeout(() => styleInput.classList.remove('input-error'), 900);
    }
    return;
  }

  if (selectedStyle === 'Other') {
    customStyle = styleCustom;
  } else {
    customStyle = '';
  }

  const timestamp = new Date();
  const title = `${displayStyle} memo mix`;
  const description = summarizeNotes(notesValue || topicValue || displayTopic);

  currentDraft = {
    id: Date.now(),
    title,
    description,
    topic: displayTopic,
    notes: notesValue,
    style: displayStyle,
    concepts: [...conceptBuffer],
    audioUrl: previewAudio.querySelector('source').src,
    createdAt: timestamp.toISOString()
  };

  resultTitle.textContent = `${title} — ${displayTopic}`;
  resultDescription.textContent = description;
  if (conceptBuffer.length) {
    resultDescription.textContent += ` (Concept cues: ${conceptBuffer.join(', ')})`;
  }
  generateResult.hidden = false;
  saveTrackBtn.disabled = false;
  saveTrackBtn.textContent = 'Save to library';
  previewAudio.currentTime = 0;
});

saveTrackBtn.addEventListener('click', () => {
  if (!currentDraft) {
    return;
  }
  savedTracks.unshift({ ...currentDraft });
  saveTracks();
  renderSavedTracks();
  saveTrackBtn.disabled = true;
  saveTrackBtn.textContent = 'Saved';
});

addConceptButton.addEventListener('click', handleAddConcept);

conceptInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    handleAddConcept();
  }
});

topicSelect?.addEventListener('change', (event) => {
  const value = event.target.value;
  if (value !== 'Other') {
    customTopic = topicInput.value.trim();
  }
  setTopicInputState(value);
});

styleSelect?.addEventListener('change', (event) => {
  const value = event.target.value;
  setStyleInputState(value);
});

navLinks.forEach((link) => {
  link.addEventListener('click', (event) => {
    const hash = link.getAttribute('href');
    const sectionId = getSectionIdFromHash(hash);
    if (!sectionId) {
      header?.classList.remove('open');
      navToggle?.setAttribute('aria-expanded', 'false');
      navToggle?.classList.remove('active');
      return;
    }

    event.preventDefault();
    activateSection(sectionId, { withScroll: true, behavior: 'smooth', updateHash: true });
  });
});

navToggle.addEventListener('click', toggleNav);

menuLink?.addEventListener('pointermove', handleMenuPointerMove);
menuLink?.addEventListener('pointerenter', () => {
  const rect = menuLink.getBoundingClientRect();
  const headerRect = header.getBoundingClientRect();
  const x = rect.left + rect.width / 2 - headerRect.left;
  const y = rect.bottom - headerRect.top + 12;
  spawnMenuCursorPoint(x, y);
  lastCursorPoint = { x, y };
});
menuLink?.addEventListener('pointerleave', resetMenuCursorTrail);

window.addEventListener('hashchange', handleHashChange);
window.addEventListener('popstate', handleHashChange);

window.addEventListener('DOMContentLoaded', () => {
  const initialSectionId = getSectionIdFromHash(window.location.hash) || 'menu';
  const shouldUpdateHash = !window.location.hash;
  activateSection(initialSectionId, {
    withScroll: true,
    behavior: 'auto',
    updateHash: shouldUpdateHash
  });
  renderConcepts();
  renderSavedTracks();
  if (topicSelect) {
    setTopicInputState(topicSelect.value || '');
  }
  if (styleSelect) {
    setStyleInputState(styleSelect.value || '');
  }
  initTextType();
  initShinyText();
  initAnimationLibrary();
  initRibbons({
    colors: ['#ffffff'],
    baseThickness: 30,
    speedMultiplier: 0.5,
    maxAge: 500,
    enableFade: false,
    enableShaderEffect: true
  });
});

