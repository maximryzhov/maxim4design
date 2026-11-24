---
id: TASK-010
title: Санитизация и конвертация SVG в нативные векторные ноды
status: done
priority: high
phase: 3
dependencies: [TASK-005]
tags: [svg, vector, figma-plugin, extractor]
---

# TASK-010: Санитизация и конвертация SVG в нативные векторы

## 1. Описание задачи
Реализовать механизм переноса встроенных иконок и векторных элементов (`<svg>`) в редактируемые векторные слои Figma через `figma.createNodeFromSvg()`. Решить критическую проблему `currentColor` и CSS-переменных, из-за которых SVG в Figma отображаются черными.

## 2. Связанные разделы документации
- [ARCHITECTURE.md](file:///e:/Projects/Dev/html2design/ARCHITECTURE.md) (Раздел 4.1: Asset Serializer)
- [KNOWLEDGE_BASE.md](file:///e:/Projects/Dev/html2design/KNOWLEDGE_BASE.md) (Баг 2: Черные или сломанные SVG)

## 3. Технические детали и требования к реализации
- В экстракторе (`src/extractor/svg-serializer.ts`):
  - При обнаружении тега `<svg>`:
    - Считывать вычисленный `color` родительского элемента.
    - Производить замену всех вхождений `currentColor` в строке разметки на реальное значение цвета (`rgb` или `#hex`).
    - Если у SVG отсутствуют атрибуты `width`/`height`, гарантировать наличие `viewBox`.
    - Сохранять очищенную строку разметки в `node.svgContent`.
    - Помечать тип узла как `VECTOR`.
- В плагине (`src/plugin/vector-renderer.ts`):
  - Вызывать `figma.createNodeFromSvg(node.svgContent)`.
  - Оборачивать вызов в `try/catch` (если SVG поврежден — создавать прямоугольник-заглушку с предупреждением в консоли).
  - Устанавливать размеры и координаты созданного фрейма/вектора в соответствии с `node.bounds`.

## 4. Критерии приемки (Definition of Done)
- [x] Иконки (например, Lucide, Heroicons, Feather) переносятся как чистые векторные группы/слои, а не как растровые картинки.
- [x] Цвет иконок, заданный через CSS-класс или `currentColor`, точно соответствует цветам на сайте.
- [x] Ошибочные или нестандартные SVG не роняют плагин.

## 5. Чек-лист реализации
- [x] Создать `src/extractor/svg-serializer.ts` с санитизацией `currentColor`.
- [x] Создать `src/plugin/vector-renderer.ts`.
- [x] Реализовать безопасный вызов `figma.createNodeFromSvg`.
- [x] Протестировать импорт блока с набором векторных иконок.
- [x] Переместить карточку в `/done`.
