---
id: TASK-033
title: Исправление рендера фоновых иконок в элементах select и background-size
status: pending
priority: low
phase: 7
dependencies: [TASK-011]
tags: [extractor, figma-plugin, images, bugfix]
---

# TASK-033: Исправление рендера фоновых иконок в элементах select и background-size

## 1. Описание задачи
В форме обратной связи (`select#lead-service`) нативная data-URI иконка стрелки, заданная через CSS `background-image` с маленьким `background-size` (например, `14px 14px`) и `background-repeat: no-repeat`, растягивается в Figma (`scaleMode: 'FILL'`) на всю область элемента и превращается в увеличенный пиксельный квадрат в центре поля.

## 2. Связанные разделы документации
- [ARCHITECTURE.md](file:///e:/Projects/Dev/html2design/ARCHITECTURE.md)
- [KNOWLEDGE_BASE.md](file:///e:/Projects/Dev/html2design/KNOWLEDGE_BASE.md)

## 3. Технические детали и требования к реализации
- В `src/extractor/image-loader.ts`:
  - При извлечении `background-image` учитывать `computed.backgroundSize`: если размер фона задан в пикселях (например, `< 40px`) и существенно меньше размеров самого элемента (`bounds.width`), не растягивать его на весь фрейм как `FILL`, а либо выставлять `scaleMode: 'FIT'`, либо пропускать мелкие декоративные data-URI иконки `<select>` (или создавать отдельную иконку по `backgroundPosition`).

## 4. Критерии приемки (Definition of Done)
- [ ] Элемент `select#lead-service` отображается чисто, без растянутого пиксельного квадрата в центре.
- [ ] Добавлен unit-тест в `tests/image-pipeline.test.ts`.

## 5. Чек-лист реализации
- [ ] Обработать `backgroundSize` в пикселях в `src/extractor/image-loader.ts`.
- [ ] Добавить unit-тест и проверить `npm test`, `npm run typecheck`, `npm run build`.
- [ ] Переместить карточку в `/done`.
