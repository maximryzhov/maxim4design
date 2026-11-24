---
id: TASK-024
title: Прокси-загрузка CORS-изображений через Chrome Extension background worker
status: done
priority: high
phase: 6
dependencies: [TASK-016, TASK-020]
tags: [extension, images, cors, bugfix]
---

# TASK-024: Прокси-загрузка CORS-изображений через Chrome Extension background worker

## 1. Описание задачи
Внешние изображения с серверов без заголовка `Access-Control-Allow-Origin` (например, `img#hero-card-image` с `https://alfa-green.ru/wp-content/uploads/...`) блокируются браузером при `fetch(url, { mode: 'cors' })` из content script / страницы, из-за чего в Figma они рендерятся как серые плейсхолдеры.

## 2. Связанные разделы документации
- [ARCHITECTURE.md](file:///e:/Projects/Dev/html2design/ARCHITECTURE.md) (Раздел 6: CORS блокировка картинок)
- [KNOWLEDGE_BASE.md](file:///e:/Projects/Dev/html2design/KNOWLEDGE_BASE.md)

## 3. Технические детали и требования к реализации
- В `src/extension/manifest.json`: убедиться, что заданы `host_permissions: ["<all_urls>"]` и `background.service_worker`.
- Добавить `src/extension/background.ts` (и прописать его в `esbuild.config.js`), принимающий сообщение `{ type: 'FETCH_IMAGE_BASE64', url }` и выполняющий `fetch(url)` с конвертацией в Base64 Data URL в привилегированном контексте расширения.
- В `src/extractor/image-loader.ts` и `src/extension/content-script.ts`: добавить опциональный callback `fetchExternalImage?: (url: string) => Promise<string | undefined>`, чтобы content script делегировал загрузку проблемных URL в background worker.

## 4. Критерии приемки (Definition of Done)
- [x] Картинки с внешних доменов без CORS-заголовков успешно конвертируются в Base64 при захвате через Chrome Extension.
- [x] `img#hero-card-image` на `alfagreen-fitosteny.html` отображается в Figma с реальным фото вместо плейсхолдера.
- [x] При недоступности сети сохраняется fallback на плейсхолдер.

## 5. Чек-лист реализации
- [x] Создать `src/extension/background.ts` и добавить в сборку `esbuild.config.js`.
- [x] Обновить `src/extension/manifest.json` и `src/extension/content-script.ts`.
- [x] Поддержать внешний fetcher в `resolveTreeImagesAsync` (`src/extractor/image-loader.ts`).
- [x] Проверить `npm test` и `npm run build`.
- [x] Переместить карточку в `/done`.
