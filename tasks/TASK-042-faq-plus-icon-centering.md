---
id: TASK-042
title: «+» в первом FAQ прижат к левому верхнему углу вместо центра
status: pending
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
- [ ] В Figma «+» первого FAQ расположен по центру зелёного круга 52×52.
- [ ] «+» остальных пунктов центрированы в кругах 37×37.
- [ ] Текст обычных кнопок/подписей не смещается.
- [ ] `npm test`, `npm run typecheck`, `npm run build` проходят.

## 5. Чек-лист реализации
- [ ] Выбрать вариант A или B и реализовать.
- [ ] Добавить тесты.
- [ ] Пересобрать и проверить экспорт FAQ 1:1.
- [ ] Переместить карточку в `/done`.
