---
id: TASK-034
title: Блочные ссылки/спаны схлопываются в один TEXT-узел (потеря картинок и структуры карточек)
status: done
priority: critical
phase: 7
dependencies: []
tags: [extractor, text, images, layout, bugfix]
---

# TASK-034: Блочные `a`/`span` схлопываются в TEXT и теряют дочерние картинки

## 1. Описание задачи
При импорте `examples/alfagreen-fitosteny/alfagreen-fitosteny.html` (viewport 1440, билд `dist/code.js` SHA256 `CA459A64…CBD7`) все карточки товаров, проектов и строки услуг превращаются в один текстовый узел. Картинки, вложенные заголовки и CTA исчезают, текст склеивается в одну строку и наезжает друг на друга.

Причина: `isTextContainer()` в `src/extractor/text-builder.ts` безусловно считает текст-контейнерами все теги из `INLINE_TAGS`, включая `A` и `SPAN`, не проверяя `computed.display`. Для `<a class="product-card" style="display:flex">` это включает ветку TEXT в `traverseElement()`, которая отбрасывает всех потомков.

Пострадало 14 контейнеров и 10 фотографий:
- 4 × `a.product-card` (CSS `display:flex`) → TEXT `a.product-card-text` (потеряны 4 `<img>` внутри `.product-image`); в Figma это узлы `8:1251`, `8:1253`, `8:1255`, `8:1257`.
- 6 × `a.project-photo` → FRAME с единственным TEXT `a.project-photo-text`, `<img>` потерян; текст fallback-подписи («Monkey Grinder») вылезает поверх заголовка секции.
- 4 × `a.service-row` → TEXT `a.service-row-text` с тремя сегментами (`01` + заголовок 45.6px + описание 17.1px) в одной строке; в Figma номера, заголовки и описания накладываются.

## 2. Связанные разделы документации
- [ARCHITECTURE.md](file:///e:/Projects/Dev/html2design/ARCHITECTURE.md)
- [KNOWLEDGE_BASE.md](file:///e:/Projects/Dev/html2design/KNOWLEDGE_BASE.md) — «Баг 3: Разорванный текст при инлайн-стилях»
- Отчёт: `examples/alfagreen-fitosteny/v6/REPORT.md`, кропы `compare-3-1350-2150.png`, `compare-4-2100-2850.png`

## 3. Технические детали и требования к реализации
- В `isTextContainer(element)` учитывать `window.getComputedStyle(element).display`:
  - если `display` не `inline`/`inline-*` — не считать тег текстовым контейнером только по имени;
  - для `A`/`SPAN` с `display: flex | grid | block | inline-flex` и элементами-потомками (`img`, `div`, `h1..h6`, `button`) идти по ветке FRAME.
- В `traverseElement()` перед text-веткой проверять наличие «структурных» потомков: `IMG`, `SVG`, блоков с ненулевым размером; при их наличии строить FRAME и обходить детей.
- Сохранить корректную обработку настоящих инлайн-ссылок/спанов внутри абзацев (там display остаётся `inline`).
- Не ломать `a.pill-link`, `a.text-link`, `a.btn`: у них текстовая ветка допустима, но стили фона/радиуса должны оставаться на FRAME.
- Добавить unit-тест: `<a style="display:flex"><img><h3>..</h3></a>` → FRAME с IMAGE + TEXT.

## 4. Критерии приемки (Definition of Done)
- [x] FIR для `.product-card` — FRAME, содержит IMAGE и отдельные TEXT (`h3`, описание, CTA); в Figma видны 4 фото товаров.
- [x] FIR для `.project-photo` — FRAME с IMAGE; в Figma видны 6 фото проектов.
- [x] FIR для `.service-row` — FRAME с отдельными TEXT для номера, заголовка и описания; в отрендеренном фрейме нет наложения текста.
- [x] Количество IMAGE-узлов в FIR для этой страницы выросло с 7 до 17 (добавляются 10 фото карточек).
- [x] `npm test`, `npm run typecheck`, `npm run build` проходят; регрессий на инлайн-ссылках нет.

## 5. Чек-лист реализации
- [x] Исправить `isTextContainer()` (учёт computed display и структурных детей).
- [x] Уточнить text-ветку `traverseElement()`.
- [x] Добавить тест на блочную ссылку с картинкой.
- [x] Пересобрать `dist`, повторить извлечение FIR и сверить структуру.
- [x] Переместить карточку в `/done`.

## 6. Результат
- `isTextContainer()` больше не считает `A`/`SPAN` текстом безусловно: flex/grid-контейнеры с детьми уходят в FRAME, а `isInlineElement()` считает `IMG/SVG/INPUT/...` структурными даже при `display:inline`.
- Повторное извлечение (viewport 1440): **17 IMAGE** (было 7), 151 FRAME, 129 TEXT.
- `.product-card` → FRAME с `div.product-image > IMAGE` + `h3` + `span.product-meta` + `span.product-cta`.
- `.project-photo` → FRAME с `IMAGE` и абсолютным fallback-TEXT.
- `.service-row` → FRAME с тремя TEXT: `01`, заголовок 45.6px, описание 17.1px.
- Тесты: 80/80; новый файл `tests/text-container.test.ts` (6 кейсов).
- E2E v7 (кадр `16:2`): 4 фото товаров и 6 фото проектов видны, тексты карточек не наезжают.
