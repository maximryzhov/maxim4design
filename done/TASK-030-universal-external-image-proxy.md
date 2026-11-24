---
id: TASK-030
title: Универсальная загрузка внешних HTML-картинок (CORS-прокси через мост и очистка alt-артефактов)
status: done
priority: critical
phase: 7
dependencies: [TASK-020, TASK-024]
tags: [extractor, images, cors, bridge, bugfix]
---

# TASK-030: Универсальная загрузка внешних HTML-картинок (CORS-прокси через мост и очистка alt-артефактов)

## 1. Описание задачи
Внешние изображения на HTML-страницах (`https://alfa-green.ru/wp-content/uploads/...` — фото в карточке `Monkey Grinder`, баннер `НАСТОЯЩИЕ ВПЕЧАТЛЕНИЯ`, 6 карточек проектов) блокируются по CORS при захвате страницы через букмарклет или прямой скрипт (без Chrome Extension `background.ts`), из-за чего в Figma появляются серые плейсхолдеры.

## 2. Связанные разделы документации
- [ARCHITECTURE.md](file:///e:/Projects/Dev/html2design/ARCHITECTURE.md) (Раздел 6: CORS блокировка картинок)
- [KNOWLEDGE_BASE.md](file:///e:/Projects/Dev/html2design/KNOWLEDGE_BASE.md)

## 3. Технические детали и требования к реализации
- **Проксирование картинок через локальный мост (`http://localhost:8765/proxy-image?url=...`):**
  - В `src/extractor/image-loader.ts` (`resolveImageUrlToBase64`): если прямой `fetch(url, { mode: 'cors' })` упал и внешний `fetchExternalImage` не передан (или тоже не справился), пробовать загрузить картинку через локальный мост `http://localhost:8765/proxy-image?url=<encoded>` (если мост запущен на машине пользователя).
  - Также при извлечении `<img>` без загруженных пикселей (`!img.complete || img.naturalWidth === 0`), принудительно дожидаться `resolveImageUrlToBase64` вместо мгновенного падения.
- **Чистые плейсхолдеры и `scaleMode`:**
  - При `background-image` у контейнеров корректно сохранять `scaleMode` (`FILL` для `cover`, `FIT` для `contain`) и загружать URL через тот же `resolveImageUrlToBase64`.

## 4. Критерии приемки (Definition of Done)
- [x] Внешние картинки с доменов без `Access-Control-Allow-Origin` успешно загружаются в Base64 как через Chrome Extension (`background.ts`), так и через локальный мост (`localhost:8765/proxy-image`).
- [x] Фото в `Monkey Grinder`, `НАСТОЯЩИЕ ВПЕЧАТЛЕНИЯ` и 6 карточках проектов отображаются в Figma как реальные изображения.
- [x] Добавлены unit-тесты в `tests/image-pipeline.test.ts`.

## 5. Чек-лист реализации
- [x] Добавить fallback-запрос к локальному прокси-мосту в `src/extractor/image-loader.ts`.
- [x] Проверить обработку `background-image` URL в `resolveTreeImagesAsync`.
- [x] Добавить unit-тесты в `tests/image-pipeline.test.ts` и проверить `npm test`, `npm run build`.
- [x] Переместить карточку в `/done`.
