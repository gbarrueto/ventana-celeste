function updateStellariumBlur({ blur }) {
  const canvas_blur = document.getElementById("stel-canvas");
  canvas_blur.style.filter = `blur(${blur}px)`;
}

const canvas = document.getElementById("stel-canvas");
const gl = canvas.getContext("webgl");

// Verifica que WebGL esté disponible
if (!gl) {
  alert("Tu navegador no soporta WebGL.");
  throw new Error("WebGL no soportado");
}

// Vertex Shader (pantalla completa)
const vertexShaderSource = `
attribute vec2 a_position;
varying vec2 v_uv;

void main() {
    v_uv = (a_position + 1.0) * 0.5;
    gl_Position = vec4(a_position, 0, 1);
}
`;

// Fragment Shader (efecto de contaminación lumínica)
const fragmentShaderSource = `
precision mediump float;
varying vec2 v_uv;

uniform float u_bortle;
uniform vec2 u_resolution;

void main() {
    vec2 uv = v_uv;

    float bortle = clamp(u_bortle, 1.0, 9.0);

    // Altura desde el horizonte (0 en fondo, 1 en parte superior)
    float height = uv.y;

    // Simula contaminación desde el horizonte (bottom)
    float intensity = pow(1.0 - height, 3.0) * (bortle / 9.0);

    // Color base del resplandor (cálido)
    vec3 color = mix(
        vec3(0.0, 0.0, 0.0),
        vec3(1.0, 0.5, 0.2),
        intensity
    );

    gl_FragColor = vec4(color, intensity);
}
`;

// Compila shaders
function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    throw new Error("Error compilando shader");
  }
  return shader;
}

const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
const fragmentShader = compileShader(
  gl,
  gl.FRAGMENT_SHADER,
  fragmentShaderSource
);

// Programa WebGL
const program = gl.createProgram();
gl.attachShader(program, vertexShader);
gl.attachShader(program, fragmentShader);
gl.linkProgram(program);
gl.useProgram(program);

// Cuadrado de pantalla completa
const positionBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
gl.bufferData(
  gl.ARRAY_BUFFER,
  new Float32Array([
    -1,
    -1, // bottom left
    1,
    -1, // bottom right
    -1,
    1, // top left
    -1,
    1, // top left
    1,
    -1, // bottom right
    1,
    1, // top right
  ]),
  gl.STATIC_DRAW
);

const aPosition = gl.getAttribLocation(program, "a_position");
gl.enableVertexAttribArray(aPosition);
gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);

// Uniforms
const u_bortle = gl.getUniformLocation(program, "u_bortle");
const u_resolution = gl.getUniformLocation(program, "u_resolution");

function render(bortle) {
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clear(gl.COLOR_BUFFER_BIT);

  gl.uniform1f(u_bortle, bortle);
  gl.uniform2f(u_resolution, canvas.width, canvas.height);

  gl.drawArrays(gl.TRIANGLES, 0, 6);
}

// function updatePollutionOverlay({ bortle }) {
// const pollutionOverlay = document.getElementById("pollution-overlay");
// if (!pollutionOverlay) return;
//
// pollutionOverlay.style.opacity = 0.1 * bortle;
//
//
// pollutionOverlay.style.background = `radial-gradient(ellipse 100% 50% at bottom,
//   rgba(255,200,100,${0.02 + 0.06 * (bortle - 1)}) 0%,
//   rgba(255,150,50,${0.015 + 0.045 * (bortle - 1)}) 20%,
//   rgba(200,100,50,${0.01 + 0.015 * (bortle - 1)}) 50%,
//   rgba(100,50,25,${0.0 + 0.0035 * (bortle - 1)}) 65%,
//   rgba(100,50,25,${0.0 + 0.001 * (bortle - 1)}) 80%,
//   rgba(0,0,0,0.0) 100%)`;
// }

function enableFinderOverlay() {
  const overlay = document.getElementById("finder-overlay");
  if (overlay) {
    overlay.style.opacity = 1;
  }
}

function disableFinderOverlay() {
  const overlay = document.getElementById("finder-overlay");
  if (overlay) {
    overlay.style.opacity = 0;
  }
}

function toggleEyepieceOverlay({ signal }) {
  signal ? disableFinderOverlay() : enableFinderOverlay();
}
