/**
 * controls-and-ui.js
 * Implements:
 * 1. Smooth Damped OrbitControls supporting desktop mouse drag/wheel zoom & mobile 1-finger touch rotate / 2-finger pinch zoom
 * 2. Direct 3D Raycast interaction on the bottle & water surface (click water to drop a pebble)
 * 3. Camera View Presets framed so the full bottle, cork, hanging tag, and MARIGOLD · 1742 brass plaque sit cleanly above the UI dock
 */
(function () {
  class BottleOrbitControls {
    constructor(camera, domElement, callbacks = {}) {
      this.camera = camera;
      this.domElement = domElement;
      this.callbacks = callbacks;

      this.target = new THREE.Vector3(0.18, -0.56, 0.0);
      this.desiredTarget = new THREE.Vector3(0.18, -0.56, 0.0);

      this.theta = 0.04;
      this.phi   = 1.40;
      this.radius = 13.5;

      this.desiredTheta = 0.04;
      this.desiredPhi   = 1.40;
      this.desiredRadius = 13.5;

      this.minRadius = 4.6;
      this.maxRadius = 19.5;
      this.minPhi = 0.32;
      this.maxPhi = 1.60;

      this.damping = 0.12;
      this.autoOrbit = false;
      this.autoOrbitSpeed = 0.22;

      this._isDragging = false;
      this._dragDistance = 0;
      this._downX = 0;
      this._downY = 0;
      this._prevX = 0;
      this._prevY = 0;
      this._pinchDist = 0;

      this._bindEvents();
      this.update(0.016);
    }

    setPreset(presetName) {
      if (presetName === 'front') {
        this.desiredTarget.set(0.18, -0.56, 0.0);
        this.desiredTheta = 0.04;
        this.desiredPhi   = 1.40;
        this.desiredRadius = 13.5;
      } else if (presetName === 'ship') {
        this.desiredTarget.set(-0.65, -0.05, 0.35);
        this.desiredTheta = 0.28;
        this.desiredPhi   = 1.28;
        this.desiredRadius = 6.2;
      } else if (presetName === 'lighthouse') {
        this.desiredTarget.set(-1.85, 0.15, -0.15);
        this.desiredTheta = -0.32;
        this.desiredPhi   = 1.26;
        this.desiredRadius = 7.4;
      } else if (presetName === 'underwater') {
        this.desiredTarget.set(-0.25, -1.25, 0.25);
        this.desiredTheta = 0.12;
        this.desiredPhi   = 1.52;
        this.desiredRadius = 7.6;
      } else if (presetName === 'neck') {
        this.desiredTarget.set(0.15, -0.45, 0.0);
        this.desiredTheta = 1.12;
        this.desiredPhi   = 1.28;
        this.desiredRadius = 12.6;
      }
    }

    _bindEvents() {
      const el = this.domElement;

      el.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        this._isDragging = true;
        this._dragDistance = 0;
        this._downX = this._prevX = e.clientX;
        this._downY = this._prevY = e.clientY;
      });

      window.addEventListener('mousemove', (e) => {
        if (!this._isDragging) return;
        const dx = e.clientX - this._prevX;
        const dy = e.clientY - this._prevY;
        this._prevX = e.clientX;
        this._prevY = e.clientY;
        this._dragDistance += Math.hypot(dx, dy);

        this.desiredTheta -= dx * 0.0065;
        this.desiredPhi = THREE.MathUtils.clamp(this.desiredPhi - dy * 0.0055, this.minPhi, this.maxPhi);
      });

      window.addEventListener('mouseup', (e) => {
        if (!this._isDragging) return;
        this._isDragging = false;
        if (this._dragDistance < 6 && this.callbacks.onTapCanvas) {
          this.callbacks.onTapCanvas(e.clientX, e.clientY);
        }
      });

      el.addEventListener('wheel', (e) => {
        e.preventDefault();
        const zoomDelta = e.deltaY * 0.008;
        this.desiredRadius = THREE.MathUtils.clamp(this.desiredRadius + zoomDelta, this.minRadius, this.maxRadius);
      }, { passive: false });

      el.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
          this._isDragging = true;
          this._dragDistance = 0;
          this._downX = this._prevX = e.touches[0].clientX;
          this._downY = this._prevY = e.touches[0].clientY;
        } else if (e.touches.length === 2) {
          this._isDragging = false;
          const dx = e.touches[0].clientX - e.touches[1].clientX;
          const dy = e.touches[0].clientY - e.touches[1].clientY;
          this._pinchDist = Math.hypot(dx, dy);
        }
      }, { passive: true });

      el.addEventListener('touchmove', (e) => {
        if (e.touches.length === 1 && this._isDragging) {
          const dx = e.touches[0].clientX - this._prevX;
          const dy = e.touches[0].clientY - this._prevY;
          this._prevX = e.touches[0].clientX;
          this._prevY = e.touches[0].clientY;
          this._dragDistance += Math.hypot(dx, dy);

          this.desiredTheta -= dx * 0.0075;
          this.desiredPhi = THREE.MathUtils.clamp(this.desiredPhi - dy * 0.0065, this.minPhi, this.maxPhi);
        } else if (e.touches.length === 2) {
          const dx = e.touches[0].clientX - e.touches[1].clientX;
          const dy = e.touches[0].clientY - e.touches[1].clientY;
          const dist = Math.hypot(dx, dy);
          if (this._pinchDist > 0) {
            const delta = (this._pinchDist - dist) * 0.032;
            this.desiredRadius = THREE.MathUtils.clamp(this.desiredRadius + delta, this.minRadius, this.maxRadius);
          }
          this._pinchDist = dist;
        }
      }, { passive: true });

      el.addEventListener('touchend', (e) => {
        if (this._isDragging && this._dragDistance < 8 && e.changedTouches.length === 1) {
          if (this.callbacks.onTapCanvas) {
            this.callbacks.onTapCanvas(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
          }
        }
        if (e.touches.length === 0) {
          this._isDragging = false;
          this._pinchDist = 0;
        }
      }, { passive: true });
    }

    update(dt) {
      if (this.autoOrbit && !this._isDragging) {
        this.desiredTheta += dt * this.autoOrbitSpeed;
      }

      this.theta += (this.desiredTheta - this.theta) * this.damping;
      this.phi   += (this.desiredPhi   - this.phi)   * this.damping;
      this.radius += (this.desiredRadius - this.radius) * this.damping;
      this.target.lerp(this.desiredTarget, this.damping);

      this.phi = THREE.MathUtils.clamp(this.phi, this.minPhi, this.maxPhi);
      this.desiredPhi = THREE.MathUtils.clamp(this.desiredPhi, this.minPhi, this.maxPhi);

      const sinPhi = Math.sin(this.phi);
      const cosPhi = Math.cos(this.phi);
      const sinTheta = Math.sin(this.theta);
      const cosTheta = Math.cos(this.theta);

      this.camera.up.set(0, 1, 0);
      this.camera.position.set(
        this.target.x + this.radius * sinPhi * sinTheta,
        this.target.y + this.radius * cosPhi,
        this.target.z + this.radius * sinPhi * cosTheta
      );
      this.camera.lookAt(this.target);
    }
  }

  window.BottleOrbitControls = BottleOrbitControls;
})();
