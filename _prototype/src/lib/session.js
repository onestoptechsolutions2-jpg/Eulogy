import { getIronSession } from "iron-session";

// A single encrypted cookie holds the entire admin session — no session
// table, no store to keep in sync across serverless invocations. The
// cookie is sealed with SESSION_SECRET; tampering or a wrong secret makes
// it unreadable, which just means "not logged in".

const COOKIE_NAME = "memorial_admin";

export function sessionOptions() {
  const password = process.env.SESSION_SECRET;
  if (!password || password.length < 32) {
    throw new Error(
      "SESSION_SECRET must be set and at least 32 characters. Generate one with:\n" +
      '  node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }
  return {
    password,
    cookieName: COOKIE_NAME,
    cookieOptions: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    },
  };
}

export function getSession(req, res) {
  return getIronSession(req, res, sessionOptions());
}
