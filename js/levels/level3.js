// ============================================================
//  LEVEL 3 — SR Latch Behavior
// ============================================================

export const Level3 = {
  id: 3,
  title: "SR LATCH LOCKDOWN",
  subtitle: "SET • RESET • MEMORY",
  timeLimit: 150,
  objective: "Follow the sequence: SET the latch, then RESET it, then SET it again — proving you understand memory behavior.",
  tutorContext: `Level 3: SR Latch. The circuit is an SR latch built from two cross-coupled NOR gates.
- S (Set): When S=1, R=0 → Q becomes 1 (SET state)
- R (Reset): When R=1, S=0 → Q becomes 0 (RESET state)
- When both S=0, R=0 → Q holds its previous value (MEMORY state)
- When both S=1, R=1 → INVALID state (both outputs forced to 0, forbidden)
The student must complete a 3-step sequence:
Step 1: SET the latch (make Q=1) by setting S=1, R=0
Step 2: Show memory works — set S=0, R=0 and verify Q stays 1, then RESET (R=1, S=0) to make Q=0
Step 3: SET again (S=1, R=0) to make Q=1 again
Each step requires pressing SUBMIT to confirm.`,

  _step: 0,
  _q: 0,
  _qBar: 1,
  _history: [],

  setup(renderer) {
    this._step = 0;
    this._q = 0;
    this._qBar = 1;
    this._history = [];

    renderer.clear();
    const svg = renderer.createSVG(700, 420);

    // Panels
    renderer.drawPanel(20, 60, 150, 280, "INPUTS");
    renderer.drawPanel(220, 40, 260, 340, "SR LATCH");
    renderer.drawPanel(530, 80, 150, 250, "OUTPUTS");

    // Title
    renderer.drawLabel(350, 30, "NOR-BASED SR LATCH", {
      size: "14", color: "var(--accent-blue)", bold: true,
    });

    // Inputs
    renderer.drawSwitch("S", 95, 140, "S (SET)");
    renderer.drawSwitch("R", 95, 280, "R (RESET)");

    // NOR gates (drawn as boxes for clarity)
    renderer.drawGate("nor1", "nor", 300, 140, { width: 80, height: 50 });
    renderer.drawGate("nor2", "nor", 300, 280, { width: 80, height: 50 });

    // Output LEDs
    renderer.drawLED("Q", 605, 140, "Q", { radius: 16 });
    renderer.drawLED("Qbar", 605, 280, "Q̄", { radius: 16 });

    // Wires — S to NOR1 top input
    renderer.drawWire("s-nor1", [[135, 140], [220, 140], [220, 125], [300, 125]]);
    // R to NOR2 bottom input
    renderer.drawWire("r-nor2", [[135, 280], [220, 280], [220, 295], [300, 295]]);

    // Cross-coupling feedback wires
    // NOR1 output feeds back to NOR2 top input
    renderer.drawWire("nor1-fb", [[380, 140], [420, 140], [420, 240], [270, 240], [270, 265], [300, 265]]);
    // NOR2 output feeds back to NOR1 bottom input
    renderer.drawWire("nor2-fb", [[380, 280], [420, 280], [420, 190], [270, 190], [270, 155], [300, 155]]);

    // NOR1 output to Q
    renderer.drawWire("nor1-q", [[380, 140], [530, 140]]);
    // NOR2 output to Qbar
    renderer.drawWire("nor2-qbar", [[380, 280], [530, 280]]);

    // Feedback labels
    renderer.drawLabel(445, 195, "feedback", { size: "9", color: "var(--text-dim)" });
    renderer.drawLabel(245, 252, "Q̄→", { size: "10", color: "var(--text-dim)" });
    renderer.drawLabel(245, 183, "Q→", { size: "10", color: "var(--text-dim)" });

    // Step indicator (updated by app)
    renderer.drawLabel(350, 400, "STEP 1 of 3: SET the latch (S=1, R=0)", {
      size: "12", color: "var(--warning)", bold: true,
    });
  },

  evaluate(inputStates) {
    const S = inputStates["S"] || 0;
    const R = inputStates["R"] || 0;

    // SR latch logic with NOR gates
    if (S === 1 && R === 0) {
      this._q = 1;
      this._qBar = 0;
    } else if (S === 0 && R === 1) {
      this._q = 0;
      this._qBar = 1;
    } else if (S === 1 && R === 1) {
      // Invalid — both outputs 0
      this._q = 0;
      this._qBar = 0;
    }
    // S=0, R=0 → memory, keep current state

    const Q = this._q;
    const Qbar = this._qBar;
    const isInvalid = S === 1 && R === 1;

    return {
      outputs: { Q, Qbar },
      wireStates: {
        "s-nor1": !!S, "r-nor2": !!R,
        "nor1-q": !!Q, "nor2-qbar": !!Qbar,
        "nor1-fb": !!Q, "nor2-fb": !!Qbar,
      },
      gateStates: {
        "nor1": !!Q, "nor2": !!Qbar,
      },
      isInvalid,
      step: this._step,
      isSolved: false, // multi-step, handled by app
    };
  },

  checkStep(inputStates) {
    const S = inputStates["S"] || 0;
    const R = inputStates["R"] || 0;
    const Q = this._q;

    if (this._step === 0) {
      // Step 1: SET — S=1, R=0, Q should be 1
      if (S === 1 && R === 0 && Q === 1) {
        this._step = 1;
        return { success: true, step: 1, message: "Latch is SET! Q=1. Now RESET it (S=0, R=1).", done: false };
      }
      return { success: false, step: 0, message: "Set S=1 and R=0 to SET the latch.", done: false };
    }

    if (this._step === 1) {
      // Step 2: RESET — R=1, S=0, Q should be 0
      if (S === 0 && R === 1 && Q === 0) {
        this._step = 2;
        return { success: true, step: 2, message: "Latch is RESET! Q=0. Now SET it one more time (S=1, R=0).", done: false };
      }
      return { success: false, step: 1, message: "Set S=0 and R=1 to RESET the latch.", done: false };
    }

    if (this._step === 2) {
      // Step 3: SET again
      if (S === 1 && R === 0 && Q === 1) {
        this._step = 3;
        return { success: true, step: 3, message: "You've proven you understand the SR latch!", done: true };
      }
      return { success: false, step: 2, message: "SET the latch one more time: S=1, R=0.", done: false };
    }

    return { success: true, step: 3, done: true };
  },
};
