import { ForbiddenError } from "../../shared/_core/errors.js";
import type { Request } from "express";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { ENV } from "./env";

type SupabaseIdentity = {
  provider?: string;
};

type SupportedLoginMethod = "google" | "email";

type VerifiedSupabaseUser = Required<Pick<SupabaseUserResponse, "id" | "email" | "email_confirmed_at">> & SupabaseUserResponse;

type SupabaseUserResponse = {
  id?: string;
  email?: string;
  email_confirmed_at?: string | null;
  app_metadata?: {
    provider?: string;
    providers?: string[];
  };
  user_metadata?: {
    full_name?: string;
    name?: string;
  };
  identities?: SupabaseIdentity[] | null;
};

function getBearerToken(req: Request): string | null {
  const header = req.headers.authorization ?? req.headers.Authorization;
  if (typeof header !== "string" || !header.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  return token || null;
}

function getSupportedLoginMethod(user: SupabaseUserResponse): SupportedLoginMethod | null {
  const providers = user.app_metadata?.providers ?? [];
  const hasProvider = (provider: SupportedLoginMethod) =>
    user.app_metadata?.provider === provider || providers.includes(provider) || user.identities?.some((identity) => identity.provider === provider) === true;

  if (hasProvider("google")) return "google";
  if (hasProvider("email")) return "email";
  return null;
}

function validateSupabaseUser(user: SupabaseUserResponse): { loginMethod: SupportedLoginMethod; user: VerifiedSupabaseUser } {
  if (!user.id || !user.email || !user.email_confirmed_at) {
    throw ForbiddenError("Account email is not verified");
  }
  const loginMethod = getSupportedLoginMethod(user);
  if (!loginMethod) {
    throw ForbiddenError("Only Google or email sign-in is available");
  }
  return { loginMethod, user: user as VerifiedSupabaseUser };
}

class SDKServer {
  private async getSupabaseUser(accessToken: string): Promise<SupabaseUserResponse> {
    if (!ENV.supabaseUrl || !ENV.supabaseAnonKey) {
      throw ForbiddenError("MADD authentication is not configured");
    }

    const response = await fetch(`${ENV.supabaseUrl.replace(/\/$/, "")}/auth/v1/user`, {
      headers: {
        apikey: ENV.supabaseAnonKey,
        Authorization: `Bearer ${accessToken}`,
      },
    });
    if (!response.ok) throw ForbiddenError("Invalid Supabase session");
    return (await response.json()) as SupabaseUserResponse;
  }

  async authenticateRequest(req: Request): Promise<AuthenticatedUser> {
    const accessToken = getBearerToken(req);
    if (!accessToken) throw ForbiddenError("MADD session required");

    const identity = await this.getSupabaseUser(accessToken);
    const { loginMethod, user: verifiedIdentity } = validateSupabaseUser(identity);

    const signedInAt = new Date();
    const email = verifiedIdentity.email.trim().toLowerCase();
    const name = verifiedIdentity.user_metadata?.full_name ?? verifiedIdentity.user_metadata?.name ?? null;
    let user = await db.getUserByOpenId(verifiedIdentity.id);

    // لا ندمج حسابين اعتباطاً: هذا الربط مسموح فقط ببريد Supabase مؤكد ومعرّف
    // لم يسبق استخدامه محلياً، لذلك يحتفظ المستخدم القديم بكل بياناته.
    if (!user) {
      const existingByEmail = await db.getUserByNormalizedEmail(email);
      if (existingByEmail) {
        user = await db.linkUserToSupabaseIdentity({
          userId: existingByEmail.id,
          openId: verifiedIdentity.id,
          name,
          email,
          lastSignedIn: signedInAt,
        });
      } else {
        await db.upsertUser({
          openId: verifiedIdentity.id,
          name,
          email,
          loginMethod,
          lastSignedIn: signedInAt,
        });
        user = await db.getUserByOpenId(verifiedIdentity.id);
      }
    } else {
      await db.upsertUser({
        openId: user.openId,
        name,
        email,
        loginMethod,
        lastSignedIn: signedInAt,
      });
      user = await db.getUserByOpenId(verifiedIdentity.id);
    }

    if (!user) throw ForbiddenError("Unable to synchronize MADD account");
    return user;
  }
}

export type AuthenticatedUser = User;

export const sdk = new SDKServer();
