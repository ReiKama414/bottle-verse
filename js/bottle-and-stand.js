/**
 * bottle-and-stand.js
 * Constructs:
 * 1. Warm wooden plank tabletop with procedural grain, plank seams, and soft contact shadow under the bottle
 * 2. Sculpted mahogany wooden cradle stand with velvet pads & prominent 3D voxel brass nameplate ("MARIGOLD · 1742")
 * 3. Horizontal Lathe glass bottle with dual-pass physical glass shader (Fresnel, longitudinal highlight streak, night lantern reflections)
 * 4. Voxel cork stopper with crimson wax seal, braided rope collar, and swinging pixel-art ship tag
 */
(function () {
  function getBottleInnerRadiusAtX(x) {
    const baseR = 2.08;
    if (x < -5.85 || x > 6.65) return 0.0;
    if (x < -4.75) {
      const t = (-4.75 - x) / 1.10;
      return baseR * Math.sqrt(Math.max(0.0, 1.0 - t * t));
    }
    if (x <= 3.55) {
      return baseR;
    }
    if (x <= 5.35) {
      const t = (x - 3.55) / 1.80;
      const s = t * t * (3.0 - 2.0 * t);
      return baseR * (1.0 - s) + 0.78 * s;
    }
    return 0.78;
  }

  function createTabletopMesh() {
    const geom = new THREE.PlaneGeometry(44, 34, 1, 1);
    const pos = geom.attributes.position.array;
    const norm = geom.attributes.normal.array;
    for (let i = 0; i < pos.length; i += 3) {
      const x = pos[i], y = pos[i + 1];
      pos[i] = x;
      pos[i + 1] = -2.56;
      pos[i + 2] = -y;
      norm[i] = 0; norm[i + 1] = 1; norm[i + 2] = 0;
    }

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uSunIntensity: { value: 1.0 },
        uNightFactor: { value: 0.0 },
        uLightColor: { value: new THREE.Color(0xfff0d6) },
        uAmbientColor: { value: new THREE.Color(0x4a3525) }
      },
      vertexShader: `
        varying vec3 vWorldPos;
        varying vec2 vUv;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          vUv = uv;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform float uSunIntensity;
        uniform float uNightFactor;
        uniform vec3 uLightColor;
        uniform vec3 uAmbientColor;
        varying vec3 vWorldPos;
        varying vec2 vUv;

        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }
        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
            mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
            f.y
          );
        }

        void main() {
          float plankWidth = 1.35;
          float plankId = floor(vWorldPos.z / plankWidth);
          float plankFract = fract(vWorldPos.z / plankWidth);

          float jointX = fract((vWorldPos.x + plankId * 3.7) / 9.5);
          float seamZ = smoothstep(0.0, 0.025, plankFract) * smoothstep(1.0, 0.975, plankFract);
          float seamX = smoothstep(0.0, 0.008, jointX) * smoothstep(1.0, 0.992, jointX);
          float seam = seamZ * seamX;

          float hShift = hash(vec2(plankId, 1.0)) * 0.14 - 0.07;
          vec2 grainCoord = vec2(vWorldPos.x * 0.65 + plankId * 5.1, vWorldPos.z * 6.5);
          float g1 = noise(grainCoord);
          float g2 = noise(grainCoord * 2.8 + vec2(g1 * 1.4, 0.0));
          float rings = sin(vWorldPos.z * 14.0 + g1 * 5.0 + plankId) * 0.5 + 0.5;
          float grain = mix(g2, rings, 0.42);

          vec3 darkWood = vec3(0.24, 0.13, 0.07);
          vec3 midWood  = vec3(0.42, 0.24, 0.13);
          vec3 warmWood = vec3(0.54, 0.32, 0.18);

          vec3 woodCol = mix(darkWood, midWood, grain) + hShift * vec3(0.35, 0.2, 0.1);
          woodCol = mix(woodCol, warmWood, smoothstep(0.4, 0.85, g1) * 0.45);
          woodCol *= (0.32 + 0.68 * seam);

          // Soft ambient occlusion & shadow directly under the wooden stand and bottle
          float standEllip = length(vec2((vWorldPos.x + 0.45) / 4.2, (vWorldPos.z - 0.2) / 2.25));
          float bottleEllip = length(vec2((vWorldPos.x + 0.3) / 6.3, (vWorldPos.z - 0.15) / 2.55));
          float aoStand = smoothstep(0.48, 1.18, standEllip);
          float aoBottle = mix(0.38, 1.0, smoothstep(0.35, 1.15, bottleEllip));
          float contactShadow = aoStand * 0.58 + aoBottle * 0.42;

          float bounce = exp(-bottleEllip * bottleEllip * 1.2) * (0.14 * uSunIntensity + 0.10 * uNightFactor);
          vec3 bounceCol = mix(vec3(0.25, 0.65, 0.78), vec3(1.0, 0.72, 0.32), uNightFactor);

          float radialVignette = smoothstep(23.0, 4.5, length(vWorldPos.xz));
          vec3 lightMix = mix(vec3(0.20, 0.21, 0.28), uLightColor, clamp(uSunIntensity * 0.85 + 0.15, 0.0, 1.0));

          vec3 finalCol = woodCol * lightMix * contactShadow * (0.35 + 0.65 * radialVignette);
          finalCol += bounceCol * bounce * seam;

          gl_FragColor = vec4(finalCol, 1.0);
        }
      `
    });

    const mesh = new THREE.Mesh(geom, mat);
    mesh.receiveShadow = true;
    return mesh;
  }

  function createWoodenStandAndPlaque(initialPlaqueText = 'MARIGOLD · 1742') {
    const standGroup = new THREE.Group();
    const vb = new VoxelBuilder(0.11);

    const woodDark = 0x241309;
    const woodMid  = 0x381e0f;
    const woodTrim = 0x4f2c17;
    const feltGreen = 0x1d6647;

    // Two sculpted cradle arches at x = -27 (-2.97) and x = +20 (+2.20)
    const cradleXs = [-27, 20];
    for (const cx of cradleXs) {
      for (let dx = -2; dx <= 2; dx++) {
        const x = cx + dx;
        for (let z = -15; z <= 15; z++) {
          // Stepped wide mahogany base foot (y = -23 to -21 -> -2.53 to -2.31)
          vb.set(x, -23, z, woodDark);
          vb.set(x, -22, z, woodMid);
          if (Math.abs(z) <= 14) {
            // Concave circular cradle hugging bottle radius ~19.8 voxels
            const circleY = -Math.sqrt(Math.max(0, 19.8 * 19.8 - z * z));
            const maxY = Math.min(-14, Math.floor(circleY));
            for (let y = -21; y <= Math.max(-21, maxY); y++) {
              const isEdge = (dx === -2 || dx === 2 || Math.abs(z) === 14);
              vb.set(x, y, z, isEdge ? woodDark : woodMid);
            }
            if (maxY >= -20 && Math.abs(dx) <= 1 && Math.abs(z) <= 12) {
              vb.set(x, maxY + 1, z, feltGreen, { jitter: 0.015 });
            }
          }
        }
      }
    }

    // Thick sculpted front & back stretcher base beams (y = -23 to -19)
    for (let x = -30; x <= 23; x++) {
      for (let y = -23; y <= -19; y++) {
        // Front plinth beam (z = 11..15) that holds the brass nameplate
        for (let z = 11; z <= 15; z++) {
          if (y === -19 && z === 15) continue; // Chamfered top front edge
          vb.set(x, y, z, y >= -20 ? woodTrim : woodDark);
        }
        // Back rail
        for (let z = -14; z <= -11; z++) {
          if (y <= -20) vb.set(x, y, z, woodDark);
        }
      }
    }

    const standMesh = vb.buildMesh({ roughness: 0.58, metalness: 0.08 });
    standGroup.add(standMesh);

    // Dynamic 3D Voxel Brass Plaque Holder prominently displayed on front plinth
    const plaqueHolder = new THREE.Group();
    plaqueHolder.position.set(-0.38, -2.31, 1.72);
    plaqueHolder.rotation.x = -0.18;
    plaqueHolder.scale.set(1.18, 1.18, 1.18);
    standGroup.add(plaqueHolder);

    let currentPlaqueMesh = buildBrassPlaqueMesh(initialPlaqueText);
    plaqueHolder.add(currentPlaqueMesh);

    standGroup.userData.setPlaqueText = (newText) => {
      if (currentPlaqueMesh) {
        plaqueHolder.remove(currentPlaqueMesh);
      }
      currentPlaqueMesh = buildBrassPlaqueMesh(newText);
      plaqueHolder.add(currentPlaqueMesh);
    };

    return standGroup;
  }

  function createGlassBottleAndCork() {
    const bottleGroup = new THREE.Group();

    const profilePoints = [];
    const numSamples = 68;
    const xStart = -5.92, xEnd = 6.72;
    for (let i = 0; i <= numSamples; i++) {
      const t = i / numSamples;
      const x = xStart + t * (xEnd - xStart);
      let r = 2.18;
      if (x < -4.75) {
        const u = Math.max(0, Math.min(1, (-4.75 - x) / 1.17));
        r = 2.18 * Math.sqrt(Math.max(0.001, 1.0 - u * u));
      } else if (x <= 3.55) {
        r = 2.18;
      } else if (x <= 5.38) {
        const u = (x - 3.55) / 1.83;
        const s = u * u * (3.0 - 2.0 * u);
        r = 2.18 * (1.0 - s) + 0.88 * s;
      } else if (x <= 6.42) {
        r = 0.88;
      } else {
        const u = (x - 6.42) / 0.30;
        const lip = Math.sin(u * Math.PI);
        r = 0.88 + lip * 0.14;
      }
      profilePoints.push(new THREE.Vector2(r, x));
    }

    const glassGeom = new THREE.LatheGeometry(profilePoints, 56);
    const pos = glassGeom.attributes.position.array;
    const norm = glassGeom.attributes.normal.array;
    for (let i = 0; i < pos.length; i += 3) {
      const rx = pos[i], ry = pos[i + 1], rz = pos[i + 2];
      pos[i] = ry;
      pos[i + 1] = rx;
      pos[i + 2] = rz;

      const nx = norm[i], ny = norm[i + 1], nz = norm[i + 2];
      norm[i] = ny;
      norm[i + 1] = nx;
      norm[i + 2] = nz;
    }

    const glassUniforms = {
      uSunDir: { value: new THREE.Vector3(0.3, 0.8, 0.5).normalize() },
      uSunColor: { value: new THREE.Color(0xfff4dc) },
      uSkyColor: { value: new THREE.Color(0x7ec8e3) },
      uNightFactor: { value: 0.0 },
      uPassSide: { value: 1.0 }
    };

    const glassVert = `
      varying vec3 vWorldPos;
      varying vec3 vLocalPos;
      varying vec3 vWorldNormal;
      void main() {
        vLocalPos = position;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `;

    const glassFrag = `
      uniform vec3 uSunDir;
      uniform vec3 uSunColor;
      uniform vec3 uSkyColor;
      uniform float uNightFactor;
      uniform float uPassSide;
      varying vec3 vWorldPos;
      varying vec3 vLocalPos;
      varying vec3 vWorldNormal;

      void main() {
        vec3 N = normalize(vWorldNormal) * uPassSide;
        vec3 V = normalize(cameraPosition - vWorldPos);
        float ndv = abs(dot(N, V));
        float fresnel = pow(1.0 - ndv, 2.75);

        vec3 cylN = normalize(vec3(0.0, vLocalPos.y, vLocalPos.z));
        float topStreakAngle = dot(cylN, normalize(vec3(0.0, 0.78, 0.62)));
        float lengthMask = smoothstep(-5.5, -4.4, vLocalPos.x) * smoothstep(6.5, 3.8, vLocalPos.x);
        float mainStreak = pow(max(topStreakAngle, 0.0), 28.0) * lengthMask * 0.74;

        float bottomRimAngle = dot(cylN, normalize(vec3(0.0, -0.88, 0.48)));
        float bottomRimStreak = pow(max(bottomRimAngle, 0.0), 36.0) * lengthMask * 0.48;

        vec3 H = normalize(uSunDir + V);
        float sunSpec = pow(max(dot(N, H), 0.0), 64.0) * 0.65;

        vec3 glassTint = mix(vec3(0.76, 0.94, 0.96), vec3(0.45, 0.68, 0.82), uNightFactor * 0.6);
        vec3 reflColor = mix(glassTint, uSunColor, 0.35);

        vec3 nightWarmGlow = vec3(1.0, 0.76, 0.38) * uNightFactor * pow(1.0 - ndv, 2.2) * 0.34;

        vec3 col = reflColor * (fresnel * 0.85 + 0.15)
                 + vec3(1.0, 0.99, 0.96) * (mainStreak + bottomRimStreak + sunSpec)
                 + nightWarmGlow;

        float alpha = (uPassSide < 0.0)
          ? (0.035 + fresnel * 0.11)
          : clamp(0.05 + fresnel * 0.46 + mainStreak * 0.68 + bottomRimStreak * 0.42 + sunSpec * 0.45, 0.04, 0.88);

        gl_FragColor = vec4(col, alpha);
      }
    `;

    const glassBackMat = new THREE.ShaderMaterial({
      uniforms: {
        uSunDir: glassUniforms.uSunDir,
        uSunColor: glassUniforms.uSunColor,
        uSkyColor: glassUniforms.uSkyColor,
        uNightFactor: glassUniforms.uNightFactor,
        uPassSide: { value: -1.0 }
      },
      vertexShader: glassVert,
      fragmentShader: glassFrag,
      transparent: true,
      depthWrite: false,
      side: THREE.BackSide
    });
    const glassBackMesh = new THREE.Mesh(glassGeom, glassBackMat);
    glassBackMesh.renderOrder = 8;
    bottleGroup.add(glassBackMesh);

    const glassFrontMat = new THREE.ShaderMaterial({
      uniforms: glassUniforms,
      vertexShader: glassVert,
      fragmentShader: glassFrag,
      transparent: true,
      depthWrite: false,
      side: THREE.FrontSide
    });
    const glassFrontMesh = new THREE.Mesh(glassGeom, glassFrontMat);
    glassFrontMesh.renderOrder = 26;
    bottleGroup.add(glassFrontMesh);

    // Voxel Cork Stopper, Red Wax Seal & Braided Hemp Collar
    const corkVb = new VoxelBuilder(0.09);
    const corkLight = 0xba8d52;
    const corkMid   = 0x9c723d;
    const corkDark  = 0x7d572a;
    const waxRed    = 0x9e211f;
    const ropeGold  = 0xa87939;

    for (let vx = 60; vx <= 80; vx++) {
      const rad = vx <= 73 ? 8.2 : 9.4;
      for (let vy = -10; vy <= 10; vy++) {
        for (let vz = -10; vz <= 10; vz++) {
          const d = Math.sqrt(vy * vy + vz * vz);
          if (d <= rad) {
            const h = Math.sin(vx * 17.3 + vy * 31.7 + vz * 47.1);
            let col = h > 0.4 ? corkLight : (h < -0.45 ? corkDark : corkMid);
            if (vx >= 79 || (vx >= 75 && d > rad - 1.5 && Math.sin(Math.atan2(vy, vz) * 5.0) > 0.1)) {
              col = waxRed;
            }
            corkVb.set(vx, vy, vz, col, { jitter: 0.03 });
          }
        }
      }
    }

    for (let vx = 63; vx <= 65; vx++) {
      for (let vy = -11; vy <= 11; vy++) {
        for (let vz = -11; vz <= 11; vz++) {
          const d = Math.sqrt(vy * vy + vz * vz);
          if (d >= 9.3 && d <= 10.9) {
            corkVb.set(vx, vy, vz, ropeGold, { jitter: 0.04 });
          }
        }
      }
    }

    const corkMesh = corkVb.buildMesh({ roughness: 0.78, metalness: 0.04 });
    bottleGroup.add(corkMesh);

    // Swinging Voxel Paper/Ivory Tag hanging from the hemp collar
    const tagPivot = new THREE.Group();
    tagPivot.position.set(5.76, -0.92, 0.22);
    bottleGroup.add(tagPivot);

    const tagVb = new VoxelBuilder(0.052);
    for (let y = 0; y >= -9; y--) {
      tagVb.set(0, y, 0, ropeGold);
    }
    const ivory = 0xe8dec8;
    const ink   = 0x221d18;
    for (let x = -5; x <= 5; x++) {
      for (let y = -23; y <= -10; y++) {
        if (y === -10 && Math.abs(x) >= 4) continue;
        if (y === -11 && Math.abs(x) >= 5) continue;
        if (y === -12 && x === 0) continue;

        let isIcon = false;
        if (y === -14 && x === 0) isIcon = true;
        if (y === -15 && Math.abs(x) <= 1) isIcon = true;
        if (y === -16 && Math.abs(x) <= 2) isIcon = true;
        if (y === -17 && Math.abs(x) <= 3) isIcon = true;
        if (y === -18 && x === 0) isIcon = true;
        if (y === -19 && Math.abs(x) <= 3) isIcon = true;
        if (y === -20 && Math.abs(x) <= 2) isIcon = true;

        tagVb.set(x, y, 0, isIcon ? ink : ivory, { jitter: 0.015 });
      }
    }
    const tagMesh = tagVb.buildMesh({ roughness: 0.75, metalness: 0.02 });
    tagPivot.add(tagMesh);

    bottleGroup.userData.glassUniforms = glassUniforms;
    bottleGroup.userData.tagPivot = tagPivot;

    return bottleGroup;
  }

  window.getBottleInnerRadiusAtX = getBottleInnerRadiusAtX;
  window.createTabletopMesh = createTabletopMesh;
  window.createWoodenStandAndPlaque = createWoodenStandAndPlaque;
  window.createGlassBottleAndCork = createGlassBottleAndCork;
})();
