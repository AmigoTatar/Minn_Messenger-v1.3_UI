// src/utils/avatarUtils.js
import { API_BASE_URL } from '../config';

/**
 * Получает полный URL для аватарки
 * @param {string} avatar - путь к аватарке (может быть /uploads/..., http://..., или эмодзи)
 * @returns {string|null} - полный URL или null
 */
export const getAvatarUrl = (avatar) => {
    if (!avatar) return null;

    // Если уже полный URL
    if (avatar.startsWith('http://') || avatar.startsWith('https://')) {
        return avatar;
    }

    // Если это путь к загруженному файлу
    if (avatar.startsWith('/uploads/')) {
        return `${API_BASE_URL}${avatar}`;
    }

    // Если это эмодзи или другой текст - возвращаем как есть
    return avatar;
};

/**
 * Получает инициалы пользователя
 * @param {string} username - имя пользователя
 * @returns {string} - инициалы (заглавная буква)
 */
export const getInitials = (username) => {
    if (!username) return '?';
    return username.charAt(0).toUpperCase();
};

/**
 * Проверяет, является ли аватарка изображением (путь к файлу)
 * @param {string} avatar 
 * @returns {boolean}
 */
export const isImageAvatar = (avatar) => {
    return avatar && typeof avatar === 'string' && avatar.startsWith('/uploads/');
};

/**
 * Проверяет, является ли аватарка эмодзи
 * @param {string} avatar 
 * @returns {boolean}
 */
export const isEmojiAvatar = (avatar) => {
    if (!avatar || typeof avatar !== 'string') return false;
    // Если это не путь к файлу и не URL - считаем эмодзи
    return !avatar.startsWith('/uploads/') && !avatar.startsWith('http');
};