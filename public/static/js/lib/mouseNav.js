// EdgeMouseNavigator: Smooth mouse-edge/center-based panning for D3 zoomable SVG
// Works with the existing DynamicMovieNetwork which uses d3.zoom on the #network-svg

export class EdgeMouseNavigator {
  constructor(svgSelection, zoomBehavior, options = {}) {
    // d3 selection of the SVG and the d3.zoom behavior instance
    this.svg = svgSelection; // d3 selection
    this.zoom = zoomBehavior; // d3.zoom
    this.container = this.svg.node(); // DOM element

    // Core state
    this.enabled = false;
    this.animationFrame = null;
    this.lastMouse = null; // { x, y } in local container coordinates
    this.isMouseDown = false; // avoid interfering while dragging

    // Parameters
    const defaults = {
      sensitivity: 0.06, // base sensitivity
      smoothing: 0.2, // 0..1, higher = more smoothing/lag, lower = snappier
      maxDistance: 250, // max effective distance from center in px
      deadZone: 30, // center area where navigation is inactive
      invertPanning: true, // match common UX: move mouse to right -> pan view left
      exponentialScaling: false, // if true, speed increases more at edges
      baseSpeed: 18, // base pixels/frame at full effect
    };
    this.params = { ...defaults, ...options };

    // Velocity state for smoothing
    this.velocity = { x: 0, y: 0 };

    // Cache rect occasionally to avoid layout thrash
    this.rect = this.container.getBoundingClientRect();
    this.rectUpdateTs = 0;
    this.rectUpdateIntervalMs = 150; // update bounding rect at most every 150ms

    this._bindEvents();
  }

  _bindEvents() {
    // Update mouse position relative to container
    this._onMouseMove = (e) => {
      // Periodically refresh rect for correct positioning on resizes
      const now = performance.now();
      if (now - this.rectUpdateTs > this.rectUpdateIntervalMs) {
        this.rect = this.container.getBoundingClientRect();
        this.rectUpdateTs = now;
      }

      const mx = e.clientX - this.rect.left;
      const my = e.clientY - this.rect.top;
      this.lastMouse = { x: mx, y: my };

      // Kick the animation loop if enabled
      if (this.enabled && !this.animationFrame) {
        this.animationFrame = requestAnimationFrame(() => this._animate());
      }
    };

    this._onMouseLeave = () => {
      this.lastMouse = null;
      // Stop movement gracefully
      this.velocity.x = 0;
      this.velocity.y = 0;
    };

    this._onMouseDown = () => {
      this.isMouseDown = true;
    };

    this._onMouseUp = () => {
      this.isMouseDown = false;
    };

    this._onResize = () => {
      this.rect = this.container.getBoundingClientRect();
      this.rectUpdateTs = performance.now();
    };

    this.container.addEventListener('mousemove', this._onMouseMove);
    this.container.addEventListener('mouseleave', this._onMouseLeave);
    this.container.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
    window.addEventListener('resize', this._onResize);
  }

  enable() {
    if (this.enabled) return true;
    this.enabled = true;
    // Kick off animation if mouse is already inside
    if (this.lastMouse && !this.animationFrame) {
      this.animationFrame = requestAnimationFrame(() => this._animate());
    }
    return true;
  }

  disable() {
    if (!this.enabled) return false;
    this.enabled = false;
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
    // Stop drift
    this.velocity.x = 0;
    this.velocity.y = 0;
    return false;
  }

  toggle() {
    return this.enabled ? this.disable() : this.enable();
  }

  setParams(newParams) {
    this.params = { ...this.params, ...newParams };
  }

  _animate() {
    if (!this.enabled) {
      this.animationFrame = null;
      return;
    }

    // If dragging or mouse not present, decay velocity to zero
    if (!this.lastMouse || this.isMouseDown) {
      this.velocity.x *= 0.8;
      this.velocity.y *= 0.8;
      if (Math.hypot(this.velocity.x, this.velocity.y) < 0.05) {
        this.velocity.x = 0;
        this.velocity.y = 0;
        this.animationFrame = null;
        return;
      }
      // Apply small residual motion
      try {
        this.svg.call(this.zoom.translateBy, this.velocity.x, this.velocity.y);
      } catch (e) {
        // Ignore if zoom no longer attached
      }
      this.animationFrame = requestAnimationFrame(() => this._animate());
      return;
    }

    const centerX = this.rect.width / 2;
    const centerY = this.rect.height / 2;
    let dx = this.lastMouse.x - centerX;
    let dy = this.lastMouse.y - centerY;
    let distance = Math.hypot(dx, dy);

    // Dead zone
    let effective = Math.max(0, distance - this.params.deadZone);

    // Clamp to max distance and scale direction vector accordingly
    if (effective > 0) {
      if (distance > 0) {
        const maxD = this.params.maxDistance;
        const clamped = Math.min(effective, maxD);
        // Normalize direction
        const nx = dx / (distance || 1);
        const ny = dy / (distance || 1);

        // Speed factor 0..1 depending on how far beyond dead zone
        let factor = clamped / maxD;
        if (this.params.exponentialScaling) {
          factor = Math.pow(factor, 1.3);
        }

        // Compute desired pixel velocity
        const dir = this.params.invertPanning ? -1 : 1;
        const speed = this.params.baseSpeed * this.params.sensitivity * factor;
        const desiredVx = dir * nx * speed;
        const desiredVy = dir * ny * speed;

        // Smoothly converge to desired velocity
        const s = this.params.smoothing;
        this.velocity.x = this.velocity.x * (1 - s) + desiredVx * s;
        this.velocity.y = this.velocity.y * (1 - s) + desiredVy * s;
      }
    } else {
      // Inside dead zone - gently slow to stop
      this.velocity.x *= 0.8;
      this.velocity.y *= 0.8;
      if (Math.hypot(this.velocity.x, this.velocity.y) < 0.05) {
        this.velocity.x = 0;
        this.velocity.y = 0;
      }
    }

    // Apply panning by pixel delta (d3.zoom handles current scale)
    if (this.velocity.x !== 0 || this.velocity.y !== 0) {
      try {
        this.svg.call(this.zoom.translateBy, this.velocity.x, this.velocity.y);
      } catch (e) {
        // Ignore if zoom unattached
      }
    }

    // Continue animating if movement remains or mouse is active
    if (this.enabled && (this.lastMouse || Math.hypot(this.velocity.x, this.velocity.y) > 0.02)) {
      this.animationFrame = requestAnimationFrame(() => this._animate());
    } else {
      this.animationFrame = null;
    }
  }
}
