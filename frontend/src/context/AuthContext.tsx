import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient, setAuthToken } from "../utils/client";

export type UserRole =
  | "SuperAdmin"
  | "Procurement"
  | "ProcurementOfficer"
  | "HeadOfDepartment"
  | "Requester"
  | "Finance"  // Deprecated
  | "Supplier";

export interface AuthUser {
  id: number;
  email: string;
  full_name: string;
  role: UserRole;
  timezone?: string;
  department_name?: string;  // For HeadOfDepartment role
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
  updateProfile: (updates: { full_name?: string; timezone?: string }) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setTokenState] = useState<string | null>(() => localStorage.getItem("procurahub.token"));
  const [isLoading, setIsLoading] = useState<boolean>(!!localStorage.getItem("procurahub.token"));
  const navigate = useNavigate();

  useEffect(() => {
    if (token) {
      setAuthToken(token);
      // Attempt to restore user session
      apiClient
        .get<AuthUser>("/api/auth/me")
        .then((response) => setUser(response.data))
        .catch(() => {
          // Don't navigate here, just clear state
          localStorage.removeItem("procurahub.token");
          setTokenState(null);
          setAuthToken(null);
          setUser(null);
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const login = useCallback(async (email: string, password: string) => {
    console.log("Login attempt:", email);
    const form = new URLSearchParams();
    form.append("username", email);
    form.append("password", password);

    console.log("Sending login request to /api/auth/token");
    const { data } = await apiClient.post<{ access_token: string }>("/api/auth/token", form, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" }
    });

    console.log("Login successful, received token");
    localStorage.setItem("procurahub.token", data.access_token);
    setTokenState(data.access_token);
    setAuthToken(data.access_token);

    console.log("Fetching user profile");
    const profileResponse = await apiClient.get<AuthUser>("/api/auth/me");
    console.log("Profile received:", profileResponse.data);
    setUser(profileResponse.data);
    navigate("/");
  }, [navigate]);

  const logout = useCallback(() => {
    localStorage.removeItem("procurahub.token");
    setTokenState(null);
    setAuthToken(null);
    setUser(null);
    navigate("/login");
  }, [navigate]);

  const refreshProfile = useCallback(async () => {
    if (!token) return;
    const { data } = await apiClient.get<AuthUser>("/api/auth/me");
    setUser(data);
  }, [token]);

  const updateProfile = useCallback(async (updates: { full_name?: string; timezone?: string }) => {
    if (!token) return;
    await apiClient.put("/api/auth/me", updates);
    await refreshProfile();
  }, [token, refreshProfile]);

  const value = useMemo(
    () => ({
      user,
      token,
      isLoading,
      login,
      logout,
      refreshProfile,
      updateProfile
    }),
    [user, token, isLoading, login, logout, refreshProfile, updateProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

