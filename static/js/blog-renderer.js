var P7 = Math.PI * 2;
function f6() {
  return typeof window < "u" ? window.devicePixelRatio || 1 : 1;
}
var L7 = class Z {
    ctx;
    width;
    height;
    static MAX_BATCH = 64;
    batchActive = !1;
    batchColor = "";
    batchAlpha = 1;
    batchCount = 0;
    constructor(J) {
      let Q = f6();
      ((this.width = typeof window < "u" ? window.innerWidth : J.width || 0),
        (this.height = typeof window < "u" ? window.innerHeight : J.height || 0),
        (J.width = this.width * Q),
        (J.height = this.height * Q));
      let $ = J.getContext("2d");
      if (((this.ctx = $), $)) $.scale(Q, Q);
    }
    getContext() {
      return this.ctx;
    }
    resize(J, Q) {
      let $ = f6();
      ((this.width = J),
        (this.height = Q),
        (this.ctx.canvas.width = J * $),
        (this.ctx.canvas.height = Q * $),
        (this.ctx.canvas.style.width = `${J}px`),
        (this.ctx.canvas.style.height = `${Q}px`),
        this.ctx.scale($, $));
    }
    clear() {
      (this.flush(), this.ctx.clearRect(0, 0, this.width, this.height));
    }
    save() {
      (this.flush(), this.ctx.save());
    }
    restore() {
      (this.flush(), this.ctx.restore());
    }
    translate(J, Q) {
      this.ctx.translate(J, Q);
    }
    scale(J, Q) {
      this.ctx.scale(J, Q);
    }
    rotate(J) {
      this.ctx.rotate(J);
    }
    setGlobalAlpha(J) {
      this.ctx.globalAlpha = J;
    }
    clip(J, Q, $, K) {
      (this.flush(), this.ctx.beginPath(), this.ctx.rect(J, Q, $, K), this.ctx.clip());
    }
    beginPath() {
      (this.flush(), this.ctx.beginPath());
    }
    moveTo(J, Q) {
      this.ctx.moveTo(J, Q);
    }
    lineTo(J, Q) {
      this.ctx.lineTo(J, Q);
    }
    bezierCurveTo(J, Q, $, K, q, G) {
      this.ctx.bezierCurveTo(J, Q, $, K, q, G);
    }
    closePath() {
      this.ctx.closePath();
    }
    arc(J, Q, $, K, q, G) {
      this.ctx.arc(J, Q, $, K, q, G);
    }
    roundRect(J, Q, $, K, q) {
      this.ctx.roundRect(J, Q, $, K, q);
    }
    drawImage(J, Q, $, K, q) {
      (this.flush(), this.ctx.drawImage(J, Q, $, K, q));
    }
    fillCircle(J, Q, $, K, q = 1) {
      if (this.batchActive && (K !== this.batchColor || q !== this.batchAlpha)) this.flush();
      if (!this.batchActive)
        (this.ctx.beginPath(),
          (this.batchActive = !0),
          (this.batchColor = K),
          (this.batchAlpha = q));
      if (
        (this.ctx.moveTo(J + $, Q),
        this.ctx.arc(J, Q, $, 0, P7),
        this.batchCount++,
        this.batchCount >= Z.MAX_BATCH)
      )
        this.flush();
    }
    flush() {
      if (!this.batchActive) return;
      ((this.ctx.globalAlpha = this.batchAlpha),
        (this.ctx.fillStyle = this.batchColor),
        this.ctx.fill(),
        (this.ctx.globalAlpha = 1),
        (this.batchActive = !1),
        (this.batchCount = 0));
    }
    fill(J) {
      (this.flush(), (this.ctx.fillStyle = J), this.ctx.fill());
    }
    stroke(J, Q = 1) {
      (this.flush(),
        (this.ctx.strokeStyle = J),
        (this.ctx.lineWidth = Q),
        (this.ctx.lineCap = "round"),
        (this.ctx.lineJoin = "round"),
        this.ctx.stroke());
    }
    fillText(J, Q, $, K, q) {
      (this.flush(), (this.ctx.font = K), (this.ctx.fillStyle = q), this.ctx.fillText(J, Q, $));
    }
    createLinearGradient(J, Q, $, K, q) {
      let G = this.ctx.createLinearGradient(J, Q, $, K);
      for (let j of q) G.addColorStop(j.stop, j.color);
      return G;
    }
  },
  A7 = class {
    width;
    height;
    buffer = [];
    defsBuffer = [];
    currentPath = [];
    mStack = [];
    ma = 1;
    mb = 0;
    mc = 0;
    md = 1;
    me = 0;
    mf = 0;
    alphaStack = [];
    globalAlpha = 1;
    clipDepthStack = [];
    clipDepth = 0;
    clipCounter = 0;
    batchCircles = [];
    batchMatrix = [1, 0, 0, 1, 0, 0];
    batchColor = "";
    batchAlpha = 1;
    batchActive = !1;
    gradientCounter = 0;
    gradientCache = new Map();
    constructor(Z, J) {
      ((this.width = Z), (this.height = J));
    }
    clear() {
      ((this.buffer = []),
        (this.defsBuffer = []),
        (this.currentPath = []),
        (this.gradientCounter = 0),
        (this.clipCounter = 0),
        this.gradientCache.clear(),
        (this.mStack = []),
        (this.alphaStack = []),
        (this.clipDepthStack = []),
        (this.ma = 1),
        (this.mb = 0),
        (this.mc = 0),
        (this.md = 1),
        (this.me = 0),
        (this.mf = 0),
        (this.globalAlpha = 1),
        (this.clipDepth = 0),
        (this.batchCircles = []),
        (this.batchActive = !1));
    }
    save() {
      (this.flush(),
        this.mStack.push([this.ma, this.mb, this.mc, this.md, this.me, this.mf]),
        this.alphaStack.push(this.globalAlpha),
        this.clipDepthStack.push(this.clipDepth));
    }
    restore() {
      if ((this.flush(), this.mStack.length > 0)) {
        let Z = this.mStack.pop();
        ((this.ma = Z[0]),
          (this.mb = Z[1]),
          (this.mc = Z[2]),
          (this.md = Z[3]),
          (this.me = Z[4]),
          (this.mf = Z[5]));
      }
      if (this.alphaStack.length > 0) this.globalAlpha = this.alphaStack.pop();
      if (this.clipDepthStack.length > 0) {
        let Z = this.clipDepthStack.pop();
        if (Z < this.clipDepth) {
          for (let J = 0; J < this.clipDepth - Z; J++) this.buffer.push("</g>");
          this.clipDepth = Z;
        }
      }
    }
    translate(Z, J) {
      ((this.me = this.ma * Z + this.mc * J + this.me),
        (this.mf = this.mb * Z + this.md * J + this.mf));
    }
    scale(Z, J) {
      ((this.ma *= Z), (this.mb *= Z), (this.mc *= J), (this.md *= J));
    }
    rotate(Z) {
      let J = Math.cos(Z),
        Q = Math.sin(Z),
        $ = this.ma,
        K = this.mb,
        q = this.mc,
        G = this.md;
      ((this.ma = $ * J + q * Q),
        (this.mb = K * J + G * Q),
        (this.mc = -$ * Q + q * J),
        (this.md = -K * Q + G * J));
    }
    setGlobalAlpha(Z) {
      this.globalAlpha = Z;
    }
    beginPath() {
      this.currentPath = [];
    }
    moveTo(Z, J) {
      this.currentPath.push(`M ${Z} ${J}`);
    }
    lineTo(Z, J) {
      this.currentPath.push(`L ${Z} ${J}`);
    }
    bezierCurveTo(Z, J, Q, $, K, q) {
      this.currentPath.push(`C ${Z} ${J} ${Q} ${$} ${K} ${q}`);
    }
    closePath() {
      this.currentPath.push("Z");
    }
    arc(Z, J, Q, $, K, q) {
      let G = Z + Q * Math.cos($),
        j = J + Q * Math.sin($);
      if (this.currentPath.length === 0) this.currentPath.push(`M ${G} ${j}`);
      else this.currentPath.push(`L ${G} ${j}`);
      let F = Math.abs(K - $);
      if (F >= Math.PI * 2 - 0.0001) {
        let U = Z - Q * Math.cos($),
          H = J - Q * Math.sin($),
          N = q ? 0 : 1;
        (this.currentPath.push(`A ${Q} ${Q} 0 0 ${N} ${U} ${H}`),
          this.currentPath.push(`A ${Q} ${Q} 0 0 ${N} ${G} ${j}`));
      } else {
        let U = Z + Q * Math.cos(K),
          H = J + Q * Math.sin(K),
          N = F > Math.PI ? 1 : 0,
          V = q ? 0 : 1;
        this.currentPath.push(`A ${Q} ${Q} 0 ${N} ${V} ${U} ${H}`);
      }
    }
    roundRect(Z, J, Q, $, K) {
      if (Q < 0) ((Z += Q), (Q = -Q));
      if ($ < 0) ((J += $), ($ = -$));
      let q = 0,
        G = 0,
        j = 0,
        F = 0;
      if (typeof K === "number") q = G = j = F = K;
      else if (Array.isArray(K)) {
        if (K.length === 1) q = G = j = F = K[0];
        else if (K.length === 2) ((q = j = K[0]), (G = F = K[1]));
        else if (K.length === 3) ((q = K[0]), (G = F = K[1]), (j = K[2]));
        else if (K.length >= 4) ((q = K[0]), (G = K[1]), (j = K[2]), (F = K[3]));
      }
      let U = q + G,
        H = F + j,
        N = q + F,
        V = G + j,
        B = 1;
      if (U > Q) B = Math.min(B, Q / U);
      if (H > Q) B = Math.min(B, Q / H);
      if (N > $) B = Math.min(B, $ / N);
      if (V > $) B = Math.min(B, $ / V);
      if (B < 1) ((q *= B), (G *= B), (j *= B), (F *= B));
      (this.currentPath.push(`M ${Z + q} ${J}`),
        this.currentPath.push(`L ${Z + Q - G} ${J}`),
        this.currentPath.push(`A ${G} ${G} 0 0 1 ${Z + Q} ${J + G}`),
        this.currentPath.push(`L ${Z + Q} ${J + $ - j}`),
        this.currentPath.push(`A ${j} ${j} 0 0 1 ${Z + Q - j} ${J + $}`),
        this.currentPath.push(`L ${Z + F} ${J + $}`),
        this.currentPath.push(`A ${F} ${F} 0 0 1 ${Z} ${J + $ - F}`),
        this.currentPath.push(`L ${Z} ${J + q}`),
        this.currentPath.push(`A ${q} ${q} 0 0 1 ${Z + q} ${J}`),
        this.currentPath.push("Z"));
    }
    fill(Z) {
      this.flush();
      let J = this.resolveGradient(Z),
        Q = this.currentPath.join(" "),
        $ = `matrix(${this.ma},${this.mb},${this.mc},${this.md},${this.me},${this.mf})`;
      this.buffer.push(
        `<path d="${Q}" transform="${$}" fill="${J}" opacity="${this.globalAlpha}" />`,
      );
    }
    stroke(Z, J = 1) {
      this.flush();
      let Q = this.resolveGradient(Z),
        $ = this.currentPath.join(" "),
        K = `matrix(${this.ma},${this.mb},${this.mc},${this.md},${this.me},${this.mf})`;
      this.buffer.push(
        `<path d="${$}" transform="${K}" fill="none" stroke="${Q}" stroke-width="${J}" stroke-opacity="${this.globalAlpha}" />`,
      );
    }
    fillText(Z, J, Q, $, K) {
      this.flush();
      let q = $.match(/(\d+(?:\.\d+)?)(px|em|rem)/),
        G = q ? parseFloat(q[1]) : 16;
      if (q && q[2] !== "px") G = G * 16;
      let j = $.match(/(italic|oblique)/i),
        F = $.match(/(bold|[1-9]00)/i),
        U = j ? j[1].toLowerCase() : "normal",
        H = F ? F[1].toLowerCase() : "normal",
        V =
          $.replace(/\d+(?:\.\d+)?(px|em|rem)(?:\/\d+(?:\.\d+)?(?:px|em|rem|%)?)?/, "")
            .trim()
            .replace(/(bold|italic|normal|600|500|400|300|100)\s+/gi, "")
            .trim() || "sans-serif",
        B = this.resolveGradient(K),
        O = `matrix(${this.ma},${this.mb},${this.mc},${this.md},${this.me},${this.mf})`;
      this.buffer.push(
        `<g transform="${O}"><text x="${J}" y="${Q}" font-size="${G}" font-weight="${H}" font-style="${U}" font-family="${this.escapeXML(V)}" fill="${B}" opacity="${this.globalAlpha}">${this.escapeXML(Z)}</text></g>`,
      );
    }
    fillCircle(Z, J, Q, $, K) {
      let q = K ?? 1,
        G =
          this.batchMatrix[0] === this.ma &&
          this.batchMatrix[1] === this.mb &&
          this.batchMatrix[2] === this.mc &&
          this.batchMatrix[3] === this.md &&
          this.batchMatrix[4] === this.me &&
          this.batchMatrix[5] === this.mf;
      if (this.batchActive && (!G || this.batchColor !== $ || this.batchAlpha !== q)) this.flush();
      if (!this.batchActive)
        ((this.batchMatrix = [this.ma, this.mb, this.mc, this.md, this.me, this.mf]),
          (this.batchColor = $),
          (this.batchAlpha = q),
          (this.batchActive = !0));
      this.batchCircles.push({ cx: Z, cy: J, r: Q });
    }
    drawImage(Z, J, Q, $, K) {
      this.flush();
      let q = typeof Z?.toDataURL === "function" ? Z.toDataURL() : Z?.src || "",
        G = `matrix(${this.ma},${this.mb},${this.mc},${this.md},${this.me},${this.mf})`;
      if (q)
        this.buffer.push(
          `<image href="${this.escapeXML(q)}" x="${J}" y="${Q}" width="${$}" height="${K}" transform="${G}" />`,
        );
      else
        (this.buffer.push(
          `<rect x="${J}" y="${Q}" width="${$}" height="${K}" transform="${G}" fill="rgba(0,0,0,0.5)" />`,
        ),
          console.warn("drawImage source fallback triggered"));
    }
    flush() {
      if (!this.batchActive || this.batchCircles.length === 0) return;
      let Z = "";
      for (let $ of this.batchCircles) {
        let K = $.cx - $.r,
          q = $.cx + $.r;
        Z += `M ${K} ${$.cy} A ${$.r} ${$.r} 0 1 0 ${q} ${$.cy} A ${$.r} ${$.r} 0 1 0 ${K} ${$.cy} `;
      }
      let J = `matrix(${this.batchMatrix.join(",")})`,
        Q = `<path d="${Z.trim()}" transform="${J}" fill="${this.escapeXML(this.batchColor)}" opacity="${this.batchAlpha}" />`;
      (this.buffer.push(Q), (this.batchCircles = []), (this.batchActive = !1));
    }
    createLinearGradient(Z, J, Q, $, K) {
      return {
        type: "linear",
        x0: Z,
        y0: J,
        x1: Q,
        y1: $,
        colorStops: K,
        createMatrix: [this.ma, this.mb, this.mc, this.md, this.me, this.mf],
      };
    }
    clip(Z, J, Q, $) {
      this.flush();
      let K = `clip-${this.clipCounter++}`,
        q = `matrix(${this.ma},${this.mb},${this.mc},${this.md},${this.me},${this.mf})`,
        G = `<clipPath id="${K}"><rect x="${Z}" y="${J}" width="${Q}" height="${$}" transform="${q}" /></clipPath>`;
      (this.defsBuffer.push(G), this.buffer.push(`<g clip-path="url(#${K})">`), this.clipDepth++);
    }
    toXMLString() {
      this.flush();
      let Z = `<svg width="${this.width}" height="${this.height}" viewBox="0 0 ${this.width} ${this.height}" xmlns="http://www.w3.org/2000/svg">`;
      if (this.defsBuffer.length > 0)
        Z += `<defs>${this.defsBuffer.join(`
`)}</defs>`;
      Z += this.buffer.join(`
`);
      for (let J = 0; J < this.clipDepth; J++) Z += "</g>";
      return ((Z += "</svg>"), Z);
    }
    resolveGradient(Z) {
      if (typeof Z === "string") return Z;
      let J = Z,
        [Q, $, K, q, G, j] = J.createMatrix,
        F = this.ma * this.md - this.mb * this.mc,
        U = 1,
        H = 0,
        N = 0,
        V = 1,
        B = 0,
        O = 0;
      if (Math.abs(F) > 0.000001)
        ((U = this.md / F),
          (H = -this.mb / F),
          (N = -this.mc / F),
          (V = this.ma / F),
          (B = (this.mc * this.mf - this.md * this.me) / F),
          (O = (this.mb * this.me - this.ma * this.mf) / F));
      let X = U * Q + N * $,
        z = H * Q + V * $,
        I = U * K + N * q,
        M = H * K + V * q,
        D = U * G + N * j + B,
        Y = H * G + V * j + O,
        P = JSON.stringify(J.colorStops),
        R = Q * J.x0 + K * J.y0 + G,
        w = $ * J.x0 + q * J.y0 + j,
        W = Q * J.x1 + K * J.y1 + G,
        L = $ * J.x1 + q * J.y1 + j,
        b = `${R}_${w}_${W}_${L}_${P}_${this.ma}_${this.mb}_${this.mc}_${this.md}_${this.me}_${this.mf}`,
        k = this.gradientCache.get(b);
      if (!k) {
        k = `vecto-linear-grad-${this.gradientCounter++}`;
        let p = "";
        for (let A of J.colorStops)
          p += `<stop offset="${A.stop}" stop-color="${this.escapeXML(A.color)}" />`;
        let c = `matrix(${X},${z},${I},${M},${D},${Y})`,
          T = `<linearGradient id="${k}" x1="${J.x0}" y1="${J.y0}" x2="${J.x1}" y2="${J.y1}" gradientUnits="userSpaceOnUse" gradientTransform="${c}">${p}</linearGradient>`;
        (this.defsBuffer.push(T), this.gradientCache.set(b, k));
      }
      return `url(#${k})`;
    }
    escapeXML(Z) {
      return Z.replace(/[<>&'"]/g, (J) => {
        switch (J) {
          case "<":
            return "&lt;";
          case ">":
            return "&gt;";
          case "&":
            return "&amp;";
          case "'":
            return "&apos;";
          case '"':
            return "&quot;";
          default:
            return J;
        }
      });
    }
  },
  y6 = new Map(),
  g0;
function R7(Z) {
  let J = Z.slice(1),
    Q = J.length;
  if (Q !== 3 && Q !== 4 && Q !== 6 && Q !== 8) return null;
  if (!/^[0-9a-f]+$/i.test(J)) return null;
  let $ = Q === 3 || Q === 4,
    K = (G) => {
      let j = $ ? J[G] + J[G] : J.slice(G * 2, G * 2 + 2);
      return parseInt(j, 16) / 255;
    },
    q = Q === 4 || Q === 8;
  return [K(0), K(1), K(2), q ? K(3) : 1];
}
var q6 = (Z) => (Z < 0 ? 0 : Z > 1 ? 1 : Z);
function _7(Z) {
  let J = /^rgba?\(([^)]+)\)$/i.exec(Z.trim());
  if (!J) return null;
  let [Q, $] = J[1].split("/"),
    K = Q.trim()
      .split(/[\s,]+/)
      .filter(Boolean);
  if (K.length < 3) return null;
  let q = (N) => (N.endsWith("%") ? (parseFloat(N) / 100) * 255 : parseFloat(N)),
    G = q(K[0]) / 255,
    j = q(K[1]) / 255,
    F = q(K[2]) / 255,
    U = $ !== void 0 ? $.trim() : K[3],
    H = U === void 0 ? 1 : U.endsWith("%") ? parseFloat(U) / 100 : parseFloat(U);
  if ([G, j, F, H].some((N) => Number.isNaN(N))) return null;
  return [q6(G), q6(j), q6(F), q6(H)];
}
function C7(Z) {
  if (typeof document > "u") return null;
  if (!g0) g0 = document.createElement("canvas").getContext("2d");
  if (!g0) return null;
  ((g0.fillStyle = Z), g0.fillRect(0, 0, 1, 1));
  let J = g0.getImageData(0, 0, 1, 1).data;
  return [J[0] / 255, J[1] / 255, J[2] / 255, J[3] / 255];
}
function o0(Z) {
  let J = y6.get(Z);
  if (J) return J;
  let Q = Z.trim(),
    $ = (Q[0] === "#" ? R7(Q) : null) ?? _7(Q) ?? C7(Q) ?? [0, 0, 0, 1];
  return (y6.set(Z, $), $);
}
var n0 = 7,
  I6 = n0 * 4,
  r0 = 6,
  m6 = r0 * 4,
  G6 = 6,
  B0 = 8,
  h0 = B0 * 4,
  Y0 = 6,
  E7 = `#version 300 es
in vec2 a_pos;
in float a_radius;
in vec4 a_color;
uniform vec2 u_resolution;
uniform float u_dpr;
out vec4 v_color;
void main() {
  vec2 clip = (a_pos / u_resolution) * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
  gl_PointSize = a_radius * 2.0 * u_dpr;
  v_color = a_color;
}`,
  T7 = `#version 300 es
precision mediump float;
in vec4 v_color;
out vec4 outColor;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  float aa = fwidth(d);
  float alpha = 1.0 - smoothstep(0.5 - aa, 0.5, d);
  if (alpha <= 0.0) discard;
  outColor = vec4(v_color.rgb, v_color.a * alpha);
}`,
  w7 = `#version 300 es
in vec2 a_pos;
in vec4 a_rcolor;
uniform vec2 u_resolution;
out vec4 v_color;
void main() {
  vec2 clip = (a_pos / u_resolution) * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
  v_color = a_rcolor;
}`,
  k7 = `#version 300 es
precision mediump float;
in vec4 v_color;
out vec4 outColor;
void main() {
  outColor = vec4(v_color.rgb, v_color.a);
}`,
  x6 = `#version 300 es
in vec2 a_pos;
in vec2 a_uv;
in vec4 a_tint;
uniform vec2 u_resolution;
out vec2 v_uv;
out vec4 v_tint;
void main() {
  vec2 clip = (a_pos / u_resolution) * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
  v_uv = a_uv;
  v_tint = a_tint;
}`,
  S7 = `#version 300 es
precision mediump float;
uniform sampler2D u_tex;
in vec2 v_uv;
in vec4 v_tint;
out vec4 outColor;
void main() {
  vec4 t = texture(u_tex, v_uv);
  outColor = vec4(t.rgb * v_tint.rgb, t.a * v_tint.a);
}`,
  v7 = `#version 300 es
precision mediump float;
uniform sampler2D u_tex;
uniform float u_distanceRange;
in vec2 v_uv;
in vec4 v_tint;
out vec4 outColor;
float median(float r, float g, float b) {
  return max(min(r, g), min(max(r, g), b));
}
void main() {
  vec3 msd = texture(u_tex, v_uv).rgb;
  float sd = median(msd.r, msd.g, msd.b);
  vec2 unitRange = vec2(u_distanceRange) / vec2(textureSize(u_tex, 0));
  vec2 screenTexSize = vec2(1.0) / fwidth(v_uv);
  float screenPxRange = max(0.5 * dot(unitRange, screenTexSize), 1.0);
  float screenPxDistance = screenPxRange * (sd - 0.5);
  float opacity = clamp(screenPxDistance + 0.5, 0.0, 1.0);
  if (opacity <= 0.0) discard;
  outColor = vec4(v_tint.rgb, v_tint.a * opacity);
}`;
function u6(Z, J, Q) {
  let $ = Z.createShader(J);
  if (!$) return null;
  if ((Z.shaderSource($, Q), Z.compileShader($), !Z.getShaderParameter($, Z.COMPILE_STATUS)))
    return (Z.deleteShader($), null);
  return $;
}
function j6(Z, J, Q) {
  let $ = u6(Z, Z.VERTEX_SHADER, J),
    K = u6(Z, Z.FRAGMENT_SHADER, Q);
  if (!$ || !K) return null;
  let q = Z.createProgram();
  if (!q) return null;
  if (
    (Z.attachShader(q, $),
    Z.attachShader(q, K),
    Z.linkProgram(q),
    Z.deleteShader($),
    Z.deleteShader(K),
    !Z.getProgramParameter(q, Z.LINK_STATUS))
  )
    return (Z.deleteProgram(q), null);
  return q;
}
function U6(Z, J) {
  if (J <= Z.length) return Z;
  let Q = Z.length;
  while (Q < J) Q *= 2;
  let $ = new Float32Array(Q);
  return ($.set(Z), $);
}
function b7(Z) {
  let J = Z.getContext("webgl2");
  if (!J) return null;
  let Q = j6(J, E7, T7),
    $ = j6(J, w7, k7),
    K = j6(J, x6, S7),
    q = j6(J, x6, v7);
  if (!Q || !$ || !K || !q) return null;
  (J.enable(J.BLEND), J.blendFunc(J.SRC_ALPHA, J.ONE_MINUS_SRC_ALPHA));
  let G = J.getAttribLocation(Q, "a_pos"),
    j = J.getAttribLocation(Q, "a_radius"),
    F = J.getAttribLocation(Q, "a_color"),
    U = J.getUniformLocation(Q, "u_resolution"),
    H = J.getUniformLocation(Q, "u_dpr"),
    N = J.createBuffer(),
    V = J.createVertexArray();
  (J.bindVertexArray(V),
    J.bindBuffer(J.ARRAY_BUFFER, N),
    J.enableVertexAttribArray(G),
    J.vertexAttribPointer(G, 2, J.FLOAT, !1, I6, 0),
    J.enableVertexAttribArray(j),
    J.vertexAttribPointer(j, 1, J.FLOAT, !1, I6, 8),
    J.enableVertexAttribArray(F),
    J.vertexAttribPointer(F, 4, J.FLOAT, !1, I6, 12));
  let B = J.getAttribLocation($, "a_pos"),
    O = J.getAttribLocation($, "a_rcolor"),
    X = J.getUniformLocation($, "u_resolution"),
    z = J.createBuffer(),
    I = J.createVertexArray();
  (J.bindVertexArray(I),
    J.bindBuffer(J.ARRAY_BUFFER, z),
    J.enableVertexAttribArray(B),
    J.vertexAttribPointer(B, 2, J.FLOAT, !1, m6, 0),
    J.enableVertexAttribArray(O),
    J.vertexAttribPointer(O, 4, J.FLOAT, !1, m6, 8));
  let M = J.getAttribLocation(K, "a_pos"),
    D = J.getAttribLocation(K, "a_uv"),
    Y = J.getAttribLocation(K, "a_tint"),
    P = J.getUniformLocation(K, "u_resolution"),
    R = J.getUniformLocation(K, "u_tex"),
    w = J.createBuffer(),
    W = J.createVertexArray();
  (J.bindVertexArray(W),
    J.bindBuffer(J.ARRAY_BUFFER, w),
    J.enableVertexAttribArray(M),
    J.vertexAttribPointer(M, 2, J.FLOAT, !1, h0, 0),
    J.enableVertexAttribArray(D),
    J.vertexAttribPointer(D, 2, J.FLOAT, !1, h0, 8),
    J.enableVertexAttribArray(Y),
    J.vertexAttribPointer(Y, 4, J.FLOAT, !1, h0, 16));
  let L = J.getAttribLocation(q, "a_pos"),
    b = J.getAttribLocation(q, "a_uv"),
    k = J.getAttribLocation(q, "a_tint"),
    p = J.getUniformLocation(q, "u_resolution"),
    c = J.getUniformLocation(q, "u_tex"),
    T = J.getUniformLocation(q, "u_distanceRange"),
    A = J.createBuffer(),
    f = J.createVertexArray();
  (J.bindVertexArray(f),
    J.bindBuffer(J.ARRAY_BUFFER, A),
    J.enableVertexAttribArray(L),
    J.vertexAttribPointer(L, 2, J.FLOAT, !1, h0, 0),
    J.enableVertexAttribArray(b),
    J.vertexAttribPointer(b, 2, J.FLOAT, !1, h0, 8),
    J.enableVertexAttribArray(k),
    J.vertexAttribPointer(k, 4, J.FLOAT, !1, h0, 16),
    J.bindVertexArray(null));
  let S = null,
    m = null,
    o = 4,
    y = new Float32Array(n0 * 1024),
    u = 0,
    C = new Float32Array(r0 * G6 * 256),
    g = 0,
    r = new Float32Array(B0 * Y0 * 256),
    L0 = 0,
    t = new Float32Array(B0 * Y0 * 1024),
    A0 = 0,
    l0 = 0,
    s0 = 0,
    K6 = 1;
  return {
    resize(x, s) {
      ((l0 = x),
        (s0 = s),
        (K6 = typeof devicePixelRatio < "u" ? devicePixelRatio || 1 : 1),
        (Z.width = Math.round(x * K6)),
        (Z.height = Math.round(s * K6)),
        (Z.style.width = `${x}px`),
        (Z.style.height = `${s}px`),
        J.viewport(0, 0, Z.width, Z.height));
    },
    begin() {
      ((u = 0), (g = 0), (L0 = 0), (A0 = 0));
    },
    setTexture(x) {
      if (!S)
        ((S = J.createTexture()),
          J.bindTexture(J.TEXTURE_2D, S),
          J.texParameteri(J.TEXTURE_2D, J.TEXTURE_MIN_FILTER, J.LINEAR),
          J.texParameteri(J.TEXTURE_2D, J.TEXTURE_MAG_FILTER, J.LINEAR),
          J.texParameteri(J.TEXTURE_2D, J.TEXTURE_WRAP_S, J.CLAMP_TO_EDGE),
          J.texParameteri(J.TEXTURE_2D, J.TEXTURE_WRAP_T, J.CLAMP_TO_EDGE));
      else J.bindTexture(J.TEXTURE_2D, S);
      J.texImage2D(J.TEXTURE_2D, 0, J.RGBA, J.RGBA, J.UNSIGNED_BYTE, x);
    },
    addSprite(x, s, K0, q0, H0, N0, G0, j0, R0 = "#ffffff", i = 1, _0 = 0) {
      if (!S) return;
      let C0 = B0 * Y0;
      r = U6(r, (L0 + 1) * C0);
      let [i0, m0, x0, M0] = o0(R0),
        u0 = M0 * i,
        E0 = Math.sin(_0),
        W0 = Math.cos(_0),
        e = (d, V0) => [x + d * W0 - V0 * E0, s + d * E0 + V0 * W0],
        a0 = [
          [e(0, 0), [H0, N0]],
          [e(K0, 0), [G0, N0]],
          [e(K0, q0), [G0, j0]],
          [e(0, q0), [H0, j0]],
        ],
        J0 = [0, 1, 2, 0, 2, 3],
        v = L0 * C0;
      for (let d of J0) {
        let [[V0, W6], [Y6, D6]] = a0[d];
        ((r[v] = V0),
          (r[v + 1] = W6),
          (r[v + 2] = Y6),
          (r[v + 3] = D6),
          (r[v + 4] = i0),
          (r[v + 5] = m0),
          (r[v + 6] = x0),
          (r[v + 7] = u0),
          (v += B0));
      }
      L0++;
    },
    setMSDFTexture(x, s) {
      if (((o = s), !m))
        ((m = J.createTexture()),
          J.bindTexture(J.TEXTURE_2D, m),
          J.texParameteri(J.TEXTURE_2D, J.TEXTURE_MIN_FILTER, J.LINEAR),
          J.texParameteri(J.TEXTURE_2D, J.TEXTURE_MAG_FILTER, J.LINEAR),
          J.texParameteri(J.TEXTURE_2D, J.TEXTURE_WRAP_S, J.CLAMP_TO_EDGE),
          J.texParameteri(J.TEXTURE_2D, J.TEXTURE_WRAP_T, J.CLAMP_TO_EDGE));
      else J.bindTexture(J.TEXTURE_2D, m);
      J.texImage2D(J.TEXTURE_2D, 0, J.RGBA, J.RGBA, J.UNSIGNED_BYTE, x);
    },
    addGlyph(x, s, K0, q0, H0, N0, G0, j0, R0 = "#ffffff", i = 1, _0 = 0) {
      if (!m) return;
      let C0 = B0 * Y0;
      t = U6(t, (A0 + 1) * C0);
      let [i0, m0, x0, M0] = o0(R0),
        u0 = M0 * i,
        E0 = Math.sin(_0),
        W0 = Math.cos(_0),
        e = (d, V0) => [x + d * W0 - V0 * E0, s + d * E0 + V0 * W0],
        a0 = [
          [e(0, 0), [H0, N0]],
          [e(K0, 0), [G0, N0]],
          [e(K0, q0), [G0, j0]],
          [e(0, q0), [H0, j0]],
        ],
        J0 = [0, 1, 2, 0, 2, 3],
        v = A0 * C0;
      for (let d of J0) {
        let [[V0, W6], [Y6, D6]] = a0[d];
        ((t[v] = V0),
          (t[v + 1] = W6),
          (t[v + 2] = Y6),
          (t[v + 3] = D6),
          (t[v + 4] = i0),
          (t[v + 5] = m0),
          (t[v + 6] = x0),
          (t[v + 7] = u0),
          (v += B0));
      }
      A0++;
    },
    addCircle(x, s, K0, q0, H0 = 1) {
      y = U6(y, (u + 1) * n0);
      let [N0, G0, j0, R0] = o0(q0),
        i = u * n0;
      ((y[i] = x),
        (y[i + 1] = s),
        (y[i + 2] = K0),
        (y[i + 3] = N0),
        (y[i + 4] = G0),
        (y[i + 5] = j0),
        (y[i + 6] = R0 * H0),
        u++);
    },
    addRect(x, s, K0, q0, H0, N0 = 1, G0 = 0) {
      let j0 = r0 * G6;
      C = U6(C, (g + 1) * j0);
      let [R0, i, _0, C0] = o0(H0),
        i0 = C0 * N0,
        m0 = Math.sin(G0),
        x0 = Math.cos(G0),
        M0 = (v, d) => [x + v * x0 - d * m0, s + v * m0 + d * x0],
        u0 = M0(0, 0),
        E0 = M0(K0, 0),
        W0 = M0(K0, q0),
        e = M0(0, q0),
        a0 = [u0, E0, W0, u0, W0, e],
        J0 = g * j0;
      for (let [v, d] of a0)
        ((C[J0] = v),
          (C[J0 + 1] = d),
          (C[J0 + 2] = R0),
          (C[J0 + 3] = i),
          (C[J0 + 4] = _0),
          (C[J0 + 5] = i0),
          (J0 += r0));
      g++;
    },
    flush() {
      if ((J.clearColor(0, 0, 0, 0), J.clear(J.COLOR_BUFFER_BIT), g > 0)) {
        let x = g * G6 * r0;
        (J.useProgram($),
          J.bindVertexArray(I),
          J.bindBuffer(J.ARRAY_BUFFER, z),
          J.bufferData(J.ARRAY_BUFFER, C.subarray(0, x), J.DYNAMIC_DRAW),
          J.uniform2f(X, l0, s0),
          J.drawArrays(J.TRIANGLES, 0, g * G6));
      }
      if (u > 0)
        (J.useProgram(Q),
          J.bindVertexArray(V),
          J.bindBuffer(J.ARRAY_BUFFER, N),
          J.bufferData(J.ARRAY_BUFFER, y.subarray(0, u * n0), J.DYNAMIC_DRAW),
          J.uniform2f(U, l0, s0),
          J.uniform1f(H, K6),
          J.drawArrays(J.POINTS, 0, u));
      if (L0 > 0 && S) {
        let x = L0 * Y0 * B0;
        (J.useProgram(K),
          J.bindVertexArray(W),
          J.bindBuffer(J.ARRAY_BUFFER, w),
          J.bufferData(J.ARRAY_BUFFER, r.subarray(0, x), J.DYNAMIC_DRAW),
          J.activeTexture(J.TEXTURE0),
          J.bindTexture(J.TEXTURE_2D, S),
          J.uniform1i(R, 0),
          J.uniform2f(P, l0, s0),
          J.drawArrays(J.TRIANGLES, 0, L0 * Y0));
      }
      if (A0 > 0 && m) {
        let x = A0 * Y0 * B0;
        (J.useProgram(q),
          J.bindVertexArray(f),
          J.bindBuffer(J.ARRAY_BUFFER, A),
          J.bufferData(J.ARRAY_BUFFER, t.subarray(0, x), J.DYNAMIC_DRAW),
          J.activeTexture(J.TEXTURE0),
          J.bindTexture(J.TEXTURE_2D, m),
          J.uniform1i(c, 0),
          J.uniform2f(p, l0, s0),
          J.uniform1f(T, o),
          J.drawArrays(J.TRIANGLES, 0, A0 * Y0));
      }
      J.bindVertexArray(null);
    },
    destroy() {
      if (
        (J.deleteBuffer(N),
        J.deleteBuffer(z),
        J.deleteBuffer(w),
        J.deleteBuffer(A),
        J.deleteVertexArray(V),
        J.deleteVertexArray(I),
        J.deleteVertexArray(W),
        J.deleteVertexArray(f),
        J.deleteProgram(Q),
        J.deleteProgram($),
        J.deleteProgram(K),
        J.deleteProgram(q),
        S)
      )
        J.deleteTexture(S);
      if (m) J.deleteTexture(m);
    },
  };
}
var U0 = class {
    type;
    target;
    currentTarget;
    nativeEvent;
    bubbles;
    stopped = !1;
    stoppedImmediate = !1;
    constructor(Z, J, Q, $ = !0) {
      ((this.type = Z),
        (this.target = J),
        (this.currentTarget = J),
        (this.nativeEvent = Q),
        (this.bubbles = $));
    }
    stopPropagation() {
      this.stopped = !0;
    }
    stopImmediatePropagation() {
      ((this.stopped = !0), (this.stoppedImmediate = !0));
    }
    preventDefault() {
      this.nativeEvent?.preventDefault?.();
    }
    get propagationStopped() {
      return this.stopped;
    }
    get immediatePropagationStopped() {
      return this.stoppedImmediate;
    }
    get defaultPrevented() {
      return !!this.nativeEvent?.defaultPrevented;
    }
    get deltaX() {
      return this.nativeEvent?.deltaX;
    }
    get deltaY() {
      return this.nativeEvent?.deltaY;
    }
    get clientX() {
      return this.nativeEvent?.clientX;
    }
    get clientY() {
      return this.nativeEvent?.clientY;
    }
    get key() {
      return this.nativeEvent?.key;
    }
  },
  n = class {
    id;
    children = [];
    parent = null;
    get scene() {
      if (this._scene) return this._scene;
      return this.parent ? this.parent.scene : null;
    }
    x = 0;
    y = 0;
    scaleX = 1;
    scaleY = 1;
    rotation = 0;
    opacity = 1;
    isDOMPortal = !1;
    _interactive = !1;
    get interactive() {
      return this._interactive;
    }
    set interactive(Z) {
      if (this._interactive !== Z) {
        this._interactive = Z;
        let J = this.scene;
        if (J) ((J.a11yNeedsReorder = !0), J.markDirty());
      }
    }
    width = 0;
    height = 0;
    a11yOffsetX = 0;
    a11yOffsetY = 0;
    a11yFullViewport = !1;
    clipChildren = !1;
    listeners = new Map();
    captureListeners = new Map();
    animations = [];
    constructor(Z) {
      this.id = Z || `entity_${Math.random().toString(36).substring(2, 9)}`;
    }
    add(Z) {
      ((Z.parent = this), this.children.push(Z));
      let J = this.scene;
      if (J) ((J.a11yNeedsReorder = !0), J.markDirty());
      return this;
    }
    remove(Z) {
      let J = this.children.indexOf(Z);
      if (J !== -1) {
        (this.children.splice(J, 1), (Z.parent = null));
        let Q = this.scene;
        if (Q) ((Q.a11yNeedsReorder = !0), Q.markDirty());
      }
      return this;
    }
    setPosition(Z, J) {
      return ((this.x = Z), (this.y = J), this);
    }
    animate(Z, J) {
      return (
        this.animations.push({ target: Z, duration: J, startTime: -1, startProps: {} }),
        this
      );
    }
    update(Z, J) {
      if (this.animations.length > 0) {
        let Q = this.animations[0];
        if (Q.startTime === -1) {
          Q.startTime = J;
          for (let K in Q.target) Q.startProps[K] = this[K];
        }
        let $ = Math.min((J - Q.startTime) / Q.duration, 1);
        for (let K in Q.target) {
          let q = Q.startProps[K],
            G = Q.target[K];
          if (typeof q === "number" && typeof G === "number") {
            let j = $ * (2 - $);
            this[K] = q + (G - q) * j;
          }
        }
        if ($ >= 1) this.animations.shift();
      }
    }
    on(Z, J, Q) {
      let $ = Q?.capture ? this.captureListeners : this.listeners;
      if (!$.has(Z)) $.set(Z, []);
      return ($.get(Z).push(J), this);
    }
    off(Z, J, Q) {
      let $ = (Q?.capture ? this.captureListeners : this.listeners).get(Z);
      if ($) {
        let K = $.indexOf(J);
        if (K !== -1) $.splice(K, 1);
      }
      return this;
    }
    destroy() {
      if (
        ((this.animations = []), this.listeners.clear(), this.captureListeners.clear(), this.parent)
      )
        this.parent.remove(this);
    }
    emit(Z, J) {
      let Q = this.listeners.get(Z);
      if (Q) Q.forEach(($) => $(J));
    }
    fireListeners(Z, J, Q) {
      let $ = J.get(Q.type);
      if (!$) return;
      Q.currentTarget = Z;
      for (let K of $.slice()) if ((K(Q), Q.immediatePropagationStopped)) return;
    }
    dispatchEvent(Z) {
      let J = [];
      for (let Q = Z.target; Q; Q = Q.parent) J.push(Q);
      for (let Q = J.length - 1; Q >= 0; Q--) {
        if (Z.propagationStopped) return;
        this.fireListeners(J[Q], J[Q].captureListeners, Z);
      }
      for (let Q = 0; Q < J.length; Q++) {
        if (Z.propagationStopped) return;
        if ((this.fireListeners(J[Q], J[Q].listeners, Z), !Z.bubbles)) return;
      }
    }
    getGlobalPosition() {
      let Z = this.x,
        J = this.y,
        Q = this.parent;
      while (Q && Q.id !== "root") {
        let $ = Math.cos(Q.rotation),
          K = Math.sin(Q.rotation),
          q = Z * $ - J * K,
          G = Z * K + J * $;
        ((Z = Q.x + Q.scaleX * q), (J = Q.y + Q.scaleY * G), (Q = Q.parent));
      }
      return { x: Z, y: J };
    }
    getWorldScale() {
      let Z = this.scaleX,
        J = this.scaleY,
        Q = this.parent;
      while (Q && Q.id !== "root") ((Z *= Q.scaleX), (J *= Q.scaleY), (Q = Q.parent));
      return { x: Z, y: J };
    }
    getWorldRotation() {
      let Z = this.rotation,
        J = this.parent;
      while (J && J.id !== "root") ((Z += J.rotation), (J = J.parent));
      return Z;
    }
    getA11yAttributes() {
      return {};
    }
    getBounds() {
      return null;
    }
    getBatchCircle() {
      return null;
    }
    getBatchRect() {
      return null;
    }
    hasPendingAnimations() {
      return this.animations.length > 0;
    }
  },
  f7 = `
struct Particle {
  position: vec2<f32>,
  velocity: vec2<f32>,
  origin: vec2<f32>,
  size: f32,
  life: f32,
}

struct Params {
  base_color: vec4<f32>,
  mouse_pos: vec2<f32>,
  screen_size: vec2<f32>,
  explosion_pos: vec2<f32>,
  dt: f32,
  spring_k: f32,
  damping: f32,
  explosion_force: f32,
  bounce_damping: f32,
  max_particles: u32,
  max_velocity: f32,
  pad0: f32,
  pad1: f32,
  pad2: f32,
}

@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var<storage, read_write> particles: array<Particle>;

@compute @workgroup_size(256)
fn cs_main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let idx = global_id.x;
  if (idx >= params.max_particles) {
    return;
  }

  var p = particles[idx];
  let dt = clamp(params.dt, 0.0, 0.1);
  let safe_screen_size = max(params.screen_size, vec2<f32>(1.0, 1.0));

  let spring_k = clamp(params.spring_k, 0.0, 1.0);
  let damping = clamp(params.damping, 0.0, 1.0);
  let bounce_damping = clamp(params.bounce_damping, 0.0, 1.0);
  let max_velocity = max(params.max_velocity, 1.0);

  let to_origin = p.origin - p.position;
  let spring_force = to_origin * spring_k;

  var mouse_force = vec2<f32>(0.0, 0.0);
  let to_mouse = params.mouse_pos - p.position;
  let dist = length(to_mouse);
  if (dist < 120.0 && dist > 0.1) {
    let force_magnitude = (120.0 - dist) * 2.0;
    mouse_force = -normalize(to_mouse) * force_magnitude;
  }

  var expl_force = vec2<f32>(0.0, 0.0);
  if (params.explosion_force > 0.0) {
    let to_expl = params.explosion_pos - p.position;
    let expl_dist = length(to_expl);
    if (expl_dist < 150.0 && expl_dist > 0.1) {
      let f = (150.0 - expl_dist) * params.explosion_force;
      expl_force = -normalize(to_expl) * f;
    }
  }

  let accel = spring_force + mouse_force + expl_force;
  p.velocity = (p.velocity + accel * dt) * damping;

  let speed = length(p.velocity);
  if (speed > max_velocity) {
    p.velocity = normalize(p.velocity) * max_velocity;
  }

  p.position = p.position + p.velocity * dt;

  if (p.position.x <= 0.0 && p.velocity.x < 0.0) {
    p.velocity.x = -p.velocity.x * bounce_damping;
  } else if (p.position.x >= safe_screen_size.x && p.velocity.x > 0.0) {
    p.velocity.x = -p.velocity.x * bounce_damping;
  }

  if (p.position.y <= 0.0 && p.velocity.y < 0.0) {
    p.velocity.y = -p.velocity.y * bounce_damping;
  } else if (p.position.y >= safe_screen_size.y && p.velocity.y > 0.0) {
    p.velocity.y = -p.velocity.y * bounce_damping;
  }

  p.position = clamp(p.position, vec2<f32>(0.0, 0.0), safe_screen_size);

  if (p.life >= 0.0) {
    p.life = max(0.0, p.life - dt * 0.5);
  }

  particles[idx] = p;
}
`,
  y7 = `
struct Particle {
  position: vec2<f32>,
  velocity: vec2<f32>,
  origin: vec2<f32>,
  size: f32,
  life: f32,
}

struct Params {
  base_color: vec4<f32>,
  mouse_pos: vec2<f32>,
  screen_size: vec2<f32>,
  explosion_pos: vec2<f32>,
  dt: f32,
  spring_k: f32,
  damping: f32,
  explosion_force: f32,
  bounce_damping: f32,
  max_particles: u32,
  max_velocity: f32,
  pad0: f32,
  pad1: f32,
  pad2: f32,
}

struct VertexOutput {
  @builtin(position) pos: vec4<f32>,
  @location(0) uv: vec2<f32>,
  @location(1) color: vec4<f32>,
}

@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var<storage, read> particles: array<Particle>;

@vertex
fn vs_main(
  @builtin(vertex_index) vertex_idx: u32,
  @builtin(instance_index) instance_idx: u32
) -> VertexOutput {
  let p = particles[instance_idx];
  let uvs = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, -1.0), vec2<f32>(-1.0, 1.0),
    vec2<f32>(-1.0, 1.0), vec2<f32>(1.0, -1.0), vec2<f32>(1.0, 1.0)
  );

  let safe_screen_size = max(params.screen_size, vec2<f32>(1.0, 1.0));
  var life_scale = 1.0;
  if (p.life >= 0.0) {
    life_scale = clamp(p.life, 0.0, 1.0);
  }
  let visual_size = p.size * life_scale;
  let offset = uvs[vertex_idx] * visual_size;
  let world_pos = p.position + offset;

  let ndc_x = (world_pos.x / safe_screen_size.x) * 2.0 - 1.0;
  let ndc_y = 1.0 - (world_pos.y / safe_screen_size.y) * 2.0;

  var out: VertexOutput;
  out.pos = vec4<f32>(ndc_x, ndc_y, 0.0, 1.0);
  out.uv = uvs[vertex_idx];
  out.color = vec4<f32>(params.base_color.rgb, params.base_color.a * life_scale);
  return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
  let dist = length(in.uv);
  if (dist > 1.0) {
    discard;
  }
  let alpha = 1.0 - smoothstep(0.85, 1.0, dist);
  return vec4<f32>(in.color.rgb, in.color.a * alpha);
}
`,
  g6 = class {
    device;
    computePipeline = null;
    renderPipeline = null;
    bindGroupLayout = null;
    constructor(Z) {
      this.device = Z;
    }
    initPipelines(Z) {
      let J = this.device.createShaderModule({ code: f7 }),
        Q = this.device.createShaderModule({ code: y7 });
      this.bindGroupLayout = this.device.createBindGroupLayout({
        entries: [
          {
            binding: 0,
            visibility: GPUShaderStage.COMPUTE | GPUShaderStage.VERTEX,
            buffer: { type: "uniform" },
          },
          {
            binding: 1,
            visibility: GPUShaderStage.COMPUTE | GPUShaderStage.VERTEX,
            buffer: { type: "storage" },
          },
        ],
      });
      let $ = this.device.createPipelineLayout({ bindGroupLayouts: [this.bindGroupLayout] });
      ((this.computePipeline = this.device.createComputePipeline({
        layout: $,
        compute: { module: J, entryPoint: "cs_main" },
      })),
        (this.renderPipeline = this.device.createRenderPipeline({
          layout: $,
          vertex: { module: Q, entryPoint: "vs_main" },
          fragment: {
            module: Q,
            entryPoint: "fs_main",
            targets: [
              {
                format: Z,
                blend: {
                  color: {
                    srcFactor: "src-alpha",
                    dstFactor: "one-minus-src-alpha",
                    operation: "add",
                  },
                  alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add" },
                },
              },
            ],
          },
          primitive: { topology: "triangle-list" },
        })));
    }
    setupEntityResources(Z) {
      let J = Z.maxParticles * 32;
      ((Z.gpuStorageBuffer = this.device.createBuffer({
        size: J,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      })),
        (Z.gpuUniformBuffer = this.device.createBuffer({
          size: 80,
          usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        })),
        (Z.computeBindGroup = this.device.createBindGroup({
          layout: this.bindGroupLayout,
          entries: [
            { binding: 0, resource: { buffer: Z.gpuUniformBuffer } },
            { binding: 1, resource: { buffer: Z.gpuStorageBuffer } },
          ],
        })),
        (Z.renderBindGroup = Z.computeBindGroup));
    }
    recordComputePass(Z, J, Q, $, K, q, G) {
      if (!this.computePipeline || !J.computeBindGroup) return;
      let j = new Float32Array(20),
        F = o0(J.baseColor);
      ((j[0] = F[0]), (j[1] = F[1]), (j[2] = F[2]), (j[3] = F[3]));
      let U = !isNaN($) && !isNaN(K) && $ > -9000 && K > -9000;
      if (
        ((j[4] = U ? $ : -9999),
        (j[5] = U ? K : -9999),
        (j[6] = Math.max(1, q)),
        (j[7] = Math.max(1, G)),
        J.pendingExplosion)
      )
        ((j[8] = J.pendingExplosion.x),
          (j[9] = J.pendingExplosion.y),
          (j[13] = J.pendingExplosion.force),
          (J.pendingExplosion = null));
      else ((j[8] = 0), (j[9] = 0), (j[13] = 0));
      ((j[10] = isNaN(Q) ? 0.016 : Q),
        (j[11] = Math.max(0, Math.min(1, J.springK))),
        (j[12] = Math.max(0, Math.min(1, J.damping))),
        (j[14] = Math.max(0, Math.min(1, J.bounceDamping))),
        (j[16] = Math.max(1, J.maxVelocity)),
        (new Uint32Array(j.buffer)[15] = J.maxParticles),
        this.device.queue.writeBuffer(J.gpuUniformBuffer, 0, j),
        Z.setPipeline(this.computePipeline),
        Z.setBindGroup(0, J.computeBindGroup));
      let H = Math.ceil(J.maxParticles / 256);
      Z.dispatchWorkgroups(H);
    }
    recordRenderPass(Z, J) {
      if (!this.renderPipeline || !J.renderBindGroup) return;
      (Z.setPipeline(this.renderPipeline),
        Z.setBindGroup(0, J.renderBindGroup),
        Z.draw(6, J.maxParticles));
    }
    destroy() {
      ((this.computePipeline = null), (this.renderPipeline = null), (this.bindGroupLayout = null));
    }
  },
  h6 = class extends n {
    maxParticles;
    springK;
    damping;
    bounceDamping;
    maxVelocity;
    size;
    baseColor;
    pointerEvents;
    particleData;
    needsInit = !0;
    pendingExplosion = null;
    gpuStorageBuffer = null;
    gpuUniformBuffer = null;
    computeBindGroup = null;
    renderBindGroup = null;
    constructor(Z = {}) {
      super();
      ((this.maxParticles = Z.maxParticles ?? 1e4),
        (this.springK = Z.springK ?? 0.05),
        (this.damping = Z.damping ?? 0.95),
        (this.bounceDamping = Z.bounceDamping ?? 0.5),
        (this.maxVelocity = Z.maxVelocity ?? 500),
        (this.size = Z.size ?? 4),
        (this.baseColor = Z.color ?? "#00f0ff"),
        (this.pointerEvents = Z.pointerEvents ?? !1),
        (this.particleData = new Float32Array(this.maxParticles * 8)),
        (this.interactive = !0));
    }
    initRandomParticles(Z, J) {
      let Q = Math.max(1, Z),
        $ = Math.max(1, J);
      for (let K = 0; K < this.maxParticles; K++) {
        let q = K * 8,
          G = Math.random() * Q,
          j = Math.random() * $;
        ((this.particleData[q] = G),
          (this.particleData[q + 1] = j),
          (this.particleData[q + 2] = 0),
          (this.particleData[q + 3] = 0),
          (this.particleData[q + 4] = G),
          (this.particleData[q + 5] = j),
          (this.particleData[q + 6] = this.size),
          (this.particleData[q + 7] = -1));
      }
      this.needsInit = !1;
    }
    triggerExplosion(Z, J, Q) {
      this.pendingExplosion = { x: Z, y: J, force: Q };
    }
    isPointInside(Z, J) {
      return this.pointerEvents;
    }
    render(Z) {}
    updateCPU(Z, J, Q, $, K) {
      let q = isNaN(Z) ? 0.016 : Math.max(0, Math.min(Z, 0.1)),
        G = this.pendingExplosion,
        j = Math.max(1, $),
        F = Math.max(1, K),
        U = Math.max(0, Math.min(1, this.springK)),
        H = Math.max(0, Math.min(1, this.damping)),
        N = Math.max(0, Math.min(1, this.bounceDamping)),
        V = Math.max(1, this.maxVelocity);
      for (let B = 0; B < this.maxParticles; B++) {
        let O = B * 8,
          X = this.particleData[O],
          z = this.particleData[O + 1],
          I = this.particleData[O + 2],
          M = this.particleData[O + 3],
          D = this.particleData[O + 4],
          Y = this.particleData[O + 5],
          P = this.particleData[O + 7];
        if (isNaN(X)) X = D;
        if (isNaN(z)) z = Y;
        if (isNaN(I)) I = 0;
        if (isNaN(M)) M = 0;
        let R = (D - X) * U,
          w = (Y - z) * U,
          W = 0,
          L = 0;
        if (!isNaN(J) && !isNaN(Q) && J > -9000 && Q > -9000) {
          let y = J - X,
            u = Q - z,
            C = Math.hypot(y, u);
          if (C < 120 && C > 0.1) {
            let g = (120 - C) * 2;
            ((W = -(y / C) * g), (L = -(u / C) * g));
          }
        }
        let b = 0,
          k = 0;
        if (G) {
          let y = G.x - X,
            u = G.y - z,
            C = Math.hypot(y, u);
          if (C < 150 && C > 0.1) {
            let g = (150 - C) * G.force;
            ((b = -(y / C) * g), (k = -(u / C) * g));
          }
        }
        let p = R + W + b,
          c = w + L + k,
          T = (I + p * q) * H,
          A = (M + c * q) * H,
          f = Math.hypot(T, A);
        if (f > V) ((T = (T / f) * V), (A = (A / f) * V));
        let S = X + T * q,
          m = z + A * q;
        if (S <= 0 && T < 0) T = -T * N;
        else if (S >= j && T > 0) T = -T * N;
        if (m <= 0 && A < 0) A = -A * N;
        else if (m >= F && A > 0) A = -A * N;
        ((S = Math.max(0, Math.min(j, S))), (m = Math.max(0, Math.min(F, m))));
        let o = P;
        if (P >= 0) o = Math.max(0, P - q * 0.5);
        ((this.particleData[O] = S),
          (this.particleData[O + 1] = m),
          (this.particleData[O + 2] = T),
          (this.particleData[O + 3] = A),
          (this.particleData[O + 7] = o));
      }
      this.pendingExplosion = null;
    }
    destroy() {
      (this.destroyGPUResources(), super.destroy());
    }
    destroyGPUResources() {
      if (this.gpuStorageBuffer) {
        if (typeof this.gpuStorageBuffer.destroy === "function") this.gpuStorageBuffer.destroy();
        this.gpuStorageBuffer = null;
      }
      if (this.gpuUniformBuffer) {
        if (typeof this.gpuUniformBuffer.destroy === "function") this.gpuUniformBuffer.destroy();
        this.gpuUniformBuffer = null;
      }
      ((this.computeBindGroup = null), (this.renderBindGroup = null));
    }
  },
  p6 = 30,
  c6 = class {
    root;
    overlayRoot;
    renderer;
    isRunning = !1;
    lastTime = 0;
    canvas;
    renderMode = "always";
    dirty = !0;
    maxFPS = 0;
    respectReducedMotion = !0;
    reducedMotionQuery = null;
    a11ySyncInterval = 0;
    lastA11ySync = -1 / 0;
    a11yPendingSyncAfterAnimation = !1;
    a11yRoot;
    a11yElements = new Map();
    resizeHandler;
    focusedA11yElement = null;
    caretBlinkTimer = null;
    a11yNeedsReorder = !0;
    portalRoot = null;
    fullViewportElements = [];
    normalElements = [];
    activeIds = new Set();
    activePortalsThisFrame = new Set();
    activePortalsPrevFrame = new Set();
    portalEntities = new Map();
    renderOrderCounter = 0;
    pointRenderer = null;
    glCanvas = null;
    debugA11y;
    width;
    height;
    disableWindowResize = !1;
    destroyed = !1;
    device = null;
    deviceLost = !1;
    webgpuDisabled = !1;
    recoveryTimerId = null;
    manager = null;
    initializingWebGPU = !1;
    gpuCanvas = null;
    gpuContext = null;
    mouseX = -9999;
    mouseY = -9999;
    pointerMoveListener = null;
    pointerLeaveListener = null;
    constructor(Z, J = {}) {
      if (
        ((this.canvas = Z),
        (this.debugA11y = J.debugA11y ?? !1),
        (this.disableWindowResize = J.disableWindowResize ?? !1),
        this.disableWindowResize)
      )
        ((this.width = Z.width), (this.height = Z.height));
      else
        ((this.width = typeof window < "u" ? window.innerWidth : 800),
          (this.height = typeof window < "u" ? window.innerHeight : 600));
      if (
        ((this.maxFPS = J.maxFPS ?? 0),
        (this.respectReducedMotion = J.respectReducedMotion ?? !0),
        (this.a11ySyncInterval = J.a11ySyncInterval ?? 0),
        (this.reducedMotionQuery =
          typeof window < "u" && typeof window.matchMedia === "function"
            ? window.matchMedia("(prefers-reduced-motion: reduce)")
            : null),
        (this.root = new (class extends n {
          isPointInside() {
            return !1;
          }
          render($) {}
        })("root")),
        (this.root._scene = this),
        (this.overlayRoot = new (class extends n {
          isPointInside() {
            return !1;
          }
          render() {}
        })("overlayRoot")),
        (this.overlayRoot._scene = this),
        J.renderer)
      )
        this.renderer = J.renderer;
      else this.renderer = new L7(Z);
      if (typeof document < "u") {
        if (
          ((this.a11yRoot = document.createElement("div")),
          (this.a11yRoot.style.position = "absolute"),
          (this.a11yRoot.style.top = "0"),
          (this.a11yRoot.style.left = "0"),
          (this.a11yRoot.style.width = "100vw"),
          (this.a11yRoot.style.height = "100vh"),
          (this.a11yRoot.style.pointerEvents = "none"),
          (this.a11yRoot.style.overflow = "hidden"),
          (this.a11yRoot.style.zIndex = "10"),
          Z.parentElement)
        )
          Z.parentElement.appendChild(this.a11yRoot);
        if (
          ((this.portalRoot = document.createElement("div")),
          (this.portalRoot.style.position = "absolute"),
          (this.portalRoot.style.top = "0"),
          (this.portalRoot.style.left = "0"),
          (this.portalRoot.style.width = "100vw"),
          (this.portalRoot.style.height = "100vh"),
          (this.portalRoot.style.pointerEvents = "none"),
          (this.portalRoot.style.overflow = "hidden"),
          (this.portalRoot.style.zIndex = "9"),
          Z.parentElement)
        )
          Z.parentElement.appendChild(this.portalRoot);
      } else ((this.a11yRoot = null), (this.portalRoot = null));
      if (J.pointBackend === "webgl" && typeof document < "u") {
        let Q = document.createElement("canvas");
        if (
          ((Q.style.position = "absolute"),
          (Q.style.top = "0"),
          (Q.style.left = "0"),
          (Q.style.pointerEvents = "none"),
          (Q.style.zIndex = "5"),
          Z.parentElement)
        )
          Z.parentElement.appendChild(Q);
        let $ = b7(Q);
        if ($) ($.resize(this.width, this.height), (this.glCanvas = Q), (this.pointRenderer = $));
        else Q.remove();
      }
      ((this.resizeHandler = () => {
        this.resize(window.innerWidth, window.innerHeight);
      }),
        this.setupEvents());
    }
    getRenderer() {
      return this.renderer;
    }
    add(Z) {
      return (this.root.add(Z), this);
    }
    removeA11yRecursively(Z) {
      if (Z.isDOMPortal)
        (Z.domElement.remove(),
          this.portalEntities.delete(Z.id),
          this.activePortalsThisFrame.delete(Z.id),
          this.activePortalsPrevFrame.delete(Z.id));
      let J = this.a11yElements.get(Z.id);
      if (J) {
        if (J === this.focusedA11yElement) {
          if (((this.focusedA11yElement = null), this.caretBlinkTimer))
            (clearInterval(this.caretBlinkTimer), (this.caretBlinkTimer = null));
        }
        (J.remove(), this.a11yElements.delete(Z.id), (this.a11yNeedsReorder = !0));
      }
      for (let Q of Z.children) this.removeA11yRecursively(Q);
    }
    remove(Z) {
      return (this.root.remove(Z), this.removeA11yRecursively(Z), this);
    }
    detachA11y(Z) {
      this.removeA11yRecursively(Z);
    }
    showOverlay(Z) {
      (this.overlayRoot.add(Z), this.markDirty());
    }
    hideOverlay(Z) {
      (this.overlayRoot.remove(Z), this.removeA11yRecursively(Z), this.markDirty());
    }
    destroy() {
      if (((this.destroyed = !0), this.stop(), typeof window < "u" && !this.disableWindowResize))
        window.removeEventListener("resize", this.resizeHandler);
      if (
        typeof window < "u" &&
        this.canvas &&
        typeof this.canvas.removeEventListener === "function"
      ) {
        if (this.pointerMoveListener)
          this.canvas.removeEventListener("pointermove", this.pointerMoveListener);
        if (this.pointerLeaveListener)
          this.canvas.removeEventListener("pointerleave", this.pointerLeaveListener);
      }
      if (
        (this.a11yRoot?.remove(),
        this.portalRoot?.remove(),
        this.a11yElements.clear(),
        this.pointRenderer?.destroy(),
        this.glCanvas?.remove(),
        this.gpuCanvas?.remove(),
        (this.gpuCanvas = null),
        (this.gpuContext = null),
        this.recoveryTimerId)
      )
        (clearTimeout(this.recoveryTimerId), (this.recoveryTimerId = null));
      if (this.manager) (this.manager.destroy(), (this.manager = null));
    }
    setupEvents() {
      if (typeof window < "u" && !this.disableWindowResize)
        window.addEventListener("resize", this.resizeHandler);
      if (typeof window < "u" && this.canvas && typeof this.canvas.addEventListener === "function")
        ((this.pointerMoveListener = (Z) => {
          let J = this.canvas.getBoundingClientRect();
          ((this.mouseX = Z.clientX - J.left), (this.mouseY = Z.clientY - J.top));
        }),
          (this.pointerLeaveListener = () => {
            ((this.mouseX = -9999), (this.mouseY = -9999));
          }),
          this.canvas.addEventListener("pointermove", this.pointerMoveListener),
          this.canvas.addEventListener("pointerleave", this.pointerLeaveListener));
    }
    start() {
      if (this.isRunning) return;
      if (
        ((this.isRunning = !0),
        (this.lastTime = typeof performance < "u" ? performance.now() : 0),
        this.scheduleFrame(),
        (this.focusedA11yElement instanceof HTMLInputElement ||
          this.focusedA11yElement instanceof HTMLTextAreaElement) &&
          this.renderMode === "onDemand" &&
          !this.caretBlinkTimer)
      )
        this.caretBlinkTimer = setInterval(() => {
          this.markDirty();
        }, 500);
    }
    scheduleFrame() {
      if (typeof requestAnimationFrame < "u") requestAnimationFrame((Z) => this.loop(Z));
    }
    stop() {
      if (((this.isRunning = !1), this.caretBlinkTimer))
        (clearInterval(this.caretBlinkTimer), (this.caretBlinkTimer = null));
    }
    markDirty() {
      this.dirty = !0;
    }
    hasAnyPendingAnimation(Z) {
      if (Z.hasPendingAnimations()) return !0;
      for (let J of Z.children) if (this.hasAnyPendingAnimation(J)) return !0;
      return !1;
    }
    hasAnyInteractive(Z) {
      if (Z.interactive) return !0;
      for (let J of Z.children) if (this.hasAnyInteractive(J)) return !0;
      return !1;
    }
    syncA11y(Z) {
      if (!this.a11yRoot) return;
      if (Z.isDOMPortal) return;
      if (Z.interactive && (Z.width > 0 || Z.a11yFullViewport)) {
        let J = this.a11yElements.get(Z.id),
          Q = Z.getA11yAttributes(),
          $ = Q.tag || "div";
        if (J && J.tagName.toLowerCase() !== $.toLowerCase()) {
          if (J === this.focusedA11yElement) {
            if (((this.focusedA11yElement = null), this.caretBlinkTimer))
              (clearInterval(this.caretBlinkTimer), (this.caretBlinkTimer = null));
          }
          if (J.parentNode === this.a11yRoot) this.a11yRoot.removeChild(J);
          (this.a11yElements.delete(Z.id), (J = void 0), (this.a11yNeedsReorder = !0));
        }
        if (!J) {
          if (
            ((J = document.createElement($)),
            (J.id = Z.id),
            J.setAttribute("data-vecto-id", Z.id),
            (J.style.position = "absolute"),
            (J.style.pointerEvents = "auto"),
            (J.style.touchAction = "none"),
            (J.style.margin = "0"),
            (J.style.padding = "0"),
            (J.style.outline = "none"),
            (J.style.cursor = Z.a11yFullViewport ? "default" : "pointer"),
            this.debugA11y)
          )
            ((J.style.backgroundColor = "rgba(56, 189, 248, 0.05)"),
              (J.style.border = "1px dashed rgba(56, 189, 248, 0.4)"));
          else
            ((J.style.opacity = "0"),
              (J.style.border = "none"),
              (J.style.background = "transparent"));
          (J.addEventListener("click", (F) => {
            (console.log("[VectoA11y] click event on DOM element", Z.id),
              Z.dispatchEvent(new U0("click", Z, F)));
          }),
            J.addEventListener("mouseenter", (F) => {
              if (this.debugA11y) J.style.backgroundColor = "rgba(56, 189, 248, 0.2)";
              Z.dispatchEvent(new U0("hover", Z, F, !1));
            }),
            J.addEventListener("mouseleave", (F) => {
              if (this.debugA11y) J.style.backgroundColor = "rgba(56, 189, 248, 0.05)";
              Z.dispatchEvent(new U0("pointerleave", Z, F, !1));
            }));
          let K = J;
          if (
            (J.addEventListener("pointerdown", (F) => {
              if (
                (console.log("[VectoA11y] pointerdown event on DOM element", Z.id),
                typeof K.setPointerCapture === "function")
              )
                K.setPointerCapture(F.pointerId);
              Z.dispatchEvent(new U0("pointerdown", Z, F));
            }),
            J.addEventListener("pointerup", (F) => {
              if (
                (console.log("[VectoA11y] pointerup event on DOM element", Z.id),
                typeof K.releasePointerCapture === "function")
              )
                K.releasePointerCapture(F.pointerId);
              Z.dispatchEvent(new U0("pointerup", Z, F));
            }),
            J.addEventListener("pointermove", (F) => Z.dispatchEvent(new U0("pointermove", Z, F))),
            J.addEventListener(
              "wheel",
              (F) => {
                (console.log("[VectoA11y] wheel event on DOM element", Z.id, "deltaY:", F.deltaY),
                  Z.dispatchEvent(new U0("wheel", Z, F)));
              },
              { passive: !1 },
            ),
            J.addEventListener("keydown", (F) => {
              Z.dispatchEvent(new U0("keydown", Z, F));
            }),
            J.addEventListener("keyup", (F) => {
              Z.dispatchEvent(new U0("keyup", Z, F));
            }),
            J instanceof HTMLInputElement || J instanceof HTMLTextAreaElement)
          ) {
            let F = J,
              U = null,
              H = () => {
                ((F._lastSyncedValue = F.value),
                  Z.emit("change", {
                    value: F.value,
                    checked: F instanceof HTMLInputElement ? F.checked : void 0,
                    selectionStart: F.selectionStart ?? F.value.length,
                    selectionEnd: F.selectionEnd ?? F.value.length,
                    composition: U,
                  }));
              };
            (J.addEventListener("input", H),
              J.addEventListener("change", H),
              J.addEventListener("keyup", H),
              J.addEventListener("click", H),
              J.addEventListener("select", H),
              J.addEventListener("compositionstart", () => {
                ((U = { start: F.selectionStart ?? F.value.length, length: 0 }), H());
              }),
              J.addEventListener("compositionupdate", (N) => {
                let V = N.data ?? "";
                ((U = { start: U?.start ?? 0, length: V.length }), H());
              }),
              J.addEventListener("compositionend", () => {
                ((U = null), H());
              }));
          }
          let q = J instanceof HTMLInputElement || J instanceof HTMLTextAreaElement;
          (J.addEventListener("focus", () => {
            if (
              ((this.focusedA11yElement = J),
              Z.emit("focus", {}),
              q && this.renderMode === "onDemand" && this.isRunning && !this.caretBlinkTimer)
            )
              this.caretBlinkTimer = setInterval(() => {
                this.markDirty();
              }, 500);
          }),
            J.addEventListener("blur", () => {
              if (this.focusedA11yElement === J) this.focusedA11yElement = null;
              if (
                !(
                  this.focusedA11yElement instanceof HTMLInputElement ||
                  this.focusedA11yElement instanceof HTMLTextAreaElement
                ) &&
                this.caretBlinkTimer
              )
                (clearInterval(this.caretBlinkTimer), (this.caretBlinkTimer = null));
              Z.emit("blur", {});
            }));
          let G = new Set([
            "button",
            "switch",
            "checkbox",
            "radio",
            "link",
            "tab",
            "menuitem",
            "slider",
            "combobox",
          ]);
          if (
            !(
              J instanceof HTMLButtonElement ||
              J instanceof HTMLInputElement ||
              J instanceof HTMLSelectElement ||
              J instanceof HTMLTextAreaElement ||
              (J instanceof HTMLAnchorElement && J.hasAttribute("href"))
            ) &&
            Q.role &&
            G.has(Q.role)
          )
            (J.setAttribute("tabindex", "0"),
              J.addEventListener("keydown", (F) => {
                if (F.key === "Enter" || F.key === " ")
                  (F.preventDefault(), Z.dispatchEvent(new U0("click", Z, F)));
              }));
          if (Z.a11yFullViewport) this.a11yRoot.insertBefore(J, this.a11yRoot.firstChild);
          else this.a11yRoot.appendChild(J);
          (this.a11yElements.set(Z.id, J), (this.a11yNeedsReorder = !0));
        }
        if (Q.role !== void 0 && J.getAttribute("role") !== Q.role) J.setAttribute("role", Q.role);
        if (Q.label !== void 0 && J.getAttribute("aria-label") !== Q.label)
          J.setAttribute("aria-label", Q.label);
        if (Q.inputType !== void 0 && J.getAttribute("type") !== Q.inputType)
          J.setAttribute("type", Q.inputType);
        if (
          Q.placeholder !== void 0 &&
          (J instanceof HTMLInputElement || J instanceof HTMLTextAreaElement)
        ) {
          if (J.placeholder !== Q.placeholder) J.placeholder = Q.placeholder;
        }
        if (Q.href !== void 0 && J instanceof HTMLAnchorElement) {
          if (J.getAttribute("href") !== Q.href) J.setAttribute("href", Q.href);
        }
        if (J instanceof HTMLImageElement) {
          if (Q.src !== void 0 && J.src !== Q.src) J.src = Q.src;
          if (Q.alt !== void 0 && J.alt !== Q.alt) J.alt = Q.alt;
        }
        if (Q.checked !== void 0) {
          if (J instanceof HTMLInputElement) {
            if (J.checked !== Q.checked) J.checked = Q.checked;
          } else if (J.getAttribute("aria-checked") !== String(Q.checked))
            J.setAttribute("aria-checked", String(Q.checked));
        }
        if (Q.disabled !== void 0) {
          if ("disabled" in J) {
            if (J.disabled !== Q.disabled) J.disabled = Q.disabled;
          } else if (J.getAttribute("aria-disabled") !== String(Q.disabled))
            J.setAttribute("aria-disabled", String(Q.disabled));
        }
        if (Q.expanded !== void 0 && J.getAttribute("aria-expanded") !== String(Q.expanded))
          J.setAttribute("aria-expanded", String(Q.expanded));
        if (Q.controls !== void 0 && J.getAttribute("aria-controls") !== Q.controls)
          J.setAttribute("aria-controls", Q.controls);
        if (Q.haspopup !== void 0 && J.getAttribute("aria-haspopup") !== Q.haspopup)
          J.setAttribute("aria-haspopup", Q.haspopup);
        if (Q.selected !== void 0 && J.getAttribute("aria-selected") !== String(Q.selected))
          J.setAttribute("aria-selected", String(Q.selected));
        if (
          Q.activedescendant !== void 0 &&
          J.getAttribute("aria-activedescendant") !== Q.activedescendant
        )
          J.setAttribute("aria-activedescendant", Q.activedescendant);
        if (Q.valuemin !== void 0 && J.getAttribute("aria-valuemin") !== Q.valuemin)
          J.setAttribute("aria-valuemin", Q.valuemin);
        if (Q.valuemax !== void 0 && J.getAttribute("aria-valuemax") !== Q.valuemax)
          J.setAttribute("aria-valuemax", Q.valuemax);
        if (Q.value !== void 0) {
          if (J instanceof HTMLInputElement || J instanceof HTMLTextAreaElement) {
            if (J.value !== Q.value) {
              let K = J._lastSyncedValue;
              if (Q.value !== K || document.activeElement !== J)
                ((J.value = Q.value), (J._lastSyncedValue = Q.value));
            }
          } else if (J.getAttribute("aria-valuenow") !== Q.value)
            J.setAttribute("aria-valuenow", Q.value);
        }
        if (Z.a11yFullViewport)
          ((J.style.left = "0px"),
            (J.style.top = "0px"),
            (J.style.width = `${this.width}px`),
            (J.style.height = `${this.height}px`),
            (J.style.transform = ""));
        else {
          let K = Z.getGlobalPosition();
          ((J.style.left = `${K.x + Z.a11yOffsetX}px`),
            (J.style.top = `${K.y + Z.a11yOffsetY}px`),
            (J.style.width = `${Z.width * Z.scaleX}px`),
            (J.style.height = `${Z.height * Z.scaleY}px`),
            (J.style.transform = `rotate(${Z.rotation}rad)`));
        }
      }
      for (let J of Z.children) this.syncA11y(J);
      if (Z === this.root) for (let J of this.overlayRoot.children) this.syncA11y(J);
    }
    enforceA11yDomOrder() {
      if (!this.a11yRoot) return;
      ((this.fullViewportElements.length = 0),
        (this.normalElements.length = 0),
        this.activeIds.clear());
      let Z = (q) => {
        if (q.isDOMPortal) return;
        if (q.interactive && (q.width > 0 || q.a11yFullViewport)) {
          let G = this.a11yElements.get(q.id);
          if (G)
            if ((this.activeIds.add(q.id), q.a11yFullViewport)) this.fullViewportElements.push(G);
            else this.normalElements.push(G);
        }
        for (let G of q.children) Z(G);
        if (q === this.root) for (let G of this.overlayRoot.children) Z(G);
      };
      Z(this.root);
      let J = !1;
      for (let [q, G] of this.a11yElements.entries())
        if (!this.activeIds.has(q)) {
          if (((J = !0), G === this.focusedA11yElement)) {
            if (((this.focusedA11yElement = null), this.caretBlinkTimer))
              (clearInterval(this.caretBlinkTimer), (this.caretBlinkTimer = null));
          }
          if (G.parentNode === this.a11yRoot) this.a11yRoot.removeChild(G);
          this.a11yElements.delete(q);
        }
      if (J) this.a11yNeedsReorder = !0;
      if (!this.a11yNeedsReorder) return;
      let Q = this.fullViewportElements.length,
        $ = this.normalElements.length,
        K = Q + $;
      for (let q = 0; q < K; q++) {
        let G = q < Q ? this.fullViewportElements[q] : this.normalElements[q - Q],
          j = this.a11yRoot.childNodes[q];
        if (j !== G) this.a11yRoot.insertBefore(G, j || null);
      }
      this.a11yNeedsReorder = !1;
    }
    getA11yTree() {
      let Z = new Map(),
        J = [],
        Q = ($, K) => {
          if ($.isDOMPortal) return;
          let q = null;
          if ($.interactive && ($.width > 0 || $.a11yFullViewport)) {
            let G = this.a11yElements.get($.id);
            if (G) {
              let j = $.getA11yAttributes();
              ((q = {
                id: $.id,
                tag: G.tagName.toLowerCase(),
                role: G.getAttribute("role") || void 0,
                label: G.getAttribute("aria-label") || void 0,
                value: j.value,
                checked: j.checked,
                expanded: j.expanded,
                valuemin: j.valuemin,
                valuemax: j.valuemax,
                children: [],
              }),
                Z.set($.id, q));
              let F = K ? Z.get(K.id) : null;
              if (F) F.children.push(q);
              else J.push(q);
            }
          }
          for (let G of $.children) Q(G, q ? $ : K);
          if ($ === this.root) for (let G of this.overlayRoot.children) Q(G, q ? $ : K);
        };
      return (Q(this.root, null), J);
    }
    renderPortalDOM(Z, J, Q, $, K, q, G) {
      if (!this.portalRoot) return;
      if (
        (this.activePortalsThisFrame.add(Z.id),
        this.portalEntities.set(Z.id, Z),
        Z.domElement.parentElement !== this.portalRoot)
      )
        this.portalRoot.appendChild(Z.domElement);
      if (!Z.domElement.hasAttribute("data-vecto-id"))
        Z.domElement.setAttribute("data-vecto-id", Z.id);
      let j = `matrix(${$}, ${K}, ${q}, ${G}, ${J}, ${Q})`,
        F = "",
        U = "";
      if (Z.width > 0) F = `${Z.width}px`;
      if (Z.height > 0) U = `${Z.height}px`;
      let H = String(this.renderOrderCounter++);
      if (Z.lastWidth !== F) ((Z.domElement.style.width = F), (Z.lastWidth = F));
      if (Z.lastHeight !== U) ((Z.domElement.style.height = U), (Z.lastHeight = U));
      if (Z.lastTransform !== j)
        ((Z.domElement.style.left = "0px"),
          (Z.domElement.style.top = "0px"),
          (Z.domElement.style.transform = j),
          (Z.lastTransform = j));
      if (Z.lastZIndex !== H) ((Z.domElement.style.zIndex = H), (Z.lastZIndex = H));
    }
    reconcilePortals() {
      if (!this.portalRoot) return;
      for (let Z of this.activePortalsPrevFrame)
        if (!this.activePortalsThisFrame.has(Z)) {
          let J = this.portalEntities.get(Z);
          if (J) {
            if (J.domElement.parentElement === this.portalRoot && (!J.scene || J.scene === this))
              J.domElement.remove();
            this.portalEntities.delete(Z);
          }
        }
      ((this.activePortalsPrevFrame = new Set(this.activePortalsThisFrame)),
        this.activePortalsThisFrame.clear());
    }
    effectiveMaxFPS() {
      if (this.respectReducedMotion && !!this.reducedMotionQuery?.matches)
        return this.maxFPS > 0 ? Math.min(this.maxFPS, p6) : p6;
      return this.maxFPS;
    }
    loop(Z) {
      if (!this.isRunning) return;
      let J = this.effectiveMaxFPS();
      if (J > 0 && Z - this.lastTime < 1000 / J - 1) {
        this.scheduleFrame();
        return;
      }
      let Q = Z - this.lastTime;
      if (
        ((this.lastTime = Z),
        this.renderMode === "onDemand" &&
          !this.dirty &&
          !this.hasAnyPendingAnimation(this.root) &&
          !this.hasAnyPendingAnimation(this.overlayRoot))
      ) {
        this.scheduleFrame();
        return;
      }
      if (
        (this.render(this.renderer, Q, Z),
        this.hasAnyPendingAnimation(this.root) || this.hasAnyPendingAnimation(this.overlayRoot))
      )
        this.a11yPendingSyncAfterAnimation = !0;
      else {
        let K = this.hasAnyInteractive(this.root) || this.hasAnyInteractive(this.overlayRoot),
          q = this.a11ySyncInterval <= 0 || Z - this.lastA11ySync >= this.a11ySyncInterval;
        if ((K || this.a11yElements.size > 0) && (q || this.a11yPendingSyncAfterAnimation)) {
          if (((this.lastA11ySync = Z), K)) this.syncA11y(this.root);
          (this.enforceA11yDomOrder(), (this.a11yPendingSyncAfterAnimation = !1));
        }
      }
      ((this.dirty = !1), this.scheduleFrame());
    }
    render(Z, J = 0, Q = 0) {
      if (this.a11yRoot && this.canvas.parentElement) {
        let U = this.canvas.parentElement.style;
        if (!U.position || U.position === "static") U.position = "relative";
      }
      ((this.renderOrderCounter = 0), this.activePortalsThisFrame.clear());
      let $ = [],
        K = (U) => {
          if (U instanceof h6) $.push(U);
          for (let H of U.children) K(H);
        };
      K(this.root);
      for (let U of this.overlayRoot.children) K(U);
      if ($.length > 0) {
        if (!this.device && !this.webgpuDisabled && !this.initializingWebGPU && !this.deviceLost)
          ((this.initializingWebGPU = !0),
            this.initWebGPUContext($)
              .then((U) => {
                ((this.device = U), (this.initializingWebGPU = !1));
                let H = navigator.gpu ? navigator.gpu.getPreferredCanvasFormat() : "rgba8unorm";
                ((this.manager = new g6(U)), this.manager.initPipelines(H));
                for (let N of $)
                  if ((this.manager.setupEntityResources(N), N.gpuStorageBuffer))
                    U.queue.writeBuffer(N.gpuStorageBuffer, 0, N.particleData);
              })
              .catch((U) => {
                (console.error("Failed to initialize WebGPU:", U),
                  (this.webgpuDisabled = !0),
                  (this.initializingWebGPU = !1));
              }));
        if (this.device && this.manager && !this.deviceLost && !this.webgpuDisabled)
          try {
            let U = this.device.createCommandEncoder(),
              H = U.beginComputePass();
            for (let N of $) {
              if (!N.gpuStorageBuffer)
                (this.manager.setupEntityResources(N),
                  this.device.queue.writeBuffer(N.gpuStorageBuffer, 0, N.particleData));
              this.manager.recordComputePass(
                H,
                N,
                J / 1000,
                this.mouseX,
                this.mouseY,
                this.width,
                this.height,
              );
            }
            if ((H.end(), this.gpuContext)) {
              let V = {
                  colorAttachments: [
                    {
                      view: this.gpuContext.getCurrentTexture().createView(),
                      clearValue: { r: 0, g: 0, b: 0, a: 0 },
                      loadOp: "clear",
                      storeOp: "store",
                    },
                  ],
                },
                B = U.beginRenderPass(V);
              for (let O of $) this.manager.recordRenderPass(B, O);
              B.end();
            }
            this.device.queue.submit([U.finish()]);
          } catch (U) {
            (console.error("WebGPU frame execution failed. Falling back.", U),
              (this.deviceLost = !0),
              (this.device = null),
              this.recreateWebGPUDeviceWithRetry($));
          }
        else
          for (let U of $) U.updateCPU(J / 1000, this.mouseX, this.mouseY, this.width, this.height);
      }
      Z.clear();
      let q = Z === this.renderer;
      if (q) this.pointRenderer?.begin();
      let G = this.width,
        j = this.height,
        F = (U, H, N, V, B, O, X) => {
          U.update(J, Q);
          let z = Math.cos(U.rotation),
            I = Math.sin(U.rotation),
            M = H * U.x + V * U.y + O,
            D = N * U.x + B * U.y + X,
            Y = U.scaleX * z,
            P = U.scaleX * I,
            R = U.scaleY * z,
            w = U.scaleY * I,
            W = H * Y + V * P,
            L = N * Y + B * P,
            b = H * -w + V * R,
            k = N * -w + B * R,
            p = this.a11yElements.get(U.id);
          if (p) p.style.zIndex = String(this.renderOrderCounter++);
          if (U.isDOMPortal) {
            this.renderPortalDOM(U, M, D, W, L, b, k);
            return;
          }
          let c = !0,
            T = U.getBounds();
          if (T) {
            let A = 1 / 0,
              f = 1 / 0,
              S = -1 / 0,
              m = -1 / 0;
            for (let o = 0; o < 4; o++) {
              let y = o & 1 ? T.x + T.width : T.x,
                u = o & 2 ? T.y + T.height : T.y,
                C = W * y + b * u + M,
                g = L * y + k * u + D;
              if (C < A) A = C;
              if (C > S) S = C;
              if (g < f) f = g;
              if (g > m) m = g;
            }
            c = S >= 0 && A <= G && m >= 0 && f <= j;
          }
          if (!c && U.children.length === 0) return;
          if (U.children.length === 0 && U.scaleX === U.scaleY) {
            let A = U.getBatchCircle();
            if (A) {
              if (c)
                if (q && this.pointRenderer)
                  this.pointRenderer.addCircle(
                    M,
                    D,
                    A.radius * Math.hypot(W, L),
                    A.color,
                    U.opacity,
                  );
                else Z.fillCircle(U.x, U.y, A.radius * U.scaleX, A.color, U.opacity);
              return;
            }
            if (q && this.pointRenderer) {
              let f = U.getBatchRect();
              if (f) {
                if (c) {
                  let S = Math.hypot(W, L);
                  this.pointRenderer.addRect(
                    M,
                    D,
                    f.width * S,
                    f.height * S,
                    f.color,
                    U.opacity,
                    Math.atan2(L, W),
                  );
                }
                return;
              }
            }
          }
          if (
            (Z.flush(),
            Z.save(),
            Z.translate(U.x, U.y),
            Z.scale(U.scaleX, U.scaleY),
            Z.rotate(U.rotation),
            Z.setGlobalAlpha(U.opacity),
            c)
          )
            if (U instanceof h6) {
              if (this.deviceLost || this.webgpuDisabled || !this.device || !this.manager)
                this.renderCPUParticles(Z, U);
            } else U.render(Z);
          if (U.clipChildren) Z.clip(0, 0, U.width, U.height);
          for (let A of U.children) F(A, W, L, b, k, M, D);
          (Z.flush(), Z.restore());
        };
      F(this.root, 1, 0, 0, 1, 0, 0);
      for (let U of this.overlayRoot.children) F(U, 1, 0, 0, 1, 0, 0);
      if ((this.reconcilePortals(), Z.flush(), q)) this.pointRenderer?.flush();
    }
    toSVG() {
      let Z = new A7(this.width, this.height);
      return (this.render(Z, 0, 0), Z.toXMLString());
    }
    resize(Z, J) {
      if (((this.width = Z), (this.height = J), typeof this.renderer.resize === "function"))
        this.renderer.resize(Z, J);
      (this.pointRenderer?.resize(Z, J), this.markDirty());
    }
    getA11yElement(Z) {
      return this.a11yElements.get(Z);
    }
    getRoot() {
      return this.root;
    }
    findEntityAt(Z, J) {
      let Q = this.findHitRecursively(this.overlayRoot, Z, J);
      if (Q) return Q;
      return this.findHitRecursively(this.root, Z, J);
    }
    async initWebGPUContext(Z) {
      if (!navigator.gpu) throw Error("WebGPU not supported on this platform.");
      let J = await navigator.gpu.requestAdapter();
      if (!J) throw Error("No GPUAdapter found.");
      let Q = await J.requestDevice();
      if (typeof document < "u" && !this.gpuCanvas) {
        let $ = document.createElement("canvas");
        if (
          (($.width = this.width),
          ($.height = this.height),
          ($.style.position = "absolute"),
          ($.style.top = "0"),
          ($.style.left = "0"),
          ($.style.pointerEvents = "none"),
          ($.style.zIndex = "6"),
          this.canvas.parentElement)
        )
          this.canvas.parentElement.appendChild($);
        ((this.gpuCanvas = $), (this.gpuContext = $.getContext("webgpu")));
      }
      if (this.gpuContext)
        this.gpuContext.configure({
          device: Q,
          format: navigator.gpu.getPreferredCanvasFormat(),
          alphaMode: "premultiplied",
        });
      return (this.setupDeviceLostHandler(Q, Z), Q);
    }
    setupDeviceLostHandler(Z, J) {
      Z.lost.then((Q) => {
        if (Q.reason === "destroyed") return;
        (console.warn(`WebGPU device lost: ${Q.message}`),
          (this.deviceLost = !0),
          (this.device = null),
          this.recreateWebGPUDeviceWithRetry(J));
      });
    }
    recreateWebGPUDeviceWithRetry(Z, J = 0) {
      if (this.destroyed) return;
      if (J >= 3) {
        (console.error(
          "Failed to recover WebGPU device after 3 retries. Remaining on fallback renderer.",
        ),
          (this.webgpuDisabled = !0),
          (this.deviceLost = !0));
        return;
      }
      for (let $ of Z) $.destroyGPUResources();
      if (this.manager) (this.manager.destroy(), (this.manager = null));
      let Q = Math.pow(2, J) * 1000;
      if (this.recoveryTimerId) clearTimeout(this.recoveryTimerId);
      this.recoveryTimerId = setTimeout(() => {
        if (this.destroyed) return;
        this.initWebGPUContext(Z)
          .then(($) => {
            if (this.destroyed) {
              $.destroy();
              return;
            }
            (console.log("Successfully recovered WebGPU device."),
              (this.device = $),
              (this.deviceLost = !1));
            let K = navigator.gpu.getPreferredCanvasFormat();
            ((this.manager = new g6($)), this.manager.initPipelines(K));
            for (let q of Z)
              (this.manager.setupEntityResources(q),
                $.queue.writeBuffer(q.gpuStorageBuffer, 0, q.particleData));
          })
          .catch(() => this.recreateWebGPUDeviceWithRetry(Z, J + 1));
      }, Q);
    }
    renderCPUParticles(Z, J) {
      let { particleData: Q, maxParticles: $ } = J,
        K = Z === this.renderer;
      for (let q = 0; q < $; q++) {
        let G = q * 8,
          j = Q[G],
          F = Q[G + 1],
          U = Q[G + 6],
          H = Q[G + 7];
        if (H === 0) continue;
        let N = H < 0 ? J.opacity : J.opacity * Math.min(1, H),
          V = H >= 0 ? Math.min(1, H) : 1;
        if (K && this.pointRenderer) this.pointRenderer.addCircle(j, F, U * V, J.baseColor, N);
        else Z.fillCircle(j, F, U * V, J.baseColor, N);
      }
    }
    findHitRecursively(Z, J, Q) {
      for (let $ = Z.children.length - 1; $ >= 0; $--) {
        let K = this.findHitRecursively(Z.children[$], J, Q);
        if (K) return K;
      }
      if (Z.isPointInside && Z.isPointInside(J, Q)) return Z;
      return null;
    }
  };
var f8 = class Z {
  static CAPACITY = 16384;
  xs = new Float32Array(Z.CAPACITY);
  ys = new Float32Array(Z.CAPACITY);
  ws = new Float32Array(Z.CAPACITY);
  hs = new Float32Array(Z.CAPACITY);
  chars = Array.from({ length: Z.CAPACITY });
  count = 0;
  reset() {
    this.count = 0;
  }
  toLayoutResult() {
    let J = [];
    for (let Q = 0; Q < this.count; Q++)
      J.push({
        char: this.chars[Q],
        x: this.xs[Q],
        y: this.ys[Q],
        width: this.ws[Q],
        height: this.hs[Q],
      });
    return { nodes: J, totalWidth: 0, totalHeight: 0 };
  }
};
class t0 {
  id;
  children = [];
  parent = null;
  get scene() {
    if (this._scene) return this._scene;
    return this.parent ? this.parent.scene : null;
  }
  x = 0;
  y = 0;
  scaleX = 1;
  scaleY = 1;
  rotation = 0;
  opacity = 1;
  isDOMPortal = !1;
  _interactive = !1;
  get interactive() {
    return this._interactive;
  }
  set interactive(Z) {
    if (this._interactive !== Z) {
      this._interactive = Z;
      let J = this.scene;
      if (J) ((J.a11yNeedsReorder = !0), J.markDirty());
    }
  }
  width = 0;
  height = 0;
  a11yOffsetX = 0;
  a11yOffsetY = 0;
  a11yFullViewport = !1;
  clipChildren = !1;
  listeners = new Map();
  captureListeners = new Map();
  animations = [];
  constructor(Z) {
    this.id = Z || `entity_${Math.random().toString(36).substring(2, 9)}`;
  }
  add(Z) {
    ((Z.parent = this), this.children.push(Z));
    let J = this.scene;
    if (J) ((J.a11yNeedsReorder = !0), J.markDirty());
    return this;
  }
  remove(Z) {
    let J = this.children.indexOf(Z);
    if (J !== -1) {
      (this.children.splice(J, 1), (Z.parent = null));
      let Q = this.scene;
      if (Q) ((Q.a11yNeedsReorder = !0), Q.markDirty());
    }
    return this;
  }
  setPosition(Z, J) {
    return ((this.x = Z), (this.y = J), this);
  }
  animate(Z, J) {
    return (this.animations.push({ target: Z, duration: J, startTime: -1, startProps: {} }), this);
  }
  update(Z, J) {
    if (this.animations.length > 0) {
      let Q = this.animations[0];
      if (Q.startTime === -1) {
        Q.startTime = J;
        for (let K in Q.target) Q.startProps[K] = this[K];
      }
      let $ = Math.min((J - Q.startTime) / Q.duration, 1);
      for (let K in Q.target) {
        let q = Q.startProps[K],
          G = Q.target[K];
        if (typeof q === "number" && typeof G === "number") {
          let j = $ * (2 - $);
          this[K] = q + (G - q) * j;
        }
      }
      if ($ >= 1) this.animations.shift();
    }
  }
  on(Z, J, Q) {
    let $ = Q?.capture ? this.captureListeners : this.listeners;
    if (!$.has(Z)) $.set(Z, []);
    return ($.get(Z).push(J), this);
  }
  off(Z, J, Q) {
    let $ = (Q?.capture ? this.captureListeners : this.listeners).get(Z);
    if ($) {
      let K = $.indexOf(J);
      if (K !== -1) $.splice(K, 1);
    }
    return this;
  }
  destroy() {
    if (
      ((this.animations = []), this.listeners.clear(), this.captureListeners.clear(), this.parent)
    )
      this.parent.remove(this);
  }
  emit(Z, J) {
    let Q = this.listeners.get(Z);
    if (Q) Q.forEach(($) => $(J));
  }
  fireListeners(Z, J, Q) {
    let $ = J.get(Q.type);
    if (!$) return;
    Q.currentTarget = Z;
    for (let K of $.slice()) if ((K(Q), Q.immediatePropagationStopped)) return;
  }
  dispatchEvent(Z) {
    let J = [];
    for (let Q = Z.target; Q; Q = Q.parent) J.push(Q);
    for (let Q = J.length - 1; Q >= 0; Q--) {
      if (Z.propagationStopped) return;
      this.fireListeners(J[Q], J[Q].captureListeners, Z);
    }
    for (let Q = 0; Q < J.length; Q++) {
      if (Z.propagationStopped) return;
      if ((this.fireListeners(J[Q], J[Q].listeners, Z), !Z.bubbles)) return;
    }
  }
  getGlobalPosition() {
    let Z = this.x,
      J = this.y,
      Q = this.parent;
    while (Q && Q.id !== "root") {
      let $ = Math.cos(Q.rotation),
        K = Math.sin(Q.rotation),
        q = Z * $ - J * K,
        G = Z * K + J * $;
      ((Z = Q.x + Q.scaleX * q), (J = Q.y + Q.scaleY * G), (Q = Q.parent));
    }
    return { x: Z, y: J };
  }
  getWorldScale() {
    let Z = this.scaleX,
      J = this.scaleY,
      Q = this.parent;
    while (Q && Q.id !== "root") ((Z *= Q.scaleX), (J *= Q.scaleY), (Q = Q.parent));
    return { x: Z, y: J };
  }
  getWorldRotation() {
    let Z = this.rotation,
      J = this.parent;
    while (J && J.id !== "root") ((Z += J.rotation), (J = J.parent));
    return Z;
  }
  getA11yAttributes() {
    return {};
  }
  getBounds() {
    return null;
  }
  getBatchCircle() {
    return null;
  }
  getBatchRect() {
    return null;
  }
  hasPendingAnimations() {
    return this.animations.length > 0;
  }
}
class l {
  static MAPPINGS = {
    1569: { isolated: 65152, initial: 65152, medial: 65152, final: 65152, joining: "U" },
    1570: { isolated: 65153, initial: 65153, medial: 65154, final: 65154, joining: "R" },
    1571: { isolated: 65155, initial: 65155, medial: 65156, final: 65156, joining: "R" },
    1572: { isolated: 65157, initial: 65157, medial: 65158, final: 65158, joining: "R" },
    1573: { isolated: 65159, initial: 65159, medial: 65160, final: 65160, joining: "R" },
    1574: { isolated: 65161, initial: 65163, medial: 65164, final: 65162, joining: "D" },
    1575: { isolated: 65165, initial: 65165, medial: 65166, final: 65166, joining: "R" },
    1576: { isolated: 65167, initial: 65169, medial: 65170, final: 65168, joining: "D" },
    1577: { isolated: 65171, initial: 65171, medial: 65172, final: 65172, joining: "R" },
    1578: { isolated: 65173, initial: 65175, medial: 65176, final: 65174, joining: "D" },
    1579: { isolated: 65177, initial: 65179, medial: 65180, final: 65178, joining: "D" },
    1580: { isolated: 65181, initial: 65183, medial: 65184, final: 65182, joining: "D" },
    1581: { isolated: 65185, initial: 65187, medial: 65188, final: 65186, joining: "D" },
    1582: { isolated: 65189, initial: 65191, medial: 65192, final: 65190, joining: "D" },
    1583: { isolated: 65193, initial: 65193, medial: 65194, final: 65194, joining: "R" },
    1584: { isolated: 65195, initial: 65195, medial: 65196, final: 65196, joining: "R" },
    1585: { isolated: 65197, initial: 65197, medial: 65198, final: 65198, joining: "R" },
    1586: { isolated: 65199, initial: 65199, medial: 65200, final: 65200, joining: "R" },
    1587: { isolated: 65201, initial: 65203, medial: 65204, final: 65202, joining: "D" },
    1588: { isolated: 65205, initial: 65207, medial: 65208, final: 65206, joining: "D" },
    1589: { isolated: 65209, initial: 65211, medial: 65212, final: 65210, joining: "D" },
    1590: { isolated: 65213, initial: 65215, medial: 65216, final: 65214, joining: "D" },
    1591: { isolated: 65217, initial: 65219, medial: 65220, final: 65218, joining: "D" },
    1592: { isolated: 65221, initial: 65223, medial: 65224, final: 65222, joining: "D" },
    1593: { isolated: 65225, initial: 65227, medial: 65228, final: 65226, joining: "D" },
    1594: { isolated: 65229, initial: 65231, medial: 65232, final: 65230, joining: "D" },
    1601: { isolated: 65233, initial: 65235, medial: 65236, final: 65234, joining: "D" },
    1602: { isolated: 65237, initial: 65239, medial: 65240, final: 65238, joining: "D" },
    1603: { isolated: 65241, initial: 65243, medial: 65244, final: 65242, joining: "D" },
    1604: { isolated: 65245, initial: 65247, medial: 65248, final: 65246, joining: "D" },
    1605: { isolated: 65249, initial: 65251, medial: 65252, final: 65250, joining: "D" },
    1606: { isolated: 65253, initial: 65255, medial: 65256, final: 65254, joining: "D" },
    1607: { isolated: 65257, initial: 65259, medial: 65260, final: 65258, joining: "D" },
    1608: { isolated: 65261, initial: 65261, medial: 65262, final: 65262, joining: "R" },
    1609: { isolated: 65263, initial: 65263, medial: 65264, final: 65264, joining: "R" },
    1610: { isolated: 65265, initial: 65267, medial: 65268, final: 65266, joining: "D" },
    1662: { isolated: 64342, initial: 64344, medial: 64345, final: 64343, joining: "D" },
    1670: { isolated: 64378, initial: 64380, medial: 64381, final: 64379, joining: "D" },
    1705: { isolated: 64398, initial: 64400, medial: 64401, final: 64399, joining: "D" },
    1729: { isolated: 64422, initial: 64424, medial: 64425, final: 64423, joining: "D" },
    1740: { isolated: 64509, initial: 64511, medial: 64512, final: 64510, joining: "D" },
  };
  static isHarakat(Z) {
    return (Z >= 1611 && Z <= 1631) || Z === 1648;
  }
  static getJoiningType(Z) {
    let J = l.MAPPINGS[Z];
    return J ? J.joining : "U";
  }
  static shapeArabic(Z) {
    let J = Z.length,
      Q = [],
      $ = [],
      K = 0;
    while (K < J) {
      let q = Z.charCodeAt(K);
      if (q === 1604 && K + 1 < J) {
        let O = Z.charCodeAt(K + 1),
          X = 0;
        if (O === 1570) X = 65269;
        else if (O === 1571) X = 65271;
        else if (O === 1573) X = 65273;
        else if (O === 1575) X = 65275;
        if (X !== 0) {
          (Q.push(String.fromCharCode(X)), $.push(K), (K += 2));
          continue;
        }
      }
      if (l.isHarakat(q)) {
        (Q.push(Z[K]), $.push(K), K++);
        continue;
      }
      let G = l.MAPPINGS[q];
      if (!G) {
        (Q.push(Z[K]), $.push(K), K++);
        continue;
      }
      let j = 0,
        F = K - 1;
      while (F >= 0) {
        let O = Z.charCodeAt(F);
        if (!l.isHarakat(O)) {
          j = O;
          break;
        }
        F--;
      }
      let U = 0,
        H = K + 1;
      while (H < J) {
        let O = Z.charCodeAt(H);
        if (!l.isHarakat(O)) {
          U = O;
          break;
        }
        H++;
      }
      let N = j !== 0 && l.getJoiningType(j) === "D" && (G.joining === "D" || G.joining === "R"),
        V =
          U !== 0 &&
          G.joining === "D" &&
          (l.getJoiningType(U) === "D" || l.getJoiningType(U) === "R"),
        B = G.isolated;
      if (N && V) B = G.medial;
      else if (N) B = G.final;
      else if (V) B = G.initial;
      (Q.push(String.fromCharCode(B)), $.push(K), K++);
    }
    return { shapedText: Q.join(""), indexMap: new Int32Array($) };
  }
}
class O0 {
  static getDirectionClass(Z) {
    if ((Z >= 1424 && Z <= 1535) || (Z >= 64285 && Z <= 64335)) return "R";
    if (
      (Z >= 1536 && Z <= 1791) ||
      (Z >= 1872 && Z <= 1919) ||
      (Z >= 2208 && Z <= 2303) ||
      (Z >= 64336 && Z <= 65023) ||
      (Z >= 65136 && Z <= 65279)
    ) {
      if (Z === 1548 || Z === 1563 || Z === 1567) return "ON";
      return "AL";
    }
    if (Z >= 48 && Z <= 57) return "EN";
    if (Z >= 1632 && Z <= 1641) return "AN";
    if (Z === 32 || Z === 9 || Z === 160) return "WS";
    if (Z >= 8192 && Z <= 8303) return "ON";
    if (
      (Z >= 33 && Z <= 47) ||
      (Z >= 58 && Z <= 64) ||
      (Z >= 91 && Z <= 96) ||
      (Z >= 123 && Z <= 126)
    )
      return "ON";
    return "L";
  }
  static getBaseLevel(Z) {
    let J = Z.length;
    for (let Q = 0; Q < J; Q++) {
      let $ = O0.getDirectionClass(Z.charCodeAt(Q));
      if ($ === "L") return 0;
      if ($ === "R" || $ === "AL") return 1;
    }
    return 0;
  }
  static resolveLevels(Z) {
    let J = Z.length,
      Q = [];
    for (let j = 0; j < J; j++) Q.push(O0.getDirectionClass(Z.charCodeAt(j)));
    let $ = 0;
    for (let j = 0; j < J; j++) {
      let F = Q[j];
      if (F === "L") {
        $ = 0;
        break;
      } else if (F === "R" || F === "AL") {
        $ = 1;
        break;
      }
    }
    let K = new Uint8Array(J);
    K.fill($);
    let q = [$],
      G = 0;
    for (let j = 0; j < J; j++) {
      let F = Z.charCodeAt(j),
        U = F === 8234,
        H = F === 8235,
        N = F === 8236;
      if (U || H) {
        let V = q[q.length - 1],
          B = Math.min(125, H ? (V + 1) | 1 : (V + 2) & -2);
        if (q.length >= 125) G++;
        else q.push(B);
      } else if (N) {
        if (G > 0) G--;
        else if (q.length > 1) q.pop();
      } else {
        let V = q[q.length - 1],
          B = Q[j],
          O = V;
        if (B === "L") O = V % 2 === 1 ? V + 1 : V;
        else if (B === "R" || B === "AL") O = V % 2 === 0 ? V + 1 : V;
        else if (B === "EN" || B === "AN") O = V % 2 === 1 ? V + 1 : V;
        K[j] = Math.min(125, O);
      }
    }
    return K;
  }
  static reorderVisual(Z, J) {
    let Q = Z.length;
    if (Q === 0) return;
    let $ = Q - 1;
    while ($ >= 0) {
      let q = Z[$],
        G = q.char.charCodeAt(0);
      if (G === 32 || G === 9 || G === 160 || G === 8234 || G === 8235 || G === 8236) q.level = J;
      else break;
      $--;
    }
    let K = J;
    for (let q = 0; q < Q; q++) if (Z[q].level > K) K = Z[q].level;
    for (let q = K; q >= 1; q--) {
      let G = 0;
      while (G < Q)
        if (Z[G].level >= q) {
          let j = G;
          while (j < Q && Z[j].level >= q) j++;
          let F = G,
            U = j - 1;
          while (F < U) {
            let H = Z[F];
            ((Z[F] = Z[U]), (Z[U] = H), F++, U--);
          }
          G = j;
        } else G++;
    }
  }
}
function m7(Z, J, Q, $) {
  let K = [];
  for (let F of $)
    if (F.y < J && F.y + F.height > Z) {
      let U = Math.max(0, F.x),
        H = Math.min(Q, F.x + F.width);
      if (H > U) K.push([U, H]);
    }
  if (K.length === 0) return [{ x0: 0, x1: Q }];
  K.sort((F, U) => F[0] - U[0]);
  let q = [];
  for (let F of K) {
    let U = q[q.length - 1];
    if (U && F[0] <= U[1]) U[1] = Math.max(U[1], F[1]);
    else q.push([F[0], F[1]]);
  }
  let G = [],
    j = 0;
  for (let [F, U] of q) {
    if (F > j) G.push({ x0: j, x1: F });
    j = Math.max(j, U);
  }
  if (j < Q) G.push({ x0: j, x1: Q });
  return G;
}
class w0 {
  maxWidth;
  maxHeight;
  preserveLeadingSpaces = !1;
  wordSegmenter;
  charSegmenter;
  wordCache = new Map();
  graphemeCache = new Map();
  paragraphCache = new Map();
  richParagraphCache = new Map();
  lastAtlas = null;
  measurer;
  constructor(Z, J, Q) {
    ((this.maxWidth = Z), (this.maxHeight = J), (this.measurer = Q ?? null));
    let $ = typeof navigator < "u" ? navigator.language : "en-US";
    ((this.wordSegmenter = new Intl.Segmenter($, { granularity: "word" })),
      (this.charSegmenter = new Intl.Segmenter($, { granularity: "grapheme" })));
  }
  getWordSegments(Z) {
    let J = this.wordCache.get(Z);
    if (J) return J;
    let Q = Array.from(this.wordSegmenter.segment(Z)).map(($) => ({
      segment: $.segment,
      isWordLike: $.isWordLike,
    }));
    if (this.wordCache.size > 500) this.wordCache.clear();
    return (this.wordCache.set(Z, Q), Q);
  }
  glyphWidth(Z, J, Q) {
    let $ = J[Z];
    if ($) return $.width * (Q / $.baseSize);
    if (this.measurer) return this.measurer.measure(Z, Q);
    return Q * 0.5;
  }
  getGraphemes(Z) {
    let J = this.graphemeCache.get(Z);
    if (J) return J;
    let Q = Array.from(this.charSegmenter.segment(Z)).map(($) => $.segment);
    if (this.graphemeCache.size > 2000) this.graphemeCache.clear();
    return (this.graphemeCache.set(Z, Q), Q);
  }
  layoutText(Z, J, Q = 32, $) {
    return this.layoutPrepared(this.prepare(Z, J, Q), $);
  }
  prepare(Z, J, Q = 32) {
    if (J !== this.lastAtlas)
      (this.paragraphCache.clear(), this.richParagraphCache.clear(), (this.lastAtlas = J));
    let $ = [],
      K = 0,
      q = !1;
    for (let G of Z.split(`
`)) {
      if (G.length === 0) {
        ($.push({ words: [], isEmpty: !0 }), (K += 1));
        continue;
      }
      let j = `${Q} ${G}`,
        F = this.paragraphCache.get(j);
      if (F) {
        if (($.push(F), F.fallbackToCanvas)) q = !0;
        K += G.length + 1;
        continue;
      }
      let { shapedText: U, indexMap: H } = l.shapeArabic(G),
        N = O0.resolveLevels(U),
        V = [],
        B = 0,
        O = !1;
      for (let z of this.getWordSegments(U)) {
        let I = z.segment,
          M = [],
          D = 0;
        for (let Y of this.getGraphemes(I)) {
          let P = B,
            R = B + Y.length,
            w = H[P],
            W = R === U.length ? G.length : H[R],
            L = K + w,
            b = W - w,
            k = Y[0],
            p = N[P],
            c = !!J[Y] || !!J[k];
          if (Y.trim().length > 0 && !c) ((O = !0), (q = !0));
          let T = this.glyphWidth(k, J, Q),
            A = [];
          for (let f = 1; f < Y.length; f++) A.push(Y[f]);
          (M.push({
            char: k,
            width: T,
            level: p,
            sourceIndex: L,
            sourceLength: b,
            combining: A.length > 0 ? A : void 0,
          }),
            (D += T),
            (B += Y.length));
        }
        V.push({
          glyphs: M,
          width: D,
          isWordLike: z.isWordLike,
          isWhitespace: I.trim().length === 0,
        });
      }
      let X = {
        words: V,
        isEmpty: !1,
        fallbackToCanvas: O || void 0,
        baseLevel: O0.getBaseLevel(U),
      };
      if (this.paragraphCache.size > 1000) this.paragraphCache.clear();
      (this.paragraphCache.set(j, X), $.push(X), (K += G.length + 1));
    }
    return { paragraphs: $, fontSize: Q, fallbackToCanvas: q || void 0 };
  }
  prepareRich(Z, J, Q = 32, $) {
    if (J !== this.lastAtlas)
      (this.paragraphCache.clear(), this.richParagraphCache.clear(), (this.lastAtlas = J));
    let K = "",
      q = [];
    for (let H of Z) {
      let N = H.style || $ ? { ...$, ...H.style } : void 0;
      K += H.text;
      for (let V = 0; V < H.text.length; V++) q.push(N);
    }
    let G = (H, N) => {
        let V = "",
          B = 0;
        while (B < N) {
          let O = q[H + B],
            X = O
              ? `${O.fontSize ?? ""}/${O.color ?? ""}/${O.bold ? 1 : 0}/${O.italic ? 1 : 0}/${O.href ?? ""}`
              : "",
            z = 1;
          while (B + z < N) {
            let I = q[H + B + z];
            if (
              (I
                ? `${I.fontSize ?? ""}/${I.color ?? ""}/${I.bold ? 1 : 0}/${I.italic ? 1 : 0}/${I.href ?? ""}`
                : "") !== X
            )
              break;
            z++;
          }
          ((V += `${X}:${z};`), (B += z));
        }
        return V;
      },
      j = [],
      F = 0,
      U = !1;
    for (let H of K.split(`
`)) {
      if (H.length === 0) {
        (j.push({ words: [], isEmpty: !0 }), (F += 1));
        continue;
      }
      let N = `${Q} ${H} ${G(F, H.length)}`,
        V = this.richParagraphCache.get(N);
      if (V) {
        if ((j.push(V), V.fallbackToCanvas)) U = !0;
        F += H.length + 1;
        continue;
      }
      let { shapedText: B, indexMap: O } = l.shapeArabic(H),
        X = O0.resolveLevels(B),
        z = [],
        I = 0,
        M = !1;
      for (let Y of this.getWordSegments(B)) {
        let P = Y.segment,
          R = [],
          w = 0;
        for (let W of this.getGraphemes(P)) {
          let L = I,
            b = I + W.length,
            k = O[L],
            p = b === B.length ? H.length : O[b],
            c = F + k,
            T = p - k,
            A = W[0],
            f = X[L],
            S = q[F + k],
            m = S?.fontSize ?? Q,
            o = !!J[W] || !!J[A];
          if (W.trim().length > 0 && !o) ((M = !0), (U = !0));
          let y = this.glyphWidth(A, J, m),
            u = [];
          for (let C = 1; C < W.length; C++) u.push(W[C]);
          (R.push({
            char: A,
            width: y,
            style: S,
            level: f,
            sourceIndex: c,
            sourceLength: T,
            combining: u.length > 0 ? u : void 0,
          }),
            (w += y),
            (I += W.length));
        }
        z.push({
          glyphs: R,
          width: w,
          isWordLike: Y.isWordLike,
          isWhitespace: P.trim().length === 0,
        });
      }
      let D = {
        words: z,
        isEmpty: !1,
        fallbackToCanvas: M || void 0,
        baseLevel: O0.getBaseLevel(B),
      };
      if (this.richParagraphCache.size > 1000) this.richParagraphCache.clear();
      (this.richParagraphCache.set(N, D), j.push(D), (F += H.length + 1));
    }
    return { paragraphs: j, fontSize: Q, fallbackToCanvas: U || void 0 };
  }
  layoutPrepared(Z, J, Q) {
    let $ = [],
      K = Z.fontSize,
      q = 0,
      G = 0,
      j = 0,
      F = !!(Q && Q.length),
      U = [{ x0: 0, x1: this.maxWidth }],
      H = 0,
      N = [],
      V = 0,
      B = () => {
        if (N.length === 0) return;
        let X = [],
          z = [];
        for (let I = 0; I < N.length; I++) {
          let M = N[I],
            D = N[I - 1];
          if (D && Math.abs(M.x - (D.x + D.width)) > 0.001) (X.push(z), (z = []));
          z.push(M);
        }
        if (z.length > 0) X.push(z);
        for (let I of X) {
          let M = I[0].x;
          O0.reorderVisual(I, V);
          let D = M;
          for (let Y of I) ((Y.x = D), (Y.isRTL = Y.level % 2 === 1), (D += Y.width));
          for (let Y of I) $.push(Y);
        }
        N = [];
      },
      O = (X) => {
        while (G < this.maxHeight) {
          let z = F ? m7(G, G + X, this.maxWidth, Q) : U;
          if (z.length > 0) return ((U = z), (H = 0), (q = U[0].x0), !0);
          G += X;
        }
        return !1;
      };
    for (let X of Z.paragraphs) {
      if (X.isEmpty) {
        (B(), (G += K * 1.5), (q = 0));
        continue;
      }
      V = X.baseLevel ?? 0;
      let z = K;
      for (let M of X.words)
        for (let D of M.glyphs) {
          let Y = D.style?.fontSize ?? K;
          if (Y > z) z = Y;
        }
      let I = z * 1.5;
      if (!O(I)) break;
      for (let M of X.words) {
        if (q + M.width > U[H].x1 && q > U[H].x0) {
          if (M.isWordLike === !1 && M.isWhitespace) continue;
          if (H < U.length - 1) (H++, (q = U[H].x0));
          else if ((B(), (G += I), !O(I))) break;
        }
        for (let D of M.glyphs) {
          let Y = D.width,
            P = D.style?.fontSize ?? K,
            R = !1;
          while (G < this.maxHeight) {
            if (q + Y > U[H].x1 && q > U[H].x0) {
              if (H < U.length - 1) (H++, (q = U[H].x0));
              else if ((B(), (G += I), !O(I))) break;
              continue;
            }
            if (J && J(q, G, Y, P)) {
              q += Y;
              continue;
            }
            R = !0;
            break;
          }
          if (!R || G >= this.maxHeight) break;
          if (q === U[H].x0 && D.char.trim().length === 0 && !this.preserveLeadingSpaces) continue;
          if (
            (N.push({
              char: D.char,
              x: q,
              y: G + (z - P),
              width: Y,
              height: P,
              style: D.style,
              level: D.level,
              sourceIndex: D.sourceIndex,
              sourceLength: D.sourceLength,
              combining: D.combining,
            }),
            (q += Y),
            q > j)
          )
            j = q;
        }
      }
      (B(), (q = 0), (G += I));
    }
    return { nodes: $, totalWidth: j, totalHeight: G, fallbackToCanvas: Z.fallbackToCanvas };
  }
  layoutTextIntoBuffer(Z, J, Q, $, K) {
    this.layoutPreparedIntoBuffer(this.prepare(Z, J, Q), $, K);
  }
  layoutPreparedIntoBuffer(Z, J, Q) {
    J.reset();
    let $ = Z.fontSize,
      K = $ * 1.5,
      q = 0,
      G = 0;
    for (let j of Z.paragraphs) {
      if (j.isEmpty) {
        ((G += K), (q = 0));
        continue;
      }
      for (let F of j.words) {
        if (q + F.width > this.maxWidth && q > 0) {
          if (F.isWordLike === !1 && F.isWhitespace) continue;
          ((q = 0), (G += K));
        }
        for (let U of F.glyphs) {
          if (J.count >= T0.CAPACITY) break;
          let H = U.width,
            N = !1;
          while (G < this.maxHeight) {
            if (q + H > this.maxWidth && q > 0) {
              ((q = 0), (G += K));
              continue;
            }
            if (Q && Q(q, G, H, $)) {
              q += H;
              continue;
            }
            N = !0;
            break;
          }
          if (!N || G >= this.maxHeight) break;
          if (q === 0 && U.char.trim().length === 0) continue;
          let V = J.count;
          ((J.chars[V] = U.char),
            (J.xs[V] = q),
            (J.ys[V] = G),
            (J.ws[V] = H),
            (J.hs[V] = $),
            J.count++,
            (q += H));
        }
      }
      ((q = 0), (G += K));
    }
  }
}
class T0 {
  static CAPACITY = 16384;
  xs = new Float32Array(T0.CAPACITY);
  ys = new Float32Array(T0.CAPACITY);
  ws = new Float32Array(T0.CAPACITY);
  hs = new Float32Array(T0.CAPACITY);
  chars = Array.from({ length: T0.CAPACITY });
  count = 0;
  reset() {
    this.count = 0;
  }
  toLayoutResult() {
    let Z = [];
    for (let J = 0; J < this.count; J++)
      Z.push({
        char: this.chars[J],
        x: this.xs[J],
        y: this.ys[J],
        width: this.ws[J],
        height: this.hs[J],
      });
    return { nodes: Z, totalWidth: 0, totalHeight: 0 };
  }
}
function L6() {
  return {
    async: !1,
    breaks: !1,
    extensions: null,
    gfm: !0,
    hooks: null,
    pedantic: !1,
    renderer: null,
    silent: !1,
    tokenizer: null,
    walkTokens: null,
  };
}
var v0 = L6();
function r6(Z) {
  v0 = Z;
}
var k0 = { exec: () => null };
function p0(Z) {
  let J = [];
  return (Q) => {
    let $ = Math.max(0, Math.min(3, Q - 1)),
      K = J[$];
    return (K || ((K = Z($)), (J[$] = K)), K);
  };
}
function _(Z, J = "") {
  let Q = typeof Z == "string" ? Z : Z.source,
    $ = {
      replace: (K, q) => {
        let G = typeof q == "string" ? q : q.source;
        return ((G = G.replace(h.caret, "$1")), (Q = Q.replace(K, G)), $);
      },
      getRegex: () => new RegExp(Q, J),
    };
  return $;
}
var x7 = ((Z = "") => {
    try {
      return !!new RegExp("(?<=1)(?<!1)" + Z);
    } catch {
      return !1;
    }
  })(),
  h = {
    codeRemoveIndent: /^(?: {1,4}| {0,3}\t)/gm,
    outputLinkReplace: /\\([\[\]])/g,
    indentCodeCompensation: /^(\s+)(?:```)/,
    beginningSpace: /^\s+/,
    endingHash: /#$/,
    startingSpaceChar: /^ /,
    endingSpaceChar: / $/,
    nonSpaceChar: /[^ ]/,
    newLineCharGlobal: /\n/g,
    tabCharGlobal: /\t/g,
    multipleSpaceGlobal: /\s+/g,
    blankLine: /^[ \t]*$/,
    doubleBlankLine: /\n[ \t]*\n[ \t]*$/,
    blockquoteStart: /^ {0,3}>/,
    blockquoteSetextReplace: /\n {0,3}((?:=+|-+) *)(?=\n|$)/g,
    blockquoteSetextReplace2: /^ {0,3}>[ \t]?/gm,
    listReplaceNesting: /^ {1,4}(?=( {4})*[^ ])/g,
    listIsTask: /^\[[ xX]\] +\S/,
    listReplaceTask: /^\[[ xX]\] +/,
    listTaskCheckbox: /\[[ xX]\]/,
    anyLine: /\n.*\n/,
    hrefBrackets: /^<(.*)>$/,
    tableDelimiter: /[:|]/,
    tableAlignChars: /^\||\| *$/g,
    tableRowBlankLine: /\n[ \t]*$/,
    tableAlignRight: /^ *-+: *$/,
    tableAlignCenter: /^ *:-+: *$/,
    tableAlignLeft: /^ *:-+ *$/,
    startATag: /^<a /i,
    endATag: /^<\/a>/i,
    startPreScriptTag: /^<(pre|code|kbd|script)(\s|>)/i,
    endPreScriptTag: /^<\/(pre|code|kbd|script)(\s|>)/i,
    startAngleBracket: /^</,
    endAngleBracket: />$/,
    pedanticHrefTitle: /^([^'"]*[^\s])\s+(['"])(.*)\2/,
    unicodeAlphaNumeric: /[\p{L}\p{N}]/u,
    escapeTest: /[&<>"']/,
    escapeReplace: /[&<>"']/g,
    escapeTestNoEncode: /[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/,
    escapeReplaceNoEncode: /[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/g,
    caret: /(^|[^\[])\^/g,
    percentDecode: /%25/g,
    findPipe: /\|/g,
    splitPipe: / \|/,
    slashPipe: /\\\|/g,
    carriageReturn: /\r\n|\r/g,
    spaceLine: /^ +$/gm,
    notSpaceStart: /^\S*/,
    endingNewline: /\n$/,
    listItemRegex: (Z) => new RegExp(`^( {0,3}${Z})((?:[	 ][^\\n]*)?(?:\\n|$))`),
    nextBulletRegex: p0(
      (Z) => new RegExp(`^ {0,${Z}}(?:[*+-]|\\d{1,9}[.)])((?:[ 	][^\\n]*)?(?:\\n|$))`),
    ),
    hrRegex: p0((Z) => new RegExp(`^ {0,${Z}}((?:- *){3,}|(?:_ *){3,}|(?:\\* *){3,})(?:\\n+|$)`)),
    fencesBeginRegex: p0((Z) => new RegExp(`^ {0,${Z}}(?:\`\`\`|~~~)`)),
    headingBeginRegex: p0((Z) => new RegExp(`^ {0,${Z}}#`)),
    htmlBeginRegex: p0((Z) => new RegExp(`^ {0,${Z}}<(?:[a-z].*>|!--)`, "i")),
    blockquoteBeginRegex: p0((Z) => new RegExp(`^ {0,${Z}}>`)),
  },
  u7 = /^(?:[ \t]*(?:\n|$))+/,
  g7 = /^((?: {4}| {0,3}\t)[^\n]+(?:\n(?:[ \t]*(?:\n|$))*)?)+/,
  h7 =
    /^ {0,3}(`{3,}(?=[^`\n]*(?:\n|$))|~{3,})([^\n]*)(?:\n|$)(?:|([\s\S]*?)(?:\n|$))(?: {0,3}\1[~`]* *(?=\n|$)|$)/,
  Z6 = /^ {0,3}((?:-[\t ]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})(?:\n+|$)/,
  p7 = /^ {0,3}(#{1,6})(?=\s|$)(.*)(?:\n+|$)/,
  A6 = / {0,3}(?:[*+-]|\d{1,9}[.)])/,
  t6 =
    /^(?!bull |blockCode|fences|blockquote|heading|html|table)((?:.|\n(?!\s*?\n|bull |blockCode|fences|blockquote|heading|html|table))+?)\n {0,3}(=+|-+) *(?:\n+|$)/,
  e6 = _(t6)
    .replace(/bull/g, A6)
    .replace(/blockCode/g, /(?: {4}| {0,3}\t)/)
    .replace(/fences/g, / {0,3}(?:`{3,}|~{3,})/)
    .replace(/blockquote/g, / {0,3}>/)
    .replace(/heading/g, / {0,3}#{1,6}/)
    .replace(/html/g, / {0,3}<[^\n>]+>\n/)
    .replace(/\|table/g, "")
    .getRegex(),
  c7 = _(t6)
    .replace(/bull/g, A6)
    .replace(/blockCode/g, /(?: {4}| {0,3}\t)/)
    .replace(/fences/g, / {0,3}(?:`{3,}|~{3,})/)
    .replace(/blockquote/g, / {0,3}>/)
    .replace(/heading/g, / {0,3}#{1,6}/)
    .replace(/html/g, / {0,3}<[^\n>]+>\n/)
    .replace(/table/g, / {0,3}\|?(?:[:\- ]*\|)+[\:\- ]*\n/)
    .getRegex(),
  R6 = /^([^\n]+(?:\n(?!hr|heading|lheading|blockquote|fences|list|html|table| +\n)[^\n]+)*)/,
  d7 = /^[^\n]+/,
  _6 = /(?!\s*\])(?:\\[\s\S]|[^\[\]\\])+/,
  l7 = _(
    /^ {0,3}\[(label)\]: *(?:\n[ \t]*)?([^<\s][^\s]*|<.*?>)(?:(?: +(?:\n[ \t]*)?| *\n[ \t]*)(title))? *(?:\n+|$)/,
  )
    .replace("label", _6)
    .replace("title", /(?:"(?:\\"?|[^"\\])*"|'[^'\n]*(?:\n[^'\n]+)*\n?'|\([^()]*\))/)
    .getRegex(),
  s7 = _(/^(bull)([ \t][^\n]*?)?(?:\n|$)/)
    .replace(/bull/g, A6)
    .getRegex(),
  B6 =
    "address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|meta|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul",
  C6 = /<!--(?:-?>|[\s\S]*?(?:-->|$))/,
  i7 = _(
    "^ {0,3}(?:<(script|pre|style|textarea)[\\s>][\\s\\S]*?(?:</\\1>[^\\n]*\\n+|$)|comment[^\\n]*(\\n+|$)|<\\?[\\s\\S]*?(?:\\?>\\n*|$)|<![A-Z][\\s\\S]*?(?:>\\n*|$)|<!\\[CDATA\\[[\\s\\S]*?(?:\\]\\]>\\n*|$)|</?(tag)(?: +|\\n|/?>)[\\s\\S]*?(?:(?:\\n[ \t]*)+\\n|$)|<(?!script|pre|style|textarea)([a-z][\\w-]*)(?:attribute)*? */?>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ \t]*)+\\n|$)|</(?!script|pre|style|textarea)[a-z][\\w-]*\\s*>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ \t]*)+\\n|$))",
    "i",
  )
    .replace("comment", C6)
    .replace("tag", B6)
    .replace(
      "attribute",
      / +[a-zA-Z:_][\w.:-]*(?: *= *"[^"\n]*"| *= *'[^'\n]*'| *= *[^\s"'=<>`]+)?/,
    )
    .getRegex(),
  J7 = _(R6)
    .replace("hr", Z6)
    .replace("heading", " {0,3}#{1,6}(?:\\s|$)")
    .replace("|lheading", "")
    .replace("|table", "")
    .replace("blockquote", " {0,3}>")
    .replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n")
    .replace("list", " {0,3}(?:[*+-]|1[.)])[ \\t]+[^ \\t\\n]")
    .replace("html", "</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)")
    .replace("tag", B6)
    .getRegex(),
  a7 = _(/^( {0,3}> ?(paragraph|[^\n]*)(?:\n|$))+/)
    .replace("paragraph", J7)
    .getRegex(),
  E6 = {
    blockquote: a7,
    code: g7,
    def: l7,
    fences: h7,
    heading: p7,
    hr: Z6,
    html: i7,
    lheading: e6,
    list: s7,
    newline: u7,
    paragraph: J7,
    table: k0,
    text: d7,
  },
  d6 = _(
    "^ *([^\\n ].*)\\n {0,3}((?:\\| *)?:?-+:? *(?:\\| *:?-+:? *)*(?:\\| *)?)(?:\\n((?:(?! *\\n|hr|heading|blockquote|code|fences|list|html).*(?:\\n|$))*)\\n*|$)",
  )
    .replace("hr", Z6)
    .replace("heading", " {0,3}#{1,6}(?:\\s|$)")
    .replace("blockquote", " {0,3}>")
    .replace("code", "(?: {4}| {0,3}\t)[^\\n]")
    .replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n")
    .replace("list", " {0,3}(?:[*+-]|1[.)])[ \\t]")
    .replace("html", "</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)")
    .replace("tag", B6)
    .getRegex(),
  o7 = {
    ...E6,
    lheading: c7,
    table: d6,
    paragraph: _(R6)
      .replace("hr", Z6)
      .replace("heading", " {0,3}#{1,6}(?:\\s|$)")
      .replace("|lheading", "")
      .replace("table", d6)
      .replace("blockquote", " {0,3}>")
      .replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n")
      .replace("list", " {0,3}(?:[*+-]|1[.)])[ \\t]+[^ \\t\\n]")
      .replace("html", "</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)")
      .replace("tag", B6)
      .getRegex(),
  },
  n7 = {
    ...E6,
    html: _(
      `^ *(?:comment *(?:\\n|\\s*$)|<(tag)[\\s\\S]+?</\\1> *(?:\\n{2,}|\\s*$)|<tag(?:"[^"]*"|'[^']*'|\\s[^'"/>\\s]*)*?/?> *(?:\\n{2,}|\\s*$))`,
    )
      .replace("comment", C6)
      .replace(
        /tag/g,
        "(?!(?:a|em|strong|small|s|cite|q|dfn|abbr|data|time|code|var|samp|kbd|sub|sup|i|b|u|mark|ruby|rt|rp|bdi|bdo|span|br|wbr|ins|del|img)\\b)\\w+(?!:|[^\\w\\s@]*@)\\b",
      )
      .getRegex(),
    def: /^ *\[([^\]]+)\]: *<?([^\s>]+)>?(?: +(["(][^\n]+[")]))? *(?:\n+|$)/,
    heading: /^(#{1,6})(.*)(?:\n+|$)/,
    fences: k0,
    lheading: /^(.+?)\n {0,3}(=+|-+) *(?:\n+|$)/,
    paragraph: _(R6)
      .replace("hr", Z6)
      .replace(
        "heading",
        ` *#{1,6} *[^
]`,
      )
      .replace("lheading", e6)
      .replace("|table", "")
      .replace("blockquote", " {0,3}>")
      .replace("|fences", "")
      .replace("|list", "")
      .replace("|html", "")
      .replace("|tag", "")
      .getRegex(),
  },
  r7 = /^\\([!"#$%&'()*+,\-./:;<=>?@\[\]\\^_`{|}~])/,
  t7 = /^(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/,
  Z7 = /^( {2,}|\\)\n(?!\s*$)/,
  e7 = /^(`+|[^`])(?:(?= {2,}\n)|[\s\S]*?(?:(?=[\\<!\[`*_]|\b_|$)|[^ ](?= {2,}\n)))/,
  c0 = /[\p{P}\p{S}]/u,
  O6 = /[\s\p{P}\p{S}]/u,
  T6 = /[^\s\p{P}\p{S}]/u,
  J8 = _(/^((?![*_])punctSpace)/, "u")
    .replace(/punctSpace/g, O6)
    .getRegex(),
  Q7 = /(?!~)[\p{P}\p{S}]/u,
  Z8 = /(?!~)[\s\p{P}\p{S}]/u,
  Q8 = /(?:[^\s\p{P}\p{S}]|~)/u,
  $8 = _(/link|precode-code|html/, "g")
    .replace(
      "link",
      /\[(?:[^\[\]`]|(?<a>`+)[^`]+\k<a>(?!`))*?\]\((?:\\[\s\S]|[^\\\(\)]|\((?:\\[\s\S]|[^\\\(\)])*\))*\)/,
    )
    .replace("precode-", x7 ? "(?<!`)()" : "(^^|[^`])")
    .replace("code", /(?<b>`+)[^`]+\k<b>(?!`)/)
    .replace("html", /<(?! )[^<>]*?>/)
    .getRegex(),
  $7 = /^(?:\*+(?:((?!\*)punct)|([^\s*]))?)|^_+(?:((?!_)punct)|([^\s_]))?/,
  K8 = _($7, "u").replace(/punct/g, c0).getRegex(),
  q8 = _($7, "u").replace(/punct/g, Q7).getRegex(),
  K7 =
    "^[^_*]*?__[^_*]*?\\*[^_*]*?(?=__)|[^*]+(?=[^*])|(?!\\*)punct(\\*+)(?=[\\s]|$)|notPunctSpace(\\*+)(?!\\*)(?=punctSpace|$)|(?!\\*)punctSpace(\\*+)(?=notPunctSpace)|[\\s](\\*+)(?!\\*)(?=punct)|(?!\\*)punct(\\*+)(?!\\*)(?=punct)|notPunctSpace(\\*+)(?=notPunctSpace)",
  G8 = _(K7, "gu")
    .replace(/notPunctSpace/g, T6)
    .replace(/punctSpace/g, O6)
    .replace(/punct/g, c0)
    .getRegex(),
  j8 = _(K7, "gu")
    .replace(/notPunctSpace/g, Q8)
    .replace(/punctSpace/g, Z8)
    .replace(/punct/g, Q7)
    .getRegex(),
  U8 = _(
    "^[^_*]*?\\*\\*[^_*]*?_[^_*]*?(?=\\*\\*)|[^_]+(?=[^_])|(?!_)punct(_+)(?=[\\s]|$)|notPunctSpace(_+)(?!_)(?=punctSpace|$)|(?!_)punctSpace(_+)(?=notPunctSpace)|[\\s](_+)(?!_)(?=punct)|(?!_)punct(_+)(?!_)(?=punct)",
    "gu",
  )
    .replace(/notPunctSpace/g, T6)
    .replace(/punctSpace/g, O6)
    .replace(/punct/g, c0)
    .getRegex(),
  F8 = _(/^~~?(?:((?!~)punct)|[^\s~])/, "u")
    .replace(/punct/g, c0)
    .getRegex(),
  H8 =
    "^[^~]+(?=[^~])|(?!~)punct(~~?)(?=[\\s]|$)|notPunctSpace(~~?)(?!~)(?=punctSpace|$)|(?!~)punctSpace(~~?)(?=notPunctSpace)|[\\s](~~?)(?!~)(?=punct)|(?!~)punct(~~?)(?!~)(?=punct)|notPunctSpace(~~?)(?=notPunctSpace)",
  N8 = _(H8, "gu")
    .replace(/notPunctSpace/g, T6)
    .replace(/punctSpace/g, O6)
    .replace(/punct/g, c0)
    .getRegex(),
  V8 = _(/\\(punct)/, "gu")
    .replace(/punct/g, c0)
    .getRegex(),
  B8 = _(/^<(scheme:[^\s\x00-\x1f<>]*|email)>/)
    .replace("scheme", /[a-zA-Z][a-zA-Z0-9+.-]{1,31}/)
    .replace(
      "email",
      /[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+(@)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+(?![-_])/,
    )
    .getRegex(),
  O8 = _(C6).replace("(?:-->|$)", "-->").getRegex(),
  z8 = _(
    "^comment|^</[a-zA-Z][\\w:-]*\\s*>|^<[a-zA-Z][\\w-]*(?:attribute)*?\\s*/?>|^<\\?[\\s\\S]*?\\?>|^<![a-zA-Z]+\\s[\\s\\S]*?>|^<!\\[CDATA\\[[\\s\\S]*?\\]\\]>",
  )
    .replace("comment", O8)
    .replace(
      "attribute",
      /\s+[a-zA-Z:_][\w.:-]*(?:\s*=\s*"[^"]*"|\s*=\s*'[^']*'|\s*=\s*[^\s"'=<>`]+)?/,
    )
    .getRegex(),
  H6 = /(?:\[(?:\\[\s\S]|[^\[\]\\])*\]|\\[\s\S]|`+(?!`)[^`]*?`+(?!`)|``+(?=\])|[^\[\]\\`])*?/,
  X8 = _(/^!?\[(label)\]\(\s*(href)(?:(?:[ \t]+(?:\n[ \t]*)?|\n[ \t]*)(title))?\s*\)/)
    .replace("label", H6)
    .replace("href", /<(?:\\.|[^\n<>\\])+>|[^ \t\n\x00-\x1f]*/)
    .replace("title", /"(?:\\"?|[^"\\])*"|'(?:\\'?|[^'\\])*'|\((?:\\\)?|[^)\\])*\)/)
    .getRegex(),
  q7 = _(/^!?\[(label)\]\[(ref)\]/)
    .replace("label", H6)
    .replace("ref", _6)
    .getRegex(),
  G7 = _(/^!?\[(ref)\](?:\[\])?/)
    .replace("ref", _6)
    .getRegex(),
  M8 = _("reflink|nolink(?!\\()", "g").replace("reflink", q7).replace("nolink", G7).getRegex(),
  l6 = /[hH][tT][tT][pP][sS]?|[fF][tT][pP]/,
  w6 = {
    _backpedal: k0,
    anyPunctuation: V8,
    autolink: B8,
    blockSkip: $8,
    br: Z7,
    code: t7,
    del: k0,
    delLDelim: k0,
    delRDelim: k0,
    emStrongLDelim: K8,
    emStrongRDelimAst: G8,
    emStrongRDelimUnd: U8,
    escape: r7,
    link: X8,
    nolink: G7,
    punctuation: J8,
    reflink: q7,
    reflinkSearch: M8,
    tag: z8,
    text: e7,
    url: k0,
  },
  W8 = {
    ...w6,
    link: _(/^!?\[(label)\]\((.*?)\)/)
      .replace("label", H6)
      .getRegex(),
    reflink: _(/^!?\[(label)\]\s*\[([^\]]*)\]/)
      .replace("label", H6)
      .getRegex(),
  },
  P6 = {
    ...w6,
    emStrongRDelimAst: j8,
    emStrongLDelim: q8,
    delLDelim: F8,
    delRDelim: N8,
    url: _(/^((?:protocol):\/\/|www\.)(?:[a-zA-Z0-9\-]+\.?)+[^\s<]*|^email/)
      .replace("protocol", l6)
      .replace("email", /[A-Za-z0-9._+-]+(@)[a-zA-Z0-9-_]+(?:\.[a-zA-Z0-9-_]*[a-zA-Z0-9])+(?![-_])/)
      .getRegex(),
    _backpedal: /(?:[^?!.,:;*_'"~()&]+|\([^)]*\)|&(?![a-zA-Z0-9]+;$)|[?!.,:;*_'"~)]+(?!$))+/,
    del: /^(~~?)(?=[^\s~])((?:\\[\s\S]|[^\\])*?(?:\\[\s\S]|[^\s~\\]))\1(?=[^~]|$)/,
    text: _(
      /^([`~]+|[^`~])(?:(?= {2,}\n)|(?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)|[\s\S]*?(?:(?=[\\<!\[`*~_]|\b_|protocol:\/\/|www\.|$)|[^ ](?= {2,}\n)|[^a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-](?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)))/,
    )
      .replace("protocol", l6)
      .getRegex(),
  },
  Y8 = {
    ...P6,
    br: _(Z7).replace("{2,}", "*").getRegex(),
    text: _(P6.text)
      .replace("\\b_", "\\b_| {2,}\\n")
      .replace(/\{2,\}/g, "*")
      .getRegex(),
  },
  F6 = { normal: E6, gfm: o7, pedantic: n7 },
  e0 = { normal: w6, gfm: P6, breaks: Y8, pedantic: W8 },
  D8 = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" },
  s6 = (Z) => D8[Z];
function F0(Z, J) {
  if (J) {
    if (h.escapeTest.test(Z)) return Z.replace(h.escapeReplace, s6);
  } else if (h.escapeTestNoEncode.test(Z)) return Z.replace(h.escapeReplaceNoEncode, s6);
  return Z;
}
function i6(Z) {
  try {
    Z = encodeURI(Z).replace(h.percentDecode, "%");
  } catch {
    return null;
  }
  return Z;
}
function a6(Z, J) {
  let Q = Z.replace(h.findPipe, (q, G, j) => {
      let F = !1,
        U = G;
      for (; --U >= 0 && j[U] === "\\"; ) F = !F;
      return F ? "|" : " |";
    }),
    $ = Q.split(h.splitPipe),
    K = 0;
  if (($[0].trim() || $.shift(), $.length > 0 && !$.at(-1)?.trim() && $.pop(), J))
    if ($.length > J) $.splice(J);
    else for (; $.length < J; ) $.push("");
  for (; K < $.length; K++) $[K] = $[K].trim().replace(h.slashPipe, "|");
  return $;
}
function D0(Z, J, Q) {
  let $ = Z.length;
  if ($ === 0) return "";
  let K = 0;
  for (; K < $; ) {
    let q = Z.charAt($ - K - 1);
    if (q === J && !Q) K++;
    else if (q !== J && Q) K++;
    else break;
  }
  return Z.slice(0, $ - K);
}
function o6(Z) {
  let J = Z.split(`
`),
    Q = J.length - 1;
  for (; Q >= 0 && h.blankLine.test(J[Q]); ) Q--;
  return J.length - Q <= 2
    ? Z
    : J.slice(0, Q + 1).join(`
`);
}
function I8(Z, J) {
  if (Z.indexOf(J[1]) === -1) return -1;
  let Q = 0;
  for (let $ = 0; $ < Z.length; $++)
    if (Z[$] === "\\") $++;
    else if (Z[$] === J[0]) Q++;
    else if (Z[$] === J[1] && (Q--, Q < 0)) return $;
  return Q > 0 ? -2 : -1;
}
function P8(Z, J = 0) {
  let Q = J,
    $ = "";
  for (let K of Z)
    if (K === "\t") {
      let q = 4 - (Q % 4);
      (($ += " ".repeat(q)), (Q += q));
    } else (($ += K), Q++);
  return $;
}
function n6(Z, J, Q, $, K) {
  let q = J.href,
    G = J.title || null,
    j = Z[1].replace(K.other.outputLinkReplace, "$1");
  $.state.inLink = !0;
  let F = {
    type: Z[0].charAt(0) === "!" ? "image" : "link",
    raw: Q,
    href: q,
    title: G,
    text: j,
    tokens: $.inlineTokens(j),
  };
  return (($.state.inLink = !1), F);
}
function L8(Z, J, Q) {
  let $ = Z.match(Q.other.indentCodeCompensation);
  if ($ === null) return J;
  let K = $[1];
  return J.split(
    `
`,
  ).map((q) => {
    let G = q.match(Q.other.beginningSpace);
    if (G === null) return q;
    let [j] = G;
    return j.length >= K.length ? q.slice(K.length) : q;
  }).join(`
`);
}
var N6 = class {
    options;
    rules;
    lexer;
    constructor(Z) {
      this.options = Z || v0;
    }
    space(Z) {
      let J = this.rules.block.newline.exec(Z);
      if (J && J[0].length > 0) return { type: "space", raw: J[0] };
    }
    code(Z) {
      let J = this.rules.block.code.exec(Z);
      if (J) {
        let Q = this.options.pedantic ? J[0] : o6(J[0]),
          $ = Q.replace(this.rules.other.codeRemoveIndent, "");
        return { type: "code", raw: Q, codeBlockStyle: "indented", text: $ };
      }
    }
    fences(Z) {
      let J = this.rules.block.fences.exec(Z);
      if (J) {
        let Q = J[0],
          $ = L8(Q, J[3] || "", this.rules);
        return {
          type: "code",
          raw: Q,
          lang: J[2] ? J[2].trim().replace(this.rules.inline.anyPunctuation, "$1") : J[2],
          text: $,
        };
      }
    }
    heading(Z) {
      let J = this.rules.block.heading.exec(Z);
      if (J) {
        let Q = J[2].trim();
        if (this.rules.other.endingHash.test(Q)) {
          let $ = D0(Q, "#");
          (this.options.pedantic || !$ || this.rules.other.endingSpaceChar.test($)) &&
            (Q = $.trim());
        }
        return {
          type: "heading",
          raw: D0(
            J[0],
            `
`,
          ),
          depth: J[1].length,
          text: Q,
          tokens: this.lexer.inline(Q),
        };
      }
    }
    hr(Z) {
      let J = this.rules.block.hr.exec(Z);
      if (J)
        return {
          type: "hr",
          raw: D0(
            J[0],
            `
`,
          ),
        };
    }
    blockquote(Z) {
      let J = this.rules.block.blockquote.exec(Z);
      if (J) {
        let Q = D0(
            J[0],
            `
`,
          ).split(`
`),
          $ = "",
          K = "",
          q = [];
        for (; Q.length > 0; ) {
          let G = !1,
            j = [],
            F;
          for (F = 0; F < Q.length; F++)
            if (this.rules.other.blockquoteStart.test(Q[F])) (j.push(Q[F]), (G = !0));
            else if (!G) j.push(Q[F]);
            else break;
          Q = Q.slice(F);
          let U = j.join(`
`),
            H = U.replace(
              this.rules.other.blockquoteSetextReplace,
              `
    $1`,
            ).replace(this.rules.other.blockquoteSetextReplace2, "");
          (($ = $
            ? `${$}
${U}`
            : U),
            (K = K
              ? `${K}
${H}`
              : H));
          let N = this.lexer.state.top;
          if (
            ((this.lexer.state.top = !0),
            this.lexer.blockTokens(H, q, !0),
            (this.lexer.state.top = N),
            Q.length === 0)
          )
            break;
          let V = q.at(-1);
          if (V?.type === "code") break;
          if (V?.type === "blockquote") {
            let B = V,
              O =
                B.raw +
                `
` +
                Q.join(`
`),
              X = this.blockquote(O);
            ((q[q.length - 1] = X),
              ($ = $.substring(0, $.length - B.raw.length) + X.raw),
              (K = K.substring(0, K.length - B.text.length) + X.text));
            break;
          } else if (V?.type === "list") {
            let B = V,
              O =
                B.raw +
                `
` +
                Q.join(`
`),
              X = this.list(O);
            ((q[q.length - 1] = X),
              ($ = $.substring(0, $.length - V.raw.length) + X.raw),
              (K = K.substring(0, K.length - B.raw.length) + X.raw),
              (Q = O.substring(q.at(-1).raw.length).split(`
`)));
            continue;
          }
        }
        return { type: "blockquote", raw: $, tokens: q, text: K };
      }
    }
    list(Z) {
      let J = this.rules.block.list.exec(Z);
      if (J) {
        let Q = J[1].trim(),
          $ = Q.length > 1,
          K = {
            type: "list",
            raw: "",
            ordered: $,
            start: $ ? +Q.slice(0, -1) : "",
            loose: !1,
            items: [],
          };
        ((Q = $ ? `\\d{1,9}\\${Q.slice(-1)}` : `\\${Q}`),
          this.options.pedantic && (Q = $ ? Q : "[*+-]"));
        let q = this.rules.other.listItemRegex(Q),
          G = !1;
        for (; Z; ) {
          let F = !1,
            U = "",
            H = "";
          if (!(J = q.exec(Z)) || this.rules.block.hr.test(Z)) break;
          ((U = J[0]), (Z = Z.substring(U.length)));
          let N = P8(
              J[2].split(
                `
`,
                1,
              )[0],
              J[1].length,
            ),
            V = Z.split(
              `
`,
              1,
            )[0],
            B = !N.trim(),
            O = 0;
          if (
            (this.options.pedantic
              ? ((O = 2), (H = N.trimStart()))
              : B
                ? (O = J[1].length + 1)
                : ((O = N.search(this.rules.other.nonSpaceChar)),
                  (O = O > 4 ? 1 : O),
                  (H = N.slice(O)),
                  (O += J[1].length)),
            B &&
              this.rules.other.blankLine.test(V) &&
              ((U +=
                V +
                `
`),
              (Z = Z.substring(V.length + 1)),
              (F = !0)),
            !F)
          ) {
            let X = this.rules.other.nextBulletRegex(O),
              z = this.rules.other.hrRegex(O),
              I = this.rules.other.fencesBeginRegex(O),
              M = this.rules.other.headingBeginRegex(O),
              D = this.rules.other.htmlBeginRegex(O),
              Y = this.rules.other.blockquoteBeginRegex(O);
            for (; Z; ) {
              let P = Z.split(
                  `
`,
                  1,
                )[0],
                R;
              if (
                ((V = P),
                this.options.pedantic
                  ? ((V = V.replace(this.rules.other.listReplaceNesting, "  ")), (R = V))
                  : (R = V.replace(this.rules.other.tabCharGlobal, "    ")),
                I.test(V) || M.test(V) || D.test(V) || Y.test(V) || X.test(V) || z.test(V))
              )
                break;
              if (R.search(this.rules.other.nonSpaceChar) >= O || !V.trim())
                H +=
                  `
` + R.slice(O);
              else {
                if (
                  B ||
                  N.replace(this.rules.other.tabCharGlobal, "    ").search(
                    this.rules.other.nonSpaceChar,
                  ) >= 4 ||
                  I.test(N) ||
                  M.test(N) ||
                  z.test(N)
                )
                  break;
                H +=
                  `
` + V;
              }
              ((B = !V.trim()),
                (U +=
                  P +
                  `
`),
                (Z = Z.substring(P.length + 1)),
                (N = R.slice(O)));
            }
          }
          (K.loose || (G ? (K.loose = !0) : this.rules.other.doubleBlankLine.test(U) && (G = !0)),
            K.items.push({
              type: "list_item",
              raw: U,
              task: !!this.options.gfm && this.rules.other.listIsTask.test(H),
              loose: !1,
              text: H,
              tokens: [],
            }),
            (K.raw += U));
        }
        let j = K.items.at(-1);
        if (j) ((j.raw = j.raw.trimEnd()), (j.text = j.text.trimEnd()));
        else return;
        K.raw = K.raw.trimEnd();
        for (let F of K.items) {
          ((this.lexer.state.top = !1), (F.tokens = this.lexer.blockTokens(F.text, [])));
          let U = F.tokens[0];
          if (F.task && (U?.type === "text" || U?.type === "paragraph")) {
            ((F.text = F.text.replace(this.rules.other.listReplaceTask, "")),
              (U.raw = U.raw.replace(this.rules.other.listReplaceTask, "")),
              (U.text = U.text.replace(this.rules.other.listReplaceTask, "")));
            for (let N = this.lexer.inlineQueue.length - 1; N >= 0; N--)
              if (this.rules.other.listIsTask.test(this.lexer.inlineQueue[N].src)) {
                this.lexer.inlineQueue[N].src = this.lexer.inlineQueue[N].src.replace(
                  this.rules.other.listReplaceTask,
                  "",
                );
                break;
              }
            let H = this.rules.other.listTaskCheckbox.exec(F.raw);
            if (H) {
              let N = { type: "checkbox", raw: H[0] + " ", checked: H[0] !== "[ ]" };
              ((F.checked = N.checked),
                K.loose
                  ? F.tokens[0] &&
                    ["paragraph", "text"].includes(F.tokens[0].type) &&
                    "tokens" in F.tokens[0] &&
                    F.tokens[0].tokens
                    ? ((F.tokens[0].raw = N.raw + F.tokens[0].raw),
                      (F.tokens[0].text = N.raw + F.tokens[0].text),
                      F.tokens[0].tokens.unshift(N))
                    : F.tokens.unshift({ type: "paragraph", raw: N.raw, text: N.raw, tokens: [N] })
                  : F.tokens.unshift(N));
            }
          } else F.task && (F.task = !1);
          if (!K.loose) {
            let H = F.tokens.filter((V) => V.type === "space"),
              N = H.length > 0 && H.some((V) => this.rules.other.anyLine.test(V.raw));
            K.loose = N;
          }
        }
        if (K.loose)
          for (let F of K.items) {
            F.loose = !0;
            for (let U of F.tokens) U.type === "text" && (U.type = "paragraph");
          }
        return K;
      }
    }
    html(Z) {
      let J = this.rules.block.html.exec(Z);
      if (J) {
        let Q = o6(J[0]);
        return {
          type: "html",
          block: !0,
          raw: Q,
          pre: J[1] === "pre" || J[1] === "script" || J[1] === "style",
          text: Q,
        };
      }
    }
    def(Z) {
      let J = this.rules.block.def.exec(Z);
      if (J) {
        let Q = J[1].toLowerCase().replace(this.rules.other.multipleSpaceGlobal, " "),
          $ = J[2]
            ? J[2]
                .replace(this.rules.other.hrefBrackets, "$1")
                .replace(this.rules.inline.anyPunctuation, "$1")
            : "",
          K = J[3]
            ? J[3].substring(1, J[3].length - 1).replace(this.rules.inline.anyPunctuation, "$1")
            : J[3];
        return {
          type: "def",
          tag: Q,
          raw: D0(
            J[0],
            `
`,
          ),
          href: $,
          title: K,
        };
      }
    }
    table(Z) {
      let J = this.rules.block.table.exec(Z);
      if (!J || !this.rules.other.tableDelimiter.test(J[2])) return;
      let Q = a6(J[1]),
        $ = J[2].replace(this.rules.other.tableAlignChars, "").split("|"),
        K = J[3]?.trim()
          ? J[3].replace(this.rules.other.tableRowBlankLine, "").split(`
`)
          : [],
        q = {
          type: "table",
          raw: D0(
            J[0],
            `
`,
          ),
          header: [],
          align: [],
          rows: [],
        };
      if (Q.length === $.length) {
        for (let G of $)
          this.rules.other.tableAlignRight.test(G)
            ? q.align.push("right")
            : this.rules.other.tableAlignCenter.test(G)
              ? q.align.push("center")
              : this.rules.other.tableAlignLeft.test(G)
                ? q.align.push("left")
                : q.align.push(null);
        for (let G = 0; G < Q.length; G++)
          q.header.push({
            text: Q[G],
            tokens: this.lexer.inline(Q[G]),
            header: !0,
            align: q.align[G],
          });
        for (let G of K)
          q.rows.push(
            a6(G, q.header.length).map((j, F) => ({
              text: j,
              tokens: this.lexer.inline(j),
              header: !1,
              align: q.align[F],
            })),
          );
        return q;
      }
    }
    lheading(Z) {
      let J = this.rules.block.lheading.exec(Z);
      if (J) {
        let Q = J[1].trim();
        return {
          type: "heading",
          raw: D0(
            J[0],
            `
`,
          ),
          depth: J[2].charAt(0) === "=" ? 1 : 2,
          text: Q,
          tokens: this.lexer.inline(Q),
        };
      }
    }
    paragraph(Z) {
      let J = this.rules.block.paragraph.exec(Z);
      if (J) {
        let Q =
          J[1].charAt(J[1].length - 1) ===
          `
`
            ? J[1].slice(0, -1)
            : J[1];
        return { type: "paragraph", raw: J[0], text: Q, tokens: this.lexer.inline(Q) };
      }
    }
    text(Z) {
      let J = this.rules.block.text.exec(Z);
      if (J) return { type: "text", raw: J[0], text: J[0], tokens: this.lexer.inline(J[0]) };
    }
    escape(Z) {
      let J = this.rules.inline.escape.exec(Z);
      if (J) return { type: "escape", raw: J[0], text: J[1] };
    }
    tag(Z) {
      let J = this.rules.inline.tag.exec(Z);
      if (J)
        return (
          !this.lexer.state.inLink && this.rules.other.startATag.test(J[0])
            ? (this.lexer.state.inLink = !0)
            : this.lexer.state.inLink &&
              this.rules.other.endATag.test(J[0]) &&
              (this.lexer.state.inLink = !1),
          !this.lexer.state.inRawBlock && this.rules.other.startPreScriptTag.test(J[0])
            ? (this.lexer.state.inRawBlock = !0)
            : this.lexer.state.inRawBlock &&
              this.rules.other.endPreScriptTag.test(J[0]) &&
              (this.lexer.state.inRawBlock = !1),
          {
            type: "html",
            raw: J[0],
            inLink: this.lexer.state.inLink,
            inRawBlock: this.lexer.state.inRawBlock,
            block: !1,
            text: J[0],
          }
        );
    }
    link(Z) {
      let J = this.rules.inline.link.exec(Z);
      if (J) {
        let Q = J[2].trim();
        if (!this.options.pedantic && this.rules.other.startAngleBracket.test(Q)) {
          if (!this.rules.other.endAngleBracket.test(Q)) return;
          let q = D0(Q.slice(0, -1), "\\");
          if ((Q.length - q.length) % 2 === 0) return;
        } else {
          let q = I8(J[2], "()");
          if (q === -2) return;
          if (q > -1) {
            let G = (J[0].indexOf("!") === 0 ? 5 : 4) + J[1].length + q;
            ((J[2] = J[2].substring(0, q)), (J[0] = J[0].substring(0, G).trim()), (J[3] = ""));
          }
        }
        let $ = J[2],
          K = "";
        if (this.options.pedantic) {
          let q = this.rules.other.pedanticHrefTitle.exec($);
          q && (($ = q[1]), (K = q[3]));
        } else K = J[3] ? J[3].slice(1, -1) : "";
        return (
          ($ = $.trim()),
          this.rules.other.startAngleBracket.test($) &&
            (this.options.pedantic && !this.rules.other.endAngleBracket.test(Q)
              ? ($ = $.slice(1))
              : ($ = $.slice(1, -1))),
          n6(
            J,
            {
              href: $ && $.replace(this.rules.inline.anyPunctuation, "$1"),
              title: K && K.replace(this.rules.inline.anyPunctuation, "$1"),
            },
            J[0],
            this.lexer,
            this.rules,
          )
        );
      }
    }
    reflink(Z, J) {
      let Q;
      if ((Q = this.rules.inline.reflink.exec(Z)) || (Q = this.rules.inline.nolink.exec(Z))) {
        let $ = (Q[2] || Q[1]).replace(this.rules.other.multipleSpaceGlobal, " "),
          K = J[$.toLowerCase()];
        if (!K) {
          let q = Q[0].charAt(0);
          return { type: "text", raw: q, text: q };
        }
        return n6(Q, K, Q[0], this.lexer, this.rules);
      }
    }
    emStrong(Z, J, Q = "") {
      let $ = this.rules.inline.emStrongLDelim.exec(Z);
      if (
        !$ ||
        (!$[1] && !$[2] && !$[3] && !$[4]) ||
        ($[4] && Q.match(this.rules.other.unicodeAlphaNumeric))
      )
        return;
      if (!($[1] || $[3]) || !Q || this.rules.inline.punctuation.exec(Q)) {
        let K = [...$[0]].length - 1,
          q,
          G,
          j = K,
          F = 0,
          U =
            $[0][0] === "*"
              ? this.rules.inline.emStrongRDelimAst
              : this.rules.inline.emStrongRDelimUnd;
        for (U.lastIndex = 0, J = J.slice(-1 * Z.length + K); ($ = U.exec(J)) !== null; ) {
          if (((q = $[1] || $[2] || $[3] || $[4] || $[5] || $[6]), !q)) continue;
          if (((G = [...q].length), $[3] || $[4])) {
            j += G;
            continue;
          } else if (($[5] || $[6]) && K % 3 && !((K + G) % 3)) {
            F += G;
            continue;
          }
          if (((j -= G), j > 0)) continue;
          G = Math.min(G, G + j + F);
          let H = [...$[0]][0].length,
            N = Z.slice(0, K + $.index + H + G);
          if (Math.min(K, G) % 2) {
            let B = N.slice(1, -1);
            return { type: "em", raw: N, text: B, tokens: this.lexer.inlineTokens(B) };
          }
          let V = N.slice(2, -2);
          return { type: "strong", raw: N, text: V, tokens: this.lexer.inlineTokens(V) };
        }
      }
    }
    codespan(Z) {
      let J = this.rules.inline.code.exec(Z);
      if (J) {
        let Q = J[2].replace(this.rules.other.newLineCharGlobal, " "),
          $ = this.rules.other.nonSpaceChar.test(Q),
          K =
            this.rules.other.startingSpaceChar.test(Q) && this.rules.other.endingSpaceChar.test(Q);
        return (
          $ && K && (Q = Q.substring(1, Q.length - 1)),
          { type: "codespan", raw: J[0], text: Q }
        );
      }
    }
    br(Z) {
      let J = this.rules.inline.br.exec(Z);
      if (J) return { type: "br", raw: J[0] };
    }
    del(Z, J, Q = "") {
      let $ = this.rules.inline.delLDelim.exec(Z);
      if (!$) return;
      if (!$[1] || !Q || this.rules.inline.punctuation.exec(Q)) {
        let K = [...$[0]].length - 1,
          q,
          G,
          j = K,
          F = this.rules.inline.delRDelim;
        for (F.lastIndex = 0, J = J.slice(-1 * Z.length + K); ($ = F.exec(J)) !== null; ) {
          if (
            ((q = $[1] || $[2] || $[3] || $[4] || $[5] || $[6]),
            !q || ((G = [...q].length), G !== K))
          )
            continue;
          if ($[3] || $[4]) {
            j += G;
            continue;
          }
          if (((j -= G), j > 0)) continue;
          G = Math.min(G, G + j);
          let U = [...$[0]][0].length,
            H = Z.slice(0, K + $.index + U + G),
            N = H.slice(K, -K);
          return { type: "del", raw: H, text: N, tokens: this.lexer.inlineTokens(N) };
        }
      }
    }
    autolink(Z) {
      let J = this.rules.inline.autolink.exec(Z);
      if (J) {
        let Q, $;
        return (
          J[2] === "@" ? ((Q = J[1]), ($ = "mailto:" + Q)) : ((Q = J[1]), ($ = Q)),
          { type: "link", raw: J[0], text: Q, href: $, tokens: [{ type: "text", raw: Q, text: Q }] }
        );
      }
    }
    url(Z) {
      let J;
      if ((J = this.rules.inline.url.exec(Z))) {
        let Q, $;
        if (J[2] === "@") ((Q = J[0]), ($ = "mailto:" + Q));
        else {
          let K;
          do ((K = J[0]), (J[0] = this.rules.inline._backpedal.exec(J[0])?.[0] ?? ""));
          while (K !== J[0]);
          ((Q = J[0]), J[1] === "www." ? ($ = "http://" + J[0]) : ($ = J[0]));
        }
        return {
          type: "link",
          raw: J[0],
          text: Q,
          href: $,
          tokens: [{ type: "text", raw: Q, text: Q }],
        };
      }
    }
    inlineText(Z) {
      let J = this.rules.inline.text.exec(Z);
      if (J) {
        let Q = this.lexer.state.inRawBlock;
        return { type: "text", raw: J[0], text: J[0], escaped: Q };
      }
    }
  },
  Z0 = class Z {
    tokens;
    options;
    state;
    inlineQueue;
    tokenizer;
    constructor(J) {
      ((this.tokens = []),
        (this.tokens.links = Object.create(null)),
        (this.options = J || v0),
        (this.options.tokenizer = this.options.tokenizer || new N6()),
        (this.tokenizer = this.options.tokenizer),
        (this.tokenizer.options = this.options),
        (this.tokenizer.lexer = this),
        (this.inlineQueue = []),
        (this.state = { inLink: !1, inRawBlock: !1, top: !0 }));
      let Q = { other: h, block: F6.normal, inline: e0.normal };
      (this.options.pedantic
        ? ((Q.block = F6.pedantic), (Q.inline = e0.pedantic))
        : this.options.gfm &&
          ((Q.block = F6.gfm), this.options.breaks ? (Q.inline = e0.breaks) : (Q.inline = e0.gfm)),
        (this.tokenizer.rules = Q));
    }
    static get rules() {
      return { block: F6, inline: e0 };
    }
    static lex(J, Q) {
      return new Z(Q).lex(J);
    }
    static lexInline(J, Q) {
      return new Z(Q).inlineTokens(J);
    }
    lex(J) {
      ((J = J.replace(
        h.carriageReturn,
        `
`,
      )),
        this.blockTokens(J, this.tokens));
      for (let Q = 0; Q < this.inlineQueue.length; Q++) {
        let $ = this.inlineQueue[Q];
        this.inlineTokens($.src, $.tokens);
      }
      return ((this.inlineQueue = []), this.tokens);
    }
    blockTokens(J, Q = [], $ = !1) {
      ((this.tokenizer.lexer = this),
        this.options.pedantic && (J = J.replace(h.tabCharGlobal, "    ").replace(h.spaceLine, "")));
      let K = 1 / 0;
      for (; J; ) {
        if (J.length < K) K = J.length;
        else {
          this.infiniteLoopError(J.charCodeAt(0));
          break;
        }
        let q;
        if (
          this.options.extensions?.block?.some((j) =>
            (q = j.call({ lexer: this }, J, Q))
              ? ((J = J.substring(q.raw.length)), Q.push(q), !0)
              : !1,
          )
        )
          continue;
        if ((q = this.tokenizer.space(J))) {
          J = J.substring(q.raw.length);
          let j = Q.at(-1);
          q.raw.length === 1 && j !== void 0
            ? (j.raw += `
`)
            : Q.push(q);
          continue;
        }
        if ((q = this.tokenizer.code(J))) {
          J = J.substring(q.raw.length);
          let j = Q.at(-1);
          j?.type === "paragraph" || j?.type === "text"
            ? ((j.raw +=
                (j.raw.endsWith(`
`)
                  ? ""
                  : `
`) + q.raw),
              (j.text +=
                `
` + q.text),
              (this.inlineQueue.at(-1).src = j.text))
            : Q.push(q);
          continue;
        }
        if ((q = this.tokenizer.fences(J))) {
          ((J = J.substring(q.raw.length)), Q.push(q));
          continue;
        }
        if ((q = this.tokenizer.heading(J))) {
          ((J = J.substring(q.raw.length)), Q.push(q));
          continue;
        }
        if ((q = this.tokenizer.hr(J))) {
          ((J = J.substring(q.raw.length)), Q.push(q));
          continue;
        }
        if ((q = this.tokenizer.blockquote(J))) {
          ((J = J.substring(q.raw.length)), Q.push(q));
          continue;
        }
        if ((q = this.tokenizer.list(J))) {
          ((J = J.substring(q.raw.length)), Q.push(q));
          continue;
        }
        if ((q = this.tokenizer.html(J))) {
          ((J = J.substring(q.raw.length)), Q.push(q));
          continue;
        }
        if ((q = this.tokenizer.def(J))) {
          J = J.substring(q.raw.length);
          let j = Q.at(-1);
          j?.type === "paragraph" || j?.type === "text"
            ? ((j.raw +=
                (j.raw.endsWith(`
`)
                  ? ""
                  : `
`) + q.raw),
              (j.text +=
                `
` + q.raw),
              (this.inlineQueue.at(-1).src = j.text))
            : this.tokens.links[q.tag] ||
              ((this.tokens.links[q.tag] = { href: q.href, title: q.title }), Q.push(q));
          continue;
        }
        if ((q = this.tokenizer.table(J))) {
          ((J = J.substring(q.raw.length)), Q.push(q));
          continue;
        }
        if ((q = this.tokenizer.lheading(J))) {
          ((J = J.substring(q.raw.length)), Q.push(q));
          continue;
        }
        let G = J;
        if (this.options.extensions?.startBlock) {
          let j = 1 / 0,
            F = J.slice(1),
            U;
          (this.options.extensions.startBlock.forEach((H) => {
            ((U = H.call({ lexer: this }, F)),
              typeof U == "number" && U >= 0 && (j = Math.min(j, U)));
          }),
            j < 1 / 0 && j >= 0 && (G = J.substring(0, j + 1)));
        }
        if (this.state.top && (q = this.tokenizer.paragraph(G))) {
          let j = Q.at(-1);
          ($ && j?.type === "paragraph"
            ? ((j.raw +=
                (j.raw.endsWith(`
`)
                  ? ""
                  : `
`) + q.raw),
              (j.text +=
                `
` + q.text),
              this.inlineQueue.pop(),
              (this.inlineQueue.at(-1).src = j.text))
            : Q.push(q),
            ($ = G.length !== J.length),
            (J = J.substring(q.raw.length)));
          continue;
        }
        if ((q = this.tokenizer.text(J))) {
          J = J.substring(q.raw.length);
          let j = Q.at(-1);
          j?.type === "text"
            ? ((j.raw +=
                (j.raw.endsWith(`
`)
                  ? ""
                  : `
`) + q.raw),
              (j.text +=
                `
` + q.text),
              this.inlineQueue.pop(),
              (this.inlineQueue.at(-1).src = j.text))
            : Q.push(q);
          continue;
        }
        if (J) {
          this.infiniteLoopError(J.charCodeAt(0));
          break;
        }
      }
      return ((this.state.top = !0), Q);
    }
    inline(J, Q = []) {
      return (this.inlineQueue.push({ src: J, tokens: Q }), Q);
    }
    inlineTokens(J, Q = []) {
      this.tokenizer.lexer = this;
      let $ = J,
        K = null;
      if (this.tokens.links) {
        let U = Object.keys(this.tokens.links);
        if (U.length > 0)
          for (; (K = this.tokenizer.rules.inline.reflinkSearch.exec($)) !== null; )
            U.includes(K[0].slice(K[0].lastIndexOf("[") + 1, -1)) &&
              ($ =
                $.slice(0, K.index) +
                "[" +
                "a".repeat(K[0].length - 2) +
                "]" +
                $.slice(this.tokenizer.rules.inline.reflinkSearch.lastIndex));
      }
      for (; (K = this.tokenizer.rules.inline.anyPunctuation.exec($)) !== null; )
        $ =
          $.slice(0, K.index) +
          "++" +
          $.slice(this.tokenizer.rules.inline.anyPunctuation.lastIndex);
      let q;
      for (; (K = this.tokenizer.rules.inline.blockSkip.exec($)) !== null; )
        ((q = K[2] ? K[2].length : 0),
          ($ =
            $.slice(0, K.index + q) +
            "[" +
            "a".repeat(K[0].length - q - 2) +
            "]" +
            $.slice(this.tokenizer.rules.inline.blockSkip.lastIndex)));
      $ = this.options.hooks?.emStrongMask?.call({ lexer: this }, $) ?? $;
      let G = !1,
        j = "",
        F = 1 / 0;
      for (; J; ) {
        if (J.length < F) F = J.length;
        else {
          this.infiniteLoopError(J.charCodeAt(0));
          break;
        }
        (G || (j = ""), (G = !1));
        let U;
        if (
          this.options.extensions?.inline?.some((N) =>
            (U = N.call({ lexer: this }, J, Q))
              ? ((J = J.substring(U.raw.length)), Q.push(U), !0)
              : !1,
          )
        )
          continue;
        if ((U = this.tokenizer.escape(J))) {
          ((J = J.substring(U.raw.length)), Q.push(U));
          continue;
        }
        if ((U = this.tokenizer.tag(J))) {
          ((J = J.substring(U.raw.length)), Q.push(U));
          continue;
        }
        if ((U = this.tokenizer.link(J))) {
          ((J = J.substring(U.raw.length)), Q.push(U));
          continue;
        }
        if ((U = this.tokenizer.reflink(J, this.tokens.links))) {
          J = J.substring(U.raw.length);
          let N = Q.at(-1);
          U.type === "text" && N?.type === "text"
            ? ((N.raw += U.raw), (N.text += U.text))
            : Q.push(U);
          continue;
        }
        if ((U = this.tokenizer.emStrong(J, $, j))) {
          ((J = J.substring(U.raw.length)), Q.push(U));
          continue;
        }
        if ((U = this.tokenizer.codespan(J))) {
          ((J = J.substring(U.raw.length)), Q.push(U));
          continue;
        }
        if ((U = this.tokenizer.br(J))) {
          ((J = J.substring(U.raw.length)), Q.push(U));
          continue;
        }
        if ((U = this.tokenizer.del(J, $, j))) {
          ((J = J.substring(U.raw.length)), Q.push(U));
          continue;
        }
        if ((U = this.tokenizer.autolink(J))) {
          ((J = J.substring(U.raw.length)), Q.push(U));
          continue;
        }
        if (!this.state.inLink && (U = this.tokenizer.url(J))) {
          ((J = J.substring(U.raw.length)), Q.push(U));
          continue;
        }
        let H = J;
        if (this.options.extensions?.startInline) {
          let N = 1 / 0,
            V = J.slice(1),
            B;
          (this.options.extensions.startInline.forEach((O) => {
            ((B = O.call({ lexer: this }, V)),
              typeof B == "number" && B >= 0 && (N = Math.min(N, B)));
          }),
            N < 1 / 0 && N >= 0 && (H = J.substring(0, N + 1)));
        }
        if ((U = this.tokenizer.inlineText(H))) {
          ((J = J.substring(U.raw.length)),
            U.raw.slice(-1) !== "_" && (j = U.raw.slice(-1)),
            (G = !0));
          let N = Q.at(-1);
          N?.type === "text" ? ((N.raw += U.raw), (N.text += U.text)) : Q.push(U);
          continue;
        }
        if (J) {
          this.infiniteLoopError(J.charCodeAt(0));
          break;
        }
      }
      return Q;
    }
    infiniteLoopError(J) {
      let Q = "Infinite loop on byte: " + J;
      if (this.options.silent) console.error(Q);
      else throw Error(Q);
    }
  },
  V6 = class {
    options;
    parser;
    constructor(Z) {
      this.options = Z || v0;
    }
    space(Z) {
      return "";
    }
    code({ text: Z, lang: J, escaped: Q }) {
      let $ = (J || "").match(h.notSpaceStart)?.[0],
        K =
          Z.replace(h.endingNewline, "") +
          `
`;
      return $
        ? '<pre><code class="language-' +
            F0($) +
            '">' +
            (Q ? K : F0(K, !0)) +
            `</code></pre>
`
        : "<pre><code>" +
            (Q ? K : F0(K, !0)) +
            `</code></pre>
`;
    }
    blockquote({ tokens: Z }) {
      return `<blockquote>
${this.parser.parse(Z)}</blockquote>
`;
    }
    html({ text: Z }) {
      return Z;
    }
    def(Z) {
      return "";
    }
    heading({ tokens: Z, depth: J }) {
      return `<h${J}>${this.parser.parseInline(Z)}</h${J}>
`;
    }
    hr(Z) {
      return `<hr>
`;
    }
    list(Z) {
      let { ordered: J, start: Q } = Z,
        $ = "";
      for (let G = 0; G < Z.items.length; G++) {
        let j = Z.items[G];
        $ += this.listitem(j);
      }
      let K = J ? "ol" : "ul",
        q = J && Q !== 1 ? ' start="' + Q + '"' : "";
      return (
        "<" +
        K +
        q +
        `>
` +
        $ +
        "</" +
        K +
        `>
`
      );
    }
    listitem(Z) {
      return `<li>${this.parser.parse(Z.tokens)}</li>
`;
    }
    checkbox({ checked: Z }) {
      return "<input " + (Z ? 'checked="" ' : "") + 'disabled="" type="checkbox"> ';
    }
    paragraph({ tokens: Z }) {
      return `<p>${this.parser.parseInline(Z)}</p>
`;
    }
    table(Z) {
      let J = "",
        Q = "";
      for (let K = 0; K < Z.header.length; K++) Q += this.tablecell(Z.header[K]);
      J += this.tablerow({ text: Q });
      let $ = "";
      for (let K = 0; K < Z.rows.length; K++) {
        let q = Z.rows[K];
        Q = "";
        for (let G = 0; G < q.length; G++) Q += this.tablecell(q[G]);
        $ += this.tablerow({ text: Q });
      }
      return (
        $ && ($ = `<tbody>${$}</tbody>`),
        `<table>
<thead>
` +
          J +
          `</thead>
` +
          $ +
          `</table>
`
      );
    }
    tablerow({ text: Z }) {
      return `<tr>
${Z}</tr>
`;
    }
    tablecell(Z) {
      let J = this.parser.parseInline(Z.tokens),
        Q = Z.header ? "th" : "td";
      return (
        (Z.align ? `<${Q} align="${Z.align}">` : `<${Q}>`) +
        J +
        `</${Q}>
`
      );
    }
    strong({ tokens: Z }) {
      return `<strong>${this.parser.parseInline(Z)}</strong>`;
    }
    em({ tokens: Z }) {
      return `<em>${this.parser.parseInline(Z)}</em>`;
    }
    codespan({ text: Z }) {
      return `<code>${F0(Z, !0)}</code>`;
    }
    br(Z) {
      return "<br>";
    }
    del({ tokens: Z }) {
      return `<del>${this.parser.parseInline(Z)}</del>`;
    }
    link({ href: Z, title: J, tokens: Q }) {
      let $ = this.parser.parseInline(Q),
        K = i6(Z);
      if (K === null) return $;
      Z = K;
      let q = '<a href="' + Z + '"';
      return (J && (q += ' title="' + F0(J) + '"'), (q += ">" + $ + "</a>"), q);
    }
    image({ href: Z, title: J, text: Q, tokens: $ }) {
      $ && (Q = this.parser.parseInline($, this.parser.textRenderer));
      let K = i6(Z);
      if (K === null) return F0(Q);
      Z = K;
      let q = `<img src="${Z}" alt="${F0(Q)}"`;
      return (J && (q += ` title="${F0(J)}"`), (q += ">"), q);
    }
    text(Z) {
      return "tokens" in Z && Z.tokens
        ? this.parser.parseInline(Z.tokens)
        : "escaped" in Z && Z.escaped
          ? Z.text
          : F0(Z.text);
    }
  },
  k6 = class {
    strong({ text: Z }) {
      return Z;
    }
    em({ text: Z }) {
      return Z;
    }
    codespan({ text: Z }) {
      return Z;
    }
    del({ text: Z }) {
      return Z;
    }
    html({ text: Z }) {
      return Z;
    }
    text({ text: Z }) {
      return Z;
    }
    link({ text: Z }) {
      return "" + Z;
    }
    image({ text: Z }) {
      return "" + Z;
    }
    br() {
      return "";
    }
    checkbox({ raw: Z }) {
      return Z;
    }
  },
  Q0 = class Z {
    options;
    renderer;
    textRenderer;
    constructor(J) {
      ((this.options = J || v0),
        (this.options.renderer = this.options.renderer || new V6()),
        (this.renderer = this.options.renderer),
        (this.renderer.options = this.options),
        (this.renderer.parser = this),
        (this.textRenderer = new k6()));
    }
    static parse(J, Q) {
      return new Z(Q).parse(J);
    }
    static parseInline(J, Q) {
      return new Z(Q).parseInline(J);
    }
    parse(J) {
      this.renderer.parser = this;
      let Q = "";
      for (let $ = 0; $ < J.length; $++) {
        let K = J[$];
        if (this.options.extensions?.renderers?.[K.type]) {
          let G = K,
            j = this.options.extensions.renderers[G.type].call({ parser: this }, G);
          if (
            j !== !1 ||
            ![
              "space",
              "hr",
              "heading",
              "code",
              "table",
              "blockquote",
              "list",
              "html",
              "def",
              "paragraph",
              "text",
            ].includes(G.type)
          ) {
            Q += j || "";
            continue;
          }
        }
        let q = K;
        switch (q.type) {
          case "space": {
            Q += this.renderer.space(q);
            break;
          }
          case "hr": {
            Q += this.renderer.hr(q);
            break;
          }
          case "heading": {
            Q += this.renderer.heading(q);
            break;
          }
          case "code": {
            Q += this.renderer.code(q);
            break;
          }
          case "table": {
            Q += this.renderer.table(q);
            break;
          }
          case "blockquote": {
            Q += this.renderer.blockquote(q);
            break;
          }
          case "list": {
            Q += this.renderer.list(q);
            break;
          }
          case "checkbox": {
            Q += this.renderer.checkbox(q);
            break;
          }
          case "html": {
            Q += this.renderer.html(q);
            break;
          }
          case "def": {
            Q += this.renderer.def(q);
            break;
          }
          case "paragraph": {
            Q += this.renderer.paragraph(q);
            break;
          }
          case "text": {
            Q += this.renderer.text(q);
            break;
          }
          default: {
            let G = 'Token with "' + q.type + '" type was not found.';
            if (this.options.silent) return (console.error(G), "");
            throw Error(G);
          }
        }
      }
      return Q;
    }
    parseInline(J, Q = this.renderer) {
      this.renderer.parser = this;
      let $ = "";
      for (let K = 0; K < J.length; K++) {
        let q = J[K];
        if (this.options.extensions?.renderers?.[q.type]) {
          let j = this.options.extensions.renderers[q.type].call({ parser: this }, q);
          if (
            j !== !1 ||
            ![
              "escape",
              "html",
              "link",
              "image",
              "strong",
              "em",
              "codespan",
              "br",
              "del",
              "text",
            ].includes(q.type)
          ) {
            $ += j || "";
            continue;
          }
        }
        let G = q;
        switch (G.type) {
          case "escape": {
            $ += Q.text(G);
            break;
          }
          case "html": {
            $ += Q.html(G);
            break;
          }
          case "link": {
            $ += Q.link(G);
            break;
          }
          case "image": {
            $ += Q.image(G);
            break;
          }
          case "checkbox": {
            $ += Q.checkbox(G);
            break;
          }
          case "strong": {
            $ += Q.strong(G);
            break;
          }
          case "em": {
            $ += Q.em(G);
            break;
          }
          case "codespan": {
            $ += Q.codespan(G);
            break;
          }
          case "br": {
            $ += Q.br(G);
            break;
          }
          case "del": {
            $ += Q.del(G);
            break;
          }
          case "text": {
            $ += Q.text(G);
            break;
          }
          default: {
            let j = 'Token with "' + G.type + '" type was not found.';
            if (this.options.silent) return (console.error(j), "");
            throw Error(j);
          }
        }
      }
      return $;
    }
  },
  J6 = class {
    options;
    block;
    constructor(Z) {
      this.options = Z || v0;
    }
    static passThroughHooks = new Set([
      "preprocess",
      "postprocess",
      "processAllTokens",
      "emStrongMask",
    ]);
    static passThroughHooksRespectAsync = new Set([
      "preprocess",
      "postprocess",
      "processAllTokens",
    ]);
    preprocess(Z) {
      return Z;
    }
    postprocess(Z) {
      return Z;
    }
    processAllTokens(Z) {
      return Z;
    }
    emStrongMask(Z) {
      return Z;
    }
    provideLexer(Z = this.block) {
      return Z ? Z0.lex : Z0.lexInline;
    }
    provideParser(Z = this.block) {
      return Z ? Q0.parse : Q0.parseInline;
    }
  },
  A8 = class {
    defaults = L6();
    options = this.setOptions;
    parse = this.parseMarkdown(!0);
    parseInline = this.parseMarkdown(!1);
    Parser = Q0;
    Renderer = V6;
    TextRenderer = k6;
    Lexer = Z0;
    Tokenizer = N6;
    Hooks = J6;
    constructor(...Z) {
      this.use(...Z);
    }
    walkTokens(Z, J) {
      let Q = [];
      for (let $ of Z)
        switch (((Q = Q.concat(J.call(this, $))), $.type)) {
          case "table": {
            let K = $;
            for (let q of K.header) Q = Q.concat(this.walkTokens(q.tokens, J));
            for (let q of K.rows) for (let G of q) Q = Q.concat(this.walkTokens(G.tokens, J));
            break;
          }
          case "list": {
            let K = $;
            Q = Q.concat(this.walkTokens(K.items, J));
            break;
          }
          default: {
            let K = $;
            this.defaults.extensions?.childTokens?.[K.type]
              ? this.defaults.extensions.childTokens[K.type].forEach((q) => {
                  let G = K[q].flat(1 / 0);
                  Q = Q.concat(this.walkTokens(G, J));
                })
              : K.tokens && (Q = Q.concat(this.walkTokens(K.tokens, J)));
          }
        }
      return Q;
    }
    use(...Z) {
      let J = this.defaults.extensions || { renderers: {}, childTokens: {} };
      return (
        Z.forEach((Q) => {
          let $ = { ...Q };
          if (
            (($.async = this.defaults.async || $.async || !1),
            Q.extensions &&
              (Q.extensions.forEach((K) => {
                if (!K.name) throw Error("extension name required");
                if ("renderer" in K) {
                  let q = J.renderers[K.name];
                  q
                    ? (J.renderers[K.name] = function (...G) {
                        let j = K.renderer.apply(this, G);
                        return (j === !1 && (j = q.apply(this, G)), j);
                      })
                    : (J.renderers[K.name] = K.renderer);
                }
                if ("tokenizer" in K) {
                  if (!K.level || (K.level !== "block" && K.level !== "inline"))
                    throw Error("extension level must be 'block' or 'inline'");
                  let q = J[K.level];
                  (q ? q.unshift(K.tokenizer) : (J[K.level] = [K.tokenizer]),
                    K.start &&
                      (K.level === "block"
                        ? J.startBlock
                          ? J.startBlock.push(K.start)
                          : (J.startBlock = [K.start])
                        : K.level === "inline" &&
                          (J.startInline
                            ? J.startInline.push(K.start)
                            : (J.startInline = [K.start]))));
                }
                "childTokens" in K && K.childTokens && (J.childTokens[K.name] = K.childTokens);
              }),
              ($.extensions = J)),
            Q.renderer)
          ) {
            let K = this.defaults.renderer || new V6(this.defaults);
            for (let q in Q.renderer) {
              if (!(q in K)) throw Error(`renderer '${q}' does not exist`);
              if (["options", "parser"].includes(q)) continue;
              let G = q,
                j = Q.renderer[G],
                F = K[G];
              K[G] = (...U) => {
                let H = j.apply(K, U);
                return (H === !1 && (H = F.apply(K, U)), H || "");
              };
            }
            $.renderer = K;
          }
          if (Q.tokenizer) {
            let K = this.defaults.tokenizer || new N6(this.defaults);
            for (let q in Q.tokenizer) {
              if (!(q in K)) throw Error(`tokenizer '${q}' does not exist`);
              if (["options", "rules", "lexer"].includes(q)) continue;
              let G = q,
                j = Q.tokenizer[G],
                F = K[G];
              K[G] = (...U) => {
                let H = j.apply(K, U);
                return (H === !1 && (H = F.apply(K, U)), H);
              };
            }
            $.tokenizer = K;
          }
          if (Q.hooks) {
            let K = this.defaults.hooks || new J6();
            for (let q in Q.hooks) {
              if (!(q in K)) throw Error(`hook '${q}' does not exist`);
              if (["options", "block"].includes(q)) continue;
              let G = q,
                j = Q.hooks[G],
                F = K[G];
              J6.passThroughHooks.has(q)
                ? (K[G] = (U) => {
                    if (this.defaults.async && J6.passThroughHooksRespectAsync.has(q))
                      return (async () => {
                        let N = await j.call(K, U);
                        return F.call(K, N);
                      })();
                    let H = j.call(K, U);
                    return F.call(K, H);
                  })
                : (K[G] = (...U) => {
                    if (this.defaults.async)
                      return (async () => {
                        let N = await j.apply(K, U);
                        return (N === !1 && (N = await F.apply(K, U)), N);
                      })();
                    let H = j.apply(K, U);
                    return (H === !1 && (H = F.apply(K, U)), H);
                  });
            }
            $.hooks = K;
          }
          if (Q.walkTokens) {
            let K = this.defaults.walkTokens,
              q = Q.walkTokens;
            $.walkTokens = function (G) {
              let j = [];
              return (j.push(q.call(this, G)), K && (j = j.concat(K.call(this, G))), j);
            };
          }
          this.defaults = { ...this.defaults, ...$ };
        }),
        this
      );
    }
    setOptions(Z) {
      return ((this.defaults = { ...this.defaults, ...Z }), this);
    }
    lexer(Z, J) {
      return Z0.lex(Z, J ?? this.defaults);
    }
    parser(Z, J) {
      return Q0.parse(Z, J ?? this.defaults);
    }
    parseMarkdown(Z) {
      return (J, Q) => {
        let $ = { ...Q },
          K = { ...this.defaults, ...$ },
          q = this.onError(!!K.silent, !!K.async);
        if (this.defaults.async === !0 && $.async === !1)
          return q(
            Error(
              "marked(): The async option was set to true by an extension. Remove async: false from the parse options object to return a Promise.",
            ),
          );
        if (typeof J > "u" || J === null)
          return q(Error("marked(): input parameter is undefined or null"));
        if (typeof J != "string")
          return q(
            Error(
              "marked(): input parameter is of type " +
                Object.prototype.toString.call(J) +
                ", string expected",
            ),
          );
        if ((K.hooks && ((K.hooks.options = K), (K.hooks.block = Z)), K.async))
          return (async () => {
            let G = K.hooks ? await K.hooks.preprocess(J) : J,
              j = await (K.hooks ? await K.hooks.provideLexer(Z) : Z ? Z0.lex : Z0.lexInline)(G, K),
              F = K.hooks ? await K.hooks.processAllTokens(j) : j;
            K.walkTokens && (await Promise.all(this.walkTokens(F, K.walkTokens)));
            let U = await (
              K.hooks ? await K.hooks.provideParser(Z) : Z ? Q0.parse : Q0.parseInline
            )(F, K);
            return K.hooks ? await K.hooks.postprocess(U) : U;
          })().catch(q);
        try {
          K.hooks && (J = K.hooks.preprocess(J));
          let G = (K.hooks ? K.hooks.provideLexer(Z) : Z ? Z0.lex : Z0.lexInline)(J, K);
          (K.hooks && (G = K.hooks.processAllTokens(G)),
            K.walkTokens && this.walkTokens(G, K.walkTokens));
          let j = (K.hooks ? K.hooks.provideParser(Z) : Z ? Q0.parse : Q0.parseInline)(G, K);
          return (K.hooks && (j = K.hooks.postprocess(j)), j);
        } catch (G) {
          return q(G);
        }
      };
    }
    onError(Z, J) {
      return (Q) => {
        if (
          ((Q.message += `
Please report this to https://github.com/markedjs/marked.`),
          Z)
        ) {
          let $ = "<p>An error occurred:</p><pre>" + F0(Q.message + "", !0) + "</pre>";
          return J ? Promise.resolve($) : $;
        }
        if (J) return Promise.reject(Q);
        throw Q;
      };
    }
  },
  S0 = new A8();
function E(Z, J) {
  return S0.parse(Z, J);
}
E.options = E.setOptions = function (Z) {
  return (S0.setOptions(Z), (E.defaults = S0.defaults), r6(E.defaults), E);
};
E.getDefaults = L6;
E.defaults = v0;
E.use = function (...Z) {
  return (S0.use(...Z), (E.defaults = S0.defaults), r6(E.defaults), E);
};
E.walkTokens = function (Z, J) {
  return S0.walkTokens(Z, J);
};
E.parseInline = S0.parseInline;
E.Parser = Q0;
E.parser = Q0.parse;
E.Renderer = V6;
E.TextRenderer = k6;
E.Lexer = Z0;
E.lexer = Z0.lex;
E.Tokenizer = N6;
E.Hooks = J6;
E.parse = E;
var { options: o8, setOptions: n8, use: r8, walkTokens: t8, parseInline: e8 } = E;
var J9 = Q0.parse,
  Z9 = Z0.lex;
var d0 = class extends t0 {
    padding = 0;
    isPointInside(Z, J) {
      let Q = this.getGlobalPosition(),
        $ = Z - Q.x,
        K = J - Q.y;
      return $ >= 0 && $ <= this.width && K >= 0 && K <= this.height;
    }
    getBounds() {
      return { x: 0, y: 0, width: this.width, height: this.height };
    }
  },
  z6;
function R8() {
  if (z6 !== void 0) return z6;
  return (
    (z6 = typeof document < "u" ? document.createElement("canvas").getContext("2d") : null),
    z6
  );
}
function X6(Z) {
  let J = /(\d+(?:\.\d+)?)px/.exec(Z);
  return J ? parseFloat(J[1]) : 16;
}
var _8 = 1000,
  b0 = new Map();
function j7(Z, J) {
  let Q = l.shapeArabic(Z).shapedText,
    $ = `${J} ${Q}`,
    K = b0.get($);
  if (K !== void 0) return (b0.delete($), b0.set($, K), K);
  let q = R8(),
    G;
  if (!q) G = Q.length * X6(J) * 0.5;
  else ((q.font = J), (G = q.measureText(Q).width));
  if ((b0.set($, G), b0.size > _8)) b0.delete(b0.keys().next().value);
  return G;
}
function C8(Z) {
  if (typeof document > "u") return null;
  let J = document.createElement("canvas").getContext("2d");
  if (!J) return null;
  let Q = new Map();
  return {
    measure($) {
      let K = Q.get($);
      if (K === void 0) ((J.font = Z), (K = J.measureText($).width), Q.set($, K));
      return K;
    },
  };
}
var z0 = class extends d0 {
  text;
  font;
  color;
  maxWidth;
  lineHeight;
  engine;
  prepared;
  fontSize;
  lines = [];
  constructor(Z, J = {}) {
    super();
    if (
      ((this.text = Z),
      (this.font = J.font ?? "16px sans-serif"),
      (this.color = J.color ?? "#e2e8f0"),
      (this.maxWidth = J.maxWidth),
      (this.lineHeight = J.lineHeight ?? 20),
      (this.fontSize = X6(this.font)),
      (this.engine = new w0(this.maxWidth ?? 1e9, 1e9, C8(this.font))),
      J.preserveLeadingSpaces)
    )
      this.engine.preserveLeadingSpaces = !0;
    ((this.prepared = this.engine.prepare(this.text, {}, this.fontSize)),
      (this.interactive = !0),
      this.applyLayout());
  }
  setText(Z) {
    return (
      (this.text = Z),
      (this.prepared = this.engine.prepare(this.text, {}, this.fontSize)),
      this.applyLayout(),
      this
    );
  }
  append(Z) {
    return this.setText(this.text + Z);
  }
  setMaxWidth(Z) {
    return ((this.maxWidth = Z), (this.engine.maxWidth = Z), this.applyLayout(), this);
  }
  applyLayout() {
    let Z = this.engine.layoutPrepared(this.prepared),
      J = this.fontSize * 1.5,
      Q = new Map(),
      $ = -1;
    for (let K of Z.nodes) {
      let q = Math.round(K.y / J);
      if ((Q.set(q, (Q.get(q) ?? "") + K.char), q > $)) $ = q;
    }
    this.lines = [];
    for (let K = 0; K <= $; K++) this.lines.push(Q.get(K) ?? "");
    ((this.width = Z.totalWidth), (this.height = Math.max($ + 1, 1) * this.lineHeight));
  }
  getA11yAttributes() {
    return { label: this.text };
  }
  render(Z) {
    for (let J = 0; J < this.lines.length; J++)
      if (this.lines[J])
        Z.fillText(this.lines[J], 0, (J + 0.8) * this.lineHeight, this.font, this.color);
  }
};
var U7 = class extends d0 {
  bg;
  border;
  borderWidth;
  radius;
  label;
  constructor(Z) {
    super();
    if (
      ((this.width = Z.width),
      (this.height = Z.height),
      (this.bg = Z.bg ?? "#0f172a"),
      (this.border = Z.border ?? null),
      (this.borderWidth = Z.borderWidth ?? 1),
      (this.radius = Z.radius ?? 12),
      (this.padding = Z.padding ?? 0),
      (this.label = Z.label ?? null),
      this.label)
    )
      this.interactive = !0;
  }
  getA11yAttributes() {
    return this.label ? { role: "group", label: this.label } : {};
  }
  render(Z) {
    if (
      (Z.beginPath(),
      Z.roundRect(0, 0, this.width, this.height, this.radius),
      Z.fill(this.bg),
      this.border)
    )
      (Z.beginPath(),
        Z.roundRect(0, 0, this.width, this.height, this.radius),
        Z.stroke(this.border, this.borderWidth));
  }
};
var F7 = class extends d0 {
  value;
  placeholder;
  font;
  color;
  placeholderColor;
  bg;
  border;
  selectionColor;
  radius;
  selectionStart;
  selectionEnd;
  composition = null;
  focused = !1;
  scrollLeft = 0;
  constructor(Z) {
    super();
    ((this.width = Z.width),
      (this.height = Z.height ?? 40),
      (this.value = Z.value ?? ""),
      (this.placeholder = Z.placeholder ?? ""),
      (this.font = Z.font ?? "16px sans-serif"),
      (this.color = Z.color ?? "#e2e8f0"),
      (this.placeholderColor = Z.placeholderColor ?? "#64748b"),
      (this.bg = Z.bg ?? "#0f172a"),
      (this.border = Z.border ?? "#334155"),
      (this.selectionColor = Z.selectionColor ?? "rgba(56, 189, 248, 0.35)"),
      (this.radius = Z.radius ?? 6),
      (this.padding = Z.padding ?? 10),
      (this.selectionStart = this.value.length),
      (this.selectionEnd = this.value.length),
      (this.interactive = !0),
      this.on("change", (J) => {
        ((this.value = J.value),
          (this.selectionStart = J.selectionStart ?? this.value.length),
          (this.selectionEnd = J.selectionEnd ?? this.value.length),
          (this.composition = J.composition ?? null),
          Z.onChange?.(this.value));
      }),
      this.on("focus", () => (this.focused = !0)),
      this.on("blur", () => (this.focused = !1)));
  }
  getA11yAttributes() {
    return {
      tag: "input",
      inputType: "text",
      placeholder: this.placeholder,
      value: this.value,
      label: this.placeholder,
    };
  }
  cachedValue = "";
  cachedFont = "";
  cachedLayout = null;
  getLayout() {
    if (this.value === this.cachedValue && this.font === this.cachedFont && this.cachedLayout)
      return this.cachedLayout;
    let Z = X6(this.font),
      J = new w0(1e6, 1000, { measure: ($) => j7($, this.font) });
    J.preserveLeadingSpaces = !0;
    let Q = J.layoutText(this.value, {}, Z);
    return (
      (this.cachedValue = this.value),
      (this.cachedFont = this.font),
      (this.cachedLayout = Q),
      Q
    );
  }
  charOffset(Z) {
    if (this.value.length === 0) return 0;
    let J = !1;
    for (let F = 0; F < this.value.length; F++) {
      let U = this.value.charCodeAt(F);
      if ((U >= 1424 && U <= 1535) || (U >= 1536 && U <= 1791) || (U >= 64336 && U <= 65279)) {
        J = !0;
        break;
      }
    }
    if (!J) return j7(this.value.slice(0, Z), this.font);
    let Q = this.getLayout();
    if (Q.nodes.length === 0) return 0;
    let $ = null,
      K = !1;
    for (let F of Q.nodes) {
      let U = F.sourceIndex ?? 0,
        H = F.sourceLength ?? 0;
      if (Z >= U && Z <= U + H) {
        if ((($ = F), (K = !!F.isRTL), Z > U && Z < U + H)) break;
      }
    }
    if (!$) {
      let F = Q.nodes[0];
      for (let U of Q.nodes)
        if (
          (U.sourceIndex ?? 0) + (U.sourceLength ?? 0) >
          (F.sourceIndex ?? 0) + (F.sourceLength ?? 0)
        )
          F = U;
      (($ = F), (K = !!F.isRTL));
    }
    let q = $.sourceIndex ?? 0,
      G = $.sourceLength ?? 0,
      j = G > 0 ? (Z - q) / G : 0;
    if (K) return $.x + $.width * (1 - j);
    else return $.x + $.width * j;
  }
  caretScreenX() {
    return this.padding - this.scrollLeft + this.charOffset(this.selectionStart);
  }
  updateScroll() {
    let Z = this.width - 2 * this.padding,
      J = this.charOffset(this.selectionStart);
    if (J - this.scrollLeft > Z) this.scrollLeft = J - Z;
    if (J - this.scrollLeft < 0) this.scrollLeft = J;
    if (this.scrollLeft < 0) this.scrollLeft = 0;
  }
  caretOn() {
    return Math.floor(Date.now() / 500) % 2 === 0;
  }
  render(Z) {
    (Z.beginPath(),
      Z.roundRect(0, 0, this.width, this.height, this.radius),
      Z.fill(this.bg),
      Z.beginPath(),
      Z.roundRect(0, 0, this.width, this.height, this.radius),
      Z.stroke(this.border, 1),
      this.updateScroll());
    let J = this.width - 2 * this.padding,
      Q = this.height * 0.66,
      $ = this.padding - this.scrollLeft;
    if (
      (Z.save(), Z.clip(this.padding, 0, J, this.height), this.selectionStart !== this.selectionEnd)
    ) {
      let G = Math.min(this.selectionStart, this.selectionEnd),
        j = Math.max(this.selectionStart, this.selectionEnd),
        F = !1;
      for (let U = 0; U < this.value.length; U++) {
        let H = this.value.charCodeAt(U);
        if ((H >= 1424 && H <= 1535) || (H >= 1536 && H <= 1791) || (H >= 64336 && H <= 65279)) {
          F = !0;
          break;
        }
      }
      if (!F) {
        let U = $ + this.charOffset(G),
          H = $ + this.charOffset(j);
        (Z.beginPath(),
          Z.roundRect(U, this.height * 0.2, H - U, this.height * 0.6, 0),
          Z.fill(this.selectionColor));
      } else {
        let U = this.getLayout();
        Z.beginPath();
        for (let H of U.nodes) {
          let N = H.sourceIndex ?? 0,
            V = H.sourceLength ?? 0;
          if (!(N + V <= G || N >= j))
            Z.roundRect($ + H.x, this.height * 0.2, H.width, this.height * 0.6, 0);
        }
        Z.fill(this.selectionColor);
      }
    }
    let K = this.value || this.placeholder,
      q = this.value ? this.color : this.placeholderColor;
    if ((Z.fillText(K, $, Q, this.font, q), this.composition && this.composition.length > 0)) {
      let G = $ + this.charOffset(this.composition.start),
        j = $ + this.charOffset(this.composition.start + this.composition.length),
        F = Q + 2;
      (Z.beginPath(), Z.moveTo(G, F), Z.lineTo(j, F), Z.stroke(this.color, 1));
    }
    if (this.focused && this.caretOn()) {
      let G = this.caretScreenX();
      (Z.beginPath(),
        Z.moveTo(G, this.height * 0.2),
        Z.lineTo(G, this.height * 0.8),
        Z.stroke(this.color, 1));
    }
    Z.restore();
  }
};
var E8 = class extends d0 {
  href;
  constructor(Z, J) {
    super();
    ((this.href = Z), (this.interactive = !0), this.on("click", () => J?.(this.href)));
  }
  getA11yAttributes() {
    return { tag: "a", href: this.href, label: this.href };
  }
  render() {}
};
function H7(Z) {
  return Z.replace(/^.*?[\d.]+px\s*/i, "").trim() || "sans-serif";
}
function T8(Z) {
  if (typeof document > "u") return null;
  let J = document.createElement("canvas").getContext("2d");
  if (!J) return null;
  let Q = new Map();
  return {
    measure($, K) {
      let q = `${K} ${$}`,
        G = Q.get(q);
      if (G === void 0) ((J.font = `${K}px ${H7(Z)}`), (G = J.measureText($).width), Q.set(q, G));
      return G;
    },
  };
}
var $0 = class extends d0 {
  spans;
  font;
  color;
  maxWidth;
  linkColor;
  exclusions;
  engine;
  baseFontSize;
  baseStyle;
  result;
  onLinkClick;
  hotspots = [];
  constructor(Z, J = {}) {
    super();
    ((this.spans = Z),
      (this.font = J.font ?? "16px sans-serif"),
      (this.color = J.color ?? "#e2e8f0"),
      (this.maxWidth = J.maxWidth),
      (this.baseStyle = J.baseStyle),
      (this.linkColor = J.linkColor ?? "#38bdf8"),
      (this.onLinkClick = J.onLinkClick),
      (this.exclusions = J.exclusions),
      (this.baseFontSize = X6(this.font)),
      (this.engine = new w0(this.maxWidth ?? 1e9, 1e9, T8(this.font))),
      (this.interactive = !1),
      (this.result = this.layout()));
  }
  setSpans(Z) {
    return ((this.spans = Z), (this.result = this.layout()), this);
  }
  setMaxWidth(Z) {
    return ((this.maxWidth = Z), (this.engine.maxWidth = Z), (this.result = this.layout()), this);
  }
  setExclusions(Z) {
    return ((this.exclusions = Z), (this.result = this.layout()), this);
  }
  appendSpans(Z) {
    return ((this.spans = [...this.spans, ...Z]), (this.result = this.layout()), this);
  }
  layout() {
    let Z = this.engine.prepareRich(this.spans, {}, this.baseFontSize, this.baseStyle),
      J = this.engine.layoutPrepared(Z, void 0, this.exclusions);
    return (
      (this.width = J.totalWidth),
      (this.height = J.totalHeight),
      (this.result = J),
      this.syncHotspots(),
      J
    );
  }
  computeLinks() {
    let Z = [],
      J = this.result.nodes,
      Q = 0;
    while (Q < J.length) {
      let $ = J[Q].style?.href;
      if (!$) {
        Q++;
        continue;
      }
      let K = Q;
      while (K < J.length && J[K].style?.href === $) K++;
      let q = J.slice(Q, K),
        G = Math.min(...q.map((N) => N.y)),
        j = q.filter((N) => N.y === G),
        F = Math.min(...j.map((N) => N.x)),
        U = Math.max(...j.map((N) => N.x + N.width)),
        H = Math.max(...j.map((N) => N.height));
      (Z.push({ href: $, x: F, y: G, width: U - F, height: H }), (Q = K));
    }
    return Z;
  }
  syncHotspots() {
    let Z = this.computeLinks();
    if (Z.length !== this.hotspots.length) {
      for (let J of this.hotspots) (this.remove(J), this.scene?.detachA11y(J));
      this.hotspots = Z.map((J) => {
        let Q = new E8(J.href, this.onLinkClick);
        return (this.add(Q), Q);
      });
    }
    for (let J = 0; J < Z.length; J++) {
      let Q = Z[J],
        $ = this.hotspots[J];
      (($.href = Q.href), $.setPosition(Q.x, Q.y), ($.width = Q.width), ($.height = Q.height));
    }
  }
  fullText() {
    return this.spans.map((Z) => Z.text).join("");
  }
  nodeFont(Z, J) {
    let Q = Z?.italic ? "italic " : "",
      $ = Z?.bold ? "bold " : "";
    return `${Q}${$}${J}px ${H7(this.font)}`;
  }
  getA11yAttributes() {
    return { label: this.fullText() };
  }
  render(Z) {
    for (let J of this.result.nodes) {
      if (J.char.trim().length === 0) continue;
      let Q = J.height,
        $ = this.nodeFont(J.style, Q),
        K = !!J.style?.href,
        q = J.style?.color ?? (K ? this.linkColor : this.color),
        G = J.y + Q * 0.8;
      if ((Z.fillText(J.char, J.x, G, $, q), K)) {
        let j = G + 2;
        (Z.beginPath(), Z.moveTo(J.x, j), Z.lineTo(J.x + J.width, j), Z.stroke(q, 1));
      }
    }
  }
};
var N7 = class extends d0 {
  content;
  targetY = 0;
  velocityY = 0;
  friction = 0.85;
  spring = 0.1;
  dragging = !1;
  lastPointerY = 0;
  constructor(Z) {
    super("ScrollView");
    ((this.width = Z.width),
      (this.height = Z.height),
      (this.interactive = !0),
      (this.clipChildren = !0),
      (this.content = new (class extends t0 {
        isPointInside() {
          return !1;
        }
        render() {}
      })("ScrollViewContent")),
      super.add(this.content),
      this.on("wheel", (Q) => {
        if (Q.ctrlKey) return;
        (Q.preventDefault(),
          (this.targetY -= Q.deltaY),
          this.clampTarget(),
          this.scene?.markDirty());
      }),
      this.on("pointerdown", (Q) => {
        ((this.dragging = !0), (this.lastPointerY = Q.clientY ?? 0), this.scene?.markDirty());
      }),
      this.on("pointermove", (Q) => {
        if (!this.dragging) return;
        let $ = Q.clientY ?? 0;
        ((this.targetY += $ - this.lastPointerY),
          (this.lastPointerY = $),
          this.clampTarget(),
          this.scene?.markDirty());
      }));
    let J = () => {
      this.dragging = !1;
    };
    (this.on("pointerup", J), this.on("pointerleave", J));
  }
  clampTarget() {
    let Z = Math.max(0, this.content.height - this.height);
    if (this.targetY > 0) this.targetY = 0;
    else if (this.targetY < -Z) this.targetY = -Z;
  }
  add(Z) {
    return (this.content.add(Z), this.updateContentSize(), this);
  }
  remove(Z) {
    return (this.content.remove(Z), this.updateContentSize(), this);
  }
  updateContentSize() {
    let Z = 0,
      J = 0;
    for (let $ of this.content.children) {
      if ($.x + $.width > Z) Z = $.x + $.width;
      if ($.y + $.height > J) J = $.y + $.height;
    }
    ((this.content.width = Z), (this.content.height = J));
    let Q = Math.max(0, this.content.height - this.height);
    if (this.targetY < -Q) this.targetY = -Q;
  }
  update(Z, J) {
    super.update(Z, J);
    let Q = Math.max(0, this.content.height - this.height);
    if (this.content.y > 0) this.targetY = 0;
    else if (this.content.y < -Q) this.targetY = -Q;
    let $ = this.targetY - this.content.y;
    if (
      ((this.velocityY += $ * this.spring),
      (this.velocityY *= this.friction),
      Math.abs(this.velocityY) > 0.01 || Math.abs($) > 0.01)
    )
      ((this.content.y += this.velocityY), this.scene?.markDirty());
    else ((this.content.y = this.targetY), (this.velocityY = 0));
  }
  render(Z) {}
};
var I0 = {
  js: new Set([
    "const",
    "let",
    "var",
    "function",
    "return",
    "if",
    "else",
    "for",
    "while",
    "class",
    "extends",
    "new",
    "this",
    "import",
    "export",
    "from",
    "default",
    "async",
    "await",
    "try",
    "catch",
    "throw",
    "of",
    "in",
    "typeof",
    "instanceof",
    "switch",
    "case",
    "break",
    "continue",
    "null",
    "undefined",
    "true",
    "false",
  ]),
  ts: new Set([
    "const",
    "let",
    "var",
    "function",
    "return",
    "if",
    "else",
    "for",
    "while",
    "class",
    "extends",
    "new",
    "this",
    "import",
    "export",
    "from",
    "default",
    "async",
    "await",
    "try",
    "catch",
    "throw",
    "of",
    "in",
    "typeof",
    "instanceof",
    "switch",
    "case",
    "break",
    "continue",
    "null",
    "undefined",
    "true",
    "false",
    "type",
    "interface",
    "enum",
    "as",
    "is",
    "readonly",
    "implements",
    "abstract",
    "public",
    "private",
    "protected",
    "static",
    "void",
    "never",
    "any",
    "unknown",
  ]),
  py: new Set([
    "def",
    "class",
    "return",
    "if",
    "elif",
    "else",
    "for",
    "while",
    "import",
    "from",
    "as",
    "with",
    "try",
    "except",
    "raise",
    "finally",
    "pass",
    "break",
    "continue",
    "and",
    "or",
    "not",
    "in",
    "is",
    "None",
    "True",
    "False",
    "yield",
    "lambda",
    "global",
    "nonlocal",
    "del",
    "assert",
    "async",
    "await",
  ]),
  rust: new Set([
    "fn",
    "let",
    "mut",
    "const",
    "if",
    "else",
    "for",
    "while",
    "loop",
    "match",
    "return",
    "struct",
    "enum",
    "impl",
    "trait",
    "pub",
    "use",
    "mod",
    "crate",
    "self",
    "super",
    "where",
    "as",
    "in",
    "ref",
    "move",
    "async",
    "await",
    "true",
    "false",
    "type",
    "unsafe",
    "extern",
    "dyn",
    "static",
  ]),
};
I0.javascript = I0.js;
I0.typescript = I0.ts;
I0.python = I0.py;
I0.rs = I0.rust;
var w8 = 42;
function V7(Z) {
  if (Z.startsWith("e:")) {
    let J = Z.slice(2),
      Q = atob(J),
      $ = new Uint8Array(Q.length);
    for (let K = 0; K < Q.length; K++) $[K] = Q.charCodeAt(K) ^ w8;
    return new TextDecoder().decode($);
  }
  return Z;
}
function B7(Z) {
  try {
    return JSON.parse(V7(Z.trim()));
  } catch (J) {
    return (console.error("Failed to parse page data", J), null);
  }
}
var a = null,
  X0 = null,
  v6 = [],
  f0 = null,
  M6 = new Map(),
  S6 = new Map();
function Q6(Z) {
  let J = [],
    Q = document.createElement("div");
  Q.innerHTML = Z;
  function $(K, q = {}) {
    if (K.nodeType === Node.TEXT_NODE) {
      let G = K.textContent || "";
      if (G) J.push({ text: G, style: { ...q } });
    } else if (K.nodeType === Node.ELEMENT_NODE) {
      let G = K,
        j = { ...q };
      if (G.tagName === "STRONG" || G.tagName === "B") j.bold = !0;
      else if (G.tagName === "EM" || G.tagName === "I") j.italic = !0;
      else if (G.tagName === "A") j.href = G.getAttribute("href") || "";
      else if (G.tagName === "CODE") ((j.color = "#8c765c"), (j.bold = !0));
      for (let F = 0; F < G.childNodes.length; F++) $(G.childNodes[F], j);
    }
  }
  return ($(Q), J);
}
function k8(Z) {
  let J = [],
    Q = document.createElement("div");
  Q.innerHTML = Z;
  for (let $ = 0; $ < Q.childNodes.length; $++) {
    let K = Q.childNodes[$];
    if (K.nodeType !== Node.ELEMENT_NODE) continue;
    let q = K;
    if (
      q.tagName === "H1" ||
      q.tagName === "H2" ||
      q.tagName === "H3" ||
      q.tagName === "H4" ||
      q.tagName === "H5" ||
      q.tagName === "H6"
    ) {
      let G = Q6(q.innerHTML);
      for (let j of G) j.style = { ...j.style, bold: !0 };
      J.push({ type: q.tagName.toLowerCase(), spans: G });
    } else if (q.tagName === "IMG")
      J.push({
        type: "p",
        text: q.getAttribute("src") || "",
        codeLang: "image",
        spans: [{ text: q.getAttribute("alt") || "" }],
      });
    else if (q.tagName === "P") {
      let G = q.querySelector("img"),
        j = q.querySelector(".katex") !== null;
      if (G)
        J.push({
          type: "p",
          text: G.getAttribute("src") || "",
          codeLang: "image",
          spans: [{ text: G.getAttribute("alt") || "" }],
        });
      else if (j) J.push({ type: "blockquote", text: q.outerHTML, codeLang: "math" });
      else J.push({ type: "p", spans: Q6(q.innerHTML) });
    } else if (q.classList.contains("katex-display") || q.querySelector(".katex-display") !== null)
      J.push({ type: "blockquote", text: q.innerHTML, codeLang: "math" });
    else if (q.tagName === "PRE") {
      let G = q.querySelector("code"),
        j = G ? G.textContent || "" : q.textContent || "",
        F = G ? G.className.replace("language-", "") : "";
      J.push({ type: "pre", text: j.trim(), codeLang: F });
    } else if (q.tagName === "BLOCKQUOTE") J.push({ type: "blockquote", spans: Q6(q.innerHTML) });
    else if (q.tagName === "UL" || q.tagName === "OL") {
      let G = Array.from(q.querySelectorAll("li")).map((j) => Q6(j.innerHTML));
      J.push({ type: q.tagName.toLowerCase(), items: G });
    }
  }
  return J;
}
class O7 extends n {
  constructor(Z, J) {
    super();
    let Q = new $0(Z, {
      font: "italic 16px Noto Serif SC, serif",
      color: "#7a7265",
      maxWidth: J - 24,
    });
    (Q.setPosition(20, 0), this.add(Q), (this.width = J), (this.height = Q.height));
  }
  render(Z) {
    (Z.save(), Z.beginPath(), Z.roundRect(0, 0, 4, this.height, 0), Z.fill("#8c765c"), Z.restore());
  }
}
class z7 extends n {
  img = null;
  loaded = !1;
  constructor(Z, J) {
    super();
    ((this.width = J), (this.height = 60));
    let Q = document.createElement("div");
    ((Q.style.position = "absolute"),
      (Q.style.visibility = "hidden"),
      (Q.style.color = "#332f29"),
      (Q.style.fontFamily = "Noto Serif SC, serif"),
      (Q.style.width = `${J}px`),
      (Q.innerHTML = Z),
      document.body.appendChild(Q));
    let $ = Q.offsetWidth || J,
      K = Q.offsetHeight || 40;
    this.height = K + 20;
    let q = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${$}" height="${K}">
        <foreignObject width="100%" height="100%">
          <div xmlns="http://www.w3.org/1999/xhtml" style="color: #332f29; font-family: 'Noto Serif SC', serif; line-height: 1.85;">
            ${Z}
          </div>
        </foreignObject>
      </svg>
    `;
    document.body.removeChild(Q);
    let G = new Image();
    ((G.onload = () => {
      ((this.img = G), (this.loaded = !0), (this.width = $), (this.height = K + 20));
    }),
      (G.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(q.trim())));
  }
  render(Z) {
    if (this.loaded && this.img)
      Z.drawImage(this.img, Math.max(0, (this.width - this.img.width) / 2), 10);
  }
}
class X7 extends n {
  img = null;
  loaded = !1;
  src;
  alt;
  maxWidth;
  constructor(Z, J, Q) {
    super();
    ((this.src = Z), (this.alt = J), (this.maxWidth = Q), (this.width = Q));
    let $ = S6.get(Z);
    if ($)
      ((this.loaded = !0),
        (this.img = $.img),
        (this.height = Math.round(this.maxWidth * $.aspectRatio)));
    else if (((this.height = 300), typeof window < "u")) {
      let K = new window.Image();
      ((K.onload = () => {
        ((this.loaded = !0), (this.img = K));
        let q = K.naturalWidth || 1,
          j = (K.naturalHeight || 1) / q;
        ((this.height = Math.round(this.maxWidth * j)),
          S6.set(Z, { img: K, aspectRatio: j }),
          $6());
      }),
        (K.onerror = () => {
          this.loaded = !1;
          let q = 150 / this.maxWidth;
          ((this.height = 150), S6.set(Z, { img: K, aspectRatio: q }), $6());
        }),
        (K.src = Z));
    }
  }
  render(Z) {
    if (this.loaded && this.img) Z.drawImage(this.img, 0, 0, this.width, this.height);
    else
      (Z.save(),
        Z.beginPath(),
        Z.roundRect(0, 0, this.width, this.height, 6),
        Z.fill("#ede4d3"),
        Z.restore());
  }
}
class M7 extends n {
  constructor(Z, J) {
    super();
    let Q = new z0(Z, {
      font: "14px monospace",
      color: "#332f29",
      maxWidth: J - 32,
      preserveLeadingSpaces: !0,
      lineHeight: 22,
    });
    (Q.setPosition(16, 16), this.add(Q), (this.width = J), (this.height = Q.height + 32));
  }
  render(Z) {
    (Z.save(),
      Z.beginPath(),
      Z.roundRect(0, 0, this.width, this.height, 4),
      Z.fill("#ede4d3"),
      Z.restore());
  }
}
class b6 extends n {
  color;
  constructor(Z, J = "#e8dfd0") {
    super();
    ((this.width = Z), (this.height = 1), (this.color = J));
  }
  render(Z) {
    (Z.beginPath(), Z.moveTo(0, 0), Z.lineTo(this.width, 0), Z.stroke(this.color, 1));
  }
}
class P0 extends n {
  render(Z) {}
}
class W7 extends N7 {
  constructor(Z) {
    super(Z);
    (this.on("wheel", () => {
      this.scene?.markDirty();
    }),
      this.on("pointerdown", () => {
        this.scene?.markDirty();
      }),
      this.on("pointermove", () => {
        this.scene?.markDirty();
      }));
  }
  update(Z, J) {
    n.prototype.update.call(this, Z, J);
    let Q = this,
      $ = Math.max(0, this.content.height - this.height);
    if (Q.targetY > 0) Q.targetY = 0;
    else if (Q.targetY < -$) Q.targetY = -$;
    let K = Q.targetY - this.content.y;
    if (Math.abs(K) > 0.05)
      ((this.content.y += K * (1 - Math.exp(-15 * (Z / 1000)))), this.scene?.markDirty());
    else this.content.y = Q.targetY;
  }
}
class Y7 extends n {
  scrollRef;
  constructor(Z, J) {
    super();
    ((this.scrollRef = Z), (this.width = J), (this.height = 3));
  }
  update(Z, J) {
    (super.update(Z, J), this.scene?.markDirty());
  }
  render(Z) {
    let J = -this.scrollRef.content.y,
      Q = Math.max(1, this.scrollRef.content.height - this.scrollRef.height),
      $ = Math.min(1, Math.max(0, J / Q));
    if ($ > 0)
      (Z.save(),
        Z.beginPath(),
        Z.roundRect(0, 0, this.width, this.height, 0),
        Z.fill("rgba(140, 118, 92, 0.15)"),
        Z.beginPath(),
        Z.roundRect(0, 0, this.width * $, this.height, 0),
        Z.fill("#8c765c"),
        Z.restore());
  }
}
async function y0(Z) {
  (window.history.pushState({}, "", Z), await D7(Z));
}
async function D7(Z) {
  try {
    let Q = await (await fetch(Z)).text(),
      q = new DOMParser().parseFromString(Q, "text/html").getElementById("page-data");
    if (q) {
      let G = q.textContent || "";
      if (((X0 = B7(G)), X0 && a)) I7();
    }
  } catch (J) {
    (console.error("SPA Navigation failed, reloading page...", J), (window.location.href = Z));
  }
}
function S8() {
  let Z = document.getElementById("search-data");
  if (Z)
    try {
      if (((v6 = JSON.parse(V7(Z.textContent || ""))), typeof window < "u"))
        window.searchDatabase = v6;
    } catch (J) {
      console.error("Failed to parse search database", J);
    }
}
function I7() {
  if (!a || !X0) return;
  let Z = a.root;
  if (Z && Z.children) {
    let X = [...Z.children];
    for (let z of X) a.remove(z);
  }
  let { innerWidth: J, innerHeight: Q } = window,
    $ = Math.min(920, J - 40),
    K = (J - $) / 2,
    q = new W7({ width: J, height: Q });
  a.add(q);
  let G = new Y7(q, J);
  if ((a.add(G), typeof window < "u")) ((window.currentScene = a), (window.mainScroll = q));
  let j = 20,
    F = new P0();
  F.setPosition(K, j);
  let U = new $0([{ text: X0.config.title, style: { bold: !0, href: "/" } }], {
    font: "600 24px Noto Sans SC, sans-serif",
    color: "#332f29",
    onLinkClick: () => y0("/"),
  });
  F.add(U);
  let H = new F7({
    width: 150,
    height: 32,
    placeholder: "搜索文章...",
    font: "14px Noto Sans SC, sans-serif",
    onChange: (X) => {
      let z = X.trim().toLowerCase();
      if (f0) (F.remove(f0), (f0 = null));
      if (!z) {
        a?.markDirty();
        return;
      }
      let I = v6
        .filter((M) => {
          let D = (M.title || "").toLowerCase(),
            Y = (M.description || "").toLowerCase(),
            P = (M.content || "").toLowerCase();
          if (z.startsWith("#")) {
            let w = z.slice(1);
            return M.tags && M.tags.some((W) => W.toLowerCase().includes(w));
          }
          return (
            (M.tags && M.tags.some((w) => w.toLowerCase().includes(z))) ||
            D.includes(z) ||
            Y.includes(z) ||
            P.includes(z)
          );
        })
        .slice(0, 5);
      if (I.length > 0) {
        ((f0 = new P0()), f0.setPosition($ - 250, 38));
        let M = 0;
        for (let D of I) {
          let Y = new U7({ width: 250, height: 50, bg: "#ede4d3", border: "#e8dfd0", radius: 4 });
          (Y.setPosition(0, M),
            (Y.interactive = !0),
            Y.on("click", () => {
              y0(D.url);
            }));
          let P = new z0(D.title, {
            font: "12px Noto Sans SC, sans-serif",
            color: "#332f29",
            maxWidth: 230,
          });
          (P.setPosition(10, 8), Y.add(P));
          let R = new z0(D.date, { font: "10px Noto Sans SC, sans-serif", color: "#7a7265" });
          (R.setPosition(10, 30), Y.add(R), f0.add(Y), (M += 52));
        }
        F.add(f0);
      }
      a?.markDirty();
    },
  });
  (H.setPosition($ - 150, 0), F.add(H), q.add(F), (j += 80));
  let N = new b6($);
  (N.setPosition(K, j), q.add(N), (j += 40));
  let V = X0.data;
  if (V.type === "index" || V.type === "taxonomy_single") {
    let X = new P0();
    X.setPosition(K, j);
    let z = 0;
    if (V.type === "taxonomy_single") {
      let M = new z0(`关于 “${V.term}” 的所有文章`, {
        font: "600 20px Noto Sans SC, sans-serif",
        color: "#332f29",
      });
      (M.setPosition(0, z), X.add(M), (z += 40));
    }
    let I = V.posts || [];
    for (let M of I) {
      let D = new P0();
      D.setPosition(0, z);
      let Y = new $0([{ text: M.title, style: { bold: !0, href: M.url } }], {
        font: "600 20px Noto Serif SC, serif",
        color: "#332f29",
        onLinkClick: () => y0(M.url),
      });
      D.add(Y);
      let P = Y.height + 8,
        R = M6.get(M.slug) ?? 0,
        w = `${M.date} · 阅读: ${R} 次`;
      if (M.tags && M.tags.length > 0) w += ` · 标签: ${M.tags.map((p) => `#${p}`).join(" ")}`;
      let W = new z0(w, { font: "13px Noto Sans SC, sans-serif", color: "#7a7265" });
      (W.setPosition(0, P), D.add(W), (P += 24));
      let L = new $0(Q6(M.summary || M.description || ""), {
        font: "15px Noto Serif SC, serif",
        color: "#7a7265",
        maxWidth: $,
      });
      (L.setPosition(0, P), D.add(L), (P += L.height + 16));
      let b = new $0([{ text: "阅读全文 →", style: { color: "#8c765c", href: M.url } }], {
        font: "14px Noto Sans SC, sans-serif",
        onLinkClick: () => y0(M.url),
      });
      (b.setPosition(0, P), D.add(b), (P += b.height + 30));
      let k = new b6($);
      (k.setPosition(0, P), D.add(k), X.add(D), (z += P + 40));
    }
    (q.add(X), (j += z));
  } else if (V.type === "page") {
    let X = new P0();
    X.setPosition(K, j);
    let z = 0,
      I = new z0(V.title, { font: "600 36px Noto Serif SC, serif", color: "#332f29", maxWidth: $ });
    (I.setPosition(0, z), X.add(I), (z += I.height + 12));
    let M = M6.get(V.slug) ?? 0,
      D = `${V.date} · 字数: ${V.word_count} 字 · 阅读: ${M} 次`;
    if (V.tags && V.tags.length > 0) D += ` · 标签: ${V.tags.map((W) => `#${W}`).join(" ")}`;
    let Y = new z0(D, { font: "14px Noto Sans SC, sans-serif", color: "#7a7265" });
    (Y.setPosition(0, z), X.add(Y), (z += Y.height + 40));
    let P = k8(V.content);
    for (let W of P) {
      let L;
      if (W.codeLang === "image") L = new X7(W.text || "", W.spans?.[0]?.text || "", $);
      else if (W.codeLang === "math") L = new z7(W.text || "", $);
      else if (
        W.type === "h1" ||
        W.type === "h2" ||
        W.type === "h3" ||
        W.type === "h4" ||
        W.type === "h5" ||
        W.type === "h6"
      ) {
        let b = W.type === "h1" ? 32 : W.type === "h2" ? 26 : W.type === "h3" ? 21 : 18;
        L = new $0(W.spans || [], {
          font: `600 ${b}px Noto Serif SC, serif`,
          color: "#332f29",
          maxWidth: $,
        });
      } else if (W.type === "pre") L = new M7(W.text || "", $);
      else if (W.type === "blockquote") L = new O7(W.spans || [], $);
      else
        L = new $0(W.spans || [], {
          font: "16px Noto Serif SC, serif",
          color: "#332f29",
          maxWidth: $,
        });
      (L.setPosition(0, z), X.add(L), (z += L.height + 24));
    }
    let R = new P0();
    if ((R.setPosition(0, z), V.navigation?.earlier)) {
      let W = V.navigation.earlier,
        L = new $0([{ text: `← ${W.title}`, style: { color: "#8c765c", href: W.url } }], {
          font: "14px Noto Sans SC, sans-serif",
          onLinkClick: () => y0(W.url),
        });
      (L.setPosition(0, 0), R.add(L));
    }
    if (V.navigation?.later) {
      let W = V.navigation.later,
        L = new $0([{ text: `${W.title} →`, style: { color: "#8c765c", href: W.url } }], {
          font: "14px Noto Sans SC, sans-serif",
          onLinkClick: () => y0(W.url),
        });
      (L.setPosition($ - L.width, 0), R.add(L));
    }
    (X.add(R), (z += 40), (z += 20));
    let w = new $0([{ text: "← 返回列表", style: { color: "#8c765c", href: "/" } }], {
      font: "14px Noto Sans SC, sans-serif",
      onLinkClick: () => y0("/"),
    });
    (w.setPosition(0, z), X.add(w), (z += w.height + 40), q.add(X), (j += z));
  }
  j += 40;
  let B = new P0();
  B.setPosition(K, j);
  let O = new z0(`© ${new Date().getFullYear()} Xuepoo. Crafted in VectoUI.`, {
    font: "12px Noto Sans SC, sans-serif",
    color: "#7a7265",
  });
  (O.setPosition(0, 0), B.add(O), q.add(B), (j += 80));
  try {
    let X = (z, I = "root") => {
      if (!z) return;
      let M = z.constructor ? z.constructor.name || "UnknownClass" : "NullConstructor",
        D = typeof z.render === "function";
      if (
        (console.log(`[DebugTree] ${I} -> ${M} (hasRender: ${D})`),
        z.children && Array.isArray(z.children))
      )
        for (let Y = 0; Y < z.children.length; Y++) X(z.children[Y], `${I}.${M}[${Y}]`);
    };
    (console.log("=== Debugging Node Tree ==="), X(a.root));
  } catch (X) {
    console.error("Failed to run debugNodeTree", X);
  }
}
async function v8() {
  try {
    let J = await (await fetch("/api/views")).json();
    for (let [Q, $] of Object.entries(J)) M6.set(Q, $);
  } catch (Z) {
    console.error("Failed to load view counts", Z);
  }
}
async function b8() {
  if (X0?.data?.type === "page") {
    let Z = X0.data.slug;
    try {
      let J = `/api/views?slug=${encodeURIComponent(Z)}`,
        $ = await (await fetch(J, { method: "POST" })).json();
      if ($ && typeof $.views === "number") M6.set(Z, $.views);
    } catch (J) {
      console.error("Failed to log view", J);
    }
  }
}
document.addEventListener("DOMContentLoaded", async () => {
  let Z = document.getElementById("vecto-canvas");
  if (!Z) return;
  ((a = new c6(Z, { maxFPS: 60 })),
    (a.renderMode = "onDemand"),
    a.start(),
    window.dispatchEvent(new Event("resize")),
    S8());
  let J = document.getElementById("page-data");
  if (J) X0 = B7(J.textContent || "");
  if (
    (await v8(),
    await b8(),
    $6(),
    window.addEventListener("resize", () => {
      $6();
    }),
    window.addEventListener("popstate", async () => {
      await D7(window.location.pathname);
    }),
    typeof document < "u" && document.fonts)
  )
    document.fonts.ready.then(() => {
      $6();
    });
});
function $6() {
  if (X0) I7();
}
