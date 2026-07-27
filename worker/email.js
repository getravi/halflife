/**
 * The only place that sends mail. Swapping in Cloudflare Email Service or
 * Resend later touches this file and nothing else.
 *
 * Cloudflare Email Service can reach arbitrary recipients, but only on the
 * Workers Paid plan and after onboarding a sending domain. Resend's free tier
 * can without a paid plan. That decision is deliberately deferred; until it is
 * made, this records rather than sends.
 */
export async function sendEmail(env, { to, subject, text }) {
  // env.SENT_MAIL is present in tests, so a test can read the verification
  // link Better Auth actually generated and complete a real verification.
  if (env.SENT_MAIL) {
    env.SENT_MAIL.push({ to, subject, text });
    return { ok: true };
  }

  // In production this logs and is visible in `wrangler tail`. Deliberately
  // labelled unsent, so it can never be mistaken for a working provider.
  console.log(`[email:unsent] to=${to} subject=${subject}\n${text}`);
  return { ok: true };
}
