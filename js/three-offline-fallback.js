/**
 * three-offline-fallback.js
 * High-precision WebGL2 / WebGL1 implementation of the THREE API with physically-based
 * linear-space lighting, sRGB gamma correction, soft wrap shading, and multi-light speculars.
 */
(function () {
  if (typeof window !== 'undefined' && window.THREE && window.THREE.WebGLRenderer) {
    return;
  }

  const MathUtils = {
    clamp: (v, min, max) => Math.max(min, Math.min(max, v)),
    lerp: (x, y, t) => (1 - t) * x + t * y,
    degToRad: (d) => d * (Math.PI / 180),
    radToDeg: (r) => r * (180 / Math.PI),
    smoothstep: (x, min, max) => {
      if (x <= min) return 0;
      if (x >= max) return 1;
      x = (x - min) / (max - min);
      return x * x * (3 - 2 * x);
    }
  };

  class Color {
    constructor(r, g, b) {
      this.r = 1; this.g = 1; this.b = 1;
      if (r !== undefined) this.set(r, g, b);
    }
    set(r, g, b) {
      if (r instanceof Color) {
        this.r = r.r; this.g = r.g; this.b = r.b;
      } else if (typeof r === 'number' && g === undefined) {
        this.setHex(r);
      } else if (typeof r === 'string') {
        this.setStyle(r);
      } else if (typeof r === 'number') {
        this.r = r; this.g = g ?? r; this.b = b ?? r;
      }
      return this;
    }
    setHex(hex) {
      hex = Math.floor(hex);
      this.r = ((hex >> 16) & 255) / 255;
      this.g = ((hex >> 8) & 255) / 255;
      this.b = (hex & 255) / 255;
      return this;
    }
    setStyle(style) {
      if (style.startsWith('#')) {
        let hex = style.slice(1);
        if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
        this.setHex(parseInt(hex, 16));
      }
      return this;
    }
    copy(c) { this.r = c.r; this.g = c.g; this.b = c.b; return this; }
    clone() { return new Color(this.r, this.g, this.b); }
    lerp(c, alpha) {
      this.r += (c.r - this.r) * alpha;
      this.g += (c.g - this.g) * alpha;
      this.b += (c.b - this.b) * alpha;
      return this;
    }
    multiplyScalar(s) { this.r *= s; this.g *= s; this.b *= s; return this; }
    getHex() {
      return ((Math.round(MathUtils.clamp(this.r, 0, 1) * 255) << 16) ^
              (Math.round(MathUtils.clamp(this.g, 0, 1) * 255) << 8) ^
              (Math.round(MathUtils.clamp(this.b, 0, 1) * 255) << 0));
    }
  }

  class Vector2 {
    constructor(x = 0, y = 0) { this.x = x; this.y = y; }
    set(x, y) { this.x = x; this.y = y; return this; }
    copy(v) { this.x = v.x; this.y = v.y; return this; }
    clone() { return new Vector2(this.x, this.y); }
  }

  class Vector3 {
    constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
    set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
    copy(v) { this.x = v.x; this.y = v.y; this.z = v.z; return this; }
    clone() { return new Vector3(this.x, this.y, this.z); }
    add(v) { this.x += v.x; this.y += v.y; this.z += v.z; return this; }
    addScaledVector(v, s) { this.x += v.x * s; this.y += v.y * s; this.z += v.z * s; return this; }
    sub(v) { this.x -= v.x; this.y -= v.y; this.z -= v.z; return this; }
    subVectors(a, b) { this.x = a.x - b.x; this.y = a.y - b.y; this.z = a.z - b.z; return this; }
    addVectors(a, b) { this.x = a.x + b.x; this.y = a.y + b.y; this.z = a.z + b.z; return this; }
    multiplyScalar(s) { this.x *= s; this.y *= s; this.z *= s; return this; }
    dot(v) { return this.x * v.x + this.y * v.y + this.z * v.z; }
    crossVectors(a, b) {
      const ax = a.x, ay = a.y, az = a.z;
      const bx = b.x, by = b.y, bz = b.z;
      this.x = ay * bz - az * by;
      this.y = az * bx - ax * bz;
      this.z = ax * by - ay * bx;
      return this;
    }
    cross(v) { return this.crossVectors(this, v); }
    lengthSq() { return this.x * this.x + this.y * this.y + this.z * this.z; }
    length() { return Math.sqrt(this.lengthSq()); }
    distanceTo(v) {
      const dx = this.x - v.x, dy = this.y - v.y, dz = this.z - v.z;
      return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
    normalize() {
      const l = this.length() || 1;
      return this.multiplyScalar(1 / l);
    }
    lerp(v, alpha) {
      this.x += (v.x - this.x) * alpha;
      this.y += (v.y - this.y) * alpha;
      this.z += (v.z - this.z) * alpha;
      return this;
    }
    applyMatrix4(m) {
      const x = this.x, y = this.y, z = this.z;
      const e = m.elements;
      const w = 1 / (e[3] * x + e[7] * y + e[11] * z + e[15] || 1);
      this.x = (e[0] * x + e[4] * y + e[8] * z + e[12]) * w;
      this.y = (e[1] * x + e[5] * y + e[9] * z + e[13]) * w;
      this.z = (e[2] * x + e[6] * y + e[10] * z + e[14]) * w;
      return this;
    }
  }

  class Euler {
    constructor(x = 0, y = 0, z = 0, order = 'XYZ') {
      this.x = x; this.y = y; this.z = z; this.order = order;
    }
    set(x, y, z, order = this.order) {
      this.x = x; this.y = y; this.z = z; this.order = order;
      return this;
    }
    copy(e) { this.x = e.x; this.y = e.y; this.z = e.z; this.order = e.order; return this; }
  }

  class Quaternion {
    constructor(x = 0, y = 0, z = 0, w = 1) {
      this.x = x; this.y = y; this.z = z; this.w = w;
    }
    set(x, y, z, w) { this.x = x; this.y = y; this.z = z; this.w = w; return this; }
    setFromEuler(euler) {
      const x = euler.x, y = euler.y, z = euler.z;
      const c1 = Math.cos(x / 2), c2 = Math.cos(y / 2), c3 = Math.cos(z / 2);
      const s1 = Math.sin(x / 2), s2 = Math.sin(y / 2), s3 = Math.sin(z / 2);
      this.x = s1 * c2 * c3 + c1 * s2 * s3;
      this.y = c1 * s2 * c3 - s1 * c2 * s3;
      this.z = c1 * c2 * s3 + s1 * s2 * c3;
      this.w = c1 * c2 * c3 - s1 * s2 * s3;
      return this;
    }
  }

  class Matrix4 {
    constructor() {
      this.elements = new Float32Array([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1
      ]);
    }
    identity() {
      const e = this.elements;
      e[0]=1; e[4]=0; e[8]=0;  e[12]=0;
      e[1]=0; e[5]=1; e[9]=0;  e[13]=0;
      e[2]=0; e[6]=0; e[10]=1; e[14]=0;
      e[3]=0; e[7]=0; e[11]=0; e[15]=1;
      return this;
    }
    copy(m) { this.elements.set(m.elements); return this; }
    clone() { return new Matrix4().copy(this); }
    multiplyMatrices(a, b) {
      const ae = a.elements, be = b.elements, te = this.elements;
      const a11 = ae[0], a12 = ae[4], a13 = ae[8], a14 = ae[12];
      const a21 = ae[1], a22 = ae[5], a23 = ae[9], a24 = ae[13];
      const a31 = ae[2], a32 = ae[6], a33 = ae[10], a34 = ae[14];
      const a41 = ae[3], a42 = ae[7], a43 = ae[11], a44 = ae[15];

      const b11 = be[0], b12 = be[4], b13 = be[8], b14 = be[12];
      const b21 = be[1], b22 = be[5], b23 = be[9], b24 = be[13];
      const b31 = be[2], b32 = be[6], b33 = be[10], b34 = be[14];
      const b41 = be[3], b42 = be[7], b43 = be[11], b44 = be[15];

      te[0] = a11 * b11 + a12 * b21 + a13 * b31 + a14 * b41;
      te[4] = a11 * b12 + a12 * b22 + a13 * b32 + a14 * b42;
      te[8] = a11 * b13 + a12 * b23 + a13 * b33 + a14 * b43;
      te[12] = a11 * b14 + a12 * b24 + a13 * b34 + a14 * b44;

      te[1] = a21 * b11 + a22 * b21 + a23 * b31 + a24 * b41;
      te[5] = a21 * b12 + a22 * b22 + a23 * b32 + a24 * b42;
      te[9] = a21 * b13 + a22 * b23 + a23 * b33 + a24 * b43;
      te[13] = a21 * b14 + a22 * b24 + a23 * b34 + a24 * b44;

      te[2] = a31 * b11 + a32 * b21 + a33 * b31 + a34 * b41;
      te[6] = a31 * b12 + a32 * b22 + a33 * b32 + a34 * b42;
      te[10] = a31 * b13 + a32 * b23 + a33 * b33 + a34 * b43;
      te[14] = a31 * b14 + a32 * b24 + a33 * b34 + a34 * b44;

      te[3] = a41 * b11 + a42 * b21 + a43 * b31 + a44 * b41;
      te[7] = a41 * b12 + a42 * b22 + a43 * b32 + a44 * b42;
      te[11] = a41 * b13 + a42 * b23 + a43 * b33 + a44 * b43;
      te[15] = a41 * b14 + a42 * b24 + a43 * b34 + a44 * b44;
      return this;
    }
    multiply(m) { return this.multiplyMatrices(this, m); }
    compose(position, quaternion, scale) {
      const te = this.elements;
      const x = quaternion.x, y = quaternion.y, z = quaternion.z, w = quaternion.w;
      const x2 = x + x, y2 = y + y, z2 = z + z;
      const xx = x * x2, xy = x * y2, xz = x * z2;
      const yy = y * y2, yz = y * z2, zz = z * z2;
      const wx = w * x2, wy = w * y2, wz = w * z2;
      const sx = scale.x, sy = scale.y, sz = scale.z;

      te[0] = (1 - (yy + zz)) * sx;
      te[1] = (xy + wz) * sx;
      te[2] = (xz - wy) * sx;
      te[3] = 0;

      te[4] = (xy - wz) * sy;
      te[5] = (1 - (xx + zz)) * sy;
      te[6] = (yz + wx) * sy;
      te[7] = 0;

      te[8] = (xz + wy) * sz;
      te[9] = (yz - wx) * sz;
      te[10] = (1 - (xx + yy)) * sz;
      te[11] = 0;

      te[12] = position.x;
      te[13] = position.y;
      te[14] = position.z;
      te[15] = 1;
      return this;
    }
    makePerspective(fov, aspect, near, far) {
      const te = this.elements;
      const top = near * Math.tan(MathUtils.degToRad(0.5 * fov));
      const height = 2 * top;
      const width = aspect * height;
      const left = -0.5 * width;
      const right = left + width;
      const bottom = top - height;
      const x = 2 * near / (right - left);
      const y = 2 * near / (top - bottom);
      const a = (right + left) / (right - left);
      const b = (top + bottom) / (top - bottom);
      const c = -(far + near) / (far - near);
      const d = -2 * far * near / (far - near);

      te[0] = x; te[4] = 0; te[8] = a;  te[12] = 0;
      te[1] = 0; te[5] = y; te[9] = b;  te[13] = 0;
      te[2] = 0; te[6] = 0; te[10] = c; te[14] = d;
      te[3] = 0; te[7] = 0; te[11] = -1; te[15] = 0;
      return this;
    }
    lookAt(eye, target, up) {
      const te = this.elements;
      const z = new Vector3().subVectors(eye, target);
      if (z.lengthSq() === 0) z.z = 1;
      z.normalize();
      const x = new Vector3().crossVectors(up, z);
      if (x.lengthSq() === 0) {
        if (Math.abs(up.z) === 1) z.x += 0.0001;
        else z.z += 0.0001;
        z.normalize();
        x.crossVectors(up, z);
      }
      x.normalize();
      const y = new Vector3().crossVectors(z, x);
      te[0] = x.x; te[4] = y.x; te[8] = z.x;
      te[1] = x.y; te[5] = y.y; te[9] = z.y;
      te[2] = x.z; te[6] = y.z; te[10] = z.z;
      return this;
    }
    invert() {
      const te = this.elements,
        n11 = te[0], n21 = te[1], n31 = te[2], n41 = te[3],
        n12 = te[4], n22 = te[5], n32 = te[6], n42 = te[7],
        n13 = te[8], n23 = te[9], n33 = te[10], n43 = te[11],
        n14 = te[12], n24 = te[13], n34 = te[14], n44 = te[15],
        t11 = n23 * n34 * n42 - n24 * n33 * n42 + n24 * n32 * n43 - n22 * n34 * n43 - n23 * n32 * n44 + n22 * n33 * n44,
        t12 = n14 * n33 * n42 - n13 * n34 * n42 - n14 * n32 * n43 + n12 * n34 * n43 + n13 * n32 * n44 - n12 * n33 * n44,
        t13 = n13 * n24 * n42 - n14 * n23 * n42 + n14 * n22 * n43 - n12 * n24 * n43 - n13 * n22 * n44 + n12 * n23 * n44,
        t14 = n14 * n23 * n32 - n13 * n24 * n32 - n14 * n22 * n33 + n12 * n24 * n33 + n13 * n22 * n34 - n12 * n23 * n34;
      const det = n11 * t11 + n21 * t12 + n31 * t13 + n41 * t14;
      if (det === 0) return this.identity();
      const detInv = 1 / det;
      te[0] = t11 * detInv;
      te[1] = (n24 * n33 * n41 - n23 * n34 * n41 - n24 * n31 * n43 + n21 * n34 * n43 + n23 * n31 * n44 - n21 * n33 * n44) * detInv;
      te[2] = (n22 * n34 * n41 - n24 * n32 * n41 + n24 * n31 * n42 - n21 * n34 * n42 - n22 * n31 * n44 + n21 * n32 * n44) * detInv;
      te[3] = (n23 * n32 * n41 - n22 * n33 * n41 - n23 * n31 * n42 + n21 * n33 * n42 + n22 * n31 * n43 - n21 * n32 * n43) * detInv;
      te[4] = t12 * detInv;
      te[5] = (n13 * n34 * n41 - n14 * n33 * n41 + n14 * n31 * n43 - n11 * n34 * n43 - n13 * n31 * n44 + n11 * n33 * n44) * detInv;
      te[6] = (n14 * n32 * n41 - n12 * n34 * n41 - n14 * n31 * n42 + n11 * n34 * n42 + n12 * n31 * n44 - n11 * n32 * n44) * detInv;
      te[7] = (n12 * n33 * n41 - n13 * n32 * n41 + n13 * n31 * n42 - n11 * n33 * n42 - n12 * n31 * n43 + n11 * n32 * n43) * detInv;
      te[8] = t13 * detInv;
      te[9] = (n14 * n23 * n41 - n13 * n24 * n41 - n14 * n21 * n43 + n11 * n24 * n43 + n13 * n21 * n44 - n11 * n23 * n44) * detInv;
      te[10] = (n12 * n24 * n41 - n14 * n22 * n41 + n14 * n21 * n42 - n11 * n24 * n42 - n12 * n21 * n44 + n11 * n22 * n44) * detInv;
      te[11] = (n13 * n22 * n41 - n12 * n23 * n41 - n13 * n21 * n42 + n11 * n23 * n42 + n12 * n21 * n43 - n11 * n22 * n43) * detInv;
      te[12] = t14 * detInv;
      te[13] = (n13 * n24 * n31 - n14 * n23 * n31 + n14 * n21 * n33 - n11 * n24 * n33 - n13 * n21 * n34 + n11 * n23 * n34) * detInv;
      te[14] = (n14 * n22 * n31 - n12 * n24 * n31 - n14 * n21 * n32 + n11 * n24 * n32 + n12 * n21 * n34 - n11 * n22 * n34) * detInv;
      te[15] = (n12 * n23 * n31 - n13 * n22 * n31 + n13 * n21 * n32 - n11 * n23 * n32 - n12 * n21 * n33 + n11 * n22 * n33) * detInv;
      return this;
    }
  }

  function extractNormalMatrix3(mat4) {
    const m = new Matrix4().copy(mat4).invert();
    const e = m.elements;
    return new Float32Array([
      e[0], e[4], e[8],
      e[1], e[5], e[9],
      e[2], e[6], e[10]
    ]);
  }

  class Object3D {
    constructor() {
      this.position = new Vector3(0, 0, 0);
      this.rotation = new Euler(0, 0, 0, 'XYZ');
      this.quaternion = new Quaternion();
      this.scale = new Vector3(1, 1, 1);
      this.matrix = new Matrix4();
      this.matrixWorld = new Matrix4();
      this.children = [];
      this.parent = null;
      this.visible = true;
      this.castShadow = false;
      this.receiveShadow = false;
      this.renderOrder = 0;
      this.userData = {};
      this.up = new Vector3(0, 1, 0);
    }
    add(...objs) {
      for (const o of objs) {
        if (!o) continue;
        if (o.parent) o.parent.remove(o);
        o.parent = this;
        this.children.push(o);
      }
      return this;
    }
    remove(...objs) {
      for (const o of objs) {
        const idx = this.children.indexOf(o);
        if (idx !== -1) {
          o.parent = null;
          this.children.splice(idx, 1);
        }
      }
      return this;
    }
    lookAt(x, y, z) {
      const target = (x instanceof Vector3) ? x : new Vector3(x, y, z);
      const m = new Matrix4();
      if (this.isCamera || this.isLight) {
        m.lookAt(this.position, target, this.up);
      } else {
        m.lookAt(target, this.position, this.up);
      }
      const e = m.elements;
      const sy = Math.sqrt(e[0] * e[0] + e[1] * e[1]);
      if (sy > 1e-6) {
        this.rotation.x = Math.atan2(e[6], e[10]);
        this.rotation.y = Math.atan2(-e[2], sy);
        this.rotation.z = Math.atan2(e[1], e[0]);
      } else {
        this.rotation.x = Math.atan2(-e[9], e[5]);
        this.rotation.y = Math.atan2(-e[2], sy);
        this.rotation.z = 0;
      }
      this.quaternion.setFromEuler(this.rotation);
    }
    updateMatrix() {
      this.quaternion.setFromEuler(this.rotation);
      this.matrix.compose(this.position, this.quaternion, this.scale);
    }
    updateMatrixWorld(force) {
      this.updateMatrix();
      if (!this.parent) {
        this.matrixWorld.copy(this.matrix);
      } else {
        this.matrixWorld.multiplyMatrices(this.parent.matrixWorld, this.matrix);
      }
      for (let i = 0; i < this.children.length; i++) {
        this.children[i].updateMatrixWorld(force);
      }
    }
    traverse(cb) {
      cb(this);
      for (let i = 0; i < this.children.length; i++) {
        this.children[i].traverse(cb);
      }
    }
    getWorldPosition(target = new Vector3()) {
      this.updateMatrixWorld();
      const e = this.matrixWorld.elements;
      return target.set(e[12], e[13], e[14]);
    }
  }

  class Group extends Object3D {
    constructor() { super(); this.isGroup = true; }
  }

  class FogExp2 {
    constructor(color, density = 0.015) {
      this.color = new Color(color);
      this.density = density;
    }
  }

  class Scene extends Object3D {
    constructor() {
      super();
      this.isScene = true;
      this.background = null;
      this.fog = null;
    }
  }

  class PerspectiveCamera extends Object3D {
    constructor(fov = 50, aspect = 1, near = 0.1, far = 2000) {
      super();
      this.isCamera = true;
      this.fov = fov;
      this.aspect = aspect;
      this.near = near;
      this.far = far;
      this.projectionMatrix = new Matrix4();
      this.projectionMatrixInverse = new Matrix4();
      this.matrixWorldInverse = new Matrix4();
      this.updateProjectionMatrix();
    }
    updateProjectionMatrix() {
      this.projectionMatrix.makePerspective(this.fov, this.aspect, this.near, this.far);
      this.projectionMatrixInverse.copy(this.projectionMatrix).invert();
    }
    updateMatrixWorld(force) {
      super.updateMatrixWorld(force);
      this.matrixWorldInverse.copy(this.matrixWorld).invert();
    }
  }

  class BufferAttribute {
    constructor(array, itemSize, normalized = false) {
      this.array = array instanceof Float32Array || array instanceof Uint32Array || array instanceof Uint16Array
        ? array : new Float32Array(array);
      this.itemSize = itemSize;
      this.normalized = normalized;
      this.count = this.array.length / itemSize;
      this.needsUpdate = true;
    }
  }

  class Float32BufferAttribute extends BufferAttribute {
    constructor(array, itemSize) {
      super(array instanceof Float32Array ? array : new Float32Array(array), itemSize);
    }
  }

  class BufferGeometry {
    constructor() {
      this.attributes = {};
      this.index = null;
      this._glBuffers = null;
    }
    setAttribute(name, attr) {
      this.attributes[name] = attr;
      return this;
    }
    getAttribute(name) { return this.attributes[name]; }
    setIndex(idx) {
      if (Array.isArray(idx)) {
        const max = idx.reduce((m, v) => v > m ? v : m, 0);
        this.index = new BufferAttribute(max > 65535 ? new Uint32Array(idx) : new Uint16Array(idx), 1);
      } else {
        this.index = idx;
      }
      return this;
    }
    computeVertexNormals() {
      const posAttr = this.attributes.position;
      if (!posAttr) return;
      const positions = posAttr.array;
      const normals = new Float32Array(positions.length);
      const pA = new Vector3(), pB = new Vector3(), pC = new Vector3();
      const cb = new Vector3(), ab = new Vector3();

      if (this.index) {
        const indices = this.index.array;
        for (let i = 0; i < indices.length; i += 3) {
          const vA = indices[i] * 3, vB = indices[i + 1] * 3, vC = indices[i + 2] * 3;
          pA.set(positions[vA], positions[vA + 1], positions[vA + 2]);
          pB.set(positions[vB], positions[vB + 1], positions[vB + 2]);
          pC.set(positions[vC], positions[vC + 1], positions[vC + 2]);
          cb.subVectors(pC, pB);
          ab.subVectors(pA, pB);
          cb.cross(ab);
          normals[vA] += cb.x; normals[vA + 1] += cb.y; normals[vA + 2] += cb.z;
          normals[vB] += cb.x; normals[vB + 1] += cb.y; normals[vB + 2] += cb.z;
          normals[vC] += cb.x; normals[vC + 1] += cb.y; normals[vC + 2] += cb.z;
        }
      }
      for (let i = 0; i < normals.length; i += 3) {
        const l = Math.sqrt(normals[i]*normals[i] + normals[i+1]*normals[i+1] + normals[i+2]*normals[i+2]) || 1;
        normals[i] /= l; normals[i+1] /= l; normals[i+2] /= l;
      }
      this.setAttribute('normal', new Float32BufferAttribute(normals, 3));
    }
    dispose() {}
  }

  class BoxGeometry extends BufferGeometry {
    constructor(width = 1, height = 1, depth = 1) {
      super();
      const w = width / 2, h = height / 2, d = depth / 2;
      const positions = [
        -w, -h,  d,   w, -h,  d,   w,  h,  d,  -w,  h,  d,
         w, -h, -d,  -w, -h, -d,  -w,  h, -d,   w,  h, -d,
        -w,  h,  d,   w,  h,  d,   w,  h, -d,  -w,  h, -d,
        -w, -h, -d,   w, -h, -d,   w, -h,  d,  -w, -h,  d,
         w, -h,  d,   w, -h, -d,   w,  h, -d,   w,  h,  d,
        -w, -h, -d,  -w, -h,  d,  -w,  h,  d,  -w,  h, -d
      ];
      const normals = [
         0, 0, 1,  0, 0, 1,  0, 0, 1,  0, 0, 1,
         0, 0,-1,  0, 0,-1,  0, 0,-1,  0, 0,-1,
         0, 1, 0,  0, 1, 0,  0, 1, 0,  0, 1, 0,
         0,-1, 0,  0,-1, 0,  0,-1, 0,  0,-1, 0,
         1, 0, 0,  1, 0, 0,  1, 0, 0,  1, 0, 0,
        -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0
      ];
      const uvs = [], indices = [];
      for (let i = 0; i < 6; i++) {
        uvs.push(0, 0, 1, 0, 1, 1, 0, 1);
        const o = i * 4;
        indices.push(o, o + 1, o + 2, o, o + 2, o + 3);
      }
      this.setAttribute('position', new Float32BufferAttribute(positions, 3));
      this.setAttribute('normal', new Float32BufferAttribute(normals, 3));
      this.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
      this.setIndex(indices);
    }
  }

  class PlaneGeometry extends BufferGeometry {
    constructor(width = 1, height = 1, widthSegments = 1, heightSegments = 1) {
      super();
      const widthHalf = width / 2, heightHalf = height / 2;
      const gridX = Math.floor(widthSegments), gridY = Math.floor(heightSegments);
      const gridX1 = gridX + 1, gridY1 = gridY + 1;
      const segmentWidth = width / gridX, segmentHeight = height / gridY;
      const positions = [], normals = [], uvs = [], indices = [];
      for (let iy = 0; iy < gridY1; iy++) {
        const y = iy * segmentHeight - heightHalf;
        for (let ix = 0; ix < gridX1; ix++) {
          const x = ix * segmentWidth - widthHalf;
          positions.push(x, -y, 0);
          normals.push(0, 0, 1);
          uvs.push(ix / gridX, 1 - (iy / gridY));
        }
      }
      for (let iy = 0; iy < gridY; iy++) {
        for (let ix = 0; ix < gridX; ix++) {
          const a = ix + gridX1 * iy;
          const b = ix + gridX1 * (iy + 1);
          const c = (ix + 1) + gridX1 * (iy + 1);
          const d = (ix + 1) + gridX1 * iy;
          indices.push(a, b, d, b, c, d);
        }
      }
      this.setAttribute('position', new Float32BufferAttribute(positions, 3));
      this.setAttribute('normal', new Float32BufferAttribute(normals, 3));
      this.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
      this.setIndex(indices);
    }
  }

  class SphereGeometry extends BufferGeometry {
    constructor(radius = 1, widthSegments = 24, heightSegments = 16) {
      super();
      const positions = [], normals = [], uvs = [], indices = [];
      for (let iy = 0; iy <= heightSegments; iy++) {
        const v = iy / heightSegments;
        const theta = v * Math.PI;
        for (let ix = 0; ix <= widthSegments; ix++) {
          const u = ix / widthSegments;
          const phi = u * Math.PI * 2;
          const x = -radius * Math.cos(phi) * Math.sin(theta);
          const y = radius * Math.cos(theta);
          const z = radius * Math.sin(phi) * Math.sin(theta);
          positions.push(x, y, z);
          const n = new Vector3(x, y, z).normalize();
          normals.push(n.x, n.y, n.z);
          uvs.push(u, 1 - v);
        }
      }
      for (let iy = 0; iy < heightSegments; iy++) {
        for (let ix = 0; ix < widthSegments; ix++) {
          const a = iy * (widthSegments + 1) + ix + 1;
          const b = iy * (widthSegments + 1) + ix;
          const c = (iy + 1) * (widthSegments + 1) + ix;
          const d = (iy + 1) * (widthSegments + 1) + ix + 1;
          if (iy !== 0) indices.push(a, b, d);
          if (iy !== heightSegments - 1) indices.push(b, c, d);
        }
      }
      this.setAttribute('position', new Float32BufferAttribute(positions, 3));
      this.setAttribute('normal', new Float32BufferAttribute(normals, 3));
      this.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
      this.setIndex(indices);
    }
  }

  class CylinderGeometry extends BufferGeometry {
    constructor(radiusTop = 1, radiusBottom = 1, height = 1, radialSegments = 24, heightSegments = 1, openEnded = false) {
      super();
      const positions = [], normals = [], uvs = [], indices = [];
      const halfHeight = height / 2;
      const slope = (radiusBottom - radiusTop) / height;

      for (let y = 0; y <= heightSegments; y++) {
        const v = y / heightSegments;
        const py = v * height - halfHeight;
        const r = v * (radiusTop - radiusBottom) + radiusBottom;
        for (let x = 0; x <= radialSegments; x++) {
          const u = x / radialSegments;
          const theta = u * Math.PI * 2;
          const sinT = Math.sin(theta), cosT = Math.cos(theta);
          positions.push(r * sinT, py, r * cosT);
          const n = new Vector3(sinT, slope, cosT).normalize();
          normals.push(n.x, n.y, n.z);
          uvs.push(u, v);
        }
      }
      for (let y = 0; y < heightSegments; y++) {
        for (let x = 0; x < radialSegments; x++) {
          const a = y * (radialSegments + 1) + x;
          const b = (y + 1) * (radialSegments + 1) + x;
          const c = (y + 1) * (radialSegments + 1) + x + 1;
          const d = y * (radialSegments + 1) + x + 1;
          indices.push(a, d, b, b, d, c);
        }
      }
      this.setAttribute('position', new Float32BufferAttribute(positions, 3));
      this.setAttribute('normal', new Float32BufferAttribute(normals, 3));
      this.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
      this.setIndex(indices);
    }
  }

  class ConeGeometry extends CylinderGeometry {
    constructor(radius = 1, height = 1, radialSegments = 16, heightSegments = 1, openEnded = false) {
      super(0, radius, height, radialSegments, heightSegments, openEnded);
    }
  }

  class LatheGeometry extends BufferGeometry {
    constructor(points = [], segments = 32, phiStart = 0, phiLength = Math.PI * 2) {
      super();
      const positions = [], uvs = [], indices = [];
      const invSegments = 1 / segments;
      for (let i = 0; i <= segments; i++) {
        const phi = phiStart + i * invSegments * phiLength;
        const sin = Math.sin(phi), cos = Math.cos(phi);
        for (let j = 0; j < points.length; j++) {
          const pt = points[j];
          positions.push(pt.x * sin, pt.y, pt.x * cos);
          uvs.push(i / segments, j / (points.length - 1));
        }
      }
      for (let i = 0; i < segments; i++) {
        for (let j = 0; j < points.length - 1; j++) {
          const base = j + i * points.length;
          const a = base;
          const b = base + points.length;
          const c = base + points.length + 1;
          const d = base + 1;
          indices.push(a, b, d, b, c, d);
        }
      }
      this.setAttribute('position', new Float32BufferAttribute(positions, 3));
      this.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
      this.setIndex(indices);
      this.computeVertexNormals();
    }
  }

  const FrontSide = 0, BackSide = 1, DoubleSide = 2;
  const NormalBlending = 1, AdditiveBlending = 2;

  class Material {
    constructor(params = {}) {
      this.color = new Color(0xffffff);
      this.emissive = new Color(0x000000);
      this.emissiveIntensity = 1.0;
      this.roughness = 0.65;
      this.metalness = 0.05;
      this.opacity = 1.0;
      this.transparent = false;
      this.depthWrite = true;
      this.depthTest = true;
      this.side = FrontSide;
      this.blending = NormalBlending;
      this.vertexColors = false;
      this.transmission = 0;
      this.size = 1.0;
      this.setValues(params);
    }
    setValues(params) {
      if (!params) return;
      for (const k of Object.keys(params)) {
        const v = params[k];
        if (v === undefined) continue;
        if (k === 'color' || k === 'emissive') {
          this[k].set(v);
        } else {
          this[k] = v;
        }
      }
    }
  }

  class MeshStandardMaterial extends Material {}
  class MeshPhysicalMaterial extends Material {}
  class MeshBasicMaterial extends Material {
    constructor(params) { super(params); this.isMeshBasicMaterial = true; }
  }
  class PointsMaterial extends Material {
    constructor(params) { super(params); this.isPointsMaterial = true; }
  }
  class LineBasicMaterial extends Material {
    constructor(params) { super(params); this.isLineBasicMaterial = true; }
  }
  class ShaderMaterial extends Material {
    constructor(params = {}) {
      super(params);
      this.isShaderMaterial = true;
      this.uniforms = params.uniforms || {};
      this.vertexShader = params.vertexShader || '';
      this.fragmentShader = params.fragmentShader || '';
    }
  }

  class Mesh extends Object3D {
    constructor(geometry, material) {
      super();
      this.isMesh = true;
      this.geometry = geometry;
      this.material = material || new MeshStandardMaterial();
    }
  }

  class Points extends Object3D {
    constructor(geometry, material) {
      super();
      this.isPoints = true;
      this.geometry = geometry;
      this.material = material || new PointsMaterial();
    }
  }

  class LineSegments extends Object3D {
    constructor(geometry, material) {
      super();
      this.isLineSegments = true;
      this.geometry = geometry;
      this.material = material || new LineBasicMaterial();
    }
  }

  class Light extends Object3D {
    constructor(color = 0xffffff, intensity = 1) {
      super();
      this.isLight = true;
      this.color = new Color(color);
      this.intensity = intensity;
      this.shadow = { mapSize: new Vector2(1024, 1024), camera: {}, bias: 0 };
    }
  }
  class AmbientLight extends Light {
    constructor(color, intensity) { super(color, intensity); this.isAmbientLight = true; }
  }
  class HemisphereLight extends Light {
    constructor(skyColor = 0xffffff, groundColor = 0x444444, intensity = 1) {
      super(skyColor, intensity);
      this.isHemisphereLight = true;
      this.groundColor = new Color(groundColor);
    }
  }
  class DirectionalLight extends Light {
    constructor(color, intensity) {
      super(color, intensity);
      this.isDirectionalLight = true;
      this.target = new Object3D();
    }
  }
  class PointLight extends Light {
    constructor(color, intensity = 1, distance = 0, decay = 2) {
      super(color, intensity);
      this.isPointLight = true;
      this.distance = distance;
      this.decay = decay;
    }
  }
  class SpotLight extends Light {
    constructor(color, intensity = 1, distance = 0, angle = Math.PI / 4, penumbra = 0.2, decay = 2) {
      super(color, intensity);
      this.isSpotLight = true;
      this.distance = distance;
      this.angle = angle;
      this.penumbra = penumbra;
      this.decay = decay;
      this.target = new Object3D();
    }
  }

  class Clock {
    constructor() {
      this.startTime = performance.now();
      this.oldTime = this.startTime;
      this.elapsedTime = 0;
    }
    getDelta() {
      const now = performance.now();
      const diff = (now - this.oldTime) / 1000;
      this.oldTime = now;
      this.elapsedTime += diff;
      return diff;
    }
  }

  class Plane {
    constructor(normal = new Vector3(0, 1, 0), constant = 0) {
      this.normal = normal;
      this.constant = constant;
    }
  }

  class Raycaster {
    constructor() {
      this.ray = { origin: new Vector3(), direction: new Vector3() };
    }
    setFromCamera(coords, camera) {
      camera.updateMatrixWorld();
      this.ray.origin.set(
        camera.matrixWorld.elements[12],
        camera.matrixWorld.elements[13],
        camera.matrixWorld.elements[14]
      );
      const v = new Vector3(coords.x, coords.y, 0.5);
      v.applyMatrix4(camera.projectionMatrixInverse);
      v.applyMatrix4(camera.matrixWorld);
      this.ray.direction.subVectors(v, this.ray.origin).normalize();
    }
    intersectPlane(plane, target = new Vector3()) {
      const denom = plane.normal.dot(this.ray.direction);
      if (Math.abs(denom) < 1e-6) return null;
      const t = -(this.ray.origin.dot(plane.normal) + plane.constant) / denom;
      if (t < 0) return null;
      return target.copy(this.ray.origin).addScaledVector(this.ray.direction, t);
    }
  }

  // Physically-balanced sRGB-preserving Voxel Shader with rich shadows & warm point lights
  const STANDARD_VERT = `
    precision highp float;
    uniform mat4 modelMatrix;
    uniform mat4 viewMatrix;
    uniform mat4 modelViewMatrix;
    uniform mat4 projectionMatrix;
    uniform mat3 normalMatrix;
    uniform float uPointSize;

    attribute vec3 position;
    attribute vec3 normal;
    attribute vec2 uv;
    attribute vec3 color;

    varying vec3 vWorldPos;
    varying vec3 vWorldNormal;
    varying vec3 vColor;
    varying vec2 vUv;
    varying float vViewDepth;

    void main() {
      vec4 worldPos = modelMatrix * vec4(position, 1.0);
      vWorldPos = worldPos.xyz;
      vWorldNormal = normalize(mat3(modelMatrix) * normal);
      vColor = color;
      vUv = uv;
      vec4 mvPos = viewMatrix * worldPos;
      vViewDepth = -mvPos.z;
      gl_Position = projectionMatrix * mvPos;
      gl_PointSize = uPointSize * (28.0 / max(1.0, vViewDepth));
    }
  `;

  const STANDARD_FRAG = `
    precision highp float;
    uniform vec3 cameraPosition;
    uniform vec3 uBaseColor;
    uniform vec3 uEmissive;
    uniform float uEmissiveIntensity;
    uniform float uRoughness;
    uniform float uMetalness;
    uniform float uOpacity;
    uniform float uUseVertexColors;
    uniform float uIsUnlit;
    uniform float uTransmission;

    uniform vec3 uAmbientColor;
    uniform vec3 uHemiSky;
    uniform vec3 uHemiGround;
    uniform float uHemiIntensity;

    uniform vec3 uDirLightDir[2];
    uniform vec3 uDirLightColor[2];

    uniform vec3 uPointLightPos[6];
    uniform vec3 uPointLightColor[6];
    uniform float uPointLightDist[6];

    uniform vec3 uFogColor;
    uniform float uFogDensity;

    varying vec3 vWorldPos;
    varying vec3 vWorldNormal;
    varying vec3 vColor;
    varying vec2 vUv;
    varying float vViewDepth;

    void main() {
      vec3 srgbAlbedo = uBaseColor * mix(vec3(1.0), vColor, uUseVertexColors);
      if (uIsUnlit > 0.5) {
        vec3 col = srgbAlbedo + uEmissive * uEmissiveIntensity;
        gl_FragColor = vec4(clamp(col, 0.0, 1.0), uOpacity);
        return;
      }

      // Convert sRGB vertex color to linear space so dark wood, deep reds, and lush greens stay rich!
      vec3 linearAlbedo = pow(max(srgbAlbedo, vec3(0.0)), vec3(2.1));

      // Detect emissive voxels (baked brightness > 1.02 in VoxelBuilder)
      float isEmissiveVoxel = step(1.02, max(vColor.r, max(vColor.g, vColor.b)));
      if (isEmissiveVoxel > 0.5) {
        gl_FragColor = vec4(clamp(srgbAlbedo * 1.15, 0.0, 1.0), uOpacity);
        return;
      }

      vec3 N = normalize(vWorldNormal);
      if (!gl_FrontFacing) N = -N;
      vec3 V = normalize(cameraPosition - vWorldPos);

      float hemiW = 0.5 * N.y + 0.5;
      vec3 lighting = uAmbientColor * 0.65 + mix(uHemiGround, uHemiSky, hemiW) * (uHemiIntensity * 0.55);

      vec3 specAccum = vec3(0.0);
      float shininess = mix(84.0, 10.0, clamp(uRoughness, 0.05, 1.0));
      float specStrength = mix(0.55, 0.05, clamp(uRoughness, 0.0, 1.0)) + uMetalness * 0.45;

      for (int i = 0; i < 2; i++) {
        vec3 L = normalize(uDirLightDir[i]);
        float ndl = max(dot(N, L), 0.0);
        float wrap = max((dot(N, L) + 0.15) / 1.15, 0.0);
        lighting += uDirLightColor[i] * mix(ndl, wrap, 0.28) * 0.88;
        if (ndl > 0.0) {
          vec3 H = normalize(L + V);
          float spec = pow(max(dot(N, H), 0.0), shininess);
          specAccum += uDirLightColor[i] * spec * specStrength;
        }
      }

      for (int i = 0; i < 6; i++) {
        vec3 toLight = uPointLightPos[i] - vWorldPos;
        float dist = length(toLight);
        float maxD = uPointLightDist[i];
        if (maxD > 0.0 && dist < maxD) {
          vec3 L = toLight / max(dist, 0.0001);
          float atten = pow(clamp(1.0 - dist / maxD, 0.0, 1.0), 1.85);
          float ndl = max((dot(N, L) + 0.22) / 1.22, 0.0);
          lighting += uPointLightColor[i] * ndl * atten * 0.95;
          vec3 H = normalize(L + V);
          float spec = pow(max(dot(N, H), 0.0), shininess * 0.7);
          specAccum += uPointLightColor[i] * spec * atten * specStrength;
        }
      }

      vec3 linearCol = linearAlbedo * lighting + specAccum * 0.55 + uEmissive * uEmissiveIntensity;

      // Subtle underwater depth tint for submerged terrain below y = -0.36
      if (vWorldPos.y < -0.38) {
        float subDepth = clamp((-0.38 - vWorldPos.y) / 1.65, 0.0, 1.0);
        // Animated golden underwater caustics on submerged rocks & corals!
        float c = sin(vWorldPos.x * 7.5 + vWorldPos.z * 5.5) * cos(vWorldPos.x * 5.2 - vWorldPos.z * 8.1);
        float caustic = pow(max(0.0, c), 2.0) * 0.18 * (1.0 - subDepth * 0.5);
        linearCol += vec3(0.18, 0.55, 0.68) * caustic;
        linearCol = mix(linearCol, linearCol * vec3(0.55, 0.85, 0.96), subDepth * 0.45);
      }

      // ACES Filmic Tone Mapping + convert back to sRGB
      linearCol = (linearCol * (2.51 * linearCol + 0.03)) / (linearCol * (2.43 * linearCol + 0.59) + 0.14);
      vec3 finalSrgb = pow(clamp(linearCol, 0.0, 1.0), vec3(1.0 / 2.1));

      float fogFactor = 1.0 - exp(-uFogDensity * uFogDensity * vViewDepth * vViewDepth);
      finalSrgb = mix(finalSrgb, uFogColor, clamp(fogFactor, 0.0, 0.65));

      gl_FragColor = vec4(finalSrgb, uOpacity);
    }
  `;

  class WebGLRenderer {
    constructor(params = {}) {
      this.domElement = params.canvas || document.createElement('canvas');
      const glOpts = {
        alpha: Boolean(params.alpha),
        antialias: params.antialias !== false,
        depth: true,
        premultipliedAlpha: false,
        preserveDrawingBuffer: true
      };
      this.gl = this.domElement.getContext('webgl2', glOpts) ||
                this.domElement.getContext('webgl', glOpts) ||
                this.domElement.getContext('experimental-webgl', glOpts);
      this.shadowMap = { enabled: true, type: 2 };
      this._pixelRatio = 1;
      this._width = 800;
      this._height = 600;
      this._clearColor = new Color(0x0d131f);
      this._clearAlpha = 1.0;
      this._programs = new WeakMap();
      this._stdProgram = null;
      if (this.gl) {
        const gl = this.gl;
        gl.getExtension('OES_element_index_uint');
        gl.getExtension('OES_standard_derivatives');
        this._stdProgram = this._compileProgram(STANDARD_VERT, STANDARD_FRAG);
      }
    }

    setPixelRatio(r) {
      this._pixelRatio = Math.min(r || 1, 2);
      this.setSize(this._width, this._height, false);
    }

    setSize(w, h, updateStyle = true) {
      this._width = w;
      this._height = h;
      this.domElement.width = Math.floor(w * this._pixelRatio);
      this.domElement.height = Math.floor(h * this._pixelRatio);
      if (updateStyle) {
        this.domElement.style.width = w + 'px';
        this.domElement.style.height = h + 'px';
      }
      if (this.gl) {
        this.gl.viewport(0, 0, this.domElement.width, this.domElement.height);
      }
    }

    _compileProgram(vsSource, fsSource) {
      const gl = this.gl;
      const compile = (type, src) => {
        const s = gl.createShader(type);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
          console.warn('Shader compile warning:', gl.getShaderInfoLog(s));
        }
        return s;
      };
      const vs = compile(gl.VERTEX_SHADER, vsSource);
      const fs = compile(gl.FRAGMENT_SHADER, fsSource);
      const prog = gl.createProgram();
      gl.attachShader(prog, vs);
      gl.attachShader(prog, fs);
      gl.linkProgram(prog);
      return prog;
    }

    _getShaderMaterialProgram(mat) {
      if (this._programs.has(mat)) return this._programs.get(mat);
      const headerVS = `
        precision highp float;
        uniform mat4 modelMatrix;
        uniform mat4 modelViewMatrix;
        uniform mat4 projectionMatrix;
        uniform mat4 viewMatrix;
        uniform mat3 normalMatrix;
        uniform vec3 cameraPosition;
        attribute vec3 position;
        attribute vec3 normal;
        attribute vec2 uv;
        attribute vec3 color;
      `;
      const headerFS = `
        #extension GL_OES_standard_derivatives : enable
        precision highp float;
        uniform mat4 viewMatrix;
        uniform vec3 cameraPosition;
      `;
      const prog = this._compileProgram(headerVS + '\n' + mat.vertexShader, headerFS + '\n' + mat.fragmentShader);
      this._programs.set(mat, prog);
      return prog;
    }

    _syncGeometryBuffers(geom) {
      const gl = this.gl;
      if (!geom._glBuffers) geom._glBuffers = {};
      for (const name of Object.keys(geom.attributes)) {
        const attr = geom.attributes[name];
        if (!geom._glBuffers[name]) {
          geom._glBuffers[name] = gl.createBuffer();
          attr.needsUpdate = true;
        }
        if (attr.needsUpdate) {
          gl.bindBuffer(gl.ARRAY_BUFFER, geom._glBuffers[name]);
          gl.bufferData(gl.ARRAY_BUFFER, attr.array, gl.DYNAMIC_DRAW);
          attr.needsUpdate = false;
        }
      }
      if (geom.index) {
        if (!geom._glBuffers.index) {
          geom._glBuffers.index = gl.createBuffer();
          geom.index.needsUpdate = true;
        }
        if (geom.index.needsUpdate) {
          gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, geom._glBuffers.index);
          gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, geom.index.array, gl.STATIC_DRAW);
          geom.index.needsUpdate = false;
        }
      }
    }

    render(scene, camera) {
      const gl = this.gl;
      if (!gl) return;
      scene.updateMatrixWorld();
      camera.updateMatrixWorld();

      if (scene.background instanceof Color) {
        this._clearColor.copy(scene.background);
      }
      gl.viewport(0, 0, this.domElement.width, this.domElement.height);
      gl.clearColor(this._clearColor.r, this._clearColor.g, this._clearColor.b, this._clearAlpha);
      gl.enable(gl.DEPTH_TEST);
      gl.depthMask(true);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      const opaqueList = [];
      const transparentList = [];
      const dirLights = [];
      const pointLights = [];
      let ambientColor = new Color(0, 0, 0);
      let hemiSky = new Color(0, 0, 0), hemiGround = new Color(0, 0, 0), hemiInt = 0;

      const camPos = new Vector3(
        camera.matrixWorld.elements[12],
        camera.matrixWorld.elements[13],
        camera.matrixWorld.elements[14]
      );

      scene.traverse((obj) => {
        if (!obj.visible) return;
        if (obj.isLight && obj.intensity > 0) {
          if (obj.isAmbientLight) {
            ambientColor.r += obj.color.r * obj.intensity;
            ambientColor.g += obj.color.g * obj.intensity;
            ambientColor.b += obj.color.b * obj.intensity;
          } else if (obj.isHemisphereLight) {
            hemiSky.copy(obj.color);
            hemiGround.copy(obj.groundColor);
            hemiInt = obj.intensity;
          } else if (obj.isDirectionalLight && dirLights.length < 2) {
            const p = obj.getWorldPosition(new Vector3());
            const t = obj.target ? obj.target.getWorldPosition(new Vector3()) : new Vector3(0, 0, 0);
            dirLights.push({
              dir: p.sub(t).normalize(),
              color: obj.color.clone().multiplyScalar(obj.intensity)
            });
          } else if ((obj.isPointLight || obj.isSpotLight) && pointLights.length < 6) {
            pointLights.push({
              pos: obj.getWorldPosition(new Vector3()),
              color: obj.color.clone().multiplyScalar(obj.intensity),
              dist: obj.distance || 14.0
            });
          }
        } else if ((obj.isMesh || obj.isPoints || obj.isLineSegments) && obj.geometry && obj.material) {
          let p = obj.parent, vis = true;
          while (p) { if (!p.visible) { vis = false; break; } p = p.parent; }
          if (!vis) return;
          if (obj.material.transparent || obj.renderOrder > 0) {
            const wp = obj.getWorldPosition(new Vector3());
            obj._camDist = wp.distanceTo(camPos);
            transparentList.push(obj);
          } else {
            opaqueList.push(obj);
          }
        }
      });

      transparentList.sort((a, b) => {
        if (a.renderOrder !== b.renderOrder) return a.renderOrder - b.renderOrder;
        return b._camDist - a._camDist;
      });

      const drawObject = (obj) => {
        const geom = obj.geometry;
        const mat = obj.material;
        this._syncGeometryBuffers(geom);

        if (mat.side === DoubleSide) {
          gl.disable(gl.CULL_FACE);
        } else {
          gl.enable(gl.CULL_FACE);
          gl.cullFace(mat.side === BackSide ? gl.FRONT : gl.BACK);
        }

        if (mat.transparent) {
          gl.enable(gl.BLEND);
          if (mat.blending === AdditiveBlending) {
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
          } else {
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
          }
        } else {
          gl.disable(gl.BLEND);
        }
        gl.depthMask(mat.depthWrite !== false);

        const modelViewMatrix = new Matrix4().multiplyMatrices(camera.matrixWorldInverse, obj.matrixWorld);
        const normalMatrix = extractNormalMatrix3(modelViewMatrix);

        let prog;
        if (mat.isShaderMaterial) {
          prog = this._getShaderMaterialProgram(mat);
          gl.useProgram(prog);
          const setMat4 = (n, m) => { const l = gl.getUniformLocation(prog, n); if (l) gl.uniformMatrix4fv(l, false, m.elements); };
          const setMat3 = (n, m) => { const l = gl.getUniformLocation(prog, n); if (l) gl.uniformMatrix3fv(l, false, m); };
          const setVec3 = (n, v) => { const l = gl.getUniformLocation(prog, n); if (l) gl.uniform3f(l, v.x ?? v.r ?? 0, v.y ?? v.g ?? 0, v.z ?? v.b ?? 0); };
          setMat4('modelMatrix', obj.matrixWorld);
          setMat4('viewMatrix', camera.matrixWorldInverse);
          setMat4('modelViewMatrix', modelViewMatrix);
          setMat4('projectionMatrix', camera.projectionMatrix);
          setMat3('normalMatrix', normalMatrix);
          setVec3('cameraPosition', camPos);

          for (const uName of Object.keys(mat.uniforms)) {
            const u = mat.uniforms[uName];
            if (!u || u.value === undefined || u.value === null) continue;
            const loc = gl.getUniformLocation(prog, uName);
            if (!loc) continue;
            const val = u.value;
            if (typeof val === 'number') {
              gl.uniform1f(loc, val);
            } else if (typeof val === 'boolean') {
              gl.uniform1i(loc, val ? 1 : 0);
            } else if (val instanceof Color) {
              gl.uniform3f(loc, val.r, val.g, val.b);
            } else if (val instanceof Vector3) {
              gl.uniform3f(loc, val.x, val.y, val.z);
            } else if (val instanceof Vector2) {
              gl.uniform2f(loc, val.x, val.y);
            } else if (Array.isArray(val) && val[0] instanceof Vector3) {
              const flat = new Float32Array(val.length * 3);
              for (let i = 0; i < val.length; i++) {
                flat[i*3] = val[i].x; flat[i*3+1] = val[i].y; flat[i*3+2] = val[i].z;
              }
              gl.uniform3fv(loc, flat);
            }
          }
        } else {
          prog = this._stdProgram;
          gl.useProgram(prog);
          const u1f = (n, v) => { const l = gl.getUniformLocation(prog, n); if (l) gl.uniform1f(l, v); };
          const u3f = (n, x, y, z) => { const l = gl.getUniformLocation(prog, n); if (l) gl.uniform3f(l, x, y, z); };
          gl.uniformMatrix4fv(gl.getUniformLocation(prog, 'modelMatrix'), false, obj.matrixWorld.elements);
          gl.uniformMatrix4fv(gl.getUniformLocation(prog, 'viewMatrix'), false, camera.matrixWorldInverse.elements);
          gl.uniformMatrix4fv(gl.getUniformLocation(prog, 'modelViewMatrix'), false, modelViewMatrix.elements);
          gl.uniformMatrix4fv(gl.getUniformLocation(prog, 'projectionMatrix'), false, camera.projectionMatrix.elements);
          gl.uniformMatrix3fv(gl.getUniformLocation(prog, 'normalMatrix'), false, normalMatrix);
          u3f('cameraPosition', camPos.x, camPos.y, camPos.z);

          u3f('uBaseColor', mat.color.r, mat.color.g, mat.color.b);
          u3f('uEmissive', mat.emissive.r, mat.emissive.g, mat.emissive.b);
          u1f('uEmissiveIntensity', mat.emissiveIntensity ?? 1.0);
          u1f('uRoughness', mat.roughness ?? 0.65);
          u1f('uMetalness', mat.metalness ?? 0.05);
          u1f('uOpacity', mat.opacity ?? 1.0);
          u1f('uUseVertexColors', (mat.vertexColors && geom.attributes.color) ? 1.0 : 0.0);
          u1f('uIsUnlit', (mat.isMeshBasicMaterial || mat.isPointsMaterial || mat.isLineBasicMaterial) ? 1.0 : 0.0);
          u1f('uTransmission', mat.transmission ?? 0.0);
          u1f('uPointSize', mat.size ?? 1.5);

          u3f('uAmbientColor', ambientColor.r, ambientColor.g, ambientColor.b);
          u3f('uHemiSky', hemiSky.r, hemiSky.g, hemiSky.b);
          u3f('uHemiGround', hemiGround.r, hemiGround.g, hemiGround.b);
          u1f('uHemiIntensity', hemiInt);

          for (let i = 0; i < 2; i++) {
            const dl = dirLights[i];
            if (dl) {
              u3f(`uDirLightDir[${i}]`, dl.dir.x, dl.dir.y, dl.dir.z);
              u3f(`uDirLightColor[${i}]`, dl.color.r, dl.color.g, dl.color.b);
            } else {
              u3f(`uDirLightDir[${i}]`, 0, 1, 0);
              u3f(`uDirLightColor[${i}]`, 0, 0, 0);
            }
          }
          for (let i = 0; i < 6; i++) {
            const pl = pointLights[i];
            if (pl) {
              u3f(`uPointLightPos[${i}]`, pl.pos.x, pl.pos.y, pl.pos.z);
              u3f(`uPointLightColor[${i}]`, pl.color.r, pl.color.g, pl.color.b);
              u1f(`uPointLightDist[${i}]`, pl.dist);
            } else {
              u3f(`uPointLightPos[${i}]`, 0, 0, 0);
              u3f(`uPointLightColor[${i}]`, 0, 0, 0);
              u1f(`uPointLightDist[${i}]`, 0);
            }
          }

          if (scene.fog) {
            u3f('uFogColor', scene.fog.color.r, scene.fog.color.g, scene.fog.color.b);
            u1f('uFogDensity', scene.fog.density || 0.012);
          } else {
            u3f('uFogColor', this._clearColor.r, this._clearColor.g, this._clearColor.b);
            u1f('uFogDensity', 0.0);
          }
        }

        const bindAttr = (name, defaultVec3) => {
          const loc = gl.getAttribLocation(prog, name);
          if (loc === -1) return;
          const attr = geom.attributes[name];
          if (attr && geom._glBuffers[name]) {
            gl.bindBuffer(gl.ARRAY_BUFFER, geom._glBuffers[name]);
            gl.enableVertexAttribArray(loc);
            gl.vertexAttribPointer(loc, attr.itemSize, gl.FLOAT, false, 0, 0);
          } else {
            gl.disableVertexAttribArray(loc);
            if (defaultVec3) gl.vertexAttrib3f(loc, defaultVec3[0], defaultVec3[1], defaultVec3[2]);
          }
        };

        bindAttr('position', [0, 0, 0]);
        bindAttr('normal', [0, 1, 0]);
        bindAttr('uv', [0, 0, 0]);
        bindAttr('color', [1, 1, 1]);

        if (obj.isPoints) {
          gl.drawArrays(gl.POINTS, 0, geom.attributes.position.count);
        } else if (obj.isLineSegments) {
          gl.drawArrays(gl.LINES, 0, geom.attributes.position.count);
        } else if (geom.index) {
          gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, geom._glBuffers.index);
          const type = geom.index.array instanceof Uint32Array ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT;
          gl.drawElements(gl.TRIANGLES, geom.index.count, type, 0);
        } else {
          gl.drawArrays(gl.TRIANGLES, 0, geom.attributes.position.count);
        }
      };

      for (let i = 0; i < opaqueList.length; i++) drawObject(opaqueList[i]);
      for (let i = 0; i < transparentList.length; i++) drawObject(transparentList[i]);
      gl.depthMask(true);
    }
  }

  window.THREE = {
    MathUtils, Color, Vector2, Vector3, Euler, Quaternion, Matrix4,
    Object3D, Group, FogExp2, Scene, PerspectiveCamera,
    BufferAttribute, Float32BufferAttribute, BufferGeometry,
    BoxGeometry, PlaneGeometry, SphereGeometry, CylinderGeometry, ConeGeometry, LatheGeometry,
    Material, MeshStandardMaterial, MeshPhysicalMaterial, MeshBasicMaterial,
    PointsMaterial, LineBasicMaterial, ShaderMaterial,
    Mesh, Points, LineSegments,
    AmbientLight, HemisphereLight, DirectionalLight, PointLight, SpotLight,
    Clock, Plane, Raycaster, WebGLRenderer,
    FrontSide, BackSide, DoubleSide, NormalBlending, AdditiveBlending,
    PCFSoftShadowMap: 2, ACESFilmicToneMapping: 4, sRGBEncoding: 3001
  };
})();
