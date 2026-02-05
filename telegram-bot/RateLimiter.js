class RateLimiter {
    constructor(options = {}) {
        this.baseDelay = options.baseDelay || 2000; // 2 seconds
        this.maxAttempts = options.maxAttempts || 5;
        this.freezeTimeMs = options.freezeTimeMs || 3600000; // 1 hour
        this.consecutiveFailures = 0;
        this.frozenUntil = 0;
        this.logger = options.logger || console.log;
    }

    async execute(fn) {
        if (this.isFrozen()) {
            const waitTime = Math.ceil((this.frozenUntil - Date.now()) / 1000);
            this.logger(`❄️ RateLimiter: System Frozen. Waiting ${waitTime}s...`);
            throw new Error(`RATE_LIMIT_FREEZE: System is cooling down for ${waitTime}s`);
        }

        try {
            const result = await fn();
            this.reportSuccess();
            return result;
        } catch (error) {
            // Check for 403 or 429
            const isRateLimit = this.isRateLimitError(error);
            
            if (isRateLimit) {
                this.reportFailure();
                const delay = this.getBackoffDelay();
                this.logger(`⚠️ Rate Limit Hit! Backing off for ${delay/1000}s. Failures: ${this.consecutiveFailures}/${this.maxAttempts}`);
                
                if (this.consecutiveFailures >= this.maxAttempts) {
                    this.freeze();
                } else {
                    await new Promise(r => setTimeout(r, delay));
                }
                
                throw error; // Re-throw to let caller know
            } else {
                // Non-critical error, maybe just network glitch?
                // Don't count as rate limit failure, but maybe log it.
                throw error;
            }
        }
    }

    isRateLimitError(error) {
        if (!error) return false;
        const msg = (error.message || '').toLowerCase();
        const status = error.response ? error.response.status : 0;
        
        return status === 403 || status === 429 || 
               msg.includes('403') || msg.includes('429') || 
               msg.includes('captcha') || msg.includes('blocking');
    }

    reportSuccess() {
        if (this.consecutiveFailures > 0) {
            this.consecutiveFailures = 0;
            this.logger('✅ RateLimiter: Connection stable. Counters reset.');
        }
    }

    reportFailure() {
        this.consecutiveFailures++;
    }

    getBackoffDelay() {
        // Exponential Backoff: Base * 2^failures + Jitter
        const exp = Math.pow(2, this.consecutiveFailures);
        const jitter = Math.random() * 1000;
        return (this.baseDelay * exp) + jitter;
    }

    freeze() {
        this.frozenUntil = Date.now() + this.freezeTimeMs;
        this.logger(`🥶 RateLimiter: MAX FAILURES REACHED. Freezing system for ${this.freezeTimeMs/1000}s.`);
        // TODO: Send Telegram Notification here if needed (via callback)
    }

    isFrozen() {
        return Date.now() < this.frozenUntil;
    }
}

module.exports = RateLimiter;
