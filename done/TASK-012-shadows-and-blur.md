---
id: TASK-012
title: Парсер и аппликатор теней и эффектов размытия
status: done
priority: medium
phase: 3
dependencies: [TASK-005]
tags: [styles, effects, shadows, blur, figma-plugin]
---

# TASK-012: Парсер и аппликатор теней и эффектов размытия

## 1. Описание задачи
Реализовать разбор сложных CSS-свойств `box-shadow` (включая множественные тени через запятую и `inset`), а также эффектов размытия (`filter: blur` и `backdrop-filter: blur`), транслируя их в нативные эффекты Figma (`DropShadowEffect`, `InnerShadowEffect`, `LayerBlurEffect`, `BackgroundBlurEffect`).

## 2. Связанные разделы документации
- [ARCHITECTURE.md](file:///e:/Projects/Dev/html2design/ARCHITECTURE.md) (Раздел 4.1: Computed Style Parser)
- [KNOWLEDGE_BASE.md](file:///e:/Projects/Dev/html2design/KNOWLEDGE_BASE.md) (Баг 10: Парсинг теней box-shadow)

## 3. Технические детали и требования к реализации
- В экстракторе (`src/extractor/effects-parser.ts`):
  - Регулярное выражение или посимвольный парсер для разбиения сложных списков теней: `box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)`.
  - Извлечение: `x`, `y`, `blur`, `spread`, `color`, `isInset`.
  - Считывание `backdropFilter` (эффект матового стекла / glassmorphism).
- В плагине (`src/plugin/effects-applier.ts`):
  - Формирование массива `Effect[]`:
    - Обычная тень: `{ type: 'DROP_SHADOW', color, offset: {x, y}, radius: blur, spread, visible: true }`.
    - Внутренняя тень (`inset`): `{ type: 'INNER_SHADOW', ... }`.
    - `backdrop-filter`: `{ type: 'BACKGROUND_BLUR', radius, visible: true }`.
  - Применение: `frame.effects = effectsArray`.

## 4. Критерии приемки (Definition of Done)
- [x] Карточки с современными мягкими тенями (Tailwind CSS: `shadow-md`, `shadow-xl`) выглядят идентично оригиналу.
- [x] Внутренние тени (`inset`) корректно маппятся в `Inner shadow`.
- [x] Размытие заднего фона в модальных окнах или шапках переносится как `Background blur`.

## 5. Чек-лист реализации
- [x] Создать `src/extractor/effects-parser.ts`.
- [x] Написать парсер составных строк `box-shadow`.
- [x] Создать `src/plugin/effects-applier.ts`.
- [x] Протестировать импорт модального окна со стеклянным фоном (glassmorphism) и сложными тенями.
- [x] Переместить карточку в `/done`.
