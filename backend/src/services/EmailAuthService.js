const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const EmailService = require('./EmailService');

const DEFAULT_CODE_EXPIRATION_MINUTES = Number(process.env.CODE_EXPIRATION_MINUTES || 10);
const DEFAULT_CODE_LENGTH = Number(process.env.CODE_LENGTH || 6);
const MAX_VERIFICATION_ATTEMPTS = Number(process.env.MAX_VERIFICATION_ATTEMPTS || 3);
const RESEND_COOLDOWN_SECONDS = Number(process.env.RESEND_COOLDOWN_SECONDS || 60);
const RATE_LIMIT_PER_HOUR = Number(process.env.RATE_LIMIT_PER_HOUR || 5);
const JWT_SECRET = process.env.JWT_SECRET || 'eubike_secret_key_2024';

class EmailAuthService {
  /**
   * @param {import('../js/mysql-config').DatabaseManager} db
   */
  constructor(db) {
    this.db = db;
  }

  generateCode() {
    const max = 10 ** DEFAULT_CODE_LENGTH;
    const min = 10 ** (DEFAULT_CODE_LENGTH - 1);
    const num = Math.floor(min + Math.random() * (max - min));
    return String(num);
  }

  hashCode(code) {
    return crypto.createHash('sha256').update(String(code)).digest('hex');
  }

  async countRecentSends(email) {
    const rows = await this.db.query(
      `SELECT COUNT(*) as cnt
       FROM verification_codes
       WHERE email = ?
         AND created_at >= datetime('now', '-1 hour')`,
      [email],
    );
    return rows?.[0]?.cnt || 0;
  }

  async getLatestCode(email) {
    const rows = await this.db.query(
      `SELECT *
       FROM verification_codes
       WHERE email = ?
       ORDER BY created_at DESC
       LIMIT 1`,
      [email],
    );
    return rows[0] || null;
  }

  async initiateVerification(email, ipAddress) {
    const now = new Date();

    const sentLastHour = await this.countRecentSends(email);
    if (sentLastHour >= RATE_LIMIT_PER_HOUR) {
      return {
        success: false,
        error: 'Слишком много попыток. Попробуйте позже.',
        code: 'rate_limited',
        resendAvailableIn: 60 * 60,
      };
    }

    const latest = await this.getLatestCode(email);
    if (latest && latest.last_sent_at) {
      const lastSentAt = new Date(latest.last_sent_at);
      const diffSec = Math.floor((now - lastSentAt) / 1000);
      if (diffSec < RESEND_COOLDOWN_SECONDS) {
        return {
          success: false,
          error: 'Код уже отправлен. Попробуйте ещё раз чуть позже.',
          code: 'cooldown',
          resendAvailableIn: RESEND_COOLDOWN_SECONDS - diffSec,
        };
      }
    }

    const code = this.generateCode();
    const codeHash = this.hashCode(code);
    const expiresAt = new Date(now.getTime() + DEFAULT_CODE_EXPIRATION_MINUTES * 60_000);

    await this.db.query(
      `INSERT INTO verification_codes 
         (email, code_hash, created_at, expires_at, attempts, verified, ip_address, last_sent_at)
       VALUES (?, ?, ?, ?, 0, 0, ?, ?)`,
      [
        email,
        codeHash,
        now.toISOString(),
        expiresAt.toISOString(),
        ipAddress || null,
        now.toISOString(),
      ],
    );

    const emailResult = await EmailService.sendVerificationCode(email, code);
    if (!emailResult.success) {
      return {
        success: false,
        error: 'Не удалось отправить письмо. Попробуйте позже.',
        code: 'send_failed',
      };
    }

    // analytics event
    try {
      await this.db.query(
        'INSERT INTO system_logs (level, source, message) VALUES (?, ?, ?)',
        [
          'info',
          'EmailAuthService',
          JSON.stringify({
            type: 'code_sent',
            email,
            created_at: now.toISOString(),
          }),
        ],
      );
    } catch {}

    return {
      success: true,
      message: 'Код отправлен на email',
      expiresIn: DEFAULT_CODE_EXPIRATION_MINUTES * 60,
      resendAvailableIn: RESEND_COOLDOWN_SECONDS,
      attemptsLeft: MAX_VERIFICATION_ATTEMPTS,
    };
  }

  async verifyCode(email, code, ipAddress) {
    const latest = await this.getLatestCode(email);
    const now = new Date();

    if (!latest) {
      return { success: false, error: 'Код не найден. Пожалуйста, запросите новый.', code: 'not_found' };
    }

    const expiresAt = latest.expires_at ? new Date(latest.expires_at) : null;
    if (!expiresAt || expiresAt.getTime() < now.getTime()) {
      return { success: false, error: 'Срок действия кода истёк. Запросите новый код.', code: 'expired' };
    }

    if (latest.attempts >= MAX_VERIFICATION_ATTEMPTS) {
      return {
        success: false,
        error: 'Превышено количество попыток. Запросите новый код.',
        code: 'too_many_attempts',
      };
    }

    const codeHash = this.hashCode(code);
    if (codeHash !== latest.code_hash) {
      await this.db.query(
        'UPDATE verification_codes SET attempts = attempts + 1 WHERE id = ?',
        [latest.id],
      );

      const remaining = Math.max(0, MAX_VERIFICATION_ATTEMPTS - (latest.attempts + 1));

      try {
        await this.db.query(
          'INSERT INTO system_logs (level, source, message) VALUES (?, ?, ?)',
          [
            'warning',
            'EmailAuthService',
            JSON.stringify({
              type: 'code_failed',
              email,
              attempts: latest.attempts + 1,
              ipAddress,
              created_at: now.toISOString(),
            }),
          ],
        );
      } catch {}

      return {
        success: false,
        error: `Неверный код. Осталось попыток: ${remaining}`,
        code: 'invalid',
        attemptsLeft: remaining,
      };
    }

    await this.db.query(
      'UPDATE verification_codes SET verified = 1, attempts = attempts + 1 WHERE id = ?',
      [latest.id],
    );

    // Find or create user
    const users = await this.db.query('SELECT * FROM users WHERE email = ?', [email]);
    let user = users[0];
    let created = false;

    if (!user) {
      const baseName = email.split('@')[0];
      const name = baseName.charAt(0).toUpperCase() + baseName.slice(1);
      const randomPassword = crypto.randomBytes(24).toString('hex');
      const bcrypt = require('bcryptjs');
      const passwordHash = await bcrypt.hash(randomPassword, 10);

      const insert = await this.db.query(
        'INSERT INTO users (name, email, password, role, created_at, email_verified) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, 1)',
        [name, email, passwordHash, 'user'],
      );

      const insertedUsers = await this.db.query('SELECT * FROM users WHERE id = ?', [insert.insertId]);
      user = insertedUsers[0];
      created = true;
    } else {
      await this.db.query(
        'UPDATE users SET email_verified = 1, last_login = CURRENT_TIMESTAMP WHERE id = ?',
        [user.id],
      );
      user.email_verified = 1;
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role || 'user' },
      JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRATION || '7d' },
    );

    try {
      await this.db.query(
        'INSERT INTO system_logs (level, source, message) VALUES (?, ?, ?)',
        [
          'info',
          'EmailAuthService',
          JSON.stringify({
            type: 'code_verified',
            email,
            user_id: user.id,
            created,
            created_at: now.toISOString(),
          }),
        ],
      );
    } catch {}

    return {
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role || 'user',
        email_verified: user.email_verified || 1,
      },
    };
  }

  async resendCode(email, ipAddress) {
    // For simplicity we reuse initiateVerification, it already enforces cooldown
    return this.initiateVerification(email, ipAddress);
  }
}

module.exports = { EmailAuthService };

