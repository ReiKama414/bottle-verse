/**
 * atmosphere-and-fx.js
 * Implements:
 * 1. Drifting 3D Voxel Clouds inside the upper bottle cylinder
 * 2. Flapping 3D Voxel Seagulls soaring in figure-eight loops
 * 3. Glowing Sun/Moon Celestial Orb + Twinkling Night Stars & Golden Fireflies (seen in frame_01 & frame_13)
 * 4. Weather System: Sunny (晴天), Rainy (雨天), Stormy Squall (暴風雨) with slanted rain streaks & 3D lightning bolts
 * 5. Interactive FX: Floating Barrels, Cannonball Fire + Muzzle Flash + Smoke, Leaping Voxel Dolphins, Pebble Drops
 * 6. Procedural Web Audio API Soundscape (Ocean waves, rain, thunder, cannon blast, splash)
 */
(function () {
  function createVoxelCloudMesh(scale = 1.0, seed = 0) {
    const vb = new VoxelBuilder(0.075 * scale);
    const puffs = [
      { x: 0,  y: 0, z: 0, rx: 4.2, ry: 1.8, rz: 2.6 },
      { x: -3, y: -0.4, z: 0.4, rx: 3.1, ry: 1.4, rz: 2.1 },
      { x: 3,  y: -0.3, z: -0.3, rx: 3.3, ry: 1.5, rz: 2.2 },
      { x: 1,  y: 1.0, z: 0, rx: 2.6, ry: 1.4, rz: 1.8 }
    ];
    for (const p of puffs) {
      vb.sphere(p.x, p.y, p.z, p.rx, p.ry, p.rz, 0xf6f8fb, { jitter: 0.02 });
    }
    return vb.buildMesh({ roughness: 0.85, metalness: 0.02 });
  }

  function createVoxelSeagullGroup() {
    const gull = new THREE.Group();
    const bodyVb = new VoxelBuilder(0.042);
    bodyVb.box(0, 0, -2, 0, 0, 2, 0xf7f7f7);
    bodyVb.set(0, 0, 3, 0xf5b82e); // yellow beak
    bodyVb.set(0, 0, -3, 0x444952); // tail tip
    gull.add(bodyVb.buildMesh({ roughness: 0.7 }));

    const wingVbL = new VoxelBuilder(0.042);
    wingVbL.box(-4, 0, -1, -1, 0, 1, 0xf2f4f7);
    wingVbL.box(-5, 0, -1, -4, 0, 0, 0x3b4048); // dark wingtip
    const wingL = wingVbL.buildMesh({ roughness: 0.7 });

    const wingVbR = new VoxelBuilder(0.042);
    wingVbR.box(1, 0, -1, 4, 0, 1, 0xf2f4f7);
    wingVbR.box(4, 0, -1, 5, 0, 0, 0x3b4048);
    const wingR = wingVbR.buildMesh({ roughness: 0.7 });

    gull.add(wingL, wingR);
    gull.userData = { wingL, wingR };
    return gull;
  }

  function createVoxelBarrelMesh(variant = 0) {
    const vb = new VoxelBuilder(0.048);
    const wood = variant % 2 === 0 ? 0x7c4d28 : 0x633b1d;
    const hoop = 0x2c2f33;
    for (let x = -2; x <= 2; x++) {
      for (let y = -1; y <= 1; y++) {
        for (let z = -1; z <= 1; z++) {
          const isHoop = (Math.abs(x) === 1);
          vb.set(x, y, z, isHoop ? hoop : wood);
        }
      }
    }
    return vb.buildMesh({ roughness: 0.72, metalness: 0.12 });
  }

  function createVoxelDolphinMesh() {
    const vb = new VoxelBuilder(0.048);
    const topBlue = 0x3d85ad;
    const belly   = 0xdbeeff;
    // Sleek arched dolphin body along X
    for (let x = -5; x <= 5; x++) {
      const archY = Math.round(Math.cos(x * 0.28) * 1.4);
      const r = Math.abs(x) <= 2 ? 1 : 0;
      for (let z = -r; z <= r; z++) {
        vb.set(x, archY, z, topBlue);
        if (Math.abs(x) <= 3) vb.set(x, archY - 1, z, belly);
      }
    }
    // Dorsal fin
    vb.set(0, 2, 0, topBlue);
    vb.set(-1, 3, 0, topBlue);
    // Tail flukes
    vb.set(-6, 0, -1, topBlue);
    vb.set(-6, 0,  0, topBlue);
    vb.set(-6, 0,  1, topBlue);
    // Rostrum (snout)
    vb.set(6, 0, 0, topBlue);
    return vb.buildMesh({ roughness: 0.35, metalness: 0.1 });
  }

  function createAtmosphereAndFXSystem(bottleInteriorGroup, oceanSystem) {
    const fxGroup = new THREE.Group();
    bottleInteriorGroup.add(fxGroup);

    // 1. Drifting 3D Voxel Clouds (5 clouds inside upper bottle)
    const clouds = [];
    const cloudConfigs = [
      { x: -3.1, y: 1.32, z: -0.25, scale: 0.95, speed: 0.14 },
      { x: -1.1, y: 1.42, z:  0.18, scale: 1.08, speed: 0.11 },
      { x:  0.9, y: 1.36, z: -0.32, scale: 0.88, speed: 0.16 },
      { x:  2.4, y: 1.28, z:  0.15, scale: 0.78, speed: 0.13 },
      { x: -0.2, y: 1.24, z:  0.42, scale: 0.72, speed: 0.18 }
    ];
    for (let i = 0; i < cloudConfigs.length; i++) {
      const cc = cloudConfigs[i];
      const mesh = createVoxelCloudMesh(cc.scale, i);
      mesh.position.set(cc.x, cc.y, cc.z);
      fxGroup.add(mesh);
      clouds.push({ mesh, baseZ: cc.z, baseY: cc.y, speed: cc.speed, phase: i * 1.7 });
    }

    // 2. Flapping Voxel Seagulls (3 birds circling inside bottle)
    const seagulls = [];
    for (let i = 0; i < 3; i++) {
      const g = createVoxelSeagullGroup();
      fxGroup.add(g);
      seagulls.push({
        group: g,
        centerX: -1.6 + i * 1.45,
        centerY: 0.92 + (i % 2) * 0.22,
        centerZ: (i - 1) * 0.25,
        radiusX: 0.85 + i * 0.15,
        radiusZ: 0.42,
        speed: 0.95 + i * 0.18,
        phase: i * 2.1
      });
    }

    // 3. Celestial Orb (Sun / Moon) inside the upper bottle sky (seen in frame_01.png!)
    const celestialGroup = new THREE.Group();
    const orbCore = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 20, 16),
      new THREE.MeshBasicMaterial({ color: 0xfff5cc })
    );
    const orbHalo = new THREE.Mesh(
      new THREE.SphereGeometry(0.42, 20, 16),
      new THREE.MeshBasicMaterial({
        color: 0xffe499,
        transparent: true,
        opacity: 0.36,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );
    orbHalo.renderOrder = 21;
    celestialGroup.add(orbCore, orbHalo);
    fxGroup.add(celestialGroup);

    // 4. Twinkling Night Stars & Golden Fireflies inside the bottle (seen in frame_13.png!)
    const starCount = 78;
    const starPos = new Float32Array(starCount * 3);
    const starCol = new Float32Array(starCount * 3);
    const starBase = [];
    for (let i = 0; i < starCount; i++) {
      const sx = -4.6 + Math.random() * 8.2;
      const sy = -0.15 + Math.random() * 1.75;
      const maxZ = Math.sqrt(Math.max(0.05, 1.85 * 1.85 - sy * sy));
      const sz = (Math.random() * 2 - 1) * maxZ * 0.85;
      starPos[i * 3] = sx;
      starPos[i * 3 + 1] = sy;
      starPos[i * 3 + 2] = sz;
      const isWarmFirefly = (i % 3 === 0 || sy < 0.45);
      const c = isWarmFirefly ? new THREE.Color(0xffe07d) : new THREE.Color(0xdbeeff);
      starCol[i * 3] = c.r;
      starCol[i * 3 + 1] = c.g;
      starCol[i * 3 + 2] = c.b;
      starBase.push({ x: sx, y: sy, z: sz, isWarmFirefly, phase: Math.random() * Math.PI * 2 });
    }
    const starGeom = new THREE.BufferGeometry();
    starGeom.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
    starGeom.setAttribute('color', new THREE.Float32BufferAttribute(starCol, 3));
    const starMat = new THREE.PointsMaterial({
      size: 2.8,
      vertexColors: true,
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    const starPoints = new THREE.Points(starGeom, starMat);
    starPoints.renderOrder = 21;
    fxGroup.add(starPoints);

    // 5. Weather Rain Streaks & 3D Jagged Lightning Bolt inside the bottle
    const rainCount = 220;
    const rainLinePos = new Float32Array(rainCount * 6); // 2 vertices per rain streak
    const rainDrops = [];
    for (let i = 0; i < rainCount; i++) {
      rainDrops.push({
        x: -4.8 + Math.random() * 8.8,
        y: -0.3 + Math.random() * 1.85,
        z: (Math.random() * 2 - 1) * 1.35,
        speed: 3.2 + Math.random() * 1.6
      });
    }
    const rainGeom = new THREE.BufferGeometry();
    rainGeom.setAttribute('position', new THREE.Float32BufferAttribute(rainLinePos, 3));
    const rainMat = new THREE.LineBasicMaterial({
      color: 0xaecde8,
      transparent: true,
      opacity: 0.0,
      depthWrite: false
    });
    const rainLines = new THREE.LineSegments(rainGeom, rainMat);
    rainLines.renderOrder = 22;
    rainLines.visible = false;
    fxGroup.add(rainLines);

    // 3D Lightning Bolt Line
    const boltPos = new Float32Array(16 * 3);
    const boltGeom = new THREE.BufferGeometry();
    boltGeom.setAttribute('position', new THREE.Float32BufferAttribute(boltPos, 3));
    const boltMat = new THREE.LineBasicMaterial({ color: 0xeef8ff, transparent: true, opacity: 0 });
    const boltMesh = new THREE.LineSegments(boltGeom, boltMat);
    boltMesh.visible = false;
    boltMesh.renderOrder = 24;
    fxGroup.add(boltMesh);
    let lightningTimer = 0;
    let lightningFlashIntensity = 0;

    // 6. Floating Barrels & Crates on the Ocean Surface
    const barrels = [];
    const initialBarrelCoords = [
      { x: -1.65, z: 0.82 },
      { x:  0.55, z: 0.72 },
      { x:  1.35, z: 0.48 },
      { x:  1.15, z: 0.95 }
    ];
    for (let i = 0; i < initialBarrelCoords.length; i++) {
      const bMesh = createVoxelBarrelMesh(i);
      fxGroup.add(bMesh);
      barrels.push({
        mesh: bMesh,
        x: initialBarrelCoords[i].x,
        z: initialBarrelCoords[i].z,
        vy: 0,
        dropping: false,
        phase: i * 1.5
      });
    }

    // 7. Active Projectiles (Cannonballs, Tossed Barrels, Dropped Pebbles, Leaping Dolphins, Smoke Puffs)
    const activeProjectiles = [];
    const activeDolphins = [];
    const smokePuffs = [];

    function spawnSplashParticles(x, z, count = 10, colorHex = 0xe8f9ff) {
      for (let i = 0; i < count; i++) {
        const pMesh = new THREE.Mesh(
          new THREE.BoxGeometry(0.055, 0.055, 0.055),
          new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.9 })
        );
        pMesh.position.set(x, WATER_LEVEL_Y + 0.04, z);
        fxGroup.add(pMesh);
        const angle = Math.random() * Math.PI * 2;
        const spd = 0.4 + Math.random() * 0.9;
        smokePuffs.push({
          mesh: pMesh,
          vx: Math.cos(angle) * spd,
          vy: 1.1 + Math.random() * 1.2,
          vz: Math.sin(angle) * spd,
          gravity: -4.8,
          age: 0,
          maxAge: 0.65
        });
      }
    }

    function fireCannon(shipGroup) {
      if (!shipGroup) return;
      const sx = shipGroup.position.x;
      const sy = shipGroup.position.y + 0.16;
      const sz = shipGroup.position.z;

      // Fire 2 cannonballs from starboard/port forward broadsides
      const dirs = [
        { vx: -0.65, vz: 1.55 },
        { vx:  0.85, vz: 1.45 }
      ];
      for (const d of dirs) {
        const ball = new THREE.Mesh(
          new THREE.SphereGeometry(0.055, 10, 10),
          new THREE.MeshStandardMaterial({ color: 0x1e2024, emissive: 0xff6611, emissiveIntensity: 0.8 })
        );
        ball.position.set(sx + d.vx * 0.25, sy, sz + 0.22);
        fxGroup.add(ball);
        activeProjectiles.push({
          type: 'cannonball',
          mesh: ball,
          vx: d.vx,
          vy: 1.45,
          vz: d.vz,
          gravity: -3.8
        });

        // Muzzle flash & smoke cloud puffs
        for (let s = 0; s < 7; s++) {
          const isFlash = s < 2;
          const puff = new THREE.Mesh(
            new THREE.BoxGeometry(isFlash ? 0.09 : 0.075, isFlash ? 0.09 : 0.075, isFlash ? 0.09 : 0.075),
            new THREE.MeshBasicMaterial({
              color: isFlash ? 0xffaa22 : 0xd8dde6,
              transparent: true,
              opacity: 0.9
            })
          );
          puff.position.set(sx + d.vx * 0.22, sy, sz + 0.24);
          fxGroup.add(puff);
          smokePuffs.push({
            mesh: puff,
            vx: d.vx * (0.3 + Math.random() * 0.4) + (Math.random() - 0.5) * 0.3,
            vy: 0.25 + Math.random() * 0.45,
            vz: d.vz * (0.3 + Math.random() * 0.4),
            gravity: 0.3,
            age: 0,
            maxAge: isFlash ? 0.22 : 0.95
          });
        }
      }
      SoundFX.playCannon();
    }

    function callDolphins() {
      const starts = [
        { x: -2.1, z: 0.95, vx: 1.35, vz: -0.15, delay: 0.0 },
        { x: -1.4, z: 1.12, vx: 1.45, vz: -0.22, delay: 0.22 },
        { x:  0.2, z: 0.88, vx: 1.25, vz:  0.12, delay: 0.42 }
      ];
      for (const st of starts) {
        const dMesh = createVoxelDolphinMesh();
        dMesh.position.set(st.x, WATER_LEVEL_Y - 0.25, st.z);
        dMesh.visible = false;
        fxGroup.add(dMesh);
        activeDolphins.push({
          mesh: dMesh,
          x: st.x,
          z: st.z,
          vx: st.vx,
          vz: st.vz,
          age: -st.delay,
          duration: 1.35,
          splashedIn: false,
          splashedOut: false
        });
      }
      SoundFX.playDolphin();
    }

    function tossBarrel() {
      // Remove oldest dynamic barrel if > 9 barrels
      if (barrels.length >= 9) {
        const old = barrels.shift();
        fxGroup.remove(old.mesh);
      }
      const tx = -2.2 + Math.random() * 3.6;
      const tz = 0.25 + Math.random() * 0.85;
      const bMesh = createVoxelBarrelMesh(barrels.length);
      bMesh.position.set(tx, 0.95, tz);
      fxGroup.add(bMesh);
      barrels.push({
        mesh: bMesh,
        x: tx,
        z: tz,
        y: 0.95,
        vy: -0.2,
        dropping: true,
        phase: Math.random() * 6.28
      });
      SoundFX.playSplash();
    }

    function dropPebbleAt(x, z) {
      const clampedX = Math.max(-4.5, Math.min(3.8, x));
      const clampedZ = Math.max(-1.2, Math.min(1.2, z));
      const pebble = new THREE.Mesh(
        new THREE.BoxGeometry(0.065, 0.055, 0.065),
        new THREE.MeshStandardMaterial({ color: 0x99a2ad, roughness: 0.6 })
      );
      pebble.position.set(clampedX, 1.05, clampedZ);
      fxGroup.add(pebble);
      activeProjectiles.push({
        type: 'pebble',
        mesh: pebble,
        vx: 0,
        vy: -0.5,
        vz: 0,
        gravity: -4.6
      });
    }

    function triggerLightningBolt() {
      const startX = -2.5 + Math.random() * 4.5;
      const startZ = -0.3 + Math.random() * 0.6;
      const arr = boltGeom.attributes.position.array;
      let cx = startX, cy = 1.42, cz = startZ;
      for (let i = 0; i < 8; i++) {
        const nx = cx + (Math.random() - 0.5) * 0.38;
        const ny = cy - 0.22;
        const nz = cz + (Math.random() - 0.5) * 0.25;
        arr[i * 6]     = cx; arr[i * 6 + 1] = cy; arr[i * 6 + 2] = cz;
        arr[i * 6 + 3] = nx; arr[i * 6 + 4] = ny; arr[i * 6 + 5] = nz;
        cx = nx; cy = ny; cz = nz;
      }
      boltGeom.attributes.position.needsUpdate = true;
      boltMesh.visible = true;
      boltMat.opacity = 1.0;
      lightningFlashIntensity = 1.8;
      SoundFX.playThunder();
    }

    function update(dt, time, state) {
      const { hour, weather, waveIntensity, bottleRock, nightFactor } = state;

      // 1. Update drifting voxel clouds & weather tint
      const isRain = weather === 'rainy' || weather === 'stormy';
      const isStorm = weather === 'stormy';
      const sunsetFactor = Math.max(0, 1.0 - Math.min(Math.abs(hour - 6.5), Math.abs(hour - 18.2)) / 1.8);

      const cloudTint = new THREE.Color(0xffffff);
      if (isStorm) {
        cloudTint.setHex(0x4b5666);
      } else if (isRain) {
        cloudTint.setHex(0x8899ad);
      } else if (sunsetFactor > 0.05) {
        cloudTint.lerp(new THREE.Color(0xffbfa0), sunsetFactor * 0.65);
      }
      if (nightFactor > 0.05) {
        cloudTint.lerp(new THREE.Color(0x3a4963), nightFactor * 0.72);
      }
      if (lightningFlashIntensity > 0.05) {
        cloudTint.lerp(new THREE.Color(0xdff4ff), Math.min(1, lightningFlashIntensity * 0.6));
      }

      for (const c of clouds) {
        c.mesh.position.x += dt * c.speed * (1.0 + waveIntensity * 1.2);
        if (c.mesh.position.x > 3.55) c.mesh.position.x = -4.35;
        c.mesh.position.y = c.baseY + Math.sin(time * 0.9 + c.phase) * 0.035;
        c.mesh.material.color.copy(cloudTint);
      }

      // 2. Update flapping seagulls
      for (const g of seagulls) {
        const ang = time * g.speed + g.phase;
        const nx = g.centerX + Math.cos(ang) * g.radiusX;
        const nz = g.centerZ + Math.sin(ang * 2.0) * g.radiusZ;
        const ny = g.centerY + Math.sin(ang * 1.5) * 0.08;
        const dx = -Math.sin(ang) * g.radiusX;
        const dz = Math.cos(ang * 2.0) * g.radiusZ * 2.0;
        g.group.position.set(nx, ny, nz);
        g.group.rotation.y = Math.atan2(dx, dz);
        const flap = Math.sin(time * 9.5 + g.phase) * 0.52;
        g.group.userData.wingL.rotation.z = flap;
        g.group.userData.wingR.rotation.z = -flap;
      }

      // 3. Celestial Orb (Sun / Moon arc inside the bottle)
      const dayAngle = ((hour - 6.0) / 12.0) * Math.PI;
      const isDaytime = (hour >= 5.5 && hour <= 18.5);
      const arcAngle = isDaytime ? dayAngle : (((hour < 6 ? hour + 6 : hour - 18) / 12.0) * Math.PI);
      const orbX = -2.4 * Math.cos(arcAngle);
      const orbY = 0.25 + Math.sin(arcAngle) * 1.15;
      celestialGroup.position.set(orbX, Math.max(0.15, orbY), -0.82);

      if (isDaytime) {
        const warmT = Math.pow(1.0 - Math.sin(Math.max(0, Math.min(Math.PI, dayAngle))), 1.6);
        orbCore.material.color.setHex(0xfff5cc).lerp(new THREE.Color(0xff7b38), warmT);
        orbHalo.material.color.setHex(0xffe082).lerp(new THREE.Color(0xff5722), warmT);
        orbHalo.material.opacity = isStorm ? 0.08 : 0.38;
        orbCore.scale.set(1, 1, 1);
      } else {
        orbCore.material.color.setHex(0xe8f4ff);
        orbHalo.material.color.setHex(0x88c4ff);
        orbHalo.material.opacity = isStorm ? 0.08 : 0.28;
        orbCore.scale.set(0.78, 0.78, 0.78);
      }

      // 4. Twinkling Night Stars & Floating Fireflies
      starMat.opacity = Math.max(0.0, (nightFactor - 0.12) * 1.15);
      if (starMat.opacity > 0.01) {
        const sArr = starGeom.attributes.position.array;
        for (let i = 0; i < starCount; i++) {
          const sb = starBase[i];
          if (sb.isWarmFirefly) {
            sArr[i * 3]     = sb.x + Math.sin(time * 1.4 + sb.phase) * 0.14;
            sArr[i * 3 + 1] = sb.y + Math.cos(time * 1.8 + sb.phase) * 0.09;
            sArr[i * 3 + 2] = sb.z + Math.sin(time * 1.1 + sb.phase) * 0.12;
          }
        }
        starGeom.attributes.position.needsUpdate = true;
      }

      // 5. Rain Streaks & Storm Lightning
      rainLines.visible = isRain;
      if (isRain) {
        rainMat.opacity = isStorm ? 0.68 : 0.42;
        const rArr = rainGeom.attributes.position.array;
        const slantX = isStorm ? -0.11 : -0.04;
        const lenY   = isStorm ? 0.26 : 0.19;
        for (let i = 0; i < rainCount; i++) {
          const rd = rainDrops[i];
          rd.y -= dt * rd.speed * (isStorm ? 1.45 : 1.0);
          rd.x += dt * slantX * 8.0;
          if (rd.y < WATER_LEVEL_Y) {
            // Occasional raindrop ripple on the water surface
            if (Math.random() < 0.015) {
              oceanSystem.userData.triggerWaterRipple(rd.x, rd.z);
            }
            rd.y = 1.38;
            rd.x = -4.6 + Math.random() * 8.4;
          }
          rArr[i * 6]     = rd.x;
          rArr[i * 6 + 1] = rd.y;
          rArr[i * 6 + 2] = rd.z;
          rArr[i * 6 + 3] = rd.x + slantX;
          rArr[i * 6 + 4] = rd.y - lenY;
          rArr[i * 6 + 5] = rd.z;
        }
        rainGeom.attributes.position.needsUpdate = true;
      }

      if (isStorm) {
        lightningTimer -= dt;
        if (lightningTimer <= 0) {
          triggerLightningBolt();
          lightningTimer = 2.8 + Math.random() * 4.5;
        }
      }
      if (lightningFlashIntensity > 0) {
        lightningFlashIntensity = Math.max(0, lightningFlashIntensity - dt * 5.5);
        boltMat.opacity = Math.min(1, lightningFlashIntensity);
        if (lightningFlashIntensity <= 0.02) boltMesh.visible = false;
      }

      // 6. Floating Barrels Buoyancy
      for (const b of barrels) {
        const wavePose = sampleOceanPose(b.x, b.z, time + b.phase, waveIntensity, bottleRock);
        if (b.dropping) {
          b.vy -= dt * 4.2;
          b.y += b.vy * dt;
          if (b.y <= wavePose.y) {
            b.y = wavePose.y;
            b.dropping = false;
            oceanSystem.userData.triggerWaterRipple(b.x, b.z);
            spawnSplashParticles(b.x, b.z, 8);
          }
          b.mesh.position.set(b.x, b.y, b.z);
        } else {
          b.mesh.position.set(b.x, wavePose.y - 0.01, b.z);
          b.mesh.rotation.z = wavePose.pitchZ * 1.4 + Math.sin(time * 2.2 + b.phase) * 0.12;
          b.mesh.rotation.x = wavePose.rollX * 1.4 + Math.cos(time * 1.9 + b.phase) * 0.12;
        }
      }

      // 7. Active Projectiles (Cannonballs & Pebbles)
      for (let i = activeProjectiles.length - 1; i >= 0; i--) {
        const p = activeProjectiles[i];
        p.vy += p.gravity * dt;
        p.mesh.position.x += p.vx * dt;
        p.mesh.position.y += p.vy * dt;
        p.mesh.position.z += p.vz * dt;
        const wY = sampleOceanWave(p.mesh.position.x, p.mesh.position.z, time, waveIntensity, bottleRock);
        if (p.mesh.position.y <= wY) {
          oceanSystem.userData.triggerWaterRipple(p.mesh.position.x, p.mesh.position.z);
          spawnSplashParticles(p.mesh.position.x, p.mesh.position.z, p.type === 'cannonball' ? 14 : 7);
          SoundFX.playSplash();
          fxGroup.remove(p.mesh);
          activeProjectiles.splice(i, 1);
        }
      }

      // 8. Leaping Voxel Dolphins
      for (let i = activeDolphins.length - 1; i >= 0; i--) {
        const d = activeDolphins[i];
        d.age += dt;
        if (d.age < 0) continue;
        d.mesh.visible = true;
        const u = d.age / d.duration;
        if (!d.splashedOut) {
          d.splashedOut = true;
          oceanSystem.userData.triggerWaterRipple(d.x, d.z);
          spawnSplashParticles(d.x, d.z, 7);
        }
        const curX = d.x + d.vx * d.age;
        const curZ = d.z + d.vz * d.age;
        const leapArcY = WATER_LEVEL_Y - 0.12 + Math.sin(u * Math.PI) * 0.78;
        d.mesh.position.set(curX, leapArcY, curZ);
        // Pitch nose smoothly along parabolic tangent
        const tangentPitch = Math.cos(u * Math.PI) * 0.85;
        d.mesh.rotation.z = tangentPitch;
        d.mesh.rotation.y = Math.atan2(-d.vz, d.vx);

        if (u >= 0.92 && !d.splashedIn) {
          d.splashedIn = true;
          oceanSystem.userData.triggerWaterRipple(curX, curZ);
          spawnSplashParticles(curX, curZ, 9);
          SoundFX.playSplash();
        }
        if (u >= 1.05) {
          fxGroup.remove(d.mesh);
          activeDolphins.splice(i, 1);
        }
      }

      // 9. Smoke & Splash Droplet Puffs
      for (let i = smokePuffs.length - 1; i >= 0; i--) {
        const sp = smokePuffs[i];
        sp.age += dt;
        sp.vy += sp.gravity * dt;
        sp.mesh.position.x += sp.vx * dt;
        sp.mesh.position.y += sp.vy * dt;
        sp.mesh.position.z += sp.vz * dt;
        const lifeRatio = 1.0 - sp.age / sp.maxAge;
        sp.mesh.material.opacity = Math.max(0, lifeRatio * 0.85);
        const s = 1.0 + sp.age * 0.8;
        sp.mesh.scale.set(s, s, s);
        if (sp.age >= sp.maxAge) {
          fxGroup.remove(sp.mesh);
          smokePuffs.splice(i, 1);
        }
      }

      return { lightningFlashIntensity };
    }

    return {
      fxGroup,
      update,
      fireCannon,
      callDolphins,
      tossBarrel,
      dropPebbleAt
    };
  }

  // Self-contained Web Audio API Procedural Sound Synthesizer
  const SoundFX = (function () {
    let ctx = null;
    let enabled = false;
    let oceanGain = null;

    function initAudio() {
      if (ctx) return;
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      ctx = new AudioCtx();

      // Continuous ocean surf generator
      const bufferSize = ctx.sampleRate * 3;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        output[i] = (lastOut + (0.02 * white)) / 1.02;
        lastOut = output[i];
        output[i] *= 1.8;
      }
      const whiteNoise = ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;
      whiteNoise.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 380;

      oceanGain = ctx.createGain();
      oceanGain.gain.value = 0.0;

      whiteNoise.connect(filter);
      filter.connect(oceanGain);
      oceanGain.connect(ctx.destination);
      whiteNoise.start(0);
    }

    function setEnabled(flag) {
      enabled = Boolean(flag);
      if (enabled) {
        initAudio();
        if (ctx && ctx.state === 'suspended') ctx.resume();
        if (oceanGain && ctx) oceanGain.gain.setTargetAtTime(0.08, ctx.currentTime, 0.3);
      } else if (oceanGain && ctx) {
        oceanGain.gain.setTargetAtTime(0.0, ctx.currentTime, 0.2);
      }
      return enabled;
    }

    function playCannon() {
      if (!enabled || !ctx) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(135, now);
      osc.frequency.exponentialRampToValueAtTime(28, now + 0.42);
      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.46);
    }

    function playSplash() {
      if (!enabled || !ctx) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(680, now + 0.14);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.17);
    }

    function playDolphin() {
      if (!enabled || !ctx) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(680, now);
      osc.frequency.exponentialRampToValueAtTime(1420, now + 0.18);
      osc.frequency.exponentialRampToValueAtTime(920, now + 0.32);
      gain.gain.setValueAtTime(0.10, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.36);
    }

    function playThunder() {
      if (!enabled || !ctx) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(72, now);
      osc.frequency.exponentialRampToValueAtTime(24, now + 0.9);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.95);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.98);
    }

    return {
      setEnabled,
      isEnabled: () => enabled,
      playCannon,
      playSplash,
      playDolphin,
      playThunder
    };
  })();

  window.createAtmosphereAndFXSystem = createAtmosphereAndFXSystem;
  window.SoundFX = SoundFX;
})();
