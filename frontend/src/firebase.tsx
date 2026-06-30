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
      const u: AuthUser = {
        uid: 'demo_user',
        email,
        displayName: email.split('@')[0].toUpperCase(),
        photoURL: `https://api.dicebear.com/7.x/bottts/svg?seed=demo_user`,
        token: 'mock-token-12345',
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
      const u: AuthUser = {
        uid: 'demo_user',
        email,
        displayName: name,
        photoURL: `https://api.dicebear.com/7.x/bottts/svg?seed=demo_user`,
        token: 'mock-token-12345',
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
      const u: AuthUser = {
        uid: 'demo_user',
        email: 'google.demo@focusflow.ai',
        displayName: 'Alex Carter',
        photoURL:
          'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=256&auto=format&fit=crop',
        token: 'mock-token-google',
      };
      localStorage.setItem('focusflow_user', JSON.stringify(u));
      setUser(u);
      return u;
    }
  };

  const logout = async (): Promise<void> => {
    if (!isMock && authInstance) {
      await signOut(authInstance);
    } else {
      localStorage.removeItem('focusflow_user');
    }
    setUser(null);
  };

  const resetPassword = async (email: string): Promise<void> => {
    if (!isMock && authInstance) {
      await sendPasswordResetEmail(authInstance, email);
    } else {
      console.log(`Mock reset password: ${email}`);
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
