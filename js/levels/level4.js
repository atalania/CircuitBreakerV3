// ============================================================
//  LEVEL 4 — JK Flip-Flop State Changes
// ============================================================

export const Level4 = {
  id: 4,
  title: "JK FLIP-FLOP",
  subtitle: "CLOCK • TOGGLE • STATE",
  timeLimit: 180,
  objective: "Use J, K inputs and the clock to reach the target output sequence: Q = 1 → 0 → 1 → 1 (toggle).",
  tutorContext: `Level 4: JK Flip-Flop. The student must achieve a specific sequence of Q outputs by setting J,K and pulsing the clock.
JK Flip-Flop truth table (on rising clock edge):
- J=0, K=0 → Q holds (no change)
- J=0, K=1 → Q = 0 (Reset)
- J=1, K=0 → Q = 1 (Set)
- J=1, K=1 → Q toggles (flips)
Starting state: Q=0.
Target sequence: Q must go through: 1, 0, 1, 1 (four clock pulses).
Optimal solution:
- Pulse 1: J=1, K=0, CLK → Q becomes 1 ✓
- Pulse 2: J=0, K=1, CLK → Q becomes 0 ✓
- Pulse 3: J=1, K=0, CLK → Q becomes 1 ✓
- Pulse 4: J=1, K=1, CLK → Q toggles to 0... wait, need Q=1.
Actually let me recalculate: after pulse 3 Q=1, for pulse 4 we need Q=1 still, so J=0,K=0 (hold) or J=1,K=0 (set).
- Pulse 4: J=0, K=0, CLK → Q stays 1 ✓
Alternative for pulse 4: J=1, K=0 also works.`,

  _q: 0,
  _targetSequence: [1, 0, 1, 1],
  _achievedSequence: [],
  _pulseCount: 0,

  setup(renderer) {
    this._q = 0;
    this._achievedSequence = [];
    this._pulseCount = 0;

    renderer.clear();
    const svg = renderer.createSVG(700, 450);

    // Panels
    renderer.drawPanel(20, 40, 150, 350, "INPUTS");
    renderer.drawPanel(230, 60, 240, 280, "JK FLIP-FLOP");
    renderer.drawPanel(530, 80, 150, 240, "OUTPUT");

    // Title
    renderer.drawLabel(350, 30, "EDGE-TRIGGERED JK FLIP-FLOP", {
      size: "14", color: "var(--accent-blue)", bold: true,
    });

    // Inputs
    renderer.drawSwitch("J", 95, 120, "J");
    renderer.drawSwitch("K", 95, 250, "K");
    renderer.drawClock("CLK", 95, 350, "CLK");

    // JK FF body (drawn as labeled rectangle)
    const ffX = 280, ffY = 130, ffW = 140, ffH = 160;
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.innerHTML = `
      <rect x="${ffX}" y="${ffY}" width="${ffW}" height="${ffH}" rx="6" 
            fill="var(--panel-bg)" stroke="var(--wire-off)" stroke-width="2.5" id="ff-body"/>
      <text x="${ffX + ffW / 2}" y="${ffY + 20}" text-anchor="middle" 
            fill="var(--accent-blue)" font-size="14" font-family="'Share Tech Mono', monospace" 
            font-weight="bold">JK FF</text>
      <text x="${ffX + 15}" y="${ffY + 50}" fill="var(--text-dim)" font-size="12" 
            font-family="'Share Tech Mono', monospace">J</text>
      <text x="${ffX + 15}" y="${ffY + 100}" fill="var(--text-dim)" font-size="12" 
            font-family="'Share Tech Mono', monospace">K</text>
      <text x="${ffX + ffW / 2}" y="${ffY + ffH - 10}" text-anchor="middle" 
            fill="var(--text-dim)" font-size="10" font-family="'Share Tech Mono', monospace">▷ CLK</text>
      <text x="${ffX + ffW - 15}" y="${ffY + 50}" text-anchor="end" fill="var(--text-dim)" 
            font-size="12" font-family="'Share Tech Mono', monospace">Q</text>
      <text x="${ffX + ffW - 15}" y="${ffY + 100}" text-anchor="end" fill="var(--text-dim)" 
            font-size="12" font-family="'Share Tech Mono', monospace">Q̄</text>
    `;
    svg.appendChild(g);

    // Output LEDs
    renderer.drawLED("Q", 605, 160, "Q", { radius: 18 });
    renderer.drawLED("Qbar", 605, 260, "Q̄", { radius: 14 });

    // Wires
    renderer.drawWire("j-ff", [[135, 120], [220, 120], [220, 170], [280, 170]]);
    renderer.drawWire("k-ff", [[135, 250], [220, 250], [220, 220], [280, 220]]);
    renderer.drawWire("clk-ff", [[120, 350], [220, 350], [220, 280], [350, 280]]);
    renderer.drawWire("ff-q", [[420, 170], [530, 170], [530, 160]]);
    renderer.drawWire("ff-qbar", [[420, 220], [530, 220], [530, 260]]);

    // Sequence display area
    renderer.drawLabel(350, 380, "TARGET:  1 → 0 → 1 → 1", {
      size: "13", color: "var(--warning)", bold: true,
    });
    renderer.drawLabel(350, 400, "ACHIEVED: _ → _ → _ → _", {
      size: "13", color: "var(--text-dim)", bold: true,
    });
  },

  evaluate(inputStates) {
    const J = inputStates["J"] || 0;
    const K = inputStates["K"] || 0;
    const CLK = inputStates["CLK"] || 0;
    const Q = this._q;
    const Qbar = Q ? 0 : 1;

    return {
      outputs: { Q, Qbar },
      wireStates: {
        "j-ff": !!J, "k-ff": !!K, "clk-ff": !!CLK,
        "ff-q": !!Q, "ff-qbar": !!Qbar,
      },
      gateStates: {},
      isSolved: false,
    };
  },

  // Called when clock is pulsed (rising edge)
  clockPulse(inputStates) {
    const J = inputStates["J"] || 0;
    const K = inputStates["K"] || 0;

    // JK FF truth table on rising edge
    if (J === 0 && K === 0) {
      // Hold
    } else if (J === 0 && K === 1) {
      this._q = 0; // Reset
    } else if (J === 1 && K === 0) {
      this._q = 1; // Set
    } else {
      this._q = this._q ? 0 : 1; // Toggle
    }

    this._pulseCount++;
    this._achievedSequence.push(this._q);

    const target = this._targetSequence;
    const achieved = this._achievedSequence;

    // Check if current sequence matches target so far
    let matchesSoFar = true;
    for (let i = 0; i < achieved.length; i++) {
      if (i < target.length && achieved[i] !== target[i]) {
        matchesSoFar = false;
        break;
      }
    }

    const isComplete = achieved.length >= target.length && matchesSoFar;
    const isFailed = !matchesSoFar;

    return {
      q: this._q,
      qBar: this._q ? 0 : 1,
      pulseCount: this._pulseCount,
      achieved: [...achieved],
      target: [...target],
      matchesSoFar,
      isComplete,
      isFailed,
    };
  },

  resetSequence() {
    this._q = 0;
    this._achievedSequence = [];
    this._pulseCount = 0;
  },
};
