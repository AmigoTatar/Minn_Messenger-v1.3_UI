import React, { useState, useEffect, useRef } from 'react';

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
  currentUserId,// ID текущего юзера для проверки (isMe)
  socketRef,
  typingUser 
}) {
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, msgId: null });
  const fileInputRef = useRef(null);

  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  // --- Смарт-скролл и позиционирование ---
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [isPositioning, setIsPositioning] = useState(false); // Anti-Flicker барьер
  const [unreadCountWhileReading, setUnreadCountWhileReading] = useState(0); // Счетчик для кнопки "Вниз"
  const isUserScrolledUp = useRef(false); // Блокировка автоскролла без лишних ререндеров
  
  const scrollContainerRef = useRef(null); // Реф на контейнер со скроллом
  const firstUnreadRef = useRef(null);     // Реф на первое непрочитанное
  const readingObserver = useRef(null);


  // Закрытие меню
  useEffect(() => {
    const handleCloseMenu = () => setContextMenu({ visible: false, x: 0, y: 0, msgId: null });
    window.addEventListener('click', handleCloseMenu);
    return () => window.removeEventListener('click', handleCloseMenu);
  }, []);



      // Ищем первое непрочитанное сообщение СТРОГО внутри текущего чата/канала
  const firstUnreadMsg = (messages || []).find(m => {
    if (!m || m.senderId === undefined || m.isDeleted === true) return false;

    // 1. Проверяем, что сообщение пришло НЕ от нас
    const isForeign = String(m.senderId) !== String(currentUserId);
    if (!isForeign) return false;

    const cleanActiveId = String(activeChatId).replace('user_', '').replace('channel_', '');

    // 2. ВЕТВЛЕНИЕ ПО ТИПАМ ЧАТОВ

    // ПУБЛИЧНЫЕ КАНАЛЫ (Мягкая проверка: чужое и статус не равен 'read')
    if (activeChatId.startsWith('channel_')) {
      const isChannelMsg = m.channelId && String(m.channelId) === cleanActiveId;
      return isChannelMsg && m.status !== 'read';
    }
    
    // ПРИВАТНЫЕ ЧАТЫ (Строгая проверка: статус должен быть железно 'unread' для защиты от null в базе)
    if (activeChatId.startsWith('user_')) {
      const isDirectMsg = String(m.senderId) === cleanActiveId;
      return isDirectMsg && m.status === 'unread';
    }
    
    // ОБЩИЙ ЧАТ
    if (activeChatId === 'chat_general') {
      return !m.channelId && !m.receiverId && m.status !== 'read';
    }

    return false;
  });


  

    // Реф для блокировки сокетного автоскролла в первые мгновения открытия чата
    const lastProcessedChatId = useRef(null);
  const isLockingNewMessages = useRef(false);

  // 1. Триггер мгновенного закрытия шторки при клике на чат в сайдбаре
  useEffect(() => {
    setIsPositioning(true);
    isLockingNewMessages.current = true;
  }, [activeChatId]);



  // 🏁 ЕДИНЫЙ СИНХРОНИЗИРОВАННЫЙ ЭФФЕКТ СКРОЛЛА
  useEffect(() => {
    if (!messages || messages.length === 0) {
      if (isPositioning) setIsPositioning(false);
      return;
    }

    // СЛУЧАЙ 1: Стартовое позиционирование при смене чата
    if (lastProcessedChatId.current !== activeChatId) {
      console.log("🔄 Лог: Сообщения для нового чата отрисовались. Позиционирую...");
      
      isUserScrolledUp.current = false;
      setShowScrollBtn(false);
      setUnreadCountWhileReading(0);

      // Запрашиваем у браузера кадр анимации, чтобы дождаться перестроения DOM-структуры
      requestAnimationFrame(() => {
        // Микро-таймер на 60-80мс дает React время полностью наполнить контейнер сообщениями
        const timer = setTimeout(() => {
          
          // Проверяем наличие маркера на основе свежих данных
        if (firstUnreadMsg && firstUnreadRef.current) {
          console.log("🎯 Смарт-скролл: Прыгаю к МАРКЕРУ");
          firstUnreadRef.current.scrollIntoView({ behavior: 'auto', block: 'center' });
        } else {
          console.log("🔽 Смарт-скролл: Прижимаю В САМЫЙ НИЗ (Запасной план)");
          // Прямая манипуляция со скроллом, которая работает быстрее, чем scrollIntoView в React
          if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
          }
          messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
        }


          
          lastProcessedChatId.current = activeChatId;
          setIsPositioning(false);
          
          setTimeout(() => {
            isLockingNewMessages.current = false;
          }, 150);
        }, 80); // 80мс — гарантированное окно для рендеринга тяжелой истории сообщений

        return () => clearTimeout(timer);
      });

      return;
    }

    // СЛУЧАЙ 2: Динамический автоскролл при летящих сообщениях из сокетов
    if (!isPositioning && !isLockingNewMessages.current) {
      const lastMsg = messages[messages.length - 1];
      const isLastMsgMe = Number(lastMsg?.senderId) === Number(currentUserId);

      if (isLastMsgMe) {
        isUserScrolledUp.current = false;
        setShowScrollBtn(false);
        setUnreadCountWhileReading(0);
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 30);
      } else {
        if (isUserScrolledUp.current) {
          setUnreadCountWhileReading(prev => prev + 1);
        } else {
          setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
          }, 30);
        }
      }
    }
  }, [messages, activeChatId, isPositioning]);


  // 👀 ЭФФЕКТ ЧТЕНИЯ: Гасим плашку, когда пользователь до неё доскроллил
  useEffect(() => {
    // Если плашки на экране нет — отключаем слежку и выходим
    if (!firstUnreadMsg) {
      if (readingObserver.current) readingObserver.current.disconnect();
      return;
    }

    // Очищаем старый обсервер при переключениях
    if (readingObserver.current) readingObserver.current.disconnect();

    // Создаем новый обсервер
    readingObserver.current = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        // Если маркер виден на экране более чем на 70% и чат уже отпозиционирован
          
        if (entry.isIntersecting && !isPositioning) {
          console.log("👁️ Смарт-сенсор: Юзер увидел плашку непрочитанных!");

          // 1. Отправляем сигнал на бэкенд через сокеты
          if (socketRef.current && socketRef.current.connected) {
            socketRef.current.emit('read_messages', { 
              activeChatId, 
              currentUserId: currentUserId // 🔥 ИСПРАВЛЕНО: заменили user?.id на текущий рабочий currentUserId
            });
          }

          // 2. Локально отключаем обсервер
          readingObserver.current.disconnect();
        }

      });
    }, { root: scrollContainerRef.current, threshold: 0.7 });

    // Даем микропаузу 300мс, чтобы скролл завершился, и вешаем слежку строго на реф плашки
    const timer = setTimeout(() => {
      if (firstUnreadRef.current && readingObserver.current) {
        readingObserver.current.observe(firstUnreadRef.current);
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      if (readingObserver.current) readingObserver.current.disconnect();
    };
  }, [activeChatId, messages, isPositioning,currentUserId]); // Перезапускаем при изменении сообщений или чата


  // 🎛️ Обработчик прокрутки ленты
    const handleScroll = () => {
    if (!scrollContainerRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

    // Если пользователь поднялся выше 200px от дна чата
    if (distanceFromBottom > 200) {
      isUserScrolledUp.current = true;
      setShowScrollBtn(true);
    } else {
      isUserScrolledUp.current = false;
      setShowScrollBtn(false);
      setUnreadCountWhileReading(0);
    }
  };

  // Плавный скролл вниз по клику на кнопку
  const scrollToBottomSmooth = () => {
    isUserScrolledUp.current = false;
    setShowScrollBtn(false);
    setUnreadCountWhileReading(0);
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };


  /*----------------------------------------------------------------------------------------*-*/

  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } else {
      clearInterval(timerRef.current);
      setRecordingTime(0);
    }
    return () => clearInterval(timerRef.current);
  }, [isRecording]);

  const handleContextMenu = (e, msgId) => {
    e.preventDefault();
    setContextMenu({ visible: true, x: e.pageX, y: e.pageY, msgId });
  };

  const handleCopy = (text) => {
    if (text) navigator.clipboard.writeText(text);
  };

       const handleFileChange = async (e) => {
    const file = e.target.files[0]; // Исправлено: берем первый файл из массива
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Пожалуйста, выберите изображение');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('http://localhost:5001/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Ошибка при загрузке файла');
      
      const data = await response.json();
      console.log('📦 Ответ сервера на загрузку картинки:', data);
      
      // Бэкенд возвращает fileUrl! Берем его напрямую
      const finalUrl = data.fileUrl;

      if (!finalUrl) {
        throw new Error('Бэкенд не вернул fileUrl');
      }
      
      // Отправляем ОДИН раз через проп
      if (typeof onSendImage === 'function') {
        onSendImage(finalUrl); 
      }

    } catch (error) {
      console.error('Ошибка загрузки медиа через Multer:', error);
      alert('Не удалось отправить изображение');
    }

    e.target.value = ''; // Сбрасываем инпут
  };




    const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];
      
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        
        //  Переводим Blob в файл для Multer
        const audioFile = new File([audioBlob], 'voice.webm', { type: 'audio/webm' });
        const formData = new FormData();
        formData.append('file', audioFile);

                try {
          const response = await fetch('http://localhost:5001/api/upload', {
            method: 'POST',
            body: formData,
          });

          if (!response.ok) throw new Error('Ошибка при загрузке аудио');
          
          // Делаем имя переменной уникальным для этой функции, используя const
          const audioResponseData = await response.json();
          console.log('📦 Ответ сервера на загрузку аудио:', audioResponseData);
        
          // Бэкенд возвращает fileUrl
          const finalAudioUrl = audioResponseData.fileUrl;

          if (!finalAudioUrl) {
            throw new Error('Бэкенд не вернул fileUrl для аудио');
          }

          if (typeof onSendAudio === 'function') {
            onSendAudio(finalAudioUrl);
          }
        } catch (uploadError) {
          console.error('Ошибка сохранения аудио на сервере:', uploadError);
          alert('Не удалось отправить голосовое сообщение');
        }

        // Выключаем микрофон, чтобы иконка записи в браузере погасла
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
  // Безопасное каскадное получение данных: сначала из нового activeChatData, затем из старого activeChat
  const chatName = activeChatData?.name || activeChat?.name || (activeChatId === 'chat_general' ? 'Общий чат' : 'Загрузка...');
  const chatAvatar = activeChatData?.avatar || activeChat?.avatar || (activeChatId === 'chat_general' ? '💬' : '👤');
  const isDataLoading = !activeChatData && !activeChat && activeChatId !== 'chat_general';


    // Вычисляем статус печатания для текущего активного окна на основе веб-сокетов
  const isCurrentChatTyping = typingUser && (
    (typingUser.isGeneral && activeChatId === 'chat_general' && Number(typingUser.senderId) !== Number(currentUserId)) ||
    (!typingUser.isGeneral && activeChatId?.toString().replace('user_', '') === typingUser.senderId?.toString())
  );


  // 2. Функция форматирования времени сообщений
  const formatMsgTime = (dateString) => {
    if (!dateString) return '';
    try {
      const d = new Date(dateString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };


  return (
    <div className={`flex-col flex-1 h-full bg-zinc-900/30 ${activeChatId ? 'flex' : 'hidden md:flex'}`}>
      {!activeChatId ? (
        <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 p-4 text-center">
          <span className="text-4xl mb-2">💬</span>
          <p className="text-sm">Выберите чат, чтобы начать общение</p>
        </div>
      ) : (
        <div className="flex flex-col h-full relative">
          
          {/* Шапка чата */}
          <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-950/40">
            <div className="flex items-center flex-1 cursor-pointer select-none group" onClick={onToggleProfile}>
              <button onClick={(e) => { e.stopPropagation(); setActiveChatId(null); }} className="md:hidden mr-3 p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition">
                <span className="text-xl">🔙</span>
              </button>
              
              {/* Аватарка с защитой от залипания */}
              <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-lg mr-3 shadow-inner group-hover:scale-105 transition-transform duration-200">
                {chatAvatar}
              </div>
              
               <div>
                {/* Имя чата / собеседника */}
                <h2 className={`font-semibold text-sm transition-colors ${isDataLoading ? 'text-zinc-500 italic' : 'text-zinc-800 dark:text-white group-hover:text-emerald-500'}`}>
                  {chatName}
                </h2>
                
                {/* Статус */}
                <span className="text-xs transition-colors duration-300">
                  {isDataLoading ? (
                    <span className="text-zinc-500 dark:text-zinc-600 animate-pulse">поиск в базе...</span>
                  ) : isCurrentChatTyping ? ( // 🔥 Заменили на исправленную переменную сокетов
                    <span className="text-emerald-500 dark:text-emerald-400 animate-pulse">печатает...</span>
                  ) : (
                    <span className="text-zinc-400 dark:text-zinc-500">
                      {activeChatData?.type === 'channel' || activeChatId === 'chat_general' ? 'канал' : 'онлайн'}
                    </span>
                  )}
                </span>
              </div>
            </div>
            <button onClick={onToggleProfile} disabled={isDataLoading} className="p-2 text-zinc-400 dark:text-zinc-500 hover:text-zinc-800 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition disabled:opacity-30">
              ℹ️
            </button>
                  </div>
                    {/* Лента сообщений с Anti-Flicker барьером и отслеживанием скролла */}
          <div 
  ref={scrollContainerRef}
  onScroll={handleScroll}
  /* scroll-behavior: auto отключает плавность, чтобы прыжок был мгновенным и незаметным под opacity-0 */
  style={{ scrollBehavior: isPositioning ? 'auto' : 'smooth' }}
  className={`flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar bg-zinc-950/20 transition-opacity duration-150 ${
    isPositioning ? 'opacity-0 invisible' : 'opacity-100 visible'
  }`}
>

            {(messages || []).map(msg => {
              const isMe = Number(msg.senderId) === Number(currentUserId);
              const formattedTime = formatMsgTime(msg.createdAt);
              const isTargetUnread = firstUnreadMsg && msg.id === firstUnreadMsg.id;

              return (
                <React.Fragment key={msg.id}>
                  {/* JSX-Разделитель «Smart Anchor» перед первым непрочитанным */}
                  {isTargetUnread && (
                    <div ref={firstUnreadRef} className="w-full flex items-center justify-center my-4 select-none">
                      <div className="h-[1px] bg-red-500/30 flex-1"></div>
                      <span className="bg-red-500/10 text-red-500 text-[11px] font-semibold px-3 py-1 rounded-full border border-red-500/20 mx-3 animate-pulse">
                        ⛔ Непрочитанные сообщения
                      </span>
                      <div className="h-[1px] bg-red-500/30 flex-1"></div>
                    </div>
                  )}

                  <div className={`flex ${isMe ? 'justify-end' : 'justify-start'}`} onContextMenu={(e) => handleContextMenu(e, msg.id)}>
                    <div className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm shadow-sm flex flex-col gap-0.5 relative group ${
                      msg.isDeleted 
                        ? 'bg-zinc-200/50 dark:bg-zinc-800/30 text-zinc-400 dark:text-zinc-500 italic border border-zinc-300/50 dark:border-zinc-800/50' 
                        : isMe ? 'bg-emerald-600 text-white rounded-br-none' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 rounded-bl-none'
                    } ${msg.mediaType === 'image' && !msg.isDeleted ? 'p-1 bg-zinc-100 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800' : ''} ${msg.mediaType === 'audio' && !msg.isDeleted ? 'w-64 p-3' : ''}`}>
                      
                     {msg.isDeleted ? (
                        <p className="leading-relaxed text-xs">Сообщение удалено</p>
                     ) : msg.mediaType === 'image' && msg.mediaUrl ? (
                        <div className="flex flex-col gap-1">
                          <img src={msg.mediaUrl} alt="Изображение" className="rounded-xl max-h-60 object-contain bg-zinc-950/20" />
                          <div className="flex items-center justify-end gap-1 px-1.5 pb-0.5">
                            <span className="text-[9px] text-zinc-400">{formattedTime}</span>
                            {isMe && (
                              <span className="text-[10px] leading-none select-none">
                                {msg.status === 'read' || activeChatId === 'chat_general' || activeChatId?.startsWith('channel_') ? (
                                  <span className="text-sky-300 font-bold">✓✓</span>
                                ) : (
                                  <span className="text-white/40">✓</span>
                                )}
                              </span>
                            )}
                          </div>
                        </div>
                     ) : msg.mediaType === 'audio' && msg.mediaUrl ? (
                        <div className="flex flex-col gap-1.5 w-full">
                          <div className="flex items-center gap-2">
                            <span className="text-base select-none">🎙️</span>
                            <audio src={msg.mediaUrl} controls className="w-full h-8 custom-audio-player filter dark:invert" />
                          </div>
                          <div className="flex items-center justify-end gap-1 self-end">
                            <span className={`text-[9px] ${isMe ? 'text-white/60' : 'text-zinc-400 dark:text-zinc-500'}`}>{formattedTime}</span>
                            {isMe && (
                              <span className="text-[10px] leading-none select-none">
                                {msg.status === 'read' || activeChatId === 'chat_general' || activeChatId?.startsWith('channel_') ? (
                                  <span className="text-sky-300 font-bold">✓✓</span>
                                ) : (
                                  <span className="text-white/40">✓</span>
                                )}
                              </span>
                            )}
                          </div>
                        </div>
                     ) : (
                        <>
                          <p className="leading-relaxed break-words  whitespace-pre-wrap">{msg.text || msg.content}</p>
                          <div className="flex items-center justify-end gap-1 self-end">
                            <span className={`text-[9px] ${isMe ? 'text-white/60' : 'text-zinc-400 dark:text-zinc-500'}`}>{formattedTime}</span>
                            {isMe && (
                              <span className="text-[10px] leading-none select-none">
                                {msg.status === 'read' || activeChatId === 'chat_general' || activeChatId?.startsWith('channel_') ? (
                                  <span className="text-sky-300 font-bold">✓✓</span>
                                ) : (
                                  <span className="text-white/40">✓</span>
                                )}
                              </span>
                            )}
                          </div>
                        </>
                     )}
                    </div>
                  </div>
                </React.Fragment>
              );
            })}
            
            {isTyping && (
              <div className="flex justify-start mb-2">
                <div className="bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 rounded-2xl rounded-bl-none px-4 py-2.5 shadow-sm flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                  <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                  <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce"></span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Плавающая Telegram-кнопка «Вниз» с локальным счетчиком */}
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

         {/* Панель ввода с динамической проверкой прав администратора */}
          {activeChatId && activeChatId.startsWith('channel_') && 
           (activeChatData?.creatorId !== Number(currentUserId) && activeChat?.creatorId !== Number(currentUserId)) ? (
            /* Глухая, красивая плашка во всю ширину для обычных подписчиков канала */
            <div className="p-5 bg-zinc-100 dark:bg-zinc-950/60 border-t border-zinc-200 dark:border-zinc-800 text-center text-sm font-medium tracking-wide text-zinc-400 dark:text-zinc-500 rounded-b-xl flex items-center justify-center gap-2 select-none">
              📢 Только администраторы могут оставлять сообщения
            </div>
          ) : (
            <form onSubmit={handleSendMessage} className="p-4 bg-zinc-50 dark:bg-zinc-950/40 border-t border-zinc-200 dark:border-zinc-800 flex gap-2 items-center">
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
    if (socketRef && socketRef.current) {
      socketRef.current.emit('typing', { activeChatId, senderId: currentUserId });
    }
  }} 
  onKeyDown={(e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault(); 
      handleSendMessage(e); 
    }
  }}
  placeholder="Напишите сообщение..." 
  autoComplete="off" 
  rows={1}
  className="flex-1 bg-zinc-100 dark:bg-zinc-800/60 border border-zinc-200/60 dark:border-zinc-700/50 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500 transition text-zinc-800 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 resize-none min-h-[40px] max-h-[120px] no-scrollbar py-2" 
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

          {/* Индикатор печатания с прыгающими точками */}
          {typingUser && (
            ((typingUser.isGeneral && activeChatId === 'chat_general' && Number(typingUser.id) !== Number(currentUserId)) ||
            (!typingUser.isGeneral && activeChatId === `user_${typingUser.id}`))
          ) && (
            <div className="px-4 py-2 text-xs text-zinc-400 italic flex items-center gap-1.5 animate-pulse">
              <span>Собеседник печатает</span>
              <div className="flex gap-1">
                <span className="w-1 h-1 bg-zinc-400 rounded-full animate-bounce"></span>
                <span className="w-1 h-1 bg-zinc-400 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                <span className="w-1 h-1 bg-zinc-400 rounded-full animate-bounce [animation-delay:0.4s]"></span>
              </div>
            </div>
          )}

          {/* Исправленное контекстное меню без обращений к activeChat.messages */}
          {contextMenu.visible && (
            <div className="fixed bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/80 py-1 w-36 rounded-xl shadow-2xl z-50 text-xs text-zinc-700 dark:text-zinc-200 overflow-hidden" style={{ top: contextMenu.y, left: contextMenu.x }}>
              {messages && !messages.find(m => m.id === contextMenu.msgId)?.isDeleted && 
               messages.find(m => m.id === contextMenu.msgId)?.mediaType !== 'image' && 
               messages.find(m => m.id === contextMenu.msgId)?.mediaType !== 'audio' && (
                <button onClick={() => handleCopy(messages.find(m => m.id === contextMenu.msgId)?.text)} className="w-full text-left px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-700/60 transition flex items-center gap-2">📋 Копировать</button>
              )}
              <button onClick={() => { onDeleteMessage(contextMenu.msgId); setContextMenu({ visible: false, x: 0, y: 0, msgId: null }); }} className="w-full text-left px-3 py-2 hover:bg-red-50 dark:hover:bg-red-950/40 text-red-500 dark:text-red-400 transition flex items-center gap-2 font-medium border-t border-zinc-100 dark:border-zinc-700/30">🗑️ Удалить у всех</button>
            </div>
          )}

        </div>
      )}
    </div>
  );
}