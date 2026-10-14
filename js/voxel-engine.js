/**
 * voxel-engine.js
 * High-density Voxel Grid compiler with hidden-face culling,
 * 4-neighbor per-vertex Voxel Ambient Occlusion (AO), subtle bevel normal perturbation,
 * organic micro-color variation, and 3D pixel-art font rendering for brass plaques.
 */
(function () {
  class VoxelBuilder {
    constructor(voxelSize = 0.09) {
      this.voxelSize = voxelSize;
      this.voxels = new Map();
    }

    _key(x, y, z) {
      return `${x | 0},${y | 0},${z | 0}`;
    }

    set(x, y, z, colorHex, opts = {}) {
      const ix = Math.round(x), iy = Math.round(y), iz = Math.round(z);
      const c = new THREE.Color(colorHex);
      if (opts.jitter !== 0) {
        const j = opts.jitter ?? 0.035;
        // Deterministic spatial hash for organic micro-tint per voxel
        const h = Math.sin(ix * 12.9898 + iy * 78.233 + iz * 37.719) * 43758.5453;
        const frac = (h - Math.floor(h)) - 0.5;
        c.r = Math.max(0, Math.min(1, c.r + frac * j));
        c.g = Math.max(0, Math.min(1, c.g + frac * j));
        c.b = Math.max(0, Math.min(1, c.b + frac * j));
      }
      this.voxels.set(`${ix},${iy},${iz}`, {
        x: ix, y: iy, z: iz,
        r: c.r, g: c.g, b: c.b,
        emissive: Boolean(opts.emissive)
      });
      return this;
    }

    del(x, y, z) {
      this.voxels.delete(`${Math.round(x)},${Math.round(y)},${Math.round(z)}`);
      return this;
    }

    has(x, y, z) {
      return this.voxels.has(`${Math.round(x)},${Math.round(y)},${Math.round(z)}`);
    }

    box(x1, y1, z1, x2, y2, z2, colorHex, opts = {}) {
      const minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
      const minY = Math.min(y1, y2), maxY = Math.max(y1, y2);
      const minZ = Math.min(z1, z2), maxZ = Math.max(z1, z2);
      for (let x = minX; x <= maxX; x++) {
        for (let y = minY; y <= maxY; y++) {
          for (let z = minZ; z <= maxZ; z++) {
            this.set(x, y, z, colorHex, opts);
          }
        }
      }
      return this;
    }

    disc(cx, y, cz, radius, colorHex, opts = {}) {
      const r2 = radius * radius;
      const ir = Math.ceil(radius);
      for (let dx = -ir; dx <= ir; dx++) {
        for (let dz = -ir; dz <= ir; dz++) {
          if (dx * dx + dz * dz <= r2) {
            this.set(cx + dx, y, cz + dz, colorHex, opts);
          }
        }
      }
      return this;
    }

    cylinder(cx, y1, cz, radius, height, colorHex, opts = {}) {
      for (let dy = 0; dy < height; dy++) {
        this.disc(cx, y1 + dy, cz, radius, colorHex, opts);
      }
      return this;
    }

    sphere(cx, cy, cz, rx, ry, rz, colorHex, opts = {}) {
      const irx = Math.ceil(rx), iry = Math.ceil(ry), irz = Math.ceil(rz);
      for (let dx = -irx; dx <= irx; dx++) {
        for (let dy = -iry; dy <= iry; dy++) {
          for (let dz = -irz; dz <= irz; dz++) {
            const d = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) + (dz * dz) / (rz * rz);
            if (d <= 1.0) {
              this.set(cx + dx, cy + dy, cz + dz, colorHex, opts);
            }
          }
        }
      }
      return this;
    }

    /**
     * Clip all voxels outside the inner contour of the horizontal bottle so submerged
     * island foundations conform cleanly to the curved glass cylinder.
     */
    clipToBottleInterior(worldOffsetX = 0, worldOffsetY = 0, worldOffsetZ = 0, maxRadius = 2.04) {
      const s = this.voxelSize;
      for (const [k, v] of this.voxels.entries()) {
        const wx = worldOffsetX + v.x * s;
        const wy = worldOffsetY + v.y * s;
        const wz = worldOffsetZ + v.z * s;
        let rLimit = maxRadius;
        if (wx < -4.7) {
          const t = Math.max(0, Math.min(1, (-4.7 - wx) / 1.15));
          rLimit = maxRadius * Math.sqrt(Math.max(0.05, 1 - t * t * 0.85));
        } else if (wx > 3.6) {
          const t = Math.max(0, Math.min(1, (wx - 3.6) / 1.8));
          rLimit = maxRadius * (1 - t * 0.62);
        }
        if (wy * wy + wz * wz > rLimit * rLimit || wy < -2.02) {
          this.voxels.delete(k);
        }
      }
      return this;
    }

    /**
     * Compile the voxel map into an optimized THREE.BufferGeometry with:
     * - Hidden interior face culling
     * - 4-neighbor per-vertex Voxel Ambient Occlusion (AO)
     * - Micro-bevel normal perturbation for rich specular highlights on voxel edges
     */
    buildGeometry(centerOffset = { x: 0, y: 0, z: 0 }) {
      const positions = [];
      const normals = [];
      const colors = [];
      const indices = [];
      const s = this.voxelSize;
      const hs = s * 0.5;

      // 6 faces: [nx, ny, nz], tangent U [ux, uy, uz], tangent V [vx, vy, vz], and 4 vertex signs
      const faces = [
        { dir: [ 1, 0, 0], u: [0, 0,-1], v: [0, 1, 0], shade: 0.94 }, // +X
        { dir: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0], shade: 0.86 }, // -X
        { dir: [ 0, 1, 0], u: [1, 0, 0], v: [0, 0,-1], shade: 1.05 }, // +Y (top)
        { dir: [ 0,-1, 0], u: [1, 0, 0], v: [0, 0, 1], shade: 0.68 }, // -Y (bottom)
        { dir: [ 0, 0, 1], u: [1, 0, 0], v: [0, 1, 0], shade: 0.98 }, // +Z (front)
        { dir: [ 0, 0,-1], u: [-1,0, 0], v: [0, 1, 0], shade: 0.82 }  // -Z (back)
      ];

      const cornerSigns = [
        [-1, -1],
        [ 1, -1],
        [ 1,  1],
        [-1,  1]
      ];

      let vertCount = 0;

      for (const v of this.voxels.values()) {
        const vx = v.x, vy = v.y, vz = v.z;
        const cx = (vx - centerOffset.x) * s;
        const cy = (vy - centerOffset.y) * s;
        const cz = (vz - centerOffset.z) * s;

        for (let f = 0; f < 6; f++) {
          const face = faces[f];
          const [dx, dy, dz] = face.dir;
          // Hidden face culling
          if (this.voxels.has(`${vx + dx},${vy + dy},${vz + dz}`)) continue;

          const [ux, uy, uz] = face.u;
          const [tx, ty, tz] = face.v;

          const aoVals = [1, 1, 1, 1];
          for (let c = 0; c < 4; c++) {
            const [su, sv] = cornerSigns[c];
            const px = cx + (dx + ux * su + tx * sv) * hs;
            const py = cy + (dy + uy * su + ty * sv) * hs;
            const pz = cz + (dz + uz * su + tz * sv) * hs;
            positions.push(px, py, pz);

            // Slight bevel normal perturbation so edges catch highlights
            const bnx = dx + (ux * su + tx * sv) * 0.14;
            const bny = dy + (uy * su + ty * sv) * 0.14;
            const bnz = dz + (uz * su + tz * sv) * 0.14;
            const bl = Math.sqrt(bnx * bnx + bny * bny + bnz * bnz) || 1;
            normals.push(bnx / bl, bny / bl, bnz / bl);

            // Voxel Ambient Occlusion from the 3 neighbors in the face plane
            let occ = 0;
            if (!v.emissive) {
              const s1 = this.voxels.has(`${vx + dx + ux * su},${vy + dy + uy * su},${vz + dz + uz * su}`) ? 1 : 0;
              const s2 = this.voxels.has(`${vx + dx + tx * sv},${vy + dy + ty * sv},${vz + dz + tz * sv}`) ? 1 : 0;
              const sc = (s1 && s2) ? 1 : (this.voxels.has(`${vx + dx + ux * su + tx * sv},${vy + dy + uy * su + ty * sv},${vz + dz + uz * su + tz * sv}`) ? 1 : 0);
              occ = s1 + s2 + sc;
            }
            const ao = v.emissive ? 1.35 : (1.0 - occ * 0.145) * face.shade;
            aoVals[c] = ao;
            colors.push(
              Math.min(1, v.r * ao),
              Math.min(1, v.g * ao),
              Math.min(1, v.b * ao)
            );
          }

          // Flip quad diagonal based on AO to prevent anisotropy artifacts
          if (aoVals[0] + aoVals[2] > aoVals[1] + aoVals[3]) {
            indices.push(vertCount, vertCount + 1, vertCount + 2, vertCount, vertCount + 2, vertCount + 3);
          } else {
            indices.push(vertCount + 1, vertCount + 2, vertCount + 3, vertCount + 1, vertCount + 3, vertCount);
          }
          vertCount += 4;
        }
      }

      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geom.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
      geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      geom.setIndex(indices);
      return geom;
    }

    buildMesh(materialParams = {}, centerOffset = { x: 0, y: 0, z: 0 }) {
      const geom = this.buildGeometry(centerOffset);
      const mat = new THREE.MeshStandardMaterial(Object.assign({
        vertexColors: true,
        roughness: 0.72,
        metalness: 0.06
      }, materialParams));
      const mesh = new THREE.Mesh(geom, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      return mesh;
    }
  }

  // 3x5 Pixel Font for 3D Voxel Brass Nameplates ("MARIGOLD · 1742", etc.)
  const PIXEL_FONT_3X5 = {
    'A': ['010','101','111','101','101'],
    'B': ['110','101','110','101','110'],
    'C': ['011','100','100','100','011'],
    'D': ['110','101','101','101','110'],
    'E': ['111','100','110','100','111'],
    'F': ['111','100','110','100','100'],
    'G': ['011','100','101','101','011'],
    'H': ['101','101','111','101','101'],
    'I': ['111','010','010','010','111'],
    'J': ['001','001','001','101','010'],
    'K': ['101','101','110','101','101'],
    'L': ['100','100','100','100','111'],
    'M': ['101','111','111','101','101'],
    'N': ['101','111','111','111','101'],
    'O': ['010','101','101','101','010'],
    'P': ['110','101','110','100','100'],
    'R': ['110','101','110','101','101'],
    'S': ['011','100','010','001','110'],
    'T': ['111','010','010','010','010'],
    'U': ['101','101','101','101','111'],
    'V': ['101','101','101','101','010'],
    'W': ['101','101','111','111','101'],
    'Y': ['101','101','010','010','010'],
    '0': ['111','101','101','101','111'],
    '1': ['010','110','010','010','111'],
    '2': ['111','001','111','100','111'],
    '3': ['111','001','011','001','111'],
    '4': ['101','101','111','001','001'],
    '5': ['111','100','111','001','111'],
    '6': ['111','100','111','101','111'],
    '7': ['111','001','010','010','010'],
    '8': ['111','101','111','101','111'],
    '9': ['111','101','111','001','111'],
    '·': ['000','000','010','000','000'],
    '-': ['000','000','111','000','000'],
    ' ': ['00','00','00','00','00']
  };

  function buildBrassPlaqueMesh(text = 'MARIGOLD · 1742') {
    const vb = new VoxelBuilder(0.036);
    // Calculate pixel width
    const chars = text.toUpperCase().split('');
    let totalW = 0;
    const glyphs = chars.map((ch) => {
      const g = PIXEL_FONT_3X5[ch] || PIXEL_FONT_3X5[' '];
      totalW += g[0].length + 1;
      return g;
    });
    totalW -= 1;

    const padX = 5, padY = 2;
    const halfW = Math.floor(totalW / 2);

    // Dark mahogany plaque backing & brass plate
    for (let x = -halfW - padX; x <= halfW + padX; x++) {
      for (let y = -4; y <= 4; y++) {
        const isBorder = (x === -halfW - padX || x === halfW + padX || y === -4 || y === 4);
        vb.set(x, y, 0, isBorder ? 0x9b7426 : 0xd4a942, { jitter: 0.02 });
        vb.set(x, y, -1, 0x3b2314, { jitter: 0.02 });
      }
    }
    // Corner rivets
    vb.set(-halfW - padX + 1, 3, 1, 0x5c4214);
    vb.set(halfW + padX - 1, 3, 1, 0x5c4214);
    vb.set(-halfW - padX + 1, -3, 1, 0x5c4214);
    vb.set(halfW + padX - 1, -3, 1, 0x5c4214);

    // Engraved dark bronze 3D voxel text
    let curX = -halfW;
    for (const g of glyphs) {
      const gw = g[0].length;
      for (let row = 0; row < 5; row++) {
        const vy = 2 - row;
        for (let col = 0; col < gw; col++) {
          if (g[row][col] === '1') {
            vb.set(curX + col, vy, 1, 0x1e140b, { jitter: 0.01 });
            vb.set(curX + col, vy, 0, 0x24170d, { jitter: 0.01 });
          }
        }
      }
      curX += gw + 1;
    }

    return vb.buildMesh({ roughness: 0.35, metalness: 0.55 });
  }

  window.VoxelBuilder = VoxelBuilder;
  window.buildBrassPlaqueMesh = buildBrassPlaqueMesh;
})();
