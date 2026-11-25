---
id: TASK-046
title: Ленивые изображения попадают в FIR прозрачными или URL → пустые карточки
status: done
priority: critical
phase: 7
dependencies: []
tags: [extractor, images, lazy-load, canvas, base64, bugfix]
---

# TASK-046: Прозрачные/незагруженные изображения в FIR

## 1. Описание задачи

На `alfagreen-fitosteny.html` несколько карточек товаров и проектов остаются в Figma
пустыми (белыми), хотя в браузере фотографии отображаются. Причина — не отрисовка
Figma, а данные FIR: часть IMAGE-узлов содержит либо полностью прозрачный PNG, либо
исходный `https://…` URL вместо `data:image/...;base64`.

Первый прогон (`fir.json`, 17 IMAGE-узлов):

- `fir-node-88` — сервисная карточка «Фитобоксы», `https://alfa-green.ru/wp-content/uploads/2025/09/4-1024x1024.jpg`,
  PNG 1024×1024, **alpha=0 у всех пикселей**, 24 664 байта;
- `fir-node-117` — проект «ЖК «Яркий»», тот же URL, тот же прозрачный PNG;
- `fir-node-133` — проект «Приёмная офиса продаж», `…/2022/05/стена-1-scaled-…jpg`,
  PNG 444×322, **alpha=0**, 4 103 байта.

В Figma это узлы `1:115`, `1:144`, `1:174`: fill типа IMAGE с валидным `imageHash`,
но сам битмап прозрачный → белая карточка. Fallback-подпись при этом видна
(см. TASK-051).

Второй прогон (`fir-run2.json`) воспроизвёл проблему иначе: у `fir-node-117`
в `imageData.base64` остался **URL** (64 символа), а не data-URI. В Figma такой узел
не может быть загружен и превращается в плейсхолдер/пустоту.

Проверка источника: `https://alfa-green.ru/wp-content/uploads/2025/09/4-1024x1024.jpg`
отдаёт `HTTP 200 image/jpeg` 205 000 байт и корректную фотографию. То есть проблема
на стороне извлечения/встраивания, а не на стороне сайта.

## 2. Связанные разделы документации

- [ARCHITECTURE.md](../ARCHITECTURE.md), §4.1 «Asset Serializer», §6 «Fault Tolerance».
- [KNOWLEDGE_BASE.md](../KNOWLEDGE_BASE.md) — «Баг 9: Картинки: background-image, object-fit и асинхронность».
- [TASK-020](../done/TASK-020-async-external-image-fetching.md),
  [TASK-027](../done/TASK-027-alpha-png-downscale-and-size-budget.md),
  [TASK-038](../done/TASK-038-image-proxy-timeout.md),
  [TASK-044](../done/TASK-044-contact-plant-crop-scale.md).
- Отчёт: [`examples/alfagreen-fitosteny/v8/REPORT.md`](../examples/alfagreen-fitosteny/v8/REPORT.md).
- Артефакты: `fir.json`, `fir-run2.json`, `figma/compare-services.png`,
  `figma/compare-projects.png`, `figma/figma-body.png`.

## 3. Технические детали и требования к реализации

Причина:

1. `imageToDataUrl()` (`src/extractor/image-loader.ts:36`) вызывает
   `ctx.drawImage(img, …)` и сразу `canvas.toDataURL('image/png')`, не проверяя,
   что `<img>` реально **декодирован**. У ленивой картинки `naturalWidth=1024`,
   но пиксели ещё не растеризованы → canvas остаётся прозрачным, и в FIR уходит
   валидный, но пустой PNG.
2. `extractImageData()` (`src/extractor/image-loader.ts:324`) для `<img>` не делает
   `await img.decode()` и не проверяет, что результат не пустой.
3. `resolveImageUrlToBase64()` (`src/extractor/image-loader.ts:158`) при неудаче
   оставляет исходный URL; `renderImageNode()` не умеет загружать HTTP(S)-URL,
   поэтому узел визуально пустой.
4. Проверка «картинка пустая» отсутствует: полностью прозрачный PNG считается
   успешным результатом.

Требования:

- Перед `drawImage` дождаться `img.decode()` (или `complete && naturalWidth > 0`),
  с таймаутом и fallback на прокси.
- После `toDataURL` проверять результат: для RGBA считать долю непрозрачных пикселей
  (например, `getImageData` минимум по нескольким точкам/гистограмма alpha); если
  alpha=0 у всех пикселей — считать извлечение неуспешным и идти в прокси/повтор.
- Не оставлять `imageData.base64` в виде `http(s)://…` для типа IMAGE: либо data-URI,
  либо явный placeholder с пометкой, чтобы Figma не создавала «пустой» fill.
- Для `loading="lazy"` изображений: принудительно скроллить/`loading=eager` на время
  экстракции или повторять прокси-загрузку после `decode()`.
- Логировать URL и причину, чтобы в отчёте было видно, какой ассет не встроился.
- Добавить unit-тест на «пустой canvas» (image с naturalWidth, но без пикселей)
  и на URL-fallback.

## 4. Критерии приемки (Definition of Done)

- [x] В `fir.json` нет IMAGE-узлов с полностью прозрачным bitmap (alpha=0 у всех пикселей).
- [x] В `fir.json` нет `imageData.base64`, начинающихся с `http://`/`https://`.
- [x] В FIR карточки «Фитобоксы», «ЖК «Яркий»», «Приёмная офиса продаж» содержат реальные bitmap (data URI, не placeholder).
- [x] Повторный прогон (2 раза) не даёт пустых bitmap и URL-узлов.
- [x] `npm test`, `npm run typecheck`, `npm run build` проходят.
- [x] Нет регрессий для `img.contact-plant`, `img.hero-art`, `img.services-bg`.

## 5. Чек-лист реализации

- [x] Воспроизвести пустые карточки на `fir.json` (alpha=0).
- [x] Добавить `await img.decode()`/проверку готовности перед canvas.
- [x] Добавить валидацию прозрачного результата и fallback на прокси.
- [x] Запретить URL в `imageData.base64` для IMAGE.
- [x] Пересобрать `dist` и проверить FIR двумя прогонами.
- [x] Убедиться, что проблемные URL дают реальные bitmap, а не placeholder.
- [x] Переместить карточку в `/done`.

## 6. Результат

- Добавлены `canvasHasVisiblePixels()` (blank-детект), `decodeImageElement()` с
  `img.decode()` и таймаутом, placeholder `IMAGE_PLACEHOLDER_DATA_URL` для
  окончательно неустранимых URL. `resolveTreeImagesAsync()` больше не оставляет
  HTTP(S)-URL: при неудаче подставляется нейтральный placeholder.
- Два прогона на реальной странице: 17 IMAGE-узлов, **0 полностью прозрачных**,
  **0 URL**; ранее пустые `4-1024x1024.jpg` и `стена-1-scaled…jpg` теперь
  встроены как реальные JPEG (273 359 / 307 095 байт).
- Добавлены 2 unit-теста (blank canvas, placeholder); всего 105/105.
- `tsc --noEmit` и `npm run build` — без ошибок; `dist/extractor.js` SHA256
  `AC396A4D…C441`.
- Повторный визуальный импорт в Figma не выполнялся, чтобы не плодить дубли
  `body`; `renderImageNode` получает валидный data URI и уже покрыт тестом.
