// ============================================================
//  LEVEL 5 — Boolean Algebra Expression Challenge
// ============================================================

export const Level5 = {
  id: 5,
  title: "BOOLEAN GAUNTLET",
  subtitle: "SIMPLIFY • VERIFY • DEFUSE",
  timeLimit: 200,
  objective: "The bomb shows a Boolean expression. Find ALL input combos that make F=1 (there are exactly 4).",
  tutorContext: `Level 5: Boolean Algebra Gauntlet. The circuit implements F = (A AND B) OR (NOT A AND C) OR (B AND C).
This can be visualized as: F = AB + A'C + BC.
Truth table:
A=0,B=0,C=0 → 0+0+0 = 0
A=0,B=0,C=1 → 0+1+0 = 1 ✓
A=0,B=1,C=0 → 0+0+0 = 0
A=0,B=1,C=1 → 0+1+1 = 1 ✓
A=1,B=0,C=0 → 0+0+0 = 0
A=1,B=0,C=1 → 0+0+0 = 0
A=1,B=1,C=0 → 1+0+0 = 1 ✓
A=1,B=1,C=1 → 1+0+1 = 1 ✓
The student must find all 4 combinations where F=1: (0,0,1), (0,1,1), (1,1,0), (1,1,1).
This is the boss level — more complex circuit with 3 parallel paths merging into an OR gate.`,

  _foundCombos: new Set(),
  _requiredCombos: new Set(["001", "011", "110", "111"]),

  setup(renderer) {
    this._foundCombos = new Set();
    renderer.clear();
    const svg = renderer.createSVG(750, 480);

    // Expression display
    renderer.drawLabel(375, 28, "F = AB + A\u0305C + BC", {
      size: "16", color: "var(--warning)", bold: true,
    });

    // Panels
    renderer.drawPanel(15, 50, 130, 380, "INPUTS");
    renderer.drawPanel(170, 45, 160, 100, "AND₁: AB");
    renderer.drawPanel(170, 165, 160, 100, "AND₂: A\u0305C");
    renderer.drawPanel(170, 285, 160, 100, "AND₃: BC");
    renderer.drawPanel(400, 120, 140, 230, "OR (MERGE)");
    renderer.drawPanel(600, 170, 130, 120, "OUTPUT");

    // Inputs
    renderer.drawSwitch("A", 80, 120, "A");
    renderer.drawSwitch("B", 80, 240, "B");
    renderer.drawSwitch("C", 80, 360, "C");

    // NOT gate for A'
    renderer.drawGate("not-a", "not", 175, 215, { width: 40, height: 30 });

    // AND gates
    renderer.drawGate("and1", "and", 230, 95, { width: 55, height: 36 });
    renderer.drawGate("and2", "and", 230, 215, { width: 55, height: 36 });
    renderer.drawGate("and3", "and", 230, 335, { width: 55, height: 36 });

    // OR gate (3-input)
    renderer.drawGate("or-final", "or", 430, 230, { width: 70, height: 80 });

    // Output
    renderer.drawLED("F", 665, 230, "F", { radius: 20 });

    // Wires — inputs to gates
    renderer.drawWire("a-and1", [[120, 120], [155, 120], [155, 82], [230, 82]]);
    renderer.drawWire("b-and1", [[120, 240], [150, 240], [150, 108], [230, 108]]);
    renderer.drawWire("a-not", [[120, 120], [155, 120], [155, 200], [175, 200]]);
    renderer.drawWire("not-and2", [[220, 215], [230, 200]]);
    renderer.drawWire("c-and2", [[120, 360], [145, 360], [145, 230], [230, 230]]);
    renderer.drawWire("b-and3", [[120, 240], [150, 240], [150, 322], [230, 322]]);
    renderer.drawWire("c-and3", [[120, 360], [145, 360], [145, 348], [230, 348]]);

    // Wires — AND gates to OR gate
    renderer.drawWire("and1-or", [[285, 95], [380, 95], [380, 210], [430, 210]]);
    renderer.drawWire("and2-or", [[285, 215], [380, 215], [380, 230], [430, 230]]);
    renderer.drawWire("and3-or", [[285, 335], [380, 335], [380, 250], [430, 250]]);

    // Wire — OR to output
    renderer.drawWire("or-f", [[500, 230], [600, 230]]);

    // Path labels
    renderer.drawLabel(350, 88, "AB", { size: "10", color: "var(--accent-blue)" });
    renderer.drawLabel(355, 210, "A\u0305C", { size: "10", color: "var(--accent-blue)" });
    renderer.drawLabel(355, 350, "BC", { size: "10", color: "var(--accent-blue)" });
  },

  evaluate(inputStates) {
    const A = inputStates["A"] || 0;
    const B = inputStates["B"] || 0;
    const C = inputStates["C"] || 0;

    const notA = A ? 0 : 1;
    const AB = A & B;
    const notAC = notA & C;
    const BC = B & C;
    const F = AB | notAC | BC;

    return {
      outputs: { F },
      wireStates: {
        "a-and1": !!A, "b-and1": !!B,
        "a-not": !!A, "not-and2": !!notA, "c-and2": !!C,
        "b-and3": !!B, "c-and3": !!C,
        "and1-or": !!AB, "and2-or": !!notAC, "and3-or": !!BC,
        "or-f": !!F,
      },
      gateStates: {
        "not-a": !!notA, "and1": !!AB, "and2": !!notAC, "and3": !!BC, "or-final": !!F,
      },
      combo: `${A}${B}${C}`,
      fValue: F,
      isSolved: false,
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
