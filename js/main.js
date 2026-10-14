/**
 * main.js
 * Main application controller for the 3D Ship-in-a-Bottle Voxel Miniature World.
 * Coordinates Three.js WebGL rendering, day/night celestial lighting, weather transitions,
 * bottle rocking spring physics, scene switching, raycast water pebble drops, and UI controls.
 */
(function () {
  const state = {
    hour: 11.27,            // 11:16 AM default (matches frame_01 / frame_04)
    autoDayCycle: false,
    weather: 'sunny',       // 'sunny' (CALM), 'rainy' (BREEZE), 'stormy' (SQUALL)
    waveIntensity: 0.42,    // 0.0 to 1.0
    sceneId: 'pirate',      // 'pirate', 'ghost', 'viking', 'oriental'
    bottleRockAngle: 0.0,
    bottleRockVel: 0.0,
    tagSwingAngle: 0.0,
    tagSwingVel: 0.0,
    nightFactor: 0.0,
    stormFactor: 0.0
  };

  let scene, camera, renderer, controls, clock;
  let tabletopMesh, standGroup, bottlePivotGroup, glassBottleGroup, bottleInteriorGroup;
  let currentWorldGroup, oceanSystem, fxSystem;
  let ambientLight, hemiLight, sunDirLight, rimDirLight;
  let lighthouseLight, shipLight, campfireLight;

  function formatHourString(h) {
    const wrapped = ((h % 24) + 24) % 24;
    const hrs = Math.floor(wrapped);
    const mins = Math.floor((wrapped - hrs) * 60);
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  }

  function init() {
    const container = document.getElementById('canvas-container');
    clock = new THREE.Clock();

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1f1916);
    scene.fog = new THREE.FogExp2(0x1f1916, 0.015);

    camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.1, 120);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    if (renderer.shadowMap) {
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }
    container.appendChild(renderer.domElement);

    // 1. Setup Cinematic Multi-Light Rig
    ambientLight = new THREE.AmbientLight(0xffeedd, 0.42);
    scene.add(ambientLight);

    hemiLight = new THREE.HemisphereLight(0x9be0ff, 0x4a2f1b, 0.52);
    scene.add(hemiLight);

    sunDirLight = new THREE.DirectionalLight(0xfff3d6, 1.15);
    sunDirLight.position.set(4.5, 8.5, 5.2);
    scene.add(sunDirLight);

    rimDirLight = new THREE.DirectionalLight(0x90d5ff, 0.38);
    rimDirLight.position.set(-6.0, 4.0, -5.5);
    scene.add(rimDirLight);

    // Interior warm PointLights (Lighthouse beacon, Ship cabin lanterns, Beach campfire)
    lighthouseLight = new THREE.PointLight(0xffe28a, 0.8, 5.5);
    lighthouseLight.position.set(-3.55, 1.45, -0.22);

    shipLight = new THREE.PointLight(0xffbe55, 0.9, 4.8);
    shipLight.position.set(-0.78, 0.25, 0.42);

    campfireLight = new THREE.PointLight(0xff8826, 0.95, 4.2);
    campfireLight.position.set(2.30, 0.08, 0.34);

    // 2. Tabletop & Wooden Cradle Stand
    tabletopMesh = createTabletopMesh();
    scene.add(tabletopMesh);

    standGroup = createWoodenStandAndPlaque(SCENE_CONFIGS[state.sceneId].plaque);
    scene.add(standGroup);

    // 3. Bottle Pivot Group (rocks when user rocks the bottle!)
    bottlePivotGroup = new THREE.Group();
    scene.add(bottlePivotGroup);

    bottleInteriorGroup = new THREE.Group();
    bottlePivotGroup.add(bottleInteriorGroup);
    bottleInteriorGroup.add(lighthouseLight, shipLight, campfireLight);

    // Build initial miniature world scene
    currentWorldGroup = buildMiniatureSceneWorld(state.sceneId);
    bottleInteriorGroup.add(currentWorldGroup);

    // Build Ocean System inside bottle
    oceanSystem = createBottleOceanSystem();
    bottleInteriorGroup.add(oceanSystem);

    // Build Atmosphere & Interactive FX System
    fxSystem = createAtmosphereAndFXSystem(bottleInteriorGroup, oceanSystem);

    // Build Outer & Inner Glass Bottle + Cork + Rope Collar + Swinging Tag
    glassBottleGroup = createGlassBottleAndCork();
    bottlePivotGroup.add(glassBottleGroup);

    // 4. Setup OrbitControls & Raycast Water Tap
    const raycaster = new THREE.Raycaster();
    const waterPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -WATER_LEVEL_Y);

    controls = new BottleOrbitControls(camera, renderer.domElement, {
      onTapCanvas: (clientX, clientY) => {
        const rect = renderer.domElement.getBoundingClientRect();
        const ndc = new THREE.Vector2(
          ((clientX - rect.left) / rect.width) * 2 - 1,
          -((clientY - rect.top) / rect.height) * 2 + 1
        );
        raycaster.setFromCamera(ndc, camera);
        const hit = raycaster.intersectPlane(waterPlane, new THREE.Vector3());
        if (hit && hit.x >= -4.8 && hit.x <= 4.0 && Math.abs(hit.z) <= 1.65) {
          fxSystem.dropPebbleAt(hit.x, hit.z);
        }
      }
    });

    bindUIControls();
    window.addEventListener('resize', onWindowResize);

    // Expose controller for inspection & testing
    window.bottleApp = {
      state,
      setScene: switchBottleScene,
      setWeather: setWeatherMode,
      setHour: (h) => {
        state.hour = h;
        const slider = document.getElementById('hourSlider');
        const label = document.getElementById('hourDisplay');
        if (slider) slider.value = h;
        if (label) label.textContent = formatHourString(h);
      },
      setWaveIntensity: (w) => {
        state.waveIntensity = w;
        const slider = document.getElementById('waveSlider');
        const label = document.getElementById('waveDisplay');
        if (slider) slider.value = Math.round(w * 100);
        if (label) label.textContent = `${Math.round(w * 100)}%`;
      },
      setCameraPreset: (p) => controls.setPreset(p),
      rockBottle: triggerBottleRock,
      fireCannon: () => fxSystem.fireCannon(currentWorldGroup.userData.shipGroup),
      callDolphins: () => fxSystem.callDolphins(),
      tossBarrel: () => fxSystem.tossBarrel()
    };

    animate();
  }

  function switchBottleScene(sceneId) {
    if (!SCENE_CONFIGS[sceneId]) return;
    state.sceneId = sceneId;
    const cfg = SCENE_CONFIGS[sceneId];

    if (currentWorldGroup) {
      bottleInteriorGroup.remove(currentWorldGroup);
    }
    currentWorldGroup = buildMiniatureSceneWorld(sceneId);
    bottleInteriorGroup.add(currentWorldGroup);

    // Update brass nameplate on wooden stand
    standGroup.userData.setPlaqueText(cfg.plaque);

    // Update water palette & lantern colors
    const u = oceanSystem.userData.uniforms;
    u.uDeepColor.value.setHex(cfg.deepWater);
    u.uShallowColor.value.setHex(cfg.shallowWater);
    u.uFoamColor.value.setHex(cfg.foamColor);

    lighthouseLight.color.setHex(cfg.lanternColors[0]);
    shipLight.color.setHex(cfg.lanternColors[1]);
    campfireLight.color.setHex(cfg.lanternColors[2]);

    // Gentle celebratory rock when switching worlds
    state.bottleRockVel += 0.14;

    document.querySelectorAll('[data-scene]').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-scene') === sceneId);
    });
  }

  function setWeatherMode(weather) {
    state.weather = weather;
    if (weather === 'sunny') {
      window.bottleApp.setWaveIntensity(0.35);
    } else if (weather === 'rainy') {
      window.bottleApp.setWaveIntensity(0.58);
    } else if (weather === 'stormy') {
      window.bottleApp.setWaveIntensity(0.88);
      state.bottleRockVel += 0.18;
    }
    document.querySelectorAll('[data-weather]').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-weather') === weather);
    });
  }

  function triggerBottleRock() {
    state.bottleRockVel += (Math.random() > 0.5 ? 1 : -1) * 0.36;
    state.tagSwingVel += 0.65;
    SoundFX.playSplash();
  }

  function bindUIControls() {
    const hourSlider = document.getElementById('hourSlider');
    const hourDisplay = document.getElementById('hourDisplay');
    const btnAutoTime = document.getElementById('btnAutoTime');
    const waveSlider = document.getElementById('waveSlider');
    const waveDisplay = document.getElementById('waveDisplay');

    if (hourSlider) {
      hourSlider.addEventListener('input', (e) => {
        state.hour = parseFloat(e.target.value);
        if (hourDisplay) hourDisplay.textContent = formatHourString(state.hour);
      });
    }

    if (btnAutoTime) {
      btnAutoTime.addEventListener('click', () => {
        state.autoDayCycle = !state.autoDayCycle;
        btnAutoTime.classList.toggle('active', state.autoDayCycle);
      });
    }

    if (waveSlider) {
      waveSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        state.waveIntensity = val / 100;
        if (waveDisplay) waveDisplay.textContent = `${Math.round(val)}%`;
      });
    }

    document.querySelectorAll('[data-weather]').forEach((btn) => {
      btn.addEventListener('click', () => setWeatherMode(btn.getAttribute('data-weather')));
    });

    document.querySelectorAll('[data-scene]').forEach((btn) => {
      btn.addEventListener('click', () => switchBottleScene(btn.getAttribute('data-scene')));
    });

    document.querySelectorAll('[data-camera]').forEach((btn) => {
      btn.addEventListener('click', () => {
        controls.setPreset(btn.getAttribute('data-camera'));
        document.querySelectorAll('[data-camera]').forEach((b) => b.classList.toggle('active', b === btn));
      });
    });

    const bindClick = (id, fn) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('click', fn);
    };

    bindClick('btnFireCannon', () => fxSystem.fireCannon(currentWorldGroup.userData.shipGroup));
    bindClick('btnCallDolphins', () => fxSystem.callDolphins());
    bindClick('btnRockBottle', () => triggerBottleRock());
    bindClick('btnTossBarrel', () => fxSystem.tossBarrel());

    const btnSlowOrbit = document.getElementById('btnSlowOrbit');
    if (btnSlowOrbit) {
      btnSlowOrbit.addEventListener('click', () => {
        controls.autoOrbit = !controls.autoOrbit;
        btnSlowOrbit.classList.toggle('active', controls.autoOrbit);
      });
    }

    const btnAudio = document.getElementById('btnAudio');
    if (btnAudio) {
      btnAudio.addEventListener('click', () => {
        const on = SoundFX.setEnabled(!SoundFX.isEnabled());
        btnAudio.classList.toggle('active', on);
        btnAudio.textContent = on ? '🔊 海浪音效：開' : '🔇 海浪音效：關';
      });
    }

    const btnToggleUI = document.getElementById('btnToggleUI');
    const uiDock = document.getElementById('ui-dock');
    if (btnToggleUI && uiDock) {
      btnToggleUI.addEventListener('click', () => {
        uiDock.classList.toggle('collapsed');
        btnToggleUI.textContent = uiDock.classList.contains('collapsed') ? '▲ 展開控制面板' : '▼ 收合面板';
      });
    }
  }

  function updateLightingAndCycle(dt, time) {
    if (state.autoDayCycle) {
      state.hour = (state.hour + dt * 1.15) % 24.0;
      const hourSlider = document.getElementById('hourSlider');
      const hourDisplay = document.getElementById('hourDisplay');
      if (hourSlider) hourSlider.value = state.hour.toFixed(2);
      if (hourDisplay) hourDisplay.textContent = formatHourString(state.hour);
    }

    // Compute smooth day/sunset/night weights from state.hour (0..24)
    const h = state.hour;
    // sunElevation: +1 at 12:00 noon, 0 at 6:00 & 18:00, -1 at 0:00 midnight
    const sunAngle = ((h - 6.0) / 12.0) * Math.PI;
    const sunElev = Math.sin(sunAngle);
    const dayFactor = THREE.MathUtils.clamp((sunElev + 0.15) / 1.15, 0.0, 1.0);
    const nightFactor = 1.0 - dayFactor;
    const sunsetFactor = Math.pow(Math.max(0.0, 1.0 - Math.abs(sunElev) * 2.2), 1.5);

    state.nightFactor = nightFactor;
    const targetStorm = state.weather === 'stormy' ? 1.0 : (state.weather === 'rainy' ? 0.45 : 0.0);
    state.stormFactor += (targetStorm - state.stormFactor) * Math.min(1, dt * 3.5);

    // Room backdrop color transition
    const bgDay    = new THREE.Color(0x231d1a);
    const bgSunset = new THREE.Color(0x2a1b18);
    const bgNight  = new THREE.Color(0x0c1018);
    const bgStorm  = new THREE.Color(0x121822);

    const bgCol = bgDay.clone()
      .lerp(bgSunset, sunsetFactor * 0.7)
      .lerp(bgNight, nightFactor)
      .lerp(bgStorm, state.stormFactor * 0.65);

    scene.background.copy(bgCol);
    if (scene.fog) scene.fog.color.copy(bgCol);

    // Directional Sun/Moon Light position & color
    const sunX = -4.5 * Math.cos(sunAngle);
    const sunY = Math.max(1.8, Math.abs(sunElev) * 8.5 + 1.5);
    sunDirLight.position.set(sunX, sunY, 5.2);

    const sunNoonCol   = new THREE.Color(0xfff4dc);
    const sunSunsetCol = new THREE.Color(0xff8442);
    const moonNightCol = new THREE.Color(0x6e9cd6);

    sunDirLight.color.copy(sunNoonCol)
      .lerp(sunSunsetCol, sunsetFactor * 0.85)
      .lerp(moonNightCol, nightFactor);

    const stormDim = 1.0 - state.stormFactor * 0.48;
    sunDirLight.intensity = (0.28 + dayFactor * 0.95) * stormDim;
    ambientLight.intensity = (0.24 + dayFactor * 0.30) * stormDim;
    hemiLight.intensity = (0.28 + dayFactor * 0.36) * stormDim;

    // Warm Interior PointLights (Lighthouse, Ship Cabin, Beach Campfire) glow brightly at dusk/night & storm!
    const lanternBoost = 0.45 + nightFactor * 1.65 + state.stormFactor * 0.45;
    lighthouseLight.intensity = 1.15 * lanternBoost;
    shipLight.intensity = 1.25 * lanternBoost;
    // Flickering beach campfire
    const flicker = 0.85 + 0.28 * Math.sin(time * 11.3) * Math.cos(time * 7.1);
    campfireLight.intensity = 1.20 * lanternBoost * flicker;

    // Update Tabletop Shader uniforms
    const tableU = tabletopMesh.material.uniforms;
    tableU.uSunIntensity.value = dayFactor * stormDim;
    tableU.uNightFactor.value = nightFactor;
    tableU.uLightColor.value.copy(sunDirLight.color);

    // Update Glass Bottle Shader uniforms
    const glassU = glassBottleGroup.userData.glassUniforms;
    glassU.uSunDir.value.copy(sunDirLight.position).normalize();
    glassU.uSunColor.value.copy(sunDirLight.color);
    glassU.uNightFactor.value = nightFactor;

    // Update Ocean Shader uniforms
    const oceanU = oceanSystem.userData.uniforms;
    oceanU.uTime.value = time;
    oceanU.uWaveIntensity.value = state.waveIntensity;
    oceanU.uBottleRock.value = state.bottleRockAngle;
    oceanU.uNightFactor.value = nightFactor;
    oceanU.uStormFactor.value = state.stormFactor;
    oceanU.uSunDir.value.copy(sunDirLight.position).normalize();
    oceanU.uSunColor.value.copy(sunDirLight.color);
    if (currentWorldGroup && currentWorldGroup.userData.shipGroup) {
      oceanU.uShipPos.value.copy(currentWorldGroup.userData.shipGroup.position);
    }
  }

  function updateBottlePhysics(dt, time) {
    // Spring-damper physics for rocking the bottle on its wooden cradle
    const springK = 14.5;
    const damping = 2.6;
    const stormRock = state.stormFactor * Math.sin(time * 2.1) * 0.015;
    const accel = -springK * state.bottleRockAngle - damping * state.bottleRockVel + stormRock;
    state.bottleRockVel += accel * dt;
    state.bottleRockAngle += state.bottleRockVel * dt;

    bottlePivotGroup.rotation.z = state.bottleRockAngle;
    bottlePivotGroup.rotation.x = Math.sin(time * 1.3) * state.bottleRockAngle * 0.35;

    // Pendulum physics for the hanging ivory tag on the bottle neck
    const tagPivot = glassBottleGroup.userData.tagPivot;
    if (tagPivot) {
      const windPush = (0.04 + state.waveIntensity * 0.09) * Math.sin(time * 2.8);
      const tagAccel = -18.0 * state.tagSwingAngle - 3.2 * state.tagSwingVel - state.bottleRockVel * 1.4 + windPush;
      state.tagSwingVel += tagAccel * dt;
      state.tagSwingAngle += state.tagSwingVel * dt;
      tagPivot.rotation.z = state.tagSwingAngle;
      tagPivot.rotation.x = Math.cos(time * 2.1) * 0.06 * (0.4 + state.waveIntensity);
    }
  }

  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);
    const time = clock.elapsedTime;

    updateBottlePhysics(dt, time);
    updateLightingAndCycle(dt, time);

    oceanSystem.userData.updateRipples(dt);

    if (currentWorldGroup && currentWorldGroup.userData.updateSceneDetails) {
      currentWorldGroup.userData.updateSceneDetails(
        time,
        state.waveIntensity,
        state.bottleRockAngle,
        state.nightFactor
      );
    }

    const fxOut = fxSystem.update(dt, time, state);
    if (fxOut && fxOut.lightningFlashIntensity > 0.05) {
      ambientLight.intensity += fxOut.lightningFlashIntensity * 0.85;
      sunDirLight.intensity += fxOut.lightningFlashIntensity * 1.2;
    }

    controls.update(dt);
    renderer.render(scene, camera);
  }

  function onWindowResize() {
    if (!camera || !renderer) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
