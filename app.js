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
const gradeLevelSelect = document.getElementById('grade-level-select');

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

    // Create hidden audio element
    const audio = document.createElement('audio');
    audio.preload = 'none';
    audio.style.display = 'none';
    const source = document.createElement('source');
    source.src = track.audioUrl;
    source.type = 'audio/mpeg';
    audio.appendChild(source);
    
    // Create custom audio player for saved tracks
    const playerContainer = document.createElement('div');
    playerContainer.className = 'saved-custom-audio-player';
    playerContainer.style.cssText = `
      width: 100%;
      background: transparent;
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 6px;
      padding: 8px;
      margin: 8px 0;
      display: flex;
      align-items: center;
      gap: 8px;
    `;
    
    // Create small play button
    const playButton = document.createElement('button');
    playButton.innerHTML = '▶';
    playButton.style.cssText = `
      width: 30px;
      height: 30px;
      border-radius: 4px;
      background: rgba(255,255,255,0.1);
      border: 1px solid rgba(255,255,255,0.2);
      color: #ffffff;
      font-size: 12px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
    `;
    
    // Simple hover effect
    playButton.addEventListener('mouseenter', () => {
      playButton.style.background = 'rgba(255,255,255,0.2)';
    });
    
    playButton.addEventListener('mouseleave', () => {
      playButton.style.background = 'rgba(255,255,255,0.1)';
    });
    
    // Create small progress bar
    const progressContainer = document.createElement('div');
    progressContainer.style.cssText = `
      flex: 1;
      height: 3px;
      background: rgba(255,255,255,0.1);
      border-radius: 2px;
      position: relative;
      cursor: pointer;
    `;
    
    const progressBar = document.createElement('div');
    progressBar.style.cssText = `
      height: 100%;
      background: #ffffff;
      border-radius: 2px;
      width: 0%;
      transition: width 0.1s ease;
    `;
    
    progressContainer.appendChild(progressBar);
    
    // Create time display
    const timeDisplay = document.createElement('div');
    timeDisplay.style.cssText = `
      color: #cccccc;
      font-size: 11px;
      font-weight: 400;
      min-width: 60px;
      text-align: center;
      font-family: inherit;
    `;
    timeDisplay.textContent = '0:00 / 0:00';
    
    // Add elements to container
    playerContainer.appendChild(playButton);
    playerContainer.appendChild(progressContainer);
    playerContainer.appendChild(timeDisplay);
    
    // Audio control logic
    let isPlaying = false;
    
    playButton.addEventListener('click', () => {
      if (isPlaying) {
        audio.pause();
        playButton.innerHTML = '▶';
        isPlaying = false;
      } else {
        audio.play();
        playButton.innerHTML = '⏸';
        isPlaying = true;
      }
    });
    
    // Update progress bar
    audio.addEventListener('timeupdate', () => {
      if (audio.duration) {
        const progress = (audio.currentTime / audio.duration) * 100;
        progressBar.style.width = progress + '%';
        
        // Update time display
        const current = Math.floor(audio.currentTime);
        const total = Math.floor(audio.duration);
        timeDisplay.textContent = `${Math.floor(current/60)}:${(current%60).toString().padStart(2, '0')} / ${Math.floor(total/60)}:${(total%60).toString().padStart(2, '0')}`;
      }
    });
    
    // Handle audio end
    audio.addEventListener('ended', () => {
      playButton.innerHTML = '▶';
      isPlaying = false;
      progressBar.style.width = '0%';
    });
    
    // Handle progress bar click
    progressContainer.addEventListener('click', (e) => {
      if (audio.duration) {
        const rect = progressContainer.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const percentage = clickX / rect.width;
        audio.currentTime = percentage * audio.duration;
      }
    });

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

    // Add lyrics display for saved tracks - clean and simple
    if (track.lyrics && track.lyrics.length > 0) {
      const lyricsTitle = document.createElement('h4');
      lyricsTitle.textContent = 'Lyrics';
      lyricsTitle.style.cssText = `
        color: #ffffff;
        font-size: 14px;
        font-weight: 600;
        margin: 10px 0 6px 0;
        text-align: center;
      `;
      
      const lyricsList = document.createElement('div');
      lyricsList.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: 3px;
        margin-bottom: 10px;
      `;
      
      track.lyrics.forEach((line, index) => {
        if (line.trim()) {
          const lineDiv = document.createElement('div');
          lineDiv.style.cssText = `
            font-size: 12px;
            font-weight: 400;
            color: #cccccc;
            line-height: 1.4;
            text-align: center;
            padding: 2px 0;
          `;
          
          lineDiv.innerHTML = line;
          lyricsList.appendChild(lineDiv);
        }
      });
      
      card.appendChild(lyricsTitle);
      card.appendChild(lyricsList);
    }

    card.append(meta, playerContainer, audio, actions);
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
  const selectedGradeLevel = gradeLevelSelect.value;
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

  if (!selectedGradeLevel) {
    gradeLevelSelect.focus();
    gradeLevelSelect.classList.add('input-error');
    window.setTimeout(() => gradeLevelSelect.classList.remove('input-error'), 900);
    return;
  }

  if (selectedStyle === 'Other') {
    customStyle = styleCustom;
  } else {
    customStyle = '';
  }

  // Show loading state
  generateResult.hidden = false;
  resultTitle.textContent = 'Generating your educational song...';
  resultDescription.textContent = 'Creating lyrics and music with AI...';
  saveTrackBtn.disabled = true;
  saveTrackBtn.textContent = 'Generating...';

  // Make API call to backend
  const requestData = {
    subject: displayTopic,
    concepts: [...conceptBuffer],
    music_genre: displayStyle,
    notes: notesValue,
    grade_level: selectedGradeLevel
  };

  console.log('Sending request to backend:', requestData);
  
  fetch('http://localhost:8000/start-session', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestData)
  })
  .then(response => {
    console.log('Backend response status:', response.status);
    return response.json();
  })
  .then(data => {
    console.log('Backend response data:', data);
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
      audioUrl: `http://localhost:8000${data.audio_url}`,
      lyrics: data.lyrics,
      createdAt: timestamp.toISOString()
    };

    resultTitle.textContent = `${title} — ${displayTopic}`;
    resultDescription.textContent = description;
    if (conceptBuffer.length) {
      resultDescription.textContent += ` (Concept cues: ${conceptBuffer.join(', ')})`;
    }
    
    // Show lyrics - clean and simple
    if (data.lyrics && data.lyrics.length > 0) {
      const lyricsTitle = document.createElement('h3');
      lyricsTitle.textContent = 'Lyrics';
      lyricsTitle.style.cssText = `
        color: #ffffff;
        font-size: 18px;
        font-weight: 600;
        margin: 20px 0 12px 0;
        text-align: center;
      `;
      
      const lyricsList = document.createElement('div');
      lyricsList.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: 6px;
        margin-bottom: 20px;
      `;
      
      data.lyrics.forEach((line, index) => {
        if (line.trim()) {
          const lineDiv = document.createElement('div');
          lineDiv.style.cssText = `
            font-size: 15px;
            font-weight: 400;
            color: #cccccc;
            line-height: 1.5;
            text-align: center;
            padding: 4px 0;
          `;
          
          lineDiv.innerHTML = line;
          lyricsList.appendChild(lineDiv);
        }
      });
      
      resultDescription.appendChild(lyricsTitle);
      resultDescription.appendChild(lyricsList);
    }

    // Create custom audio player
    const audioSource = previewAudio.querySelector('source');
    if (audioSource) {
      const audioUrl = `http://localhost:8000${data.audio_url}`;
      audioSource.src = audioUrl;
      previewAudio.load();
      
      // Hide default controls and create custom player
      previewAudio.controls = false;
      
      // Remove existing custom player if any
      const existingPlayer = resultDescription.querySelector('.custom-audio-player');
      if (existingPlayer) {
        existingPlayer.remove();
      }
      
      // Create custom audio player container - match app style
      const playerContainer = document.createElement('div');
      playerContainer.className = 'custom-audio-player';
      playerContainer.style.cssText = `
        width: 100%;
        background: transparent;
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 8px;
        padding: 12px;
        margin-top: 15px;
        display: flex;
        align-items: center;
        gap: 12px;
      `;
      
      // Create play/pause button - match your buttons
      const playButton = document.createElement('button');
      playButton.innerHTML = '▶';
      playButton.style.cssText = `
        width: 40px;
        height: 40px;
        border-radius: 6px;
        background: rgba(255,255,255,0.1);
        border: 1px solid rgba(255,255,255,0.2);
        color: #ffffff;
        font-size: 16px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s ease;
      `;
      
      // Simple hover effect
      playButton.addEventListener('mouseenter', () => {
        playButton.style.background = 'rgba(255,255,255,0.2)';
      });
      
      playButton.addEventListener('mouseleave', () => {
        playButton.style.background = 'rgba(255,255,255,0.1)';
      });
      
      // Create progress bar container - match app style
      const progressContainer = document.createElement('div');
      progressContainer.style.cssText = `
        flex: 1;
        height: 4px;
        background: rgba(255,255,255,0.1);
        border-radius: 2px;
        position: relative;
        cursor: pointer;
      `;
      
      // Create progress bar - match app colors
      const progressBar = document.createElement('div');
      progressBar.style.cssText = `
        height: 100%;
        background: #ffffff;
        border-radius: 2px;
        width: 0%;
        transition: width 0.1s ease;
      `;
      
      progressContainer.appendChild(progressBar);
      
      // Create time display - match app text style
      const timeDisplay = document.createElement('div');
      timeDisplay.style.cssText = `
        color: #cccccc;
        font-size: 13px;
        font-weight: 400;
        min-width: 80px;
        text-align: center;
        font-family: inherit;
      `;
      timeDisplay.textContent = '0:00 / 0:00';
      
      // Add all elements to container
      playerContainer.appendChild(playButton);
      playerContainer.appendChild(progressContainer);
      playerContainer.appendChild(timeDisplay);
      
      // Add player to the result description
      resultDescription.appendChild(playerContainer);
      
      // Audio control logic
      let isPlaying = false;
      
      playButton.addEventListener('click', () => {
        if (isPlaying) {
          previewAudio.pause();
          playButton.innerHTML = '▶';
          isPlaying = false;
        } else {
          previewAudio.play();
          playButton.innerHTML = '⏸';
          isPlaying = true;
        }
      });
      
      // Update progress bar
      previewAudio.addEventListener('timeupdate', () => {
        if (previewAudio.duration) {
          const progress = (previewAudio.currentTime / previewAudio.duration) * 100;
          progressBar.style.width = progress + '%';
          
          // Update time display
          const current = Math.floor(previewAudio.currentTime);
          const total = Math.floor(previewAudio.duration);
          timeDisplay.textContent = `${Math.floor(current/60)}:${(current%60).toString().padStart(2, '0')} / ${Math.floor(total/60)}:${(total%60).toString().padStart(2, '0')}`;
        }
      });
      
      // Handle audio end
      previewAudio.addEventListener('ended', () => {
        playButton.innerHTML = '▶';
        isPlaying = false;
        progressBar.style.width = '0%';
      });
      
      // Handle progress bar click
      progressContainer.addEventListener('click', (e) => {
        if (previewAudio.duration) {
          const rect = progressContainer.getBoundingClientRect();
          const clickX = e.clientX - rect.left;
          const percentage = clickX / rect.width;
          previewAudio.currentTime = percentage * previewAudio.duration;
        }
      });
    }

    saveTrackBtn.disabled = false;
    saveTrackBtn.textContent = 'Save to library';
  })
  .catch(error => {
    console.error('Frontend error:', error);
    console.error('Error type:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    resultTitle.textContent = 'Error generating song';
    resultDescription.textContent = `There was a problem creating your educational song. Error: ${error.message}`;
    saveTrackBtn.disabled = false;
    saveTrackBtn.textContent = 'Try Again';
  });
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
  
  // Initialize custom music cursor
  initMusicCursor();
});

// Custom Music Cursor
class MusicCursor {
  constructor() {
    this.cursor = document.getElementById('music-cursor');
    this.isActive = false;
    this.currentAnimation = '';
    this.isPlaying = false;
    this.mouseX = 0;
    this.mouseY = 0;
    this.cursorX = 0;
    this.cursorY = 0;
    this.animationId = null;
    
    this.init();
  }
  
  init() {
    // Track mouse movement with throttling
    let lastTime = 0;
    document.addEventListener('mousemove', (e) => {
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
      
      if (!this.animationId) {
        this.animationId = requestAnimationFrame(() => {
          this.updatePosition();
          this.animationId = null;
        });
      }
    });
    
    // Add hover listeners to music elements
    this.addMusicElementListeners();
    
    // Listen for audio events
    this.addAudioListeners();
    
    // Show cursor on page load
    this.show();
  }
  
  updatePosition() {
    if (this.cursor) {
      // Smooth interpolation for lag-free movement
      this.cursorX += (this.mouseX - this.cursorX) * 0.3;
      this.cursorY += (this.mouseY - this.cursorY) * 0.3;
      
      this.cursor.style.transform = `translate(${this.cursorX - 16}px, ${this.cursorY - 16}px)`;
    }
  }
  
  show() {
    if (this.cursor) {
      this.cursor.classList.add('active');
      this.isActive = true;
    }
  }
  
  hide() {
    if (this.cursor) {
      this.cursor.classList.remove('active');
      this.isActive = false;
    }
  }
  
  addAnimation(animation) {
    if (this.cursor) {
      this.cursor.classList.remove('bounce', 'pulse', 'spin', 'hovering', 'playing');
      this.cursor.classList.add(animation);
      this.currentAnimation = animation;
    }
  }
  
  removeAnimation() {
    if (this.cursor) {
      this.cursor.classList.remove('bounce', 'pulse', 'spin', 'hovering', 'playing');
      this.currentAnimation = '';
    }
  }
  
  addMusicElementListeners() {
    // Add listeners to existing music elements
    const musicElements = document.querySelectorAll('.music-cursor-target, audio, .result-player, .saved-tracks .card');
    
    musicElements.forEach(element => {
      element.addEventListener('mouseenter', () => {
        this.addAnimation('hovering');
      });
      
      element.addEventListener('mouseleave', () => {
        if (!this.isPlaying) {
          this.removeAnimation();
        }
      });
    });
    
    // Watch for dynamically added elements
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) { // Element node
            const audioElements = node.querySelectorAll ? node.querySelectorAll('audio, .result-player, .saved-tracks .card') : [];
            audioElements.forEach(element => {
              element.addEventListener('mouseenter', () => {
                this.addAnimation('hovering');
              });
              
              element.addEventListener('mouseleave', () => {
                if (!this.isPlaying) {
                  this.removeAnimation();
                }
              });
            });
          }
        });
      });
    });
    
    observer.observe(document.body, { childList: true, subtree: true });
  }
  
  addAudioListeners() {
    document.addEventListener('play', (e) => {
      if (e.target.tagName === 'AUDIO') {
        this.isPlaying = true;
        this.addAnimation('playing');
      }
    });
    
    document.addEventListener('pause', (e) => {
      if (e.target.tagName === 'AUDIO') {
        this.isPlaying = false;
        this.removeAnimation();
      }
    });
    
    document.addEventListener('ended', (e) => {
      if (e.target.tagName === 'AUDIO') {
        this.isPlaying = false;
        this.removeAnimation();
      }
    });
  }
}

// Initialize custom cursor
function initMusicCursor() {
  musicCursor = new MusicCursor();
}

