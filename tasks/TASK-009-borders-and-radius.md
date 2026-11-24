---
id: TASK-009
title: Маппинг границ и скруглений (Borders и CornerRadius)
status: pending
priority: medium
phase: 2
dependencies: [TASK-005]
tags: [styles, borders, corner-radius, figma-plugin]
---

# TASK-009: Маппинг границ и скруглений

## 1. Описание задачи
Реализовать точный перенос стилей оформления контейнеров: скругления углов (`border-radius`, включая независимые углы) и границы (`border`, включая разные стороны `border-top`, `border-bottom` и т.д.), а также обрезку контента (`overflow: hidden`).

## 2. Связанные разделы документации
- [ARCHITECTURE.md](file:///e:/Projects/Dev/html2design/ARCHITECTURE.md) (Раздел 4.1: Computed Style Parser)
- [KNOWLEDGE_BASE.md](file:///e:/Projects/Dev/html2design/KNOWLEDGE_BASE.md) (Баг 11: Границы элементов)

## 3. Технические детали и требования к реализации
- В экстракторе (`src/extractor/style-extractor.ts`):
  - Извлекать `borderTopLeftRadius`, `borderTopRightRadius`, `borderBottomRightRadius`, `borderBottomLeftRadius`.
  - Извлекать ширину, цвет и стиль для каждой стороны (`borderTopWidth`, `borderTopColor`, `borderTopStyle` и т.д.).
  - Считывать `overflow` -> `clipsContent: overflow === 'hidden'`.
- В плагине (`src/plugin/style-applier.ts`):
  - Установка скруглений:
    - Если все 4 угла одинаковы -> `frame.cornerRadius = r`.
    - Если разные -> `frame.topLeftRadius`, `frame.topRightRadius`, `frame.bottomRightRadius`, `frame.bottomLeftRadius`.
  - Установка индивидуальных весов обводок (Strokes):
    - `frame.strokeTopWeight = topWidth`
    - `frame.strokeBottomWeight = bottomWidth`
    - `frame.strokeLeftWeight = leftWidth`
    - `frame.strokeRightWeight = rightWidth`
    - Заливка обводки: `frame.strokes = [strokePaint]`.
  - Установка `frame.clipsContent = clipsContent`.

## 4. Критерии приемки (Definition of Done)
- [ ] Кнопки с круглыми краями (pill buttons) и карточки с разными радиусами углов переносятся без искажений.
- [ ] Разделители и табы с `border-bottom` отображаются именно как нижняя граница, а не замкнутый контур.
- [ ] Контейнеры с `overflow: hidden` получают флаг "Clip content" в Figma.

## 5. Чек-лист реализации
- [ ] Реализовать извлечение раздельных радиусов и границ в экстракторе.
- [ ] Создать модуль `src/plugin/style-applier.ts`.
- [ ] Применить независимые обводки и скругления к `FrameNode`.
- [ ] Протестировать на элементах UI-китов (input, select, pill-badge, tabs).
- [ ] Переместить карточку в `/done`.
