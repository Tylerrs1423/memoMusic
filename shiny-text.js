const DEFAULT_SPEED = 5;

class ShinyTextEffect {
  constructor(element) {
    this.el = element;
    this.speed = parseFloat(element.dataset.shinySpeed || DEFAULT_SPEED);
    this.disabled = element.dataset.shinyDisabled === 'true';
    this.init();
  }

  init() {
    if (this.disabled) {
      this.el.classList.add('shiny-text-disabled');
      return;
    }
    this.el.classList.add('shiny-text-active');
    this.el.style.setProperty('--shiny-duration', `${this.speed}s`);
  }
}

export function initShinyText() {
  document.querySelectorAll('[data-shiny]').forEach((el) => {
    if (el.__shinyInitialized) return;
    el.__shinyInitialized = true;
    new ShinyTextEffect(el);
  });
}
