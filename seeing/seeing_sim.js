let seeingTargets;

function applySeeingOption({ target, value }) {
  console.log("Applying Seeing Option:", target, value);
  const option = seeingTargets[target];
  if (option) {
    option.value = value;
    option.dispatchEvent(new Event("input"));
  }
}

function initializeSeeingOverlay() {
  const styleElement = document.createElement("style");
  styleElement.id = "seeing-effect-styles";
  styleElement.innerHTML = `
        #effect-canvas {
            position: fixed; 
            top: 0; left: 0;
            z-index: 1;
            pointer-events: none;
            background: transparent;
            visibility: hidden;
        }
        #controls-panel {
            position: fixed;
            bottom: 20px; left: 20px;
            z-index: 5;
            background-color: rgba(17, 24, 39, 0.8);
            backdrop-filter: blur(5px);
            padding: 1rem;
            border-radius: 0.75rem;
            border: 1px solid rgb(55 65 81);
            font-family: 'Inter', sans-serif;
            color: #d1d5db;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
            opacity: 0; /* Oculto, pero funcional para control externo */
            pointer-events: none;
        }
    `;
  document.head.appendChild(styleElement);

  const stelCanvas = document.getElementById("stel-canvas");
  if (!stelCanvas) {
    console.error(
      "Error: El canvas de Stellarium ('stel-canvas') no fue encontrado."
    );
    return;
  }

  // --- Panel de Controles simplificado con un único slider ---
  const controlsPanel = document.createElement("div");
  controlsPanel.id = "controls-panel";
    controlsPanel.innerHTML = `
        <h3 class="text-lg font-bold text-white mb-3">Simulador de Seeing</h3>
        <div>
          <label for="turbulence" class="text-sm font-medium">Intensidad de Turbulencia: <span id="turbulenceValue">5.0</span></label>
          <input id="turbulence" type="range" min="0" max="10" step="0.1" value="5" class="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer">
          <label for="turbulenceMax" class="text-sm font-medium"">Máximo de Turbulencia: <span id="turbulenceMaxValue">10</span></label>
          <input id="turbulenceMax" type="range" min="1" max="10" step="0.5" value="10" class="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer">
          <label for="speed" class="text-sm font-medium">Velocidad de Turbulencia: <span id="speedValue">5</span></label>
          <input id="speed" type="range" min="1" max="5" step="0.1" value="5" class="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer">
            <label for="focus" class="text-sm font-medium">Enfoque: <span id="focusValue">10</span>%</label>
            <input id="focus" type="range" min="0" max="10" value="5" class="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer">
        <label for="saturation" class="text-sm font-medium">Saturación: <span id="saturationValue">50</span>%</label>
        <input id="saturation" type="range" min="50" max="150" value="50" class="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer">
        </div>
    `;
  document.body.appendChild(controlsPanel);

  const effectCanvas = document.createElement("canvas");
  effectCanvas.id = "effect-canvas";
  effectCanvas.style.opacity = "0";
  document.body.appendChild(effectCanvas);

  const gl = effectCanvas.getContext("webgl", { preserveDrawingBuffer: false });
  if (!gl) {
    console.error("WebGL no es soportado por este navegador.");
    return;
  }

  const copyCanvas = document.createElement("canvas");
  const copyCtx = copyCanvas.getContext("2d", { willReadFrequently: true });

  // const disturbanceSlider = document.getElementById("disturbance");
  // const disturbanceValueSpan = document.getElementById("disturbanceValue");
  const turbulenceSlider = document.getElementById("turbulence");
  const turbulenceMaxSlider = document.getElementById("turbulenceMax");
  const turbulenceMaxValueSpan = document.getElementById("turbulenceMaxValue");
  const turbulenceValueSpan = document.getElementById("turbulenceValue");
  const speedSlider = document.getElementById("speed");
  const speedValueSpan = document.getElementById("speedValue");
  const focusSlider = document.getElementById("focus");
  const focusValueSpan = document.getElementById("focusValue");
  const saturationSlider = document.getElementById("saturation");
  const saturationValueSpan = document.getElementById("saturationValue");

  const vertexShaderSource = `
        attribute vec2 a_position; attribute vec2 a_texCoord;
        varying vec2 v_texCoord;
        void main() { gl_Position = vec4(a_position, 0.0, 1.0); v_texCoord = a_texCoord; }
    `;
  const fragmentShaderSource = `
        precision mediump float;
        uniform sampler2D u_image;
        uniform float u_time;
        uniform float u_amount; // Controla la intensidad de la turbulencia
        uniform float u_noise;  // Controla la intensidad del ruido
        uniform float u_noise_offset; 
        varying vec2 v_texCoord;

        float random(vec2 st) {
            return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
        }

        void main() {
            float strength = u_amount * 0.0001;
            float time = u_time * 0.5;
            
            float offsetX1 = sin(v_texCoord.y * 42.1 + time * 1.1) * strength * 0.7;
            float offsetY1 = cos(v_texCoord.x * 35.7 + time * 0.9) * strength * 0.7;
            float offsetX2 = sin(v_texCoord.y * 15.3 - time * 1.6) * strength * 0.6;
            float offsetY2 = cos(v_texCoord.x * 21.9 + time * 1.3) * strength * 0.4;
            
            vec2 displacement = vec2(offsetX1 + offsetX2, offsetY1 + offsetY2);
            vec2 distortedTexCoord = v_texCoord + displacement;
            
            vec4 originalColor = texture2D(u_image, distortedTexCoord);
            
            float noiseTime = u_time + u_noise_offset;
            float noiseVal = (random(v_texCoord + noiseTime * 0.01) - 0.5) * u_noise;
            
            gl_FragColor = vec4(originalColor.rgb + noiseVal, originalColor.a);
        }
    `;

  function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error(
        "Error de compilación del shader:",
        gl.getShaderInfoLog(shader)
      );
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }
  function createProgram(gl, vs, fs) {
    const p = gl.createProgram();
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      console.error("Error de enlazado del programa:", gl.getProgramInfoLog(p));
      gl.deleteProgram(p);
      return null;
    }
    return p;
  }

  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
  const fragmentShader = createShader(
    gl,
    gl.FRAGMENT_SHADER,
    fragmentShaderSource
  );
  const program = createProgram(gl, vertexShader, fragmentShader);

  const positionLocation = gl.getAttribLocation(program, "a_position");
  const texCoordLocation = gl.getAttribLocation(program, "a_texCoord");
  const imageLocation = gl.getUniformLocation(program, "u_image");
  const timeLocation = gl.getUniformLocation(program, "u_time");
  const amountLocation = gl.getUniformLocation(program, "u_amount");
  const noiseLocation = gl.getUniformLocation(program, "u_noise");
  const noiseOffsetLocation = gl.getUniformLocation(program, "u_noise_offset");

  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    gl.STATIC_DRAW
  );
  const texCoordBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]),
    gl.STATIC_DRAW
  );

  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

  function syncCanvasSize() {
    const w = stelCanvas.clientWidth;
    const h = stelCanvas.clientHeight;
    if (effectCanvas.width !== w || effectCanvas.height !== h) {
      effectCanvas.width = w;
      effectCanvas.height = h;
      copyCanvas.width = w;
      copyCanvas.height = h;
      gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    }
  }
  syncCanvasSize();
  const resizeObserver = new ResizeObserver(syncCanvasSize);
  resizeObserver.observe(stelCanvas);

  // const MIN_TURBULENCE_SPEED = 1;
  // const MAX_TURBULENCE_SPEED = 5;
  const DEFAULT_TURBULENCE_MAX = 10;

  let time = 0;

  function animate(now) {
    // --- LÓGICA CENTRAL UNIFICADA (Determinista) ---
    // El slider "disturbance" solo controla la velocidad de la turbulencia.
    // const disturbanceFactor = parseFloat(disturbanceSlider.value) / 100;
    time += parseFloat(speedSlider.value) * 0.05;

    copyCtx.drawImage(stelCanvas, 0, 0, copyCanvas.width, copyCanvas.height);

    gl.useProgram(program);
    gl.enableVertexAttribArray(positionLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(texCoordLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      copyCanvas
    );
    gl.uniform1i(imageLocation, 0);

    // 4. Pasar valores deterministas a los shaders
    gl.uniform1f(timeLocation, time);
    gl.uniform1f(amountLocation, parseFloat(turbulenceSlider.value));
    gl.uniform1f(noiseLocation, 0.0);
    gl.uniform1f(noiseOffsetLocation, 0.0);

    gl.drawArrays(gl.TRIANGLES, 0, 6);

    if (effectCanvas.style.opacity === "0") {
      effectCanvas.style.opacity = "1";
    }

    requestAnimationFrame(animate);
  }

  function setTurbulenceMax(rawValue) {
    const parsedMax = parseFloat(rawValue);
    const normalizedMax = Number.isFinite(parsedMax)
      ? Math.max(parsedMax, parseFloat(turbulenceSlider.min))
      : DEFAULT_TURBULENCE_MAX;

    turbulenceMaxSlider.value = normalizedMax;
    turbulenceSlider.max = normalizedMax;

    const currentValue = parseFloat(turbulenceSlider.value);
    if (currentValue > normalizedMax) {
      turbulenceSlider.value = normalizedMax.toFixed(1);
      turbulenceValueSpan.textContent = turbulenceSlider.value;
      turbulenceSlider.dispatchEvent(new Event("input"));
    }
  }

  function updateCssFilters() {
    const blur = parseFloat(focusSlider.value).toFixed(1);
    const saturation = parseFloat(saturationSlider.value) / 100;

    effectCanvas.style.filter = `blur(${blur}px) saturate(${saturation.toFixed(2)})`;
    focusValueSpan.textContent = blur;
    saturationValueSpan.textContent = Math.round(saturation * 100);
  }

  // disturbanceSlider.addEventListener("input", (e) => {
  //   const value = e.target.value;
  //   disturbanceValueSpan.textContent = value;
// 
  //   const factor = parseFloat(value) / 100;
  //   const mappedTurbulence = (factor * 10).toFixed(1);
  //   turbulenceSlider.value = mappedTurbulence;
  //   turbulenceValueSpan.textContent = mappedTurbulence;
// 
  //   const mappedSpeed = (
  //     MIN_TURBULENCE_SPEED +
  //     (MAX_TURBULENCE_SPEED - MIN_TURBULENCE_SPEED) * factor
  //   ).toFixed(1);
  //   speedSlider.value = mappedSpeed;
  //   speedValueSpan.textContent = mappedSpeed;
  // });
  turbulenceSlider.addEventListener("input", (e) => {
    turbulenceValueSpan.textContent = e.target.value;
  });
  turbulenceMaxSlider.addEventListener("input", (e) => {
    setTurbulenceMax(e.target.value);
    turbulenceMaxValueSpan.textContent = e.target.value;
  });
  speedSlider.addEventListener("input", (e) => {
    speedValueSpan.textContent = parseFloat(e.target.value).toFixed(1);
  });
  focusSlider.addEventListener("input", updateCssFilters);
  saturationSlider.addEventListener("input", updateCssFilters);

  // --- Mapeo de controles simplificado ---
  seeingTargets = {
    // disturbance: disturbanceSlider,
    turbulence: turbulenceSlider,
    turbulenceMax: turbulenceMaxSlider,
    speed: speedSlider,
    focus: focusSlider,
    saturation: saturationSlider,
  };

  // disturbanceSlider.dispatchEvent(new Event("input"));
  setTurbulenceMax(turbulenceMaxSlider.value || DEFAULT_TURBULENCE_MAX);
  updateCssFilters();
  animate(0);
  console.log("Overlay WebGL con efecto de 'Perturbación' unificado activado.");
}
