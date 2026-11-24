---
id: TASK-008
title: Нормализация текста и инлайн-стили (Text Ranges и Whitespace)
status: pending
priority: high
phase: 2
dependencies: [TASK-006]
tags: [typography, text, ranges, figma-plugin, extractor]
---

# TASK-008: Нормализация текста и инлайн-стили

## 1. Описание задачи
Реализовать правильную обработку сложного текста с инлайн-тегами (`span`, `b`, `strong`, `a`, `i`). Текст внутри одного абзаца должен создаваться как **один единый** `TextNode`, а разные стили (жирность, цвет ссылки, подчеркивание) должны накладываться через диапазоны символов (`setRangeFontName`, `setRangeFills`). Также необходимо решить проблему коллапса пробелов (Whitespace Collapsing).

## 2. Связанные разделы документации
- [ARCHITECTURE.md](file:///e:/Projects/Dev/html2design/ARCHITECTURE.md) (Раздел 4.1: Text & Range Builder)
- [KNOWLEDGE_BASE.md](file:///e:/Projects/Dev/html2design/KNOWLEDGE_BASE.md) (Баг 3: Разорванный текст при инлайн-стилях, Баг 4: Коллапс пробелов)

## 3. Технические детали и требования к реализации
- В экстракторе (`src/extractor/text-builder.ts`):
  - При обходе текстовых узлов внутри блочного элемента (p, h1..h6, button, li):
    - Собирать объединенный `characters` через нормализацию `innerText` / сжатие пробелов `/\s+/g` в один пробел (если не `white-space: pre`).
    - Рассчитывать индексы смещения `[start, end]` для каждого дочернего инлайн-узла.
    - Сохранять массив `TextSegment[]` (семейство шрифта, вес, цвет, размер, подчеркивание).
- В плагине (`src/plugin/text-renderer.ts`):
  - Создавать один `figma.createText()`.
  - Устанавливать базовый шрифт и строку `characters`.
  - Проходить по массиву сегментов и применять:
    - `node.setRangeFontName(start, end, loadedFont)`
    - `node.setRangeFontSize(start, end, segment.fontSize)`
    - `node.setRangeFills(start, end, [solidPaint])`
    - `node.setRangeTextDecoration(start, end, segment.textDecoration)`

## 4. Критерии приемки (Definition of Done)
- [ ] Абзац со ссылками и жирным шрифтом импортируется как единый редактируемый текстовый блок (не разбивается на десятки мелких фреймов).
- [ ] Перенос строк работает естественно при изменении ширины фрейма в Figma.
- [ ] Лишние пробелы и табуляции исходного кода HTML удалены.

## 5. Чек-лист реализации
- [ ] Создать `src/extractor/text-builder.ts`.
- [ ] Написать алгоритм сбора текстовых диапазонов с учетом `white-space`.
- [ ] Создать `src/plugin/text-renderer.ts` с поддержкой `setRange*`.
- [ ] Протестировать на сложной статье блога со смешанным форматированием.
- [ ] Переместить карточку в `/done`.
