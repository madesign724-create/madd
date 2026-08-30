import type { Express, Request, Response } from "express";
import { sdk } from "./sdk";

function buildUserResponse(user: Awaited<ReturnType<typeof sdk.authenticateRequest>>) {
  return {
    id: user.id,
    openId: user.openId,
    name: user.name,
    email: user.email,
    loginMethod: user.loginMethod,
    lastSignedIn: user.lastSignedIn.toISOString(),
  };
}

/**
 * Google OAuth يتم داخل Supabase ومن ثم يصل رمز Bearer إلى هذه المسارات.
 * لا ننشئ أو نحفظ جلسات بوابة خارجية هنا.
 */
export function registerOAuthRoutes(app: Express) {
  app.get("/api/auth/me", async (req: Request, res: Response) => {
    try {
      const user = await sdk.authenticateRequest(req);
      res.json({ user: buildUserResponse(user) });
    } catch {
      res.status(401).json({ error: "Not authenticated", user: null });
    }
  });

  app.post("/api/auth/logout", (_req: Request, res: Response) => {
    // رمز Supabase يُمسح من العميل، ولا توجد cookie مملوكة لـMADD كي نمسحها هنا.
    res.json({ success: true });
  });

  app.all("/api/oauth/callback", (_req: Request, res: Response) => {
    res.status(410).json({ error: "OAuth callback moved to /auth/callback" });
  });

  app.all("/api/oauth/mobile", (_req: Request, res: Response) => {
    res.status(410).json({ error: "Use Supabase Google sign-in" });
  });
}
