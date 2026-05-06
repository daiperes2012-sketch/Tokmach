import { useState, useEffect, createContext, useContext } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  User
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../services/firebase';
import { UserProfile } from '../types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
  deleteAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          if (userDoc.exists()) {
            setProfile(userDoc.data() as UserProfile);
          } else {
            // Initialize profile
            const newProfile: UserProfile = {
              uid: currentUser.uid,
              displayName: currentUser.displayName || 'Usuário',
              email: currentUser.email || '',
              photoURL: currentUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser.uid}`,
              bio: '',
              blockedUsers: [],
              followersCount: 0,
              followingCount: 0,
              balance: 100, // Initial free credits
              fetishes: [],
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            };
            await setDoc(doc(db, 'users', currentUser.uid), newProfile);
            setProfile(newProfile);
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `users/${currentUser.uid}`);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const logout = async () => {
    await signOut(auth);
  };

  const updateProfile = async (data: Partial<UserProfile>) => {
    if (!user) return;
    const path = `users/${user.uid}`;
    try {
      const profileDoc = doc(db, 'users', user.uid);
      const updatedData = { ...data, updatedAt: serverTimestamp() };
      await setDoc(profileDoc, updatedData, { merge: true });
      setProfile(prev => prev ? { ...prev, ...updatedData } : null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const deleteAccount = async () => {
    if (!user) return;
    const path = `users/${user.uid}`;
    try {
      // In a real app we'd trigger a cloud function to clean up or use server-side deletion
      // For this applet, we'll just delete the user document and sign out
      await setDoc(doc(db, 'users', user.uid), { ...profile, deleted: true, updatedAt: serverTimestamp() });
      await user.delete();
      await logout();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, login, logout, updateProfile, deleteAccount }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
