---
id: TASK-025
title: Исправление позиционирования абсолютно спозиционированных карточек (hero-card)
status: pending
priority: high
phase: 6
dependencies: [TASK-015, TASK-021]
tags: [extractor, figma-plugin, layout, bugfix]
---

# TASK-025: Исправление позиционирования абсолютно спозиционированных карточек (hero-card)

## 1. Описание задачи
При тестировании `alfagreen-fitosteny.html` в Figma Desktop карточка `.hero-card` (`Monkey Grinder`, `position: absolute; left: 8px; bottom: 25px`) сместилась ближе к центру родительской секции `.hero` вместо левого нижнего угла.

## 2. Связанные разделы документации
- [ARCHITECTURE.md](file:///e:/Projects/Dev/html2design/ARCHITECTURE.md)
- [KNOWLEDGE_BASE.md](file:///e:/Projects/Dev/html2design/KNOWLEDGE_BASE.md)

## 3. Технические детали и требования к реализации
- Проверить причину смещения `bounds.x` у `.hero-card` и её родителя `.hero` при извлечении и рендеринге:
  - Учесть возможные CSS `transform` или несоответствие `childRelX = childNode.bounds.x - node.bounds.x` при наличии скролла или `FIXED`/`HUG` resize в `node-factory.ts`.
  - В `src/plugin/node-factory.ts`: для дочерних нод в контейнерах `layoutMode === 'NONE'` и для `layoutPositioning = 'ABSOLUTE'` гарантировать установку `x` и `y` **после** всех операций `resize` и `applyAutoLayout` над родителем и самой нодой.

## 4. Критерии приемки (Definition of Done)
- [ ] `.hero-card` располагается в левом нижнем углу hero-секции (`x ≈ 8px` относительно `.hero`), совпадая с эталоном в браузере.
- [ ] Добавлен регрессионный тест в `tests/grid-fallback.test.ts` или `tests/layout-engine.test.ts`.

## 5. Чек-лист реализации
- [ ] Диагностировать и исправить расчёт/установку координат в `dom-extractor.ts` / `node-factory.ts`.
- [ ] Добавить unit-тест для `position: absolute` детей после `resize`.
- [ ] Проверить `npm test` и `npm run build`.
- [ ] Переместить карточку в `/done`.
