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
  const [channels, setChannels] = useState([]);
  const [activeChatData, setActiveChatData] = useState(null);

  useEffect(() => {
    activeChatIdRef.current = activeChatId;
  }, [activeChatId]);
  const [inputValue, setInputValue] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [typingUser, setTypingUser] = useState(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const messagesEndRef = useRef(null);

    // =========================================================================
  // 📜 ЕДИНЫЙ КАСКАДНЫЙ ЭФФЕКТ: Последовательная загрузка для защиты пула БД (max: 2)
  // =========================================================================
  useEffect(() => {
    if (!user) return;

    const initializeAppData = async () => {
      try {
        console.log('🔄 Старт каскадной инициализации данных...');

        // --- 1. ШАГ: Загрузка пользователей ---
        try {
          const resUsers = await fetch('http://localhost:5001/api/users', {
            headers: { 'x-current-user-id': user.id }
          });
          if (!resUsers.ok) throw new Error('Ошибка при загрузке пользователей');
          const databaseUsers = await resUsers.json();
          setChats([
            { id: "chat_general", name: "Общий чат (PostgreSQL)", avatar: "💬", unreadCount: 0 },
            ...databaseUsers
          ]);
          console.log('✅ Контакты успешно загружены');
        } catch (err) {
          console.error('Не удалось загрузить список контактов:', err);
        }

        // Микропауза 250мс для освобождения слота в pg.Pool
        await new Promise(res => setTimeout(res, 250));

        // --- 2. ШАГ: Загрузка каналов ---
        try {
          const resChannels = await fetch('http://localhost:5001/api/channels');
          if (!resChannels.ok) throw new Error('Ошибка при загрузке каналов');
          const channelsData = await resChannels.json();
          console.log('📢 Загруженные каналы с бэкенда:', channelsData);
          setChannels(channelsData);
        } catch (err) {
          console.error('Не удалось загрузить список каналов:', err);
        }

        // Микропауза 250мс для освобождения слота в pg.Pool
        await new Promise(res => setTimeout(res, 250));

                // --- 3. ШАГ: Загрузка истории сообщений ---
        try {
          const resMessages = await fetch('http://localhost:5001/api/messages');
          if (!resMessages.ok) throw new Error('Ошибка при загрузке истории чата');
          const messagesData = await resMessages.json();
          setMessages(messagesData);
          console.log('✅ История сообщений успешно загружены');
        } catch (err) {
          console.error('Не удалось загрузить историю:', err);
        }

        console.log('🚀 Каскадная загрузка данных успешно завершена!');

      } catch (globalError) {
        console.error('Критический сбой инициализации приложения:', globalError);
      }
    };

    initializeAppData();
  }, [user]);


  // =========================================================================
  // 📢 СОЗДАНИЕ КАНАЛА (ОБРАБОТЧИК ФОРМЫ С САЙДБАРА)
  // =========================================================================
  const handleCreateChannel = async (channelData) => {
    try {
      const savedUser = localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')) : null;
      const creatorId = savedUser?.id || savedUser?._id; 
      
      if (!creatorId) {
        alert("Ошибка: Пользователь не авторизован или ID не найден");
        return;
      }

      const response = await fetch('http://localhost:5001/api/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: channelData.name,
          avatar: channelData.avatar,
          creatorId: creatorId
        }),
      });

      if (!response.ok) throw new Error('Ошибка при отправке запроса на создание канала');
      
      const newChannel = await response.json();
      setChannels(prev => [...prev, newChannel]);

    } catch (error) {
      console.error('Ошибка создания канала на фронтенде:', error);
      alert('Не удалось создать канал. Попробуйте еще раз.');
    }
  };

    

  // =========================================================================
  // 🔌 ИНИЦИАЛИЗАЦИЯ SOCKET.IO СО ВСЕМИ СЛУШАТЕЛЯМИ
  // =========================================================================
  useEffect(() => {
    if (!user) return; 

    // Создаем подключение, только если его еще нет
    if (!socketRef.current) {
      socketRef.current = io('http://localhost:5001');
    }

    const socket = socketRef.current;

    socket.on('connect', () => {
      console.log('✅ Подключились к бэкенду!');
      socket.emit('join_chat', `user_${user.id}`);
      socket.emit('join_chat', activeChatId);
    });

    // Очищаем старые слушатели перед навешиванием новых для защиты от дублирования
    socket.off('receive_message');
    socket.off('message_deleted');
    socket.off('typing');
    socket.off('channel_created');

    // === 1. СЛУШАТЕЛЬ НОВЫХ СООБЩЕНИЙ ===
    socket.on('receive_message', (newMessage) => {
      console.log('📥 Получено новое сообщение:', newMessage);

      // Железная защита от дублирования сообщений по ID
      setMessages((prev) => {
        if (prev.some((msg) => msg.id === newMessage.id)) return prev; 
        return [...prev, newMessage];
      });

      // Логика счетчиков непрочитанных сообщений (зеленые кружочки)
      const currentUserId = Number(user?.id);
      const msgSenderId = Number(newMessage.senderId);
      const msgReceiverId = Number(newMessage.receiverId);

      const incomingChatId = newMessage.channelId
        ? `channel_${newMessage.channelId}`
        : newMessage.receiverId 
          ? (msgSenderId === currentUserId ? `user_${msgReceiverId}` : `user_${msgSenderId}`)
          : 'chat_general';

      if (incomingChatId !== activeChatIdRef.current) {
        setChats(prevChats => prevChats.map(chat => {
          if (chat.id === incomingChatId) {
            return { ...chat, unreadCount: (chat.unreadCount || 0) + 1 };
          }
          return chat;
        }));
      }

      // Звуковое уведомление (генерация пика через AudioContext)
      if (Number(newMessage.senderId) !== Number(user.id)) {
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
    });

    // === 2. СЛУШАТЕЛЬ СОЗДАНИЯ КАНАЛОВ ===
    socket.on('channel_created', (newChannel) => {
      console.log('📢 Через сокет получен новый канал:', newChannel);
      setChannels((prev) => {
        if (prev.some(ch => ch.id === newChannel.id)) return prev;
        return [...prev, newChannel];
      });
    });

    // === 3. СЛУШАТЕЛЬ УДАЛЕНИЯ СООБЩЕНИЙ ===
    socket.on('message_deleted', ({ messageId }) => {
      console.log('🗑️ Фронтенд поймал сокет удаления сообщения:', messageId);
      setMessages(prev => 
        prev.map(m => m.id === Number(messageId) ? { ...m, text: "Сообщение удалено", isDeleted: true } : m)
      );
    });

    // === 4. СЛУШАТЕЛЬ СТАТУСА ПЕЧАТАНИЯ ===
    let typingTimer = null;
    socket.on('typing', ({ senderId, isGeneral }) => {
      setTypingUser({ senderId, isGeneral });

      if (typingTimer) clearTimeout(typingTimer);
      typingTimer = setTimeout(() => {
        setTypingUser(null);
      }, 2500);
    });

    // Функция-уборщик реакта
    return () => {
      if (typingTimer) clearTimeout(typingTimer);
      socket.off('connect');
      socket.off('receive_message');
      socket.off('message_deleted');
      socket.off('typing');
      socket.off('channel_created');
    };
  }, [user]); // Слушаем только авторизованного пользователя, НИКАКИХ activeChatId!




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
  /*useEffect(() => { 
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); 
  }, [messages]);*/

      const handleDeleteMessage = (msgId) => {
    // Проверяем, что сокет подключен, и отправляем через .current
    if (socketRef.current) {
      socketRef.current.emit('delete_message', { 
        messageId: msgId, 
        activeChatId: activeChatId 
      });
    }
  };
    // 🔥 ДОБАВЛЯЕМ: Функция форматирования времени для Sidebar
  const formatMsgTime = (dateString) => {
    if (!dateString) return '';
    try {
      const d = new Date(dateString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

const handleSelectChat = async (chatId) => {
  if (!chatId) return;
  
  console.log("=== Переключение чата на ID:", chatId);
  
  // 1. Фиксируем ID активной комнаты
  setActiveChatId(chatId);
  
  // 2. Мгновенно сбрасываем старые данные во избежание визуального залипания
  setActiveChatData(null); 

  const stringChatId = chatId.toString();

  // 3. ОБЩИЙ ЧАТ
  if (stringChatId === 'chat_general') {
    setActiveChatData({
      name: 'Общий чат',
      avatar: '💬',
      type: 'general'
    });
    return;
  }

  // 4. КАНАЛЫ
  if (stringChatId.startsWith('channel_')) {
    const cleanChannelId = stringChatId.replace('channel_', '');
    const currentChannel = channels.find(ch => 
      ch && ch.id && (ch.id.toString() === cleanChannelId || ch.id.toString() === stringChatId)
    );
    
    if (currentChannel) {
      setActiveChatData({
        name: currentChannel.name,
        avatar: currentChannel.avatar || '📢',
        type: 'channel',
        creatorId: currentChannel.creatorId ? Number(currentChannel.creatorId) : null
      });
    } else {
      setActiveChatData({
        name: `Канал #${cleanChannelId}`,
        avatar: '📢',
        type: 'channel'
      });
    }
    return;
  }

  // 5. ПРИВАТНЫЕ ЧАТЫ (user_)
  if (stringChatId.startsWith('user_')) {
    const cleanUserId = stringChatId.replace('user_', '');
    
    // Принудительно ищем по совпадению очищенных строк ID
    let targetUser = chats.find(c => {
      if (!c || !c.id) return false;
      const parsedId = c.id.toString().replace('user_', '');
      return parsedId === cleanUserId;
    });

    if (!targetUser && typeof contacts !== 'undefined' && contacts) {
      targetUser = contacts.find(c => c && c.id && c.id.toString() === cleanUserId);
    }
    
    if (targetUser) {
      setActiveChatData({
        name: targetUser.name || targetUser.username || `Пользователь #${cleanUserId}`,
        avatar: targetUser.avatar || '👤',
        type: 'user'
      });
      return;
    }

    // Железобетонный бэкап-запрос к серверу
    try {
      console.log(`🔍 Собеседник не найден локально. Запрос к API для ID: ${cleanUserId}`);
      const response = await fetch(`http://localhost:5001/api/users`);
      if (response.ok) {
        const allUsers = await response.json();
        const serverUser = allUsers.find(u => u && u.id && u.id.toString() === cleanUserId);
        
        if (serverUser) {
          setActiveChatData({
            name: serverUser.name || serverUser.username || `Пользователь #${cleanUserId}`,
            avatar: serverUser.avatar || '👤',
            type: 'user'
          });
          return;
        }
      }
    } catch (err) {
      console.error('Ошибка бэкап-запроса пользователя:', err);
    }

    // Тотальный Fallback, если локально и на сервере пусто
    setActiveChatData({
      name: `Пользователь #${cleanUserId}`,
      avatar: '👤',
      type: 'user'
    });
  }
};



    const getActiveChatMessages = () => {
    // 1. ОБЩИЙ ЧАТ: только сообщения без канала и БЕЗ конкретного получателя
    if (activeChatId === 'chat_general') {
      return messages.filter(m => !m.channelId && !m.receiverId && !m.roomId);
    }
    
    // 2. ПУБЛИЧНЫЕ КАНАЛЫ: строго по channelId
    if (activeChatId.startsWith('channel_')) {
      const channelDbId = Number(activeChatId.replace('channel_', ''));
      return messages.filter(m => Number(m.channelId) === channelDbId);
    }
    
    // 3. ЛИЧНЫЕ ЧАТЫ (ТЕТ-А-ТЕТ): строго между двумя конкретными пользователями
    if (activeChatId.startsWith('user_')) {
      const targetUserId = Number(activeChatId.replace('user_', ''));
      return messages.filter(m => 
        (Number(m.senderId) === Number(user.id) && Number(m.receiverId) === targetUserId) ||
        (Number(m.senderId) === targetUserId && Number(m.receiverId) === Number(user.id))
      );
    }

    return messages.filter(m => m.roomId === activeChatId);
  };


  
  // =========================================================================
  const activeChat = {
    id: activeChatId,
    messages: getActiveChatMessages(),
    
    // Подтягиваем имя в зависимости от типа активного чата
    name: activeChatId === 'chat_general' 
      ? 'Общий чат (PostgreSQL)' 
      : (activeChatData?.name || 'Чат'),
      
    // Подтягиваем аватарку
    avatar: activeChatId === 'chat_general' 
      ? '💬' 
      : (activeChatData?.avatar || '👤')
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
  const handleSendImage = (urlFromMulter) => {
  const messageData = {
    text: null,
    mediaUrl: urlFromMulter, // 🔥 Проверить, чтобы бэкенд получал именно mediaUrl!
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

  


  return (
    <div className="bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-white h-screen flex justify-center items-center font-sans antialiased transition-colors duration-300">
      <div className="w-full h-full md:max-w-5xl md:h-[90vh] md:rounded-2xl md:border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex overflow-hidden shadow-2xl transition-colors duration-300">
        
        <Sidebar 
          chats={filteredChats} 
          activeChat={activeChat}
          activeChatId={activeChatId} 
          setActiveChatId={setActiveChatId} 
          searchQuery={searchQuery} 
          setSearchQuery={setSearchQuery} 
          isDarkMode={isDarkMode} 
          onToggleTheme={() => setIsDarkMode(!isDarkMode)} 
          onLogout={handleLogout} 
          formatMsgTime={formatMsgTime}
          channels={channels}
          onSelectChat={handleSelectChat}
          onCreateChannel={handleCreateChannel}
        />
        
                  <ChatArea 
          key={activeChatId} // ⚡ Мгновенно пересоздает чат при переключении, убирая любые залипания
          activeChatId={activeChatId} 
          activeChat={activeChat} 
          activeChatData={activeChatData} 
          messages={getActiveChatMessages()} // 🔥 Передаем отфильтрованные сообщения на экран!
          setActiveChatId={setActiveChatId} 
          inputValue={inputValue} 
          setInputValue={setInputValue} 
          handleSendMessage={handleSendMessage} 
          messagesEndRef={messagesEndRef} 
          socketRef={socketRef}
          typingUser={typingUser} // Передаем объект печатающего пользователя
          onDeleteMessage={handleDeleteMessage} 
          onSendImage={handleSendImage} 
          onSendAudio={handleSendAudio} 
          onToggleProfile={() => setIsProfileOpen(!isProfileOpen)} 
          currentUserId={user?.id} 
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
