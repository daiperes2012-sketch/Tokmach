import { useState, useEffect, useRef } from 'react';
import { collection, query, orderBy, limit, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../services/firebase';
import { useAuth } from '../../hooks/useAuth';
import { VideoPost } from '../../types';
import VideoCard from './VideoCard';
import { motion } from 'motion/react';
import { Loader2 } from 'lucide-react';

export default function Feed() {
  const { user } = useAuth();
  const [videos, setVideos] = useState<VideoPost[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query(collection(db, 'videos'), orderBy('createdAt', 'desc'), limit(10));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allVideoData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as VideoPost[];
      // Filter out known broken URLs and blob URLs from the local state
      const validVideos = allVideoData.filter(v => 
        v.videoUrl && 
        !v.videoUrl.startsWith('blob:') &&
        !v.videoUrl.includes('gtv-videos-bucket') &&
        !v.videoUrl.includes('archive.org')
      );
      
      setVideos(validVideos);
      setLoading(false);
      
      // Seed if we have very few VALID videos and user is logged in
      if (validVideos.length < 3 && user) {
        seedVideos(user.uid, validVideos.map(v => v.videoUrl));
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'videos');
    });

    return () => unsubscribe();
  }, [user]);

  const seedVideos = async (userId: string, existingUrls: string[]) => {
    const path = 'videos';
    const demoVideos = [
      {
        creatorId: userId,
        videoUrl: 'https://vjs.zencdn.net/v/oceans.mp4',
        thumbnailUrl: 'https://images.pexels.com/photos/33129/popcorn-movie-party-entertainment.jpg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
        description: 'Vibe refrescante dos oceanos... ✨ #nature #calm',
        likesCount: 1240,
        commentsCount: 88,
        createdAt: serverTimestamp(),
      },
      {
        creatorId: userId,
        videoUrl: 'https://www.w3schools.com/html/movie.mp4',
        thumbnailUrl: 'https://images.pexels.com/photos/1122462/pexels-photo-1122462.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
        description: 'Um urso explorando a floresta. 🐻 #wildlife #nature',
        likesCount: 850,
        commentsCount: 45,
        createdAt: serverTimestamp(),
      },
      {
        creatorId: userId,
        videoUrl: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
        thumbnailUrl: 'https://images.pexels.com/photos/33129/popcorn-movie-party-entertainment.jpg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
        description: 'A beleza nos detalhes. 🔥 #macro #art',
        likesCount: 2100,
        commentsCount: 120,
        createdAt: serverTimestamp(),
      },
      {
        creatorId: userId,
        videoUrl: 'https://media.w3.org/2010/05/sintel/trailer.mp4',
        thumbnailUrl: 'https://images.pexels.com/photos/1122462/pexels-photo-1122462.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
        description: 'Sintel - A busca pela verdade. 🫦 #sintel #animation',
        likesCount: 1560,
        commentsCount: 77,
        createdAt: serverTimestamp(),
      },
      {
        creatorId: userId,
        videoUrl: 'https://www.w3schools.com/html/mov_bbb.mp4',
        thumbnailUrl: 'https://images.pexels.com/photos/33129/popcorn-movie-party-entertainment.jpg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
        description: 'Big Buck Bunny retorna! 🐰 #classic #funny',
        likesCount: 990,
        commentsCount: 32,
        createdAt: serverTimestamp(),
      }
    ];

    for (const video of demoVideos) {
      // Avoid duplicates
      if (existingUrls.includes(video.videoUrl)) continue;
      
      try {
        await addDoc(collection(db, path), video);
      } catch (e) {
        handleFirestoreError(e, OperationType.WRITE, path);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="animate-spin text-pink-500" size={32} />
      </div>
    );
  }

  return (
    <div 
      className="h-full overflow-y-scroll snap-y snap-mandatory no-scrollbar"
      ref={scrollRef}
    >
      {videos.map((video) => (
        <VideoCard key={video.id} video={video} />
      ))}
    </div>
  );
}
