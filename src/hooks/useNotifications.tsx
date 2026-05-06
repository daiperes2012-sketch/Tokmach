import { useEffect, useState } from 'react';
import { 
  collectionGroup, 
  query, 
  where, 
  onSnapshot, 
  Timestamp,
  orderBy,
  limit
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../services/firebase';
import { useAuth } from './useAuth';
import { ChatMessage } from '../types';

export function useNotifications() {
  const { user } = useAuth();
  const [permission, setPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result;
    }
    return 'denied';
  };

  useEffect(() => {
    if (!user) return;

    // We use collectionGroup to listen to messages in ANY chat subcollection
    // Note: This requires a Firestore Index for (senderId != user.uid, createdAt DESC)
    // For this applet, we'll simplify and just listen for messages created AFTER now.
    const q = query(
      collectionGroup(db, 'messages'),
      where('participants', 'array-contains', user.uid),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const msg = change.doc.data() as ChatMessage;
          
          // Only notify if someone else sent it
          if (msg.senderId !== user.uid) {
            showNotification('Nova Mensagem', msg.text);
          }
        }
      });
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'messages-group');
    });

    return () => unsubscribe();
  }, [user]);

  const showNotification = (title: string, body: string) => {
    if (permission === 'granted') {
      new Notification(title, {
        body,
        icon: '/favicon.ico', // or a custom icon
      });
    } else {
      // Fallback for in-app toast if site permission is denied
      console.log(`In-app Notification: ${title} - ${body}`);
    }
  };

  return { permission, requestPermission };
}
