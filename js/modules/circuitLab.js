// ============================================================
//  CIRCUIT LAB — Build combinational / simple sequential diagrams
// ============================================================

const GATE_W = { and: 70, or: 70, not: 60, xor: 65, nand: 75, nor: 80 };
const MACRO_W = { sr: 100, jk: 110 };

/**
 * Pin positions in SVG coords (match CircuitRenderer gate geometry).
 * @param {any} b
 */
export function getBlockPins(b) {
  if (b.kind === "source") {
    const cx = b.cx;
    const cy = b.cy;
    return { out: [cx + 20, cy] };
  }
  if (b.kind === "led") {
    const cx = b.cx;
    const cy = b.cy;
    return { in: [cx - 16, cy] };
  }
  if (b.kind === "sr") {
    const xl = b.xl;
    const yc = b.yc;
    const w = MACRO_W.sr;
    const h = 72;
    return {
      inS: [xl, yc - 18],
      inR: [xl, yc + 18],
      outQ: [xl + w, yc - 18],
      outQbar: [xl + w, yc + 18],
    };
  }
  if (b.kind === "jk") {
    const xl = b.xl;
    const yc = b.yc;
    const w = MACRO_W.jk;
    const h = 88;
    return {
      inJ: [xl, yc - 26],
      inK: [xl, yc + 4],
      inClk: [xl + w / 2, yc + h / 2 + 6],
      outQ: [xl + w, yc - 16],
      outQbar: [xl + w, yc + 20],
    };
  }
  const xl = b.xl;
  const yc = b.yc;
  const w = b.kind === "not" ? GATE_W.not : GATE_W[b.kind] || GATE_W.and;
  if (b.kind === "and" || b.kind === "or" || b.kind === "xor" || b.kind === "nand" || b.kind === "nor") {
    return {
      in0: [xl, yc - 13],
      in1: [xl, yc + 13],
      out: [xl + w, yc],
    };
  }
  if (b.kind === "not") {
    return {
      in: [xl, yc],
      out: [xl + w + 6, yc],
    };
  }
  return {};
}

export function wirePath(from, to) {
  const [x0, y0] = from;
  const [x1, y1] = to;
  const midX = (x0 + x1) / 2;
  return [
    [x0, y0],
    [midX, y0],
    [midX, y1],
    [x1, y1],
  ];
}

export class CircuitLab {
  constructor() {
    /** @type {any[]} */
    this.blocks = [];
    /** @type {{ id: string, fromKey: string, toKey: string }[]} */
    this.wires = [];
    this._nextId = 1;
    /** @type {'erase'|null} */
    this.tool = null;
    this.sourceCount = 0;
    this.ledCount = 0;
  }

  _genId(prefix) {
    return `lab_${prefix}_${this._nextId++}`;
  }

  clear() {
    this.blocks = [];
    this.wires = [];
    this.tool = null;
    this.sourceCount = 0;
    this.ledCount = 0;
    this._nextId = 1;
  }

  /**
   * @param {string} kind palette kind (see implementation)
   * @param {number} svgX
   * @param {number} svgY
   */
  placeAt(kind, svgX, svgY) {
    const k = kind;
    if (k === "low" || k === "high") {
      this.sourceCount++;
      this.blocks.push({
        id: this._genId("src"),
        kind: "source",
        pin: null,
        value: k === "high" ? 1 : 0,
        cx: svgX,
        cy: svgY,
        label: k === "high" ? "1" : "0",
      });
      return;
    }
    if (k.startsWith("in:")) {
      const letter = k.slice(3);
      this.sourceCount++;
      this.blocks.push({
        id: this._genId("src"),
        kind: "source",
        pin: letter,
        value: 0,
        cx: svgX,
        cy: svgY,
        label: letter,
      });
      return;
    }
    if (k === "led" || k.startsWith("led:")) {
      const lbl = k.startsWith("led:") ? k.slice(4) : null;
      this.ledCount++;
      this.blocks.push({
        id: this._genId("out"),
        kind: "led",
        cx: svgX,
        cy: svgY,
        label: lbl || `O${this.ledCount}`,
      });
      return;
    }
    if (k === "and" || k === "or" || k === "not" || k === "xor" || k === "nand" || k === "nor") {
      const w = k === "not" ? GATE_W.not : GATE_W[k] || GATE_W.and;
      this.blocks.push({
        id: this._genId(k),
        kind: k,
        xl: svgX - w / 2,
        yc: svgY,
      });
      return;
    }
    if (k === "sr") {
      const w = MACRO_W.sr;
      this.blocks.push({
        id: this._genId("sr"),
        kind: "sr",
        xl: svgX - w / 2,
        yc: svgY,
        _q: 0,
        _qbar: 1,
      });
      return;
    }
    if (k === "jk") {
      const w = MACRO_W.jk;
      this.blocks.push({
        id: this._genId("jk"),
        kind: "jk",
        xl: svgX - w / 2,
        yc: svgY,
        _q: 0,
        _qbar: 1,
      });
      return;
    }
  }

  removeBlock(blockId) {
    this.blocks = this.blocks.filter((b) => b.id !== blockId);
    this.wires = this.wires.filter((w) => {
      const [fb] = w.fromKey.split(":");
      const [tb] = w.toKey.split(":");
      return fb !== blockId && tb !== blockId;
    });
  }

  connectPorts(fromKey, toKey) {
    const [, fromPort] = fromKey.split(":");
    const [toBlock, toPort] = toKey.split(":");
    if (!fromPort || !toBlock || !toPort) return;
    if (fromKey === toKey) return;
    if (!toPort.startsWith("in")) return;
    if (fromPort !== "out" && !(fromPort.startsWith("outQ"))) return;

    this.wires = this.wires.filter((w) => w.toKey !== toKey);
    this.wires.push({ id: this._genId("w"), fromKey, toKey });
  }

  findLedByLabel(label) {
    return this.blocks.find((b) => b.kind === "led" && String(b.label).toUpperCase() === String(label).toUpperCase()) || null;
  }

  getPinValues() {
    /** @type {{ [pin: string]: number }} */
    const m = {};
    for (const b of this.blocks) {
      if (b.kind === "source" && b.pin) {
        m[b.pin] = b.value ? 1 : 0;
      }
    }
    return m;
  }

  pulseJk(jkBlockId) {
    const b = this.blocks.find((x) => x.id === jkBlockId && x.kind === "jk");
    if (!b) return false;
    const inDep = {};
    for (const w of this.wires) {
      inDep[w.toKey] = w.fromKey;
    }
    const value = {};
    const blockById = Object.fromEntries(this.blocks.map((x) => [x.id, x]));
    const inputStates = {};
    const J = inDep[`${b.id}:inJ`] ? this._readValue(inDep[`${b.id}:inJ`], value, inputStates, blockById) : 0;
    const K = inDep[`${b.id}:inK`] ? this._readValue(inDep[`${b.id}:inK`], value, inputStates, blockById) : 0;

    if (J === 0 && K === 0) {
      /* hold */
    } else if (J === 0 && K === 1) {
      b._q = 0;
    } else if (J === 1 && K === 0) {
      b._q = 1;
    } else {
      b._q = b._q ? 0 : 1;
    }
    b._qbar = b._q ? 0 : 1;
    return true;
  }

  getSoleJkBlock() {
    const jks = this.blocks.filter((b) => b.kind === "jk");
    return jks.length === 1 ? jks[0] : null;
  }

  getSoleSrBlock() {
    const xs = this.blocks.filter((b) => b.kind === "sr");
    return xs.length === 1 ? xs[0] : null;
  }

  briefDescribe() {
    const counts = {};
    for (const b of this.blocks) {
      counts[b.kind] = (counts[b.kind] || 0) + 1;
    }
    const pins = this.getPinValues();
    return JSON.stringify({
      blocks: counts,
      wires: this.wires.length,
      pinValues: pins,
    });
  }

  render(renderer) {
    renderer.clear();
    const svg = renderer.createSVG(920, 560);
    renderer.drawPanel(16, 44, 888, 488, "CANVAS — drag parts; wire cyan outputs → inputs; tap orange input pins to toggle 0/1");

    for (const b of this.blocks) {
      if (b.kind === "source") {
        renderer.drawSignalSource(b.id, b.cx, b.cy, !!b.value);
        const lbl = document.createElementNS("http://www.w3.org/2000/svg", "text");
        lbl.setAttribute("x", String(b.cx));
        lbl.setAttribute("y", String(b.cy - 26));
        lbl.setAttribute("text-anchor", "middle");
        lbl.setAttribute("fill", "var(--text-bright)");
        lbl.setAttribute("font-size", "12");
        lbl.setAttribute("font-family", "'Share Tech Mono', monospace");
        lbl.setAttribute("font-weight", "bold");
        lbl.textContent = b.pin ? String(b.pin) : String(b.label);
        svg.appendChild(lbl);
      } else if (b.kind === "led") {
        renderer.drawLED(b.id, b.cx, b.cy, b.label);
      } else if (b.kind === "sr" || b.kind === "jk") {
        this._drawMacro(renderer, svg, b);
      } else {
        const w = b.kind === "not" ? GATE_W.not : GATE_W[b.kind] || GATE_W.and;
        renderer.drawGate(b.id, b.kind, b.xl, b.yc, b.kind === "not" ? { width: GATE_W.not } : { width: w });
      }
    }

    for (const w of this.wires) {
      const fromPt = this._resolvePinPoint(w.fromKey);
      const toPt = this._resolvePinPoint(w.toKey);
      if (!fromPt || !toPt) continue;
      renderer.drawWire(w.id, wirePath(fromPt, toPt));
    }

    for (const b of this.blocks) {
      const pins = getBlockPins(b);
      for (const [portName, pt] of Object.entries(pins)) {
        if (b.kind === "jk" && portName === "inClk") continue;
        const key = `${b.id}:${portName}`;
        const [px, py] = pt;
        const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        c.setAttribute("cx", String(px));
        c.setAttribute("cy", String(py));
        c.setAttribute("r", "9");
        c.setAttribute("class", "lab-port");
        c.dataset.blockId = b.id;
        c.dataset.port = portName;
        c.dataset.portKey = key;
        const isOut = portName === "out" || portName.startsWith("outQ");
        c.style.fill = isOut ? "rgba(0,180,255,0.15)" : "rgba(255,200,80,0.12)";
        c.style.stroke = isOut ? "var(--accent-blue)" : "var(--warning)";
        c.style.strokeWidth = "1.5";
        c.style.cursor = isOut ? "grab" : "crosshair";
        svg.appendChild(c);
      }
    }

    const preview = document.createElementNS("http://www.w3.org/2000/svg", "path");
    preview.setAttribute("id", "lab-wire-preview");
    preview.setAttribute("fill", "none");
    preview.setAttribute("stroke", "var(--accent-cyan)");
    preview.setAttribute("stroke-width", "2.5");
    preview.setAttribute("stroke-linecap", "round");
    preview.setAttribute("stroke-dasharray", "8 6");
    preview.setAttribute("opacity", "0");
    preview.style.pointerEvents = "none";
    svg.appendChild(preview);

    return { svg, wirePreview: preview };
  }

  _drawMacro(renderer, svg, b) {
    const w = b.kind === "sr" ? MACRO_W.sr : MACRO_W.jk;
    const h = b.kind === "sr" ? 72 : 88;
    const x = b.xl;
    const y = b.yc - h / 2;
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.setAttribute("id", `macro-${b.id}`);
    g.innerHTML = `
      <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8"
        fill="var(--panel-bg)" stroke="var(--wire-off)" stroke-width="2.5"/>
      <text x="${x + w / 2}" y="${y + 22}" text-anchor="middle" fill="var(--accent-blue)" font-size="13"
        font-family="'Share Tech Mono', monospace" font-weight="bold">${b.kind === "sr" ? "SR LATCH" : "JK FF"}</text>
      <text x="${x + w / 2}" y="${y + h - 10}" text-anchor="middle" fill="var(--text-muted)" font-size="9"
        font-family="'Share Tech Mono', monospace">${b.kind === "jk" ? "tap module to CLK ↑" : ""}</text>
    `;
    svg.appendChild(g);

    if (b.kind === "jk") {
      const hit = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      hit.setAttribute("x", String(x));
      hit.setAttribute("y", String(y));
      hit.setAttribute("width", String(w));
      hit.setAttribute("height", String(h));
      hit.setAttribute("fill", "transparent");
      hit.classList.add("lab-jk-hit");
      hit.dataset.jkId = b.id;
      hit.style.cursor = "pointer";
      svg.appendChild(hit);
    }
  }

  _resolvePinPoint(portKey) {
    const [bid, pname] = portKey.split(":");
    const b = this.blocks.find((x) => x.id === bid);
    if (!b) return null;
    const pins = getBlockPins(b);
    const pt = pins[pname];
    return pt || null;
  }

  setWirePreviewPath(renderer, points) {
    const svg = renderer.svg;
    if (!svg) return;
    const el = svg.querySelector("#lab-wire-preview");
    if (!el) return;
    if (!points || points.length < 2) {
      el.setAttribute("opacity", "0");
      return;
    }
    let d = `M${points[0][0]},${points[0][1]}`;
    for (let i = 1; i < points.length; i++) {
      d += ` L${points[i][0]},${points[i][1]}`;
    }
    el.setAttribute("d", d);
    el.setAttribute("opacity", "0.85");
  }

  hideWirePreview(renderer) {
    this.setWirePreviewPath(renderer, null);
  }

  _gateEval(b, inDep, value, inputStates, blockById) {
    if (b.kind === "not") {
      const src = inDep[`${b.id}:in`];
      let v = 0;
      if (src) {
        const vv = this._readValue(src, value, inputStates, blockById);
        v = vv ? 0 : 1;
      }
      return v;
    }
    const s0 = inDep[`${b.id}:in0`];
    const s1 = inDep[`${b.id}:in1`];
    const a = s0 ? this._readValue(s0, value, inputStates, blockById) : 0;
    const c = s1 ? this._readValue(s1, value, inputStates, blockById) : 0;
    if (b.kind === "and") return a && c ? 1 : 0;
    if (b.kind === "or") return a || c ? 1 : 0;
    if (b.kind === "xor") return a ^ c ? 1 : 0;
    if (b.kind === "nand") return a && c ? 0 : 1;
    if (b.kind === "nor") return a || c ? 0 : 1;
    return 0;
  }

  evaluate(inputStates) {
    const blockById = Object.fromEntries(this.blocks.map((b2) => [b2.id, b2]));
    const value = {};

    const inDep = {};
    for (const w of this.wires) {
      inDep[w.toKey] = w.fromKey;
    }

    const gateOrder = this.blocks.filter((b2) => ["and", "or", "not", "xor", "nand", "nor"].includes(b2.kind));
    const srBlocks = this.blocks.filter((b2) => b2.kind === "sr");
    const maxIt = gateOrder.length + this.wires.length + srBlocks.length * 2 + 8;

    const readMacroOut = (portKey) => {
      const [bid, port] = portKey.split(":");
      const bb = blockById[bid];
      if (!bb) return 0;
      if (bb.kind === "sr") {
        if (port === "outQ") return bb._q ? 1 : 0;
        if (port === "outQbar") return bb._qbar ? 1 : 0;
      }
      if (bb.kind === "jk") {
        if (port === "outQ") return bb._q ? 1 : 0;
        if (port === "outQbar") return bb._qbar ? 1 : 0;
      }
      return 0;
    };

    for (let it = 0; it < maxIt; it++) {
      for (const b of srBlocks) {
        const S = inDep[`${b.id}:inS`] ? this._readValue(inDep[`${b.id}:inS`], value, inputStates, blockById) : 0;
        const R = inDep[`${b.id}:inR`] ? this._readValue(inDep[`${b.id}:inR`], value, inputStates, blockById) : 0;
        if (S === 1 && R === 0) {
          b._q = 1;
          b._qbar = 0;
        } else if (S === 0 && R === 1) {
          b._q = 0;
          b._qbar = 1;
        } else if (S === 1 && R === 1) {
          b._q = 0;
          b._qbar = 0;
        }
      }

      let changed = false;
      for (const b of gateOrder) {
        const v = this._gateEval(b, inDep, value, inputStates, blockById);
        if (value[b.id] !== v) {
          value[b.id] = v;
          changed = true;
        }
      }
      for (const b of this.blocks) {
        if (b.kind !== "led") continue;
        const src = inDep[`${b.id}:in`];
        let v = 0;
        if (src) v = this._readValue(src, value, inputStates, blockById);
        if (value[b.id] !== v) {
          value[b.id] = v;
          changed = true;
        }
      }
      if (!changed) break;
    }

    const wireStates = {};
    for (const w of this.wires) {
      const v = this._readWireTail(w.fromKey, value, inputStates, blockById, readMacroOut);
      wireStates[w.id] = !!v;
    }

    const gateStates = {};
    for (const b of this.blocks) {
      if (["and", "or", "not", "xor", "nand", "nor"].includes(b.kind)) gateStates[b.id] = !!value[b.id];
    }

    const outputs = {};
    for (const b of this.blocks) {
      if (b.kind === "led") outputs[b.id] = value[b.id] ? 1 : 0;
    }

    return {
      wireStates,
      gateStates,
      outputs,
      srInvalid: srBlocks.some((b) => {
        const S = inDep[`${b.id}:inS`] ? this._readValue(inDep[`${b.id}:inS`], value, inputStates, blockById) : 0;
        const R = inDep[`${b.id}:inR`] ? this._readValue(inDep[`${b.id}:inR`], value, inputStates, blockById) : 0;
        return S === 1 && R === 1;
      }),
    };
  }

  _readWireTail(portKey, value, inputStates, blockById, readMacroOut) {
    const [bid, port] = portKey.split(":");
    const b = blockById[bid];
    if (!b) return 0;
    if (b.kind === "source") return b.pin ? (b.value ? 1 : 0) : b.value ? 1 : 0;
    if (b.kind === "sr" || b.kind === "jk") return readMacroOut(portKey);
    if (port === "out") return value[bid] ? 1 : 0;
    return this._readValue(portKey, value, inputStates, blockById);
  }

  _readValue(portKey, value, inputStates, blockById) {
    const [bid, port] = portKey.split(":");
    const b = blockById[bid];
    if (!b) return 0;
    if (b.kind === "source") return b.pin ? (b.value ? 1 : 0) : b.value ? 1 : 0;
    if (b.kind === "sr") {
      if (port === "outQ") return b._q ? 1 : 0;
      if (port === "outQbar") return b._qbar ? 1 : 0;
    }
    if (b.kind === "jk") {
      if (port === "outQ") return b._q ? 1 : 0;
      if (port === "outQbar") return b._qbar ? 1 : 0;
    }
    if (port === "out") return value[bid] ? 1 : 0;
    return 0;
  }

  applyVisuals(renderer, inputStates) {
    const r = this.evaluate(inputStates);
    for (const [id, on] of Object.entries(r.wireStates)) {
      renderer.setWireState(id, on);
    }
    for (const [id, on] of Object.entries(r.gateStates)) {
      renderer.setGateActive(id, on);
    }
    for (const [id, val] of Object.entries(r.outputs)) {
      renderer.setLEDState(id, !!val);
    }
    return r;
  }

  static emptyInputStates() {
    return {};
  }

  toggleSource(blockId) {
    const b = this.blocks.find((x) => x.id === blockId && x.kind === "source");
    if (!b || !b.pin) return false;
    b.value = b.value ? 0 : 1;
    return true;
  }
}
