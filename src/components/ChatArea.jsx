import React, { useState, useEffect, useRef } from 'react';
import { API_BASE_URL, SCROLL_CONFIG, MEDIA_TYPES } from '../config';
import { getAvatarUrl } from '../utils/avatarUtils';

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
  isHistoryLoading,
  onMarkAsRead,
  chatsProp,        
  groupChatsProp,   
  onSelectChat,
  channelsProp       
}) {
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, msgId: null });
  const fileInputRef = useRef(null);

  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const [showReactions, setShowReactions] = useState({});
  const [localTypingUser, setLocalTypingUser] = useState(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [isPositioning, setIsPositioning] = useState(false);
  const [unreadCountWhileReading, setUnreadCountWhileReading] = useState(0); 
  
  // ✅ СТЕЙТЫ ДЛЯ ЗАКРЕПЛЕННЫХ
  const [showPinnedList, setShowPinnedList] = useState(false);
  const [pinnedMessages, setPinnedMessages] = useState([]);
  const [pinnedLoading, setPinnedLoading] = useState(false);
  
  // ✅ НОВЫЙ СТЕЙТ ДЛЯ РЕДАКТИРОВАНИЯ
  const [editingMessage, setEditingMessage] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  
  const isUserScrolledUp = useRef(false);
  const scrollContainerRef = useRef(null);
  const firstUnreadRef = useRef(null);
  const readingObserver = useRef(null);
  const topSensorRef = useRef(null);
  const scrollMetrics = useRef({ oldHeight: 0, oldTop: 0, activeChatId: null });
  const observerRef = useRef(null);
  const intervalRef = useRef(null);
  const isMarkingRef = useRef(false);

  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState('');
  
  const [forwardModal, setForwardModal] = useState({ 
    visible: false, 
    messageId: null,
    text: '',
    mediaUrl: null,
    mediaType: null
  });
  const [forwardSearch, setForwardSearch] = useState('');
  const reactionClickRef = useRef(false);
  const reactionTimeoutRef = useRef(null);

  // ✅ ФУНКЦИЯ ЗАГРУЗКИ ЗАКРЕПЛЕННЫХ
  const fetchPinnedMessages = async () => {
    if (!activeChatId) return;
    
    setPinnedLoading(true);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      
      if (activeChatId.startsWith('channel_')) {
        const channelId = activeChatId.replace('channel_', '');
        params.append('channelId', channelId);
      } else if (activeChatId.startsWith('chat_')) {
        const chatId = activeChatId.replace('chat_', '');
        params.append('chatId', chatId);
      } else {
        return;
      }

      const response = await fetch(
        `${API_BASE_URL}/api/messages/pinned?${params}`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setPinnedMessages(data);
      }
    } catch (error) {
      console.error('Ошибка загрузки закрепленных:', error);
    } finally {
      setPinnedLoading(false);
    }
  };

  // ✅ ЗАГРУЖАЕМ ЗАКРЕПЛЕННЫЕ ПРИ СМЕНЕ ЧАТА
  useEffect(() => {
    if (activeChatId) {
      fetchPinnedMessages();
    }
  }, [activeChatId]);

  // ✅ ОБРАБОТЧИК ЗАКРЕПЛЕНИЯ ЧЕРЕЗ СОКЕТ
// ✅ ИСПРАВЛЕННЫЙ useEffect для закрепленных
useEffect(() => {
    if (!socketRef?.current) return;

    const handleMessagePinned = (data) => {
        console.log('📌 Событие message_pinned:', data);
        
        setMessages(prev => prev.map(msg => {
            if (msg.id === data.messageId) {
                return { ...msg, isPinned: data.isPinned };
            }
            return msg;
        }));

        fetchPinnedMessages();
    };

    socketRef.current.on('message_pinned', handleMessagePinned);

    return () => {
        socketRef.current?.off('message_pinned', handleMessagePinned);
    };
}, [socketRef?.current]); // ✅ используем socketRef?.current вместо socketRef


  // ✅ ОБРАБОТЧИК РЕДАКТИРОВАНИЯ ЧЕРЕЗ СОКЕТ
useEffect(() => {
  if (!socketRef?.current) return;

 const handleMessageEdited = (data) => {
  console.log('✏️ Событие message_edited:', data);
  
  setMessages(prev => prev.map(msg => {
    // ✅ ЗАЩИТА: НЕ ОБНОВЛЯЕМ ЕСЛИ УДАЛЕНО
    if (msg.id === data.messageId && msg.isDeleted !== true) {
      return { ...msg, text: data.text, edited: true };
    }
    return msg;
  }));
};

  socketRef.current.on('message_edited', handleMessageEdited);

  return () => {
    socketRef.current?.off('message_edited', handleMessageEdited);
  };
}, [socketRef]);

  // ✅ ФУНКЦИЯ ЗАКРЕПЛЕНИЯ
  const handlePinMessage = async (messageId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${API_BASE_URL}/api/messages/${messageId}/pin`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Ошибка закрепления');
      }

      const data = await response.json();
      console.log('📌 Сообщение закреплено:', data);

      setMessages(prev => prev.map(msg => {
        if (msg.id === messageId) {
          return { ...msg, isPinned: data.isPinned };
        }
        return msg;
      }));

      fetchPinnedMessages();

    } catch (error) {
      console.error('❌ Ошибка:', error);
      alert('Не удалось закрепить сообщение: ' + error.message);
    }
  };

  // ✅ СЛУШАТЕЛЬ УДАЛЕНИЯ СООБЩЕНИЙ
useEffect(() => {
    if (!socketRef?.current) return;

    const handleMessageDeleted = (data) => {
        console.log('🗑️ [ChatArea] Получено событие message_deleted:', data);
        
        // ✅ ОБНОВЛЯЕМ ЛОКАЛЬНЫЙ СТЕЙТ СООБЩЕНИЙ
        setMessages(prev => {
            return prev.map(msg => {
                if (msg.id === data.messageId) {
                    return {
                        ...msg,
                        text: "Сообщение удалено",
                        mediaUrl: null,
                        mediaType: null,
                        isDeleted: true,
                        isForwarded: false,
                        reactions: [],
                        threads: []
                    };
                }
                return msg;
            });
        });
    };

    socketRef.current.on('message_deleted', handleMessageDeleted);

    return () => {
        socketRef.current?.off('message_deleted', handleMessageDeleted);
    };
}, [socketRef, setMessages]);

  // ✅ ФУНКЦИЯ РЕДАКТИРОВАНИЯ СООБЩЕНИЯ
  const handleEditMessage = async () => {
    if (!editingMessage || !editingMessage.text?.trim()) return;
    
    setIsEditing(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${API_BASE_URL}/api/messages/${editingMessage.id}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ text: editingMessage.text.trim() })
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Ошибка редактирования');
      }

      const data = await response.json();
      
      setMessages(prev => prev.map(msg => {
        if (msg.id === editingMessage.id) {
          return { ...msg, text: data.message.text, edited: true };
        }
        return msg;
      }));

      setEditingMessage(null);
    } catch (error) {
      console.error('❌ Ошибка:', error);
      alert('Не удалось отредактировать сообщение: ' + error.message);
    } finally {
      setIsEditing(false);
    }
  };

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

  useEffect(() => {
    const handleCloseMenu = () => setContextMenu({ visible: false, x: 0, y: 0, msgId: null });
    window.addEventListener('click', handleCloseMenu);
    return () => window.removeEventListener('click', handleCloseMenu);
  }, []);

  // ✅ СЛУШАТЕЛЬ TYPING
  useEffect(() => {
    console.log('🔥 [ChatArea] useEffect с socket отработал, activeChatId:', activeChatId);
    
    if (!socketRef?.current) {
      console.log('❌ [ChatArea] socketRef.current = null');
      return;
    }

    const socket = socketRef.current;
    console.log('✅ [ChatArea] socket есть, добавляю слушатели');

    const handleTyping = (data) => {
      console.log('📝 [ChatArea] ПОЛУЧЕНО событие typing:', data);
      console.log('📝 [ChatArea] Текущий activeChatId:', activeChatId);
      console.log('📝 [ChatArea] senderId:', data.senderId, 'currentUserId:', currentUserId);
      
      if (Number(data.senderId) === Number(currentUserId)) {
        console.log('⚠️ [ChatArea] Это я печатаю, игнорирую');
        return;
      }
      
      if (data.activeChatId !== activeChatId) {
        console.log(`⚠️ [ChatArea] Событие из другого чата (${data.activeChatId}), игнорирую (активный: ${activeChatId})`);
        return;
      }
      
      console.log('✅ [ChatArea] Устанавливаю localTypingUser:', data);
      setLocalTypingUser(data);
    };

    const handleStopTyping = (data) => {
      console.log('📝 [ChatArea] ПОЛУЧЕНО событие stop_typing:', data);
      
      if (data.activeChatId !== activeChatId) {
        console.log(`⚠️ [ChatArea] stop_typing из другого чата, игнорирую`);
        return;
      }
      
      console.log('✅ [ChatArea] Сбрасываю localTypingUser');
      setLocalTypingUser(null);
    };

    socket.on('typing', handleTyping);
    socket.on('stop_typing', handleStopTyping);

    return () => {
      console.log('🧹 [ChatArea] Удаляю слушатели');
      socket.off('typing', handleTyping);
      socket.off('stop_typing', handleStopTyping);
    };
  }, [socketRef, currentUserId, activeChatId]);

  useEffect(() => {
    setIsPositioning(true);
    isLockingNewMessages.current = true;
  }, [activeChatId]);

  const lastProcessedChatId = useRef(null);
  const isLockingNewMessages = useRef(false);

  useEffect(() => {
    if (!messages || messages.length === 0) return;
    
    const container = scrollContainerRef.current;
    if (!container) return;

    if (lastProcessedChatId.current !== activeChatId) {
      lastProcessedChatId.current = activeChatId;
      
      setTimeout(() => {
        if (container) {
          container.scrollTop = container.scrollHeight;
          isUserScrolledUp.current = false;
          setShowScrollBtn(false);
          setUnreadCountWhileReading(0);
        }
      }, 300);
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
    const maxChecks = SCROLL_CONFIG.MAX_CHECKS;

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

  const firstUnreadMsg = (messages || []).find(m => {
    if (!m || m.isDeleted === true) return false;
    const isForeign = String(m.senderId) !== String(currentUserId);
    if (!isForeign) return false;

    const cleanActiveId = String(activeChatId).replace('user_', '').replace('channel_', '');

    if (String(activeChatId).startsWith('channel_')) {
      const isChannelMsg = m.channelId && String(m.channelId) === cleanActiveId;
      return isChannelMsg && m.status !== 'read' && m.isRead !== true;
    }
    
    if (String(activeChatId).startsWith('user_')) {
      const isDirectMsg = String(m.senderId) === cleanActiveId;
      return isDirectMsg && (m.status === 'unread' || m.status !== 'read');
    }
    
    if (activeChatId === 'chat_general') {
      return !m.channelId && !m.receiverId && m.status !== 'read' && m.isRead !== true;
    }

    return false;
  });

  useEffect(() => {
    if (!firstUnreadMsg) {
      if (readingObserver.current) readingObserver.current.disconnect();
      return;
    }

    if (readingObserver.current) readingObserver.current.disconnect();

    readingObserver.current = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && !isPositioning) {
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

  const handleScroll = (e) => {
    const container = e.currentTarget || scrollContainerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;

    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    if (distanceFromBottom > 200) {
      isUserScrolledUp.current = true;
      setShowScrollBtn(true);
    } else {
      isUserScrolledUp.current = false;
      setShowScrollBtn(false);
      setUnreadCountWhileReading(0);
      
if (distanceFromBottom < 50 && onMarkAsRead && activeChatId && !isMarkingRef.current) {
    isMarkingRef.current = true;
    
    if (activeChatId.startsWith('channel_')) {
        onMarkAsRead('channel', activeChatId.replace('channel_', ''));
    } else if (activeChatId.startsWith('chat_')) {
        onMarkAsRead('chat', activeChatId.replace('chat_', ''));
    } else if (activeChatId.startsWith('user_')) {
        onMarkAsRead('private', activeChatId.replace('user_', ''));
    }
    setTimeout(() => {
        isMarkingRef.current = false;
    }, 500);
      }
    }

    if (
      scrollTop < 40 && 
      !isPositioning && 
      !isHistoryLoading && 
      hasMoreHistory && 
      scrollHeight > clientHeight &&
      scrollMetrics.current.oldHeight === 0
    ) {
      if (typeof onLoadMoreHistory === 'function') {
        scrollMetrics.current.oldHeight = scrollHeight;
        scrollMetrics.current.oldTop = scrollTop;
        setIsPositioning(true);
        onLoadMoreHistory();
      }
    }
  };

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

 const handleForward = (targetChatId) => {
    const { text, mediaUrl, mediaType } = forwardModal;
    
    if (!targetChatId) {
        alert('❌ Выберите чат для пересылки');
        return;
    }

    // ✅ ПРОВЕРКА: ЕСЛИ ЭТО КАНАЛ — ПРОВЕРЯЕМ ПРАВА
    if (targetChatId.startsWith('channel_')) {
        const channelId = targetChatId.replace('channel_', '');
        const channel = channelsProp?.find(c => c.id === parseInt(channelId));
        
        // Проверяем, есть ли канал в списке (пользователь участник)
        if (!channel) {
            alert('❌ Вы не участник этого канала');
            return;
        }
        
        // Проверяем, может ли пользователь отправлять в канал (админ или создатель)
        const isAdmin = channel.creatorId === currentUserId || 
                        channel.members?.some(m => m.userId === currentUserId && m.role === 'admin');
        
        if (!isAdmin) {
            alert('❌ Только администраторы могут отправлять сообщения в этот канал');
            return;
        }
    }
    
    if (socketRef.current && socketRef.current.connected) {
        socketRef.current.emit('send_message', {
            text: text || '📤 Пересланное сообщение',
            mediaUrl: mediaUrl,
            mediaType: mediaType,
            activeChatId: targetChatId,
            isForwarded: true
        });
        
        // ✅ ПЕРЕКЛЮЧАЕМСЯ НА ЧАТ, КУДА ПЕРЕСЛАЛИ
        if (typeof onSelectChat === 'function') {
            onSelectChat(targetChatId);
        }
        
        setForwardModal({ visible: false, messageId: null, text: '', mediaUrl: null, mediaType: null });
    } else {
        alert('❌ Нет подключения к серверу');
    }
};

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

  const chatAvatar = activeChatData?.avatar || activeChat?.avatar || (activeChatId === 'chat_general' ? '💬' : '👤');
  const isDataLoading = !activeChatData && !activeChat && activeChatId !== 'chat_general';

  const isCurrentChatTyping = localTypingUser && (
    (localTypingUser.isGeneral && activeChatId === 'chat_general' && Number(localTypingUser.senderId) !== Number(currentUserId)) ||
    (!localTypingUser.isGeneral && activeChatId?.toString().replace('user_', '') === localTypingUser.senderId?.toString())
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

  const pinnedCount = pinnedMessages.length;

  return (
    <div className={`flex-col flex-1 h-full bg-zinc-100 dark:bg-zinc-900 ${activeChatId ? 'flex' : 'hidden md:flex'}`}>
      {!activeChatId ? (
        <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 p-4 text-center bg-zinc-100 dark:bg-zinc-900">
          <span className="text-4xl mb-2">💬</span>
          <p className="text-sm">Выберите чат, чтобы начать общение</p>
        </div>
      ) : (
        <div className="flex flex-col h-full relative">
          
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
              
              <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-lg mr-3 shadow-inner group-hover:scale-105 transition-transform duration-200 overflow-hidden">
                {chatAvatar && typeof chatAvatar === 'string' && chatAvatar.startsWith('/uploads/') ? (
                  <img 
                    src={getAvatarUrl(chatAvatar)} 
                    alt={correctChatName} 
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.parentElement.textContent = correctChatName?.[0]?.toUpperCase() || '💬';
                    }}
                  />
                ) : (
                  <span>{chatAvatar}</span>
                )}
              </div>
              
              <div>
                <h2 className="font-semibold text-sm text-zinc-800 dark:text-white group-hover:text-emerald-500 transition-colors">
                  {correctChatName}
                </h2>
                
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

                {pinnedCount > 0 && (
                  <button
                    onClick={() => setShowPinnedList(!showPinnedList)}
                    className="ml-2 text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full hover:bg-amber-200 dark:hover:bg-amber-900/50 transition flex items-center gap-1"
                  >
                    <span>📌</span>
                    <span>{pinnedCount}</span>
                  </button>
                )}
              </div>
            </div>
            
            <button 
              onClick={onToggleProfile} 
              className="p-2 text-zinc-400 dark:text-zinc-500 hover:text-zinc-800 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition"
            >
              ℹ️
            </button>
          </div>

          <div 
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar bg-white dark:bg-zinc-950/20"
          >
            <div ref={topSensorRef} className="h-1 w-full flex items-center justify-center text-xs text-zinc-500/50">
              {isHistoryLoading ? '⏳ Загрузка истории...' : ''}
            </div>

            {/* 📌 СПИСОК ЗАКРЕПЛЕННЫХ */}
            {showPinnedList && (
              <div className="mb-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/30 rounded-xl overflow-hidden">
                <div className="p-3 border-b border-amber-200 dark:border-amber-800/30 flex justify-between items-center">
                  <h4 className="text-sm font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-2">
                    <span>📌</span>
                    Закрепленные сообщения ({pinnedMessages.length})
                  </h4>
                  <button
                    onClick={() => setShowPinnedList(false)}
                    className="text-amber-500 hover:text-amber-700 dark:hover:text-amber-300 transition"
                  >
                    ✕
                  </button>
                </div>
                <div className="p-2 max-h-60 overflow-y-auto">
                  {pinnedLoading ? (
                    <div className="text-center py-4 text-zinc-500 dark:text-zinc-400">Загрузка...</div>
                  ) : pinnedMessages.length === 0 ? (
                    <div className="text-center py-4 text-sm text-zinc-400 dark:text-zinc-500">
                      Нет закрепленных сообщений
                    </div>
                  ) : (
                    pinnedMessages.map(msg => (
                      <div
                        key={msg.id}
                        className="p-3 bg-white dark:bg-zinc-900 rounded-lg mb-2 border border-amber-200/50 dark:border-amber-800/20 hover:bg-amber-50/50 dark:hover:bg-amber-950/30 cursor-pointer transition"
                        onClick={() => {
                          const element = document.querySelector(`[data-message-id="${msg.id}"]`);
                          if (element) {
                            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            element.classList.add('highlight-animation');
                            setTimeout(() => element.classList.remove('highlight-animation'), 2000);
                          }
                          setShowPinnedList(false);
                        }}
                      >
                        <div className="flex items-start gap-2">
                          <span className="text-amber-500 dark:text-amber-400 text-sm mt-0.5">📌</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                                {msg.sender?.username || 'Unknown'}
                              </span>
                              <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
                                {new Date(msg.createdAt).toLocaleString()}
                              </span>
                            </div>
                            <p className="text-sm text-zinc-700 dark:text-zinc-300 mt-1">
                              {msg.text || '📎 Медиафайл'}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {Array.isArray(messages) && messages.length > 0 ? (



messages.map((msg, index) => {
    if (!msg) return null;
    
    const stringChatId = activeChatId ? activeChatId.toString() : '';
    let shouldShow = false;

    // ✅ ФИЛЬТРАЦИЯ ПО ТИПУ ЧАТА
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

    const uniqueKey = `msg-${msg.id || msg._id || index}-${msg.threads?.length || 0}-${index}`;

    // ✅ ПРОВЕРКА НА УДАЛЕНИЕ — ПЕРВАЯ!
    if (msg.isDeleted) {
        return (
            <div key={uniqueKey} className="flex w-full mb-2 justify-center">
                <div className="bg-zinc-100 dark:bg-zinc-800/50 text-zinc-400 dark:text-zinc-500 text-xs px-4 py-1.5 rounded-full border border-zinc-200 dark:border-zinc-700/50 select-none">
                    🗑️ Сообщение удалено
                </div>
            </div>
        );
    }
                
                const currentFileUrl = msg.fileUrl || msg.imageUrl || msg.mediaUrl || msg.image || '';
                const currentAudioUrl = msg.audioUrl || msg.voiceUrl || msg.audio || '';
                const currentText = msg.text || msg.content || msg.message || '';

                const isAudioFile = 
                  currentAudioUrl !== '' ||
                  (Array.isArray(MEDIA_TYPES?.AUDIO) && MEDIA_TYPES.AUDIO.some(ext => currentFileUrl.toLowerCase().endsWith(ext))) ||
                  currentText.includes('Голосовое сообщение');

                const isOwn = Number(msg.senderId) === Number(currentUserId);

                return (
                  <div 
                    key={uniqueKey}
                    data-message-id={msg.id}
                    className={`flex w-full mb-2 ${isOwn ? 'justify-end' : 'justify-start'}`}
                  >
                    <div 
                      className={`max-w-[70%] rounded-2xl px-4 py-2 shadow-sm relative group text-sm ${
                        isOwn
                          ? 'bg-emerald-600 text-white rounded-br-none'
                          : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 rounded-bl-none border border-zinc-200/60 dark:border-transparent'
                      } ${msg.isPinned ? 'ring-2 ring-amber-400 dark:ring-amber-500 ring-offset-1 dark:ring-offset-zinc-900' : ''}`}
                      onContextMenu={(e) => handleContextMenu(e, msg.id)}
                    >
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

                      {isAudioFile && (
                        <div className="mb-2 p-1 bg-zinc-100/80 dark:bg-zinc-950/60 rounded-xl flex items-center gap-2 min-w-[240px] border border-zinc-200 dark:border-zinc-800/50">
                          <audio 
                            src={currentAudioUrl || currentFileUrl} 
                            controls 
                            className="w-full h-8 accent-emerald-500" 
                          />
                        </div>
                      )}

                      {currentText && !currentText.includes('Голосовое сообщение') && (
                        <p className="break-words whitespace-pre-wrap">{currentText}</p>
                      )}
                      
                      <div className={`text-[10px] font-normal flex items-center justify-end gap-1 mt-1 select-none ${
                        isOwn
                          ? 'text-emerald-100/90' 
                          : 'text-zinc-400 dark:text-zinc-500' 
                      }`}>
                        {msg.isForwarded && (
                          <span className="text-[9px] text-zinc-400 dark:text-zinc-500 font-medium mr-1 flex items-center gap-0.5">
                            <span className="text-[10px]">📤</span> Переслано
                          </span>
                        )}
                        
                        {msg.isPinned && (
                          <span className="text-amber-500 dark:text-amber-400 text-[10px] font-medium flex items-center gap-0.5">
                            📌
                          </span>
                        )}
                        
                        {/* ✏️ ПЛАШКА "ИЗМЕНЕНО" */}
                        {msg.edited && (
                          <span className="text-[9px] text-zinc-400 dark:text-zinc-500 italic">
                            (изменено)
                          </span>
                        )}
                        
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

                      {!msg.isDeleted && msg.reactions && msg.reactions.length > 0 && (
                        <div className="flex items-center gap-0.5 mt-1.5 flex-wrap">
                          {Object.entries(
                            msg.reactions.reduce((acc, r) => {
                              acc[r.type] = (acc[r.type] || 0) + 1;
                              return acc;
                            }, {})
                          ).map(([emoji, count]) => (
                            <span 
                              key={emoji} 
                              className="inline-flex items-center gap-0.5 text-sm px-1.5 py-0.5 rounded-full 
                                bg-zinc-100/80 dark:bg-zinc-800/60 
                                border border-zinc-200/50 dark:border-zinc-700/30
                                shadow-sm"
                            >
                              <span className="text-base leading-none">{emoji}</span>
                              <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
                                {count}
                              </span>
                            </span>
                          ))}
                        </div>
                      )}

                      {!msg.isDeleted && msg.threads && msg.threads.length > 0 && (
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
                  </div>
                );
              })
            ) : (
              <div className="text-center text-zinc-500 py-10">
                💬 Нет сообщений в этом чате
              </div>
            )}

            {isTyping && (
              <div className="flex justify-start mb-2 w-full">
                <div className="bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 rounded-2xl rounded-bl-none px-4 py-2.5 shadow-sm flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                  <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                  <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce"></span>
                </div>
              </div>
            )}

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
                        `${API_BASE_URL}/api/messages/${replyingTo.messageId}/threads?activeChatId=${activeChatId}`,
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

            <div ref={messagesEndRef} className="h-0 w-full" />
          </div>

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

          {/* ✏️ МОДАЛКА РЕДАКТИРОВАНИЯ */}
          {editingMessage && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 w-full max-w-md shadow-2xl border border-zinc-200 dark:border-zinc-800">
                <h3 className="text-lg font-bold text-zinc-800 dark:text-white mb-4 flex items-center gap-2">
                  <span>✏️</span> Редактировать сообщение
                </h3>
                <textarea
                  value={editingMessage.text}
                  onChange={(e) => setEditingMessage({ ...editingMessage, text: e.target.value })}
                  className="w-full bg-zinc-100 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-xl p-3 text-sm focus:outline-none focus:border-emerald-500 text-zinc-800 dark:text-white resize-none min-h-[80px]"
                  autoFocus
                />
                <div className="flex justify-end gap-2 mt-4">
                  <button
                    onClick={() => setEditingMessage(null)}
                    className="px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition"
                    disabled={isEditing}
                  >
                    Отмена
                  </button>
                  <button
                    onClick={handleEditMessage}
                    disabled={!editingMessage.text.trim() || isEditing}
                    className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition flex items-center gap-2"
                  >
                    {isEditing ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                        Сохранение...
                      </>
                    ) : (
                      'Сохранить'
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 📤 МОДАЛКА ПЕРЕСЫЛКИ */}
          {forwardModal.visible && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 w-full max-w-md shadow-2xl border border-zinc-200 dark:border-zinc-800 max-h-[80vh] flex flex-col">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold text-zinc-800 dark:text-white">
                    📤 Переслать сообщение
                  </h3>
                  <button
                    onClick={() => setForwardModal({ visible: false, messageId: null, text: '', mediaUrl: null, mediaType: null })}
                    className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition text-xl leading-none"
                  >
                    ✕
                  </button>
                </div>
                
                <div className="mb-3 p-3 bg-zinc-100 dark:bg-zinc-800/60 rounded-xl text-sm text-zinc-600 dark:text-zinc-300 max-h-16 overflow-y-auto border border-zinc-200/50 dark:border-zinc-700/50">
                  {forwardModal.text || '📎 Медиафайл'}
                </div>

                <div className="relative mb-3">
                  <input 
                    type="text"
                    value={forwardSearch}
                    onChange={(e) => setForwardSearch(e.target.value)}
                    placeholder="🔍 Поиск чатов..."
                    className="w-full bg-zinc-100 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-emerald-500 text-zinc-800 dark:text-white placeholder-zinc-400"
                  />
                </div>

                <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
                  {Array.isArray(chatsProp) && chatsProp
    .filter(chat => chat.name.toLowerCase().includes(forwardSearch.toLowerCase()))
    .map(chat => {
        // Проверяем, является ли аватарка путем к файлу
        const isImageAvatar = chat.avatar && typeof chat.avatar === 'string' && chat.avatar.startsWith('/uploads/');
        const avatarUrl = isImageAvatar ? getAvatarUrl(chat.avatar) : null;
        
        return (
            <button
                key={chat.id}
                onClick={() => handleForward(chat.id)}
                className="w-full text-left px-3 py-2.5 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-xl transition flex items-center gap-3 text-sm border border-transparent hover:border-emerald-200 dark:hover:border-emerald-800/30"
            >
                {/* Аватар с поддержкой картинок */}
                <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {isImageAvatar ? (
                        <img 
                            src={avatarUrl} 
                            alt={chat.name} 
                            className="w-full h-full object-cover"
                            onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.parentElement.textContent = chat.name?.[0]?.toUpperCase() || '👤';
                            }}
                        />
                    ) : (
                        <span className="text-lg">{chat.avatar || '👤'}</span>
                    )}
                </div>
                <span className="font-medium text-zinc-700 dark:text-zinc-300">{chat.name}</span>
                <span className="ml-auto text-[10px] text-zinc-400 dark:text-zinc-500">приватный</span>
            </button>
        );
    })}
                  
{Array.isArray(groupChatsProp) && groupChatsProp.length > 0 && (
    <>
        <div className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wider pt-2 pb-1 px-1 font-medium">
            👥 Группы
        </div>
        {groupChatsProp
            .filter(chat => chat.name.toLowerCase().includes(forwardSearch.toLowerCase()))
            .map(chat => {
                const isImageAvatar = chat.avatar && typeof chat.avatar === 'string' && chat.avatar.startsWith('/uploads/');
                const avatarUrl = isImageAvatar ? getAvatarUrl(chat.avatar) : null;
                
                return (
                    <button
                        key={chat.id}
                        onClick={() => handleForward(chat.id)}
                        className="w-full text-left px-3 py-2.5 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-xl transition flex items-center gap-3 text-sm border border-transparent hover:border-emerald-200 dark:hover:border-emerald-800/30"
                    >
                        <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center overflow-hidden flex-shrink-0">
                            {isImageAvatar ? (
                                <img 
                                    src={avatarUrl} 
                                    alt={chat.name} 
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                        e.target.style.display = 'none';
                                        e.target.parentElement.textContent = chat.name?.[0]?.toUpperCase() || '💬';
                                    }}
                                />
                            ) : (
                                <span className="text-lg">{chat.avatar || '💬'}</span>
                            )}
                        </div>
                        <span className="font-medium text-zinc-700 dark:text-zinc-300">{chat.name}</span>
                        <span className="ml-auto text-[10px] text-zinc-400 dark:text-zinc-500">группа</span>
                    </button>
                );
            })
        }
    </>
)}

                  {Array.isArray(channelsProp) && channelsProp.length > 0 && (
    <>
        <div className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wider pt-2 pb-1 px-1 font-medium">
            📢 Каналы
        </div>
        {channelsProp
            .filter(channel => channel.name.toLowerCase().includes(forwardSearch.toLowerCase()))
            .map(channel => {
                const isImageAvatar = channel.avatar && typeof channel.avatar === 'string' && channel.avatar.startsWith('/uploads/');
                const avatarUrl = isImageAvatar ? getAvatarUrl(channel.avatar) : null;
                
                return (
                    <button
                        key={channel.id}
                        onClick={() => handleForward(`channel_${channel.id}`)}
                        className="w-full text-left px-3 py-2.5 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-xl transition flex items-center gap-3 text-sm border border-transparent hover:border-emerald-200 dark:hover:border-emerald-800/30"
                    >
                        <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center overflow-hidden flex-shrink-0">
                            {isImageAvatar ? (
                                <img 
                                    src={avatarUrl} 
                                    alt={channel.name} 
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                        e.target.style.display = 'none';
                                        e.target.parentElement.textContent = channel.name?.[0]?.toUpperCase() || '📢';
                                    }}
                                />
                            ) : (
                                <span className="text-lg">{channel.avatar || '📢'}</span>
                            )}
                        </div>
                        <span className="font-medium text-zinc-700 dark:text-zinc-300">{channel.name}</span>
                        <span className="ml-auto text-[10px] text-zinc-400 dark:text-zinc-500">канал</span>
                    </button>
                );
            })
        }
    </>
)}

                  {(!chatsProp || chatsProp.length === 0) && 
                   (!groupChatsProp || groupChatsProp.length === 0) && 
                   (!channelsProp || channelsProp.length === 0) && (
                    <div className="text-center text-zinc-400 py-8 text-sm">
                      💬 Нет доступных чатов для пересылки
                    </div>
                  )}
                  
                  {((chatsProp && chatsProp.filter(c => c.name.toLowerCase().includes(forwardSearch.toLowerCase())).length === 0) &&
                   (groupChatsProp && groupChatsProp.filter(c => c.name.toLowerCase().includes(forwardSearch.toLowerCase())).length === 0) &&
                   (channelsProp && channelsProp.filter(c => c.name.toLowerCase().includes(forwardSearch.toLowerCase())).length === 0)) && (
                    <div className="text-center text-zinc-400 py-8 text-sm">
                      🔍 Ничего не найдено
                    </div>
                  )}
                </div>

                <div className="flex justify-end mt-4 pt-3 border-t border-zinc-200 dark:border-zinc-800">
                  <button
                    onClick={() => setForwardModal({ visible: false, messageId: null, text: '', mediaUrl: null, mediaType: null })}
                    className="px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition"
                  >
                    Отмена
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* КОНТЕКСТНОЕ МЕНЮ */}
          {contextMenu.visible && (() => {
            const currentMsg = messages?.find(m => m && (m.id === contextMenu.msgId || m._id === contextMenu.msgId));
            if (!currentMsg) return null;

            const isMsgMe = Number(currentMsg.senderId) === Number(currentUserId);
            const isChannelCreator = activeChatData?.type === 'channel' && activeChatData?.creatorId === Number(currentUserId);
            const isGroupCreator = activeChatData?.type === 'group' && activeChatData?.creatorId === Number(currentUserId);
            const canDelete = isMsgMe || isChannelCreator || isGroupCreator;
            const textToCopy = currentMsg.text || currentMsg.content || currentMsg.message || '';

            return (
              <div 
                className="fixed bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/80 py-1.5 w-56 rounded-xl shadow-2xl z-50 text-sm text-zinc-700 dark:text-zinc-200 overflow-hidden" 
                style={{ 
                  top: Math.min(contextMenu.y, window.innerHeight - 480), 
                  left: Math.min(contextMenu.x, window.innerWidth - 240) 
                }}
              >
                {!currentMsg.isDeleted && textToCopy !== '' && (
                  <button 
                    onClick={() => {
                      handleCopy(textToCopy);
                      setContextMenu({ visible: false, x: 0, y: 0, msgId: null });
                    }} 
                    className="w-full text-left px-4 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-700/60 transition flex items-center gap-3"
                  >
                    <span className="text-base">📋</span>
                    <span>Копировать текст</span>
                  </button>
                )}

                {/* ✏️ РЕДАКТИРОВАТЬ (только свои сообщения) */}
                {!currentMsg.isDeleted && isMsgMe && (
                  <button 
                    onClick={() => {
                      setEditingMessage({
                        id: currentMsg.id,
                        text: currentMsg.text || ''
                      });
                      setContextMenu({ visible: false, x: 0, y: 0, msgId: null });
                    }} 
                    className="w-full text-left px-4 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-700/60 transition flex items-center gap-3"
                  >
                    <span className="text-base">✏️</span>
                    <span>Редактировать</span>
                  </button>
                )}

                {!currentMsg.isDeleted && (
                  <button 
                    onClick={() => {
                      setReplyingTo({ messageId: currentMsg.id, text: currentMsg.text || 'Сообщение' });
                      setContextMenu({ visible: false, x: 0, y: 0, msgId: null });
                    }} 
                    className="w-full text-left px-4 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-700/60 transition flex items-center gap-3"
                  >
                    <span className="text-base">💬</span>
                    <span>Ответить</span>
                  </button>
                )}

                {!currentMsg.isDeleted && (
                  <button 
                    onClick={() => {
                      setForwardModal({
                        visible: true,
                        messageId: currentMsg.id,
                        text: currentMsg.text || '',
                        mediaUrl: currentMsg.mediaUrl || null,
                        mediaType: currentMsg.mediaType || null
                      });
                      setContextMenu({ visible: false, x: 0, y: 0, msgId: null });
                    }} 
                    className="w-full text-left px-4 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-700/60 transition flex items-center gap-3"
                  >
                    <span className="text-base">📤</span>
                    <span>Переслать</span>
                  </button>
                )}

                {!currentMsg.isDeleted && (
                  <>
                    <div className="border-t border-zinc-200 dark:border-zinc-700/50 my-1" />
                    <button 
                      onClick={() => {
                        handlePinMessage(currentMsg.id);
                        setContextMenu({ visible: false, x: 0, y: 0, msgId: null });
                      }} 
                      className={`w-full text-left px-4 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-700/60 transition flex items-center gap-3 ${
                        currentMsg.isPinned ? 'text-amber-500 dark:text-amber-400' : ''
                      }`}
                    >
                      <span className="text-base">📌</span>
                      <span>{currentMsg.isPinned ? 'Открепить' : 'Закрепить'}</span>
                      {currentMsg.isPinned && (
                        <span className="ml-auto text-[10px] text-amber-500 dark:text-amber-400 font-medium">✓</span>
                      )}
                    </button>
                  </>
                )}

                {!currentMsg.isDeleted && (
                  <div className="border-t border-zinc-200 dark:border-zinc-700/50 my-1" />
                )}

                <div className="px-3 py-2">
                  <div className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1.5 font-medium">
                    Реакции
                  </div>
<div className="flex gap-1 flex-wrap">
    {['😊', '😂', '❤️', '🔥', '👏', '😮', '💪', '🎉', '👍', '👎'].map(emoji => {
        const isActive = currentMsg.reactions?.some(r => r.userId === currentUserId && r.type === emoji);
        const count = currentMsg.reactions?.filter(r => r.type === emoji).length || 0;

        return (
            <button
                key={emoji}
                disabled={reactionClickRef.current}
                onClick={async () => {
                    // ✅ ЗАЩИТА ОТ ДВОЙНОГО КЛИКА
                    if (reactionClickRef.current) {
                        console.log('⏳ Пропускаю повторный клик по реакции');
                        return;
                    }
                    reactionClickRef.current = true;

                    try {
                        const token = localStorage.getItem('token');
                        const response = await fetch(
                            `${API_BASE_URL}/api/messages/${currentMsg.id}/reactions`,
                            {
                                method: 'POST',
                                headers: {
                                    'Authorization': `Bearer ${token}`,
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({ type: emoji })
                            }
                        );

                        if (!response.ok) {
                            if (response.status === 429) {
                                alert('❌ Слишком много реакций, подождите немного');
                                return;
                            }
                            throw new Error('Ошибка');
                        }

                        const data = await response.json();
                        if (setMessages) {
                            setMessages(prev =>
                                prev.map(m => {
                                    if (m.id === currentMsg.id) {
                                        return { ...m, reactions: data.reactions };
                                    }
                                    return m;
                                })
                            );
                        }
                        setContextMenu({ visible: false, x: 0, y: 0, msgId: null });
                    } catch (error) {
                        console.error('Ошибка при добавлении реакции:', error);
                    } finally {
                        // ✅ РАЗБЛОКИРУЕМ ЧЕРЕЗ 500мс
                        if (reactionTimeoutRef.current) {
                            clearTimeout(reactionTimeoutRef.current);
                        }
                        reactionTimeoutRef.current = setTimeout(() => {
                            reactionClickRef.current = false;
                            reactionTimeoutRef.current = null;
                        }, 500);
                    }
                }}
                className={`text-lg px-1.5 py-0.5 rounded transition select-none hover:scale-110 ${
                    isActive
                        ? 'bg-emerald-100 dark:bg-emerald-900/40 ring-1 ring-emerald-400'
                        : 'hover:bg-zinc-100 dark:hover:bg-zinc-700/50'
                } ${reactionClickRef.current ? 'opacity-50 cursor-not-allowed' : ''}`}
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
                </div>

                {canDelete && (
                  <div className="border-t border-zinc-200 dark:border-zinc-700/50 my-1" />
                )}

                {canDelete && (
                  <button 
                    onClick={() => { 
                      if (window.confirm('Удалить это сообщение?')) {
                        onDeleteMessage(contextMenu.msgId); 
                      }
                      setContextMenu({ visible: false, x: 0, y: 0, msgId: null }); 
                    }} 
                    className="w-full text-left px-4 py-2 hover:bg-red-50 dark:hover:bg-red-950/40 text-red-500 dark:text-red-400 transition flex items-center gap-3"
                  >
                    <span className="text-base">🗑️</span>
                    <span>Удалить сообщение</span>
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