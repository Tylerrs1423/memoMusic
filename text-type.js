const DEFAULT_OPTIONS = {
  speed: 60,
  pause: 2000,
  deletingSpeed: 40,
  loop: false,
  cursor: true,
  cursorChar: '|',
  colors: []
};

class Typewriter {
  constructor(element) {
    this.el = element;
    this.sentences = this.parseSentences(element.dataset.typeText);
    this.speed = parseFloat(element.dataset.typeSpeed || DEFAULT_OPTIONS.speed);
    this.pause = parseFloat(element.dataset.typePause || DEFAULT_OPTIONS.pause);
    this.deletingSpeed = parseFloat(element.dataset.typeDeleting || DEFAULT_OPTIONS.deletingSpeed);
    this.loop = element.dataset.typeLoop === 'true';
    this.cursorChar = element.dataset.typeCursor || DEFAULT_OPTIONS.cursorChar;
    this.showCursor = element.dataset.typeCursor !== 'false';
    this.colors = this.parseSentences(element.dataset.typeColors);
    this.currentSentence = 0;
    this.currentChar = 0;
    this.isDeleting = false;
    this.timeout = null;
    this.cursorBlink = null;
    this.container = this.prepareStructure();
    this.isVisible = !element.dataset.typeStartOnVisible;

    if (element.dataset.typeStartOnVisible === 'true') {
      this.observeVisibility();
    } else {
      this.start();
    }
  }

  parseSentences(raw) {
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [String(parsed)];
    } catch (error) {
      return [raw];
    }
  }

  prepareStructure() {
    const span = document.createElement('span');
    span.className = 'text-type__content';
    span.setAttribute('aria-live', 'polite');
    span.setAttribute('aria-label', this.sentences.join(' '));
    this.el.textContent = '';
    this.el.appendChild(span);

    if (this.showCursor) {
      const cursor = document.createElement('span');
      cursor.className = 'text-type__cursor';
      cursor.textContent = this.cursorChar;
      this.el.appendChild(cursor);
      this.cursorEl = cursor;
      this.startCursorBlink();
    }

    return span;
  }

  startCursorBlink() {
    if (!this.cursorEl) return;
    this.cursorBlink = window.setInterval(() => {
      this.cursorEl.classList.toggle('text-type__cursor--hidden');
    }, 500);
  }

  observeVisibility() {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && !this.isVisible) {
          this.isVisible = true;
          this.start();
          observer.disconnect();
        }
      });
    }, { threshold: 0.2 });
    observer.observe(this.el);
  }

  start() {
    if (!this.sentences.length) return;
    this.tick();
  }

  tick() {
    const current = this.sentences[this.currentSentence] || '';
    const fullText = current.split('');

    if (this.isDeleting) {
      this.currentChar = Math.max(0, this.currentChar - 1);
    } else {
      this.currentChar = Math.min(fullText.length, this.currentChar + 1);
    }

    const nextText = fullText.slice(0, this.currentChar).join('');
    this.container.textContent = nextText;

    if (this.colors.length) {
      const color = this.colors[this.currentSentence % this.colors.length];
      if (color) {
        this.container.style.color = color;
      }
    }

    let nextDelay = this.speed;

    if (!this.isDeleting && nextText === current) {
      if (!this.loop && this.currentSentence === this.sentences.length - 1) {
        return;
      }
      this.isDeleting = true;
      nextDelay = this.pause;
    } else if (this.isDeleting && nextText === '') {
      this.isDeleting = false;
      this.currentSentence = (this.currentSentence + 1) % this.sentences.length;
      nextDelay = 400;
    } else if (this.isDeleting) {
      nextDelay = this.deletingSpeed;
    }

    this.timeout = window.setTimeout(() => this.tick(), nextDelay);
  }

  destroy() {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }
    if (this.cursorBlink) {
      clearInterval(this.cursorBlink);
      this.cursorBlink = null;
    }
    this.el.innerHTML = this.sentences[0] || '';
  }
}

export function initTextType({ restart = false } = {}) {
  const elements = document.querySelectorAll('[data-type-text]');
  elements.forEach((el) => {
    if (restart && el.__textTypeInstance) {
      el.__textTypeInstance.destroy();
      el.__textTypeInitialized = false;
      el.__textTypeInstance = null;
    }
    if (el.__textTypeInitialized) return;
    el.__textTypeInitialized = true;
    el.__textTypeInstance = new Typewriter(el);
  });
}