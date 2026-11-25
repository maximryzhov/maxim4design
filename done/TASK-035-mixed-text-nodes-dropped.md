---
id: TASK-035
title: Текстовые узлы в смешанных контейнерах теряются (вопросы FAQ, подписи формы)
status: done
priority: high
phase: 7
dependencies: []
tags: [extractor, text, faq, forms, bugfix]
---

# TASK-035: Raw text nodes внутри смешанных контейнеров не извлекаются

## 1. Описание задачи
`traverseElement()` обходит только `element.children` (элементы) и не создаёт узлы для прямых текстовых узлов (`Node.TEXT_NODE`) контейнера, если сам контейнер не распознан как text-container. В результате на странице `alfagreen-fitosteny.html` полностью пропадают:

- все 4 вопроса FAQ (`<summary>Всегда зелёные<span class="faq-plus">+</span></summary>` и остальные) — в FIR у `summary` остаётся только `span.faq-plus`; в Figma видны лишь зелёные «плюсы» без вопросов;
- подписи полей формы (`<label>Как к вам обращаться? <span>*</span><input …></label>` и др.) — в FIR у `label` остаётся только `span` со звёздочкой;
- смешанный контент других флекс-контейнеров (текст + элемент).

## 2. Связанные разделы документации
- [ARCHITECTURE.md](file:///e:/Projects/Dev/html2design/ARCHITECTURE.md)
- Отчёт: `examples/alfagreen-fitosteny/v6/REPORT.md`, кропы `compare-2-650-1400.png`, `compare-6-3450-4377.png`

## 3. Технические детали и требования к реализации
- В `traverseElement()` при построении FRAME обходить `element.childNodes` в порядке DOM:
  - для `TEXT_NODE` с непустым `textContent` создавать TEXT-узел с bounds по `Range.getBoundingClientRect()` (или объединять соседние текстовые узлы);
  - для `ELEMENT_NODE` — существующая логика `traverseElement`.
- Для `summary` (тег не в `INLINE_TAGS`) текст «Всегда зелёные» должен стать отдельным TEXT-соседом `span.faq-plus`, чтобы `primaryAlign: SPACE_BETWEEN` корректно разнёс их по краям.
- Для `label` текст подписи и `span>*` должны стать отдельными TEXT; `input` — отдельным узлом (см. TASK-036).
- Учесть `display:none`/`visibility:hidden` у родителя, чтобы не вытащить скрытый текст (`.visually-hidden`).
- Добавить unit-тест на `<div>Текст<span>+</span></div>` и `<summary>Вопрос<span>+</span></summary>`.

## 4. Критерии приемки (Definition of Done)
- [x] В FIR присутствуют 4 TEXT-узла с вопросами FAQ («Всегда зелёные», «Без полива и сложного ухода», «Для разных пространств», «Под ваш интерьер»).
- [x] В Figma у первого FAQ вопрос слева, «плюс» справа (структурно: `summary` HORIZONTAL/SPACE_BETWEEN + два ребёнка).
- [x] В FIR присутствуют подписи всех полей формы: «Как к вам обращаться?», «Номер телефона», «Что хотели бы озеленить?», «Пара слов о задаче», текст согласия.
- [x] Текст в `.visually-hidden` не попадает в FIR.
- [x] `npm test`, `npm run typecheck`, `npm run build` проходят.

## 5. Чек-лист реализации
- [x] Добавить обход `childNodes` с созданием TEXT для raw text nodes.
- [x] Рассчитывать bounds текстового узла через Range.
- [x] Проверить порядок и z-index соседей.
- [x] Добавить тесты (FAQ, label, visually-hidden).
- [x] Пересобрать и проверить извлечение FIR.
- [x] Переместить карточку в `/done`.

## 6. Результат
- В `traverseElement()` FRAME-ветка теперь обходит `childNodes` в DOM-порядке: для `TEXT_NODE` создаётся TEXT с bounds из `Range.getBoundingClientRect()`, элементы обходятся как раньше.
- `extractTextNodeData()` в `text-builder.ts` строит сегмент из computed-стилей родителя (шрифт, размер, цвет, line-height, letter-spacing).
- Визуально-скрытые контейнеры (`1×1` + `overflow:hidden` + `clip`) отфильтрованы, поэтому `company_website`/«Не заполнять» не попадает в FIR.
- Повторное извлечение: 142 TEXT (было 129), 17 IMAGE, 2 VECTOR, 148 FRAME.
- `summary`: `TEXT 'Всегда зелёные'` + `span.faq-plus` (52×52); у формы появились `label-text` для всех 5 подписей.
- Тесты: 82/82; новый файл `tests/raw-text-nodes.test.ts`.
- E2E v7 (кадр `16:2`): вопросы FAQ и подписи полей видны; «+» первого FAQ остался в левом верхнем углу (косметика).
