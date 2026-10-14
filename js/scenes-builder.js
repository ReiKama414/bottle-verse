/**
 * scenes-builder.js
 * Procedural Voxel World Generators for 4 complete switchable Ship-in-a-Bottle miniature worlds:
 * 1. 'pirate'   -> MARIGOLD · 1742 (Pirate Galleon, Red-White Lighthouse & Cottage, Twin Waterfall Mountain, Palm Campfire Treasure Island, Coral Reef)
 * 2. 'ghost'    -> DUTCHMAN · 1688 (Spectral Phantom Galleon, Erupting Magma Volcano, Skull Rock Fortress, Crystal Cove, Bioluminescent Abyss)
 * 3. 'viking'   -> VALKYRIE · 0985 (Viking Dragon Longship, Nordic Watchtower, Crystalline Glacier Arch, Snowy Pine Hot-Spring Island, Aurora Borealis)
 * 4. 'oriental' -> RYUJIN · 1543   (Oriental Treasure Junk, Cliffside Pagoda & Water Torii Gate, Jade Waterfall Mountain, Blooming Sakura Pavilion)
 */
(function () {
  const SCENE_CONFIGS = {
    pirate: {
      id: 'pirate',
      nameZh: '海盜船與燈塔群島',
      nameEn: 'MARIGOLD · 1742',
      plaque: 'MARIGOLD · 1742',
      deepWater: 0x0b4c80,
      shallowWater: 0x28a4c8,
      foamColor: 0xf0f8ff,
      lanternColors: [0xffe28a, 0xffbe55, 0xff8826],
      islandCenters: [
        new THREE.Vector3(-3.35, -0.10, 1.25),
        new THREE.Vector3(0.08, -0.58, 1.55),
        new THREE.Vector3(2.55, 0.12, 1.18)
      ]
    },
    ghost: {
      id: 'ghost',
      nameZh: '幽靈船與火山秘境',
      nameEn: 'DUTCHMAN · 1688',
      plaque: 'DUTCHMAN · 1688',
      deepWater: 0x082a38,
      shallowWater: 0x167874,
      foamColor: 0xaef6e8,
      lanternColors: [0x4effb8, 0xff551a, 0xb666ff],
      islandCenters: [
        new THREE.Vector3(-3.35, -0.10, 1.25),
        new THREE.Vector3(0.08, -0.58, 1.55),
        new THREE.Vector3(2.55, 0.12, 1.18)
      ]
    },
    viking: {
      id: 'viking',
      nameZh: '極光冰海與維京戰船',
      nameEn: 'VALKYRIE · 0985',
      plaque: 'VALKYRIE · 0985',
      deepWater: 0x093862,
      shallowWater: 0x3bb4d8,
      foamColor: 0xf4fbff,
      lanternColors: [0xff9d3b, 0x7ce8ff, 0x66ffaa],
      islandCenters: [
        new THREE.Vector3(-3.35, -0.10, 1.25),
        new THREE.Vector3(0.08, -0.58, 1.55),
        new THREE.Vector3(2.55, 0.12, 1.18)
      ]
    },
    oriental: {
      id: 'oriental',
      nameZh: '東方寶船與櫻花神社',
      nameEn: 'RYUJIN · 1543',
      plaque: 'RYUJIN · 1543',
      deepWater: 0x0c4e72,
      shallowWater: 0x2ab0b8,
      foamColor: 0xfff4f8,
      lanternColors: [0xffb84d, 0xffcf70, 0xff8da6],
      islandCenters: [
        new THREE.Vector3(-3.35, -0.10, 1.25),
        new THREE.Vector3(0.08, -0.58, 1.55),
        new THREE.Vector3(2.55, 0.12, 1.18)
      ]
    }
  };

  function buildShipGroup(theme = 'pirate') {
    const shipGroup = new THREE.Group();
    const vb = new VoxelBuilder(0.056);

    let hullDark = 0x2e180b, hullMid = 0x4a2813, hullLight = 0x704223, trimGold = 0xd49b2a;
    let sailMain = 0xf2ece1, sailShade = 0xdcd2be, sailStripe = 0xad261d;
    let flagColor = 0xc4281c, lanternGlow = 0xffcf52;

    if (theme === 'ghost') {
      hullDark = 0x122024; hullMid = 0x1c3338; hullLight = 0x284a50; trimGold = 0x38b88f;
      sailMain = 0x52cca8; sailShade = 0x34967a; sailStripe = 0x185c4b;
      flagColor = 0x38f2bc; lanternGlow = 0x4effc8;
    } else if (theme === 'viking') {
      hullDark = 0x361f10; hullMid = 0x54321b; hullLight = 0x7a4b2a; trimGold = 0xd49e2a;
      sailMain = 0xf0eadc; sailShade = 0xd8cebe; sailStripe = 0xb02219;
      flagColor = 0xc92b20; lanternGlow = 0xff9e33;
    } else if (theme === 'oriental') {
      hullDark = 0x3b130f; hullMid = 0x691d16; hullLight = 0x942920; trimGold = 0xdeb035;
      sailMain = 0xc93b28; sailShade = 0xa32d1c; sailStripe = 0xe8b846;
      flagColor = 0xf0be42; lanternGlow = 0xffc459;
    }

    for (let x = -16; x <= 16; x++) {
      const t = (x + 16) / 32;
      const halfW = Math.max(1, Math.round(5.6 * Math.sin(Math.pow(t, 0.72) * Math.PI) + (x < -10 ? 1.5 : 0)));
      const deckY = x < -8 ? 4 : (x > 10 ? 3 : 2);
      const sternCastleY = x < -11 ? 7 : (x < -7 ? 5 : deckY);

      for (let y = -4; y <= sternCastleY; y++) {
        const yFactor = (y + 4) / 8;
        const curW = Math.max(1, Math.round(halfW * (0.45 + 0.55 * Math.min(1, yFactor * 1.25))));
        for (let z = -curW; z <= curW; z++) {
          const isShell = (Math.abs(z) === curW || x === -16 || x === 16 || y === -4 || y === deckY || y === sternCastleY);
          if (!isShell) continue;

          let col = hullMid;
          if (y === -4 || y === -3) col = hullDark;
          else if (y === 1) col = hullLight;
          else if (y === sternCastleY && (x < -7 || x > 10)) col = trimGold;

          if (y === 1 && Math.abs(z) === curW && x >= -6 && x <= 8 && (x % 4 === 0)) {
            col = 0x14110f;
            const zSign = z > 0 ? 1 : -1;
            vb.set(x, y, z + zSign, 0x1e2024);
          }

          if (theme === 'viking' && y === 2 && Math.abs(z) === curW && x >= -10 && x <= 10 && (x % 3 === 0)) {
            col = (x % 6 === 0) ? 0xbd261b : 0xd9a630;
          }

          if (x <= -10 && (y === 4 || y === 5) && (Math.abs(z) === curW || x === -16) && ((x + z) % 2 === 0)) {
            vb.set(x, y, z, lanternGlow, { emissive: true, jitter: 0 });
          } else {
            vb.set(x, y, z, col);
          }
        }
      }
    }

    vb.set(-17, 7, -2, lanternGlow, { emissive: true, jitter: 0 });
    vb.set(-17, 7,  2, lanternGlow, { emissive: true, jitter: 0 });
    vb.set(-17, 8,  0, lanternGlow, { emissive: true, jitter: 0 });
    vb.set(-3, 3, 0, lanternGlow, { emissive: true, jitter: 0 });
    vb.set( 5, 3, 0, lanternGlow, { emissive: true, jitter: 0 });

    if (theme === 'viking') {
      for (let i = 1; i <= 7; i++) {
        vb.set(16 + Math.floor(i * 0.6), 3 + i, 0, i >= 6 ? trimGold : hullDark);
      }
      vb.set(21, 10, 0, lanternGlow, { emissive: true });
    } else {
      for (let i = 1; i <= 9; i++) {
        vb.set(16 + i, 3 + Math.floor(i * 0.45), 0, i <= 2 ? trimGold : hullDark);
      }
    }

    const masts = theme === 'viking'
      ? [{ x: 1, h: 19, w: 8, yBase: 5, yTop: 16 }]
      : [
          { x: -8, h: 18, w: 5, yBase: 6, yTop: 15 },
          { x:  0, h: 23, w: 7, yBase: 5, yTop: 19 },
          { x:  9, h: 19, w: 6, yBase: 5, yTop: 16 }
        ];

    for (const m of masts) {
      for (let y = 2; y <= m.h; y++) {
        vb.set(m.x, y, 0, 0x331d0f);
      }
      vb.box(m.x - 1, m.yTop + 1, -1, m.x + 1, m.yTop + 1, 1, hullDark);

      for (let y = m.yBase; y <= m.yTop; y++) {
        if (theme !== 'viking' && theme !== 'oriental' && y === Math.floor((m.yBase + m.yTop) / 2)) {
          for (let z = -m.w; z <= m.w; z++) vb.set(m.x, y, z, 0x331d0f);
          continue;
        }
        if (y === m.yBase || y === m.yTop) {
          for (let z = -m.w; z <= m.w; z++) vb.set(m.x, y, z, 0x331d0f);
        }

        const vNorm = (y - m.yBase) / Math.max(1, m.yTop - m.yBase);
        const billowX = Math.round(Math.sin(vNorm * Math.PI) * 2.1);

        for (let z = -m.w; z <= m.w; z++) {
          if (theme === 'ghost' && ((y + z * 3) % 7 === 0) && y < m.yTop - 1) continue;

          const archX = billowX - (Math.abs(z) === m.w ? 1 : 0);
          let sCol = (y + z) % 2 === 0 ? sailMain : sailShade;

          if (theme === 'viking' && Math.abs(z) % 2 === 1) {
            sCol = sailStripe;
          } else if (theme === 'oriental' && (y % 3 === 0)) {
            sCol = sailStripe;
          } else if (theme === 'pirate' && m.x === 0 && Math.abs(z) <= 2 && Math.abs(y - (m.yTop - 3)) <= 1) {
            sCol = sailStripe;
          }

          vb.set(m.x + archX, y, z, sCol, {
            emissive: theme === 'ghost',
            jitter: 0.02
          });
        }
      }

      for (let fx = 0; fx <= 5; fx++) {
        const waveY = (fx === 2 || fx === 3) ? 1 : 0;
        vb.set(m.x - fx, m.h + waveY, 0, fx % 2 === 0 ? flagColor : trimGold, { emissive: theme === 'ghost' });
      }
    }

    if (theme !== 'viking') {
      for (let i = 0; i <= 7; i++) {
        for (let h = 0; h <= 7 - i; h++) {
          vb.set(11 + i, 6 + h, 0, sailMain);
        }
      }
    }

    const shipMesh = vb.buildMesh({ roughness: 0.68, metalness: 0.06 });
    shipGroup.add(shipMesh);

    const ropePts = [
      new THREE.Vector3(0, 1.05, 0), new THREE.Vector3(-0.9, 0.25, 0.28),
      new THREE.Vector3(0, 1.05, 0), new THREE.Vector3(-0.9, 0.25, -0.28),
      new THREE.Vector3(0, 1.05, 0), new THREE.Vector3(0.5, 0.9, 0),
      new THREE.Vector3(0.5, 0.9, 0), new THREE.Vector3(1.35, 0.38, 0),
      new THREE.Vector3(-0.45, 0.85, 0), new THREE.Vector3(0, 1.05, 0)
    ];
    const ropePos = [];
    for (const p of ropePts) ropePos.push(p.x, p.y, p.z);
    const ropeGeom = new THREE.BufferGeometry();
    ropeGeom.setAttribute('position', new THREE.Float32BufferAttribute(ropePos, 3));
    const ropeLines = new THREE.LineSegments(ropeGeom, new THREE.LineBasicMaterial({ color: 0x24160c }));
    shipGroup.add(ropeLines);

    return shipGroup;
  }

  function buildMiniatureSceneWorld(theme = 'pirate') {
    const worldGroup = new THREE.Group();
    const cfg = SCENE_CONFIGS[theme] || SCENE_CONFIGS.pirate;

    const vb = new VoxelBuilder(0.085);

    const sandLight = theme === 'ghost' ? 0x2c353d : (theme === 'viking' ? 0x7b8ea0 : 0xc4a46c);
    const sandDark  = theme === 'ghost' ? 0x1e252b : (theme === 'viking' ? 0x56697a : 0xa6854e);
    const rockDark  = theme === 'ghost' ? 0x1f2429 : (theme === 'viking' ? 0x43505e : 0x4a453e);
    const rockMid   = theme === 'ghost' ? 0x2e353d : (theme === 'viking' ? 0x5e6f82 : 0x635d54);
    const rockLight = theme === 'ghost' ? 0x414954 : (theme === 'viking' ? 0x8295a8 : 0x7a7368);
    const grassDark = theme === 'ghost' ? 0x1c4036 : (theme === 'viking' ? 0xdbe9f5 : (theme === 'oriental' ? 0x346b3e : 0x3b692f));
    const grassLight= theme === 'ghost' ? 0x29594b : (theme === 'viking' ? 0xf2f8ff : (theme === 'oriental' ? 0x4b8a4d : 0x528540));

    // =========================================================================
    // 1. CONTIGUOUS SEABED & LUSH FOREGROUND/MIDGROUND CORAL REEF + KELP FOREST
    // =========================================================================
    for (let x = -60; x <= 52; x++) {
      for (let z = -18; z <= 18; z++) {
        const undulate = Math.round(Math.sin(x * 0.14) * Math.cos(z * 0.22) * 1.4);
        const yTop = -20 + undulate;
        for (let y = -23; y <= yTop; y++) {
          vb.set(x, y, z, y === yTop ? sandLight : sandDark);
        }
      }
    }

    const coralColors = theme === 'ghost'
      ? [0x3bf5c4, 0x9d4edd, 0x00bbf9, 0x7209b7]
      : (theme === 'viking'
        ? [0x90e0ef, 0xcaf0f8, 0x48cae4, 0x72efdd]
        : [0xd9387c, 0x7b35b8, 0x24bdd4, 0xe05d26, 0xebaa28]);

    // Dense coral reef & swaying kelp forest visible right through the front lower bottle curve (frame_04.png!)
    for (let i = 0; i < 68; i++) {
      const h1 = Math.sin(i * 19.31 + 1.7) * 43758.5453;
      const fx = h1 - Math.floor(h1);
      const h2 = Math.sin(i * 43.17 + 5.3) * 43758.5453;
      const fz = h2 - Math.floor(h2);

      const cx = Math.round(-46 + fx * 86);
      // Bias corals toward front half of bottle (z from -4 to +16) so they pop through the front glass!
      const cz = Math.round(-4 + fz * 19);
      const col = coralColors[i % coralColors.length];
      const baseY = -19;

      if (i % 3 === 0) {
        // Tall branching staghorn coral (up to 9 voxels tall!)
        const height = 5 + (i % 5);
        for (let h = 0; h < height; h++) {
          vb.set(cx, baseY + h, cz, col, { emissive: theme === 'ghost' });
          if (h >= 2) {
            vb.set(cx + (h % 2 === 0 ? 1 : -1), baseY + h, cz, col, { emissive: theme === 'ghost' });
            vb.set(cx, baseY + h, cz + (h % 2 === 1 ? 1 : -1), col, { emissive: theme === 'ghost' });
          }
        }
      } else if (i % 3 === 1) {
        // Tall swaying kelp forest fronds reaching nearly to the surface!
        const kelpCol = theme === 'ghost' ? 0x1b7a63 : 0x22753f;
        const kelpH = 8 + (i % 6);
        for (let h = 0; h < kelpH; h++) {
          const sway = Math.round(Math.sin(h * 0.55 + i) * 0.8);
          vb.set(cx + sway, baseY + h, cz, kelpCol);
          if (h % 3 === 1) vb.set(cx + sway + 1, baseY + h, cz, kelpCol);
        }
      } else {
        // Vibrant purple/pink tube & brain coral cluster
        vb.box(cx - 1, baseY, cz - 1, cx + 1, baseY + 3, cz + 1, col, { emissive: theme === 'ghost' });
        vb.set(cx, baseY + 4, cz, col, { emissive: theme === 'ghost' });
      }
    }

    // =========================================================================
    // 2. LEFT ISLAND (cx = -39, cz = -1 -> world x ≈ -3.32, z ≈ -0.09)
    // =========================================================================
    const leftCX = -39, leftCZ = -1;
    for (let y = -20; y <= 3; y++) {
      const rad = y < -4
        ? 13.5 - (y + 20) * 0.08
        : 12.5 - (y + 4) * 1.15;
      for (let dx = -15; dx <= 15; dx++) {
        for (let dz = -15; dz <= 15; dz++) {
          const lobe = Math.sin(Math.atan2(dz, dx) * 3.0 + 0.8) * 1.3;
          const d = Math.sqrt(dx * dx + dz * dz);
          if (d <= rad + lobe) {
            let col = y < -4 ? rockDark : (y < 0 ? rockMid : (d < rad - 1.2 ? grassLight : grassDark));
            if (y === -4 && d > rad - 1.5) col = sandLight;
            vb.set(leftCX + dx, y, leftCZ + dz, col);
          }
        }
      }
    }

    if (theme === 'pirate') {
      const lhx = leftCX - 3, lhz = leftCZ - 2;
      for (let h = 0; h <= 16; h++) {
        const y = 3 + h;
        const r = h < 13 ? (3.6 - h * 0.09) : (h === 13 ? 3.5 : (h <= 15 ? 2.5 : 1.6));
        const stripeRed = Math.floor(h / 3) % 2 === 0;
        let col = stripeRed ? 0xb8291d : 0xf2ede2;
        let isEmissive = false;
        if (h === 13) col = 0x1e2022;
        else if (h === 14 || h === 15) { col = 0xffe885; isEmissive = true; }
        else if (h === 16) col = 0xa32217;
        vb.disc(lhx, y, lhz, r, col, { emissive: isEmissive, jitter: isEmissive ? 0 : 0.02 });
      }
      const ctx = leftCX + 4, ctz = leftCZ + 2;
      vb.box(ctx - 3, 3, ctz - 2, ctx + 3, 6, ctz + 2, 0xe8e0d0);
      vb.set(ctx - 1, 4, ctz + 2, 0xffcf52, { emissive: true, jitter: 0 });
      vb.set(ctx + 1, 4, ctz + 2, 0xffcf52, { emissive: true, jitter: 0 });
      vb.set(ctx + 3, 4, ctz,     0xffcf52, { emissive: true, jitter: 0 });
      for (let ry = 0; ry <= 2; ry++) {
        vb.box(ctx - 4 + ry, 7 + ry, ctz - 3 + ry, ctx + 4 - ry, 7 + ry, ctz + 3 - ry, 0xa82a1d);
      }
      vb.box(ctx + 2, 7, ctz - 2, ctx + 3, 11, ctz - 1, rockMid);
      vb.box(leftCX + 10, -3, leftCZ + 1, leftCX + 17, -3, leftCZ + 3, 0x5e3b1e);
      vb.set(leftCX + 12, -4, leftCZ + 1, 0x362010);
      vb.set(leftCX + 16, -4, leftCZ + 1, 0x362010);
      vb.set(leftCX + 16, -2, leftCZ + 1, 0x4a2c16);
    } else if (theme === 'ghost') {
      const lhx = leftCX - 2, lhz = leftCZ - 1;
      for (let h = 0; h <= 15; h++) {
        const r = h < 12 ? 3.8 - h * 0.08 : 4.2;
        const isFire = h >= 13;
        vb.disc(lhx, 3 + h, lhz, isFire ? 2.6 : r, isFire ? 0x3df5b8 : 0x242a32, { emissive: isFire });
      }
      vb.box(leftCX + 3, 1, leftCZ + 7, leftCX + 4, 2, leftCZ + 8, 0x3df5b8, { emissive: true });
      vb.box(leftCX + 7, 1, leftCZ + 6, leftCX + 8, 2, leftCZ + 7, 0x3df5b8, { emissive: true });
    } else if (theme === 'viking') {
      const lhx = leftCX - 3, lhz = leftCZ - 1;
      for (let h = 0; h <= 14; h++) {
        vb.box(lhx - 2, 3 + h, lhz - 2, lhx + 2, 3 + h, lhz + 2, h % 3 === 0 ? 0x382111 : 0x5c371d);
      }
      vb.sphere(lhx, 19, lhz, 2.8, 2.5, 2.8, 0xff8c24, { emissive: true });
      vb.box(leftCX + 2, 3, leftCZ - 2, leftCX + 8, 6, leftCZ + 3, 0x4f2f18);
      vb.set(leftCX + 5, 4, leftCZ + 3, 0xffb84d, { emissive: true });
      for (let ry = 0; ry <= 3; ry++) {
        vb.box(leftCX + 1 + ry, 7 + ry, leftCZ - 3 + ry, leftCX + 9 - ry, 7 + ry, leftCZ + 4 - ry, 0xeef6fc);
      }
    } else if (theme === 'oriental') {
      const px = leftCX - 2, pz = leftCZ - 1;
      for (let tier = 0; tier < 3; tier++) {
        const baseY = 3 + tier * 5;
        const w = 4 - tier;
        vb.box(px - w, baseY, pz - w, px + w, baseY + 3, pz + w, 0xf0e9dc);
        vb.set(px, baseY + 1, pz + w, 0xffcf66, { emissive: true });
        vb.set(px + w, baseY + 1, pz, 0xffcf66, { emissive: true });
        vb.box(px - w - 2, baseY + 3, pz - w - 2, px + w + 2, baseY + 4, pz + w + 2, 0xa82219);
      }
      for (let s = 18; s <= 22; s++) vb.set(px, s, pz, 0xe0b034);
      const tx = leftCX + 13;
      vb.box(tx, -6, leftCZ - 3, tx, 2, leftCZ - 3, 0xc9251b);
      vb.box(tx, -6, leftCZ + 3, tx, 2, leftCZ + 3, 0xc9251b);
      vb.box(tx, 1, leftCZ - 4, tx, 1, leftCZ + 4, 0xc9251b);
      vb.box(tx, 3, leftCZ - 5, tx, 3, leftCZ + 5, 0x1e1816);
      vb.set(tx, 2, leftCZ, 0xe0b034, { emissive: true });
    }

    // =========================================================================
    // 3. CENTER-BACK ISLAND (cx = 2, cz = -6 -> world x ≈ +0.17, z ≈ -0.51)
    //    Tall Stepped Twin Craggy Mountain Peaks with Cascading Central Waterfall (frame_01 & frame_04!)
    // =========================================================================
    const midCX = 2, midCZ = -6;
    for (let y = -20; y <= 16; y++) {
      // Correct height above water: hAboveWater = 0 at y = -4, up to 20 at y = 16!
      const hAbove = Math.max(0, y + 4);
      const stepH = Math.floor(hAbove / 2) * 2;
      const maxRadL = y < -4 ? 14.5 : Math.max(0, 13.8 - stepH * 0.52);
      const maxRadR = y < -4 ? 13.8 : Math.max(0, 12.8 - stepH * 0.48);

      for (let dx = -20; dx <= 20; dx++) {
        for (let dz = -12; dz <= 10; dz++) {
          const dPeakL = Math.sqrt(Math.pow((dx + 6.5) * 0.85, 2) + Math.pow(dz * 1.15, 2));
          const dPeakR = Math.sqrt(Math.pow((dx - 6.5) * 0.85, 2) + Math.pow(dz * 1.15, 2));

          if (dPeakL <= maxRadL || dPeakR <= maxRadR) {
            // Central canyon gorge between the two peaks with cascading waterfall / lava river
            const inGorge = (Math.abs(dx) <= 2 && dz >= -2 && y >= -4 && y <= 13);
            if (inGorge) {
              const wfZ = Math.round(5.8 - hAbove * 0.34);
              if (dz >= wfZ - 1 && dz <= wfZ + 1) {
                const isLava = theme === 'ghost';
                const wfCol = isLava
                  ? ((y + dx) % 2 === 0 ? 0xff4d00 : 0xffaa11)
                  : ((y + dx) % 2 === 0 ? 0x4dd8f5 : 0xe0fbff);
                vb.set(midCX + dx, y, midCZ + dz, wfCol, { emissive: isLava, jitter: 0.02 });
              }
              continue;
            }

            let col = rockMid;
            if (y < -4) {
              col = rockDark;
            } else if (y >= 12 || (y >= 8 && (dPeakL <= maxRadL - 1.2 || dPeakR <= maxRadR - 1.2) && dz < 2)) {
              col = (y % 2 === 0) ? grassLight : grassDark;
            } else if (hAbove % 4 === 0) {
              col = rockLight;
            } else if (hAbove % 4 === 2) {
              col = rockDark;
            }
            vb.set(midCX + dx, y, midCZ + dz, col);
          }
        }
      }
    }
    // White plunge-pool foam at waterfall base (y = -3)
    for (let dx = -3; dx <= 3; dx++) {
      for (let dz = 4; dz <= 8; dz++) {
        vb.set(midCX + dx, -3, midCZ + dz, theme === 'ghost' ? 0xff6611 : 0xe8fbff, { emissive: theme === 'ghost' });
      }
    }

    // =========================================================================
    // 4. RIGHT ISLAND (cx = 30, cz = 1 -> world x ≈ +2.55, z ≈ +0.09)
    // =========================================================================
    const rightCX = 30, rightCZ = 1;
    for (let y = -20; y <= 1; y++) {
      const rad = y < -4 ? 12.2 : (11.5 - (y + 4) * 1.45);
      for (let dx = -13; dx <= 13; dx++) {
        for (let dz = -13; dz <= 13; dz++) {
          const d = Math.sqrt(dx * dx + dz * dz);
          if (d <= rad + Math.sin(dx * 0.4 + dz * 0.5) * 0.9) {
            let col = y < -4 ? rockDark : (y <= -1 ? sandLight : grassLight);
            vb.set(rightCX + dx, y, rightCZ + dz, col);
          }
        }
      }
    }

    const treeTrunkCol = theme === 'ghost' ? 0x241b22 : 0x5c381c;
    const leafCols = theme === 'oriental'
      ? [0xf58cb0, 0xffadc8, 0xd9688c]
      : (theme === 'viking'
        ? [0x1d4732, 0x2a5e43, 0xe8f4ff]
        : (theme === 'ghost'
          ? [0x1c4f45, 0x153832, 0x35e0b0]
          : [0x225c27, 0x337834, 0x489642]));

    for (let h = 1; h <= 9; h++) {
      const bendX = Math.round(Math.sin(h * 0.25) * 1.5);
      vb.box(rightCX + bendX, h, rightCZ - 2, rightCX + bendX + 1, h, rightCZ - 1, treeTrunkCol);
    }
    const canopyCenters = [
      { x: rightCX + 1, y: 10, z: rightCZ - 1, rx: 6.5, ry: 2.4, rz: 6.2 },
      { x: rightCX - 3, y: 8,  z: rightCZ + 1, rx: 4.6, ry: 2.0, rz: 4.5 },
      { x: rightCX + 4, y: 8,  z: rightCZ - 2, rx: 4.8, ry: 2.0, rz: 4.5 }
    ];
    for (let cIdx = 0; cIdx < canopyCenters.length; cIdx++) {
      const c = canopyCenters[cIdx];
      vb.sphere(c.x, c.y, c.z, c.rx, c.ry, c.rz, leafCols[cIdx % leafCols.length], { jitter: 0.04 });
    }

    const fireX = rightCX - 3, fireZ = rightCZ + 3;
    vb.box(fireX - 1, 1, fireZ - 1, fireX + 1, 1, fireZ + 1, 0x331d0e);
    const fireCoreCol = theme === 'ghost' ? 0x4effc8 : 0xff9911;
    const fireTipCol  = theme === 'ghost' ? 0xb666ff : 0xffee55;
    vb.box(fireX - 1, 2, fireZ - 1, fireX + 1, 3, fireZ + 1, fireCoreCol, { emissive: true, jitter: 0 });
    vb.set(fireX, 4, fireZ, fireTipCol, { emissive: true, jitter: 0 });

    vb.box(rightCX + 3, 1, rightCZ + 2, rightCX + 5, 2, rightCZ + 3, 0x4f2b13);
    vb.box(rightCX + 3, 2, rightCZ + 2, rightCX + 5, 2, rightCZ + 3, 0xffd000, { emissive: true });
    vb.set(rightCX - 6, 0, rightCZ + 5, 0xc92c1d);

    vb.clipToBottleInterior(0, 0, 0, 2.03);

    const staticWorldMesh = vb.buildMesh({ roughness: 0.74, metalness: 0.05 });
    worldGroup.add(staticWorldMesh);

    // =========================================================================
    // 5. DYNAMIC BUOYANT SHIP, MOORED ROWBOAT & SOFT VOLUMETRIC LIGHTHOUSE BEAM
    // =========================================================================
    const shipGroup = buildShipGroup(theme);
    shipGroup.position.set(-0.78, WATER_LEVEL_Y, 0.46);
    worldGroup.add(shipGroup);

    const rowboatVb = new VoxelBuilder(0.055);
    rowboatVb.box(-3, 0, -1, 3, 1, 1, 0x5e361a);
    rowboatVb.box(-2, 1,  0, 2, 1, 0, 0x3d2210);
    const rowboatMesh = rowboatVb.buildMesh({ roughness: 0.72, metalness: 0.04 });
    const rowboatGroup = new THREE.Group();
    rowboatGroup.add(rowboatMesh);
    rowboatGroup.position.set(-1.95, WATER_LEVEL_Y, 0.25);
    worldGroup.add(rowboatGroup);

    // Soft-Fading Volumetric Lighthouse Beacon Beam (using custom ShaderMaterial with smooth radial & axial falloff!)
    const lighthouseBeamGroup = new THREE.Group();
    lighthouseBeamGroup.position.set(-3.57, 1.48, -0.26);
    const beamConeGeom = new THREE.CylinderGeometry(0.06, 0.68, 3.0, 24, 1, true);
    const bPos = beamConeGeom.attributes.position.array;
    for (let i = 0; i < bPos.length; i += 3) {
      const x = bPos[i], y = bPos[i + 1], z = bPos[i + 2];
      bPos[i] = 1.5 - y;
      bPos[i + 1] = x * 0.52;
      bPos[i + 2] = z;
    }
    const beamMat = new THREE.ShaderMaterial({
      uniforms: {
        uBeamColor: { value: new THREE.Color(cfg.lanternColors[0]) },
        uBeamOpacity: { value: 0.25 }
      },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vWorldPos;
        void main() {
          vUv = uv;
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          vNormal = normalize(mat3(modelMatrix) * normal);
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform vec3 uBeamColor;
        uniform float uBeamOpacity;
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vWorldPos;
        void main() {
          vec3 V = normalize(cameraPosition - vWorldPos);
          float edgeSoftness = pow(abs(dot(normalize(vNormal), V)), 1.4);
          // vUv.y = 1 at apex near lantern, 0 at far end of beam
          float axialFade = pow(clamp(vUv.y, 0.0, 1.0), 1.65) * smoothstep(0.0, 0.15, vUv.y);
          float alpha = edgeSoftness * axialFade * uBeamOpacity;
          gl_FragColor = vec4(uBeamColor, alpha);
        }
      `
    });
    const beamMesh1 = new THREE.Mesh(beamConeGeom, beamMat);
    const beamMesh2 = new THREE.Mesh(beamConeGeom, beamMat);
    beamMesh2.rotation.y = Math.PI;
    lighthouseBeamGroup.add(beamMesh1, beamMesh2);
    beamMesh1.renderOrder = 22;
    beamMesh2.renderOrder = 22;
    worldGroup.add(lighthouseBeamGroup);

    // Animated Waterfall Mist & Campfire Embers Particle System
    const mistCount = 52;
    const mistPos = new Float32Array(mistCount * 3);
    const mistCol = new Float32Array(mistCount * 3);
    const mistMeta = [];
    const cWater = new THREE.Color(theme === 'ghost' ? 0xff7722 : 0xd4fbff);
    const cFire  = new THREE.Color(cfg.lanternColors[2]);

    for (let i = 0; i < mistCount; i++) {
      const isFire = i >= 36;
      mistMeta.push({
        isFire,
        phase: Math.random() * Math.PI * 2,
        speed: 0.65 + Math.random() * 0.85,
        offsetX: (Math.random() - 0.5) * 0.26,
        offsetZ: (Math.random() - 0.5) * 0.20
      });
      const col = isFire ? cFire : cWater;
      mistCol[i * 3] = col.r;
      mistCol[i * 3 + 1] = col.g;
      mistCol[i * 3 + 2] = col.b;
    }
    const mistGeom = new THREE.BufferGeometry();
    mistGeom.setAttribute('position', new THREE.Float32BufferAttribute(mistPos, 3));
    mistGeom.setAttribute('color', new THREE.Float32BufferAttribute(mistCol, 3));
    const mistPoints = new THREE.Points(mistGeom, new THREE.PointsMaterial({
      size: 2.0,
      vertexColors: true,
      transparent: true,
      opacity: 0.88,
      depthWrite: false
    }));
    mistPoints.renderOrder = 18;
    worldGroup.add(mistPoints);

    let auroraMesh = null;
    if (theme === 'viking') {
      const aGeom = new THREE.PlaneGeometry(8.2, 0.95, 48, 4);
      const aMat = new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 } },
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        vertexShader: `
          uniform float uTime;
          varying vec2 vUv;
          void main() {
            vUv = uv;
            vec3 p = position;
            p.z += sin(p.x * 1.4 + uTime * 1.2) * 0.35;
            p.y += cos(p.x * 2.1 - uTime * 0.9) * 0.12;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
          }
        `,
        fragmentShader: `
          uniform float uTime;
          varying vec2 vUv;
          void main() {
            float curtain = sin(vUv.x * 18.0 + uTime * 1.5) * 0.5 + 0.5;
            float fadeY = sin(vUv.y * 3.14159);
            float fadeX = smoothstep(0.0, 0.15, vUv.x) * smoothstep(1.0, 0.85, vUv.x);
            vec3 col = mix(vec3(0.15, 0.95, 0.62), vec3(0.45, 0.55, 1.0), vUv.y);
            float alpha = fadeY * fadeX * (0.22 + 0.28 * curtain);
            gl_FragColor = vec4(col, alpha);
          }
        `
      });
      auroraMesh = new THREE.Mesh(aGeom, aMat);
      auroraMesh.position.set(-0.4, 1.32, -0.35);
      auroraMesh.renderOrder = 20;
      worldGroup.add(auroraMesh);
    }

    worldGroup.userData = {
      config: cfg,
      shipGroup,
      rowboatGroup,
      lighthouseBeamGroup,
      beamMat,
      auroraMesh,
      updateSceneDetails: (time, waveIntensity, bottleRock, nightFactor) => {
        const shipPose = sampleOceanPose(shipGroup.position.x, shipGroup.position.z, time, waveIntensity, bottleRock);
        shipGroup.position.y = shipPose.y + 0.04;
        shipGroup.rotation.z = shipPose.pitchZ + Math.sin(time * 1.9) * 0.025 * (0.5 + waveIntensity);
        shipGroup.rotation.x = shipPose.rollX  + Math.cos(time * 1.4) * 0.04 * (0.5 + waveIntensity);

        const boatPose = sampleOceanPose(rowboatGroup.position.x, rowboatGroup.position.z, time + 1.1, waveIntensity, bottleRock);
        rowboatGroup.position.y = boatPose.y + 0.01;
        rowboatGroup.rotation.z = boatPose.pitchZ * 1.25;
        rowboatGroup.rotation.x = boatPose.rollX * 1.25;

        lighthouseBeamGroup.rotation.y = time * 1.15;
        beamMat.uniforms.uBeamOpacity.value = 0.04 + nightFactor * 0.42;

        const posArr = mistGeom.attributes.position.array;
        for (let i = 0; i < mistCount; i++) {
          const m = mistMeta[i];
          const t = (time * m.speed + m.phase) % 1.0;
          if (!m.isFire) {
            posArr[i * 3]     = 0.17 + m.offsetX;
            posArr[i * 3 + 1] = 0.78 - t * 1.12;
            posArr[i * 3 + 2] = -0.35 + t * 0.42 + m.offsetZ * 0.25;
          } else {
            posArr[i * 3]     = 2.30 + m.offsetX * 0.7 + Math.sin(time * 3.0 + i) * 0.05;
            posArr[i * 3 + 1] = -0.15 + t * 0.85;
            posArr[i * 3 + 2] = 0.34 + m.offsetZ * 0.7;
          }
        }
        mistGeom.attributes.position.needsUpdate = true;

        if (auroraMesh) {
          auroraMesh.material.uniforms.uTime.value = time;
        }
      }
    };

    return worldGroup;
  }

  window.SCENE_CONFIGS = SCENE_CONFIGS;
  window.buildMiniatureSceneWorld = buildMiniatureSceneWorld;
})();
