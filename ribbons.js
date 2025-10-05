// Simple CSS-based ribbons effect (no external dependencies)
let initialized = false;

const DEFAULT_OPTIONS = {
  colors: ['#ffffff'],
  baseThickness: 30,
  speedMultiplier: 0.5,
  maxAge: 500,
  enableFade: false,
  enableShaderEffect: true
};

export async function initRibbons(options = {}) {
  if (initialized) return;
  
  const container = document.querySelector('.ribbons-layer');
  if (!container) {
    console.warn('Ribbons container not found');
    return;
  }

  const config = { ...DEFAULT_OPTIONS, ...options };
  
  // Create simple CSS-based ribbons
  const ribbonCount = Math.min(config.colors.length, 3); // Limit to 3 ribbons
  
  for (let i = 0; i < ribbonCount; i++) {
    const ribbon = document.createElement('div');
    ribbon.className = 'simple-ribbon';
    ribbon.style.cssText = `
      position: absolute;
      width: 100%;
      height: 2px;
      background: linear-gradient(90deg, transparent, ${config.colors[i] || '#ffffff'}, transparent);
      opacity: 0.6;
      animation: ribbonMove ${2 + i}s linear infinite;
      animation-delay: ${i * 0.5}s;
      top: ${20 + i * 15}%;
      left: 0;
    `;
    container.appendChild(ribbon);
  }

  // Add CSS animation if not already added
  if (!document.getElementById('ribbons-styles')) {
    const style = document.createElement('style');
    style.id = 'ribbons-styles';
    style.textContent = `
      @keyframes ribbonMove {
        0% { transform: translateX(-100%) rotate(0deg); }
        50% { transform: translateX(50vw) rotate(180deg); }
        100% { transform: translateX(100vw) rotate(360deg); }
      }
      
      .simple-ribbon {
        pointer-events: none;
      }
    `;
    document.head.appendChild(style);
  }

  initialized = true;
  console.log('Simple ribbons effect initialized');
}

export function destroyRibbons() {
  const container = document.querySelector('.ribbons-layer');
  if (container) {
    container.innerHTML = '';
  }
  
  const style = document.getElementById('ribbons-styles');
  if (style) {
    style.remove();
  }
  
  initialized = false;
}