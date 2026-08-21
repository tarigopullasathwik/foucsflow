/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signInWithPopup,
  signOut,
  sendPasswordResetEmail,
  type Auth,
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const hasFirebaseConfig =
  firebaseConfig.apiKey &&
  firebaseConfig.apiKey !== 'YOUR_FIREBASE_API_KEY' &&
  firebaseConfig.apiKey.trim() !== '';

// Backend API base for the real (server-verified) email/password auth flow.
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

let authInstance: Auth | null = null;
let googleProviderInstance: GoogleAuthProvider | null = null;

if (hasFirebaseConfig) {
  try {
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    authInstance = getAuth(app);
    googleProviderInstance = new GoogleAuthProvider();
    console.log('Firebase Client SDK initialized.');
  } catch (error) {
    console.error('Firebase SDK init failed:', error);
  }
}

export interface AuthUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  token?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  isMock: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (email: string, password: string, name: string) => Promise<AuthUser>;
  loginWithGoogle: () => Promise<AuthUser>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const isMock = !authInstance;

  useEffect(() => {
    if (!isMock && authInstance) {
      const unsubscribe = authInstance.onAuthStateChanged(async (firebaseUser) => {
        if (firebaseUser) {
          const token = await firebaseUser.getIdToken();
          setUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            displayName:
              firebaseUser.displayName ||
              firebaseUser.email?.split('@')[0] ||
              'User',
            photoURL:
              firebaseUser.photoURL ||
              `https://api.dicebear.com/7.x/bottts/svg?seed=${firebaseUser.uid}`,
            token,
          });
        } else {
          setUser(null);
        }
        setLoading(false);
      });
      return () => unsubscribe();
    } else {
      const storedUser = localStorage.getItem('focusflow_user');
      if (storedUser) {
        try {
          setUser(JSON.parse(storedUser));
        } catch {
          localStorage.removeItem('focusflow_user');
        }
      }
      setLoading(false);
    }
  }, [isMock]);

  const login = async (email: string, password: string): Promise<AuthUser> => {
    if (!isMock && authInstance) {
      const result = await signInWithEmailAndPassword(authInstance, email, password);
      const token = await result.user.getIdToken();
      const u: AuthUser = {
        uid: result.user.uid,
        email: result.user.email || '',
        displayName: result.user.displayName || email.split('@')[0],
        photoURL:
          result.user.photoURL ||
          `https://api.dicebear.com/7.x/bottts/svg?seed=${result.user.uid}`,
        token,
      };
      setUser(u);
      return u;
    } else {
      // ---- REAL backend auth (server-verified password, real token, emails) ----
      const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // Surface the backend's precise message (wrong password, locked, etc.).
        throw new Error(data.error || 'Invalid email or password.');
      }
      const u: AuthUser = {
        uid: data.user.id,
        email: data.user.email,
        displayName: data.user.name || email.split('@')[0],
        photoURL: data.user.picture || `https://api.dicebear.com/7.x/bottts/svg?seed=${data.user.id}`,
        token: data.token,
      };
      localStorage.setItem('focusflow_user', JSON.stringify(u));
      setUser(u);
      return u;
    }
  };

  const register = async (email: string, password: string, name: string): Promise<AuthUser> => {
    if (!isMock && authInstance) {
      const result = await createUserWithEmailAndPassword(authInstance, email, password);
      await updateProfile(result.user, { displayName: name });
      const token = await result.user.getIdToken();
      const u: AuthUser = {
        uid: result.user.uid,
        email: result.user.email || '',
        displayName: name,
        photoURL: `https://api.dicebear.com/7.x/bottts/svg?seed=${result.user.uid}`,
        token,
      };
      setUser(u);
      return u;
    } else {
      // ---- REAL backend registration (bcrypt + welcome email + notification) ----
      const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Registration failed.');
      }
      const u: AuthUser = {
        uid: data.user.id,
        email: data.user.email,
        displayName: data.user.name || name || email.split('@')[0],
        photoURL: data.user.picture || `https://api.dicebear.com/7.x/bottts/svg?seed=${data.user.id}`,
        token: data.token,
      };
      localStorage.setItem('focusflow_user', JSON.stringify(u));
      setUser(u);
      return u;
    }
  };

  const loginWithGoogle = async (): Promise<AuthUser> => {
    if (!isMock && authInstance && googleProviderInstance) {
      const result = await signInWithPopup(authInstance, googleProviderInstance);
      const token = await result.user.getIdToken();
      const u: AuthUser = {
        uid: result.user.uid,
        email: result.user.email || '',
        displayName: result.user.displayName || 'Google User',
        photoURL:
          result.user.photoURL ||
          `https://api.dicebear.com/7.x/bottts/svg?seed=${result.user.uid}`,
        token,
      };
      setUser(u);
      return u;
    } else {
      // No Firebase project configured: Google OAuth cannot run. Be honest
      // instead of fabricating a persona.
      throw new Error(
        'Google sign-in requires Firebase configuration. Please use email/password sign-up instead, or add Firebase keys in .env'
      );
    }
  };

  const logout = async (): Promise<void> => {
    const current = user;
    if (!isMock && authInstance) {
      await signOut(authInstance);
    } else if (current?.token) {
      // Invalidate the real server session token.
      try {
        await fetch(`${API_BASE_URL}/api/auth/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${current.token}` },
        });
      } catch {
        /* best-effort */
      }
    }
    localStorage.removeItem('focusflow_user');
    setUser(null);
  };

  const resetPassword = async (email: string): Promise<void> => {
    if (!isMock && authInstance) {
      await sendPasswordResetEmail(authInstance, email);
    } else {
      // Offline mode: there's no mailer-driven reset; tell the user the truth.
      throw new Error(
        'Password reset emails require Firebase configuration. For this demo you can re-register with the same email.'
      );
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isMock,
        login,
        register,
        loginWithGoogle,
        logout,
        resetPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
