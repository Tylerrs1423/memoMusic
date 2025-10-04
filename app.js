import { initDecryptedText } from './decrypted-text.js';

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

function handleHashChange() {
  let hash = window.location.hash || '#menu';
  if (!sectionIds.has(hash.replace('#', ''))) {
    hash = '#menu';
    window.history.replaceState(null, '', hash);
  }

  sections.forEach((section) => {
    const match = `#${section.id}` === hash;
    section.hidden = !match;
    section.classList.toggle('active', match);
    if (match) {
      window.requestAnimationFrame(() => section.focus({ preventScroll: false }));
    }
  });

  navLinks.forEach((link) => {
    const match = link.getAttribute('href') === hash;
    link.setAttribute('aria-current', match ? 'page' : 'false');
  });

  header.classList.remove('open');
  navToggle.setAttribute('aria-expanded', 'false');
  navToggle.classList.remove('active');
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
    styleInput.focus();
  } else {
    styleInput.disabled = true;
    styleInput.setAttribute('aria-hidden', 'true');
    styleInput.placeholder = 'Style auto-filled from list';
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
  link.addEventListener('click', () => {
    header.classList.remove('open');
    navToggle.setAttribute('aria-expanded', 'false');
    navToggle.classList.remove('active');
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

window.addEventListener('DOMContentLoaded', () => {
  if (!window.location.hash) {
    window.location.hash = '#menu';
  }
  handleHashChange();
  renderConcepts();
  renderSavedTracks();
  if (topicSelect) {
    setTopicInputState(topicSelect.value || '');
  }
  if (styleSelect) {
    setStyleInputState(styleSelect.value || '');
  }
  initDecryptedText();
  initAnimationLibrary();
});

window.addEventListener('load', handleHashChange);
