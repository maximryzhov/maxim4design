---
id: TASK-031
title: Предотвращение наложения высоких заголовков на соседние блоки (lineHeight и z-index)
status: pending
priority: high
phase: 7
dependencies: [TASK-019, TASK-026]
tags: [figma-plugin, typography, layout, bugfix]
---

# TASK-031: Предотвращение наложения высоких заголовков на соседние блоки (lineHeight и z-index)

## 1. Описание задачи
В секциях `У КАЖДОГО ПРОСТРАНСТВА СВОЯ ЗЕЛЕНЬ` и `ЗЕЛЕНЬ, КОТОРАЯ УЖЕ СТАЛА ЧАСТЬЮ ИНТЕРЬЕРА` нижняя строка заголовка (`ЗЕЛЕНЬ`, `ИНТЕРЬЕРА`) перекрывается верхним краем карточек, расположенных ниже. Причина — расхождение между браузерным `line-height` (например, `0.98` для `Oswald`) и высотой `TextNode` при `textAutoResize = 'HEIGHT'`.

## 2. Связанные разделы документации
- [ARCHITECTURE.md](file:///e:/Projects/Dev/html2design/ARCHITECTURE.md)
- [KNOWLEDGE_BASE.md](file:///e:/Projects/Dev/html2design/KNOWLEDGE_BASE.md)

## 3. Технические детали и требования к реализации
- В `src/extractor/text-builder.ts`:
  - Если `computed.lineHeight` задан в пикселях или числе, всегда записывать `lineHeightPx` в каждый `TextSegment` (а при отсутствии — вычислять `fontSize * 1.1` для display-шрифтов).
- В `src/plugin/text-renderer.ts`:
  - Устанавливать `textNode.lineHeight` на уровне всей ноды и сегментов до установки `textAutoResize = 'HEIGHT'`, чтобы Figma использовала точный браузерный межстрочный интервал (`0.98 * fontSize`) и не раздувала заголовок вниз.

## 4. Критерии приемки (Definition of Done)
- [ ] Нижняя строка заголовков `У КАЖДОГО ПРОСТРАНСТВА СВОЯ ЗЕЛЕНЬ` и `ЗЕЛЕНЬ, КОТОРАЯ УЖЕ СТАЛА ЧАСТЬЮ ИНТЕРЬЕРА` не перекрывается нижними карточками.
- [ ] Добавлен unit-тест в `tests/text-ranges.test.ts`.

## 5. Чек-лист реализации
- [ ] Гарантировать передачу и применение `lineHeightPx` в `text-builder.ts` и `text-renderer.ts`.
- [ ] Добавить unit-тест и проверить `npm test`, `npm run typecheck`, `npm run build`.
- [ ] Переместить карточку в `/done`.
