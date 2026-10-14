/**
 * water-and-shaders.js
 * Implements:
 * 1. Shared deterministic wave height & slope function (used in JS for ship/object buoyancy and matched in GLSL)
 * 2. Top Ocean Surface mesh clipped to the horizontal bottle's inner cylinder
 * 3. Crystal-clear Translucent Curved Underwater Meniscus Wall so underwater corals, kelp, and rocky island roots shine through!
 */
(function () {
  const WATER_LEVEL_Y = -0.36;

  function sampleOceanWave(x, z, time, waveIntensity = 0.45, bottleRockAngle = 0.0) {
    const amp = 0.03 + waveIntensity * 0.14;
    const spd = 1.35 + waveIntensity * 1.15;
    const w1 = Math.sin(x * 1.45 + time * spd + z * 0.55) * 0.52;
    const w2 = Math.cos(x * 2.35 - time * spd * 1.18 - z * 1.65) * 0.31;
    const w3 = Math.sin((x + z) * 3.8 + time * spd * 1.65) * 0.17;
    const slosh = -x * Math.sin(bottleRockAngle) * 0.42;
    return WATER_LEVEL_Y + (w1 + w2 + w3) * amp + slosh;
  }

  function sampleOceanPose(x, z, time, waveIntensity = 0.45, bottleRockAngle = 0.0) {
    const eps = 0.22;
    const hC = sampleOceanWave(x, z, time, waveIntensity, bottleRockAngle);
    const hX = sampleOceanWave(x + eps, z, time, waveIntensity, bottleRockAngle);
    const hZ = sampleOceanWave(x, z + eps, time, waveIntensity, bottleRockAngle);
    const pitchZ = Math.atan2(hX - hC, eps) * 0.85;
    const rollX  = -Math.atan2(hZ - hC, eps) * 0.95;
    return { y: hC, pitchZ, rollX };
  }

  function createBottleOceanSystem() {
    const oceanGroup = new THREE.Group();

    const rippleArray = [
      new THREE.Vector3(0, 0, 99),
      new THREE.Vector3(0, 0, 99),
      new THREE.Vector3(0, 0, 99),
      new THREE.Vector3(0, 0, 99),
      new THREE.Vector3(0, 0, 99),
      new THREE.Vector3(0, 0, 99)
    ];
    let nextRippleIdx = 0;

    function triggerWaterRipple(x, z) {
      rippleArray[nextRippleIdx].set(x, z, 0.001);
      nextRippleIdx = (nextRippleIdx + 1) % rippleArray.length;
    }

    const sharedUniforms = {
      uTime: { value: 0.0 },
      uWaveIntensity: { value: 0.45 },
      uBottleRock: { value: 0.0 },
      uNightFactor: { value: 0.0 },
      uStormFactor: { value: 0.0 },
      uDeepColor: { value: new THREE.Color(0x0b4c80) },
      uShallowColor: { value: new THREE.Color(0x28a4c8) },
      uFoamColor: { value: new THREE.Color(0xf0f8ff) },
      uSunDir: { value: new THREE.Vector3(0.2, 0.8, 0.4).normalize() },
      uSunColor: { value: new THREE.Color(0xfff1d0) },
      uIsland0: { value: new THREE.Vector3(-3.35, -0.10, 1.25) },
      uIsland1: { value: new THREE.Vector3(0.08, -0.58, 1.55) },
      uIsland2: { value: new THREE.Vector3(2.55, 0.12, 1.18) },
      uShipPos: { value: new THREE.Vector3(-0.75, -0.36, 0.42) },
      uLantern0: { value: new THREE.Vector3(-3.35, 1.15, -0.10) },
      uLantern1: { value: new THREE.Vector3(-0.85, 0.25, 0.42) },
      uLantern2: { value: new THREE.Vector3(2.45, 0.05, 0.28) },
      uRipples: { value: rippleArray }
    };

    const segX = 136, segZ = 56;
    const xMin = -5.68, xMax = 5.18;
    const surfPositions = [], surfNormals = [], surfUvs = [], surfIndices = [];

    for (let ix = 0; ix <= segX; ix++) {
      const tx = ix / segX;
      const x = xMin + tx * (xMax - xMin);
      const rInner = Math.max(0.05, getBottleInnerRadiusAtX(x) - 0.02);
      const halfWidthZ = Math.sqrt(Math.max(0.02, rInner * rInner - WATER_LEVEL_Y * WATER_LEVEL_Y));

      for (let iz = 0; iz <= segZ; iz++) {
        const tz = iz / segZ;
        const z = (tz * 2.0 - 1.0) * halfWidthZ;
        surfPositions.push(x, WATER_LEVEL_Y, z);
        surfNormals.push(0, 1, 0);
        surfUvs.push(tx, tz);
      }
    }

    for (let ix = 0; ix < segX; ix++) {
      for (let iz = 0; iz < segZ; iz++) {
        const a = ix * (segZ + 1) + iz;
        const b = (ix + 1) * (segZ + 1) + iz;
        const c = (ix + 1) * (segZ + 1) + (iz + 1);
        const d = ix * (segZ + 1) + (iz + 1);
        surfIndices.push(a, d, b, b, d, c);
      }
    }

    const surfGeom = new THREE.BufferGeometry();
    surfGeom.setAttribute('position', new THREE.Float32BufferAttribute(surfPositions, 3));
    surfGeom.setAttribute('normal', new THREE.Float32BufferAttribute(surfNormals, 3));
    surfGeom.setAttribute('uv', new THREE.Float32BufferAttribute(surfUvs, 2));
    surfGeom.setIndex(surfIndices);

    const surfaceMat = new THREE.ShaderMaterial({
      uniforms: sharedUniforms,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      vertexShader: `
        uniform float uTime;
        uniform float uWaveIntensity;
        uniform float uBottleRock;
        varying vec3 vWorldPos;
        varying vec3 vLocalPos;
        varying vec3 vNormal;
        varying float vWaveCrest;

        float evalWave(float x, float z) {
          float amp = 0.03 + uWaveIntensity * 0.14;
          float spd = 1.35 + uWaveIntensity * 1.15;
          float w1 = sin(x * 1.45 + uTime * spd + z * 0.55) * 0.52;
          float w2 = cos(x * 2.35 - uTime * spd * 1.18 - z * 1.65) * 0.31;
          float w3 = sin((x + z) * 3.8 + uTime * spd * 1.65) * 0.17;
          float slosh = -x * sin(uBottleRock) * 0.42;
          return (w1 + w2 + w3) * amp + slosh;
        }

        void main() {
          vec3 p = position;
          float h = evalWave(p.x, p.z);
          float hx = evalWave(p.x + 0.12, p.z);
          float hz = evalWave(p.x, p.z + 0.12);
          p.y += h;
          vWaveCrest = h;
          vLocalPos = p;
          vec3 n = normalize(vec3(h - hx, 0.14, h - hz));
          vNormal = normalize(mat3(modelMatrix) * n);
          vec4 wp = modelMatrix * vec4(p, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uWaveIntensity;
        uniform float uNightFactor;
        uniform float uStormFactor;
        uniform vec3 uDeepColor;
        uniform vec3 uShallowColor;
        uniform vec3 uFoamColor;
        uniform vec3 uSunDir;
        uniform vec3 uSunColor;
        uniform vec3 uIsland0;
        uniform vec3 uIsland1;
        uniform vec3 uIsland2;
        uniform vec3 uShipPos;
        uniform vec3 uLantern0;
        uniform vec3 uLantern1;
        uniform vec3 uLantern2;
        uniform vec3 uRipples[6];

        varying vec3 vWorldPos;
        varying vec3 vLocalPos;
        varying vec3 vNormal;
        varying float vWaveCrest;

        float hash2(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }

        void main() {
          vec2 voxXZ = floor(vLocalPos.xz * 12.0) / 12.0;
          float cellNoise = hash2(voxXZ + floor(uTime * 1.5) * 0.01);

          float d0 = length(vLocalPos.xz - uIsland0.xy) - uIsland0.z;
          float d1 = length(vLocalPos.xz - uIsland1.xy) - uIsland1.z;
          float d2 = length(vLocalPos.xz - uIsland2.xy) - uIsland2.z;
          float dIsland = min(d0, min(d1, d2));

          vec2 shipDelta = vLocalPos.xz - uShipPos.xz;
          float dShip = length(vec2(shipDelta.x * 0.52, shipDelta.y * 1.35)) - 0.55;

          float shallowMask = exp(-max(min(dIsland, dShip), 0.0) * 2.1);
          vec3 baseWater = mix(uDeepColor, uShallowColor, shallowMask * 0.85);
          baseWater = mix(baseWater, baseWater * 0.35 + vec3(0.02, 0.06, 0.12), uNightFactor * 0.78);
          baseWater = mix(baseWater, vec3(0.11, 0.22, 0.30), uStormFactor * 0.45);

          float shoreWave = sin(dIsland * 18.0 - uTime * 3.6 + cellNoise * 1.8);
          float shoreFoam = smoothstep(0.32, -0.05, abs(dIsland - 0.06)) * step(0.15, shoreWave);
          float shipWake = smoothstep(0.38, -0.04, abs(dShip - 0.04)) * step(0.05, sin(dShip * 20.0 - uTime * 4.5));

          float wakeTrail = smoothstep(0.55, 0.0, abs(shipDelta.y) - max(0.0, -shipDelta.x) * 0.28)
                          * smoothstep(-2.2, -0.4, shipDelta.x) * step(0.42, hash2(voxXZ * 2.0 - vec2(uTime * 0.8, 0.0)));

          float crestThreshold = mix(0.09, 0.025, clamp(uWaveIntensity + uStormFactor * 0.4, 0.0, 1.0));
          float crestFoam = smoothstep(crestThreshold, crestThreshold + 0.04, vWaveCrest + (cellNoise - 0.5) * 0.035);

          float rippleFoam = 0.0;
          for (int i = 0; i < 6; i++) {
            float age = uRipples[i].z;
            if (age > 0.0 && age < 4.5) {
              float dist = length(vLocalPos.xz - uRipples[i].xy);
              float radius = age * 1.15;
              float ring = exp(-pow((dist - radius) * 6.5, 2.0)) * sin((dist - radius) * 24.0);
              float fade = 1.0 - age / 4.5;
              rippleFoam += max(0.0, ring) * fade * 1.35;
            }
          }

          float foamMask = clamp(shoreFoam + shipWake + wakeTrail * 0.65 + crestFoam * (0.35 + uWaveIntensity * 0.85) + rippleFoam, 0.0, 1.0);

          vec3 N = normalize(vNormal);
          vec3 V = normalize(cameraPosition - vWorldPos);
          vec3 H = normalize(uSunDir + V);
          float sunSpec = pow(max(dot(N, H), 0.0), 48.0) * (1.0 - uStormFactor * 0.65);

          vec3 lanternGlow = vec3(0.0);
          vec3 warmCol = vec3(1.0, 0.76, 0.32);
          float nightBoost = 0.25 + uNightFactor * 1.45;

          vec3 toL0 = uLantern0 - vLocalPos;
          lanternGlow += warmCol * exp(-length(toL0.xz) * 1.15) * (0.45 + 0.55 * max(0.0, dot(N, normalize(toL0)))) * nightBoost;

          vec3 toL1 = uLantern1 - vLocalPos;
          lanternGlow += warmCol * exp(-length(toL1.xz) * 1.25) * (0.5 + 0.5 * max(0.0, dot(N, normalize(toL1)))) * nightBoost * 1.15;

          vec3 toL2 = uLantern2 - vLocalPos;
          lanternGlow += vec3(1.0, 0.62, 0.22) * exp(-length(toL2.xz) * 1.35) * (0.5 + 0.5 * max(0.0, dot(N, normalize(toL2)))) * nightBoost;

          vec3 foamCol = mix(uFoamColor, vec3(0.65, 0.78, 0.92), uNightFactor * 0.55);
          vec3 col = mix(baseWater, foamCol, foamMask);
          col += uSunColor * sunSpec * 0.75 + lanternGlow * 0.56;

          float alpha = clamp(0.68 + foamMask * 0.24 + sunSpec * 0.15, 0.62, 0.94);
          gl_FragColor = vec4(col, alpha);
        }
      `
    });

    const surfaceMesh = new THREE.Mesh(surfGeom, surfaceMat);
    surfaceMesh.renderOrder = 15;
    oceanGroup.add(surfaceMesh);

    // 2. Curved Translucent Underwater Meniscus Wall
    const skirtSegX = 112, skirtSegY = 22;
    const skirtPos = [], skirtNorm = [], skirtUv = [], skirtIdx = [];

    for (let side = 0; side < 2; side++) {
      const zSign = side === 0 ? 1.0 : -1.0;
      const baseVertexOffset = skirtPos.length / 3;

      for (let ix = 0; ix <= skirtSegX; ix++) {
        const tx = ix / skirtSegX;
        const x = xMin + tx * (xMax - xMin);
        const rInner = Math.max(0.05, getBottleInnerRadiusAtX(x) - 0.025);
        const yBottom = -Math.min(rInner * 0.96, 1.98);
        const yTop = WATER_LEVEL_Y;

        for (let iy = 0; iy <= skirtSegY; iy++) {
          const ty = iy / skirtSegY;
          const y = yBottom + ty * (yTop - yBottom);
          const zAbs = Math.sqrt(Math.max(0.01, rInner * rInner - y * y));
          const z = zSign * zAbs;
          skirtPos.push(x, y, z);
          const nLen = Math.sqrt(y * y + z * z) || 1;
          skirtNorm.push(0, y / nLen, z / nLen);
          skirtUv.push(tx, ty);
        }
      }

      for (let ix = 0; ix < skirtSegX; ix++) {
        for (let iy = 0; iy < skirtSegY; iy++) {
          const a = baseVertexOffset + ix * (skirtSegY + 1) + iy;
          const b = baseVertexOffset + (ix + 1) * (skirtSegY + 1) + iy;
          const c = baseVertexOffset + (ix + 1) * (skirtSegY + 1) + (iy + 1);
          const d = baseVertexOffset + ix * (skirtSegY + 1) + (iy + 1);
          if (zSign > 0) {
            skirtIdx.push(a, b, c, a, c, d);
          } else {
            skirtIdx.push(a, c, b, a, d, c);
          }
        }
      }
    }

    const skirtGeom = new THREE.BufferGeometry();
    skirtGeom.setAttribute('position', new THREE.Float32BufferAttribute(skirtPos, 3));
    skirtGeom.setAttribute('normal', new THREE.Float32BufferAttribute(skirtNorm, 3));
    skirtGeom.setAttribute('uv', new THREE.Float32BufferAttribute(skirtUv, 2));
    skirtGeom.setIndex(skirtIdx);

    const skirtMat = new THREE.ShaderMaterial({
      uniforms: sharedUniforms,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      vertexShader: `
        uniform float uTime;
        uniform float uWaveIntensity;
        uniform float uBottleRock;
        varying vec3 vLocalPos;
        varying vec3 vWorldPos;
        varying vec2 vUv;

        float evalWave(float x, float z) {
          float amp = 0.03 + uWaveIntensity * 0.14;
          float spd = 1.35 + uWaveIntensity * 1.15;
          float w1 = sin(x * 1.45 + uTime * spd + z * 0.55) * 0.52;
          float w2 = cos(x * 2.35 - uTime * spd * 1.18 - z * 1.65) * 0.31;
          float w3 = sin((x + z) * 3.8 + uTime * spd * 1.65) * 0.17;
          float slosh = -x * sin(uBottleRock) * 0.42;
          return (w1 + w2 + w3) * amp + slosh;
        }

        void main() {
          vec3 p = position;
          float waveH = evalWave(p.x, p.z);
          p.y += waveH * pow(uv.y, 1.5);
          vLocalPos = p;
          vUv = uv;
          vec4 wp = modelMatrix * vec4(p, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uNightFactor;
        uniform vec3 uDeepColor;
        uniform vec3 uShallowColor;
        uniform vec3 uFoamColor;
        varying vec3 vLocalPos;
        varying vec3 vWorldPos;
        varying vec2 vUv;

        void main() {
          vec3 col = mix(uDeepColor * 0.90, uShallowColor * 1.15, pow(vUv.y, 0.7));
          col = mix(col, col * 0.32 + vec3(0.02, 0.06, 0.12), uNightFactor * 0.75);

          // Horizontal voxel-strata lines along the curved glass meniscus (frame_09.png!)
          float strata = sin(vLocalPos.y * 82.0 + sin(vLocalPos.x * 2.5 + uTime * 2.0) * 1.5);
          float strataMask = smoothstep(0.60, 0.95, strata) * 0.18;
          col += vec3(0.55, 0.92, 1.0) * strataMask * (1.0 - uNightFactor * 0.5);

          // Golden-cyan underwater caustics
          float c1 = sin(vLocalPos.x * 5.2 + uTime * 2.1 + vLocalPos.y * 3.0);
          float c2 = cos(vLocalPos.x * 7.8 - uTime * 1.7 - vLocalPos.y * 4.5);
          float caustic = pow(max(0.0, (c1 + c2) * 0.5), 2.5) * 0.25 * (1.0 - uNightFactor * 0.65);
          col += vec3(0.72, 0.96, 1.0) * caustic;

          float meniscusRim = smoothstep(0.90, 0.99, vUv.y);
          col = mix(col, uFoamColor, meniscusRim * 0.72);

          // Crystal clear 24%..34% alpha so the vibrant coral reef & kelp forest inside shine through!
          float alpha = mix(0.20, 0.32, vUv.y) + strataMask * 0.12 + meniscusRim * 0.34;
          gl_FragColor = vec4(col, alpha);
        }
      `
    });

    const skirtMesh = new THREE.Mesh(skirtGeom, skirtMat);
    skirtMesh.renderOrder = 14;
    oceanGroup.add(skirtMesh);

    oceanGroup.userData.uniforms = sharedUniforms;
    oceanGroup.userData.triggerWaterRipple = triggerWaterRipple;
    oceanGroup.userData.updateRipples = (dt) => {
      for (let i = 0; i < rippleArray.length; i++) {
        if (rippleArray[i].z < 10.0) {
          rippleArray[i].z += dt;
        }
      }
    };

    return oceanGroup;
  }

  window.WATER_LEVEL_Y = WATER_LEVEL_Y;
  window.sampleOceanWave = sampleOceanWave;
  window.sampleOceanPose = sampleOceanPose;
  window.createBottleOceanSystem = createBottleOceanSystem;
})();
