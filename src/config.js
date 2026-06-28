// src/config.js

// Определяем окружение (для Vite)
const isDevelopment = import.meta.env?.MODE === 'development';

// Базовый URL API - только для Vite
export const API_BASE_URL = import.meta.env?.VITE_API_URL || 'http://localhost:5001';

// Константы для чатов
export const CHAT_IDS = {
  GENERAL: 'chat_general',
  GENERAL_ALT: 'general',
  CHANNEL_PREFIX: 'channel_',
  USER_PREFIX: 'user_',
};

// Настройки для скролла
export const SCROLL_CONFIG = {
  MAX_CHECKS: 20,
  CHECK_INTERVAL: 50,
  TIMEOUT: 2000,
  BOTTOM_THRESHOLD: 200,
  TOP_THRESHOLD: 40,
};

// Медиа типы
export const MEDIA_TYPES = {
  AUDIO: ['mp3', 'mp4', 'webm', 'aac', 'wav', 'ogg'],
  IMAGE: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'],
};

export default {
  API_BASE_URL,
  CHAT_IDS,
  SCROLL_CONFIG,
  MEDIA_TYPES,
  isDevelopment,
};