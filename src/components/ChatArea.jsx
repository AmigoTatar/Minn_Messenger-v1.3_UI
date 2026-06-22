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
  onSendAudio
}) {
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, msgId: null });
  const fileInputRef = useRef(null);

  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);

  useEffect(() => {
    const handleCloseMenu = () => setContextMenu({ visible: false, x: 0, y: 0, msgId: null });
    window.addEventListener('click', handleCloseMenu);
    return () => window.removeEventListener('click', handleCloseMenu);
  }, []);

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

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Пожалуйста, выберите изображение');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => onSendImage(reader.result);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => onSendAudio(reader.result);
        reader.readAsDataURL(audioBlob);
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
              <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-lg mr-3 shadow-inner group-hover:scale-105 transition-transform duration-200">
                {activeChat.avatar}
              </div>
              <div>
                <h2 className="font-semibold text-sm text-zinc-800 dark:text-white group-hover:text-emerald-500 transition-colors">{activeChat.name}</h2>
                <span className="text-xs transition-colors duration-300">
                  {isTyping ? <span className="text-emerald-500 dark:text-emerald-400 animate-pulse">печатает...</span> : <span className="text-zinc-400 dark:text-zinc-500">онлайн</span>}
                </span>
              </div>
            </div>
            <button onClick={onToggleProfile} className="p-2 text-zinc-400 dark:text-zinc-500 hover:text-zinc-800 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition">
              ℹ️
            </button>
          </div>

          {/* Лента сообщений */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar bg-zinc-950/20">
            {activeChat.messages.map(msg => {
              const isMe = msg.sender === 'me';
              return (
                <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`} onContextMenu={(e) => handleContextMenu(e, msg.id)}>
                  <div className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm shadow-sm flex flex-col gap-0.5 relative group ${
                    msg.isDeleted 
                      ? 'bg-zinc-200/50 dark:bg-zinc-800/30 text-zinc-400 dark:text-zinc-500 italic border border-zinc-300/50 dark:border-zinc-800/50' 
                      : isMe ? 'bg-emerald-600 text-white rounded-br-none' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 rounded-bl-none'
                  } ${msg.type === 'image' && !msg.isDeleted ? 'p-1 bg-zinc-100 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800' : ''} ${msg.type === 'audio' && !msg.isDeleted ? 'w-64 p-3' : ''}`}>
                    
                    {msg.isDeleted ? (
                      <p className="leading-relaxed text-xs">Сообщение удалено</p>
                    ) : msg.type === 'image' ? (
                      <div className="flex flex-col gap-1">
                        <img src={msg.image} alt="Изображение" className="rounded-xl max-h-60 object-contain bg-zinc-950/20" />
                        <div className="flex items-center justify-end gap-1 px-1.5 pb-0.5">
                          <span className="text-[9px] text-zinc-400">{msg.time}</span>
                          {isMe && <span className="text-[10px] leading-none select-none">{msg.status === 'read' ? <span className="text-sky-300 font-bold">✓✓</span> : <span className="text-white/40">✓</span>}</span>}
                        </div>
                      </div>
                    ) : msg.type === 'audio' ? (
                      <div className="flex flex-col gap-1.5 w-full">
                        <div className="flex items-center gap-2">
                          <span className="text-base select-none">🎙️</span>
                          <audio src={msg.audio} controls className="w-full h-8 custom-audio-player filter dark:invert" />
                        </div>
                        <div className="flex items-center justify-end gap-1 self-end">
                          <span className={`text-[9px] ${isMe ? 'text-white/60' : 'text-zinc-400 dark:text-zinc-500'}`}>{msg.time}</span>
                          {isMe && <span className="text-[10px] leading-none select-none">{msg.status === 'read' ? <span className="text-sky-300 font-bold">✓✓</span> : <span className="text-white/40">✓</span>}</span>}
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="leading-relaxed break-words">{msg.text}</p>
                        <div className="flex items-center justify-end gap-1 self-end">
                          <span className={`text-[9px] ${isMe ? 'text-white/60' : 'text-zinc-400 dark:text-zinc-500'}`}>{msg.time}</span>
                          {isMe && <span className="text-[10px] leading-none select-none">{msg.status === 'read' ? <span className="text-sky-300 font-bold">✓✓</span> : <span className="text-white/40">✓</span>}</span>}
                        </div>
                      </>
                    )}
                  </div>
                </div>
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
          {/* Панель ввода */}
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
              <input type="text" value={inputValue} onChange={(e) => setInputValue(e.target.value)} placeholder="Напишите сообщение..." autoComplete="off" className="flex-1 bg-zinc-100 dark:bg-zinc-800/60 border border-zinc-200/60 dark:border-zinc-700/50 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500 transition text-zinc-800 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500" />
            )}

            {inputValue.trim() === '' ? (
              <button type="button" onClick={isRecording ? stopRecording : startRecording} className={`p-2.5 rounded-xl text-sm font-medium transition active:scale-95 shadow-md flex items-center justify-center ${isRecording ? 'bg-red-600 text-white hover:bg-red-500' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-emerald-500 dark:hover:text-emerald-400'}`}>
                {isRecording ? '⏹️' : '🎙️'}
              </button>
            ) : (
              <button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition active:scale-95 shadow-md shadow-emerald-900/20">Отправить</button>
            )}
          </form>

          {/* Контекстное меню */}
          {contextMenu.visible && (
            <div className="fixed bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/80 py-1 w-36 rounded-xl shadow-2xl z-50 text-xs text-zinc-700 dark:text-zinc-200 overflow-hidden" style={{ top: contextMenu.y, left: contextMenu.x }}>
              {!activeChat.messages.find(m => m.id === contextMenu.msgId)?.isDeleted && 
               activeChat.messages.find(m => m.id === contextMenu.msgId)?.type !== 'image' && 
               activeChat.messages.find(m => m.id === contextMenu.msgId)?.type !== 'audio' && (
                <button onClick={() => handleCopy(activeChat.messages.find(m => m.id === contextMenu.msgId)?.text)} className="w-full text-left px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-700/60 transition flex items-center gap-2">📋 Копировать</button>
              )}
              <button onClick={() => onDeleteMessage?.(contextMenu.msgId)} className="w-full text-left px-3 py-2 hover:bg-red-50 dark:hover:bg-red-950/40 text-red-500 dark:text-red-400 transition flex items-center gap-2 font-medium border-t border-zinc-100 dark:border-zinc-700/30">🗑️ Удалить</button>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
