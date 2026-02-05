const sgMail = require('@sendgrid/mail');
const path = require('path');
const { db } = require('../js/mysql-config');

// Configuration from environment variables
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || '';
const EMAIL_FROM = process.env.EMAIL_FROM || 'noreply@bikewerk.ru';
const EMAIL_FROM_NAME = process.env.EMAIL_FROM_NAME || 'BikeWerk';
const EMAIL_REPLY_TO = process.env.EMAIL_REPLY_TO || 'support@bikewerk.ru';

if (!SENDGRID_API_KEY) {
  console.warn('⚠️  SENDGRID_API_KEY is not set. Email sending will be disabled.');
} else {
  sgMail.setApiKey(SENDGRID_API_KEY);
}

class EmailService {
  /**
   * Base send function with logging and error handling
   * @param {Object} params
   */
  async sendEmail(params) {
    if (!SENDGRID_API_KEY) {
      console.warn('📭 Skipping email send: SENDGRID_API_KEY is not configured', {
        to: params.to,
        subject: params.subject,
      });
      return { success: false, error: 'Email service not configured' };
    }

    const msg = {
      from: {
        email: EMAIL_FROM,
        name: EMAIL_FROM_NAME,
      },
      replyTo: EMAIL_REPLY_TO,
      ...params,
    };

    try {
      await sgMail.send(msg);

      // Log to system_logs for analytics
      try {
        await db.query(
          'INSERT INTO system_logs (level, source, message) VALUES (?, ?, ?)',
          [
            'info',
            'EmailService',
            JSON.stringify({
              type: params.trackingType || 'generic_email',
              to: params.to,
              subject: params.subject,
              created_at: new Date().toISOString(),
            }),
          ],
        );
      } catch (e) {
        console.warn('EmailService: failed to log email send', e.message);
      }

      return { success: true };
    } catch (error) {
      const detail =
        error?.response?.body?.errors?.map((e) => e.message).join('; ') ||
        error?.message ||
        'Unknown SendGrid error';

      console.error('❌ SendGrid error:', detail);

      try {
        await db.query(
          'INSERT INTO system_logs (level, source, message) VALUES (?, ?, ?)',
          [
            'error',
            'EmailService',
            JSON.stringify({
              type: 'send_error',
              to: params.to,
              subject: params.subject,
              error: detail,
              created_at: new Date().toISOString(),
            }),
          ],
        );
      } catch { }

      return { success: false, error: detail };
    }
  }

  /**
   * Send verification code email
   * @param {string} email
   * @param {string} code
   */
  async sendVerificationCode(email, code) {
    // Put code in subject for instant visibility in inbox
    const subject = `${code} — Ваш код подтверждения BikeWerk`;

    const text = [
      `Код подтверждения: ${code}`,
      '',
      'Введите этот код на сайте bikewerk.ru для завершения регистрации.',
      'Код действителен 10 минут.',
      '',
      'Если вы не запрашивали этот код, просто проигнорируйте письмо.',
      '',
      '—',
      'BikeWerk',
      'bikewerk.ru',
    ].join('\n');

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; background:#f8f9fa; padding:40px 20px;">
        <div style="max-width:560px; margin:0 auto; background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          
          <!-- Header -->
          <div style="background:#18181b; padding:32px 24px; text-align:center;">
            <div style="font-size:24px; font-weight:700; color:#ffffff; letter-spacing:-0.02em;">BikeWerk</div>
            <div style="margin-top:8px; font-size:14px; color:#a1a1aa;">Премиум велосипеды из Европы</div>
          </div>

          <!-- Code Display -->
          <div style="padding:40px 24px 32px; text-align:center;">
            <div style="font-size:15px; color:#52525b; margin-bottom:24px; line-height:1.6;">
              Ваш код подтверждения для входа в BikeWerk:
            </div>
            
            <div style="background:#f4f4f5; border:2px solid #e4e4e7; border-radius:12px; padding:20px; margin:0 auto 24px; max-width:280px;">
              <div style="font-size:36px; font-weight:700; letter-spacing:0.3em; color:#18181b; font-family: 'Courier New', monospace;">
                ${code}
              </div>
            </div>

            <div style="font-size:13px; color:#71717a; margin-bottom:28px;">
              <div style="margin-bottom:6px;">⏱ Действителен <strong style="color:#18181b;">10 минут</strong></div>
              <div>Если не запрашивали — проигнорируйте письмо</div>
            </div>

            <a href="https://bikewerk.ru" 
               style="display:inline-block; background:#18181b; color:#ffffff; text-decoration:none; padding:14px 32px; border-radius:8px; font-weight:600; font-size:15px;">
              Перейти на сайт
            </a>
          </div>

          <!-- Footer -->
          <div style="border-top:1px solid #e4e4e7; padding:24px; text-align:center; background:#fafafa;">
            <div style="font-size:13px; color:#71717a; line-height:1.6;">
              <div style="margin-bottom:8px;">
                <strong style="color:#18181b;">BikeWerk</strong> — проверенные б/у велосипеды из Германии
              </div>
              <div>
                <a href="mailto:support@bikewerk.ru" style="color:#18181b; text-decoration:none;">support@bikewerk.ru</a>
                <span style="color:#d4d4d8; margin:0 8px;">•</span>
                <a href="https://bikewerk.ru" style="color:#18181b; text-decoration:none;">bikewerk.ru</a>
              </div>
            </div>
          </div>

        </div>
      </div>
    `;

    return this.sendEmail({
      to: email,
      subject,
      text,
      html,
      trackingType: 'verification_code',
    });
  }

  /**
   * Welcome email after successful registration
   * @param {string} email
   * @param {string} [name]
   */
  async sendWelcomeEmail(email, name) {
    const subject = 'Добро пожаловать в BikeWerk';
    const safeName = name || 'друг';

    const text = [
      `Привет, ${safeName}!`,
      '',
      'Спасибо, что зарегистрировались в BikeWerk.',
      'У нас только проверенные б/у велосипеды из Европы — MTB, Road, Gravel.',
      '',
      'Вы можете добавлять велосипеды в избранное, формировать корзину и отслеживать заказы в личном кабинете.',
      '',
      'Перейти в каталог: https://bikewerk.ru/catalog',
      '',
      'Команда BikeWerk',
      'bikewerk.ru',
    ].join('\n');

    const html = `
      <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background:#0b1220; color:#e5e7eb; padding:24px;">
        <div style="max-width:520px;margin:0 auto;background:#020617;border-radius:16px;padding:24px 24px 20px;border:1px solid #1f2937;">
          <div style="text-align:center;margin-bottom:20px;">
            <div style="font-size:22px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#38bdf8;">BikeWerk</div>
          </div>
          <div style="font-size:15px;line-height:1.7;color:#e5e7eb;">
            <p style="margin:0 0 12px;">Привет, ${safeName}!</p>
            <p style="margin:0 0 12px;">Спасибо, что зарегистрировались в <strong>BikeWerk</strong>. Здесь мы собираем проверенные б/у велосипеды из Европы — MTB, Road, Gravel.</p>
            <p style="margin:0 0 16px;">Вы можете добавлять велосипеды в избранное, формировать корзину и отслеживать заказы прямо из личного кабинета.</p>
          </div>
          <div style="text-align:center;margin:20px 0 8px;">
            <a href="https://bikewerk.ru/catalog" style="display:inline-block;padding:10px 22px;border-radius:999px;background:linear-gradient(135deg,#38bdf8,#22c55e);color:#020617;font-weight:600;text-decoration:none;font-size:14px;">Перейти в каталог</a>
          </div>
          <div style="border-top:1px solid #1f2937;padding-top:12px;margin-top:8px;font-size:11px;color:#6b7280;text-align:left;">
            <p style="margin:0 0 4px;">Команда BikeWerk</p>
            <p style="margin:0;">Поддержка: <a href="mailto:support@bikewerk.ru" style="color:#38bdf8;text-decoration:none;">support@bikewerk.ru</a></p>
          </div>
        </div>
      </div>
    `;

    return this.sendEmail({
      to: email,
      subject,
      text,
      html,
      trackingType: 'welcome_email',
    });
  }

  /**
   * Placeholder for future password reset emails
   * @param {string} email
   * @param {string} resetLink
   */
  async sendPasswordReset(email, resetLink) {
    const subject = 'Сброс пароля в BikeWerk';
    const html = `
      <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background:#0b1220; color:#e5e7eb; padding:24px;">
        <div style="max-width:520px;margin:0 auto;background:#020617;border-radius:16px;padding:24px 24px 20px;border:1px solid #1f2937;">
          <div style="text-align:center;margin-bottom:20px;">
            <div style="font-size:22px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#38bdf8;">BikeWerk</div>
          </div>
          <div style="font-size:15px;line-height:1.7;color:#e5e7eb;">
            <p style="margin:0 0 12px;">Вы запросили сброс пароля.</p>
            <p style="margin:0 0 16px;">Перейдите по ссылке ниже, чтобы задать новый пароль:</p>
          </div>
          <div style="text-align:center;margin:20px 0 8px;">
            <a href="${resetLink}" style="display:inline-block;padding:10px 22px;border-radius:999px;background:linear-gradient(135deg,#38bdf8,#22c55e);color:#020617;font-weight:600;text-decoration:none;font-size:14px;">Сбросить пароль</a>
          </div>
          <div style="font-size:12px;color:#9ca3af;margin-bottom:12px;">
            Если вы не запрашивали сброс пароля, просто проигнорируйте это письмо.
          </div>
          <div style="border-top:1px solid #1f2937;padding-top:12px;margin-top:8px;font-size:11px;color:#6b7280;text-align:left;">
            <p style="margin:0 0 4px;">Команда BikeWerk</p>
          </div>
        </div>
      </div>
    `;

    return this.sendEmail({
      to: email,
      subject,
      html,
      trackingType: 'password_reset',
    });
  }
}

module.exports = new EmailService();

