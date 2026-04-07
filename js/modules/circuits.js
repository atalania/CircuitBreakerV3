// ============================================================
//  CIRCUITS.JS — Interactive SVG circuit diagram renderer
// ============================================================

export class CircuitRenderer {
  constructor(containerEl) {
    this.container = containerEl;
    this.svg = null;
    this.wires = [];
    this.gates = [];
    this.inputs = {};
    this.outputs = {};
    this.onInputChange = null;
    /** @type {null | ((id: string) => boolean)} Return false to block toggling (e.g. circuit lab erase/wire tools). */
    this.allowSwitchToggle = null;
    this.animationFrame = null;
    this.pulsePhase = 0;
  }

  clear() {
    if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
    this.container.innerHTML = "";
    this.wires = [];
    this.gates = [];
    this.inputs = {};
    this.outputs = {};
  }

  createSVG(width, height) {
    this.svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    this.svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    this.svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    this.svg.classList.add("circuit-svg");

    // Defs for glow filter and gradients
    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    defs.innerHTML = `
      <filter id="glow-on" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="4" result="blur"/>
        <feMerge>
          <feMergeNode in="blur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
      <filter id="glow-wire" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="2.5" result="blur"/>
        <feMerge>
          <feMergeNode in="blur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
      <filter id="glow-output" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="6" result="blur"/>
        <feMerge>
          <feMergeNode in="blur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
      <linearGradient id="panel-grad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="rgba(255,255,255,0.03)"/>
        <stop offset="100%" stop-color="rgba(0,0,0,0.15)"/>
      </linearGradient>
    `;
    this.svg.appendChild(defs);
    this.container.appendChild(this.svg);
    return this.svg;
  }

  // Draw a panel background
  drawPanel(x, y, w, h, label = "") {
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.innerHTML = `
      <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" 
            fill="url(#panel-grad)" stroke="var(--wire-off)" stroke-width="1.5" opacity="0.6"/>
      ${label ? `<text x="${x + w / 2}" y="${y - 8}" text-anchor="middle" 
            fill="var(--text-dim)" font-size="11" font-family="'Share Tech Mono', monospace" 
            letter-spacing="2">${label}</text>` : ""}
    `;
    this.svg.appendChild(g);
  }

  // Draw a logic gate shape
  drawGate(id, type, x, y, options = {}) {
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.setAttribute("id", `gate-${id}`);
    g.classList.add("circuit-gate");
    const w = options.width || 70;
    const h = options.height || 50;
    const color = "var(--wire-off)";

    let shapePath = "";
    let labelText = type.toUpperCase();

    switch (type.toLowerCase()) {
      case "and":
        shapePath = `M${x},${y - h / 2} L${x + w * 0.5},${y - h / 2} 
                     A${h / 2},${h / 2} 0 0,1 ${x + w * 0.5},${y + h / 2} 
                     L${x},${y + h / 2} Z`;
        break;
      case "or":
        shapePath = `M${x},${y - h / 2} Q${x + w * 0.3},${y} ${x},${y + h / 2} 
                     Q${x + w * 0.5},${y + h / 2} ${x + w},${y} 
                     Q${x + w * 0.5},${y - h / 2} ${x},${y - h / 2} Z`;
        break;
      case "not":
        shapePath = `M${x},${y - h / 2} L${x + w - 10},${y} L${x},${y + h / 2} Z`;
        break;
      case "xor":
        shapePath = `M${x + 6},${y - h / 2} Q${x + w * 0.3 + 6},${y} ${x + 6},${y + h / 2} 
                     Q${x + w * 0.5 + 6},${y + h / 2} ${x + w + 6},${y} 
                     Q${x + w * 0.5 + 6},${y - h / 2} ${x + 6},${y - h / 2} Z`;
        break;
      case "nand":
        shapePath = `M${x},${y - h / 2} L${x + w * 0.45},${y - h / 2} 
                     A${h / 2},${h / 2} 0 0,1 ${x + w * 0.45},${y + h / 2} 
                     L${x},${y + h / 2} Z`;
        break;
      case "nor":
        shapePath = `M${x},${y - h / 2} Q${x + w * 0.3},${y} ${x},${y + h / 2} 
                     Q${x + w * 0.4},${y + h / 2} ${x + w - 10},${y} 
                     Q${x + w * 0.4},${y - h / 2} ${x},${y - h / 2} Z`;
        break;
      default: // generic box
        shapePath = `M${x},${y - h / 2} L${x + w},${y - h / 2} 
                     L${x + w},${y + h / 2} L${x},${y + h / 2} Z`;
    }

    // Bubble for NOT, NAND, NOR
    let bubble = "";
    if (type.toLowerCase() === "not") {
      bubble = `<circle cx="${x + w}" cy="${y}" r="6" fill="var(--panel-bg)" stroke="${color}" stroke-width="2" class="gate-bubble-${id}"/>`;
    } else if (type.toLowerCase() === "nand" || type.toLowerCase() === "nor") {
      bubble = `<circle cx="${x + w * 0.45 + h / 2 + 8}" cy="${y}" r="6" fill="var(--panel-bg)" stroke="${color}" stroke-width="2" class="gate-bubble-${id}"/>`;
    }

    g.innerHTML = `
      <path d="${shapePath}" fill="var(--panel-bg)" stroke="${color}" stroke-width="2.5" class="gate-body-${id}"/>
      ${bubble}
      <text x="${x + w / 2}" y="${y + 4}" text-anchor="middle" 
            fill="var(--text-dim)" font-size="12" font-family="'Share Tech Mono', monospace" 
            font-weight="bold" class="gate-label-${id}">${labelText}</text>
    `;

    this.svg.appendChild(g);
    this.gates.push({ id, type, x, y, w, h, element: g });
    return { id, x, y, w, h, cx: x + w / 2, cy: y };
  }

  // Draw a wire between two points, optionally with waypoints
  drawWire(id, points, options = {}) {
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.setAttribute("id", `wire-${id}`);

    let d = `M${points[0][0]},${points[0][1]}`;
    for (let i = 1; i < points.length; i++) {
      d += ` L${points[i][0]},${points[i][1]}`;
    }

    g.innerHTML = `
      <path d="${d}" fill="none" stroke="var(--wire-off)" stroke-width="3" 
            stroke-linecap="round" stroke-linejoin="round" class="wire-path wire-${id}"/>
      <path d="${d}" fill="none" stroke="var(--wire-off)" stroke-width="6" 
            stroke-linecap="round" stroke-linejoin="round" class="wire-glow wire-${id}-glow" 
            opacity="0" filter="url(#glow-wire)"/>
    `;

    // Junction dots at bends
    if (options.junctions) {
      for (const junc of options.junctions) {
        g.innerHTML += `<circle cx="${junc[0]}" cy="${junc[1]}" r="4" fill="var(--wire-off)" class="wire-junction-${id}"/>`;
      }
    }

    this.svg.appendChild(g);
    this.wires.push({ id, points, element: g, state: false });
    return id;
  }

  // Set wire state (on/off) with glow animation
  setWireState(wireId, isOn) {
    const wire = this.wires.find((w) => w.id === wireId);
    if (!wire) return;
    wire.state = isOn;

    const paths = wire.element.querySelectorAll(`.wire-${wireId}`);
    const glows = wire.element.querySelectorAll(`.wire-${wireId}-glow`);
    const junctions = wire.element.querySelectorAll(`.wire-junction-${wireId}`);

    paths.forEach((p) => {
      p.style.stroke = isOn ? "var(--wire-on)" : "var(--wire-off)";
      p.style.filter = isOn ? "url(#glow-wire)" : "none";
    });
    glows.forEach((g) => {
      g.style.stroke = isOn ? "var(--wire-on)" : "var(--wire-off)";
      g.style.opacity = isOn ? "0.5" : "0";
    });
    junctions.forEach((j) => {
      j.style.fill = isOn ? "var(--wire-on)" : "var(--wire-off)";
    });
  }

  // Highlight a gate as active
  setGateActive(gateId, isActive) {
    const gate = this.gates.find((g) => g.id === gateId);
    if (!gate) return;
    const body = gate.element.querySelector(`.gate-body-${gateId}`);
    const label = gate.element.querySelector(`.gate-label-${gateId}`);
    const bubble = gate.element.querySelector(`.gate-bubble-${gateId}`);
    if (body) {
      body.style.stroke = isActive ? "var(--wire-on)" : "var(--wire-off)";
      body.style.filter = isActive ? "url(#glow-on)" : "none";
    }
    if (label) {
      label.style.fill = isActive ? "var(--wire-on)" : "var(--text-dim)";
    }
    if (bubble) {
      bubble.style.stroke = isActive ? "var(--wire-on)" : "var(--wire-off)";
    }
  }

  // Draw a toggle switch input
  drawSwitch(id, x, y, label, initialState = false) {
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.setAttribute("id", `switch-${id}`);
    g.classList.add("circuit-switch");
    g.style.cursor = "pointer";

    const state = initialState;

    g.innerHTML = `
      <rect x="${x - 22}" y="${y - 14}" width="44" height="28" rx="14" 
            fill="${state ? "var(--wire-on)" : "var(--switch-off)"}" 
            stroke="var(--wire-off)" stroke-width="1.5" class="switch-track-${id}"/>
      <circle cx="${state ? x + 8 : x - 8}" cy="${y}" r="10" 
              fill="var(--switch-knob)" stroke="rgba(0,0,0,0.2)" stroke-width="1" 
              class="switch-knob-${id}" style="transition: cx 0.15s ease"/>
      <text x="${x}" y="${y + 32}" text-anchor="middle" fill="var(--text-bright)" 
            font-size="13" font-family="'Share Tech Mono', monospace" 
            font-weight="bold">${label}</text>
      <text x="${x}" y="${y + 46}" text-anchor="middle" fill="var(--text-dim)" 
            font-size="11" font-family="'Share Tech Mono', monospace" 
            class="switch-val-${id}">${state ? "1" : "0"}</text>
    `;

    this.svg.appendChild(g);
    this.inputs[id] = { element: g, state, x, y, kind: "switch" };

    g.addEventListener("click", () => {
      if (this.allowSwitchToggle && !this.allowSwitchToggle(id)) return;
      this.toggleInput(id);
    });

    return id;
  }

  /** Clickable logic pin (levels) — toggles 0/1 without a slide switch. */
  drawLogicPin(id, x, y, label, initialState = false) {
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.setAttribute("id", `pin-${id}`);
    g.classList.add("circuit-pin");
    g.style.cursor = "pointer";

    const state = initialState;
    const v = state ? "1" : "0";

    g.innerHTML = `
      <rect x="${x - 28}" y="${y - 28}" width="56" height="56" rx="10"
            fill="var(--panel-bg)" stroke="var(--wire-off)" stroke-width="2"
            class="pin-body-${id}"/>
      <text x="${x}" y="${y - 8}" text-anchor="middle" fill="var(--text-bright)"
            font-size="12" font-family="'Share Tech Mono', monospace"
            font-weight="bold">${label}</text>
      <text x="${x}" y="${y + 18}" text-anchor="middle" fill="${state ? "var(--wire-on)" : "var(--text-dim)"}"
            font-size="18" font-family="'Share Tech Mono', monospace"
            font-weight="bold" class="pin-val-${id}">${v}</text>
    `;

    this.svg.appendChild(g);
    this.inputs[id] = { element: g, state, x, y, kind: "pin" };

    g.addEventListener("click", () => {
      if (this.allowSwitchToggle && !this.allowSwitchToggle(id)) return;
      this.toggleInput(id);
    });

    return id;
  }

  /** Constant 0/1 source (circuit lab) — not in inputs map; value lives on the lab block. */
  drawSignalSource(id, cx, cy, value) {
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.setAttribute("id", `source-${id}`);
    g.classList.add("circuit-source");
    const v = value ? 1 : 0;
    const fill = v ? "rgba(0, 255, 136, 0.12)" : "rgba(42, 53, 80, 0.4)";
    const stroke = v ? "var(--wire-on)" : "var(--wire-off)";

    g.innerHTML = `
      <rect x="${cx - 20}" y="${cy - 18}" width="40" height="36" rx="8"
            fill="${fill}" stroke="${stroke}" stroke-width="2"/>
      <text x="${cx}" y="${cy + 6}" text-anchor="middle" fill="${v ? "var(--wire-on)" : "var(--text-dim)"}"
            font-size="20" font-family="'Share Tech Mono', monospace"
            font-weight="bold">${v}</text>
    `;

    this.svg.appendChild(g);
    return id;
  }

  toggleSwitch(id) {
    this.toggleInput(id);
  }

  toggleInput(id) {
    const sw = this.inputs[id];
    if (!sw) return;
    sw.state = !sw.state;

    if (sw.kind === "pin") {
      const body = sw.element.querySelector(`.pin-body-${id}`);
      const val = sw.element.querySelector(`.pin-val-${id}`);
      if (body) {
        body.style.stroke = sw.state ? "var(--wire-on)" : "var(--wire-off)";
        body.style.filter = sw.state ? "url(#glow-on)" : "none";
      }
      if (val) {
        val.textContent = sw.state ? "1" : "0";
        val.setAttribute("fill", sw.state ? "var(--wire-on)" : "var(--text-dim)");
      }
    } else {
      const track = sw.element.querySelector(`.switch-track-${id}`);
      const knob = sw.element.querySelector(`.switch-knob-${id}`);
      const val = sw.element.querySelector(`.switch-val-${id}`);

      if (track) track.setAttribute("fill", sw.state ? "var(--wire-on)" : "var(--switch-off)");
      if (knob) knob.setAttribute("cx", sw.state ? sw.x + 8 : sw.x - 8);
      if (val) val.textContent = sw.state ? "1" : "0";
    }

    if (this.onInputChange) this.onInputChange(this.getInputStates());
  }

  setSwitchState(id, state) {
    const sw = this.inputs[id];
    if (!sw || sw.state === state) return;
    this.toggleInput(id);
  }

  // Draw an output LED
  drawLED(id, x, y, label, options = {}) {
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.setAttribute("id", `led-${id}`);
    const r = options.radius || 12;

    g.innerHTML = `
      <circle cx="${x}" cy="${y}" r="${r + 4}" fill="none" stroke="var(--wire-off)" 
              stroke-width="1.5" class="led-ring-${id}"/>
      <circle cx="${x}" cy="${y}" r="${r}" fill="var(--led-off)" class="led-bulb-${id}"/>
      <text x="${x}" y="${y + r + 20}" text-anchor="middle" fill="var(--text-bright)" 
            font-size="13" font-family="'Share Tech Mono', monospace" font-weight="bold">${label}</text>
    `;

    this.svg.appendChild(g);
    this.outputs[id] = { element: g, state: false, x, y };
    return id;
  }

  setLEDState(id, isOn) {
    const led = this.outputs[id];
    if (!led) return;
    led.state = isOn;
    const bulb = led.element.querySelector(`.led-bulb-${id}`);
    const ring = led.element.querySelector(`.led-ring-${id}`);
    if (bulb) {
      bulb.setAttribute("fill", isOn ? "var(--led-on)" : "var(--led-off)");
      bulb.style.filter = isOn ? "url(#glow-output)" : "none";
    }
    if (ring) {
      ring.style.stroke = isOn ? "var(--wire-on)" : "var(--wire-off)";
    }
  }

  // Draw a clock signal indicator
  drawClock(id, x, y, label = "CLK") {
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.setAttribute("id", `clock-${id}`);
    g.style.cursor = "pointer";

    g.innerHTML = `
      <rect x="${x - 25}" y="${y - 18}" width="50" height="36" rx="6" 
            fill="var(--panel-bg)" stroke="var(--wire-off)" stroke-width="2" class="clock-box-${id}"/>
      <path d="M${x - 14},${y + 5} L${x - 14},${y - 8} L${x - 4},${y - 8} L${x - 4},${y + 5} 
              L${x + 6},${y + 5} L${x + 6},${y - 8} L${x + 14},${y - 8}" 
            fill="none" stroke="var(--text-dim)" stroke-width="1.5" class="clock-wave-${id}"/>
      <text x="${x}" y="${y + 30}" text-anchor="middle" fill="var(--text-bright)" 
            font-size="13" font-family="'Share Tech Mono', monospace" font-weight="bold">${label}</text>
    `;

    this.svg.appendChild(g);
    this.inputs[id] = { element: g, state: false, x, y, isClock: true };

    g.addEventListener("click", () => {
      this.pulseClock(id);
    });

    return id;
  }

  pulseClock(id) {
    const clk = this.inputs[id];
    if (!clk) return;

    // Rising edge
    clk.state = true;
    const box = clk.element.querySelector(`.clock-box-${id}`);
    const wave = clk.element.querySelector(`.clock-wave-${id}`);
    if (box) {
      box.style.stroke = "var(--wire-on)";
      box.style.filter = "url(#glow-on)";
    }
    if (wave) wave.style.stroke = "var(--wire-on)";

    if (this.onInputChange) this.onInputChange(this.getInputStates());

    // Falling edge after 300ms
    setTimeout(() => {
      clk.state = false;
      if (box) {
        box.style.stroke = "var(--wire-off)";
        box.style.filter = "none";
      }
      if (wave) wave.style.stroke = "var(--text-dim)";
    }, 300);
  }

  // Draw text label anywhere
  drawLabel(x, y, text, options = {}) {
    const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
    t.setAttribute("x", x);
    t.setAttribute("y", y);
    t.setAttribute("text-anchor", options.anchor || "middle");
    t.setAttribute("fill", options.color || "var(--text-dim)");
    t.setAttribute("font-size", options.size || "11");
    t.setAttribute("font-family", "'Share Tech Mono', monospace");
    if (options.bold) t.setAttribute("font-weight", "bold");
    t.textContent = text;
    this.svg.appendChild(t);
    return t;
  }

  getInputStates() {
    const states = {};
    for (const [id, input] of Object.entries(this.inputs)) {
      states[id] = input.state ? 1 : 0;
    }
    return states;
  }

  getOutputStates() {
    const states = {};
    for (const [id, output] of Object.entries(this.outputs)) {
      states[id] = output.state ? 1 : 0;
    }
    return states;
  }
}
