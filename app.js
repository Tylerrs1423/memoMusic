import { initDecryptedText } from './decrypted-text.js';
import { initShinyText } from './shiny-text.js';
import { initRibbons } from './ribbons.js';

const sections = Array.from(document.querySelectorAll('.section'));
const sectionIds = new Set(sections.map((section) => section.id));
const navLinks = Array.from(document.querySelectorAll('.nav-link'));
const header = document.querySelector('.site-header');
const navToggle = document.querySelector('.nav-toggle');
navToggle.setAttribute('aria-expanded', 'false');

// These will be initialized in DOMContentLoaded
let createForm, topicInput, styleSelect, styleInput, generateResult, resultTitle, resultDescription;
let saveTrackBtn, previewAudio, conceptInput, addConceptButton, conceptListElement;
let topicSelect, notesInput, gradeLevelSelect;

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
    initDecryptedText();
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
    practiced_lyrics: data.practiced_lyrics,
    blanks: data.blanks,
    createdAt: timestamp.toISOString()
  };

  resultTitle.textContent = `${title} — ${displayTopic}`;
  resultDescription.textContent = description;
  if (conceptBuffer.length) {
    resultDescription.textContent += ` (Concept cues: ${conceptBuffer.join(', ')})`;
  }
    
    // Show lyrics with practice interface
    if (data.lyrics && data.lyrics.length > 0) {
      const lyricsTitle = document.createElement('h3');
      lyricsTitle.textContent = 'Fill-in-the-Blank Practice';
      lyricsTitle.style.cssText = `
        color: #ffffff;
        font-size: 18px;
        font-weight: 600;
        margin: 20px 0 12px 0;
        text-align: center;
      `;
      
      const practiceContainer = document.createElement('div');
      practiceContainer.style.cssText = `
        background: rgba(255, 255, 255, 0.05);
        border-radius: 12px;
        padding: 20px;
        margin-bottom: 20px;
      `;
      
      // Create practice lyrics with input fields
      if (data.practiced_lyrics && data.blanks) {
        createPracticeInterface(data.practiced_lyrics, data.blanks, practiceContainer);
      } else {
        // Fallback to regular lyrics display
        createRegularLyricsDisplay(data.lyrics, practiceContainer);
      }
      
      // Add original lyrics toggle
      const toggleButton = document.createElement('button');
      toggleButton.textContent = 'Show Original Lyrics';
      toggleButton.style.cssText = `
        background: rgba(255, 255, 255, 0.1);
        color: #ffffff;
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 6px;
        padding: 8px 16px;
        margin: 10px 0;
        cursor: pointer;
        font-size: 14px;
      `;
      
      toggleButton.addEventListener('click', () => {
        const isShowingOriginal = practiceContainer.querySelector('.original-lyrics');
        if (isShowingOriginal) {
          isShowingOriginal.remove();
          toggleButton.textContent = 'Show Original Lyrics';
        } else {
          createRegularLyricsDisplay(data.lyrics, practiceContainer);
          toggleButton.textContent = 'Hide Original Lyrics';
        }
      });
      
      resultDescription.appendChild(lyricsTitle);
      resultDescription.appendChild(practiceContainer);
      resultDescription.appendChild(toggleButton);
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
  
  // Refresh practice section if it exists
  if (window.loadPracticeSongs) {
    window.loadPracticeSongs();
  }
  
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
  // Initialize all form elements first
  createForm = document.getElementById('create-form');
  topicInput = document.getElementById('topic-input');
  styleSelect = document.getElementById('style-select');
  styleInput = document.getElementById('style-input');
  generateResult = document.getElementById('generate-result');
  resultTitle = document.getElementById('result-title');
  resultDescription = document.getElementById('result-description');
  saveTrackBtn = document.getElementById('save-track-btn');
  previewAudio = document.getElementById('preview-audio');
  conceptInput = document.getElementById('conceptInput');
  addConceptButton = document.getElementById('addConcept');
  conceptListElement = document.getElementById('conceptList');
  topicSelect = document.getElementById('topic-select');
  notesInput = document.getElementById('notes-input');
  gradeLevelSelect = document.getElementById('grade-level-select');
  
  console.log('Form elements initialized:', {
    createForm: !!createForm,
    topicSelect: !!topicSelect,
    styleSelect: !!styleSelect,
    gradeLevelSelect: !!gradeLevelSelect
  });
  
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
  initDecryptedText();
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
  
  // Initialize scroll-based navigation
  initScrollNavigation();
  
  // Initialize practice section
  initPracticeSection();
});

// Scroll-based navigation highlighting
function initScrollNavigation() {
  const navLinks = document.querySelectorAll('.nav-link[href^="#"]');
  const sections = document.querySelectorAll('.section[id]');
  
  console.log('Initializing scroll navigation:', {
    navLinks: navLinks.length,
    sections: sections.length
  });
  
  if (!navLinks.length || !sections.length) {
    console.log('Missing elements for scroll navigation, retrying...');
    setTimeout(initScrollNavigation, 200);
    return;
  }
  
  // Function to update active navigation
  function updateActiveNav() {
    const scrollPosition = window.scrollY + 100; // Offset for better detection
    
    let activeSection = null;
    sections.forEach(section => {
      const sectionTop = section.offsetTop;
      const sectionBottom = sectionTop + section.offsetHeight;
      
      if (scrollPosition >= sectionTop && scrollPosition < sectionBottom) {
        activeSection = section.id;
      }
    });
    
    // Remove active states from all nav links
    navLinks.forEach(link => {
      link.classList.remove('shiny-text-active');
      link.removeAttribute('aria-current');
    });
    
    // Add active state to the current section's nav link
    if (activeSection) {
      const activeLink = document.querySelector(`.nav-link[href="#${activeSection}"]`);
      if (activeLink) {
        activeLink.classList.add('shiny-text-active');
        activeLink.setAttribute('aria-current', 'page');
      }
    }
  }
  
  // Listen for scroll events
  window.addEventListener('scroll', updateActiveNav);
  
  // Initial check
  updateActiveNav();
  
  // Smooth scrolling for navigation links
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = link.getAttribute('href').substring(1);
      const targetSection = document.getElementById(targetId);
      
      if (targetSection) {
        const headerHeight = document.querySelector('.site-header').offsetHeight;
        const targetPosition = targetSection.offsetTop - headerHeight - 20;
        
        window.scrollTo({
          top: targetPosition,
          behavior: 'smooth'
        });
        
        // Immediately update nav link active state when clicking
        navLinks.forEach(navLink => {
          navLink.classList.remove('shiny-text-active');
          navLink.removeAttribute('aria-current');
        });
        link.classList.add('shiny-text-active');
        link.setAttribute('aria-current', 'page');
      }
    });
  });
}

// Practice Interface Functions
function createPracticeInterface(practicedLyrics, blanks, container, track = null) {
  console.log('Creating practice interface with', blanks.length, 'blanks');
  
  // Create progress indicator
  const progressContainer = document.createElement('div');
  progressContainer.style.cssText = `
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    padding: 12px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 8px;
  `;
  
  const progressText = document.createElement('span');
  progressText.textContent = 'Practice Progress: 0/4 completed';
  progressText.style.cssText = `
    color: #ffffff;
    font-size: 14px;
    font-weight: 500;
  `;
  
  const progressBar = document.createElement('div');
  progressBar.style.cssText = `
    width: 200px;
    height: 6px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 3px;
    overflow: hidden;
  `;
  
  const progressFill = document.createElement('div');
  progressFill.style.cssText = `
    height: 100%;
    width: 0%;
    background: linear-gradient(90deg, #6366f1, #8b5cf6);
    transition: width 0.3s ease;
  `;
  
  progressBar.appendChild(progressFill);
  progressContainer.appendChild(progressText);
  progressContainer.appendChild(progressBar);
  
  // Create lyrics with input fields
  const lyricsContainer = document.createElement('div');
  lyricsContainer.style.cssText = `
    display: flex;
    flex-direction: column;
    gap: 12px;
  `;
  
  // Track user answers
  const userAnswers = {};
  let completedBlanks = 0;
  
  practicedLyrics.forEach((line, lineIndex) => {
    if (line.trim()) {
      const lineContainer = document.createElement('div');
      lineContainer.style.cssText = `
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
        padding: 12px;
        background: rgba(255, 255, 255, 0.02);
        border-radius: 8px;
        font-size: 16px;
        line-height: 1.6;
        color: #ffffff;
      `;
      
      // Split line into words and handle blanks
      const words = line.split(' ');
      words.forEach((word, wordIndex) => {
        if (word === '___') {
          // Find the blank for this position
          const blank = blanks.find(b => b.line_index === lineIndex && b.word_position === wordIndex);
          
          if (blank) {
            const inputContainer = document.createElement('span');
            inputContainer.style.cssText = `
              position: relative;
              display: inline-block;
            `;
            
            const input = document.createElement('input');
            input.type = 'text';
            input.placeholder = 'Type answer...';
            input.style.cssText = `
              background: rgba(255, 255, 255, 0.1);
              border: 2px solid rgba(255, 255, 255, 0.2);
              border-radius: 6px;
              padding: 8px 12px;
              color: #ffffff;
              font-size: 16px;
              min-width: 120px;
              text-align: center;
              transition: all 0.3s ease;
            `;
            
            // Add focus/blur styling
            input.addEventListener('focus', () => {
              input.style.borderColor = '#6366f1';
              input.style.background = 'rgba(255, 255, 255, 0.15)';
            });
            
            input.addEventListener('blur', () => {
              input.style.borderColor = 'rgba(255, 255, 255, 0.2)';
              input.style.background = 'rgba(255, 255, 255, 0.1)';
            });
            
            // Handle answer submission
            input.addEventListener('keypress', (e) => {
              if (e.key === 'Enter') {
                checkAnswer(input, blank, inputContainer);
              }
            });
            
            input.addEventListener('blur', () => {
              checkAnswer(input, blank, inputContainer);
            });
            
            inputContainer.appendChild(input);
            lineContainer.appendChild(inputContainer);
            
            // Store reference for progress tracking
            userAnswers[`${lineIndex}-${wordIndex}`] = { input, blank, container: inputContainer, isCorrect: false };
          }
        } else {
          // Regular word
          const wordSpan = document.createElement('span');
          wordSpan.textContent = word;
          wordSpan.style.cssText = `
            color: #cccccc;
          `;
          lineContainer.appendChild(wordSpan);
        }
      });
      
      lyricsContainer.appendChild(lineContainer);
    }
  });
  
  // Check answer function
  function checkAnswer(input, blank, container) {
    const userAnswer = input.value.trim().toLowerCase();
    const correctAnswer = blank.original_word.toLowerCase();
    
    if (userAnswer === correctAnswer) {
      // Correct answer
      input.style.borderColor = '#10b981';
      input.style.background = 'rgba(16, 185, 129, 0.1)';
      input.disabled = true;
      
      // Add checkmark
      const checkmark = document.createElement('span');
      checkmark.textContent = ' ✓';
      checkmark.style.cssText = `
        color: #10b981;
        font-weight: bold;
        margin-left: 8px;
      `;
      container.appendChild(checkmark);
      
      // Update progress
      if (!userAnswers[`${blank.line_index}-${blank.word_position}`].isCorrect) {
        completedBlanks++;
        userAnswers[`${blank.line_index}-${blank.word_position}`].isCorrect = true;
        updateProgress();
      }
    } else if (userAnswer.length > 0) {
      // Wrong answer
      input.style.borderColor = '#ef4444';
      input.style.background = 'rgba(239, 68, 68, 0.1)';
    }
  }
  
  // Update progress
  function updateProgress() {
    progressText.textContent = `Practice Progress: ${completedBlanks}/${blanks.length} completed`;
    progressFill.style.width = `${(completedBlanks / blanks.length) * 100}%`;
    
    // Save progress to localStorage and MongoDB
    if (track) {
      savePracticeProgress(track, completedBlanks, blanks.length);
    }
    
    if (completedBlanks === blanks.length) {
      progressText.textContent = '🎉 All blanks completed! Great job!';
      progressText.style.color = '#10b981';
    }
  }
  
  container.appendChild(progressContainer);
  container.appendChild(lyricsContainer);
}

function createRegularLyricsDisplay(lyrics, container) {
  const originalLyrics = document.createElement('div');
  originalLyrics.className = 'original-lyrics';
  originalLyrics.style.cssText = `
    background: rgba(255, 255, 255, 0.02);
    border-radius: 8px;
    padding: 16px;
    margin-top: 16px;
  `;
  
  const title = document.createElement('h4');
  title.textContent = 'Original Lyrics';
  title.style.cssText = `
    color: #ffffff;
    font-size: 16px;
    font-weight: 600;
    margin: 0 0 12px 0;
  `;
  
  const lyricsList = document.createElement('div');
  lyricsList.style.cssText = `
    display: flex;
    flex-direction: column;
    gap: 6px;
  `;
  
  lyrics.forEach((line, index) => {
    if (line.trim()) {
      const lineDiv = document.createElement('div');
      lineDiv.style.cssText = `
        font-size: 15px;
        font-weight: 400;
        color: #cccccc;
        line-height: 1.5;
        padding: 4px 0;
      `;
      lineDiv.innerHTML = line;
      lyricsList.appendChild(lineDiv);
    }
  });
  
  originalLyrics.appendChild(title);
  originalLyrics.appendChild(lyricsList);
  container.appendChild(originalLyrics);
}

// Practice Section Functions
function initPracticeSection() {
  const practiceSection = document.getElementById('practice');
  const practiceSongList = document.getElementById('practice-song-list');
  const practiceEmpty = document.getElementById('practice-empty');
  const practiceInterface = document.getElementById('practice-interface');
  const practiceContent = document.getElementById('practice-content');
  const backToSongsBtn = document.getElementById('back-to-songs');
  const practiceSongTitle = document.getElementById('practice-song-title');
  
  if (!practiceSection) return;
  
  // Load and display practice songs
  loadPracticeSongs();
  
  // Back button handler
  if (backToSongsBtn) {
    backToSongsBtn.addEventListener('click', () => {
      practiceInterface.style.display = 'none';
      document.querySelector('.practice-song-selector').style.display = 'block';
    });
  }
  
  function loadPracticeSongs() {
    const tracks = loadTracks();
    const songsWithPractice = tracks.filter(track => track.practiced_lyrics && track.blanks);
    
    if (songsWithPractice.length === 0) {
      practiceSongList.style.display = 'none';
      practiceEmpty.style.display = 'block';
      return;
    }
    
    practiceSongList.style.display = 'grid';
    practiceEmpty.style.display = 'none';
    practiceSongList.innerHTML = '';
    
    songsWithPractice.forEach(track => {
      const card = createPracticeSongCard(track);
      practiceSongList.appendChild(card);
    });
  }
  
  function createPracticeSongCard(track) {
    const card = document.createElement('div');
    card.className = 'practice-song-card has-practice';
    card.addEventListener('click', () => startPracticeSession(track));
    
    const completedBlanks = track.practice_progress ? 
      track.practice_progress.completed_blanks || 0 : 0;
    const totalBlanks = track.blanks ? track.blanks.length : 0;
    const completionRate = totalBlanks > 0 ? Math.round((completedBlanks / totalBlanks) * 100) : 0;
    
    card.innerHTML = `
      <h4>${track.title}</h4>
      <p>${track.description}</p>
      <div class="practice-song-meta">
        <span>${track.topic}</span>
        <span>${track.style}</span>
      </div>
      <div class="practice-song-stats">
        <span>🎯 ${completedBlanks}/${totalBlanks} blanks</span>
        <span>📊 ${completionRate}% complete</span>
        <span>🎵 ${track.concepts ? track.concepts.length : 0} concepts</span>
      </div>
    `;
    
    return card;
  }
  
  function startPracticeSession(track) {
    document.querySelector('.practice-song-selector').style.display = 'none';
    practiceInterface.style.display = 'block';
    practiceSongTitle.textContent = track.title;
    
    // Create practice interface
    practiceContent.innerHTML = '';
    
    // Add audio player
    const audioPlayer = document.createElement('div');
    audioPlayer.className = 'practice-audio-player';
    audioPlayer.innerHTML = `
      <h4>🎵 Listen & Practice</h4>
      <audio controls style="width: 100%; margin-top: 12px;">
        <source src="${track.audioUrl}" type="audio/mpeg">
        Your browser does not support the audio element.
      </audio>
    `;
    practiceContent.appendChild(audioPlayer);
    
    // Add practice interface
    if (track.practiced_lyrics && track.blanks) {
      createPracticeInterface(track.practiced_lyrics, track.blanks, practiceContent, track);
    }
  }
  
  // Expose loadPracticeSongs for external updates
  window.loadPracticeSongs = loadPracticeSongs;
}

// Save practice progress to localStorage and MongoDB
function savePracticeProgress(track, completedBlanks, totalBlanks) {
  // Update localStorage
  const tracks = loadTracks();
  const trackIndex = tracks.findIndex(t => t.id === track.id);
  
  if (trackIndex !== -1) {
    tracks[trackIndex].practice_progress = {
      completed_blanks: completedBlanks,
      total_blanks: totalBlanks,
      completion_rate: Math.round((completedBlanks / totalBlanks) * 100),
      last_practiced: new Date().toISOString()
    };
    
    saveTracks(tracks);
    
    // Update MongoDB via API
    savePracticeProgressToMongoDB(track.id, completedBlanks, totalBlanks);
  }
}

// Save practice progress to MongoDB
async function savePracticeProgressToMongoDB(trackId, completedBlanks, totalBlanks) {
  try {
    const response = await fetch('http://localhost:8000/api/practice-progress', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        session_id: trackId,
        completed_blanks: completedBlanks,
        total_blanks: totalBlanks,
        completion_rate: Math.round((completedBlanks / totalBlanks) * 100),
        last_practiced: new Date().toISOString()
      })
    });
    
    if (response.ok) {
      console.log('Practice progress saved to MongoDB');
    } else {
      console.error('Failed to save practice progress to MongoDB');
    }
  } catch (error) {
    console.error('Error saving practice progress:', error);
  }
}

