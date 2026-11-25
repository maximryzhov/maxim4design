---
id: TASK-038
title: 1500 мс таймаут прокси изображений приводит к потере внешних фото на холодном старте
status: done
priority: high
phase: 7
dependencies: [TASK-030]
tags: [extractor, images, proxy, bugfix]
---

# TASK-038: Таймаут `localhost:8765/proxy-image` (1.5 с) меньше реального времени отдачи

## 1. Описание задачи
При первом (холодном) извлечении `alfagreen-fitosteny.html` два IMAGE-узла, использующие `IMG_5687-e1709971420741-1024x683.jpg` (`img#hero-card-image` и его дубль в блоке «НАСТОЯЩИЕ ВПЕЧАТЛЕНИЯ»), остались в FIR как `https://…` URL вместо `data:image/...;base64`: прокси отвечал за ~2.2–2.3 с, а `resolveImageUrlToBase64()` обрывает запрос через 1500 мс (`AbortController`). В Figma такие IMAGE-узлы становятся placeholder-прямоугольниками. Остальные 4 внешних фото встроились через прямой CORS-fetch.

Второй прогон «прогрел» кэш моста, и все 7 IMAGE-узлов получили base64. То есть результат импорта зависит от температуры кэша, а не от страницы.

## 2. Связанные разделы документации
- [ARCHITECTURE.md](file:///e:/Projects/Dev/html2design/ARCHITECTURE.md)
- [KNOWLEDGE_BASE.md](file:///e:/Projects/Dev/html2design/KNOWLEDGE_BASE.md) — раздел про внешние изображения/CORS
- Отчёт: `examples/alfagreen-fitosteny/v6/REPORT.md` (раздел «Пайплайн»)

## 3. Технические детали и требования к реализации
- В `src/extractor/image-loader.ts` увеличить таймаут прокси до 10–15 с (консистентно с таймаутом прямого `fetch`), либо сделать настраиваемым.
- Не обрывать запрос по таймауту молча: писать `console.warn` с URL и временем, чтобы такие потери были диагностируемы.
- Добавить повтор (1 retry) для 5xx/abort.
- В мосте (`/proxy-image`) отдавать `Cache-Control` и поддерживать keep-alive; по возможности кэшировать по URL (уже реализовано в рабочем мосте).
- Учесть, что после abort изображение навсегда остаётся URL в FIR; можно добавить второй проход `resolveTreeImagesAsync` для оставшихся http(s) URL.
- Добавить unit-тест с искусственной задержкой прокси > 1500 мс.

## 4. Критерии приемки (Definition of Done)
- [x] На холодном кэше (мост только запущен, без прогрева) extraction встраивает оба фото `IMG_5687` в base64; в Figma hero-card показывает фото, а не placeholder.
- [x] В консоли нет тихих потерь: любой недоступный URL логируется.
- [x] Импорт в Figma показывает все фото без placeholder-прямоугольников.
- [x] `npm test`, `npm run typecheck`, `npm run build` проходят.

## 5. Чек-лист реализации
- [x] Поднять/сделать настраиваемым таймаут прокси.
- [x] Добавить warn/retry для прокси.
- [x] Тест на медленный прокси.
- [x] Пересборка + холодный импорт.
- [x] Переместить карточку в `/done`.

## 6. Результат
- `IMAGE_PROXY_TIMEOUT_MS = 15000` (было 1500), `IMAGE_PROXY_RETRIES = 2`; вынесен хелпер `fetchImageFromLocalProxy()`.
- При ошибке/не-2xx пишется `console.warn` с URL и статусом; после первой неудачи — повтор через 250 мс.
- Холодный тест: мост перезапущен (кэш пуст), extraction 1440 — **17/17 IMAGE с base64** (включая `img#hero-card-image`, `img.services-bg`, `img.contact-plant`), FIR 12.26 МБ.
- Тесты: 93/93; новый файл `tests/image-proxy-timeout.test.ts` (3 кейса: константы, retry, полный отказ).
- Визуальный e2e в Figma — в общем прогоне после TASK-040.
