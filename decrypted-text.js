const DEFAULT_CHAR_POOL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+{}[]<>?/';

class DecryptedTextEffect {
  constructor(element) {
    this.el = element;
    this.originalText = element.dataset.decryptText || element.textContent || '';
    this.textLength = this.originalText.length;
    this.speed = parseInt(element.dataset.decryptSpeed || '50', 10);
    this.maxIterations = parseInt(element.dataset.decryptMax || '12', 10);
    this.characters = element.dataset.decryptCharacters || DEFAULT_CHAR_POOL;
    this.animateOn = (element.dataset.decryptAnimate || 'hover').toLowerCase();
    this.revealDirection = (element.dataset.decryptDirection || 'start').toLowerCase();
    this.sequential = element.dataset.decryptSequential === 'true';

    this.animationId = null;
    this.intervalId = null;
    this.iteration = 0;
    this.isScrambling = false;
    this.hasAnimated = false;
    this.revealed = new Set();

    this.el.setAttribute('aria-hidden', 'true');
    this.el.textContent = this.originalText;

    this.setupInteractions();
  }

  setupInteractions() {
    if (this.animateOn === 'hover' || this.animateOn === 'both') {
      this.el.addEventListener('pointerenter', () => this.startScramble());
      this.el.addEventListener('pointerleave', () => this.stopScramble());
      this.el.addEventListener('focus', () => this.startScramble());
      this.el.addEventListener('blur', () => this.stopScramble());
    }

    if (this.animateOn === 'view' || this.animateOn === 'both') {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !this.hasAnimated) {
            this.startScramble(true);
            this.hasAnimated = true;
          }
        });
      }, {
        threshold: 0.2
      });
      observer.observe(this.el);
    }
  }

  startScramble(runOnce = false) {
    if (this.isScrambling) return;
    this.stopScramble(true);
    this.isScrambling = true;
    this.iteration = 0;
    this.revealed.clear();
    this.intervalId = window.setInterval(() => {
      this.iteration++;
      if (this.sequential) {
        this.revealNextSequential();
      }
      this.updateText();
      if (this.iteration >= this.maxIterations || this.revealed.size >= this.textLength) {
        this.finish();
        if (!runOnce && (this.animateOn === 'hover' || this.animateOn === 'both')) {
          // Keep original text for hover but allow re-trigger
          this.isScrambling = false;
        }
      }
    }, Math.max(16, this.speed));
  }

  stopScramble(skipReset = false) {
    if (this.intervalId) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (!skipReset) {
      this.isScrambling = false;
      this.revealed.clear();
      this.el.textContent = this.originalText;
    }
  }

  finish() {
    this.stopScramble(true);
    this.el.textContent = this.originalText;
    this.isScrambling = false;
  }

  revealNextSequential() {
    const idx = this.getNextIndex();
    if (idx != null) {
      this.revealed.add(idx);
    }
  }

  getNextIndex() {
    const len = this.textLength;
    if (this.revealDirection === 'end') {
      return len - 1 - this.revealed.size;
    }
    if (this.revealDirection === 'center') {
      const middle = Math.floor(len / 2);
      const offset = Math.floor(this.revealed.size / 2);
      const candidate = this.revealed.size % 2 === 0 ? middle + offset : middle - offset - 1;
      if (!this.revealed.has(candidate) && candidate >= 0 && candidate < len) {
        return candidate;
      }
      for (let i = 0; i < len; i++) {
        if (!this.revealed.has(i)) return i;
      }
      return null;
    }
    // default start
    return this.revealed.size;
  }

  updateText() {
    let output = '';
    const characters = this.characters;
    const revealCount = this.sequential
      ? this.revealed.size
      : Math.min(this.textLength, Math.floor((this.iteration / this.maxIterations) * this.textLength));

    for (let i = 0; i < this.textLength; i++) {
      const char = this.originalText[i];
      if (char === ' ') {
        output += ' ';
        continue;
      }

      const isRevealed = this.sequential ? this.revealed.has(i) : i < revealCount;
      if (isRevealed) {
        output += char;
      } else {
        output += characters.charAt(Math.floor(Math.random() * characters.length)) || char;
      }
    }

    this.el.textContent = output;
  }
}

export function initDecryptedText() {
  const elements = document.querySelectorAll('[data-decrypted-text]');
  elements.forEach((el) => {
    if (el.__decryptedTextInitialized) return;
    el.__decryptedTextInitialized = true;
    new DecryptedTextEffect(el);
  });
}
