// ============================================================
//  ENGINE.JS — Core game loop, timer, state management
// ============================================================

export const GameState = {
  MENU: "menu",
  PLAYING: "playing",
  PAUSED: "paused",
  SUCCESS: "success",
  FAILED: "failed",
};

export class GameEngine {
  constructor() {
    this.state = GameState.MENU;
    this.currentLevelIndex = 0;
    this.timeRemaining = 0;
    this.timerInterval = null;
    this.score = 0;
    this.hintsUsed = 0;
    this.onTick = null;
    this.onTimeUp = null;
    this.onStateChange = null;
    this.isPaused = false;
  }

  /**
   * @param {number} timeLimitSeconds
   * @param {{ disableTimer?: boolean }} [options]
   */
  startLevel(timeLimitSeconds, options = {}) {
    const disableTimer = options.disableTimer === true;
    this.timeRemaining = timeLimitSeconds;
    this.state = GameState.PLAYING;
    this.isPaused = false;
    this._emitStateChange();
    if (!disableTimer) {
      this._startTimer();
    }
  }

  _startTimer() {
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      if (this.isPaused) return;
      this.timeRemaining -= 0.1;
      if (this.onTick) this.onTick(this.timeRemaining);
      if (this.timeRemaining <= 0) {
        this.timeRemaining = 0;
        this._stopTimer();
        this.state = GameState.FAILED;
        this._emitStateChange();
        if (this.onTimeUp) this.onTimeUp();
      }
    }, 100);
  }

  _stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  /**
   * Halt the countdown without changing PLAYING state. Used to freeze the fuse
   * after a winning submission while the success modal is being scheduled.
   */
  freezeTimer() {
    this._stopTimer();
  }

  pause() {
    this.isPaused = true;
    this.state = GameState.PAUSED;
    this._emitStateChange();
  }

  resume() {
    this.isPaused = false;
    this.state = GameState.PLAYING;
    this._emitStateChange();
  }

  completeLevel(bonusPoints = 0) {
    this._stopTimer();
    const timeBonus = Math.floor(this.timeRemaining * 10);
    const hintPenalty = this.hintsUsed * 50;
    this.score += 100 + timeBonus + bonusPoints - hintPenalty;
    if (this.score < 0) this.score = 0;
    this.state = GameState.SUCCESS;
    this._emitStateChange();
  }

  failLevel() {
    this._stopTimer();
    this.state = GameState.FAILED;
    this._emitStateChange();
  }

  nextLevel() {
    this.currentLevelIndex++;
    this.hintsUsed = 0;
  }

  resetGame() {
    this._stopTimer();
    this.currentLevelIndex = 0;
    this.score = 0;
    this.hintsUsed = 0;
    this.timeRemaining = 0;
    this.state = GameState.MENU;
    this._emitStateChange();
  }

  getTimeFormatted() {
    const t = Math.max(0, this.timeRemaining);
    const mins = Math.floor(t / 60);
    const secs = Math.floor(t % 60);
    const ms = Math.floor((t % 1) * 10);
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${ms}`;
  }

  _emitStateChange() {
    if (this.onStateChange) this.onStateChange(this.state);
  }

  destroy() {
    this._stopTimer();
  }
}
