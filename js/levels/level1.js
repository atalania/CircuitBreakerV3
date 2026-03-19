// ============================================================
//  LEVEL 1 — Basic Logic Gates (AND, OR, NOT)
// ============================================================

export const Level1 = {
  id: 1,
  title: "GATE FUNDAMENTALS",
  subtitle: "AND • OR • NOT",
  timeLimit: 120,
  objective: "Set the inputs so that ALL three output LEDs light up simultaneously.",
  tutorContext: `Level 1: Basic Logic Gates. The circuit has 3 input switches (A, B, C) and 3 output LEDs.
- LED X is connected to: A AND B
- LED Y is connected to: NOT C  
- LED Z is connected to: B OR C
The student must find input values that make X=1, Y=1, Z=1 simultaneously.
Solution: A=1, B=1, C=0 (A AND B = 1, NOT 0 = 1, B OR C = 1 OR 0 = 1)`,

  setup(renderer) {
    renderer.clear();
    const svg = renderer.createSVG(700, 420);

    // Panel backgrounds
    renderer.drawPanel(20, 50, 160, 320, "INPUTS");
    renderer.drawPanel(250, 30, 200, 150, "AND GATE");
    renderer.drawPanel(250, 175, 200, 100, "NOT GATE");
    renderer.drawPanel(250, 280, 200, 150, "OR GATE");
    renderer.drawPanel(520, 50, 160, 320, "OUTPUTS");

    // Input switches
    renderer.drawSwitch("A", 100, 120, "A");
    renderer.drawSwitch("B", 100, 220, "B");
    renderer.drawSwitch("C", 100, 320, "C");

    // Gates
    renderer.drawGate("and1", "and", 310, 105);
    renderer.drawGate("not1", "not", 315, 225, { width: 60 });
    renderer.drawGate("or1", "or", 310, 355);

    // Output LEDs
    renderer.drawLED("X", 600, 105, "X");
    renderer.drawLED("Y", 600, 225, "Y");
    renderer.drawLED("Z", 600, 355, "Z");

    // Wires — Inputs to gates
    renderer.drawWire("a-and", [[140, 120], [230, 120], [230, 90], [310, 90]]);
    renderer.drawWire("b-and", [[140, 220], [210, 220], [210, 120], [310, 120]]);
    renderer.drawWire("c-not", [[140, 320], [230, 320], [230, 225], [315, 225]]);
    renderer.drawWire("b-or", [[140, 220], [210, 220], [210, 340], [310, 340]]);
    renderer.drawWire("c-or", [[140, 320], [230, 320], [230, 370], [310, 370]]);

    // Wires — Gates to outputs
    renderer.drawWire("and-x", [[380, 105], [520, 105]]);
    renderer.drawWire("not-y", [[385, 225], [520, 225]]);
    renderer.drawWire("or-z", [[380, 355], [520, 355]]);

    // Labels on wires
    renderer.drawLabel(270, 82, "A→", { anchor: "end", size: "10", color: "var(--text-dim)" });
    renderer.drawLabel(270, 132, "B→", { anchor: "end", size: "10", color: "var(--text-dim)" });
    renderer.drawLabel(280, 220, "C→", { anchor: "end", size: "10", color: "var(--text-dim)" });
  },

  evaluate(inputStates) {
    const A = inputStates["A"] || 0;
    const B = inputStates["B"] || 0;
    const C = inputStates["C"] || 0;

    const X = A & B;       // AND
    const Y = C ? 0 : 1;   // NOT
    const Z = B | C;        // OR

    return {
      outputs: { X, Y, Z },
      wireStates: {
        "a-and": !!A, "b-and": !!B, "c-not": !!C,
        "b-or": !!B, "c-or": !!C,
        "and-x": !!X, "not-y": !!Y, "or-z": !!Z,
      },
      gateStates: {
        "and1": !!X, "not1": !!Y, "or1": !!Z,
      },
      isSolved: X === 1 && Y === 1 && Z === 1,
    };
  },
};
