---
id: TASK-014
title: Stacking Contexts и Z-Index менеджер порядка слоев
status: done
priority: medium
phase: 3
dependencies: [TASK-005]
tags: [stacking-context, z-index, layers, figma-plugin]
---

# TASK-014: Stacking Contexts и Z-Index менеджер порядка слоев

## 1. Описание задачи
Реализовать правильный порядок добавления слоев в Figma с учетом контекстов наложения (Stacking Contexts) и свойства `z-index`. В Figma порядок вызовов `appendChild` определяет, какой элемент находится выше по оси Z, что часто расходится с естественным порядком элементов в DOM.

## 2. Связанные разделы документации
- [ARCHITECTURE.md](file:///e:/Projects/Dev/html2design/ARCHITECTURE.md) (Раздел 4.2: Stacking Context Manager)
- [KNOWLEDGE_BASE.md](file:///e:/Projects/Dev/html2design/KNOWLEDGE_BASE.md) (Баг 7: Нарушение иерархии слоев)

## 3. Технические детали и требования к реализации
- В экстракторе (`src/extractor/dom-extractor.ts`):
  - Считывать вычисленный `zIndex`. Если `auto` или `inherit` — сохранять `0`.
  - Помечать узлы, создающие новый контекст наложения (`position: fixed | sticky | absolute`, `opacity < 1`, `transform !== 'none'`).
- В плагине (`src/plugin/stacking-manager.ts`):
  - При рендеринге массива `node.children`:
    - Выполнять стабильную сортировку по `zIndex`:
      - Дети с отрицательным `zIndex` рендерятся первыми (лежат на самом дне).
      - Дети с `zIndex === 0` или `auto` сохраняют естественный DOM-порядок.
      - Дети с положительным `zIndex` сортируются по возрастанию (лежат выше).
    - Вызывать `parent.appendChild(child)` в отсортированном порядке.

## 4. Критерии приемки (Definition of Done)
- [x] Фиксированные меню (sticky headers), выпадающие списки (dropdowns) и тултипы отображаются поверх контента страницы, а не прячутся под ним.
- [x] Отрицательные фоновые декорации (`z-index: -1`) корректно остаются под текстом.

## 5. Чек-лист реализации
- [x] Добавить извлечение числового `zIndex` в экстрактор.
- [x] Создать `src/plugin/stacking-manager.ts` с функцией стабильной сортировки `sortChildrenByStackingOrder`.
- [x] Подключить сортировку перед вызовом `appendChild` в `node-factory.ts`.
- [x] Протестировать страницу со всплывающим модальным окном или дропдауном.
- [x] Переместить карточку в `/done`.
