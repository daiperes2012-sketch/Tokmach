import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, doc, getDocFromServer } from 'firebase/firestore';
import { getMessaging } from 'firebase/messaging';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const messaging = typeof window !== 'undefined' ? getMessaging(app) : null;

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

let isQuotaExceededCached = false;

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  // Use a string representation of the error to avoid circular structure issues
  const errorMessage = error instanceof Error ? error.message : 
                       (typeof error === 'object' && error !== null) ? 
                       (error as any).message || String(error) : 
                       String(error);
                       
  const isQuotaRelated = errorMessage.includes('Quota exceeded') || errorMessage.includes('quota metric');

  // Sanitize path to ensure it's a string
  const safePath = typeof path === 'string' ? path : String(path);

  const errInfo: FirestoreErrorInfo = {
    error: errorMessage,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path: safePath
  };

  if (isQuotaRelated || isQuotaExceededCached) {
    if (!isQuotaExceededCached) {
      isQuotaExceededCached = true;
      console.warn('Firestore Quota Exceeded Detected');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('firestore-quota-exceeded'));
      }
    }
    return;
  }

  // Safe stringify helper to prevent circular structure crashes
  const safeStringify = (obj: any) => {
    try {
      return JSON.stringify(obj);
    } catch (e) {
      console.warn('Circular structure detected in error info, using fallback serialization');
      return String(obj);
    }
  };

  const serializedErrorInfo = safeStringify(errInfo);
  console.error('Firestore Error: ', serializedErrorInfo);
  throw new Error(serializedErrorInfo);
}

// Connectivity Test
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration or internet connection.");
    }
  }
}
testConnection();
