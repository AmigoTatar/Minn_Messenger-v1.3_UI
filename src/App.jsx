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
  // 🎵 ЗВУК УВЕДОМЛЕНИЯ (простой и надежный)
  const playSound = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      
      // Короткий "динь"
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 1000;
      osc.type = 'sine';
      gain.gain.value = 0.1;
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } catch(e) {}
  };

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
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [groupChatsVersion, setGroupChatsVersion] = useState(0);
  
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

// Эффект для горячих клавиш
useEffect(() => {
  const handleKeyDown = (e) => {
    // Ctrl+K или Cmd+K
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      setIsSearchOpen(true);
    }
    // Esc для закрытия
    if (e.key === 'Escape' && isSearchOpen) {
      setIsSearchOpen(false);
    }
  };
  
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [isSearchOpen]);

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

        if (response.status === 429) {
            console.log('⏳ Слишком много запросов на прочтение, подождите');
            return;
        }

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ Ошибка ${response.status}:`, errorText);
            throw new Error(`Server error: ${response.status}`);
        }

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
    
    const newChannel = await response.json();
    console.log('✅ Канал создан:', newChannel);
    
    // ✅ ПОДПИСЫВАЕМСЯ НА НОВЫЙ КАНАЛ
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('join_chat', `channel_${newChannel.id}`);
      console.log(`🔗 Подписался на новый канал: channel_${newChannel.id}`);
    }
    
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
    
    const chatId = `chat_${newChat.dbId || newChat.id}`;
    
    // ✅ ТОЛЬКО ПОДПИСЫВАЕМСЯ
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('join_chat', chatId);
      console.log(`🔗 Подписался на новый чат через сокет: ${chatId}`);
    }
    
    // ✅ ПЕРЕКЛЮЧАЕМСЯ (без ручного добавления)
    handleSelectChat(chatId, newChat);
    
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
    
    // ✅ 1. СНАЧАЛА ПОДПИСЫВАЕМСЯ НА СВОЙ ПРИВАТНЫЙ ЧАТ
    socket.emit('join_chat', `user_${user.id}`);
    console.log(`📌 Подписался на user_${user.id}`);
    
    // ✅ 2. ЕСЛИ ЕСТЬ АКТИВНЫЙ ЧАТ - ПОДПИСЫВАЕМСЯ НА НЕГО
    if (activeChatIdRef.current) {
        socket.emit('join_chat', activeChatIdRef.current);
        console.log(`📌 Подписался на активный чат: ${activeChatIdRef.current}`);
    }
    
// ✅ 3. ЗАГРУЖАЕМ ДАННЫЕ И ПОДПИСЫВАЕМСЯ НА ВСЕ ЧАТЫ
const subscribeToAllChats = async () => {
    try {
        const token = localStorage.getItem('token');
        const headers = { 'Authorization': `Bearer ${token}` };
        
        // Загружаем все чаты заново
        const [usersResponse, channelsResponse, groupChatsResponse] = await Promise.all([
            fetch(`${API_BASE_URL}/api/users`, { headers }),
            fetch(`${API_BASE_URL}/api/channels`, { headers }),
            fetch(`${API_BASE_URL}/api/chats`, { headers })
        ]);
        
        // ✅ ОБРАБАТЫВАЕМ usersResponse ОДИН РАЗ
        let usersArray = [];
        if (usersResponse.ok) {
            usersArray = await usersResponse.json();
            usersArray = Array.isArray(usersArray) ? usersArray : [];
            setChats(usersArray);
            console.log('👤 Загружены пользователи:', usersArray.length);
        }
        
        // ✅ ОБРАБАТЫВАЕМ channelsResponse
        if (channelsResponse.ok) {
            const channelsData = await channelsResponse.json();
            console.log('📢 Загружены каналы:', channelsData.length);
            setChannels(channelsData);
            
            // ✅ ПОДПИСЫВАЕМСЯ НА ВСЕ КАНАЛЫ
            channelsData.forEach(channel => {
                socket.emit('join_chat', `channel_${channel.id}`);
                console.log(`🔗 Подписался на канал: ${channel.name} (channel_${channel.id})`);
            });
        }
        
        // ✅ ОБРАБАТЫВАЕМ groupChatsResponse
        if (groupChatsResponse.ok) {
            const groupChatsData = await groupChatsResponse.json();
            console.log('👥 Загружены групповые чаты:', groupChatsData.length);
            setGroupChats(groupChatsData);
            
            // ✅ ПОДПИСЫВАЕМСЯ НА ВСЕ ГРУППОВЫЕ ЧАТЫ
            groupChatsData.forEach(chat => {
                socket.emit('join_chat', chat.id);
                console.log(`🔗 Подписался на групповой чат: ${chat.name} (${chat.id})`);
            });
        }
        
        // ✅ ПОДПИСЫВАЕМСЯ НА ВСЕ ПРИВАТНЫЕ ЧАТЫ (используем уже загруженные данные)
        usersArray.forEach(chat => {
            if (chat.id !== 'chat_general' && !chat.id?.startsWith('channel_')) {
                socket.emit('join_chat', chat.id);
                console.log(`🔗 Подписался на приватный чат: ${chat.name} (${chat.id})`);
            }
        });
        
        // ✅ ЗАГРУЖАЕМ НЕПРОЧИТАННЫЕ
        await fetchUnreadCounts();
        
        console.log('✅ Все чаты загружены и подписки выполнены!');
        
    } catch (error) {
        console.error('❌ Ошибка загрузки чатов:', error);
    }
};

// Запускаем через 500мс, чтобы дать время инициализироваться
setTimeout(() => {
    subscribeToAllChats();
}, 500);
});

socket.on('connect_error', (error) => {
    console.error('❌ Ошибка подключения к сокету:', error);
});

socket.onAny((event, ...args) => {
    // Логируем ВСЕ события для отладки
    if (event === 'channel_deleted' || event === 'chat_deleted' || 
        event === 'chat_member_removed' || event === 'channel_member_removed' ||
        event === 'chat_created' || event === 'channel_created') {
        console.log(`🔴🔴🔴 [onAny] СОБЫТИЕ: ${event}`, JSON.stringify(args, null, 2));
    }
});
socket.on('disconnect', (reason) => {
    // console.log('🔌 Сокет отключен:', reason);
    if (reason === 'io server disconnect') {
        socket.connect();
    }
});

const typingTimerRef = { current: null };





// === 1. СЛУШАТЕЛЬ НОВЫХ СООБЩЕНИЙ ===
socket.on('receive_message', async (newMessage) => {
  console.log(`📩 Получено сообщение:`, newMessage);
  
  // ✅ ПРОВЕРКА: НЕ БЫЛО ЛИ ЭТО СООБЩЕНИЕ УДАЛЕНО
  // Если сообщение уже есть в стейте и помечено как удаленное — игнорируем обновление
  setMessages(prev => {
    // Проверяем, есть ли уже такое сообщение в стейте
    const existingMsg = prev.find(msg => msg && msg.id === newMessage.id);
    
    // Если сообщение уже есть и оно удалено — НЕ обновляем его
    if (existingMsg && existingMsg.isDeleted === true) {
      console.log(`⚠️ Сообщение ${newMessage.id} было удалено, игнорирую обновление`);
      return prev;
    }
    
    // Если сообщение уже есть — не добавляем дубликат
    if (prev.some((msg) => msg && msg.id === newMessage.id)) {
      console.log(`⚠️ Сообщение ${newMessage.id} уже есть в массиве`);
      return prev;
    }
    
    const newArray = [...prev, newMessage];
    console.log(`✅ Сообщение добавлено, теперь ${newArray.length} сообщений`);
    return newArray;
  });
  
  // 🔕 ПРОВЕРЯЕМ, НЕ ЗАМУЧЕН ЛИ ЧАТ (через API)
  let isChatMuted = false;
  
  // Определяем ID чата
  let chatId = null;
  let chatType = null;
  let chatIdValue = null;
  
  if (newMessage.channelId) {
    chatId = `channel_${newMessage.channelId}`;
    chatType = 'channel';
    chatIdValue = newMessage.channelId;
  } else if (newMessage.chatId) {
    chatId = `chat_${newMessage.chatId}`;
    chatType = 'chat';
    chatIdValue = newMessage.chatId;
  } else if (newMessage.receiverId && newMessage.senderId) {
    const currentUserId = Number(user?.id);
    chatId = Number(newMessage.senderId) === currentUserId 
      ? `user_${newMessage.receiverId}` 
      : `user_${newMessage.senderId}`;
    chatType = 'private';
    chatIdValue = Number(newMessage.senderId) === currentUserId 
      ? newMessage.receiverId 
      : newMessage.senderId;
  }
  
  // 🔕 ПРОВЕРЯЕМ СТАТУС MUTE ЧЕРЕЗ API
  if (chatType && chatIdValue) {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${API_BASE_URL}/api/mute-status?type=${chatType}&id=${chatIdValue}`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      if (response.ok) {
        const data = await response.json();
        isChatMuted = data.muted;
        console.log(`🔕 Статус mute для ${chatId}: ${isChatMuted}`);
      }
    } catch (error) {
      console.error('Ошибка проверки mute:', error);
    }
  }
  
  // 🔕 ВОСПРОИЗВОДИМ ЗВУК ТОЛЬКО ЕСЛИ НЕ В РЕЖИМЕ "НЕ БЕСПОКОИТЬ"
  if (!isChatMuted && String(newMessage.senderId) !== String(user?.id)) {
    playSound();
  }
  
  
  
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
      let chatId = chat.dbId || chat.id;
      if (typeof chatId === 'string' && chatId.startsWith('chat_')) {
        chatId = chatId.replace('chat_', '');
      }
      if (Number(chatId) === Number(newMessage.chatId)) {
        console.log(`✅ Обновляю lastMessage для чата: ${chat.name}`);
        return { ...chat, lastMessage: newMessage };
      }
      return chat;
    }));
  }

  // ==========================================
  // 🛡️ ЗАЩИТА: если поля потерялись при передаче
  // ==========================================
  
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
    console.log('📢 Создан новый канал:', newChannel);
    setChannels(prev => {
        if (prev.some(ch => ch.id === newChannel.id)) return prev;
        return [...prev, newChannel];
    });
    
    // ✅ ПОДПИСЫВАЕМСЯ НА НОВЫЙ КАНАЛ
    socket.emit('join_chat', `channel_${newChannel.id}`);
    console.log(`🔗 Подписался на новый канал: channel_${newChannel.id}`);
});
// === СЛУШАТЕЛЬ СОЗДАНИЯ ГРУППОВОГО ЧАТА ===
socket.on('chat_created', (newChat) => {
    console.log('👥 Создан новый групповой чат:', newChat);
    
    // ✅ НОРМАЛИЗУЕМ ID И СОХРАНЯЕМ УЧАСТНИКОВ
    const normalizedChat = {
        ...newChat,
        id: `chat_${newChat.id}`,
        dbId: newChat.id,
        members: newChat.members || []  // ← ЭТО ВАЖНО!
    };
    
    setGroupChats(prev => {
        if (prev.some(ch => ch.id === normalizedChat.id)) return prev;
        return [...prev, normalizedChat];
    });
    
    // Подписываемся на новый чат
    const chatId = `chat_${newChat.id}`;
    socket.emit('join_chat', chatId);
    console.log(`🔗 Подписался на новый групповой чат: ${chatId}`);
});

// === ОБНОВЛЕНИЕ ПОЛЬЗОВАТЕЛЯ (имя, аватар) ===
socket.on('user_updated', (data) => {
    console.log('👤 Обновлён пользователь:', data);
    
    // ✅ ЕСЛИ ЭТО ТЕКУЩИЙ ПОЛЬЗОВАТЕЛЬ — ОБНОВЛЯЕМ ЛОКАЛЬНОГО USER
    if (data.userId === user?.id) {
        const updatedUser = { 
            ...user, 
            username: data.username, 
            avatar: data.avatar 
        };
        setUser(updatedUser);
        localStorage.setItem('user', JSON.stringify(updatedUser));
        console.log('✅ Локальный пользователь обновлён:', updatedUser);
    }
    
    // ✅ ОБНОВЛЯЕМ В СПИСКЕ ЧАТОВ (ОБЯЗАТЕЛЬНО!)
    setChats(prevChats => prevChats.map(chat => {
        // ✅ ПРОВЕРЯЕМ ПО dbId
        if (chat.dbId === data.userId) {
            console.log(`🔄 Обновляю аватарку для ${chat.name}: ${data.avatar}`);
            return { 
                ...chat, 
                name: data.username, 
                avatar: data.avatar || chat.avatar
            };
        }
        return chat;
    }));
    
    // ✅ ОБНОВЛЯЕМ В ГРУППОВЫХ ЧАТАХ
    setGroupChats(prevGroupChats => prevGroupChats.map(group => {
        if (group.members) {
            const updatedMembers = group.members.map(member => {
                if (member.userId === data.userId) {
                    return { 
                        ...member, 
                        user: { 
                            ...member.user, 
                            username: data.username, 
                            avatar: data.avatar 
                        } 
                    };
                }
                return member;
            });
            return { ...group, members: updatedMembers };
        }
        return group;
    }));
});



// === ДОБАВЛЕНИЕ УЧАСТНИКА В КАНАЛ ===
socket.on('channel_member_added', (data) => {
    console.log(`➕ Пользователь ${data.member?.userId} добавлен в канал ${data.channelId}`);
    
    if (data.member?.userId === user?.id) {
        const fetchChannelData = async (channelId) => {
            try {
                const token = localStorage.getItem('token');
                const response = await fetch(`${API_BASE_URL}/api/channels/${channelId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                
                if (response.ok) {
                    const channelData = await response.json();
                    console.log('📢 Загружен канал:', channelData);
                    
                    setChannels(prev => {
                        if (prev.some(ch => ch.id === channelData.id)) return prev;
                        return [...prev, channelData];
                    });
                    
                    if (socketRef.current) {
                        socketRef.current.emit('join_chat', `channel_${channelData.id}`);
                    }
                }
            } catch (error) {
                console.error('Ошибка загрузки канала:', error);
            }
        };
        
        fetchChannelData(data.channelId);
    }
});


// === СЛУШАТЕЛЬ УДАЛЕНИЯ КАНАЛА ===
socket.on('channel_deleted', ({ channelId }) => {
    const currentActiveId = activeChatIdRef.current;
    
    console.log(`🔴🔴🔴 [channel_deleted] ПОЛУЧЕНО: channelId=${channelId}, activeChatId=${currentActiveId}`);
    
    // ✅ ЗАКРЫВАЕМ ПРОФИЛЬ
    setIsProfileOpen(false);
    
    // ✅ УДАЛЯЕМ ИЗ СПИСКА
    setChannels(prev => prev.filter(ch => ch.id !== channelId));
    
    // ✅ ЕСЛИ ЭТОТ КАНАЛ АКТИВЕН - ПЕРЕКЛЮЧАЕМСЯ НА ОБЩИЙ ЧАТ
    if (currentActiveId === `channel_${channelId}`) {
        console.log(`🔴 Активный канал ${channelId} удален, переключаю на общий чат`);
        
        // ✅ ВАЖНО: ОБНУЛЯЕМ ВСЕ ДАННЫЕ
        setActiveChatId('chat_general');
        setActiveChatData({ 
            name: 'Общий чат', 
            avatar: '💬', 
            type: 'general' 
        });
        setMessages([]);  // ОЧИЩАЕМ СООБЩЕНИЯ
    }
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
        // ✅ ЗАЩИТА: НЕ ДОБАВЛЯЕМ К УДАЛЕННЫМ
        if (msg.isDeleted === true) {
          console.log('⚠️ Сообщение удалено, комментарий не добавляю');
          return msg;
        }
        
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
    // ✅ ИСПОЛЬЗУЕМ REF ДЛЯ ПОЛУЧЕНИЯ АКТУАЛЬНОГО ЗНАЧЕНИЯ
    const currentActiveId = activeChatIdRef.current;
    
    console.log(`🗑️ [App] Групповой чат ${chatId} удален, активный: ${currentActiveId}`);
    
    // ✅ ЗАКРЫВАЕМ ПРОФИЛЬ
    setIsProfileOpen(false);
    
    // ✅ УДАЛЯЕМ ИЗ СПИСКА
    setGroupChats(prev => {
        const filtered = prev.filter(chat => {
            const chatIdStr = chat.id?.toString() || `chat_${chat.dbId}`;
            return chatIdStr !== `chat_${chatId}` && chat.dbId !== chatId;
        });
        console.log('📊 Новый список групповых чатов:', filtered);
        return filtered;
    });
    
    // ✅ ЕСЛИ ЭТОТ ЧАТ АКТИВЕН - ПЕРЕКЛЮЧАЕМСЯ НА ОБЩИЙ ЧАТ
    if (currentActiveId === `chat_${chatId}`) {
        console.log(`🔴 Активный групповой чат ${chatId} удален, переключаю на общий`);
        
        // ✅ ВАЖНО: СНАЧАЛА ОБНУЛЯЕМ activeChatData
        setActiveChatData(null);
        
        // ✅ ПОТОМ УСТАНАВЛИВАЕМ ОБЩИЙ ЧАТ
        setActiveChatId('chat_general');
        
        // ✅ ОЧИЩАЕМ СООБЩЕНИЯ
        setMessages([]);
    }
});

// === СЛУШАТЕЛЬ УДАЛЕНИЯ КАНАЛА ===
socket.on('channel_deleted', ({ channelId }) => {
    const currentActiveId = activeChatIdRef.current;
    
    console.log(`🗑️ [App] Канал ${channelId} удален, активный: ${currentActiveId}`);
    
    // ✅ ЗАКРЫВАЕМ ПРОФИЛЬ
    setIsProfileOpen(false);
    
    // ✅ УДАЛЯЕМ ИЗ СПИСКА
    setChannels(prev => prev.filter(ch => ch.id !== channelId));
    
    // ✅ ЕСЛИ ЭТОТ КАНАЛ АКТИВЕН - ПЕРЕКЛЮЧАЕМСЯ НА ОБЩИЙ ЧАТ
    if (currentActiveId === `channel_${channelId}`) {
        console.log(`🔴 Активный канал ${channelId} удален, переключаю на общий`);
        
        // ✅ ВАЖНО: СНАЧАЛА ОБНУЛЯЕМ activeChatData
        setActiveChatData(null);
        
        // ✅ ПОТОМ УСТАНАВЛИВАЕМ ОБЩИЙ ЧАТ
        setActiveChatId('chat_general');
        
        // ✅ ОЧИЩАЕМ СООБЩЕНИЯ
        setMessages([]);
    }
});




// === СЛУШАТЕЛЬ ОБНОВЛЕНИЯ РЕАКЦИЙ ===
socket.on('reaction_updated', ({ messageId, reactions }) => {
  console.log(`❤️ Обновлены реакции для сообщения ${messageId}:`, reactions);
  
  setMessages(prev =>
    prev.map(msg => {
      if (msg.id === messageId) {
        // ✅ ЗАЩИТА: НЕ ОБНОВЛЯЕМ ЕСЛИ УДАЛЕНО
        if (msg.isDeleted === true) {
          console.log(`⚠️ Сообщение ${messageId} удалено, реакции не обновляю`);
          return msg;
        }
        return {
          ...msg,
          reactions: reactions
        };
      }
      return msg;
    })
  );
});

// === СЛУШАТЕЛЬ ОБНОВЛЕНИЯ КАНАЛА ===
socket.on('channel_updated', (data) => {
    console.log(`📢 Обновление канала ${data.channelId}:`, data.lastMessage);
    
    setChannels(prev => prev.map(channel => {
        if (Number(channel.id) === Number(data.channelId)) {
            return {
                ...channel,
                lastMessage: data.lastMessage
            };
        }
        return channel;
    }));
});

// === СЛУШАТЕЛЬ ОБНОВЛЕНИЯ ГРУППОВОГО ЧАТА ===
socket.on('chat_updated', (data) => {
    console.log(`👥 Обновление чата ${data.chatId}:`, data.lastMessage);
    
    setGroupChats(prev => prev.map(chat => {
        if (Number(chat.dbId) === Number(data.chatId)) {
            return {
                ...chat,
                lastMessage: data.lastMessage
            };
        }
        return chat;
    }));
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
    console.log('🔴🔴🔴 unread_updated ПОЛУЧЕН НА КЛИЕНТЕ:', data);
    
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

    const updateKey = chatKey;
    if (processingUpdates.current.has(updateKey)) {
        console.log(`⚠️ Пропускаю дублирование для ${updateKey}`);
        return;
    }
    processingUpdates.current.add(updateKey);
    
    // ✅ ОБНОВЛЯЕМ unreadCounts
    setUnreadCounts(prev => {
        const currentCount = prev[chatKey] || 0;
        const newCount = currentCount + count;
        console.log(`📊 Увеличен счетчик для ${chatKey}: ${currentCount} + ${count} = ${newCount}`);
        return {
            ...prev,
            [chatKey]: newCount
        };
    });
    
    // ✅ ДОБАВЛЯЕМ ОБНОВЛЕНИЕ САЙДБАРА
    console.log(`🔍 Обновляю сайдбар для type=${type}, id=${id}`);
    
    if (type === 'channel') {
        setChannels(prevChannels => 
            prevChannels.map(channel => {
                if (String(channel.id) === String(id)) {
                    const currentCount = channel.unreadCount || 0;
                    console.log(`📢 Обновляю канал ${channel.name}: ${currentCount} + ${count} = ${currentCount + count}`);
                    return { ...channel, unreadCount: currentCount + count };
                }
                return channel;
            })
        );
    } else if (type === 'chat') {
    console.log(`👥 Обновляю групповой чат ${id}`);
    setGroupChats(prevChats => 
        prevChats.map(chat => {
            // ✅ НОРМАЛИЗУЕМ ID ДЛЯ СРАВНЕНИЯ
            const chatId = chat.id?.toString() || `chat_${chat.dbId || chat.id}`;
            const targetId = `chat_${id}`;
            console.log(`   Сравниваю: ${chatId} === ${targetId}`);
            if (chatId === targetId) {
                const currentCount = chat.unreadCount || 0;
                console.log(`   Обновляю ${chat.name}: ${currentCount} + ${count} = ${currentCount + count}`);
                return { ...chat, unreadCount: currentCount + count };
            }
            return chat;
        })
        );
    } else if (type === 'private') {
        setChats(prevChats => 
            prevChats.map(chat => {
                if (chat.id === `user_${id}`) {
                    const currentCount = chat.unreadCount || 0;
                    return { ...chat, unreadCount: currentCount + count };
                }
                return chat;
            })
        );
    }
    
    setTimeout(() => {
        processingUpdates.current.delete(updateKey);
    }, 300);
});


// === ДОБАВЛЕНИЕ УЧАСТНИКА В ГРУППОВОЙ ЧАТ ===
socket.on('chat_member_added', (data) => {
    console.log('🔴🔴🔴 [App] ПОЛУЧЕНО chat_member_added:', data);
    console.log('🔴 [App] Тип data:', typeof data);
    console.log('🔴 [App] data.chatId:', data.chatId);
    console.log('🔴 [App] data.member:', data.member);
    console.log('🔴 [App] Текущий groupChats:', groupChats)
    // ✅ ОБНОВЛЯЕМ groupChats (ДЛЯ САЙДБАРА)
    setGroupChats(prev => {
        console.log('🔄 [App] Текущий groupChats до обновления:', prev);
        
        const updated = prev.map(chat => {
            // Сравниваем по id и dbId
            const chatIdStr = chat.id?.toString() || `chat_${chat.dbId}`;
            const targetId = `chat_${data.chatId}`;
            
            console.log(`   Сравниваю: ${chatIdStr} === ${targetId}, dbId: ${chat.dbId} === ${data.chatId}`);
            
            if (chatIdStr === targetId || chat.dbId === data.chatId) {
                // Проверяем, есть ли уже такой участник
                const memberExists = chat.members?.some(m => m.userId === data.member.userId);
                if (memberExists) {
                    console.log(`⚠️ Участник ${data.member.userId} уже есть в чате ${chat.name}`);
                    return chat;
                }
                
                console.log(`✅ Добавляю участника ${data.member.userId} в чат ${chat.name}`);
                console.log(`   Было участников: ${chat.members?.length || 0}`);
                
                return {
                    ...chat,
                    members: [...(chat.members || []), data.member],
                    _updatedAt: Date.now()
                };
            }
            return chat;
        });
        
        console.log('📊 [App] Обновленный groupChats:', updated);
        return updated;
    });
    
    // ✅ ФОРСИРУЕМ ОБНОВЛЕНИЕ САЙДБАРА
    setGroupChatsVersion(prev => {
        const newVersion = prev + 1;
        console.log(`🔄 [App] groupChatsVersion: ${prev} -> ${newVersion}`);
        return newVersion;
    });
    
    // ✅ ОБНОВЛЯЕМ activeChatData (если этот чат активен)
    if (activeChatId === `chat_${data.chatId}`) {
        setActiveChatData(prev => {
            if (!prev) return prev;
            const memberExists = prev.members?.some(m => m.userId === data.member.userId);
            if (memberExists) return prev;
            return {
                ...prev,
                members: [...(prev.members || []), data.member]
            };
        });
    }
});

// === УДАЛЕНИЕ УЧАСТНИКА ИЗ ГРУППОВОГО ЧАТА ===
socket.on('chat_member_removed', (data) => {
    console.log(`👢 Пользователь ${data.userId} удален из чата ${data.chatId}`);
    
    // ✅ ЕСЛИ УДАЛИЛИ ТЕКУЩЕГО ПОЛЬЗОВАТЕЛЯ
    if (Number(data.userId) === Number(user?.id)) {
        console.log(`⚠️ Вас удалили из чата ${data.chatId}!`);
        
        // Удаляем чат из списка
        setGroupChats(prev => prev.filter(chat => {
            const chatIdStr = chat.id?.toString() || `chat_${chat.dbId}`;
            return chatIdStr !== `chat_${data.chatId}` && chat.dbId !== data.chatId;
        }));
        
        // Если этот чат активен — переключаемся на общий
        if (activeChatId === `chat_${data.chatId}`) {
            setActiveChatId('chat_general');
            setActiveChatData({ name: 'Общий чат', avatar: '💬', type: 'general' });
            setMessages([]);
            setIsProfileOpen(false);
        }
        return; // Выходим, дальше не обновляем
    }
    
    // ✅ ОБНОВЛЯЕМ groupChats (если удалили кого-то другого)
    setGroupChats(prev => {
        console.log('🔄 Текущий groupChats:', JSON.stringify(prev, null, 2));
        
        const updated = prev.map(chat => {
            const chatIdStr = chat.id?.toString() || `chat_${chat.dbId}`;
            if (chatIdStr === `chat_${data.chatId}` || chat.dbId === data.chatId) {
                const newMembers = (chat.members || []).filter(m => m.userId !== data.userId);
                console.log(`✅ Обновляю чат ${chat.name}, было ${chat.members?.length || 0} участников, стало ${newMembers.length}`);
                return {
                    ...chat,
                    members: newMembers,
                    _updatedAt: Date.now()
                };
            }
            return chat;
        });
        
        console.log('📊 Обновленный groupChats:', JSON.stringify(updated, null, 2));
        return updated;
    });
    setGroupChatsVersion(prev => prev + 1);
    
    // ✅ СБРАСЫВАЕМ СЧЕТЧИК НЕПРОЧИТАННЫХ (если чат активен)
    if (activeChatId === `chat_${data.chatId}`) {
        setUnreadCounts(prev => ({
            ...prev,
            [`chat_${data.chatId}`]: 0
        }));
    }
});

// === УДАЛЕНИЕ УЧАСТНИКА ИЗ КАНАЛА ===
socket.on('channel_member_removed', (data) => {
    console.log(`👢 Пользователь ${data.userId} удален из канала ${data.channelId}`);
    
    // ✅ ЕСЛИ УДАЛИЛИ ТЕКУЩЕГО ПОЛЬЗОВАТЕЛЯ
    if (Number(data.userId) === Number(user?.id)) {
        console.log(`⚠️ Вас удалили из канала ${data.channelId}!`);
        
        // Удаляем канал из списка
        setChannels(prev => prev.filter(ch => ch.id !== data.channelId));
        
        // Если этот канал активен — переключаемся на общий
        if (activeChatId === `channel_${data.channelId}`) {
            setActiveChatId('chat_general');
            setActiveChatData({ name: 'Общий чат', avatar: '💬', type: 'general' });
            setMessages([]);
            setIsProfileOpen(false);
        }
        return; // Выходим, дальше не обновляем
    }
    
    // ✅ ОБНОВЛЯЕМ ДАННЫЕ (если удалили кого-то другого)
    if (activeChatId === `channel_${data.channelId}`) {
        setActiveChatData(prev => {
            if (!prev) return prev;
            return {
                ...prev,
                members: prev.members?.filter(m => m.userId !== data.userId) || []
            };
        });
    }
    
    setChannels(prev => prev.map(channel => {
        if (channel.id === data.channelId) {
            return {
                ...channel,
                members: channel.members?.filter(m => m.userId !== data.userId) || []
            };
        }
        return channel;
    }));
});

// === УДАЛЕНИЕ ИЗ КАНАЛА (кик) ===
socket.on('kicked_from_channel', (data) => {
    console.log(`👢 Вас удалили из канала ${data.channelId}: ${data.channelName}`);
    
    // Удаляем канал из списка
    setChannels(prev => prev.filter(ch => ch.id !== data.channelId));
    
    // Если этот канал был активным - переключаемся на общий чат
    if (activeChatId === `channel_${data.channelId}`) {
        setActiveChatId('chat_general');
        setActiveChatData({ name: 'Общий чат', avatar: '💬', type: 'general' });
    }
    
    // Показываем уведомление
    alert(`❌ Вас удалили из канала "${data.channelName}"`);
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
    
    // ✅ Обнуляем счетчик в UI (мгновенно)
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
    } else if (activeChatId.startsWith('chat_')) {
        setGroupChats(prevChats => 
            prevChats.map(chat => {
                if (chat.id === activeChatId) {
                    return { ...chat, unreadCount: 0 };
                }
                return chat;
            })
        );
    } else if (activeChatId.startsWith('user_')) {
        setChats(prevChats => 
            prevChats.map(chat => {
                if (chat.id === activeChatId) {
                    return { ...chat, unreadCount: 0 };
                }
                return chat;
            })
        );
    }
    
    // ✅ ТОЛЬКО ЧЕРЕЗ WEBSOCKET (НЕ HTTP!)
    if (socketRef.current && socketRef.current.connected) {
        socketRef.current.emit('read_messages', { 
            activeChatId, 
            currentUserId: user?.id 
        });
    }
    
    // ✅ НЕ ВЫЗЫВАЕМ markAsRead() ЗДЕСЬ!
    // markAsRead вызывается ТОЛЬКО в ChatArea при скролле вниз
    
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
  // ✅ СНАЧАЛА МГНОВЕННО ОБНОВЛЯЕМ ЛОКАЛЬНО
  setMessages(prev => prev.map(m => {
    if (m.id === msgId) {
      return {
        ...m,
        isDeleted: true,
        text: "Сообщение удалено",
        mediaUrl: null,
        mediaType: null,
        reactions: [],  // ОЧИЩАЕМ РЕАКЦИИ
        threads: []     // ОЧИЩАЕМ КОММЕНТАРИИ
      };
    }
    return m;
  }));
  
  // ✅ ПОТОМ ОТПРАВЛЯЕМ НА СЕРВЕР
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



// ✅ СБРОС АКТИВНОГО ЧАТА, ЕСЛИ ОН ИСЧЕЗ ИЗ СПИСКА
useEffect(() => {
    // НЕ СБРАСЫВАЕМ, ЕСЛИ НЕТ АКТИВНОГО ЧАТА ИЛИ ЭТО ОБЩИЙ ЧАТ
    if (!activeChatId || activeChatId === 'chat_general') return;
    
    let shouldReset = false;
    
    // Проверяем для групповых чатов
    if (activeChatId.startsWith('chat_')) {
        const chatId = activeChatId.replace('chat_', '');
        const exists = groupChats.some(ch => 
            ch.id === activeChatId || ch.dbId === parseInt(chatId)
        );
        if (!exists) {
            console.log(`🔴 Групповой чат ${activeChatId} не найден в списке, сбрасываю...`);
            shouldReset = true;
        }
    }
    
    // Проверяем для каналов
    if (activeChatId.startsWith('channel_')) {
        const channelId = parseInt(activeChatId.replace('channel_', ''));
        const exists = channels.some(ch => ch.id === channelId);
        if (!exists) {
            console.log(`🔴 Канал ${activeChatId} не найден в списке, сбрасываю...`);
            shouldReset = true;
        }
    }
    
    if (shouldReset) {
        console.log(`🔄 Переключаю на общий чат`);
        setActiveChatId('chat_general');
        setActiveChatData({ name: 'Общий чат', avatar: '💬', type: 'general' });
        setMessages([]);
        setIsProfileOpen(false);
    }
}, [groupChats, channels, activeChatId]);


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
    
    // ✅ ПРИВОДИМ К СТРОКЕ
    let stringChatId = String(chatId);
    
    // ✅ ЕСЛИ ID НЕ НАЧИНАЕТСЯ С ПРЕФИКСА — ДОБАВЛЯЕМ
    if (!stringChatId.startsWith('chat_') && !stringChatId.startsWith('channel_') && !stringChatId.startsWith('user_')) {
      stringChatId = `chat_${stringChatId}`;
    }
    
    let url = `${API_BASE_URL}/api/messages?activeChatId=${stringChatId}`;
    
    if (isLoadMore && messages && messages.length > 0) {
      const currentChatMsgs = messages.filter(m => {
        if (!m) return false;
        if (stringChatId === 'chat_general') return !m.receiverId && !m.channelId;
        if (stringChatId.startsWith('channel_')) return Number(m.channelId) === Number(stringChatId.replace('channel_', ''));
        if (stringChatId.startsWith('user_')) {
          const targetId = Number(stringChatId.replace('user_', ''));
          const myId = Number(authState.user.id);
          return (!m.channelId && ((Number(m.senderId) === myId && Number(m.receiverId) === targetId) || 
                                   (Number(m.senderId) === targetId && Number(m.receiverId) === myId)));
        }
        if (stringChatId.startsWith('chat_')) {
          return Number(m.chatId) === Number(stringChatId.replace('chat_', ''));
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

   if (!isLoadMore) {
  setMessages(prev => {
    const safePrev = Array.isArray(prev) ? prev : [];
    const otherChatsMsgs = safePrev.filter(m => {
      if (!m) return false;
      if (stringChatId === 'chat_general') return m.receiverId || m.channelId;
      if (stringChatId.startsWith('channel_')) return Number(m.channelId) !== Number(stringChatId.replace('channel_', ''));
      if (stringChatId.startsWith('user_')) {
        const targetId = Number(stringChatId.replace('user_', ''));
        const myId = authState?.user?.id ? Number(authState.user.id) : 0;
        const isDirect = (Number(m.senderId) === myId && Number(m.receiverId) === targetId) || 
                         (Number(m.senderId) === targetId && Number(m.receiverId) === myId);
        return !isDirect || m.channelId;
      }
      return true;
    });
    
    // ✅ ФИЛЬТРУЕМ ДУБЛИКАТЫ
    const existingIds = new Set(otherChatsMsgs.map(m => m.id));
    const newUniqueMessages = safeNewMessages.filter(m => !existingIds.has(m.id));
    
    const sortedNewMessages = [...newUniqueMessages].sort((a, b) => 
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
const handleSelectChat = async (chatId, chatData = null) => {
  const stringChatId = String(chatId);
  
  let finalChatId = stringChatId;
  if (!stringChatId.startsWith('chat_') && !stringChatId.startsWith('channel_') && !stringChatId.startsWith('user_')) {
    finalChatId = `chat_${stringChatId}`;
  }
  console.log('🔗 [App] Переключение на чат:', finalChatId);
  // ✅ ПОДПИСЫВАЕМСЯ НА КОМНАТУ
  if (socketRef.current && socketRef.current.connected) {
    socketRef.current.emit('join_chat', finalChatId);
    console.log(`🔗 Подписался на комнату: ${finalChatId}`);
  }
  
  lastFetchedChatId.current = null;
  setHasMoreHistory(true);
  if (!finalChatId) return;
  
  console.log("=== Переключение чата на ID:", finalChatId);
  
  setActiveChatId(finalChatId);
  setActiveChatData(null); 
  setHasMoreHistory(true);

  // ==========================================
  // 1. СНАЧАЛА ЗАГРУЖАЕМ ИСТОРИЮ
  // ==========================================
  // ✅ ИСПОЛЬЗУЕМ finalChatId (с префиксом)
  await fetchChatHistory(finalChatId);

  // ==========================================
// 2. ПОТОМ ОТМЕЧАЕМ КАК ПРОЧИТАННОЕ
// ==========================================
// ✅ ТОЖЕ ИСПОЛЬЗУЕМ finalChatId
if (finalChatId.startsWith('channel_')) {
    const cleanId = finalChatId.replace('channel_', '');
    await markAsRead('channel', cleanId);
    setUnreadCounts(prev => ({
      ...prev,
      [`channel_${cleanId}`]: 0
    }));
} else if (finalChatId.startsWith('chat_')) {
    const cleanId = finalChatId.replace('chat_', '');
    
    // ✅ ЕСЛИ ЧАТ ТОЛЬКО ЧТО СОЗДАН — ПРОПУСКАЕМ markAsRead
    if (!chatData) {
        await markAsRead('chat', cleanId);
    }
    
    setUnreadCounts(prev => ({
      ...prev,
      [finalChatId]: 0
    }));
} else if (finalChatId.startsWith('user_')) {
    const cleanId = finalChatId.replace('user_', '');
    await markAsRead('private', cleanId);
    setUnreadCounts(prev => ({
      ...prev,
      [finalChatId]: 0
    }));
}
  // ==========================================
  // 3. Обработка публичных каналов
  // ==========================================
  if (finalChatId.startsWith('channel_')) {
    const cleanChannelId = finalChatId.replace('channel_', '');
    
    const currentChannel = channels.find(ch => 
      ch && ch.id && Number(ch.id) === Number(cleanChannelId)
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
        type: 'channel',
        creatorId: null 
      });
    }
    return;
  }

  // ==========================================
  // 4. Обработка приватных чатов
  // ==========================================
  if (finalChatId.startsWith('user_')) {
    const cleanUserId = finalChatId.replace('user_', '');
    
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
    return;
  }
// ==========================================
// 5. Обработка групповых чатов
// ==========================================
if (finalChatId.startsWith('chat_')) {
    const cleanChatId = finalChatId.replace('chat_', '');
    
    // ✅ ИЩЕМ ПО id И ПО dbId
    let currentChat = groupChats.find(c => 
        c.id === finalChatId || c.dbId === parseInt(cleanChatId)
    );
    
    // ✅ ЕСЛИ НЕ НАШЛИ — ИЩЕМ В СВЕЖЕСОЗДАННЫХ
    if (!currentChat && chatData) {
        currentChat = chatData;
    }
    
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
    return;
}
};
  // =========================================================================
  // 🔍 ФИЛЬТРАЦИЯ ИСТОРИИ ДЛЯ АКТИВНОГО ЧАТА
  // =========================================================================
const getActiveChatMessages = () => {
  if (!activeChatId) return [];
  
  // ✅ ПРИВОДИМ К СТРОКЕ
  const stringChatId = String(activeChatId);
  
  if (stringChatId === 'chat_general') {
    const filtered = messages.filter(m => !m.channelId && !m.receiverId);
    return filtered;
  }
  
  if (stringChatId.startsWith('channel_')) {
    const channelDbId = Number(stringChatId.replace('channel_', ''));
    const filtered = messages.filter(m => Number(m.channelId) === channelDbId);
    return filtered;
  }
  
  if (stringChatId.startsWith('user_')) {
    const targetUserId = Number(stringChatId.replace('user_', ''));
    const filtered = messages.filter(m => 
      !m.channelId && (
        (Number(m.senderId) === Number(user?.id) && Number(m.receiverId) === targetUserId) ||
        (Number(m.senderId) === targetUserId && Number(m.receiverId) === Number(user?.id))
      )
    );
    return filtered;
  }

  if (stringChatId.startsWith('chat_')) {
    const chatDbId = Number(stringChatId.replace('chat_', ''));
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

    // ✅ СОХРАНЯЕМ АВАТАРКУ
    return { 
        ...chat, 
        messages: mappedMessages,
        avatar: chat.avatar || '👤'  // ← ДОБАВЬ ЭТУ СТРОКУ
    };
});

  const filteredChats = chatsWithMessages.filter(c => 
    c && c.name && c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredGroupChats = groupChats.filter(c => 
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
          onSelectChat={handleSelectChat} //
          onCreateChannel={handleCreateChannel}
          onCreateGroupChat={handleCreateGroupChat}
          unreadCounts={unreadCounts}
          user={user}
          setUser={setUser}
          onUpdateUser={setUser}
          onMarkAsRead={markAsRead}
          groupChats={filteredGroupChats}//
          searchQuery={searchQuery}
          groupChatsVersion={groupChatsVersion}
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
          chatsProp={chats}           
          groupChatsProp={groupChats} // групповые чаты
          channelsProp={channels}  
          onSelectChat={handleSelectChat}
        />

        <ProfilePanel 
          activeChat={activeChat} 
          isOpen={isProfileOpen} 
          onClose={() => setIsProfileOpen(false)} 
          socketRef={socketRef}
          onMemberAdded={(chatId, member) => {
        // ✅ ОБНОВЛЯЕМ groupChats
        setGroupChats(prev => {
            const updated = prev.map(chat => {
                if (chat.id === chatId || chat.dbId === parseInt(chatId.replace('chat_', ''))) {
                    const memberExists = chat.members?.some(m => m.userId === member.userId);
                    if (memberExists) return chat;
                    return {
                        ...chat,
                        members: [...(chat.members || []), member],
                        _updatedAt: Date.now()
                    };
                }
                return chat;
            });
            return updated;
        });
        setGroupChatsVersion(prev => prev + 1);
    }}
    onChatDeleted={(chatId) => {
        // ✅ ОБНОВЛЯЕМ groupChats ПРИ УДАЛЕНИИ
        setGroupChats(prev => {
            const filtered = prev.filter(chat => {
                const chatIdStr = chat.id?.toString() || `chat_${chat.dbId}`;
                return chatIdStr !== `chat_${chatId}` && chat.dbId !== chatId;
            });
            return filtered;
        });
        
        // ✅ ПЕРЕКЛЮЧАЕМСЯ НА ОБЩИЙ ЧАТ
        if (activeChatId === `chat_${chatId}`) {
            setActiveChatData(null);
            setActiveChatId('chat_general');
            setMessages([]);
        }
    }}
/>
        
      </div>
    </div>
  );
}