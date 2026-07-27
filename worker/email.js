/**
 * The only place that sends mail. Three branches, in this order:
 *
 *   1. tests           — record, so a test can read the verification link
 *   2. RESEND_API_KEY  — send for real, over plain REST
 *   3. neither         — log, so a fresh clone still boots and still shows
 *                        the link in `wrangler tail`
 *
 * Branch 3 is deliberate. Requiring a Resend account before the project runs
 * locally would be a worse first hour than a link in the log.
 *
 * No SDK: this is one POST, and better-auth stays the only runtime dependency.
 *
 * Nothing here throws. Better Auth creates the user row before calling the
 * send hook, so throwing would leave an account that exists, cannot be
 * verified, and blocks signing up again with the same address. Failures are
 * loud in the log and recoverable through the resend button instead.
 */
export async function sendEmail(env, { to, subject, text }) {
  if (env.SENT_MAIL) {
    env.SENT_MAIL.push({ to, subject, text });
    return { ok: true };
  }

  if (!env.RESEND_API_KEY) {
    // Labelled unsent so it can never be mistaken for a working provider.
    console.log(`[email:unsent] to=${to} subject=${subject}\n${text}`);
    return { ok: false, reason: 'no-provider' };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.RESEND_API_KEY}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        // resend.dev only reaches your own account address. Real recipients
        // need EMAIL_FROM on a domain you have verified with Resend.
        from: env.EMAIL_FROM || 'onboarding@resend.dev',
        to: [to],
        subject,
        text
      })
    });

    if (!res.ok) {
      // The body carries Resend's reason, which is usually an unverified
      // sending domain — the single most likely misconfiguration here.
      console.error(`[email:FAILED] ${res.status} to=${to} ${await res.text()}`);
      return { ok: false, reason: `http-${res.status}` };
    }

    return { ok: true };
  } catch (e) {
    console.error(`[email:FAILED] to=${to} ${e.message}`);
    return { ok: false, reason: 'network' };
  }
}
