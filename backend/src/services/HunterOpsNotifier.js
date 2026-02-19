const axios = require('axios');

class HunterOpsNotifier {
  constructor(options = {}) {
    this.token = options.token || process.env.ADMIN_BOT_TOKEN || process.env.BOT_TOKEN || '';
    this.chatId = options.chatId || process.env.ADMIN_CHAT_ID || process.env.ADMINCHATID || '';
    this.enabled = String(process.env.ENABLE_HUNTER_TELEGRAM_ALERTS || '1') !== '0';
    this.timeoutMs = Math.max(3000, Number(process.env.HUNTER_TELEGRAM_TIMEOUT_MS || 10000) || 10000);
  }

  isReady() {
    return this.enabled && Boolean(this.token) && Boolean(this.chatId);
  }

  escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  toLocalTime(value) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return 'n/a';
    return date.toLocaleString('ru-RU', {
      timeZone: process.env.HUNTER_TIMEZONE || 'Europe/Berlin',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  formatDeficits(deficits = []) {
    if (!Array.isArray(deficits) || deficits.length === 0) return 'нет';
    return deficits
      .map((d) => `${this.escapeHtml(String(d.category || 'other'))}: ${Number(d.count || 0)}`)
      .join(', ');
  }

  async sendMessage(lines = []) {
    if (!this.isReady()) return { ok: false, skipped: true };

    const text = lines.filter(Boolean).join('\n').trim();
    if (!text) return { ok: false, skipped: true };

    try {
      const response = await axios.post(
        `https://api.telegram.org/bot${this.token}/sendMessage`,
        {
          chat_id: this.chatId,
          text,
          parse_mode: 'HTML',
          disable_web_page_preview: true
        },
        {
          timeout: this.timeoutMs
        }
      );

      if (!response?.data?.ok) {
        throw new Error(`telegram_api_error: ${JSON.stringify(response?.data || {}).slice(0, 180)}`);
      }

      return { ok: true };
    } catch (error) {
      console.warn(`[HunterOpsNotifier] send failed: ${error.message || error}`);
      return { ok: false, error: error.message || String(error) };
    }
  }

  async notifyRunStart(payload = {}) {
    const reason = this.escapeHtml(payload.reason || 'cron_hourly');
    const active = Number(payload.active || 0);
    const target = Number(payload.targetCatalogSize || 0);
    const min = Number(payload.minCatalogSize || 0);
    const deficit = Math.max(0, Number(payload.catalogDeficit || 0));
    const coverageDeficits = this.formatDeficits(payload.coverageDeficits || []);

    return this.sendMessage([
      '<b>🏹 Hourly Hunter started</b>',
      `Trigger: <code>${reason}</code>`,
      `Catalog: ${active}/${target} (min ${min})`,
      `Deficit: ${deficit}`,
      `Coverage gaps: ${coverageDeficits}`,
      `Started: ${this.escapeHtml(this.toLocalTime(payload.startedAt || new Date()))}`
    ]);
  }

  async notifyRunResult(payload = {}) {
    const status = String(payload.status || 'completed');
    const statusLabel = status === 'healthy_no_refill' ? 'healthy (no refill needed)' : status;
    const requested = Number(payload.bikesToAdd || 0);
    const added = Number(payload.bikesAdded || 0);
    const duration = this.escapeHtml(String(payload.duration || payload.durationMinutes || 'n/a'));
    const hotAdded = Number(payload.hotDealStats?.added || 0);
    const cleanupOrphans = Number(payload.cleanupStats?.orphanImagesRemoved || 0);
    const cleanupStale = Number(payload.cleanupStats?.staleDeactivated || 0);
    const activeAfter = Number(payload.healthAfter?.active || 0);
    const target = Number(payload.targetCatalogSize || 0);
    const deficit = Math.max(0, Number(payload.catalogDeficitAfter || 0));
    const coverageDeficits = this.formatDeficits(payload.coverageDeficitsAfter || []);
    const nextRunAt = this.escapeHtml(this.toLocalTime(payload.nextRunAt));
    const trigger = this.escapeHtml(payload.reason || 'cron_hourly');

    return this.sendMessage([
      '<b>✅ Hourly Hunter finished</b>',
      `Trigger: <code>${trigger}</code>`,
      `Status: <b>${this.escapeHtml(statusLabel)}</b>`,
      `Refill: ${added}/${requested} added`,
      `Hot deals added: ${hotAdded}`,
      `Cleanup: orphan=${cleanupOrphans}, stale=${cleanupStale}`,
      `Catalog: ${activeAfter}/${target}, deficit=${deficit}`,
      `Coverage gaps: ${coverageDeficits}`,
      `Duration: ${duration}`,
      `Next run: ${nextRunAt}`
    ]);
  }

  async notifyRunError(payload = {}) {
    const reason = this.escapeHtml(payload.reason || 'unknown');
    const message = this.escapeHtml(payload.message || 'unknown error');
    const active = Number(payload.active || 0);
    const target = Number(payload.targetCatalogSize || 0);

    return this.sendMessage([
      '<b>❌ Hourly Hunter failed</b>',
      `Trigger: <code>${reason}</code>`,
      `Error: <code>${message}</code>`,
      `Catalog snapshot: ${active}/${target}`,
      `Time: ${this.escapeHtml(this.toLocalTime(payload.failedAt || new Date()))}`
    ]);
  }

  async notifyWatchdogRecovery(payload = {}) {
    const ageMinutes = Number(payload.ageMinutes || 0);
    const lastRunAt = payload.lastRunAt ? this.toLocalTime(payload.lastRunAt) : 'n/a';
    return this.sendMessage([
      '<b>⚠️ Hunter watchdog recovery</b>',
      `Last run age: ${Math.round(ageMinutes)}m`,
      `Last run at: ${this.escapeHtml(lastRunAt)}`,
      'Action: forced recovery trigger'
    ]);
  }
}

module.exports = HunterOpsNotifier;
