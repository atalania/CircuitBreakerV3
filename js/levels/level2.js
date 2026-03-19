// ============================================================
//  LEVEL 2 — Truth Table Challenge (XOR + NAND)
// ============================================================

export const Level2 = {
  id: 2,
  title: "TRUTH TABLE DECODE",
  subtitle: "XOR • NAND",
  timeLimit: 150,
  objective: "Complete the truth table: find ALL input combos where Output Q = 1, then set the final combo and submit.",
  tutorContext: `Level 2: Truth Table Puzzle. The circuit computes Q = (A XOR B) NAND C.
The student must discover which input combinations produce Q=1.
Truth table:
A=0,B=0,C=0 → XOR=0, NAND(0,0)=1 → Q=1
A=0,B=0,C=1 → XOR=0, NAND(0,1)=1 → Q=1
A=0,B=1,C=0 → XOR=1, NAND(1,0)=1 → Q=1
A=0,B=1,C=1 → XOR=1, NAND(1,1)=0 → Q=0
A=1,B=0,C=0 → XOR=1, NAND(1,0)=1 → Q=1
A=1,B=0,C=1 → XOR=1, NAND(1,1)=0 → Q=0
A=1,B=1,C=0 → XOR=0, NAND(0,0)=1 → Q=1
A=1,B=1,C=1 → XOR=0, NAND(0,1)=1 → Q=1
The student must mark all combos where Q=1 in the truth table tracker. There are 6 combos that produce Q=1.`,

  _foundCombos: new Set(),
  _requiredCombos: new Set(["000", "001", "010", "100", "110", "111"]),

  setup(renderer) {
    this._foundCombos = new Set();
    renderer.clear();
    const svg = renderer.createSVG(700, 400);

    // Panels
    renderer.drawPanel(20, 50, 160, 280, "INPUTS");
    renderer.drawPanel(240, 40, 100, 130, "XOR GATE");
    renderer.drawPanel(380, 60, 120, 210, "NAND GATE");
    renderer.drawPanel(560, 100, 120, 180, "OUTPUT");

    // Inputs
    renderer.drawSwitch("A", 100, 110, "A");
    renderer.drawSwitch("B", 100, 200, "B");
    renderer.drawSwitch("C", 100, 290, "C");

    // Gates
    renderer.drawGate("xor1", "xor", 255, 105, { width: 65 });
    renderer.drawGate("nand1", "nand", 395, 170, { width: 75 });

    // Output
    renderer.drawLED("Q", 620, 170, "Q", { radius: 16 });

    // Wires
    renderer.drawWire("a-xor", [[140, 110], [210, 110], [210, 90], [255, 90]]);
    renderer.drawWire("b-xor", [[140, 200], [210, 200], [210, 120], [255, 120]]);
    renderer.drawWire("xor-nand", [[326, 105], [360, 105], [360, 155], [395, 155]]);
    renderer.drawWire("c-nand", [[140, 290], [370, 290], [370, 185], [395, 185]]);
    renderer.drawWire("nand-q", [[478, 170], [560, 170]]);

    // XOR intermediate label
    renderer.drawLabel(343, 95, "P", { size: "12", color: "var(--accent-blue)", bold: true });

    // Truth table tracker drawn as HTML overlay (handled by the game app)
  },

  evaluate(inputStates) {
    const A = inputStates["A"] || 0;
    const B = inputStates["B"] || 0;
    const C = inputStates["C"] || 0;

    const P = A ^ B;               // XOR
    const Q = (P & C) ? 0 : 1;     // NAND

    return {
      outputs: { Q, P },
      wireStates: {
        "a-xor": !!A, "b-xor": !!B,
        "xor-nand": !!P, "c-nand": !!C,
        "nand-q": !!Q,
      },
      gateStates: {
        "xor1": !!P, "nand1": !!Q,
      },
      isSolved: false, // solved via truth table tracker
      combo: `${A}${B}${C}`,
      qValue: Q,
    };
  },

  markCombo(combo) {
    if (this._requiredCombos.has(combo)) {
      this._foundCombos.add(combo);
    }
    return {
      found: this._foundCombos.size,
      total: this._requiredCombos.size,
      isComplete: this._foundCombos.size === this._requiredCombos.size,
      foundSet: new Set(this._foundCombos),
    };
  },

  getProgress() {
    return {
      found: this._foundCombos.size,
      total: this._requiredCombos.size,
      isComplete: this._foundCombos.size === this._requiredCombos.size,
      foundSet: new Set(this._foundCombos),
    };
  },
};
