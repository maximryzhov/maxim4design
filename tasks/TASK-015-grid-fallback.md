---
id: TASK-015
title: Fallback для CSS Grid и сложных не-flex раскладок (Absolute Positioning)
status: pending
priority: high
phase: 4
dependencies: [TASK-007]
tags: [grid, layout, fallback, autolayout, figma-plugin]
---

# TASK-015: Fallback для CSS Grid и сложных раскладок

## 1. Описание задачи
Реализовать стратегию «Graceful Degradation» для сеток CSS Grid, раскладок со `sticky` / `fixed` и сложного абсолютного позиционирования. Поскольку в Figma нет нативного аналога двумерного CSS Grid, такие контейнеры должны плавно переключаться в режим обычных фреймов с абсолютным позиционированием детей по координатам `getBoundingClientRect()`, чтобы гарантировать 100% визуальную идентичность.

## 2. Связанные разделы документации
- [ARCHITECTURE.md](file:///e:/Projects/Dev/html2design/ARCHITECTURE.md) (Раздел 6: Стратегия отказоустойчивости, Раздел 4.1: Layout Analyzer)
- [KNOWLEDGE_BASE.md](file:///e:/Projects/Dev/html2design/KNOWLEDGE_BASE.md) (Баг 6: CSS Grid и сложные раскладки vs Auto Layout)

## 3. Технические детали и требования к реализации
- В экстракторе (`src/extractor/layout-analyzer.ts`):
  - Проверять `display: grid` или `display: inline-grid`.
  - Проверять наличие детей с `position: absolute / fixed` внутри относительных контейнеров.
  - Если контейнер не может быть выражен чистым одномерным Flexbox:
    - Выставлять `layout.mode = 'NONE'`.
    - Для всех дочерних элементов рассчитывать относительные координаты:
      ```typescript
      childRelX = childBounds.x - parentBounds.x;
      childRelY = childBounds.y - parentBounds.y;
      ```
- В плагине (`src/plugin/layout-engine.ts`):
  - Если `layout.mode === 'NONE'`:
    - Не включать Auto Layout (`frame.layoutMode = 'NONE'`).
    - Устанавливать детям точные координаты `child.x = childRelX; child.y = childRelY;`.
  - Поддержка абсолютного позиционирования внутри Auto Layout фреймов:
    - Если у элемента в вебе `position: absolute`, а родитель — Auto Layout, в Figma API выставлять:
      `child.layoutPositioning = 'ABSOLUTE'`.

## 4. Критерии приемки (Definition of Done)
- [ ] Сложные дашборды с CSS Grid (несколько колонок и строк, `grid-template-areas`) импортируются без разваливания сетки.
- [ ] Абсолютные бейджи (например, индикатор непрочитанных сообщений в углу аватарки) встают ровно на свои места.

## 5. Чек-лист реализации
- [ ] Реализовать детектор CSS Grid в `src/extractor/layout-analyzer.ts`.
- [ ] Добавить расчет относительных смещений для абсолютных слоев.
- [ ] Реализовать `child.layoutPositioning = 'ABSOLUTE'` в плагине.
- [ ] Протестировать на странице сложного дашборда (например, аналитическая панель с графиками и сеткой).
- [ ] Переместить карточку в `/done`.
