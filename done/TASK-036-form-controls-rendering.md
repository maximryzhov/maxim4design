---
id: TASK-036
title: Поля форм (input/select/textarea) не рендерятся: нет value/placeholder/опций и границ
status: done
priority: high
phase: 7
dependencies: [TASK-035]
tags: [extractor, figma-plugin, forms, bugfix]
---

# TASK-036: Form controls не попадают в FIR и выглядят пустыми прямоугольниками

## 1. Описание задачи
На странице `alfagreen-fitosteny.html` блок обратной связи (`section#contact`, форма `form#lead-form`) в Figma превращается в набор пустых серых прямоугольников: нет подписей, placeholder-текста, выбранного значения select, текста textarea, чекбокса и границ полей.

Сейчас extractor создаёт для `input`, `select`, `textarea` только FRAME с фоновым цветом:
- `input#lead-name`, `input#lead-phone`, `select#lead-service`, `textarea#lead-message` — узлы без детей;
- значения/`placeholder` и `<option>` игнорируются (`OPTION`/`OPTGROUP` в `IGNORED_TAGS`);
- у полей отсутствуют `borders`, хотя в CSS они есть.

## 2. Связанные разделы документации
- [ARCHITECTURE.md](file:///e:/Projects/Dev/html2design/ARCHITECTURE.md)
- Отчёт: `examples/alfagreen-fitosteny/v6/REPORT.md`, кроп `compare-6-3450-4377.png`

## 3. Технические детали и требования к реализации
- В `traverseElement()` распознавать `INPUT`, `TEXTAREA`, `SELECT` (кроме hidden) и создавать FRAME:
  - `style.backgroundColor`, `borderRadius`, `borders` — из computed styles;
  - дочерний TEXT: для `input`/`textarea` — `value` или `placeholder` (цвет placeholder из `::placeholder`, иначе `--muted`); для `select` — текст выбранного `<option>`;
  - для `type=checkbox` — RECTANGLE 16×16 с радиусом/рамкой и, при `checked`, галкой (SVG/VECTOR);
  - многострочный `textarea`: `textAutoResize: 'HEIGHT'`, переносы по ширине.
- Не включать `select`-стрелку как фон (уже отфильтровано TASK-033); при необходимости рисовать её отдельным VECTOR.
- Учитывать `disabled`, `readonly`, `required` (звёздочка уже приходит отдельным span).
- Добавить unit-тесты на input/textarea/select/checkbox.

## 4. Критерии приемки (Definition of Done)
- [x] В Figma в форме видны подписи, placeholder «Ваше имя», «+7 (___) ___-__-__», выбранное «Искусственные фитостены», placeholder textarea и текст согласия.
- [x] Поля имеют серый фон, скругление и границы как в эталоне; чекбокс отрисован.
- [x] `select#lead-service` не содержит растянутой фоновой иконки.
- [x] FIR валиден, импорт не падает; `npm test`, `npm run typecheck`, `npm run build` проходят.

## 5. Чек-лист реализации
- [x] Добавить обработку `INPUT`/`TEXTAREA`/`SELECT` в extractor.
- [x] Пробросить `value`/`placeholder`/`option` в TEXT-узел.
- [x] Отрисовать чекбокс и границы.
- [x] Тесты + пересборка + повторное извлечение.
- [x] Переместить карточку в `/done`.

## 6. Результат
- В `traverseElement()` добавлена ветка form controls: `INPUT`/`TEXTAREA`/`SELECT` → FRAME со стилями (фон, радиус, рамки) и внутренним TEXT.
- `extractFormControlTextData()` (`text-builder.ts`) берёт `value` или `placeholder` для input/textarea, `selectedOptions[0]` для select; для placeholder используется `::placeholder` color, при его отсутствии — нейтральный fallback.
- Внутренние bounds TEXT считаются по content-box (вычет padding/border), текст не прилипает к краю поля.
- `checkbox`/`radio` → FRAME 16×16 с рамкой и радиусом; при `checked` добавляется VECTOR-галочка.
- `input[type=hidden]` и `.visually-hidden` пропускаются; фоновая стрелка select не извлекается (TASK-033).
- Повторное извлечение: 146 TEXT (было 142), 17 IMAGE, 148 FRAME.
- В форме появились: `input#lead-name-text` «Ваше имя», `input#lead-phone-text` «+7 (___) ___-__-__», `select#lead-service-text` «Искусственные фитостены», `textarea#lead-message-text` с placeholder.
- Тесты: 88/88; новый файл `tests/form-controls.test.ts` (6 кейсов).
- E2E v7 (кадр `16:2`): поля формы с placeholder/значением и чекбоксом видны.
