/**
 * WebGL atmospheric seeing simulation overlay.
 * Replaces: seeing/seeing_sim.js
 *
 * Call initializeSeeingOverlay() from the viewer after the stel-canvas exists.
 * Returns a map of control targets for external manipulation via protobject.
 */

export function initializeSeeingOverlay() {
  const stelCanvas = document.getElementById('stel-canvas');
  if (!stelCanvas) {
    console.error('stel-canvas not found');
    return null;
  }

  // Inject styles
  const style = document.createElement('style');
  style.innerHTML = `
    #effect-canvas {
      position: fixed; top: 0; left: 0; z-index: 1;
      pointer-events: none; background: transparent; visibility: hidden;
    }
    #controls-panel {
      position: fixed; bottom: 20px; left: 20px; z-index: 5;
      opacity: 0; pointer-events: none;
    }
  `;
  document.head.appendChild(style);

  // Hidden controls panel (driven externally via protobject)
  const controlsPanel = document.createElement('div');
  controlsPanel.id = 'controls-panel';
  controlsPanel.innerHTML = `
    <input id="turbulence" type="range" min="0" max="10" step="0.1" value="5">
    <input id="turbulenceMax" type="range" min="1" max="10" step="0.5" value="10">
    <input id="speed" type="range" min="1" max="5" step="0.1" value="5">
    <input id="focus" type="range" min="0" max="10" value="5">
    <input id="saturation" type="range" min="50" max="150" value="50">
  `;
  document.body.appendChild(controlsPanel);

  const effectCanvas = document.createElement('canvas');
  effectCanvas.id = 'effect-canvas';
  effectCanvas.style.opacity = '0';
  document.body.appendChild(effectCanvas);

  const gl = effectCanvas.getContext('webgl', { preserveDrawingBuffer: false });
  if (!gl) { console.error('WebGL not supported'); return null; }

  const copyCanvas = document.createElement('canvas');
  const copyCtx = copyCanvas.getContext('2d', { willReadFrequently: true });

  const turbulenceSlider = document.getElementById('turbulence');
  const turbulenceMaxSlider = document.getElementById('turbulenceMax');
  const speedSlider = document.getElementById('speed');
  const focusSlider = document.getElementById('focus');
  const saturationSlider = document.getElementById('saturation');

  // Shaders
  const vsSource = `
    attribute vec2 a_position; attribute vec2 a_texCoord;
    varying vec2 v_texCoord;
    void main() { gl_Position = vec4(a_position, 0.0, 1.0); v_texCoord = a_texCoord; }
  `;
  const fsSource = `
    precision mediump float;
    uniform sampler2D u_image;
    uniform float u_time, u_amount, u_noise, u_noise_offset;
    varying vec2 v_texCoord;
    float random(vec2 st) { return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123); }
    void main() {
      float strength = u_amount * 0.0001;
      float time = u_time * 0.5;
      float ox1 = sin(v_texCoord.y * 42.1 + time * 1.1) * strength * 0.7;
      float oy1 = cos(v_texCoord.x * 35.7 + time * 0.9) * strength * 0.7;
      float ox2 = sin(v_texCoord.y * 15.3 - time * 1.6) * strength * 0.6;
      float oy2 = cos(v_texCoord.x * 21.9 + time * 1.3) * strength * 0.4;
      vec2 d = v_texCoord + vec2(ox1 + ox2, oy1 + oy2);
      vec4 c = texture2D(u_image, d);
      float n = (random(v_texCoord + u_time * 0.01 + u_noise_offset) - 0.5) * u_noise;
      gl_FragColor = vec4(c.rgb + n, c.a);
    }
  `;

  function createShader(type, source) {
    const s = gl.createShader(type);
    gl.shaderSource(s, source);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error('Shader error:', gl.getShaderInfoLog(s));
      gl.deleteShader(s);
      return null;
    }
    return s;
  }

  const program = gl.createProgram();
  gl.attachShader(program, createShader(gl.VERTEX_SHADER, vsSource));
  gl.attachShader(program, createShader(gl.FRAGMENT_SHADER, fsSource));
  gl.linkProgram(program);

  const posLoc = gl.getAttribLocation(program, 'a_position');
  const texLoc = gl.getAttribLocation(program, 'a_texCoord');
  const timeLoc = gl.getUniformLocation(program, 'u_time');
  const amountLoc = gl.getUniformLocation(program, 'u_amount');
  const noiseLoc = gl.getUniformLocation(program, 'u_noise');
  const noiseOffLoc = gl.getUniformLocation(program, 'u_noise_offset');

  const posBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);

  const texBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, texBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0,0, 1,0, 0,1, 0,1, 1,0, 1,1]), gl.STATIC_DRAW);

  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

  function syncSize() {
    const w = stelCanvas.clientWidth, h = stelCanvas.clientHeight;
    if (effectCanvas.width !== w || effectCanvas.height !== h) {
      effectCanvas.width = w; effectCanvas.height = h;
      copyCanvas.width = w; copyCanvas.height = h;
      gl.viewport(0, 0, w, h);
    }
  }
  syncSize();
  new ResizeObserver(syncSize).observe(stelCanvas);

  function setTurbulenceMax(rawValue) {
    const max = Math.max(parseFloat(rawValue) || 10, parseFloat(turbulenceSlider.min));
    turbulenceMaxSlider.value = max;
    turbulenceSlider.max = max;
    if (parseFloat(turbulenceSlider.value) > max) {
      turbulenceSlider.value = max.toFixed(1);
      turbulenceSlider.dispatchEvent(new Event('input'));
    }
  }

  function updateCssFilters() {
    const blur = parseFloat(focusSlider.value).toFixed(1);
    const sat = (parseFloat(saturationSlider.value) / 100).toFixed(2);
    effectCanvas.style.filter = `blur(${blur}px) saturate(${sat})`;
  }

  focusSlider.addEventListener('input', updateCssFilters);
  saturationSlider.addEventListener('input', updateCssFilters);
  turbulenceMaxSlider.addEventListener('input', (e) => setTurbulenceMax(e.target.value));

  let time = 0;
  function animate() {
    time += parseFloat(speedSlider.value) * 0.05;
    copyCtx.drawImage(stelCanvas, 0, 0, copyCanvas.width, copyCanvas.height);

    gl.useProgram(program);
    gl.enableVertexAttribArray(posLoc);
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(texLoc);
    gl.bindBuffer(gl.ARRAY_BUFFER, texBuf);
    gl.vertexAttribPointer(texLoc, 2, gl.FLOAT, false, 0, 0);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, copyCanvas);

    gl.uniform1f(timeLoc, time);
    gl.uniform1f(amountLoc, parseFloat(turbulenceSlider.value));
    gl.uniform1f(noiseLoc, 0.0);
    gl.uniform1f(noiseOffLoc, 0.0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    if (effectCanvas.style.opacity === '0') effectCanvas.style.opacity = '1';
    requestAnimationFrame(animate);
  }

  setTurbulenceMax(turbulenceMaxSlider.value || 10);
  updateCssFilters();
  animate();

  // Return control targets for external manipulation
  const targets = {
    turbulence: turbulenceSlider,
    turbulenceMax: turbulenceMaxSlider,
    speed: speedSlider,
    focus: focusSlider,
    saturation: saturationSlider,
  };

  return targets;
}
