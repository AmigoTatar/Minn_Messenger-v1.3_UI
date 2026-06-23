import { useState, useRef, useEffect } from 'react';
import { io } from 'socket.io-client';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import ProfilePanel from './components/ProfilePanel';
import Auth from './Auth'; 

export default function App() {
  // Стейт авторизации
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('user');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  // Все сообщения, загруженные из базы данных
  const [messages, setMessages] = useState([]);

  // Базовый стейт чатов (Общий чат по умолчанию)
  const [chats, setChats] = useState([
    { id: "chat_general", name: "Общий чат (PostgreSQL)", avatar: "💬", unreadCount: 0 }
  ]);

  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('messenger_dark_mode');
    return saved ? JSON.parse(saved) : true;
  });

  const [activeChatId, setActiveChatId] = useState("chat_general");
  const activeChatIdRef = useRef(activeChatId);
   const socketRef = useRef(null); 

  useEffect(() => {
    activeChatIdRef.current = activeChatId;
  }, [activeChatId]);
  const [inputValue, setInputValue] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [typingUser, setTypingUser] = useState(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const messagesEndRef = useRef(null);

  // 1. ЭФФЕКТ: Загрузка всей истории сообщений из PostgreSQL при входе
  useEffect(() => {
    if (!user) return;

    const fetchChatHistory = async () => {
      try {
        const response = await fetch('http://localhost:5001/api/messages');
        if (!response.ok) throw new Error('Ошибка при загрузке истории чата');
        const data = await response.json();
        setMessages(data); 
      } catch (error) {
        console.error('Не удалось загрузить историю:', error);
      }
    };

    fetchChatHistory();
  }, [user]);

  // 1.Б ЭФФЕКТ: Загрузка списка зарегистрированных пользователей (контактов) из базы
  useEffect(() => {
    if (!user) return;

    const fetchUsers = async () => {
      try {
        const response = await fetch('http://localhost:5001/api/users', {
          headers: { 'x-current-user-id': user.id }
        });
        if (!response.ok) throw new Error('Ошибка при загрузке пользователей');
        const databaseUsers = await response.json();

        setChats([
          { id: "chat_general", name: "Общий чат (PostgreSQL)", avatar: "💬", unreadCount: 0 },
          ...databaseUsers
        ]);
      } catch (error) {
        console.error('Не удалось загрузить список контактов:', error);
      }
    };

    fetchUsers();
  }, [user]);

  // 2. ЭФФЕКТ: Инициализация Socket.io
  useEffect(() => {
    if (!user) return; 

    socketRef.current = io('http://localhost:5001');

    socketRef.current.on('connect', () => {
      console.log('✅ Подключились к бэкенду!');
      // Всегда подписываемся на свой личный "почтовый ящик" по ID юзера
      socketRef.current.emit('join_chat', `user_${user.id}`);
      // И также подписываемся на текущий активный чат в интерфейсе
      socketRef.current.emit('join_chat', activeChatId);
    });

    socketRef.current.on('receive_message', (newMessage) => {
      console.log('📥 Получено новое сообщение:', newMessage);

      // Звуковое уведомление
      if (newMessage.senderId !== user.id) {
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
          console.log("Звук заблокирован:", err);
        }
      }

       setMessages(prevMessages => [...prevMessages, newMessage]);
      
      const currentUserId = Number(user?.id);
      const msgSenderId = Number(newMessage.senderId);
      const msgReceiverId = Number(newMessage.receiverId);

      const incomingChatId = newMessage.receiverId 
        ? (msgSenderId === currentUserId ? `user_${msgReceiverId}` : `user_${msgSenderId}`)
        : 'chat_general';

      if (incomingChatId !== activeChatIdRef.current) {
        setChats(prevChats => prevChats.map(chat => {
          if (chat.id === incomingChatId) {
            return { ...chat, unreadCount: (chat.unreadCount || 0) + 1 };
          }
          return chat;
        }));
      }});
socketRef.current.on('message_deleted', ({ messageId }) => {
      console.log('🗑️ Фронтенд поймал сокет удаления сообщения:', messageId);
      setMessages(prev => 
        prev.map(m => m.id === Number(messageId) ? { ...m, text: "Сообщение удалено", isDeleted: true } : m)
      );
    });
    // ===  СЛУШАЕМ УДАЛЕНИЕ В РЕАЛЬНОМ ВРЕМЕНИ ===
        // Слушатели статуса печатания через объект
    socketRef.current.on('typing', ({ senderId, isGeneral }) => {
      setTypingUser({ id: senderId, isGeneral });
    });
    
    socketRef.current.on('stop_typing', () => {
      setTypingUser(null);
    });

    
        socketRef.current.on('typing', ({ senderId, isGeneral }) => {
      // Сохраняем ID того, кто печатает
      setTypingUser({ id: senderId, isGeneral });
    });

    socketRef.current.on('stop_typing', () => {
      setTypingUser(null);
    });


    return () => { 
      if (socketRef.current) {
        // Чистим слушатели тоже через socketRef.current
        socketRef.current.off('receive_message');
        socketRef.current.off('message_deleted'); 
        socketRef.current.off('typing');
        socketRef.current.off('stop_typing');
        socketRef.current.disconnect(); 
      }
    };
  }, [user]); // Конец эффекта инициализации сокетов


    // НОВЫЙ ЭФФЕКТ: Сообщаем серверу о смене чата, чтобы переключить комнату сокетов
  useEffect(() => {
    // Используем строго socketRef.current
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('join_chat', activeChatId);
    }
    setTypingUser(false); // Сбрасываем индикатор печатания при переходе в другой чат
  }, [activeChatId]);


  // Тёмная тема
  useEffect(() => {
    if (isDarkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    localStorage.setItem('messenger_dark_mode', JSON.stringify(isDarkMode));
  }, [isDarkMode]);
   
    // Сброс счетчика непрочитанных при переходе в чат + отправка сокета прочтения
  useEffect(() => {
    setChats(prevChats => prevChats.map(chat => {
      if (chat.id === activeChatId) {
        return { ...chat, unreadCount: 0 };
      }
      return chat;
    }));

    // === ДОБАВЛЯЕМ СЮДА: Говорим серверу, что мы прочитали сообщения в этом чате ===
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('read_messages', { 
        activeChatId, 
        currentUserId: user?.id 
      });
    }
  }, [activeChatId, user]);


  useEffect(() => { setIsProfileOpen(false); }, [activeChatId]);
  // Автоскролл к последнему сообщению
  useEffect(() => { 
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); 
  }, [messages]);

      const handleDeleteMessage = (msgId) => {
    // Проверяем, что сокет подключен, и отправляем через .current
    if (socketRef.current) {
      socketRef.current.emit('delete_message', { 
        messageId: msgId, 
        activeChatId: activeChatId 
      });
    }
  };


  // 3. ФУНКЦИЯ: Отправка обычного ТЕКСТА (с привязкой к активной комнате)
  const handleSendMessage = (e) => {
    e.preventDefault();
    const text = inputValue.trim();
    if (!text) return;

    const messageData = {
      text: text,
      mediaUrl: null,
      mediaType: null,
      senderId: user.id,
      activeChatId: activeChatId // <-- ТЕПЕРЬ ПЕРЕДАЕМ АКТИВНЫЙ ЧАТ
    };
    
   if (socketRef.current) {
   socketRef.current.emit('send_message', messageData);
   socketRef.current.emit('stop_typing', { activeChatId });
}

    setInputValue('');
  };

      // 4. ФУНКЦИЯ: Отправка КАРТИНКИ
  const handleSendImage = (imageUrl) => {
    const messageData = {
      text: null,
      mediaUrl: imageUrl,
      mediaType: 'image',
      senderId: user.id,
      activeChatId: activeChatId
    };
    if (socketRef.current) {
      socketRef.current.emit('send_message', messageData);
    }
  };

  // 5. ФУНКЦИЯ: Отправка АУДИО
  const handleSendAudio = (audioUrl) => {
    const messageData = {
      text: null,
      mediaUrl: audioUrl,
      mediaType: 'audio',
      senderId: user.id,
      activeChatId: activeChatId
    };
    if (socketRef.current) {
      socketRef.current.emit('send_message', messageData);
    }
  };



  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  if (!user) {
    return <Auth onAuthSuccess={(authenticatedUser) => setUser(authenticatedUser)} />;
  }

    // СУПЕР-ФИЛЬТРАЦИЯ: Распределяем сообщения из общей базы по правильным комнатам
  const chatsWithMessages = chats.map(chat => {
    let chatMessages = [];

    if (chat.id === "chat_general") {
      chatMessages = messages.filter(m => m.receiverId === null);
    } else if (chat.id.startsWith("user_")) {
      const targetUserId = Number(chat.id.replace('user_', ''));
      chatMessages = messages.filter(m => 
        (Number(m.senderId) === Number(user.id) && Number(m.receiverId) === targetUserId) ||
        (Number(m.senderId) === targetUserId && Number(m.receiverId) === Number(user.id))
      );
    }

    // === ДОБАВЛЯЕМ ЭТОТ МАППИНГ: если текст "Сообщение удалено", ставим флаг автоматом ===
    const mappedMessages = chatMessages.map(m => 
      m.text === "Сообщение удалено" ? { ...m, isDeleted: true } : m
    );

    return { ...chat, messages: mappedMessages };
  });


  // Фильтруем чаты по поисковой строке
  const filteredChats = chatsWithMessages.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Определяем активный чат
  const activeChat = chatsWithMessages.find(c => c.id === activeChatId) || chatsWithMessages[0];

  return (
    <div className="bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-white h-screen flex justify-center items-center font-sans antialiased transition-colors duration-300">
      <div className="w-full h-full md:max-w-5xl md:h-[90vh] md:rounded-2xl md:border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex overflow-hidden shadow-2xl transition-colors duration-300">
        
        <Sidebar 
          chats={filteredChats} 
          activeChatId={activeChatId} 
          setActiveChatId={setActiveChatId} 
          searchQuery={searchQuery} 
          setSearchQuery={setSearchQuery} 
          isDarkMode={isDarkMode} 
          onToggleTheme={() => setIsDarkMode(!isDarkMode)} 
          onLogout={handleLogout} 
        />
        
        <ChatArea 
          activeChatId={activeChatId} 
          activeChat={activeChat} 
          setActiveChatId={setActiveChatId} 
          inputValue={inputValue} 
          setInputValue={setInputValue} 
          handleSendMessage={handleSendMessage} 
          messagesEndRef={messagesEndRef} 
          onDeleteMessage={handleDeleteMessage}
          socketRef={socketRef}
          typingUser={typingUser} 
          onDeleteMessage={handleDeleteMessage} 
          onSendImage={handleSendImage} 
          onSendAudio={handleSendAudio} 
          onToggleProfile={() => setIsProfileOpen(!isProfileOpen)} 
          currentUserId={user?.id} 
          typingUser={typingUser}
        />
        
        <ProfilePanel 
          activeChat={activeChat} 
          isOpen={isProfileOpen} 
          onClose={() => setIsProfileOpen(false)} 
        />
        
      </div>
    </div>
  );
}
