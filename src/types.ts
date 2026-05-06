export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string;
  coverURL?: string;
  bio?: string;
  blockedUsers: string[];
  followersCount: number;
  followingCount: number;
  balance: number;
  fetishes: string[];
  ageVerified?: boolean;
  ageVerifiedAt?: any;
  createdAt: any;
  updatedAt: any;
}

export interface VideoPost {
  id: string;
  creatorId: string;
  videoUrl: string;
  thumbnailUrl: string;
  description: string;
  likesCount: number;
  commentsCount: number;
  type?: 'video' | 'photo';
  createdAt: any;
}

export interface VideoComment {
  id: string;
  videoId: string;
  userId: string;
  displayName: string;
  photoURL: string;
  text: string;
  createdAt: any;
}

export interface ChatMessage {
  id: string;
  chatId: string;
  senderId: string;
  text: string;
  type: 'text' | 'audio' | 'video' | 'image';
  callDuration?: number;
  createdAt: any;
}

export interface ChatThread {
  id: string;
  participants: string[];
  lastMessage: string;
  updatedAt: any;
}
