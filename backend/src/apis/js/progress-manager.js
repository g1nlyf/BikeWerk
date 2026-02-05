class ProgressManager {
  constructor(fillEl, stepsEl) {
    this.fillEl = fillEl;
    this.stepsEl = stepsEl;
    this.total = 4;
    this.current = 1;
  }

  setStep(step) {
    this.current = Math.min(Math.max(step, 1), this.total);
    const pct = (this.current - 1) / (this.total - 1) * 100;
    if (this.fillEl) this.fillEl.style.width = `${pct}%`;
    if (this.stepsEl) {
      [...this.stepsEl.querySelectorAll('.step-item')].forEach((li, idx) => {
        li.classList.toggle('active', idx + 1 === this.current);
      });
    }
  }

  bindBackOnlyNavigation(onGoTo) {
    if (!this.stepsEl) return;
    this.stepsEl.addEventListener('click', (e) => {
      const li = e.target.closest('.step-item');
      if (!li) return;
      const targetStep = Number(li.dataset.step);
      if (targetStep < this.current) {
        onGoTo?.(targetStep);
      }
    });
  }
}

window.ProgressManager = ProgressManager;