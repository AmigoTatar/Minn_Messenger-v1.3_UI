import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite' // Импортируем плагин

// https://vite.dev
export default defineConfig({
    plugins: [
        react(),
        tailwindcss(), // Добавляем его в массив плагинов
    ],
})