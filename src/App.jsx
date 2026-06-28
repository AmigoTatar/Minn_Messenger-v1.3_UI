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
  const [activeChatId, setActiveChatId] = useState('GENERAL');
  const [activeChatData, setActiveChatData] = useState({ name: 'Общий чат', avatar: '💬', type: 'general' });
  const [searchQuery, setSearchQuery] = useState('');
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

        // Запрашиваем пользователей (/api/users) вместо /api/chats
        const [usersResponse, channelsResponse] = await Promise.all([
          fetch(`${API_BASE_URL}/api/users`, { headers }),
          fetch(`${API_BASE_URL}/api/channels`, { headers })
        ]);

if (usersResponse.ok) {
  const usersData = await usersResponse.json();
  const usersArray = Array.isArray(usersData) ? usersData : [];
  
  // Проверяем, есть ли уже Общий чат в данных
  const hasGeneral = usersArray.some(u => u.id === 'chat_general' || u.id === 'general');
  
  if (!hasGeneral) {
    // Добавляем Общий чат в начало
    setChats([
      {
        id: 'chat_general',
        name: 'Общий чат',
        avatar: '💬',
        unreadCount: 0,
        isGeneral: true
      },
      ...usersArray
    ]);
  } else {
    setChats(usersArray);
  }


        } else {
          console.error('Не удалось загрузить пользователей:', usersResponse.statusText);
        }

        if (channelsResponse.ok) {
          const channelsData = await channelsResponse.json();
          setChannels(Array.isArray(channelsData) ? channelsData : []);
        } else {
          console.error('Не удалось загрузить каналы:', channelsResponse.statusText);
        }

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
  socket.emit('join_chat', `user_${user.id}`);
  socket.emit('join_chat', activeChatIdRef.current);
  
  if (channels && channels.length > 0) {
    console.log(`📢 Подписываюсь на ${channels.length} каналов:`, channels.map(c => c.name));
    channels.forEach(channel => {
      console.log(`🔗 Подписываюсь на канал: channel_${channel.id} (${channel.name})`);
      socket.emit('join_chat', `channel_${channel.id}`);
    });
  }
});

socket.on('connect_error', (error) => {
  console.error('❌ Ошибка подключения к сокету:', error);
});

socket.on('disconnect', (reason) => {
  console.log('🔌 Сокет отключен:', reason);
  if (reason === 'io server disconnect') {
    // reconnect
    socket.connect();
  }
});

// Добавьте это сразу после socket.on('connect')
socket.onAny((event, ...args) => {
  console.log(`🔌 Событие сокета: ${event}`, args);
});


    const typingTimerRef = { current: null };


    // === 1. СЛУШАТЕЛЬ НОВЫХ СООБЩЕНИЙ ===
socket.on('receive_message', (newMessage) => {
  console.log(`📩 Получено сообщение:`, newMessage);
  
  if (processedMessagesCache.has(newMessage.id)) return; 
  processedMessagesCache.add(newMessage.id);

  setMessages((prev) => {
    const safePrev = Array.isArray(prev) ? prev : [];
    if (safePrev.some((msg) => msg && msg.id === newMessage.id)) return safePrev;
    return [...safePrev, newMessage];
  });

  const currentUserId = Number(user?.id);
  const msgSenderId = Number(newMessage.senderId);
  const msgReceiverId = Number(newMessage.receiverId);

  // 🔍 РАСШИРЕННЫЙ ЛОГ
  console.log(`🔍 Анализ сообщения:`, {
    senderId: msgSenderId,
    receiverId: msgReceiverId,
    channelId: newMessage.channelId,
    currentUserId: currentUserId,
    activeChatId: activeChatIdRef.current
  });

  const incomingChatId = newMessage.channelId
    ? `channel_${newMessage.channelId}`
    : newMessage.receiverId 
      ? (msgSenderId === currentUserId ? `user_${msgReceiverId}` : `user_${msgSenderId}`)
      : 'chat_general';

  console.log(`🏷️ incomingChatId = ${incomingChatId}`);

  if (incomingChatId !== activeChatIdRef.current) {
    console.log(`🔔 Сообщение не в активном чате, увеличиваю счетчик для ${incomingChatId}`);
    
    if (incomingChatId.startsWith('channel_')) {
      const channelDbId = Number(newMessage.channelId);
      console.log(`📨 Новое сообщение в канале ${channelDbId}, увеличиваю unreadCount`);
      
      setChannels(prevChannels => {
        const updated = prevChannels.map(channel => {
          if (Number(channel.id) === channelDbId) {
            const newCount = (channel.unreadCount || 0) + 1;
            console.log(`📊 Канал ${channel.name}: unreadCount стал ${newCount}`);
            return { ...channel, unreadCount: newCount };
          }
          return channel;
        });
        console.log(`📊 Обновленные каналы:`, updated.map(c => ({ name: c.name, unreadCount: c.unreadCount })));
        return updated;
      });
} else if (incomingChatId === 'chat_general') {
  console.log(`📨 Новое сообщение в Общем чате`);
  
  setChats(prevChats => {
    // Проверяем, есть ли Общий чат в текущем массиве
    const generalChatIndex = prevChats.findIndex(c => c.id === 'chat_general' || c.id === 'general');
    
    if (generalChatIndex === -1) {
      // Если Общего чата нет - создаём его
      console.log(`📊 Создаю Общий чат в массиве chats`);
      const newGeneralChat = {
        id: 'chat_general',
        name: 'Общий чат',
        avatar: '💬',
        unreadCount: 1,
        isGeneral: true
      };
      return [newGeneralChat, ...prevChats];
    } else {
      // Если есть - увеличиваем счетчик
      const updated = [...prevChats];
      updated[generalChatIndex] = {
        ...updated[generalChatIndex],
        unreadCount: (updated[generalChatIndex].unreadCount || 0) + 1
      };
      console.log(`📊 Общий чат: unreadCount стал ${updated[generalChatIndex].unreadCount}`);
      return updated;
    }
  });
} else {
      console.log(`📨 Новое сообщение в приватном чате ${incomingChatId}`);
      setChats(prevChats => prevChats.map(chat => {
        if (chat.id === incomingChatId) {
          const newCount = (chat.unreadCount || 0) + 1;
          console.log(`📊 Чат ${chat.name}: unreadCount стал ${newCount}`);
          return { ...chat, unreadCount: newCount };
        }
        return chat;
      }));
    }
  } else {
    console.log(`✅ Сообщение в активном чате, счетчик не увеличиваю`);
  }
});
    // === 2. СЛУШАТЕЛЬ СОЗДАНИЯ КАНАЛОВ ===
    socket.on('channel_created', (newChannel) => {
      setChannels((prev) => {
        if (prev.some(ch => ch.id === newChannel.id)) return prev;
        return [...prev, newChannel];
      });
    });

    // === 3. СЛУШАТЕЛЬ УДАЛЕНИЯ СООБЩЕНИЙ ===
    socket.on('message_deleted', ({ messageId }) => {
      setMessages(prev => 
        (prev || []).map(m => m.id === Number(messageId) ? { ...m, text: "Сообщение удалено", isDeleted: true } : m)
      );
    });

    // === 4. СЛУШАТЕЛЬ СТАТУСА ПЕЧАТАНИЯ ===
    socket.on('typing', ({ senderId, isGeneral }) => {
      setTypingUser({ senderId, isGeneral });
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => {
        setTypingUser(null);
      }, 2500);
    });

    // === 5. СЛУШАТЕЛЬ ОБНОВЛЕНИЯ СТАТУСА ПРОЧТЕНИЯ ===
    socket.on('messages_read_update', ({ activeChatId: readChatId, readerId }) => {
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
    if (activeChatId.startsWith('channel_')) {
      const channelDbId = Number(activeChatId.replace('channel_', ''));
      localStorage.setItem('last_view_channel_ID', activeChatId);
      setChannels(prevChannels => prevChannels.map(channel => {
        if (Number(channel.id) === channelDbId) return { ...channel, unreadCount: 0 };
        return channel;
      }));
    } else {
      setChats(prevChats => prevChats.map(chat => {
        if (chat.id === activeChatId) return { ...chat, unreadCount: 0 };
        return chat;
      }));
    }

    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('read_messages', { 
        activeChatId, 
        currentUserId: user?.id 
      });
    }
  }, [activeChatId, user]);

  useEffect(() => { 
    setIsProfileOpen(false); 
  }, [activeChatId]);

  const handleDeleteMessage = (msgId) => {
    if (socketRef.current) {
      socketRef.current.emit('delete_message', { 
        messageId: msgId, 
        activeChatId: activeChatId 
      });
    }
  };

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
    // Реф для предотвращения бесконечного спама истории по кругу при перерендерах
  const lastFetchedChatId = useRef(null);

  /// =========================================================================
  // 📥 УНИВЕРСАЛЬНАЯ ФУНКЦИЯ ПОДГРУЗКИ ИСТОРИИ (БЕЗ ЛАВИННЫХ ЗАПРОСОВ И КРАШЕЙ)
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
        }
        return true;
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

    if (isLoadMore) {
      setMessages(prev => {
        const safePrev = Array.isArray(prev) ? prev : [];
        const filteredNew = safeNewMessages.filter(nm => nm && !safePrev.some(pm => pm && pm.id === nm.id));
        return [...filteredNew, ...safePrev];
      });
    } else {
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
        return [...otherChatsMsgs, ...safeNewMessages];
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
    // 🆕 Сбрасываем isPositioning после загрузки
    
  }
};


  // =========================================================================
  // 🔄 ПЕРЕКЛЮЧЕНИЕ ЧАТА С СЕРВЕРНЫМ БЭКАП-ЗАПРОСОМ ПОЛЬЗОВАТЕЛЯ
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

    // 1. Обработка Общего чата
    if (stringChatId === 'chat_general') {
      setActiveChatData({ name: 'Общий чат', avatar: '💬', type: 'general' });
      fetchChatHistory('chat_general');
      return;
    }

    // 2. Обработка публичных каналов
    if (stringChatId.startsWith('channel_')) {
      const cleanChannelId = stringChatId.replace('channel_', '');
      
      setChannels(prev => prev.map(ch => 
        Number(ch.id) === Number(cleanChannelId) ? { ...ch, unreadCount: 0 } : ch
      ));

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
        setActiveChatData({ name: `Канал #${cleanChannelId}`, avatar: '📢', type: 'channel' });
      }
      
      fetchChatHistory(stringChatId);
      return;
    }

    // 3. Обработка приватных чатов (user_ID)
    if (stringChatId.startsWith('user_')) {
      const cleanUserId = stringChatId.replace('user_', '');
      
      setChats(prev => prev.map(c => 
        c.id === stringChatId ? { ...c, unreadCount: 0 } : c
      ));

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
    }
  };

  // =========================================================================
  // 🔍 ОПТИМИЗИРОВАННАЯ ФИЛЬТРАЦИЯ ИСТОРИИ ДЛЯ АКТИВНОГО ЧАТА
  // =========================================================================
  const getActiveChatMessages = () => {
    if (!activeChatId) return [];
    
    if (activeChatId === 'chat_general') {
      return messages.filter(m => !m.channelId && !m.receiverId);
    }
    
    if (activeChatId.startsWith('channel_')) {
      const channelDbId = Number(activeChatId.replace('channel_', ''));
      return messages.filter(m => Number(m.channelId) === channelDbId);
    }
    
    if (activeChatId.startsWith('user_')) {
      const targetUserId = Number(activeChatId.replace('user_', ''));
      return messages.filter(m => 
        !m.channelId && (
          (Number(m.senderId) === Number(user?.id) && Number(m.receiverId) === targetUserId) ||
          (Number(m.senderId) === targetUserId && Number(m.receiverId) === Number(user?.id))
        )
      );
    }

    return [];
  };

  const activeChat = {
    id: activeChatId,
    messages: getActiveChatMessages(),
    name: activeChatId 
      ? (activeChatId === 'chat_general' ? 'Общий чат' : activeChatData?.name || 'Чат') 
      : 'Чат не выбран',
    type: activeChatId?.startsWith('channel_') ? 'channel' : 'user'
  };
  // =========================================================================
  // ✉️ ОТПРАВКА СООБЩЕНИЙ И МЕДИАФАЙЛОВ
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
    setActiveChatId("chat_general");
  };

  if (!user) {
    return <Auth onAuthSuccess={(userData, tokenData) => {
      localStorage.setItem('token', tokenData);
      localStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);
    }} apiBaseUrl={API_BASE_URL} />;
  }
  // Распределение истории сообщений по комнатам сайдбара
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
          onSelectChat={handleSelectChat}
          onCreateChannel={handleCreateChannel}
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
