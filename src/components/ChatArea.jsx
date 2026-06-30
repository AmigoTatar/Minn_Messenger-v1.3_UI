import React, { useState, useEffect, useRef } from 'react';
import { API_BASE_URL, SCROLL_CONFIG, MEDIA_TYPES } from '../config';

export default function ChatArea({ 
  activeChatId, 
  activeChat, 
  setActiveChatId, 
  inputValue, 
  setInputValue, 
  handleSendMessage, 
  messagesEndRef,
  isTyping,
  onDeleteMessage,
  onSendImage,
  onToggleProfile,
  onSendAudio,
  activeChatData,
  messages,
  setMessages, 
  currentUserId,
  socketRef,
  typingUser,
  onLoadMoreHistory,
  hasMoreHistory,
  apiBaseUrl = API_BASE_URL,
  isHistoryLoading 
}) {
 /* console.log(`🚀 ChatArea МОНТАЖ: activeChatId = ${activeChatId}`);*/
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, msgId: null });
  const fileInputRef = useRef(null);

  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  
  // --- Смарт-скролл и позиционирование в классической ленте ---
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [isPositioning, setIsPositioning] = useState(false); // Anti-Flicker барьер
  const [unreadCountWhileReading, setUnreadCountWhileReading] = useState(0); 
  const isUserScrolledUp = useRef(false); // Блокировка автоскролла при чтении истории
  
  const scrollContainerRef = useRef(null); // Реф на контейнер со скроллом
  const firstUnreadRef = useRef(null);     // Реф на первое непрочитанное
  const readingObserver = useRef(null);
  const topSensorRef = useRef(null);       // Реф на верхнюю границу для подгрузки истории
  const scrollMetrics = useRef({ oldHeight: 0, oldTop: 0, activeChatId: null });
  const observerRef = useRef(null);
  const intervalRef = useRef(null);

  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState('');

  // Метод плавного скролла вниз (к самым свежим сообщениям)
  const scrollToBottomSmooth = () => {
    isUserScrolledUp.current = false;
    setShowScrollBtn(false);
    setUnreadCountWhileReading(0);
    
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  };
  const isTypingEmittedRef = useRef(false);

  // Закрытие контекстного меню по клику
  useEffect(() => {
    const handleCloseMenu = () => setContextMenu({ visible: false, x: 0, y: 0, msgId: null });
    window.addEventListener('click', handleCloseMenu);
    return () => window.removeEventListener('click', handleCloseMenu);
  }, []);

  // ДОБАВЬТЕ ЭТОТ useEffect ДЛЯ ДИАГНОСТИКИ
useEffect(() => {

  
  // Проверяем, какие сообщения проходят фильтр
  if (Array.isArray(messages) && activeChatId) {
    const stringChatId = activeChatId.toString();
    let filtered = [];
    
    if (stringChatId === 'chat_general') {
      filtered = messages.filter(m => !m.receiverId && !m.channelId);
    } else if (stringChatId.startsWith('channel_')) {
      const channelNumId = Number(stringChatId.replace('channel_', ''));
      filtered = messages.filter(m => Number(m.channelId) === channelNumId);
    } else if (stringChatId.startsWith('user_')) {
      const targetUserId = Number(stringChatId.replace('user_', ''));
      const myId = currentUserId ? Number(currentUserId) : null;
      filtered = messages.filter(m => 
        !m.channelId && (
          (Number(m.senderId) === myId && Number(m.receiverId) === targetUserId) ||
          (Number(m.senderId) === targetUserId && Number(m.receiverId) === myId)
        )
      );
    }
    
 
    if (filtered.length > 0) {
     
    }
  }
}, [activeChatId, messages, currentUserId]);
  // =========================================================================
  // 👀 ОЖИВЛЯЕМ СЧЕТЧИКИ НЕПРОЧИТАННЫХ И УВЕДОМЛЕНИЯ В КАНАЛАХ
  // =========================================================================
  const firstUnreadMsg = (messages || []).find(m => {
    if (!m || m.isDeleted === true) return false;

    // 1. Проверяем, что сообщение пришло НЕ от нас
    const isForeign = String(m.senderId) !== String(currentUserId);
    if (!isForeign) return false;

    // Очищаем активный ID от префиксов для точечного сравнения с БД
    const cleanActiveId = String(activeChatId).replace('user_', '').replace('channel_', '');

    // 2. ВЕТВЛЕНИЕ ПО ТИПАМ КОМНАТ ДЛЯ СБРОСА УВЕДОМЛЕНИЙ
    if (String(activeChatId).startsWith('channel_')) {
      // Для каналов: проверяем, совпадает ли ID канала и что статус не равен 'read'
      const isChannelMsg = m.channelId && String(m.channelId) === cleanActiveId;
      return isChannelMsg && m.status !== 'read' && m.isRead !== true;
    }
    
    if (String(activeChatId).startsWith('user_')) {
      // Для лички: проверяем, что отправитель — это наш собеседник
      const isDirectMsg = String(m.senderId) === cleanActiveId;
      return isDirectMsg && (m.status === 'unread' || m.status !== 'read');
    }
    
    if (activeChatId === 'chat_general') {
      // Для общего чата: проверяем, что это не приват и не канал
      return !m.channelId && !m.receiverId && m.status !== 'read' && m.isRead !== true;
    }

    return false;
  });



  const lastProcessedChatId = useRef(null);
  const isLockingNewMessages = useRef(false);

  // Мгновенный взвод барьера при смене комнат
  useEffect(() => {
    setIsPositioning(true);
    isLockingNewMessages.current = true;
  }, [activeChatId]);

  // =========================================================================
  // 🎯 АВТОСКРОЛЛ И ПОЗИЦИОНИРОВАНИЕ ЧАТА (КЛАССИЧЕСКАЯ ПРЯМАЯ ВЕРСИЯ)
  // =========================================================================
  useEffect(() => {
    let animationFrameId = null;
    let timerId = null;

    if (!messages || messages.length === 0) {
      if (lastProcessedChatId.current !== activeChatId) {
        lastProcessedChatId.current = activeChatId;
        setIsPositioning(false);
      }
      return;
    }
    // СЛУЧАЙ 1: Стартовое позиционирование при переключении чата
    if (lastProcessedChatId.current !== activeChatId) {
      console.log("🔄 Лог: Сообщения для нового чата отрисовались. Позиционирую в самый низ...");
      
      isUserScrolledUp.current = false;
      setShowScrollBtn(false);
      setUnreadCountWhileReading(0);
      isLockingNewMessages.current = true; 

      animationFrameId = requestAnimationFrame(() => {
        timerId = setTimeout(() => {
          const container = scrollContainerRef.current;
          
          if (firstUnreadMsg && firstUnreadRef.current && !activeChatId.startsWith('channel_')) {
            
            firstUnreadRef.current.scrollIntoView({ behavior: 'auto', block: 'center' });
          } else {
            
            if (container) {
              container.scrollTop = container.scrollHeight;
            }
          }
          
          setTimeout(() => {
            if (scrollContainerRef.current) {
              scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
            }
          }, 30);

          lastProcessedChatId.current = activeChatId;
          setIsPositioning(false);
          
          setTimeout(() => {
            isLockingNewMessages.current = false;
          }, 100);
        }, 150);
      });

      return () => {
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        if (timerId) clearTimeout(timerId);
      };
    }

    // СЛУЧАЙ 2: Динамический автоскролл при летящих сообщениях из сокетов
  
  // ✅ ПРИ СМЕНЕ ЧАТА - ВСЕГДА ВНИЗ
  if (activeChatId && messages && messages.length > 0) {
    console.log(`📜 Скролл вниз для ${activeChatId}, сообщений: ${messages.length}`);
    
    // Небольшая задержка для рендера
    setTimeout(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTo({
          top: scrollContainerRef.current.scrollHeight,
          behavior: 'smooth'
        });
        isUserScrolledUp.current = false;
        setShowScrollBtn(false);
        setUnreadCountWhileReading(0);
      }
    }, 100);
  }
}, [activeChatId, messages]);

useEffect(() => {
  const container = scrollContainerRef.current;
  if (!container) return;
  if (scrollMetrics.current.oldHeight === 0) {
    setIsPositioning(false);
    return;
  }

  let isApplied = false;
  let checkCount = 0;
  const maxChecks = SCROLL_CONFIG.MAX_CHECKS;;

  const checkHeight = () => {
    if (isApplied) return;
    const currentHeight = container.scrollHeight;
    const heightDifference = currentHeight - scrollMetrics.current.oldHeight;

    if (heightDifference > 0) {
      const targetScrollTop = scrollMetrics.current.oldTop + heightDifference;
      container.scrollTop = targetScrollTop;

      setTimeout(() => {
        if (container && Math.abs(container.scrollTop - targetScrollTop) > 50) {
          container.scrollTop = targetScrollTop;
        }
      }, 50);

      isApplied = true;
      scrollMetrics.current.oldHeight = 0;
      scrollMetrics.current.oldTop = 0;
      setIsPositioning(false);
      if (observerRef.current) observerRef.current.disconnect();
      if (intervalRef.current) clearInterval(intervalRef.current);
    } else {
      checkCount++;
      if (checkCount >= maxChecks) {
        scrollMetrics.current.oldHeight = 0;
        scrollMetrics.current.oldTop = 0;
        setIsPositioning(false);
        if (observerRef.current) observerRef.current.disconnect();
        if (intervalRef.current) clearInterval(intervalRef.current);
      }
    }
  };

  observerRef.current = new MutationObserver(() => checkHeight());
  observerRef.current.observe(container, {
    childList: true,
    subtree: true,
    attributes: false,
    characterData: false
  });

  intervalRef.current = setInterval(checkHeight, 50);

  const timeoutId = setTimeout(() => {
    if (!isApplied) checkHeight();
  }, 2000);

  return () => {
    if (observerRef.current) observerRef.current.disconnect();
    if (intervalRef.current) clearInterval(intervalRef.current);
    clearTimeout(timeoutId);
  };
}, [messages]);
  // =========================================================================
  // 👀 ИСПРАВЛЕННЫЙ ЭФФЕКТ ЧТЕНИЯ (ЖЕСТКАЯ ИЗОЛЯЦИЯ ОТ ВНЕШНИХ MSG)
  // =========================================================================
  useEffect(() => {
    // Если непрочитанных сообщений нет — сразу отключаем обсервер
    if (!firstUnreadMsg) {
      if (readingObserver.current) readingObserver.current.disconnect();
      return;
    }

    if (readingObserver.current) readingObserver.current.disconnect();

    readingObserver.current = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && !isPositioning) {
          console.log("👁️ Смарт-сенсор: Юзер увидел плашку непрочитанных!");

          if (socketRef.current && socketRef.current.connected) {
            socketRef.current.emit('read_messages', { 
              activeChatId, 
              currentUserId: currentUserId 
            });
          }

          if (readingObserver.current) readingObserver.current.disconnect();
        }
      });
    }, { root: scrollContainerRef.current, threshold: 0.7 });

    const timer = setTimeout(() => {
      if (firstUnreadRef.current && readingObserver.current) {
        readingObserver.current.observe(firstUnreadRef.current);
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      if (readingObserver.current) readingObserver.current.disconnect();
    };
  }, [activeChatId, messages, isPositioning, currentUserId, !!firstUnreadMsg]); 


// 🎛️ НАТИВНЫЙ ОБРАБОТЧИК ПРОКРУТКИ
const handleScroll = (e) => {
  const container = e.currentTarget || scrollContainerRef.current;
  if (!container) return;

  const { scrollTop, scrollHeight, clientHeight } = container;

  // 1. Управление плавающей кнопкой "Вниз"
  const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
  if (distanceFromBottom > 200) {
    isUserScrolledUp.current = true;
    setShowScrollBtn(true);
  } else {
    isUserScrolledUp.current = false;
    setShowScrollBtn(false);
    setUnreadCountWhileReading(0);
  }

  // 2. 🛡️ Детектор ВЕРХА с БЛОКИРОВКОЙ
  if (
    scrollTop < 40 && 
    !isPositioning && 
    !isHistoryLoading && 
    hasMoreHistory && 
    scrollHeight > clientHeight &&
    scrollMetrics.current.oldHeight === 0 // Не запускаем, если уже есть метрики
  ) {
    console.log(`▲ Нативный скролл: Достигнут ВЕРХ. scrollTop=${scrollTop}, scrollHeight=${scrollHeight}`);
    
    if (typeof onLoadMoreHistory === 'function') {
      // Сохраняем метрики ДО загрузки
      scrollMetrics.current.oldHeight = scrollHeight;
      scrollMetrics.current.oldTop = scrollTop;
      console.log(`📝 Сохраняю метрики: oldHeight=${scrollHeight}, oldTop=${scrollTop}`);
      
      // Блокируем повторные вызовы
      setIsPositioning(true);
      
      // Вызываем загрузку
      onLoadMoreHistory();
    }
  }
};
  // Таймер записи аудиосообщений
  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setRecordingTime(0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording]);

  const handleContextMenu = (e, msgId) => {
    e.preventDefault();
    setContextMenu({ visible: true, x: e.pageX, y: e.pageY, msgId });
  };

  const handleCopy = (text) => {
    if (text) navigator.clipboard.writeText(text);
  };

  // Выгрузка картинок через Multer
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]; 
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Пожалуйста, выберите изображение');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      const token = localStorage.getItem('token');
      const serverUrl = activeChatData?.apiBaseUrl || apiBaseUrl || API_BASE_URL

      const response = await fetch(`${serverUrl}/api/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });

      if (!response.ok) throw new Error('Ошибка при загрузке файла');
      
      const data = await response.json();
      const relativeUrl = data.fileUrl;
      if (!relativeUrl) throw new Error('Бэкенд не вернул путь к файлу');

      const finalUrl = relativeUrl.startsWith('http') ? relativeUrl : `${serverUrl}${relativeUrl}`;
      if (typeof onSendImage === 'function') onSendImage(finalUrl); 

    } catch (error) {
      console.error('Ошибка загрузки медиа через Multer:', error);
      alert('Не удалось отправить изображение');
    }
    e.target.value = '';
  };
  // Запись аудиосообщений
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      let options = { mimeType: 'audio/webm' };
      if (MediaRecorder.isTypeSupported('audio/aac')) {
        options = { mimeType: 'audio/aac' };
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        options = { mimeType: 'audio/mp4' };
      }

      mediaRecorderRef.current = new MediaRecorder(stream, options);
      audioChunksRef.current = [];
      
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        const mimeType = mediaRecorderRef.current.mimeType;
        const ext = mimeType.includes('aac') ? 'aac' : mimeType.includes('mp4') ? 'mp4' : 'webm';
        
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        const audioFile = new File([audioBlob], `voice.${ext}`, { type: mimeType });
        
        const formData = new FormData();
        formData.append('file', audioFile);

        try {
          const token = localStorage.getItem('token');
          const serverUrl = activeChatData?.apiBaseUrl || apiBaseUrl || API_BASE_URL; 

          const response = await fetch(`${serverUrl}/api/upload`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData,
          });

          if (!response.ok) throw new Error('Ошибка при загрузке аудио');
          
          const audioResponseData = await response.json();
          const relativeAudioUrl = audioResponseData.fileUrl;
          if (!relativeAudioUrl) throw new Error('Бэкенд не вернул путь к файлу для аудио');

          const finalAudioUrl = relativeAudioUrl.startsWith('http') ? relativeAudioUrl : `${serverUrl}${relativeAudioUrl}`;
          if (typeof onSendAudio === 'function') onSendAudio(finalAudioUrl);

        } catch (uploadError) {
          console.error('Ошибка сохранения аудио на сервере:', uploadError);
          alert('Не удалось отправить голосовое сообщение');
        }
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (err) {
      alert('Микрофон недоступен: ' + err.message);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const formatTime = (secs) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins}:${remainingSecs.toString().padStart(2, '0')}`;
  };

    // 🛡️ [ТОТАЛЬНЫЙ БЛОКИРАТОР REFERENCEERROR]

  const chatAvatar = activeChatData?.avatar || activeChat?.avatar || (activeChatId === 'chat_general' ? '💬' : '👤');
  const isDataLoading = !activeChatData && !activeChat && activeChatId !== 'chat_general';

  const isCurrentChatTyping = typingUser && (
    (typingUser.isGeneral && activeChatId === 'chat_general' && Number(typingUser.senderId) !== Number(currentUserId)) ||
    (!typingUser.isGeneral && activeChatId?.toString().replace('user_', '') === typingUser.senderId?.toString())
  );

  const formatMsgTime = (dateString) => {
    if (!dateString) return '';
    try {
      const d = new Date(dateString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const correctChatName = (() => {
    if (activeChatId === 'chat_general') return 'Общий чат';
    if (activeChatData?.name) return activeChatData.name;
    
    if (activeChatId?.startsWith('channel_')) {
      const channelNumId = activeChatId.replace('channel_', '');
      return `Публичный канал #${channelNumId}`;
    }
    
    if (activeChatId?.startsWith('user_')) {
      const userNumId = activeChatId.replace('user_', '');
      return `Пользователь #${userNumId}`;
    }
    return 'Чат';
  })();
  /*console.log(`📦 РЕНДЕР: messages.length=${messages?.length || 0}, activeChatId=${activeChatId}`);
console.log(`📦 messages:`, messages);*/
  return (
    <div className={`flex-col flex-1 h-full bg-zinc-100 dark:bg-zinc-900 ${activeChatId ? 'flex' : 'hidden md:flex'}`}>
      {!activeChatId ? (
        <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 p-4 text-center">
          <span className="text-4xl mb-2">💬</span>
          <p className="text-sm">Выберите чат, чтобы начать общение</p>
        </div>
      ) : (
       <div className="flex flex-col h-full relative">
          
          {/* 1. ШАПКА ЧАТА (ОБЯЗАНА СТОЯТЬ ПЕРВОЙ НАВЕРХУ) */}
          <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-950/40">
            <div className="flex items-center flex-1 cursor-pointer select-none group" onClick={onToggleProfile}>
              <button 
                onClick={(e) => { e.stopPropagation(); setActiveChatId(null); }} 
                className="md:hidden mr-3 p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition text-zinc-500 dark:text-zinc-400"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
              
              <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-lg mr-3 shadow-inner group-hover:scale-105 transition-transform duration-200">
                {chatAvatar}
              </div>
              
   <div>
                <h2 className="font-semibold text-sm text-zinc-800 dark:text-white group-hover:text-emerald-500 transition-colors">
                  {correctChatName}
                </h2>
                
                {/* 🛡️ РЕАКТИВНЫЙ СТАТУС В ЗАВИСИМОСТИ ОТ ТИПА КОМНАТЫ */}
                <span className="text-xs transition-colors duration-300">
                  {isDataLoading ? (
                    <span className="text-zinc-500 dark:text-zinc-600 animate-pulse">поиск в базе...</span>
                  ) : isCurrentChatTyping ? ( 
                    <span className="text-emerald-500 dark:text-emerald-400 animate-pulse">печатает...</span>
                  ) : (
                    <>
                      {activeChatId === 'chat_general' ? (
                        <span className="text-zinc-400 dark:text-zinc-500">общий чат</span>
                      ) : activeChatId?.startsWith('channel_') || activeChatData?.type === 'channel' ? (
                        <span className="text-zinc-400 dark:text-zinc-500">канал</span>
                      ) : activeChatData?.isOnline || activeChat?.isOnline ? (
                        <span className="text-emerald-500 dark:text-emerald-400 font-medium">в сети</span>
                      ) : (
                        <span className="text-zinc-400 dark:text-zinc-500">был(а) недавно</span>
                      )}
                    </>

                  )}
                </span>
              </div>
            </div>
            
            <button 
              onClick={onToggleProfile} 
              className="p-2 text-zinc-400 dark:text-zinc-500 hover:text-zinc-800 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition"
            >
              ℹ️
            </button>
          </div>

          {/* 2. ЛЕНТА СООБЩЕНИЙ (ИДЁТ СТРОГО ПОД ШАПКОЙ) */}
          <div 
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar bg-white dark:bg-zinc-950/20"
          >
  


            {/* ⏳ СЕНСОР ИСТОРИИ (Вверху прямой ленты) */}
            <div ref={topSensorRef} className="h-1 w-full flex items-center justify-center text-xs text-zinc-500/50">
              {isHistoryLoading ? '⏳ Загрузка истории...' : ''}
            </div>

{/* 💬 РЕНДЕР СООБЩЕНИЙ */}
{Array.isArray(messages) && messages.length > 0 ? (
  messages.map((msg, index) => {
    if (!msg) return null;
    
    // Проверяем, что сообщение принадлежит этому чату
    const stringChatId = activeChatId ? activeChatId.toString() : '';
    let shouldShow = false;

    if (stringChatId === 'chat_general') {
      shouldShow = !msg.receiverId && !msg.channelId;
    } else if (stringChatId.startsWith('channel_')) {
      const channelNumId = Number(stringChatId.replace('channel_', ''));
      shouldShow = Number(msg.channelId) === channelNumId;
    } else if (stringChatId.startsWith('user_')) {
      const targetUserId = Number(stringChatId.replace('user_', ''));
      const myId = currentUserId ? Number(currentUserId) : null;
      shouldShow = !msg.channelId && (
        (Number(msg.senderId) === myId && Number(msg.receiverId) === targetUserId) ||
        (Number(msg.senderId) === targetUserId && Number(msg.receiverId) === myId)
      );
    } else if (stringChatId.startsWith('chat_')) {
      const chatDbId = Number(stringChatId.replace('chat_', ''));
      shouldShow = Number(msg.chatId) === chatDbId;
    }
    
    if (!shouldShow) return null;

    // ✅ УНИКАЛЬНЫЙ КЛЮЧ
    const uniqueKey = `msg-${msg.id || msg._id || index}-${msg.threads?.length || 0}-${index}`;

    // ЕСЛИ СООБЩЕНИЕ УДАЛЕНО - ПОКАЗЫВАЕМ ПЛАШКУ
    if (msg.isDeleted) {
      return (
        <div key={uniqueKey} className="flex w-full mb-2 justify-center">
          <div className="bg-zinc-100 dark:bg-zinc-800/50 text-zinc-400 dark:text-zinc-500 text-xs px-4 py-1.5 rounded-full border border-zinc-200 dark:border-zinc-700/50 select-none">
            🗑️ Сообщение удалено
          </div>
        </div>
      );
    }
    
    // Вытаскиваем все возможные ключи медиафайлов
    const currentFileUrl = msg.fileUrl || msg.imageUrl || msg.mediaUrl || msg.image || '';
    const currentAudioUrl = msg.audioUrl || msg.voiceUrl || msg.audio || '';
    const currentText = msg.text || msg.content || msg.message || '';

    // Проверяем, является ли файл аудиозаписью
    const isAudioFile = 
      currentAudioUrl !== '' ||
      (Array.isArray(MEDIA_TYPES?.AUDIO) && MEDIA_TYPES.AUDIO.some(ext => currentFileUrl.toLowerCase().endsWith(ext))) ||
      currentText.includes('Голосовое сообщение');

    const isOwn = Number(msg.senderId) === Number(currentUserId);

    return (
      <div 
        key={uniqueKey}
        className={`flex w-full mb-2 ${isOwn ? 'justify-end' : 'justify-start'}`}
      >
        <div 
          className={`max-w-[70%] rounded-2xl px-4 py-2 shadow-sm relative group text-sm ${
            isOwn
              ? 'bg-emerald-600 text-white rounded-br-none'
              : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 rounded-bl-none border border-zinc-200/60 dark:border-transparent'
          }`}
          onContextMenu={(e) => handleContextMenu(e, msg.id)}
        >
          {/* 🖼️ ВЫВОД КАРТИНКИ */}
          {currentFileUrl && !isAudioFile && (
            <div className="mb-2 max-w-full overflow-hidden rounded-lg bg-zinc-900/50">
              <img 
                src={currentFileUrl} 
                alt="Вложение" 
                className="max-h-60 w-full object-cover cursor-pointer hover:opacity-90 transition"
                onClick={() => window.open(currentFileUrl, '_blank')}
              />
            </div>
          )}

          {/* 🎙️ ВЫВОД АУДИОПЛЕЕРА */}
          {isAudioFile && (
            <div className="mb-2 p-1 bg-zinc-100/80 dark:bg-zinc-950/60 rounded-xl flex items-center gap-2 min-w-[240px] border border-zinc-200 dark:border-zinc-800/50">
              <audio 
                src={currentAudioUrl || currentFileUrl} 
                controls 
                className="w-full h-8 accent-emerald-500" 
              />
            </div>
          )}

          {/* 💬 ТЕКСТ СООБЩЕНИЯ */}
          {currentText && !currentText.includes('Голосовое сообщение') && (
            <p className="break-words whitespace-pre-wrap">{currentText}</p>
          )}
          
          {/* 🕒 ВРЕМЯ И ГАЛОЧКИ СТАТУСА */}
          <div className={`text-[10px] font-normal flex items-center justify-end gap-1 mt-1 select-none ${
            isOwn
              ? 'text-emerald-100/90' 
              : 'text-zinc-400 dark:text-zinc-500' 
          }`}>
            <span>{msg.createdAt ? formatMsgTime(msg.createdAt) : ''}</span>
            
            {isOwn && (
              <span className="text-xs font-bold leading-none">
                {msg.status === 'read' || msg.isRead === true ? (
                  <span className="text-cyan-200 dark:text-cyan-400">✓✓</span>
                ) : (
                  <span className="text-emerald-200/60">✓</span>
                )}
              </span>
            )}
          </div>

{/* 💬 КНОПКА ОТВЕТИТЬ И ТРЕДЫ */}
{!msg.isDeleted && (
  <div className="mt-1">
    {/* Разделительная линия перед тредами */}
    {msg.threads && msg.threads.length > 0 && (
      <div className="border-t border-zinc-200 dark:border-zinc-700/50 my-2" />
    )}
    
    <button
      onClick={() => {
        setReplyingTo({ messageId: msg.id, text: msg.text || 'Сообщение' });
      }}
      className="text-[10px] text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 transition select-none font-medium"
    >
      💬 Ответить
    </button>
    
{/* ❤️ РЕАКЦИИ */}
{!msg.isDeleted && (
  <div className="flex items-center gap-0.5 mt-1 flex-wrap">
    {/* Кнопки реакций */}
    {['❤️', '😂', '😮', '😢', '😡', '👍'].map(emoji => {
      const isActive = msg.reactions?.some(r => r.userId === currentUserId && r.type === emoji);
      const count = msg.reactions?.filter(r => r.type === emoji).length || 0;
      
      return (
        <button
          key={emoji}
          onClick={async () => {
            try {
              const token = localStorage.getItem('token');
              const response = await fetch(
                `http://localhost:5001/api/messages/${msg.id}/reactions`,
                {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({ type: emoji })
                }
              );
              
              if (!response.ok) throw new Error('Ошибка');
              
              // Локальное обновление (на случай, если сокет не сработает)
              const data = await response.json();
              setMessages(prev =>
                prev.map(m => {
                  if (m.id === msg.id) {
                    return { ...m, reactions: data.reactions };
                  }
                  return m;
                })
              );
              
            } catch (error) {
              console.error('Ошибка при добавлении реакции:', error);
            }
          }}
          className={`text-sm px-1.5 py-0.5 rounded-full transition select-none ${
            isActive 
              ? 'bg-emerald-100 dark:bg-emerald-900/40 ring-1 ring-emerald-400' 
              : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'
          }`}
        >
          {emoji}
          {count > 0 && (
            <span className={`text-[10px] ml-0.5 ${isActive ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-zinc-400 dark:text-zinc-500'}`}>
              {count}
            </span>
          )}
        </button>
      );
    })}
  </div>
)}


    {/* Отображение тредов */}
    {msg.threads && msg.threads.length > 0 && (
      <div className="mt-2 space-y-1.5 bg-zinc-50 dark:bg-zinc-800/30 rounded-lg p-2 border border-zinc-200/50 dark:border-zinc-700/30">
       <div className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-300 mb-1.5 flex items-center gap-1">
  <span>💬</span>
  <span>Комментарии</span>
  <span className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 bg-zinc-200/50 dark:bg-zinc-700/30 px-1.5 py-0.5 rounded-full">
    {msg.threads.length}
  </span>
</div>
        {msg.threads.map((thread, tIndex) => (
          <div key={`thread-${thread.id}-${tIndex}`} className="text-xs flex items-start gap-1.5">
            <span className="font-medium text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
              {thread.user?.username || 'Неизвестный'}:
            </span>
            <span className="text-blue-600 dark:text-blue-400 break-words">
              {thread.text}
            </span>
            <span className="text-[10px] text-zinc-500 dark:text-zinc-400 whitespace-nowrap ml-auto font-medium">
              {new Date(thread.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  })
) : (
  <div className="text-center text-zinc-500 py-10">
    💬 Нет сообщений в этом чате
  </div>
)}
            {/* Анимация "печатает..." */}
            {isTyping && (
              <div className="flex justify-start mb-2 w-full">
                <div className="bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 rounded-2xl rounded-bl-none px-4 py-2.5 shadow-sm flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                  <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                  <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce"></span>
                </div>
              </div>
            )}


{/* 📝 ФОРМА ОТВЕТА (ТРЕД) */}
{replyingTo && (
  <div className="mt-2 p-2 bg-zinc-100 dark:bg-zinc-800/60 rounded-xl border border-zinc-200 dark:border-zinc-700">
    <div className="flex justify-between items-center mb-1">
      <span className="text-xs text-zinc-500 dark:text-zinc-400">
        Ответ на: <span className="font-medium">{replyingTo.text}</span>
      </span>
      <button
        onClick={() => {
          setReplyingTo(null);
          setReplyText('');
        }}
        className="text-xs text-zinc-400 hover:text-red-400 transition"
      >
        ✕
      </button>
    </div>
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!replyText.trim()) return;

        try {
          const token = localStorage.getItem('token');
          const response = await fetch(
            `http://localhost:5001/api/messages/${replyingTo.messageId}/threads?activeChatId=${activeChatId}`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ text: replyText.trim() })
            }
          );

          if (!response.ok) throw new Error('Ошибка создания комментария');

          const newThread = await response.json();
          
        

          setReplyText('');
          setReplyingTo(null);

        } catch (error) {
          console.error('Ошибка создания треда:', error);
          alert('Не удалось отправить комментарий');
        }
      }}
      className="flex gap-2"
    >
      <input
        type="text"
        value={replyText}
        onChange={(e) => setReplyText(e.target.value)}
        placeholder="Напишите комментарий..."
        className="flex-1 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-emerald-500 text-zinc-800 dark:text-white"
        autoFocus
      />
      <button
        type="submit"
        disabled={!replyText.trim()}
        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium rounded-xl transition"
      >
        Ответить
      </button>
    </form>
  </div>
)}

            {/* 🎯 МАРКЕР НИЗА (В самом конце списка прямой ленты) */}
            <div ref={messagesEndRef} className="h-0 w-full" />
          </div>

          {/* Плавающая кнопка «Вниз» */}
          {showScrollBtn && (
            <button 
              type="button"
              onClick={scrollToBottomSmooth}
              className="absolute bottom-24 right-6 w-10 h-10 bg-zinc-800 dark:bg-zinc-700 hover:bg-emerald-600 dark:hover:bg-emerald-600 text-white rounded-full flex items-center justify-center shadow-lg transition-all duration-300 active:scale-95 group z-40"
            >
              <span className="text-sm font-bold group-hover:translate-y-0.5 transition-transform duration-200">↓</span>
              {unreadCountWhileReading > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-emerald-500 text-white text-[10px] font-bold h-5 w-5 rounded-full flex items-center justify-center border border-zinc-900">
                  {unreadCountWhileReading}
                </span>
              )}
            </button>
          )}

          {/* Панель ввода сообщений */}
          {activeChatId && activeChatId.startsWith('channel_') && 
           (activeChatData?.creatorId !== Number(currentUserId) && activeChat?.creatorId !== Number(currentUserId)) ? (
            <div className="p-5 bg-zinc-100 dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 text-center text-sm font-medium tracking-wide text-zinc-400 dark:text-zinc-500 flex items-center justify-center gap-2 select-none">
              📢 Только администраторы могут оставлять сообщения
            </div>
          ) : (
            <form onSubmit={(e) => { 
              handleSendMessage(e); 
              const textarea = e.target.querySelector('textarea');
              if (textarea) textarea.style.height = '40px';
            }} className="p-4 bg-zinc-50 dark:bg-zinc-950/40 border-t border-zinc-200 dark:border-zinc-800 flex gap-2 items-center">
              <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
              {!isRecording && (
                <button type="button" onClick={() => fileInputRef.current.click()} className="p-2 text-zinc-400 hover:text-emerald-500 rounded-xl transition active:scale-95">📎</button>
              )}

              {isRecording ? (
                <div className="flex-1 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl px-4 py-2.5 text-sm flex items-center justify-between font-medium animate-pulse">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                    <span>Запись голосового сообщения...</span>
                  </div>
                  <span>{formatTime(recordingTime)}</span>
                </div>
              ) : (
                <textarea 
                  value={inputValue} 
                  onChange={(e) => {
                    setInputValue(e.target.value);
                    e.target.style.height = '40px';
                    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;

                    if (socketRef && socketRef.current && !isTypingEmittedRef.current) {
                      isTypingEmittedRef.current = true;
                      socketRef.current.emit('typing', { activeChatId });
                      
                      setTimeout(() => {
                        isTypingEmittedRef.current = false;
                        if (socketRef.current) socketRef.current.emit('stop_typing', { activeChatId });
                      }, 1500);
                    }
                  }} 
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault(); 
                      handleSendMessage(e); 
                      e.target.style.height = '40px';
                    }
                  }}
                  placeholder="Напишите сообщение..." 
                  autoComplete="off" 
                  rows={1}
                  className="flex-1 bg-zinc-100 dark:bg-zinc-800/60 border border-zinc-200/60 dark:border-zinc-700/50 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-emerald-500 transition text-zinc-800 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 resize-none min-h-[40px] max-h-[120px] no-scrollbar py-2" 
                />
              )}

              {inputValue.trim() === '' ? (
                <button type="button" onClick={isRecording ? stopRecording : startRecording} className={`p-2.5 rounded-xl text-sm font-medium transition active:scale-95 shadow-md flex items-center justify-center ${isRecording ? 'bg-red-600 text-white hover:bg-red-500' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-emerald-500 dark:hover:text-emerald-400'}`}>
                  {isRecording ? '⏹️' : '🎙️'}
                </button>
              ) : (
                <button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition active:scale-95 shadow-md shadow-emerald-900/20">Отправить</button>
              )}
            </form>
          )}

{/* Контекстное меню */}
{contextMenu.visible && (() => {
  const currentMsg = messages?.find(m => m && (m.id === contextMenu.msgId || m._id === contextMenu.msgId));
  if (!currentMsg) return null;

  const isMsgMe = Number(currentMsg.senderId) === Number(currentUserId);
  const isChannelCreator = activeChatData?.type === 'channel' && activeChatData?.creatorId === Number(currentUserId);
  const canDelete = isMsgMe || isChannelCreator;
  const textToCopy = currentMsg.text || currentMsg.content || currentMsg.message || '';

  return (
    <div 
      className="fixed bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/80 py-1 w-40 rounded-xl shadow-2xl z-50 text-xs text-zinc-700 dark:text-zinc-200 overflow-hidden" 
      style={{ top: contextMenu.y, left: contextMenu.x }}
    >
      {!currentMsg.isDeleted && textToCopy !== '' && (
        <button 
          onClick={() => {
            handleCopy(textToCopy);
            setContextMenu({ visible: false, x: 0, y: 0, msgId: null });
          }} 
          className="w-full text-left px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-700/60 transition flex items-center gap-2"
        >
          📋 Копировать текст
        </button>
      )}
      
      
      {canDelete && (
        <button 
          onClick={() => { 
            onDeleteMessage(contextMenu.msgId); 
            setContextMenu({ visible: false, x: 0, y: 0, msgId: null }); 
          }} 
          className="w-full text-left px-3 py-2 hover:bg-red-50 dark:hover:bg-red-950/40 text-red-500 dark:text-red-400 transition flex items-center gap-2 font-medium border-t border-zinc-100 dark:border-zinc-700/30"
        >
          🗑️ Удалить сообщение
        </button>
      )}
    </div>
  );
})()}


        </div>
      )}
    </div>
  );
}
