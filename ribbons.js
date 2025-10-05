const DEFAULT_OPTIONS = {
  colors: ['#ffffff'],
  baseSpring: 0.03,
  baseFriction: 0.9,
  baseThickness: 30,
  offsetFactor: 0.05,
  maxAge: 500,
  pointCount: 50,
  speedMultiplier: 0.6,
  enableFade: false,
  enableShaderEffect: true,
  effectAmplitude: 2,
  backgroundColor: [0, 0, 0, 0]
};

let initialized = false;
let cleanup = null;

function getDimensions(container) {
  if (!container) {
    return { width: window.innerWidth, height: window.innerHeight };
  }
  const rect = container.getBoundingClientRect();
  return {
    width: rect.width || window.innerWidth,
    height: rect.height || window.innerHeight
  };
}

export async function initRibbons(options = {}) {
  if (initialized) return;
  const container = document.querySelector('.ribbons-layer');
  if (!container) return;

  const config = { ...DEFAULT_OPTIONS, ...options };

  let oglModule;
  try {
    oglModule = await import('https://cdn.jsdelivr.net/npm/ogl@0.1.7/dist/ogl.mjs');
  } catch (error) {
    console.warn('Ribbons effect failed to load OGL module.', error);
    return;
  }
  const { Renderer, Transform, Vec3, Color, Polyline } = oglModule;

  const renderer = new Renderer({ dpr: window.devicePixelRatio || 2, alpha: true });
  const { gl } = renderer;

  if (Array.isArray(config.backgroundColor) && config.backgroundColor.length === 4) {
    gl.clearColor(
      config.backgroundColor[0],
      config.backgroundColor[1],
      config.backgroundColor[2],
      config.backgroundColor[3]
    );
  } else {
    gl.clearColor(0, 0, 0, 0);
  }

  gl.canvas.style.position = 'absolute';
  gl.canvas.style.inset = '0';
  gl.canvas.style.width = '100%';
  gl.canvas.style.height = '100%';
  gl.canvas.style.pointerEvents = 'none';
  container.appendChild(gl.canvas);

  const scene = new Transform();
  const lines = [];

  const vertex = `
    precision highp float;
    attribute vec3 position;
    attribute vec3 next;
    attribute vec3 prev;
    attribute vec2 uv;
    attribute float side;

    uniform vec2 uResolution;
    uniform float uDPR;
    uniform float uThickness;
    uniform float uTime;
    uniform float uEnableShaderEffect;
    uniform float uEffectAmplitude;

    varying vec2 vUV;

    vec4 getPosition() {
        vec4 current = vec4(position, 1.0);
        vec2 aspect = vec2(uResolution.x / uResolution.y, 1.0);
        vec2 nextScreen = next.xy * aspect;
        vec2 prevScreen = prev.xy * aspect;
        vec2 tangent = normalize(nextScreen - prevScreen);
        vec2 normal = vec2(-tangent.y, tangent.x);
        normal /= aspect;
        normal *= mix(1.0, 0.1, pow(abs(uv.y - 0.5) * 2.0, 2.0));
        float dist = length(nextScreen - prevScreen);
        normal *= smoothstep(0.0, 0.02, dist);
        float pixelWidthRatio = 1.0 / (uResolution.y / uDPR);
        float pixelWidth = current.w * pixelWidthRatio;
        normal *= pixelWidth * uThickness;
        current.xy -= normal * side;
        if(uEnableShaderEffect > 0.5) {
          current.xy += normal * sin(uTime + current.x * 10.0) * uEffectAmplitude;
        }
        return current;
    }

    void main() {
        vUV = uv;
        gl_Position = getPosition();
    }
  `;

  const fragment = `
    precision highp float;
    uniform vec3 uColor;
    uniform float uOpacity;
    uniform float uEnableFade;
    varying vec2 vUV;
    void main() {
        float fadeFactor = 1.0;
        if(uEnableFade > 0.5) {
            fadeFactor = 1.0 - smoothstep(0.0, 1.0, vUV.y);
        }
        gl_FragColor = vec4(uColor, uOpacity * fadeFactor);
    }
  `;

  function resize() {
    const { width, height } = getDimensions(container);
    renderer.setSize(width, height);
    lines.forEach((line) => line.polyline.resize());
  }

  window.addEventListener('resize', resize);

  const center = (config.colors.length - 1) / 2;

  config.colors.forEach((color, index) => {
    const spring = config.baseSpring + (Math.random() - 0.5) * 0.05;
    const friction = config.baseFriction + (Math.random() - 0.5) * 0.05;
    const thickness = config.baseThickness + (Math.random() - 0.5) * 3;
    const mouseOffset = new Vec3(
      (index - center) * config.offsetFactor + (Math.random() - 0.5) * 0.01,
      (Math.random() - 0.5) * 0.1,
      0
    );

    const line = {
      spring,
      friction,
      mouseVelocity: new Vec3(),
      mouseOffset
    };

    const points = [];
    for (let i = 0; i < config.pointCount; i += 1) {
      points.push(new Vec3());
    }
    line.points = points;

    line.polyline = new Polyline(gl, {
      points,
      vertex,
      fragment,
      uniforms: {
        uColor: { value: new Color(color) },
        uThickness: { value: thickness },
        uOpacity: { value: 1.0 },
        uTime: { value: 0.0 },
        uEnableShaderEffect: { value: config.enableShaderEffect ? 1.0 : 0.0 },
        uEffectAmplitude: { value: config.effectAmplitude },
        uEnableFade: { value: config.enableFade ? 1.0 : 0.0 }
      }
    });

    line.polyline.mesh.setParent(scene);
    lines.push(line);
  });

  resize();
  updateMousePosition(window.innerWidth / 2, window.innerHeight / 2);

  const mouse = new Vec3();
  const tmp = new Vec3();
  let frameId;
  let lastTime = performance.now();

  function updateMousePosition(clientX, clientY) {
    const { width, height } = getDimensions(container);
    mouse.set((clientX / width) * 2 - 1, (clientY / height) * -2 + 1, 0);
  }

  function handlePointerMove(event) {
    updateMousePosition(event.clientX, event.clientY);
  }

  function handleTouchMove(event) {
    if (!event.changedTouches || !event.changedTouches.length) return;
    const touch = event.changedTouches[0];
    updateMousePosition(touch.clientX, touch.clientY);
  }

  window.addEventListener('pointermove', handlePointerMove);
  window.addEventListener('touchmove', handleTouchMove, { passive: true });

  function update() {
    frameId = requestAnimationFrame(update);
    const currentTime = performance.now();
    const dt = currentTime - lastTime;
    lastTime = currentTime;

    lines.forEach((line) => {
      tmp.copy(mouse).add(line.mouseOffset).sub(line.points[0]).multiply(line.spring);
      line.mouseVelocity.add(tmp).multiply(line.friction);
      line.points[0].add(line.mouseVelocity);

      for (let i = 1; i < line.points.length; i += 1) {
        if (Number.isFinite(config.maxAge) && config.maxAge > 0) {
          const segmentDelay = config.maxAge / (line.points.length - 1);
          const alpha = Math.min(1, (dt * config.speedMultiplier) / segmentDelay);
          line.points[i].lerp(line.points[i - 1], alpha);
        } else {
          line.points[i].lerp(line.points[i - 1], 0.9);
        }
      }

      if (line.polyline.mesh.program.uniforms.uTime) {
        line.polyline.mesh.program.uniforms.uTime.value = currentTime * 0.001;
      }

      line.polyline.updateGeometry();
    });

    renderer.render({ scene });
  }

  update();

  cleanup = () => {
    cancelAnimationFrame(frameId);
    window.removeEventListener('resize', resize);
    window.removeEventListener('pointermove', handlePointerMove);
    window.removeEventListener('touchmove', handleTouchMove);
    if (gl.canvas && gl.canvas.parentNode === container) {
      container.removeChild(gl.canvas);
    }
  };

  initialized = true;
}

export function destroyRibbons() {
  if (cleanup) {
    cleanup();
  }
  cleanup = null;
  initialized = false;
}
