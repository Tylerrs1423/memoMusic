const panel = document.getElementById('selectionPanel');
const createButton = document.getElementById('createButton');
const closePanel = document.getElementById('closePanel');
const launchButton = document.getElementById('launchButton');
const summaryTitle = document.getElementById('summaryTitle');
const summaryDescription = document.getElementById('summaryDescription');
const summaryMeta = document.getElementById('summaryMeta');
const summaryMusic = document.getElementById('summaryMusic');
const summaryTopic = document.getElementById('summaryTopic');
const floatingContainer = document.querySelector('.floating-symbols');

const musicDetails = {
  'focus-lofi': {
    title: 'Focus Lofi',
    vibe: 'Muted beats & analog layers',
    summary:
      'Subtle drums, warm vinyl textures, and gentle chords designed to anchor every concept.'
  },
  'boost-pop': {
    title: 'Boost Pop',
    vibe: 'Bright hooks & crisp drums',
    summary: 'A vibrant pulse that keeps your recall fast-paced without sacrificing clarity.'
  },
  'deep-ambient': {
    title: 'Deep Ambient',
    vibe: 'Immersive pads & cosmic grain',
    summary: 'Evolving soundscapes that keep your mind breathing while sustaining deep focus.'
  },
  'neo-jazz': {
    title: 'Neo Jazz',
    vibe: 'Modern improv & fluid grooves',
    summary: 'Sophisticated harmonies and elastic basslines for fluid, elegant study sessions.'
  }
};

const topicDetails = {
  mathematiques: {
    title: 'Mathematics',
    hook: 'Visual logic, guided proofs, and spaced repetition for every core idea.'
  },
  histoire: {
    title: 'History',
    hook: 'Immersive narration, interactive timelines, and focus on pivotal characters.'
  },
  sciences: {
    title: 'Sciences',
    hook: 'Simulated experiments, dynamic diagrams, and concise synthesis sheets.'
  },
  langues: {
    title: 'Languages',
    hook: 'Active recall loops, assisted pronunciation, and contextual vocabulary.'
  }
};

const floatingSymbols = [
  {
    className: 'symbol-note',
    svg: '<svg viewBox="0 0 32 32" role="presentation" focusable="false"><path d="M22.86 3.33 12.28 5.71a1.7 1.7 0 0 0-1.32 1.66v13.25a4.27 4.27 0 1 0 2.16 3.72V12.59l9.06-2v8.76a4.27 4.27 0 1 0 2.16 3.72V4.63a1.38 1.38 0 0 0-1.48-1.3z"/></svg>'
  },
  {
    className: 'symbol-book',
    svg: '<svg viewBox="0 0 32 32" role="presentation" focusable="false"><path d="M7.2 6.1C7.2 4.38 8.6 3 10.28 3h14.52C26.48 3 28 4.63 28 6.43v18.84c0 1-1.05 1.52-1.77.94l-.08-.06a6.38 6.38 0 0 0-4.3-1.55h-9.1c-1.06 0-2.04.34-2.89.92l-.18.13c-.72.54-1.58-.03-1.58-.96zm4.62 12.41L23 18.39v-2.34l-11.18.12a.88.88 0 0 1-.9-.88V6.85h-.58a1.54 1.54 0 0 0-1.54 1.54v15.78c.58-.23 1.2-.35 1.85-.35h9.1a8.24 8.24 0 0 1 3.25.67V6.43c0-.38-.35-.72-.73-.72H14.4v7.54c0 .9-.7 1.65-1.6 1.65H11.7z"/></svg>'
  }
];

let selectedMusic = null;
let selectedTopic = null;
let lastFocusedButton = null;

const optionButtons = document.querySelectorAll('.option-card');

function openPanel() {
  if (!panel.classList.contains('active')) {
    panel.classList.add('active');
    requestAnimationFrame(() => {
      panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }
}

function closePanelArea() {
  panel.classList.remove('active');
  if (lastFocusedButton) {
    lastFocusedButton.focus({ preventScroll: true });
  }
}

function handleOptionClick(button) {
  const group = button.dataset.type;
  const id = button.dataset.id;

  if (group === 'music') {
    selectedMusic = selectedMusic === id ? null : id;
  }

  if (group === 'topic') {
    selectedTopic = selectedTopic === id ? null : id;
  }

  updateSelections();
  updateSummary();
}

function updateSelections() {
  optionButtons.forEach((btn) => {
    const { type, id } = btn.dataset;
    const isSelected = (type === 'music' && id === selectedMusic) || (type === 'topic' && id === selectedTopic);
    btn.classList.toggle('is-selected', Boolean(isSelected));
  });
}

function updateSummary() {
  if (selectedMusic && selectedTopic) {
    const music = musicDetails[selectedMusic];
    const topic = topicDetails[selectedTopic];

    summaryTitle.textContent = `${music.title} × ${topic.title}`;
    summaryDescription.textContent = `${music.summary} ${topic.hook}`;
    summaryMusic.textContent = `${music.title} · ${music.vibe}`;
    summaryTopic.textContent = topic.title;
    summaryMeta.hidden = false;
    launchButton.disabled = false;
  } else if (selectedMusic || selectedTopic) {
    const music = selectedMusic ? musicDetails[selectedMusic]?.title : 'Ambience';
    const topic = selectedTopic ? topicDetails[selectedTopic]?.title : 'Topic';
    summaryTitle.textContent = `Continue with ${music} and ${topic}`;
    summaryDescription.textContent =
      'One more step: pair a music ambience with a study topic to craft your capsule.';
    summaryMeta.hidden = true;
    launchButton.disabled = true;
  } else {
    summaryTitle.textContent = 'Pick an ambience and a topic';
    summaryDescription.textContent = 'Your tailored capsule will appear here, ready to deploy.';
    summaryMeta.hidden = true;
    launchButton.disabled = true;
  }
}

function spawnFloatingSymbols(total = 16) {
  if (!floatingContainer) {
    return;
  }

  const fragment = document.createDocumentFragment();

  for (let index = 0; index < total; index += 1) {
    const definition = floatingSymbols[Math.floor(Math.random() * floatingSymbols.length)];
    const element = document.createElement('span');
    element.className = `floating-symbol ${definition.className}`;

    const leftPos = Math.random() * 100;
    const duration = 18 + Math.random() * 14;
    const delay = Math.random() * -20;
    const drift = `${Math.floor(Math.random() * 120 - 60)}px`;
    const scale = (0.6 + Math.random() * 0.7).toFixed(2);

    element.style.left = `${leftPos}%`;
    element.style.setProperty('--duration', `${duration}s`);
    element.style.setProperty('--delay', `${delay}s`);
    element.style.setProperty('--drift', drift);
    element.style.setProperty('--scale', scale);
    element.innerHTML = definition.svg;

    fragment.appendChild(element);
  }

  floatingContainer.appendChild(fragment);
}

createButton.addEventListener('click', () => {
  lastFocusedButton = createButton;
  openPanel();
});

closePanel.addEventListener('click', closePanelArea);

optionButtons.forEach((button) => {
  button.addEventListener('click', () => handleOptionClick(button));
});

launchButton.addEventListener('click', () => {
  if (!(selectedMusic && selectedTopic)) {
    return;
  }

  const music = musicDetails[selectedMusic];
  const topic = topicDetails[selectedTopic];
  const headline = `${music.title} × ${topic.title}`;

  const message = [
    `${headline}`,
    '',
    `${music.summary}`,
    `${topic.hook}`,
    '',
    'Your capsule is ready! Export it or launch a Live session when you are set.'
  ].join('\n');

  window.alert(message);
});

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && panel.classList.contains('active')) {
    closePanelArea();
  }
});

updateSummary();
spawnFloatingSymbols();
