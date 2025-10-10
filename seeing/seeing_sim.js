let seeingTargets;

function applySeeingOption({ target, value }) {
  const option = seeingTargets[target];
  option.value = value;
  option.dispatchEvent(new Event("input"));
}

function initializeSeeingOverlay() {
  const stelCanvas = document.getElementById("stel-canvas");
  if (!stelCanvas) {
    alert("Error: Canvas de Stellarium ('stel-canvas') no encontrado.");
    return;
  }

  const effectCanvas = document.getElementById("effect-canvas");
  const gl = effectCanvas.getContext("webgl", { preserveDrawingBuffer: false });
  if (!gl) {
    alert("WebGL no soportado.");
    return;
  }

  const copyCanvas = document.createElement("canvas");
  const copyCtx = copyCanvas.getContext("2d", { willReadFrequently: true });

  const turbulenceSlider = document.getElementById("turbulenceAmount");
  const speedSlider = document.getElementById("turbulenceSpeed");
  const noiseSlider = document.getElementById("noise");
  const focusSlider = document.getElementById("focus");
  const saturationSlider = document.getElementById("saturation");
  const chaosSlider = document.getElementById("chaos");

  const focusValueSpan = document.getElementById("focusValue");
  const saturationValueSpan = document.getElementById("saturationValue");
  const turbulenceValueSpan = document.getElementById("turbulenceValue");
  const speedValueSpan = document.getElementById("speedValue");
  const noiseValueSpan = document.getElementById("noiseValue");
  const chaosValueSpan = document.getElementById("chaosValue");

  const vertexShaderSource = `
        attribute vec2 a_position; attribute vec2 a_texCoord;
        varying vec2 v_texCoord;
        void main() {
            gl_Position = vec4(a_position, 0.0, 1.0);
            v_texCoord = a_texCoord;
        }
    `;

  const fragmentShaderSource = `
        precision mediump float;
        uniform sampler2D u_image;
        uniform float u_time;
        uniform float u_amount;
        uniform float u_noise;
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
            float offsetX3 = sin(v_texCoord.y * 5.8 + time * 0.4) * strength * 1.5;
            float offsetY3 = cos(v_texCoord.x * 8.2 - time * 0.2) * strength * 1.2;

            vec2 displacement = vec2(offsetX1 + offsetX2 + offsetX3, offsetY1 + offsetY2 + offsetY3);
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
      console.error("Shader error:", gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  function createProgram(gl, vs, fs) {
    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error("Program link error:", gl.getProgramInfoLog(program));
      gl.deleteProgram(program);
      return null;
    }
    return program;
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
    effectCanvas.width = w;
    effectCanvas.height = h;
    copyCanvas.width = w;
    copyCanvas.height = h;
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
  }

  syncCanvasSize();
  new ResizeObserver(syncCanvasSize).observe(stelCanvas);

  let time = 0;

  function animate(now) {
    const noiseTimeOffset = Math.random() * 10000;

    const chaosFactor = parseFloat(chaosSlider.value) / 10.0;
    const chaosSpeedFluctuation =
      (Math.sin(now * 0.0003) + Math.cos(now * 0.0007)) * 0.5;
    const chaosAmountFluctuation =
      (Math.sin(now * 0.0005) + Math.cos(now * 0.0002)) * 0.5;

    const baseSpeed = parseFloat(speedSlider.value);
    const baseAmount = parseFloat(turbulenceSlider.value);

    const chaoticSpeed =
      baseSpeed + baseSpeed * chaosSpeedFluctuation * chaosFactor;
    const chaoticAmount =
      baseAmount + baseAmount * chaosAmountFluctuation * chaosFactor * 0.5;

    time += chaoticSpeed * 0.05;

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

    gl.uniform1f(timeLocation, time);
    gl.uniform1f(amountLocation, chaoticAmount);
    gl.uniform1f(noiseLocation, parseFloat(noiseSlider.value));
    gl.uniform1f(noiseOffsetLocation, noiseTimeOffset);

    gl.drawArrays(gl.TRIANGLES, 0, 6);

    requestAnimationFrame(animate);
  }

  function updateCssFilters() {
    const blur = parseFloat(focusSlider.value).toFixed(1);
    const saturation = parseFloat(saturationSlider.value).toFixed(2);
    effectCanvas.style.filter = `blur(${blur}px) saturate(${saturation})`;

    focusValueSpan.textContent = blur;
    saturationValueSpan.textContent = Math.round(saturation * 100);
  }

  // Listeners para actualizar valores visibles (solo lo necesario)
  turbulenceSlider.addEventListener(
    "input",
    (e) => (turbulenceValueSpan.textContent = e.target.value)
  );
  speedSlider.addEventListener(
    "input",
    (e) => (speedValueSpan.textContent = e.target.value)
  );
  noiseSlider.addEventListener(
    "input",
    (e) => (noiseValueSpan.textContent = parseFloat(e.target.value).toFixed(2))
  );
  focusSlider.addEventListener("input", updateCssFilters);
  saturationSlider.addEventListener("input", updateCssFilters);
  chaosSlider.addEventListener(
    "input",
    (e) => (chaosValueSpan.textContent = e.target.value)
  );

  // Vincular sliders con lógica externa
  seeingTargets = {
    turbulence: turbulenceSlider,
    speed: speedSlider,
    noise: noiseSlider,
    focus: focusSlider,
    saturation: saturationSlider,
    chaos: chaosSlider,
  };

  updateCssFilters();
  animate(0);
}
