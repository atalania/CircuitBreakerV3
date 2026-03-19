// ============================================================
//  UI.JS — DOM manipulation, HUD, modals, chat panel
// ============================================================

import { GameState } from "./engine.js";

export class UIManager {
  constructor() {
    this.elements = {};
    this.chatMessages = [];
    this.screenShakeTimeout = null;
  }

  init() {
    this.elements = {
      // Screens
      menuScreen: document.getElementById("menu-screen"),
      gameScreen: document.getElementById("game-screen"),
      // HUD
      timerDisplay: document.getElementById("timer-display"),
      timerBar: document.getElementById("timer-bar"),
      levelTitle: document.getElementById("level-title"),
      levelNumber: document.getElementById("level-number"),
      scoreDisplay: document.getElementById("score-display"),
      // Game areas
      circuitContainer: document.getElementById("circuit-container"),
      objectiveText: document.getElementById("objective-text"),
      // Chat / Tutor
      chatPanel: document.getElementById("chat-panel"),
      chatMessages: document.getElementById("chat-messages"),
      chatInput: document.getElementById("chat-input"),
      chatSendBtn: document.getElementById("chat-send-btn"),
      hintBtn: document.getElementById("hint-btn"),
      // Action area
      submitBtn: document.getElementById("submit-btn"),
      // Modals
      modalOverlay: document.getElementById("modal-overlay"),
      modalTitle: document.getElementById("modal-title"),
      modalBody: document.getElementById("modal-body"),
      modalBtn1: document.getElementById("modal-btn-1"),
      modalBtn2: document.getElementById("modal-btn-2"),
      // Menu
      startBtn: document.getElementById("start-btn"),
      levelSelectBtns: document.querySelectorAll(".level-select-btn"),
    };
  }

  // ---- Screen transitions ----
  showMenu() {
    this.elements.menuScreen.classList.add("active");
    this.elements.gameScreen.classList.remove("active");
  }

  showGame() {
    this.elements.menuScreen.classList.remove("active");
    this.elements.gameScreen.classList.add("active");
  }

  // ---- HUD updates ----
  updateTimer(timeRemaining, totalTime) {
    const mins = Math.floor(Math.max(0, timeRemaining) / 60);
    const secs = Math.floor(Math.max(0, timeRemaining) % 60);
    const ms = Math.floor((Math.max(0, timeRemaining) % 1) * 10);
    const timeStr = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${ms}`;

    this.elements.timerDisplay.textContent = timeStr;

    const pct = Math.max(0, (timeRemaining / totalTime) * 100);
    this.elements.timerBar.style.width = `${pct}%`;

    // Color transitions
    if (pct > 50) {
      this.elements.timerDisplay.className = "timer-display";
      this.elements.timerBar.className = "timer-bar";
    } else if (pct > 20) {
      this.elements.timerDisplay.className = "timer-display timer-warning";
      this.elements.timerBar.className = "timer-bar timer-bar-warning";
    } else {
      this.elements.timerDisplay.className = "timer-display timer-danger";
      this.elements.timerBar.className = "timer-bar timer-bar-danger";
      // Screen shake when critical
      if (timeRemaining > 0 && timeRemaining < 10) {
        this.triggerShake();
      }
    }
  }

  updateLevelInfo(levelNum, title) {
    this.elements.levelNumber.textContent = `MODULE ${levelNum}`;
    this.elements.levelTitle.textContent = title;
  }

  updateScore(score) {
    this.elements.scoreDisplay.textContent = String(score).padStart(6, "0");
  }

  updateObjective(text) {
    this.elements.objectiveText.textContent = text;
  }

  // ---- Chat ----
  addChatMessage(text, sender = "tutor") {
    const msg = document.createElement("div");
    msg.className = `chat-message chat-${sender}`;

    const avatar = sender === "tutor" ? "🤖" : "👤";
    const name = sender === "tutor" ? "Prof. Circuit" : "You";

    msg.innerHTML = `
      <div class="chat-avatar">${avatar}</div>
      <div class="chat-content">
        <div class="chat-sender">${name}</div>
        <div class="chat-text">${this._escapeHtml(text)}</div>
      </div>
    `;

    this.elements.chatMessages.appendChild(msg);
    this.elements.chatMessages.scrollTop = this.elements.chatMessages.scrollHeight;
    this.chatMessages.push({ text, sender });
  }

  showThinking(show) {
    let indicator = document.getElementById("thinking-indicator");
    if (show) {
      if (!indicator) {
        indicator = document.createElement("div");
        indicator.id = "thinking-indicator";
        indicator.className = "chat-message chat-tutor";
        indicator.innerHTML = `
          <div class="chat-avatar">🤖</div>
          <div class="chat-content">
            <div class="chat-sender">Prof. Circuit</div>
            <div class="chat-text thinking-dots"><span>.</span><span>.</span><span>.</span></div>
          </div>
        `;
        this.elements.chatMessages.appendChild(indicator);
        this.elements.chatMessages.scrollTop = this.elements.chatMessages.scrollHeight;
      }
    } else {
      if (indicator) indicator.remove();
    }
  }

  clearChat() {
    this.elements.chatMessages.innerHTML = "";
    this.chatMessages = [];
  }

  // ---- Modals ----
  showModal(title, body, btn1Text, btn1Callback, btn2Text = null, btn2Callback = null) {
    this.elements.modalTitle.textContent = title;
    this.elements.modalBody.innerHTML = body;
    this.elements.modalBtn1.textContent = btn1Text;
    this.elements.modalBtn1.onclick = () => {
      this.hideModal();
      if (btn1Callback) btn1Callback();
    };
    if (btn2Text) {
      this.elements.modalBtn2.textContent = btn2Text;
      this.elements.modalBtn2.style.display = "inline-block";
      this.elements.modalBtn2.onclick = () => {
        this.hideModal();
        if (btn2Callback) btn2Callback();
      };
    } else {
      this.elements.modalBtn2.style.display = "none";
    }
    this.elements.modalOverlay.classList.add("active");
  }

  hideModal() {
    this.elements.modalOverlay.classList.remove("active");
  }

  showSuccessModal(score, timeBonus, callback, nextCallback = null) {
    const body = `
      <div class="modal-stats">
        <div class="stat-row"><span>Module cleared</span><span class="stat-val">+100</span></div>
        <div class="stat-row"><span>Time bonus</span><span class="stat-val">+${timeBonus}</span></div>
        <div class="stat-row total"><span>Total score</span><span class="stat-val">${score}</span></div>
      </div>
      <div class="modal-flavor">Module defused. The bomb is stabilized — for now.</div>
    `;
    this.showModal(
      "⚡ MODULE DEFUSED ⚡",
      body,
      nextCallback ? "NEXT MODULE" : "BACK TO MENU",
      nextCallback || callback,
      nextCallback ? "MENU" : null,
      callback
    );
  }

  showFailModal(callback) {
    const body = `
      <div class="modal-flavor fail-text">
        The timer hit zero. The circuit overloaded.<br/>
        Analyze what went wrong and try again, recruit.
      </div>
    `;
    this.showModal("💥 DETONATION 💥", body, "TRY AGAIN", callback, "MENU", null);
  }

  // ---- Effects ----
  triggerShake() {
    if (this.screenShakeTimeout) return;
    document.getElementById("game-screen").classList.add("screen-shake");
    this.screenShakeTimeout = setTimeout(() => {
      document.getElementById("game-screen").classList.remove("screen-shake");
      this.screenShakeTimeout = null;
    }, 200);
  }

  flashCircuit() {
    const c = this.elements.circuitContainer;
    c.classList.add("circuit-flash");
    setTimeout(() => c.classList.remove("circuit-flash"), 400);
  }

  // ---- Helpers ----
  _escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }
}
