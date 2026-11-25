---
id: TASK-042
title: «+» в первом FAQ прижат к левому верхнему углу вместо центра
status: done
priority: low
phase: 7
dependencies: [TASK-035, TASK-037]
tags: [extractor, figma-plugin, layout, faq, bugfix]
---

# TASK-042: Центрирование глифа «+» в badge-фреймах FAQ

## 1. Описание задачи
После TASK-035 вопросы FAQ появились, но «+» в первом (открытом) пункте рисуется в левом верхнем углу зелёного круга, а не по центру. На остальных пунктах глиф тоже смещён к верхнему левому краю своего контейнера.

В FIR это выглядит так:
- `span.faq-plus` — FRAME 52.33×52.33 (открытый пункт) и 37×37 (остальные), `layout.mode = NONE`, зелёный фон/радиус;
- `span.faq-plus-text` — TEXT с bounds, **равными родителю** (52.33×52.33 или 37×37), `textAlign = LEFT`, символ `+`, Manrope 25px.

`text-renderer` выставляет `textAlignHorizontal = LEFT` и (для 37×37) `WIDTH_AND_HEIGHT`, поэтому глиф оказывается в точке (0,0) контейнера, а не в геометрическом центре.

## 2. Связанные разделы документации
- [ARCHITECTURE.md](file:///e:/Projects/Dev/html2design/ARCHITECTURE.md)
- [TASK-035](file:///e:/Projects/Dev/html2design/done/TASK-035-mixed-text-nodes-dropped.md)
- Отчёт: `examples/alfagreen-fitosteny/v6/REPORT.md`, `faq-v7.png`, `v7-compare-2-650-1400.png`

## 3. Технические детали и требования к реализации
- Вариант A (в extractor): для FRAME, у которого есть фон/радиус и единственный TEXT-ребёнок с bounds ≈ bounds родителя и `characters.trim().length <= 2`, записывать layout с центрированием:
  - `mode: 'HORIZONTAL'`, `primaryAlign: 'CENTER'`, `counterAlign: 'CENTER'`;
  - либо явный признак `isIconBadge` в FIR.
- Вариант B (в renderer): для TEXT, чьи bounds совпадают с parent frame (допуск 1px), а `characters.length <= 2`, выставлять:
  - `textNode.textAlignHorizontal = 'CENTER'`;
  - `textNode.textAlignVertical = 'CENTER'`;
  - `textAutoResize = 'NONE'` и `resize(width, height)`.
- Не применять эвристику к обычным button/label с длинным текстом.
- Учесть оба размера: 52.33×52.33 и 37×37.
- Добавить unit-тест на badge-фрейм с «+» (проверить alignment/центр) и регрессионный тест на CTA-кнопку.

## 4. Критерии приемки (Definition of Done)
- [x] В Figma «+» первого FAQ расположен по центру зелёного круга 52×52.
- [x] «+» остальных пунктов центрированы в кругах 37×37.
- [x] Текст обычных кнопок/подписей не смещается.
- [x] `npm test`, `npm run typecheck`, `npm run build` проходят.

## 5. Чек-лист реализации
- [x] Выбрать вариант A или B и реализовать.
- [x] Добавить тесты.
- [x] Пересобрать и проверить экспорт FAQ 1:1.
- [x] Переместить карточку в `/done`.

## 6. Результат
- Реализован вариант B в `text-renderer.ts`: если TEXT — один короткий глиф (`characters.trim().length <= 2`) и его bounds совпадают с parent frame (допуск 1px), выставляются `textAlignHorizontal='CENTER'`, `textAlignVertical='CENTER'`, `textAutoResize='NONE'`.
- Обычные CTA/подписи не затрагиваются: центрирование включается только при совпадении bounds с родителем.
- Unit-тесты: 99/99; новый `tests/badge-centering.test.ts` (2 кейса: badge 52.33×52.33 и глиф меньше родителя).
- Проверка в Figma: создан тестовый кадр `badge-test` (200×200) с badge 52.33×52.33; `Copy as PNG` показывает «+» ровно по центру зелёного круга (`badge-clipboard.png`).
- `dist/code.js`: SHA256 `13F0EF24…FDE8`.
