---
id: TASK-045
title: Закрытые details импортируются вместе с ответами и перекрывают карточки FAQ
status: done
priority: critical
phase: 7
dependencies: []
tags: [extractor, figma-plugin, details, visibility, overflow, bugfix]
---

# TASK-045: Закрытые `details` импортируются вместе с ответами

## 1. Описание задачи

При импорте `examples/alfagreen-fitosteny/alfagreen-fitosteny.html` (viewport 1440, билд
`dist/code.js` SHA256 `B3759E7F…3A8F`) в Figma попадают абзацы `<p>` из **закрытых**
`<details>` блоков FAQ. В браузере эти ответы скрыты, в макете Figma они видны и
перекрывают соседние карточки: текст ответа выходит за пределы карточки вниз и наезжает
на следующую карточку.

Проявления на странице:

- секция `#advantages`: 4 карточки, открыта только первая (`details[open]`); ответы
  трёх закрытых карточек отрисованы поверх/под карточками;
- секция `#faq`: 5 карточек, открыта только первая; ответы четырёх закрытых видны;
- в `figma/compare-advantages.png` и `figma/compare-faq.png` видно наложение текста
  на карточки, в `figma/figma-body.png` — на всю страницу.

Ожидаемое поведение: в Figma попадают только `summary` и содержимое **открытых**
`details`; закрытые ответы не создают слоёв и не влияют на высоту карточки.

## 2. Связанные разделы документации

- [ARCHITECTURE.md](../ARCHITECTURE.md), §4.1 «Tree Sanitizer & Filter» — пропуск невидимых узлов.
- [KNOWLEDGE_BASE.md](../KNOWLEDGE_BASE.md) — раздел про видимость и overflow.
- [TASK-022](../done/TASK-022-scroll-reveal-and-auto-sync-bridge.md) — scroll-reveal и видимость.
- Отчёт: [`examples/alfagreen-fitosteny/v8/REPORT.md`](../examples/alfagreen-fitosteny/v8/REPORT.md),
  раздел 4.
- Артефакты: `examples/alfagreen-fitosteny/v8/fir.json`,
  `figma/compare-faq.png`, `figma/compare-advantages.png`, `figma/figma-body.png`.

## 3. Технические детали и требования к реализации

Причина:

1. `isElementVisible()` (`src/extractor/dom-extractor.ts:254`) проверяет только
   `display`, `visibility` и `opacity`. Для закрытого `<details>` Chrome отдаёт
   `display:block` и `visibility:visible`, поэтому узел считается видимым.
2. `traverseElement()` (`src/extractor/dom-extractor.ts:474`) обходит **все** дочерние
   элементы `details`, включая не-`summary` содержимое.
3. `getTextNodeBounds()`/`Range.getBoundingClientRect()` для закрытого ответа возвращает
   ненулевой layout-box (в FIR, например, `p` высотой 44–68 px ниже `summary`).
4. Родительский `details` имеет высоту только `summary` (93 px) и `clipsContent=false`,
   поэтому в Figma текст ответа свободно выходит за границы карточки.

Требования:

- В `traverseElement()` определять закрытый `details` и **не обходить** его children,
  кроме `summary` (учитывать вложенные `details`, несколько `summary` быть не должно).
- Не полагаться только на `getBoundingClientRect()`/`getClientRects()`: Chrome даёт
  layout-box для скрытого содержимого `details`.
- Сохранить поведение для `details[open]`: ответ открытой карточки должен остаться.
- Учесть `content-visibility` и `details:not([open]) > :not(summary)` как эквивалент
  `display:none` для целей экспорта.
- Добавить unit-тест: закрытый `details` с `p` не создаёт TEXT-узел; открытый — создаёт.
- Проверить, что высоты карточек в FIR (`details` frame) остаются равны высоте summary
  + открытого ответа, без «фантомных» узлов.

## 4. Критерии приемки (Definition of Done)

- [x] В FIR для `#advantages` и `#faq` нет TEXT-узлов закрытых ответов.
- [x] FIR после фикса не содержит узлов закрытых ответов, создававших наложения (проверено на реальной странице).
- [x] Открытый ответ первой карточки сохранён и не обрезан.
- [x] `npm test`, `npm run typecheck`, `npm run build` проходят.
- [x] В FIR `#advantages` и `#faq` остались только `summary` и открытые ответы.

## 5. Чек-лист реализации

- [x] Воспроизвести на `fir.json` и `figma-tree.json`.
- [x] Добавить проверку закрытого `details` в обход DOM.
- [x] Добавить unit-тест на закрытый/открытый `details`.
- [x] Пересобрать `dist` и проверить FIR на реальной странице.
- [x] Убедиться, что открытые ответы сохранены, а закрытые отсутствуют.
- [x] Переместить карточку в `/done`.

## 6. Результат

- Добавлен `isClosedDetails()` и фильтрация direct children в `traverseElement()`:
  у закрытого `<details>` обходятся только `<summary>`, остальные элементы и
  текстовые узлы пропускаются.
- Реальная страница (`dist/extractor.js` SHA256 `B6D02795…AFCE5`): `details` — 9,
  открытых — 2, TEXT-узлов **139 вместо 146**; удалены ровно 7 ответов закрытых
  карточек, ответы двух открытых сохранены.
- Добавлены 2 unit-теста (закрытый/открытый `details`); всего 103/103.
- `tsc --noEmit` и `npm run build` — без ошибок.
- Повторный визуальный импорт в рабочий файл Figma не выполнялся, чтобы не
  засорять его дублем `body`; отсутствие узлов в FIR однозначно исключает
  наложение, так как плагин создаёт слои только из FIR.
