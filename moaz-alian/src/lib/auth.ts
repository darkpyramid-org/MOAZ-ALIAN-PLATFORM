export type AppRole = "admin" | "editor";

export type AuthUser = {
  id: string;
  email: string;
  roles: AppRole[];
  isAdmin: boolean;
  canEditContent: boolean;
  displayName?: string | null;
  avatarUrl?: string | null;
};

export type AuthChangeEvent = "SIGNED_IN" | "SIGNED_OUT" | "USER_UPDATED";
export type AuthChangeListener = (event: AuthChangeEvent, user: AuthUser | null) => void;

const TOKEN_KEY = "moaz_auth_token";
const USER_KEY = "moaz_auth_user";

const isServer = typeof window === "undefined";
const RAW_BASE =
  (typeof process !== "undefined" ? process.env["API_URL"] : undefined) ??
  (isServer
    ? import.meta.env.DEV
      ? "http://localhost:5199"
      : "http://moaz-alian.runasp.net"
    : (import.meta.env["VITE_API_URL"] ??
      (import.meta.env.DEV ? "http://localhost:5199" : "/proxy-api")));
const BASE = RAW_BASE.replace(/\/+$/, "");

class AuthService {
  private listeners: Set<AuthChangeListener> = new Set();

  getAccessToken(): string | null {
    if (typeof window === "undefined") return null;
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  }

  getUser(): AuthUser | null {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? (JSON.parse(raw) as AuthUser) : null;
    } catch {
      return null;
    }
  }

  private setSession(token: string | null, user: AuthUser | null) {
    if (typeof window === "undefined") return;
    try {
      if (token) {
        localStorage.setItem(TOKEN_KEY, token);
      } else {
        localStorage.removeItem(TOKEN_KEY);
      }

      if (user) {
        localStorage.setItem(USER_KEY, JSON.stringify(user));
      } else {
        localStorage.removeItem(USER_KEY);
      }
    } catch {
      // Storage unavailable
    }
  }

  private notify(event: AuthChangeEvent, user: AuthUser | null) {
    this.listeners.forEach((listener) => {
      try {
        listener(event, user);
      } catch (err) {
        console.error("[Auth] Listener error:", err);
      }
    });
  }

  onAuthStateChange(listener: AuthChangeListener): {
    data: { subscription: { unsubscribe: () => void } };
  } {
    this.listeners.add(listener);
    return {
      data: {
        subscription: {
          unsubscribe: () => {
            this.listeners.delete(listener);
          },
        },
      },
    };
  }

  async login(email: string, password: string): Promise<{ user: AuthUser; token: string }> {
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
    });

    if (!res.ok) {
      let message = "فشل تسجيل الدخول. تحقق من البريد وكلمة المرور.";
      try {
        const error = await res.json();
        message = error.detail || error.title || message;
      } catch {
        // Fallback to status text
      }
      throw new Error(message);
    }

    const data = (await res.json()) as { token: string; user: AuthUser };
    this.setSession(data.token, data.user);
    this.notify("SIGNED_IN", data.user);
    return data;
  }

  async register(email: string, password: string): Promise<{ user: AuthUser; token: string }> {
    const res = await fetch(`${BASE}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
    });

    if (!res.ok) {
      let message = "فشل إنشاء الحساب.";
      try {
        const error = await res.json();
        message = error.detail || error.title || message;
      } catch {
        // Fallback
      }
      throw new Error(message);
    }

    const data = (await res.json()) as { token: string; user: AuthUser };
    this.setSession(data.token, data.user);
    this.notify("SIGNED_IN", data.user);
    return data;
  }

  async updateProfile(
    displayName?: string | null,
    avatarUrl?: string | null,
  ): Promise<AuthUser | null> {
    const token = this.getAccessToken();
    if (!token) return null;
    const res = await fetch(`${BASE}/api/auth/me`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ displayName, avatarUrl }),
    });
    if (!res.ok) return null;
    const user = (await res.json()) as AuthUser;
    this.setSession(token, user);
    this.notify("USER_UPDATED", user);
    return user;
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<boolean> {
    const token = this.getAccessToken();
    if (!token) return false;
    const res = await fetch(`${BASE}/api/auth/change-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    return res.ok;
  }

  /** URL to start an OAuth flow (Google/Facebook). Navigates the browser. */
  oauthUrl(provider: "google" | "facebook"): string {
    return `${BASE}/api/auth/oauth/${provider}`;
  }

  setAccessToken(token: string): void {
    if (typeof window !== "undefined") window.localStorage.setItem(TOKEN_KEY, token);
  }

  logout(): void {
    this.setSession(null, null);
    this.notify("SIGNED_OUT", null);
  }

  async getMe(): Promise<AuthUser | null> {
    const token = this.getAccessToken();
    if (!token) {
      this.setSession(null, null);
      return null;
    }

    try {
      const res = await fetch(`${BASE}/api/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });

      if (!res.ok) {
        if (res.status === 401) {
          this.logout();
        }
        return null;
      }

      const user = (await res.json()) as AuthUser;
      this.setSession(token, user);
      return user;
    } catch {
      return this.getUser();
    }
  }
}

export const authClient = new AuthService();
