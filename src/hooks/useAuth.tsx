import { useState, useEffect, createContext, useContext } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  signInAnonymously,
  User
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  onSnapshot,
  serverTimestamp 
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../services/firebase';
import { UserProfile } from '../types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isQuotaExceeded: boolean;
  login: (method?: 'google' | 'anonymous') => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
  deleteAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(() => {
    const cached = localStorage.getItem('tokmatch_profile');
    return cached ? JSON.parse(cached) : null;
  });
  const [loading, setLoading] = useState(true);
  const [isQuotaExceeded, setIsQuotaExceeded] = useState(false);

  useEffect(() => {
    const handleQuotaExceeded = () => setIsQuotaExceeded(true);
    window.addEventListener('firestore-quota-exceeded', handleQuotaExceeded);
    
    let profileUnsubscribe: (() => void) | null = null;

    const authUnsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (profileUnsubscribe) {
        profileUnsubscribe();
        profileUnsubscribe = null;
      }

      if (currentUser) {
        let isInitializing = false;
        
        // Use a timeout to ensure loading state resolves even if snapshot is slow
        const loadingTimeout = setTimeout(() => {
          setLoading(false);
        }, 3000);

        // Real-time profile sync
        profileUnsubscribe = onSnapshot(doc(db, 'users', currentUser.uid), async (snapshot) => {
          clearTimeout(loadingTimeout);
          if (snapshot.exists()) {
            const profileData = snapshot.data() as UserProfile;
            setProfile(profileData);
            localStorage.setItem('tokmatch_profile', JSON.stringify(profileData));
            setLoading(false);
          } else if (!isInitializing) {
            isInitializing = true;
            // First time login - initialize
            try {
              const newProfile: UserProfile = {
                uid: currentUser.uid,
                displayName: currentUser.displayName || (currentUser.isAnonymous ? 'Convidado' : 'Usuário'),
                email: currentUser.email || '',
                photoURL: currentUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser.uid}`,
                bio: '',
                blockedUsers: [],
                followersCount: 0,
                followingCount: 0,
                balance: 100,
                fetishes: [],
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              };
              await setDoc(doc(db, 'users', currentUser.uid), newProfile);
            } catch (error) {
              handleFirestoreError(error, OperationType.CREATE, `users/${currentUser.uid}`);
              setLoading(false);
            }
          }
        }, (error) => {
          clearTimeout(loadingTimeout);
          handleFirestoreError(error, OperationType.GET, `users/${currentUser.uid}`);
          setLoading(false);
        });
      } else {
        setProfile(null);
        localStorage.removeItem('tokmatch_profile');
        setLoading(false);
      }
    });

    return () => {
      authUnsubscribe();
      if (profileUnsubscribe) profileUnsubscribe();
      window.removeEventListener('firestore-quota-exceeded', handleQuotaExceeded);
    };
  }, []);

  const login = async (method: 'google' | 'anonymous' = 'google') => {
    if (method === 'google') {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } else {
      await signInAnonymously(auth);
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  const updateProfile = async (data: Partial<UserProfile>) => {
    if (!user || isQuotaExceeded) return;
    const path = `users/${user.uid}`;
    try {
      const profileDoc = doc(db, 'users', user.uid);
      const updatedData = { ...data, updatedAt: serverTimestamp() };
      await setDoc(profileDoc, updatedData, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const deleteAccount = async () => {
    if (!user || isQuotaExceeded) return;
    const path = `users/${user.uid}`;
    try {
      await setDoc(doc(db, 'users', user.uid), { ...profile, deleted: true, updatedAt: serverTimestamp() });
      await user.delete();
      await logout();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, isQuotaExceeded, login, logout, updateProfile, deleteAccount }}>
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
