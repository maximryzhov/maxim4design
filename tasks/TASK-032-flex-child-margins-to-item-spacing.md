---
id: TASK-032
title: Учет CSS margin между соседними элементами в flex-контейнерах с gap 0
status: pending
priority: medium
phase: 7
dependencies: [TASK-007, TASK-021]
tags: [extractor, layout, bugfix]
---

# TASK-032: Учет CSS margin между соседними элементами в flex-контейнерах с gap 0

## 1. Описание задачи
В карточках (`Фитостены` + `плоские композиции...`, `01` + `Рестораны и кафе` + `для атмосферы...`) соседние текстовые блоки прижаты друг к другу без отступа, так как отступы в CSS заданы через `margin-right` / `margin-bottom` на дочерних элементах, а не через CSS `gap` на flex-родителе (`itemSpacing` равен `0`).

## 2. Связанные разделы документации
- [ARCHITECTURE.md](file:///e:/Projects/Dev/html2design/ARCHITECTURE.md)
- [KNOWLEDGE_BASE.md](file:///e:/Projects/Dev/html2design/KNOWLEDGE_BASE.md)

## 3. Технические детали и требования к реализации
- В `src/extractor/dom-extractor.ts`:
  - Если контейнер имеет `layout.mode` (`HORIZONTAL` или `VERTICAL`) и `layout.itemSpacing === 0`, но его видимые дочерние элементы имеют ненулевые геометрические зазоры (вычисленные по разнице их `bounds`: `child[i+1].bounds.x - (child[i].bounds.x + child[i].bounds.width)` для `HORIZONTAL` или по `y` для `VERTICAL`), вычислять минимальный/медианный положительный зазор и подставлять его в `layout.itemSpacing`.

## 4. Критерии приемки (Definition of Done)
- [ ] В `HORIZONTAL` и `VERTICAL` flex-контейнерах с `gap: 0` и `margin` между детьми сохраняется реальный визуальный отступ в Figma Auto Layout.
- [ ] Добавлен unit-тест в `tests/layout-engine.test.ts` или `tests/dom-extractor.test.ts`.

## 5. Чек-лист реализации
- [ ] Реализовать вычисление эффективного `itemSpacing` из геометрических зазоров детей при `gap === 0` в `src/extractor/dom-extractor.ts`.
- [ ] Добавить unit-тест и проверить `npm test`, `npm run typecheck`, `npm run build`.
- [ ] Переместить карточку в `/done`.
