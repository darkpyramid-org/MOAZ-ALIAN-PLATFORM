import { env } from '../config/env.js';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

/**
 * Resend-backed mail adapter. The caller owns token generation and persistence;
 * this adapter receives the bearer token only to deliver it out of band.
 */
export async function sendPasswordResetEmail(email: string, token: string): Promise<void> {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) {
    throw new Error('Password reset email is not configured (RESEND_API_KEY and EMAIL_FROM are required).');
  }

  const resetUrl = new URL('/reset-password', env.FRONTEND_URL);
  resetUrl.searchParams.set('token', token);

  const response = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: [email],
      subject: 'Reset your MOAZ ALIAN password',
      html: `<p>We received a request to reset your MOAZ ALIAN password.</p><p><a href="${resetUrl.toString()}">Reset password</a></p><p>This link expires in 60 minutes. If you did not request this, you can ignore this email.</p>`,
      text: `Reset your MOAZ ALIAN password: ${resetUrl.toString()}\nThis link expires in 60 minutes. If you did not request this, you can ignore this email.`,
    }),
    signal: AbortSignal.timeout(5_000),
  });

  if (!response.ok) {
    // Never include the request body or reset URL in an error message.
    throw new Error(`Resend rejected the password reset email (HTTP ${response.status}).`);
  }
}
