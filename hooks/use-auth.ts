import * as Api from "@/lib/_core/api";
import * as Auth from "@/lib/_core/auth";
import { supabase } from "@/lib/supabase";
import { useCallback, useEffect, useMemo, useState } from "react";

type UseAuthOptions = {
  autoFetch?: boolean;
};

export function useAuth(options?: UseAuthOptions) {
  const { autoFetch = true } = options ?? {};
  const [user, setUser] = useState<Auth.User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const clearLocalIdentity = useCallback(async () => {
    await Auth.removeSessionToken();
    await Auth.clearUserInfo();
    setUser(null);
  }, []);

  const fetchUser = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        await clearLocalIdentity();
        return;
      }

      await Auth.setSessionToken(data.session.access_token);
      const apiUser = await Api.getMe();
      if (!apiUser) {
        await clearLocalIdentity();
        return;
      }

      const userInfo: Auth.User = {
        id: apiUser.id,
        openId: apiUser.openId,
        name: apiUser.name,
        email: apiUser.email,
        loginMethod: apiUser.loginMethod,
        lastSignedIn: new Date(apiUser.lastSignedIn),
      };
      await Auth.setUserInfo(userInfo);
      setUser(userInfo);
    } catch (reason) {
      const nextError = reason instanceof Error ? reason : new Error("تعذر استعادة جلسة MADD");
      setError(nextError);
      await clearLocalIdentity();
    } finally {
      setLoading(false);
    }
  }, [clearLocalIdentity]);

  const logout = useCallback(async () => {
    try {
      await Api.logout();
    } catch {
      // الخادم لا يحتفظ بجلسة MADD؛ نستمر في إغلاق جلسة Supabase محلياً.
    } finally {
      await supabase.auth.signOut({ scope: "local" });
      await clearLocalIdentity();
      setError(null);
      setLoading(false);
    }
  }, [clearLocalIdentity]);

  const isAuthenticated = useMemo(() => Boolean(user), [user]);

  useEffect(() => {
    if (!autoFetch) {
      setLoading(false);
      return;
    }
    void fetchUser();
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        void clearLocalIdentity();
        return;
      }
      void Auth.setSessionToken(session.access_token).then(() => fetchUser());
    });
    return () => subscription.subscription.unsubscribe();
  }, [autoFetch, clearLocalIdentity, fetchUser]);

  return { user, loading, error, isAuthenticated, refresh: fetchUser, logout };
}
