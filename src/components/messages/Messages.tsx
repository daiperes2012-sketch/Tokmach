import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  updateDoc,
  serverTimestamp,
  doc,
  getDoc,
  limit
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../services/firebase';
import { ChatThread, ChatMessage, UserProfile } from '../../types';
import { 
  Search, 
  Plus, 
  ArrowLeft, 
  Send, 
  Phone, 
  Video, 
  Mic,
  Camera,
  X,
  MessageCircle,
  VideoOff,
  Gift,
  Languages,
  Loader2,
  MicOff,
  CheckCheck,
  Smile
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { translateText } from '../../services/translationService';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function ThreadItem({ thread, userId, onClick }: { thread: ChatThread, userId: string, onClick: () => void }) {
  const [partner, setPartner] = useState<UserProfile | null>(null);
  const partnerId = thread.participants.find(p => p !== userId);

  useEffect(() => {
    if (!partnerId) return;
    if (partnerId === 'system_bot') {
      setPartner({ 
        displayName: 'Suporte Vibe', 
        photoURL: 'https://api.dicebear.com/7.x/bottts/svg?seed=vibe',
        uid: 'system_bot'
      } as UserProfile);
      return;
    }
    const fetchPartner = async () => {
      try {
        const docRef = doc(db, 'users', partnerId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setPartner(docSnap.data() as UserProfile);
        }
      } catch (error) {
        console.error("Error fetching partner profile:", error);
      }
    };
    fetchPartner();
  }, [partnerId]);

  return (
    <motion.button 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onClick}
      className="w-full flex items-center gap-4 p-4 bg-zinc-900/40 hover:bg-zinc-900 rounded-[2rem] transition-all group active:scale-[0.98] text-left border border-white/5 hover:border-white/10"
    >
      <div className="relative">
        <div className="w-14 h-14 rounded-2xl bg-zinc-800 p-0.5 overflow-hidden border border-white/10 group-hover:border-pink-500/50 transition-colors">
          <img 
            src={partner?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${partnerId}`} 
            className="w-full h-full object-cover rounded-[1rem] group-hover:scale-110 transition-transform duration-500"
          />
        </div>
        {thread.updatedAt && (
           <div className="absolute -top-1 -right-1 w-5 h-5 bg-pink-500 border-2 border-black rounded-full flex items-center justify-center">
              <span className="text-[10px] font-black text-white">1</span>
           </div>
        )}
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-center mb-0.5">
          <h3 className="font-bold text-white truncate tracking-tight text-sm">
            {partner?.displayName || 'Usuário'}
          </h3>
          <span className="text-[10px] text-zinc-500 font-medium">
            {thread.updatedAt ? formatDistanceToNow(thread.updatedAt.toDate(), { addSuffix: false, locale: ptBR }) : ''}
          </span>
        </div>
        <p className="text-xs text-zinc-500 truncate group-hover:text-zinc-300 transition-colors font-medium">
          {thread.lastMessage}
        </p>
      </div>
    </motion.button>
  );
}

export default function Messages() {
  const { user } = useAuth();
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', user.uid),
      orderBy('updatedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setThreads(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ChatThread[]);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'chats');
    });

    return () => unsubscribe();
  }, [user]);

  const [recentUsers, setRecentUsers] = useState<UserProfile[]>([]);

  useEffect(() => {
    if (!user) return;
    // For demo/Vibe feel, fetch some other users to show in "Recentes"
    const q = query(collection(db, 'users'), limit(10));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const users = snapshot.docs
        .map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile))
        .filter(u => u.uid !== user.uid);
      setRecentUsers(users);
    });
    return () => unsubscribe();
  }, [user]);

  const filteredThreads = threads.filter(t => 
    t.lastMessage?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const startChatWithUser = async (partner: UserProfile) => {
    if (!user) return;
    
    // Check if thread already exists
    const existing = threads.find(t => t.participants.includes(partner.uid));
    if (existing) {
      setActiveChat(existing.id);
      return;
    }

    try {
      const newChat = await addDoc(collection(db, 'chats'), {
        participants: [user.uid, partner.uid],
        lastMessage: 'Diga oi! 👋',
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp()
      });
      setActiveChat(newChat.id);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'chats');
    }
  };

  const createNewChat = async () => {
    if (!user) return;
    const botId = 'system_bot';
    const existing = threads.find(t => t.participants.includes(botId));
    if (existing) {
      setActiveChat(existing.id);
      return;
    }
    
    try {
      const newChat = await addDoc(collection(db, 'chats'), {
        participants: [user.uid, botId],
        lastMessage: 'Olá! Bem-vindo ao Vibe Privada.',
        updatedAt: serverTimestamp()
      });
      setActiveChat(newChat.id);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'chats');
    }
  };

  if (activeChat) {
    return <ChatRoom chatId={activeChat} onBack={() => setActiveChat(null)} />;
  }

  return (
    <div className="h-full bg-black flex flex-col pt-safe">
      <div className="px-6 pt-8 pb-4">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-4xl font-black italic tracking-tighter uppercase">Chats</h1>
          <button 
            onClick={createNewChat}
            className="w-12 h-12 bg-zinc-900 rounded-2xl flex items-center justify-center hover:bg-white hover:text-black transition-all text-white border border-white/5 active:scale-95 group"
          >
            <Plus size={24} className="group-hover:rotate-90 transition-transform" />
          </button>
        </div>

        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={18} />
          <input 
            type="text" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Procurar conversas..."
            className="w-full bg-zinc-900/50 backdrop-blur-md border border-white/5 rounded-2xl py-4 pl-12 pr-6 text-sm focus:ring-1 focus:ring-pink-500/50 outline-none transition-all placeholder:text-zinc-700"
          />
        </div>

        {/* Stories/Matches Section */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-4 px-1">
            <h2 className="text-[11px] font-bold text-zinc-500 uppercase tracking-[0.2em]">Recentes</h2>
            <button className="text-[10px] font-bold text-pink-500 uppercase tracking-widest hover:opacity-70">Ver Tudo</button>
          </div>
          <div className="flex gap-4 overflow-x-auto no-scrollbar py-1">
            {recentUsers.length === 0 ? (
              [1, 2, 3, 4, 5].map(i => (
                <div key={i} className="w-16 h-16 rounded-[22px] bg-zinc-900 animate-pulse shrink-0" />
              ))
            ) : (
              recentUsers.map(profile => (
                <div 
                  key={profile.uid} 
                  onClick={() => startChatWithUser(profile)}
                  className="flex flex-col items-center gap-2 group cursor-pointer active:scale-95 transition-all shrink-0"
                >
                  <div className="w-16 h-16 rounded-[22px] p-0.5 bg-gradient-to-tr from-pink-600 via-purple-600 to-blue-600 group-hover:scale-105 transition-transform shadow-lg shadow-pink-500/10">
                    <div className="w-full h-full rounded-[19px] bg-black p-0.5">
                      <img 
                        src={profile.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.uid}`} 
                        className="w-full h-full rounded-[17px] bg-zinc-900 object-cover" 
                      />
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-zinc-500 truncate w-16 text-center">{profile.displayName}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 space-y-4 pb-24">
        {loading ? (
          <div className="space-y-4">
            {[1,2,3,4].map(i => (
              <div key={i} className="h-20 bg-zinc-900/40 animate-pulse rounded-[2rem]" />
            ))}
          </div>
        ) : filteredThreads.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-12 opacity-30 pt-20">
            <div className="p-8 rounded-full bg-zinc-900 mb-6">
              <MessageCircle size={48} strokeWidth={1.5} />
            </div>
            <p className="text-sm font-bold uppercase tracking-[0.2em]">Sem conversas</p>
          </div>
        ) : (
          filteredThreads.map(thread => (
            <ThreadItem 
              key={thread.id} 
              thread={thread} 
              userId={user?.uid || ''} 
              onClick={() => setActiveChat(thread.id)} 
            />
          ))
        )}
      </div>
    </div>
  );
}

function MessageItem({ msg, isMine }: { msg: ChatMessage, isMine: boolean }) {
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);

  const handleTranslate = async () => {
    if (translatedText) {
      setTranslatedText(null);
      return;
    }
    setIsTranslating(true);
    try {
      const result = await translateText(msg.text);
      setTranslatedText(result);
    } catch (e) {
      console.error(e);
    } finally {
      setIsTranslating(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: isMine ? 20 : -20, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      className={cn("flex flex-col max-w-[85%] group", isMine ? "self-end items-end" : "self-start items-start")}
    >
      <div className="relative">
        <div className={cn(
          "px-5 py-3.5 rounded-[2rem] text-[15px] leading-relaxed shadow-sm overflow-hidden",
          isMine 
            ? "bg-pink-600 text-white rounded-tr-none shadow-pink-900/10" 
            : "bg-zinc-900 text-zinc-100 rounded-tl-none border border-white/5"
        )}>
          {msg.type === 'image' ? (
            <img 
              src={msg.text} 
              alt="Shared" 
              className="max-w-full rounded-2xl mb-1 cursor-pointer hover:opacity-90 transition-opacity" 
              onClick={() => window.open(msg.text, '_blank')}
            />
          ) : (
            translatedText || msg.text
          )}
          {translatedText && (
            <div className="mt-2 pt-2 border-t border-white/10 text-[11px] text-white/60 italic">
              Traduzido: {msg.text}
            </div>
          )}
        </div>
        
        {msg.type !== 'image' && (
          <button 
            onClick={handleTranslate}
            className={cn(
              "absolute top-0 p-2.5 opacity-0 group-hover:opacity-100 transition-all bg-zinc-800/80 backdrop-blur-md rounded-full text-white border border-white/10 hover:bg-zinc-700 active:scale-90",
              isMine ? "-left-14" : "-right-14"
            )}
          >
            {isTranslating ? <Loader2 size={14} className="animate-spin text-pink-500" /> : <Languages size={14} />}
          </button>
        )}
      </div>
      <div className="flex items-center gap-1.5 mt-1.5 px-2">
        <span className="text-[10px] text-zinc-600 font-bold uppercase tracking-tight">
          {msg.createdAt ? formatDistanceToNow(msg.createdAt.toDate(), { locale: ptBR }) : 'agora'}
        </span>
        {isMine && (
          <CheckCheck size={12} className="text-pink-500" />
        )}
      </div>
    </motion.div>
  );
}

function ChatRoom({ chatId, onBack }: { chatId: string, onBack: () => void }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [partner, setPartner] = useState<UserProfile | null>(null);
  const commonEmojis = ['❤️', '🔥', '👏', '🙌', '😍', '✨', '😂', '💯', '🙏', '🎉', '🌟', '💎', '🚀', '👑', '🌈'];
  const [isCalling, setIsCalling] = useState<'video' | 'audio' | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const sendImage = async (base64: string) => {
    if (!user) return;
    try {
      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        chatId,
        senderId: user.uid,
        text: base64,
        type: 'image',
        createdAt: serverTimestamp()
      });
      await updateDoc(doc(db, 'chats', chatId), {
        lastMessage: '📷 Foto',
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `chats/${chatId}/messages`);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 1024 * 1024) { // 1MB limit for chat
      alert("A imagem é muito grande (máx 1MB).");
      return;
    }

    const reader = new FileReader();
    reader.onloadstart = () => setIsUploading(true);
    reader.onloadend = () => {
      sendImage(reader.result as string);
      setIsUploading(false);
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const fetchThreadInfo = async () => {
      const docRef = doc(db, 'chats', chatId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists() && user) {
        const data = docSnap.data();
        const partnerId = data.participants.find((p: string) => p !== user.uid);
        if (partnerId) {
          if (partnerId === 'system_bot') {
            setPartner({ 
              displayName: 'Suporte Vibe', 
              photoURL: 'https://api.dicebear.com/7.x/bottts/svg?seed=vibe',
              uid: 'system_bot'
            } as UserProfile);
          } else {
            const userSnap = await getDoc(doc(db, 'users', partnerId));
            if (userSnap.exists()) {
              setPartner(userSnap.data() as UserProfile);
            }
          }
        }
      }
    };
    fetchThreadInfo();
  }, [chatId, user]);

  useEffect(() => {
    const q = query(
      collection(db, 'chats', chatId, 'messages'),
      orderBy('createdAt', 'asc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ChatMessage[]);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `chats/${chatId}/messages`);
    });

    return () => unsubscribe();
  }, [chatId]);

  const sendMessage = async () => {
    if (!inputText.trim() || !user) return;
    
    const text = inputText;
    setInputText('');

    try {
      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        chatId,
        senderId: user.uid,
        text,
        type: 'text',
        createdAt: serverTimestamp()
      });

      await updateDoc(doc(db, 'chats', chatId), {
        lastMessage: text,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `chats/${chatId}/messages`);
    }
  };

  return (
    <div className="h-full bg-black flex flex-col relative z-[60] pt-safe">
      {/* Header */}
      <div className="bg-zinc-950/80 backdrop-blur-xl px-4 py-4 flex items-center justify-between border-b border-white/5 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="w-10 h-10 flex items-center justify-center hover:bg-zinc-800 rounded-xl transition-colors">
            <ArrowLeft size={24} />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-zinc-900 overflow-hidden border border-white/10 ring-2 ring-pink-500/20">
               <img 
                 src={partner?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${chatId}`} 
                 className="w-full h-full object-cover" 
               />
            </div>
            <div>
              <h3 className="font-bold text-[15px] tracking-tight">{partner?.displayName || 'Usuário'}</h3>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse shadow-sm shadow-green-500/50" />
                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Online agora</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          <button onClick={() => setIsCalling('audio')} className="p-2.5 hover:bg-zinc-900 rounded-xl text-zinc-400 hover:text-white transition-colors">
            <Phone size={20} />
          </button>
          <button onClick={() => setIsCalling('video')} className="p-2.5 hover:bg-pink-500/10 rounded-xl text-pink-500 transition-colors">
            <Video size={21} />
          </button>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 flex flex-col no-scrollbar">
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4 opacity-20">
            <div className="w-20 h-20 bg-zinc-900 rounded-[2.5rem] flex items-center justify-center">
              <MessageCircle size={40} />
            </div>
            <p className="text-xs font-bold uppercase tracking-[0.3em]">Comece a conversa</p>
          </div>
        ) : (
          messages.map((msg) => (
            <MessageItem key={msg.id} msg={msg} isMine={msg.senderId === user?.uid} />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="p-4 bg-zinc-950 border-t border-white/5 pb-10">
        <div className="flex items-end gap-3 max-w-4xl mx-auto relative">
          <AnimatePresence>
            {showEmojiPicker && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute bottom-full left-0 mb-4 bg-zinc-900 border border-white/10 rounded-2xl p-3 shadow-2xl backdrop-blur-xl z-[110] grid grid-cols-5 gap-2"
              >
                {commonEmojis.map(emoji => (
                  <button
                    key={emoji}
                    onClick={() => {
                      setInputText(prev => prev + emoji);
                      setShowEmojiPicker(false);
                    }}
                    className="text-xl hover:bg-white/10 p-2 rounded-xl transition-all active:scale-90"
                  >
                    {emoji}
                  </button>
                ))}
                <div className="absolute w-4 h-4 bg-zinc-900 border-r border-b border-white/10 rotate-45 -bottom-2 left-6" />
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex-1 bg-zinc-900/80 backdrop-blur-md rounded-[1.75rem] flex items-end p-1.5 border border-white/5 focus-within:border-pink-500/30 transition-all shadow-inner shadow-black">
            <input 
              type="file" 
              ref={imageInputRef} 
              className="hidden" 
              accept="image/*"
              onChange={handleImageUpload}
            />
            <button 
              onClick={() => imageInputRef.current?.click()}
              className="w-11 h-11 flex items-center justify-center text-zinc-500 hover:text-white transition-colors"
            >
              {isUploading ? <Loader2 size={21} className="animate-spin text-pink-500" /> : <Camera size={21} />}
            </button>
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              rows={1}
              placeholder="Mensagem..."
              className="flex-1 bg-transparent py-3.5 text-[15px] outline-none px-2 resize-none max-h-32 text-zinc-200 placeholder:text-zinc-600"
            />
            <button 
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className={cn("w-11 h-11 flex items-center justify-center transition-colors", showEmojiPicker ? "text-pink-500" : "text-zinc-500 hover:text-white")}
            >
              <Smile size={21} />
            </button>
            <button className="w-11 h-11 flex items-center justify-center text-zinc-500 hover:text-white transition-colors">
              <Gift size={21} />
            </button>
            <button className="w-11 h-11 flex items-center justify-center text-zinc-500 hover:text-white transition-colors">
              <Mic size={21} />
            </button>
          </div>
          <button 
            onClick={sendMessage}
            disabled={!inputText.trim()}
            className={cn(
              "w-14 h-14 rounded-[1.25rem] transition-all active:scale-90 flex items-center justify-center shadow-lg",
              inputText.trim() 
                ? "bg-pink-600 text-white shadow-pink-900/20" 
                : "bg-zinc-900 text-zinc-700"
            )}
          >
            <Send size={22} className={cn("transition-transform", inputText.trim() ? "translate-x-0.5 -translate-y-0.5" : "")} />
          </button>
        </div>
      </div>

      {/* Call Modal Overlay (Fake for Demo) */}
      <AnimatePresence>
        {isCalling && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-zinc-950 z-[100] flex flex-col p-8 items-center justify-between"
          >
             <div className="absolute inset-0 overflow-hidden opacity-30">
                <img 
                  src={partner?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${chatId}`} 
                  className="w-full h-full object-cover blur-3xl scale-125"
                />
             </div>

             <div className="relative text-center mt-20">
                <div className="relative mb-8 mx-auto w-40 h-40">
                  <motion.div 
                    animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0.1, 0.3] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="absolute inset-[-20%] rounded-full bg-pink-500/20 blur-2xl"
                  />
                  <div className="relative w-full h-full rounded-[3rem] border-4 border-pink-500 p-1.5 overflow-hidden bg-zinc-900 shadow-2xl">
                    <img 
                      src={partner?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${chatId}`} 
                      className="w-full h-full object-cover rounded-[2.25rem]" 
                    />
                  </div>
                </div>
                <h2 className="text-4xl font-extrabold mb-3 tracking-tighter italic uppercase">{partner?.displayName || 'Usuário'}</h2>
                <p className="text-pink-500 font-black uppercase tracking-[0.3em] text-[10px] flex items-center justify-center gap-3">
                  <span className="w-1.5 h-1.5 bg-pink-500 rounded-full animate-ping" />
                  Chamando...
                </p>
             </div>

             {/* Bottom Controls */}
             <div className="relative w-full max-w-md flex justify-around items-center mb-16 gap-4">
                <div className="flex flex-col items-center gap-3">
                   <button className="w-16 h-16 bg-zinc-900/50 backdrop-blur-xl rounded-[1.5rem] flex items-center justify-center text-white border border-white/5 hover:bg-zinc-800 transition-colors">
                     <MicOff size={24} />
                   </button>
                   <span className="text-[10px] uppercase font-black text-zinc-500 tracking-widest">Mute</span>
                </div>

                <motion.button 
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setIsCalling(null)} 
                  className="w-24 h-24 bg-red-600 rounded-[2.5rem] text-white flex items-center justify-center shadow-2xl shadow-red-500/40 border-4 border-black group"
                >
                  <X size={40} className="group-hover:rotate-90 transition-transform duration-300" strokeWidth={3} />
                </motion.button>

                <div className="flex flex-col items-center gap-3">
                   <button className="w-16 h-16 bg-zinc-900/50 backdrop-blur-xl rounded-[1.5rem] flex items-center justify-center text-white border border-white/5 hover:bg-zinc-800 transition-colors">
                     <VideoOff size={24} />
                   </button>
                   <span className="text-[10px] uppercase font-black text-zinc-500 tracking-widest">Vídeo</span>
                </div>
             </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

