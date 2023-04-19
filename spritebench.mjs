"strict";

const loaded = new Promise(function (resolve) {
    if (document.readyState === "loading")  addEventListener("load", function(ev) { resolve() });
    else                                    resolve();
});
await loaded;

const id = new ImageData(16, 16);
for (let y=0; y<id.height; ++y) {
    for (let x=0; x<id.width; ++x) {
        const o = 4 * (x + id.width * y);
        id.data[o+0] = Math.round(0xFF * x / id.width);
        id.data[o+1] = Math.round(0xFF * y / id.height);
        id.data[o+2] = 0x80;
        id.data[o+3] = 0xFF;
    }
}
const image     = await createImageBitmap(id);
const canvas0   = document.getElementsByTagName("canvas")[0];
const canvas1   = document.getElementsByTagName("canvas")[1];
const times_2d  = document.getElementById("times-2d");
const times_gl  = document.getElementById("times-gl");

function run_benchmark_2d() {
    const start = performance.now();
    const ctx = canvas0.getContext("2d");
    ctx.imageSmoothingQuality = "low";
    for (let y=0; y<64; ++y) {
        for (let x=0; x<64; ++x) {
            ctx.drawImage(image, 0, 0, 16, 16, x<<4, y<<4, 16, 16);
        }
    }
    const stop = performance.now();
    const t = (1000 * (stop-start)).toLocaleString();
    times_2d.textContent = `${t} us`;
}

const vsText = await (await fetch("shader.vs.glsl.txt", {})).text();
const fsText = await (await fetch("shader.fs.glsl.txt", {})).text();
let texture;
let ib, vb;
let vs, fs, program;
function run_benchmark_gl() {
    const start = performance.now();
    const gl = canvas1.getContext("webgl");

    gl.clearColor(0.1, 0.2, 0.3, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    if (program === undefined) {
        vs = gl.createShader(gl.VERTEX_SHADER);
        fs = gl.createShader(gl.FRAGMENT_SHADER);
        gl.shaderSource(vs, vsText);
        gl.shaderSource(fs, fsText);
        gl.compileShader(vs);
        gl.compileShader(fs);
        console.log("vs:", gl.getShaderInfoLog(vs));
        console.log("fs:", gl.getShaderInfoLog(fs));
        program = gl.createProgram();
        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        gl.bindAttribLocation(program, 0, "a_position");
        gl.bindAttribLocation(program, 1, "a_texcoord");
        gl.linkProgram(program);
        console.log("program:", gl.getProgramInfoLog(program));
    }
    gl.useProgram(program);

    if (texture === undefined) {
        texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 16, 16, 0, gl.RGBA, gl.UNSIGNED_BYTE, id.data);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    }
    const textureSlot = 0;
    const uniform = gl.getUniformLocation(program, "s");
    gl.activeTexture(gl.TEXTURE0 + textureSlot);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(uniform, textureSlot);

    if (ib === undefined) {
        ib = gl.createBuffer();
        let data = new Uint16Array(6 * 64*64);
        for (let y=0; y<64; ++y) {
            for (let x=0; x<64; ++x) {
                let o = 6 * (x + 64*y);
                let v = 4 * (x + 64*y);
                data[o+0] = v + 0;
                data[o+1] = v + 1;
                data[o+2] = v + 3;
                data[o+3] = v + 0;
                data[o+4] = v + 3;
                data[o+5] = v + 2;
            }
        }
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data, gl.STATIC_DRAW);
    } else {
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
    }

    if (vb === undefined) vb = gl.createBuffer();
    let data = new Float32Array(5*4 * 64*64);
    for (let y=0; y<64; ++y) {
        for (let x=0; x<64; ++x) {
            for (let u=0; u<=1; ++u) {
                for (let v=0; v<=1; ++v) {
                    const o = 5 * (4 * (x + 64*y) + u + 2*v);
                    data[o+0] = (x + u) * 16;
                    data[o+1] = (y + v) * 16;
                    data[o+2] = 0.0; // z
                    data[o+3] = u;
                    data[o+4] = v;
                }
            }
        }
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, vb);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);

    const vertexSize = 5*4;
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, vertexSize, 0*4);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, vertexSize, 3*4);

    gl.drawElements(gl.TRIANGLES, 6 * 64*64, gl.UNSIGNED_SHORT, 0);

    const stop = performance.now();
    const t = (1000 * (stop-start)).toLocaleString();
    times_gl.textContent = `${t} us`;
}

let flip = false;
function run_benchmark() {
    (flip ? run_benchmark_2d : run_benchmark_gl)();
    flip ^= true;
}

setInterval(run_benchmark, 100);
run_benchmark();
