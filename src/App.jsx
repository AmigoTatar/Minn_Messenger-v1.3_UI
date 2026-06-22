import { useState, useRef, useEffect } from 'react';
import { io } from 'socket.io-client';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import ProfilePanel from './components/ProfilePanel';

// Подключаемся к нашему Node.js бэкенду на порт 5001
const socket = io('http://localhost:5001');

const INITIAL_CHATS = [
  { id: "chat_1", name: "Дмитрий (Разработка)", avatar: "👨‍💻", unreadCount: 0, messages: [{ id: "m1", text: "Привет! Как там мессенджер?", sender: "friend", time: "14:15" }] },
  { id: "chat_2", name: "Флудилка (Кофе)", avatar: "☕", unreadCount: 0, messages: [{ id: "m4", text: "Кто пойдет пить кофе?", sender: "friend", time: "15:00" }] },
  { id: "chat_3", name: "Мама", avatar: "❤️", unreadCount: 0, messages: [{ id: "m5", text: "Ты покушал?", sender: "friend", time: "11:02" }] }
];
export default function App() {
  const [chats, setChats] = useState(() => {
    const saved = localStorage.getItem('messenger_chats');
    return saved ? JSON.parse(saved) : INITIAL_CHATS;
  });

  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('messenger_dark_mode');
    return saved ? JSON.parse(saved) : true;
  });

  const [activeChatId, setActiveChatId] = useState(null);
  const [inputValue, setInputValue] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const messagesEndRef = useRef(null);

  // Синхронизируем стабильный реф, чтобы убрать замыкание сокетов
  const activeChatIdRef = useRef(activeChatId);
  useEffect(() => { activeChatIdRef.current = activeChatId; }, [activeChatId]);

  const activeChat = chats.find(c => c.id === activeChatId);
  const filteredChats = chats.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()));

  // Главный слушатель входящих данных от сервера
  useEffect(() => {
    socket.on('connect', () => console.log('✅ Подключились к бэкенду!'));

    socket.on('receive_message', (data) => {
      console.log('📥 Получены данные с сервера:', data);
      
      // Автономный синтез звука (без интернета и ссылок)
      if (data.sender !== 'me') {
        try {
          const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
          const oscillator = audioCtx.createOscillator();
          const gainNode = audioCtx.createGain();
          oscillator.type = 'sine';
          oscillator.frequency.setValueAtTime(587.33, audioCtx.currentTime);
          gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + 0.15);
          oscillator.connect(gainNode);
          gainNode.connect(audioCtx.destination);
          oscillator.start();
          oscillator.stop(audioCtx.currentTime + 0.15);
        } catch (err) {
          console.log("Звук заблокирован браузером до клика:", err);
        }
      }

      // Обновляем счетчик unreadCount и добавляем сообщение
      setChats(prevChats => prevChats.map(chat => {
        if (chat.id === data.chatId) {
          const isCurrentChatActive = chat.id === activeChatIdRef.current;
          const oldCount = chat.unreadCount || 0;
          const newUnreadCount = isCurrentChatActive ? 0 : oldCount + 1;

          return {
            ...chat,
            unreadCount: newUnreadCount,
            messages: [...chat.messages, { 
              id: 'server_' + Date.now(), 
              text: data.text, 
              sender: data.sender === 'me' ? 'me' : 'friend', 
              time: data.time 
            }]
          };
        }
        return chat;
      }));
    });

    return () => { socket.off('connect'); socket.off('receive_message'); };
  }, []);
    useEffect(() => {
    if (isDarkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    localStorage.setItem('messenger_dark_mode', JSON.stringify(isDarkMode));
  }, [isDarkMode]);

  useEffect(() => { setIsProfileOpen(false); }, [activeChatId]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [activeChat?.messages, activeChatId]);
  
  useEffect(() => {
    localStorage.setItem('messenger_chats', JSON.stringify(chats));
  }, [chats]);

  // Сброс счетчика непрочитанных при входе в чат и прочтение галочек
  useEffect(() => {
    if (!activeChatId) return;
    setChats(prev => prev.map(c => c.id === activeChatId ? { ...c, unreadCount: 0 } : c));
    
    const t = setTimeout(() => {
      setChats(prev => prev.map(c => c.id === activeChatId ? {
        ...c, messages: c.messages.map(m => m.sender === 'me' && m.status !== 'read' ? { ...m, status: 'read' } : m)
      } : c));
    }, 1500);
    return () => clearTimeout(t);
  }, [activeChatId, activeChat?.messages?.length]);

  const handleDeleteMessage = (msgId) => {
    setChats(prev => prev.map(c => c.id === activeChatId ? { ...c, messages: c.messages.map(m => m.id === msgId ? { ...m, isDeleted: true } : m) } : c));
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    const text = inputValue.trim();
    if (!text || !activeChatId) return;
    const now = new Date();
    const timeStr = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
    
    socket.emit('send_message', { chatId: activeChatId, text: text, time: timeStr, sender: 'me' });
    setChats(prev => prev.map(c => c.id === activeChatId ? { ...c, messages: [...c.messages, { id: 'm_' + Date.now(), text, sender: 'me', time: timeStr, status: 'sent' }] } : c));
    setInputValue('');
  };

  const handleSendImage = (base64Image) => {
    if (!activeChatId) return;
    const now = new Date();
    const timeStr = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
    socket.emit('send_message', { chatId: activeChatId, text: "🖼️ Фотография", time: timeStr, sender: 'me' });
    setChats(prev => prev.map(c => c.id === activeChatId ? { ...c, messages: [...c.messages, { id: 'img_' + Date.now(), type: 'image', image: base64Image, sender: 'me', time: timeStr, status: 'sent' }] } : c));
  };

  const handleSendAudio = (base64Audio) => {
    if (!activeChatId) return;
    const now = new Date();
    const timeStr = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
    socket.emit('send_message', { chatId: activeChatId, text: "🎙️ Голосовое сообщение", time: timeStr, sender: 'me' });
    setChats(prev => prev.map(c => c.id === activeChatId ? { ...c, messages: [...c.messages, { id: 'audio_' + Date.now(), type: 'audio', audio: base64Audio, sender: 'me', time: timeStr, status: 'sent' }] } : c));
  };

  return (
    <div className="bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-white h-screen flex justify-center items-center font-sans antialiased transition-colors duration-300">
      <div className="w-full h-full md:max-w-5xl md:h-[90vh] md:rounded-2xl md:border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex overflow-hidden shadow-2xl transition-colors duration-300">
        <Sidebar chats={filteredChats} activeChatId={activeChatId} setActiveChatId={setActiveChatId} searchQuery={searchQuery} setSearchQuery={setSearchQuery} isDarkMode={isDarkMode} onToggleTheme={() => setIsDarkMode(!isDarkMode)} />
        <ChatArea activeChatId={activeChatId} activeChat={activeChat} setActiveChatId={setActiveChatId} inputValue={inputValue} setInputValue={setInputValue} handleSendMessage={handleSendMessage} messagesEndRef={messagesEndRef} isTyping={isTyping} onDeleteMessage={handleDeleteMessage} onSendImage={handleSendImage} onSendAudio={handleSendAudio} onToggleProfile={() => setIsProfileOpen(!isProfileOpen)} />
        <ProfilePanel activeChat={activeChat} isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />
      </div>
    </div>
  );
}

