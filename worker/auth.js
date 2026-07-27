/**
 * Session resolution. The only place that decides who is asking.
 *
 * This is the third implementation behind the same signature — a seeded row,
 * then a hand-rolled session cookie, now Better Auth — and no route above it
 * has changed for any of them. The next tempting change will also want to
 * reach past this seam; it should not.
 */
import { betterAuth } from 'better-auth';
import { sendEmail } from './email.js';

/** Both halves, or neither. A half-configured provider advertises a route that
 *  fails at the redirect, which is worse than not offering it. */
export function githubConfigured(env) {
  return Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET);
}

export function createAuth(env) {
  // Built per request. env exists only inside fetch, and one isolate serving
  // two environments from a cached instance is a staging-deploy bug.
  return betterAuth({
    database: env.DB,
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.APP_URL,
    trustedOrigins: [env.APP_URL],

    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true
    },

    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
        await sendEmail(env, {
          to: user.email,
          subject: 'Verify your email',
          text: `Confirm your address to start tracking progress:\n\n${url}\n`
        });
      }
    },

    ...(githubConfigured(env)
      ? {
          socialProviders: {
            github: {
              clientId: env.GITHUB_CLIENT_ID,
              clientSecret: env.GITHUB_CLIENT_SECRET
            }
          },
          account: {
            accountLinking: {
              enabled: true,
              // GitHub verifies its addresses, so matching on email is safe.
              // Without this, a password signup followed by a GitHub sign-in
              // produces a second empty account and reads as lost data.
              trustedProviders: ['github']
            }
          }
        }
      : {})
  });
}

export async function getUser(request, env) {
  const res = await createAuth(env).api.getSession({ headers: request.headers });
  return res?.user ?? null;
}
