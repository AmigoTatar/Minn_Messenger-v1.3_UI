import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import ProfilePanel from './components/ProfilePanel';
import Auth from './Auth';
import { API_BASE_URL, CHAT_IDS } from './config';

export default function App() {
  const [user, setUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem('user');
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });
const { GENERAL, CHANNEL_PREFIX, USER_PREFIX } = CHAT_IDS;

  const [authState, setAuthState] = useState({
    token: localStorage.getItem('token'),
    user: (() => {
      try {
        const u = localStorage.getItem('user');
        return u ? JSON.parse(u) : null;
      } catch {
        return null;
      }
    })()
  });

  // Синхронизируем authState при ручном изменении стейта user (например, при логауте)
  useEffect(() => {
    setAuthState({
      token: localStorage.getItem('token'),
      user: user
    });
  }, [user]);

  const [messages, setMessages] = useState([]);
  const [chats, setChats] = useState([]);
  const [channels, setChannels] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [activeChatData, setActiveChatData] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [groupChats, setGroupChats] = useState([]);
  
  // ==========================================
  // 📊 НЕПРОЧИТАННЫЕ СООБЩЕНИЯ
  // ==========================================
  const [unreadCounts, setUnreadCounts] = useState({});
  
  // =========================================================================
  // 🌙 СТЕЙТ И АВТОПЕРЕКЛЮЧАТЕЛЬ ТЁМНОЙ ТЕМЫ ДЛЯ TAILWIND
  // =========================================================================
  const [isDarkMode, setIsDarkMode] = useState(() => {
    try {
      const saved = localStorage.getItem('messenger_dark_mode');
      return saved ? JSON.parse(saved) : true; // По умолчанию ставим true (темную)
    } catch {
      return true;
    }
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('messenger_dark_mode', JSON.stringify(isDarkMode));
  }, [isDarkMode]);

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [typingUser, setTypingUser] = useState(null);


      const processedMessagesCache = new Set();
      useEffect(() => {
  // Очищаем кеш при смене чата
  processedMessagesCache.clear();
}, [activeChatId]);  


  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);

  // ==========================================
  // 📊 ФУНКЦИИ ДЛЯ НЕПРОЧИТАННЫХ
  // ==========================================
const fetchUnreadCounts = async () => {
  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_BASE_URL}/api/unread`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    if (response.ok) {
      const counts = await response.json();
      console.log('📊 Загружены непрочитанные с сервера:', counts);
      setUnreadCounts(counts);
    }
  } catch (error) {
    console.error('Error fetching unread counts:', error);
  }
};

const markAsRead = async (type, id) => {
  const key = `${type}_${id}`;
  if (markingAsRead.current.has(key)) {
    console.log(`⚠️ Уже отмечается ${key}, пропускаем`);
    return;
  }
  
  markingAsRead.current.add(key);
  
  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_BASE_URL}/api/read`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ type, id })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Ошибка ${response.status}:`, errorText);
      throw new Error(`Server error: ${response.status}`);
    }
    
    // ✅ Формируем ключ для unreadCounts
    let chatKey;
    if (type === 'channel') {
      chatKey = `channel_${id}`;
    } else if (type === 'chat') {
      chatKey = `chat_${id}`;
    } else if (type === 'private') {
      chatKey = `user_${id}`;
    } else {
      chatKey = key;
    }
    
    // ✅ Обнуляем счетчик
    setUnreadCounts(prev => ({
      ...prev,
      [chatKey]: 0
    }));
    
    console.log(`✅ Отмечено как прочитанное: ${chatKey}, счетчик обнулен`);
  } catch (error) {
    console.error('❌ Error marking as read:', error);
  } finally {
    markingAsRead.current.delete(key);
    setTimeout(() => {
      markingAsRead.current.delete(key);
    }, 500);
  }
};

// Добавьте useRef для защиты
const markingAsRead = useRef(new Set());
const processingUpdates = useRef(new Set());


  // =========================================================================
  // 🔄 ПЕРВИЧНАЯ ЗАГРУЗКА ПОЛЬЗОВАТЕЛЕЙ И КАНАЛОВ (ОЖИВЛЯЕМ САЙДБАР)
  // =========================================================================
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token || !user) return;

const fetchSidebarData = async () => {
  try {
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    const [usersResponse, channelsResponse, groupChatsResponse] = await Promise.all([
      fetch(`${API_BASE_URL}/api/users`, { headers }),
      fetch(`${API_BASE_URL}/api/channels`, { headers }),
      fetch(`${API_BASE_URL}/api/chats`, { headers })
    ]);

    if (usersResponse.ok) {
      const usersData = await usersResponse.json();
      const usersArray = Array.isArray(usersData) ? usersData : [];
      setChats(usersArray);
      console.log('👤 Загружены пользователи:', usersArray);
    }

    if (channelsResponse.ok) {
      const channelsData = await channelsResponse.json();
      console.log('📢 Загружены каналы с сервера:', channelsData);
      setChannels(channelsData);
    }

    if (groupChatsResponse.ok) {
      const groupChatsData = await groupChatsResponse.json();
      setGroupChats(groupChatsData);
      console.log('👥 Загружены групповые чаты:', groupChatsData);
    }
    
    // ✅ ЗАГРУЖАЕМ НЕПРОЧИТАННЫЕ (ДОЛЖНО БЫТЬ В КОНЦЕ)
    await fetchUnreadCounts();
    
  } catch (error) {
    console.error('Ошибка при инициализации данных сайдбара:', error);
  }
};

    fetchSidebarData();
  }, [user]);


  // Синхронный реф активного чата для мгновенного доступа внутри слушателей сокетов
  const activeChatIdRef = useRef(activeChatId);
  useEffect(() => {
    activeChatIdRef.current = activeChatId;
  }, [activeChatId]);

  // =========================================================================
  // 📢 СОЗДАНИЕ КАНАЛА (ОБРАБОТЧИК ФОРМЫ С САЙДБАРА)
  // =========================================================================
 const handleCreateChannel = async (channelData) => {
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      alert("Ошибка: Сессия истекла. Пожалуйста, войдите снова.");
      return;
    }

    const response = await fetch(`${API_BASE_URL}/api/channels`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}` 
      },
      body: JSON.stringify({
        name: channelData.name,
        avatar: channelData.avatar
      }),
    });

    if (!response.ok) throw new Error('Ошибка при отправке запроса на создание канала');
    
    console.log('✅ Канал создан, ждем подтверждения от сокета');
    
  } catch (error) {
    console.error('Ошибка создания канала на фронтенде:', error);
    alert('Не удалось создать канал. Попробуйте еще раз.');
  }
};

// 👥 СОЗДАНИЕ ГРУППОВОГО ЧАТА
const handleCreateGroupChat = async (chatData) => {
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      alert("Ошибка: Сессия истекла");
      return;
    }

    const response = await fetch(`${API_BASE_URL}/api/chats`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}` 
      },
      body: JSON.stringify({
        name: chatData.name,
        avatar: chatData.avatar || '💬',
        memberIds: chatData.memberIds
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Ошибка создания чата');
    }
    
    const newChat = await response.json();
    console.log('✅ Групповой чат создан:', newChat);
    
    setGroupChats(prev => [...prev, newChat]);
    handleSelectChat(`chat_${newChat.dbId || newChat.id}`);
    
  } catch (error) {
    console.error('Ошибка создания группового чата:', error);
    alert('Не удалось создать чат: ' + error.message);
  }
};


  // =========================================================================
  // 🔌 ИНИЦИАЛИЗАЦИЯ SOCKET.IO СО ВСЕМИ СЛУШАТЕЛЯМИ
  // =========================================================================
  useEffect(() => {
    if (!user) return; 

    const token = localStorage.getItem('token');

    if (!socketRef.current) {
      socketRef.current = io(API_BASE_URL, {
        transports: ['websocket'],
        auth: { token }
      });
    }
    const socket = socketRef.current;



 socket.on('connect', () => {
  console.log('✅ Подключились к бэкенду через сокеты!');
  fetchUnreadCounts();
  socket.emit('join_chat', `user_${user.id}`);
  console.log(`📌 Подписался на user_${user.id}`);
  
  
  if (channels && channels.length > 0) {
    console.log(`📢 Подписываюсь на ${channels.length} каналов:`, channels.map(c => c.name));
    channels.forEach(channel => {
      const channelId = `channel_${channel.id}`;
      console.log(`🔗 Подписываюсь на канал: ${channelId} (${channel.name})`);
      socket.emit('join_chat', channelId);
    });
  }

  socket.emit('join_chat', `user_${user.id}`);
  socket.emit('join_chat', activeChatIdRef.current);
  
  if (channels && channels.length > 0) {
  console.log(`📢 Подписываюсь на ${channels.length} каналов:`, channels.map(c => c.name));
  channels.forEach(channel => {
     
  socket.emit('join_chat', `channel_${channel.id}`);
    });
  }
});

socket.on('connect_error', (error) => {
  console.error('❌ Ошибка подключения к сокету:', error);
});

socket.onAny((event, ...args) => {
  /*console.log(`🔌 Событие сокета: ${event}`, args);*/
});

socket.on('disconnect', (reason) => {
 /* console.log('🔌 Сокет отключен:', reason);*/
  if (reason === 'io server disconnect') {
    // reconnect
    socket.connect();
  }
});


    const typingTimerRef = { current: null };


// === 1. СЛУШАТЕЛЬ НОВЫХ СООБЩЕНИЙ ===
socket.on('receive_message', (newMessage) => {
  console.log(`📩 Получено сообщение:`, newMessage);
  
  setMessages(prev => {
    if (prev.some((msg) => msg && msg.id === newMessage.id)) {
      console.log(`⚠️ Сообщение ${newMessage.id} уже есть в массиве`);
      return prev;
    }
    const newArray = [...prev, newMessage];
    console.log(`✅ Сообщение добавлено, теперь ${newArray.length} сообщений`);
    return newArray;
  });
  
  const currentUserId = Number(user?.id);
  const msgSenderId = Number(newMessage.senderId);
  const msgReceiverId = Number(newMessage.receiverId);

  const incomingChatId = newMessage.channelId
    ? `channel_${newMessage.channelId}`
    : newMessage.chatId
      ? `chat_${newMessage.chatId}`
      : newMessage.receiverId && newMessage.senderId
        ? (msgSenderId === currentUserId ? `user_${msgReceiverId}` : `user_${msgSenderId}`)
        : 'chat_general';

  console.log(`🔍 Определен incomingChatId: ${incomingChatId}`);
  console.log(`🔍 Текущий активный чат: ${activeChatIdRef.current}`);
  console.log(`🔍 Равны? ${incomingChatId === activeChatIdRef.current}`);

  // ==========================================
  // 🔄 ОБНОВЛЯЕМ ПОСЛЕДНЕЕ СООБЩЕНИЕ
  // ==========================================
  
  // ✅ 1. Для ПРИВАТНЫХ чатов
  if (newMessage.receiverId && !newMessage.channelId && !newMessage.chatId) {
    console.log(`📌 Обновляю lastMessage для приватного чата`);
    setChats(prev => prev.map(chat => {
      const chatUserId = Number(chat.id?.replace('user_', ''));
      if (chatUserId === msgSenderId || chatUserId === msgReceiverId) {
        return { ...chat, lastMessage: newMessage };
      }
      return chat;
    }));
  }
  
  // ✅ 2. Для КАНАЛОВ
  if (newMessage.channelId) {
    console.log(`📌 Обновляю lastMessage для канала ${newMessage.channelId}`);
    setChannels(prev => prev.map(channel => {
      if (Number(channel.id) === Number(newMessage.channelId)) {
        return { ...channel, lastMessage: newMessage };
      }
      return channel;
    }));
  }
  
  // ✅ 3. Для ГРУППОВЫХ чатов
  if (newMessage.chatId) {
    console.log(`📌 Обновляю lastMessage для группы ${newMessage.chatId}`);
    setGroupChats(prev => prev.map(chat => {
      if (Number(chat.dbId) === Number(newMessage.chatId)) {
        return { ...chat, lastMessage: newMessage };
      }
      return chat;
    }));
  }

  // ==========================================
  // 🛡️ ЗАЩИТА: если поля потерялись при передаче
  // ==========================================
  
  // Если мы находимся в канале, но newMessage.channelId === null
  if (activeChatId && activeChatId.startsWith('channel_') && !newMessage.channelId && !newMessage.receiverId) {
    const channelId = Number(activeChatId.replace('channel_', ''));
    console.log(`🔧 Принудительно обновляю канал ${channelId} (защита)`);
    setChannels(prev => prev.map(ch => {
      if (Number(ch.id) === channelId) {
        return { ...ch, lastMessage: newMessage };
      }
      return ch;
    }));
  }
  
  // Если мы находимся в группе, но newMessage.chatId === null
  if (activeChatId && activeChatId.startsWith('chat_') && !newMessage.chatId && !newMessage.receiverId) {
    const chatId = Number(activeChatId.replace('chat_', ''));
    console.log(`🔧 Принудительно обновляю группу ${chatId} (защита)`);
    setGroupChats(prev => prev.map(g => {
      if (Number(g.dbId) === chatId) {
        return { ...g, lastMessage: newMessage };
      }
      return g;
    }));
  }

  // ==========================================
  // 📊 ЛОГИРУЕМ НЕПРОЧИТАННЫЕ
  // ==========================================
  if (incomingChatId !== activeChatIdRef.current) {
    console.log(`📊 Сообщение в НЕ активном чате ${incomingChatId}, счетчик будет увеличен через unread_updated`);
  } else {
    console.log(`✅ Сообщение в активном чате, счетчик НЕ увеличиваю`);
  }
});
    // === 2. СЛУШАТЕЛЬ СОЗДАНИЯ КАНАЛОВ ===
    socket.on('channel_created', (newChannel) => {
      setChannels((prev) => {
        if (prev.some(ch => ch.id === newChannel.id)) return prev;
        return [...prev, newChannel];
      });
    });
// === 3.1. СЛУШАТЕЛЬ УДАЛЕНИЯ КАНАЛА ===
socket.on('channel_deleted', ({ channelId }) => {
  console.log(`🗑️ Канал ${channelId} удален`);
  
  setChannels(prev => prev.filter(ch => ch.id !== channelId));
  
  if (activeChatId === `channel_${channelId}`) {
    setActiveChatId('chat_general');
    setActiveChatData({ name: 'Общий чат', avatar: '💬', type: 'general' });
  }
});
    // === 3. СЛУШАТЕЛЬ УДАЛЕНИЯ СООБЩЕНИЙ ===
socket.on('message_deleted', ({ messageId }) => {
  console.log(`🗑️ Сообщение ${messageId} удалено`);
  
  setMessages(prev => 
    (prev || []).map(m => {
      if (m.id === Number(messageId)) {
        return { 
          ...m, 
          text: "Сообщение удалено", 
          mediaUrl: null,
          mediaType: null,
          isDeleted: true 
        };
      }
      return m;
    })
  );
});

// === 5. СЛУШАТЕЛЬ ОБНОВЛЕНИЯ СТАТУСА ПРОЧТЕНИЯ ===
socket.on('messages_read_update', ({ activeChatId: readChatId, readerId }) => {
  console.log(`📖 Обновление статуса прочтения: ${readChatId}, читатель: ${readerId}`);
  
  setMessages(prev => {
    return (prev || []).map(m => {
      const isTargetMsg = readChatId === 'chat_general'
        ? (!m.channelId && !m.receiverId)
        : readChatId.startsWith('channel_')
          ? String(m.channelId) === String(readChatId.replace('channel_', ''))
          : (String(m.senderId) === String(readerId) || String(m.receiverId) === String(readerId));

      if (isTargetMsg && String(m.senderId) !== String(readerId)) {
        return { ...m, status: 'read' };
      }
      return m;
    });
  });

  if (readChatId.startsWith('channel_')) {
    const channelDbId = Number(readChatId.replace('channel_', ''));
    setChannels(prevChannels => 
      prevChannels.map(channel => {
        if (Number(channel.id) === channelDbId) {
          return { ...channel, unreadCount: 0 };
        }
        return channel;
      })
    );
  }
});

// === СЛУШАТЕЛЬ СОЗДАНИЯ ТРЕДА ===
socket.on('thread_created', ({ thread, messageId, activeChatId }) => {
  console.log(`💬 Новый комментарий к сообщению ${messageId}:`, thread);
  
  setMessages(prev => {
    const msgExists = prev.some(m => m.id === messageId);
    if (!msgExists) {
      console.log('⚠️ Сообщение не найдено в стейте');
      return prev;
    }
    
    return prev.map(msg => {
      if (msg.id === messageId) {
        const threadExists = msg.threads?.some(t => t.id === thread.id);
        if (threadExists) {
          console.log('⚠️ Тред уже существует, пропускаем');
          return msg;
        }
        return {
          ...msg,
          threads: [...(msg.threads || []), thread]
        };
      }
      return msg;
    });
  });
});

// === СЛУШАТЕЛЬ УДАЛЕНИЯ ГРУППОВОГО ЧАТА ===
socket.on('chat_deleted', ({ chatId }) => {
  console.log(`🗑️ Групповой чат ${chatId} удален`);
  
  setGroupChats(prev => prev.filter(ch => ch.dbId !== chatId && ch.id !== `chat_${chatId}`));
  
  if (activeChatId === `chat_${chatId}`) {
    setActiveChatId(null);
    setActiveChatData(null);
  }
});

// === СЛУШАТЕЛЬ ОБНОВЛЕНИЯ РЕАКЦИЙ ===
socket.on('reaction_updated', ({ messageId, reactions }) => {
  console.log(`❤️ Обновлены реакции для сообщения ${messageId}:`, reactions);
  
  setMessages(prev =>
    prev.map(msg => {
      if (msg.id === messageId) {
        return {
          ...msg,
          reactions: reactions
        };
      }
      return msg;
    })
  );
});

    // === 6. СЛУШАТЕЛЬ ИЗМЕНЕНИЯ СТАТУСА ОНЛАЙНА ===
    socket.on('user_status_change', (data) => {
      const { userId, status } = data;
      setChats(prevChats => prevChats.map(chat => {
        if (chat.dbId === Number(userId)) {
          return { ...chat, isOnline: status === 'online' };
        }
        return chat;
      }));
    });


// === СЛУШАТЕЛЬ ОБНОВЛЕНИЯ НЕПРОЧИТАННЫХ ===
socket.on('unread_updated', (data) => {
  console.log(`📊 Получено обновление непрочитанных:`, data);
  
  const { type, id, count } = data;
  let chatKey;
  
  if (type === 'channel') {
    chatKey = `channel_${id}`;
  } else if (type === 'chat') {
    chatKey = `chat_${id}`;
  } else if (type === 'private') {
    chatKey = `user_${id}`;
  }
  
  if (!chatKey) return;
  
  // ✅ Используем простой ключ без Date.now()
  const updateKey = chatKey;
  if (processingUpdates.current.has(updateKey)) {
    console.log(`⚠️ Пропускаю дублирование для ${updateKey}`);
    return;
  }
  processingUpdates.current.add(updateKey);
  
  setUnreadCounts(prev => {
    const currentCount = prev[chatKey] || 0;
    const newCount = currentCount + count;
    console.log(`📊 Увеличен счетчик для ${chatKey}: ${currentCount} + ${count} = ${newCount}`);
    return {
      ...prev,
      [chatKey]: newCount
    };
  });
  
  // Удаляем из сета через 300ms
  setTimeout(() => {
    processingUpdates.current.delete(updateKey);
  }, 300);
});

    return () => {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      socket.off('connect');
      socket.off('receive_message');
      socket.off('channel_created');
      socket.off('message_deleted');
      socket.off('typing');
      socket.off('messages_read_update');
      socket.off('user_status_change');
    };
  }, [user]);

  // Переключение комнат при смене чата
  useEffect(() => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('join_chat', activeChatId);
    }
    setTypingUser(false);
  }, [activeChatId]);

  // Тёмная тема
  useEffect(() => {
    if (isDarkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    localStorage.setItem('messenger_dark_mode', JSON.stringify(isDarkMode));
  }, [isDarkMode]);
   
// Автоматический сброс счетчиков при открытии чата
useEffect(() => {
  if (!activeChatId) return;
  
  // ✅ Обнуляем счетчик в unreadCounts для активного чата
  setUnreadCounts(prev => ({
    ...prev,
    [activeChatId]: 0
  }));
  
  if (activeChatId.startsWith('channel_')) {
    const channelDbId = Number(activeChatId.replace('channel_', ''));
    
    setChannels(prevChannels => 
      prevChannels.map(channel => {
        if (Number(channel.id) === channelDbId) {
          return { ...channel, unreadCount: 0 };
        }
        return channel;
      })
    );
  } 
  else {
    setChats(prevChats => 
      prevChats.map(chat => {
        if (chat.id === activeChatId) {
          return { ...chat, unreadCount: 0 };
        }
        return chat;
      })
    );
  }
  
  if (socketRef.current && socketRef.current.connected) {
    socketRef.current.emit('read_messages', { 
      activeChatId, 
      currentUserId: user?.id 
    });
  }
}, [activeChatId]);

useEffect(() => {
  if (!activeChatId || !activeChatId.startsWith('channel_')) return;
  
  const channelDbId = Number(activeChatId.replace('channel_', ''));
  
  setChannels(prevChannels => {
    const updated = prevChannels.map(channel => {
      if (Number(channel.id) === channelDbId) {
        console.log(`🔄 Сбрасываю счетчик канала ${channel.name} с ${channel.unreadCount} на 0`);
        return { ...channel, unreadCount: 0 };
      }
      return channel;
    });
    
    return updated;
  });
  
  if (socketRef.current && socketRef.current.connected) {
    socketRef.current.emit('read_messages', { 
      activeChatId, 
      currentUserId: user?.id 
    });
  }
}, [activeChatId, user?.id]);

  useEffect(() => { 
    setIsProfileOpen(false); 
  }, [activeChatId]);

 const handleDeleteMessage = (msgId) => {
  if (socketRef.current) {
    console.log('🗑️ Удаление сообщения:', msgId, 'в чате:', activeChatId);
    socketRef.current.emit('delete_message', { 
      messageId: msgId, 
      activeChatId: activeChatId 
    });
  } else {
    console.error('❌ Сокет не подключен');
    alert('Ошибка: сокет не подключен');
  }
};
// ==========================================
// 🔄 СИНХРОНИЗАЦИЯ МЕЖДУ ВКЛАДКАМИ
// ==========================================
useEffect(() => {
  const handleStorageChange = (e) => {
    if (e.key === 'unread_counts') {
      try {
        const newCounts = JSON.parse(e.newValue);
        setUnreadCounts(newCounts);
        console.log('🔄 Обновлены непрочитанные из другой вкладки:', newCounts);
      } catch (error) {
        console.error('Ошибка синхронизации:', error);
      }
    }
  };

  window.addEventListener('storage', handleStorageChange);
  return () => window.removeEventListener('storage', handleStorageChange);
}, []);

  const formatMsgTime = (dateString) => {
    if (!dateString) return '';
    try {
      const d = new Date(dateString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  // Стейты для контроля пагинации истории
  const [hasMoreHistory, setHasMoreHistory] = useState(true);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const lastFetchedChatId = useRef(null);

  /// =========================================================================
  // 📥 УНИВЕРСАЛЬНАЯ ФУНКЦИЯ ПОДГРУЗКИ ИСТОРИИ
  // =========================================================================
  const fetchChatHistory = async (chatId, isLoadMore = false) => {
  if (isHistoryLoading) return;
  if (isLoadMore && !hasMoreHistory) return;
  if (!isLoadMore && lastFetchedChatId.current === chatId && messages && messages.length > 0) {
    return;
  }

  setIsHistoryLoading(true);
  
  if (!isLoadMore) {
    lastFetchedChatId.current = chatId;
  }

  try {
    const token = authState.token;
    const authHeaders = { 'Authorization': `Bearer ${token}` };
    
    let url = `${API_BASE_URL}/api/messages?activeChatId=${chatId}`;
    if (isLoadMore && messages && messages.length > 0) {
      const currentChatMsgs = messages.filter(m => {
        if (!m) return false;
        if (chatId === 'chat_general') return !m.receiverId && !m.channelId;
        if (chatId.startsWith('channel_')) return Number(m.channelId) === Number(chatId.replace('channel_', ''));
        if (chatId.startsWith('user_')) {
          const targetId = Number(chatId.replace('user_', ''));
          const myId = Number(authState.user.id);
          return (!m.channelId && ((Number(m.senderId) === myId && Number(m.receiverId) === targetId) || 
                                   (Number(m.senderId) === targetId && Number(m.receiverId) === myId)));
        }  if (chatId.startsWith('chat_')) {
        return Number(m.chatId) === Number(chatId.replace('chat_', ''));
         } return true;
      });

      if (currentChatMsgs.length > 0) {
        const oldestMessageId = Math.min(...currentChatMsgs.map(m => Number(m.id)));
        url += `&cursorMessageId=${oldestMessageId}`;
      }
    }

    const res = await fetch(url, { headers: authHeaders });
    if (!res.ok) throw new Error('Ошибка при подгрузке сообщений');
    
    const data = await res.json();

    const rawMessages = Array.isArray(data) ? data : (data?.messages || data?.newMessages);
    const safeNewMessages = Array.isArray(rawMessages) ? rawMessages : [];

    if (!Array.isArray(rawMessages)) {
      console.error("🚨 Критическая ошибка бэкенда! Сервер вернул ошибку вместо массива:", data);
    }

if (!isLoadMore) {
  setMessages(prev => {
    const safePrev = Array.isArray(prev) ? prev : [];
    const otherChatsMsgs = safePrev.filter(m => {
      if (!m) return false;
      if (chatId === 'chat_general') return m.receiverId || m.channelId;
      if (chatId.startsWith('channel_')) return Number(m.channelId) !== Number(chatId.replace('channel_', ''));
      if (chatId.startsWith('user_')) {
        const targetId = Number(chatId.replace('user_', ''));
        const myId = authState?.user?.id ? Number(authState.user.id) : 0;
        const isDirect = (Number(m.senderId) === myId && Number(m.receiverId) === targetId) || 
                         (Number(m.senderId) === targetId && Number(m.receiverId) === myId);
        return !isDirect || m.channelId;
      }
      return true;
    });
    const sortedNewMessages = [...safeNewMessages].sort((a, b) => 
      new Date(a.createdAt) - new Date(b.createdAt)
    );
    return [...otherChatsMsgs, ...sortedNewMessages];
  });
}

    if (safeNewMessages.length === 0) {
      setHasMoreHistory(false);
    } else {
      setHasMoreHistory(!!(data && data.hasMore));
    }

    console.log(`📥 Успешно подгружено порцией: ${safeNewMessages.length} сообщений. Есть ещё в БД? ${safeNewMessages.length === 0 ? false : !!(data && data.hasMore)}`);

  } catch (err) {
    console.error('Ошибка пагинации истории на фронтенде:', err);
  } finally {
    setIsHistoryLoading(false);
  }
};

  // =========================================================================
  // 🔄 ПЕРЕКЛЮЧЕНИЕ ЧАТА
  // =========================================================================
const handleSelectChat = async (chatId) => {
  lastFetchedChatId.current = null;
  setHasMoreHistory(true);
  if (!chatId) return;
  
  console.log("=== Переключение чата на ID:", chatId);
  setActiveChatId(chatId);
  setActiveChatData(null); 
  setHasMoreHistory(true);

  const stringChatId = chatId.toString();

  // ==========================================
  // ✅ ОТМЕЧАЕМ КАК ПРОЧИТАННОЕ И ОБНУЛЯЕМ СЧЕТЧИК
  // ==========================================
  if (stringChatId.startsWith('channel_')) {
    const cleanId = stringChatId.replace('channel_', '');
    await markAsRead('channel', cleanId);
    setUnreadCounts(prev => ({
      ...prev,
      [`channel_${cleanId}`]: 0
    }));
  } else if (stringChatId.startsWith('chat_')) {
    const cleanId = stringChatId.replace('chat_', '');
    await markAsRead('chat', cleanId);
    setUnreadCounts(prev => ({
      ...prev,
      [stringChatId]: 0
    }));
  } else if (stringChatId.startsWith('user_')) {
    const cleanId = stringChatId.replace('user_', '');
    await markAsRead('private', cleanId);
    setUnreadCounts(prev => ({
      ...prev,
      [stringChatId]: 0
    }));
  }

  // ==========================================
  // 2. Обработка публичных каналов
  // ==========================================
  if (stringChatId.startsWith('channel_')) {
    const cleanChannelId = stringChatId.replace('channel_', '');
    
    console.log(`📢 Выбран канал: ${cleanChannelId}`);
    
    const currentChannel = channels.find(ch => 
      ch && ch.id && Number(ch.id) === Number(cleanChannelId)
    );
    
    console.log('🔍 Найденный канал:', currentChannel);
    
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
        type: 'channel',
        creatorId: null 
      });
    }
    
    fetchChatHistory(stringChatId);
    return;
  }

  // ==========================================
  // 3. Обработка приватных чатов
  // ==========================================
  if (stringChatId.startsWith('user_')) {
    const cleanUserId = stringChatId.replace('user_', '');
    
    let targetUser = chats.find(c => {
      if (!c || !c.id) return false;
      return c.id.toString().replace('user_', '') === cleanUserId;
    });

    if (targetUser) {
      setActiveChatData({
        name: targetUser.name,
        avatar: targetUser.avatar || '👤',
        type: 'private',
        dbId: targetUser.dbId
      });
    } else {
      setActiveChatData({
        name: `Пользователь #${cleanUserId}`,
        avatar: '👤',
        type: 'private',
        dbId: Number(cleanUserId)
      });
    }
    
    fetchChatHistory(stringChatId);
    return;
  }

  // ==========================================
  // 4. Обработка групповых чатов
  // ==========================================
  if (stringChatId.startsWith('chat_')) {
    const cleanChatId = stringChatId.replace('chat_', '');
    
    const currentChat = groupChats.find(c => c.id === stringChatId);
    if (currentChat) {
      setActiveChatData({
        name: currentChat.name,
        avatar: currentChat.avatar || '💬',
        type: 'group',
        creatorId: currentChat.creatorId,
        members: currentChat.members || []
      });
    } else {
      setActiveChatData({
        name: `Чат #${cleanChatId}`,
        avatar: '💬',
        type: 'group'
      });
    }
    
    fetchChatHistory(stringChatId);
    return;
  }
};

  // =========================================================================
  // 🔍 ФИЛЬТРАЦИЯ ИСТОРИИ ДЛЯ АКТИВНОГО ЧАТА
  // =========================================================================
 const getActiveChatMessages = () => {
  if (!activeChatId) return [];
  
  if (activeChatId === 'chat_general') {
    const filtered = messages.filter(m => !m.channelId && !m.receiverId);
    return filtered;
  }
  
  if (activeChatId.startsWith('channel_')) {
    const channelDbId = Number(activeChatId.replace('channel_', ''));
    const filtered = messages.filter(m => Number(m.channelId) === channelDbId);
    return filtered;
  }
  
  if (activeChatId.startsWith('user_')) {
    const targetUserId = Number(activeChatId.replace('user_', ''));
    const filtered = messages.filter(m => 
      !m.channelId && (
        (Number(m.senderId) === Number(user?.id) && Number(m.receiverId) === targetUserId) ||
        (Number(m.senderId) === targetUserId && Number(m.receiverId) === Number(user?.id))
      )
    );
    return filtered;
  }

  if (activeChatId.startsWith('chat_')) {
    const chatDbId = Number(activeChatId.replace('chat_', ''));
    const filtered = messages.filter(m => Number(m.chatId) === chatDbId);
    return filtered;
  }

  return [];
};

const activeChat = {
  id: activeChatId,
  messages: getActiveChatMessages(),
  name: activeChatId 
    ? (activeChatData?.name || 'Чат') 
    : 'Чат не выбран',
  type: activeChatId?.startsWith('channel_') ? 'channel' : 
         activeChatId?.startsWith('user_') ? 'private' : 
         activeChatId?.startsWith('chat_') ? 'group' : null,
  creatorId: activeChatData?.creatorId || null,
  avatar: activeChatData?.avatar || '💬',
  members: activeChatData?.members || []
};

  // =========================================================================
  // ✉️ ОТПРАВКА СООБЩЕНИЙ
  // =========================================================================
  const handleSendMessage = (e) => {
    if (e) e.preventDefault();
    const text = inputValue.trim();
    if (!text) return;

    const messageData = {
      text: text,
      mediaUrl: null,
      mediaType: null,
      activeChatId: activeChatId 
    };
    
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('send_message', messageData);
      socketRef.current.emit('stop_typing', { activeChatId });
    }

    setInputValue('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault(); 
      handleSendMessage(e); 
    }
  };

  const handleSendImage = (urlFromMulter) => {
    const messageData = {
      text: null,
      mediaUrl: urlFromMulter, 
      mediaType: 'image',
      activeChatId: activeChatId
    };
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('send_message', messageData);
    }
  };

  const handleSendAudio = (audioUrl) => {
    const messageData = {
      text: null,
      mediaUrl: audioUrl,
      mediaType: 'audio',
      activeChatId: activeChatId
    };
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('send_message', messageData);
    }
  };

 const handleLogout = () => {
  if (socketRef.current) {
    socketRef.current.disconnect();
    socketRef.current = null;
  }
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  setUser(null);
  setMessages([]);
  setActiveChatId(null);
};

  if (!user) {
    return <Auth onAuthSuccess={(userData, tokenData) => {
      localStorage.setItem('token', tokenData);
      localStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);
    }} apiBaseUrl={API_BASE_URL} />;
  }

  const chatsWithMessages = chats.map(chat => {
    let chatMessages = [];

    if (chat.id === "chat_general") {
      chatMessages = messages.filter(m => m && m.receiverId === null && !m.channelId);
    } else if (chat.id?.startsWith("user_")) {
      const targetUserId = Number(chat.id.replace('user_', ''));
      chatMessages = messages.filter(m => 
        m && !m.channelId && (
          (Number(m.senderId) === Number(user.id) && Number(m.receiverId) === targetUserId) ||
          (Number(m.senderId) === targetUserId && Number(m.receiverId) === Number(user.id))
        )
      );
    }

    const mappedMessages = chatMessages.map(m => 
      m && m.text === "Сообщение удалено" ? { ...m, isDeleted: true } : m
    );

    return { ...chat, messages: mappedMessages };
  });

  const filteredChats = chatsWithMessages.filter(c => 
    c && c.name && c.name.toLowerCase().includes(searchQuery.toLowerCase())
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
          groupChats={groupChats} 
          onSelectChat={handleSelectChat}
          onCreateChannel={handleCreateChannel}
          onCreateGroupChat={handleCreateGroupChat}
          unreadCounts={unreadCounts}
          onMarkAsRead={markAsRead}
        />
        
        <ChatArea 
          key={activeChatId || 'no-chat'} 
          activeChatId={activeChatId} 
          activeChat={activeChat} 
          activeChatData={activeChatData} 
          messages={getActiveChatMessages()} 
          setActiveChatId={setActiveChatId} 
          inputValue={inputValue} 
          setInputValue={setInputValue} 
          handleSendMessage={handleSendMessage} 
          messagesEndRef={messagesEndRef} 
          socketRef={socketRef}
          typingUser={typingUser} 
          onDeleteMessage={handleDeleteMessage} 
          onSendImage={handleSendImage} 
          onSendAudio={handleSendAudio} 
          onToggleProfile={() => setIsProfileOpen(!isProfileOpen)} 
          currentUserId={user?.id} 
          handleKeyDown={handleKeyDown}
          apiBaseUrl={API_BASE_URL}
          onLoadMoreHistory={() => fetchChatHistory(activeChatId, true)}
          hasMoreHistory={hasMoreHistory}
          isHistoryLoading={isHistoryLoading}
          setMessages={setMessages}
          onMarkAsRead={markAsRead}
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