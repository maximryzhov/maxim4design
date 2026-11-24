---
id: TASK-005
title: PoC рендерер нод в Figma (FrameNode и TextNode)
status: pending
priority: high
phase: 1
dependencies: [TASK-003, TASK-004]
tags: [figma-plugin, renderer, poc, factory]
---

# TASK-005: PoC рендерер нод в Figma

## 1. Описание задачи
Реализовать минимальный рекурсивный генератор слоев в Figma, который принимает базовое дерево `FIRNode` и создает соответствующие нативные слои на холсте: `figma.createFrame()` для контейнеров и `figma.createText()` для текстовых узлов с базовым шрифтом `Inter`.

## 2. Связанные разделы документации
- [ARCHITECTURE.md](file:///e:/Projects/Dev/html2design/ARCHITECTURE.md) (Раздел 4.2: Модуль рендеринга)
- [KNOWLEDGE_BASE.md](file:///e:/Projects/Dev/html2design/KNOWLEDGE_BASE.md) (Баг 1: Фатальный краш на шрифтах)

## 3. Технические детали и требования к реализации
- Создать фабрику нод `src/plugin/node-factory.ts`.
- Реализовать предзагрузку шрифта:
  - `await figma.loadFontAsync({ family: "Inter", style: "Regular" })`.
- Реализовать обработку нод:
  - `FRAME`: `figma.createFrame()`, установка `resize(width, height)`, `x`, `y`, `fills` (сплошной цвет).
  - `TEXT`: `figma.createText()`, установка `characters`, `fontSize`, цвета заливки.
- Рекурсивно добавлять детей: `frame.appendChild(childNode)`.
- Фокусировать холст на созданном элементе: `figma.currentPage.selection = [rootNode]; figma.viewport.scrollAndZoomIntoView([rootNode])`.

## 4. Критерии приемки (Definition of Done)
- [ ] Завершение Phase 1 (End-to-End PoC): скрипт в браузере копирует блок страницы -> JSON вставляется в плагин -> на холсте Figma появляется точно такой же цветной блок с текстом.
- [ ] Ошибки шрифтов перехватываются и не ломают плагин.
- [ ] Координаты вложенных элементов корректно рассчитываются относительно родителя.

## 5. Чек-лист реализации
- [ ] Создать `src/plugin/node-factory.ts`.
- [ ] Реализовать `renderFIRNode(node: FIRNode, parent?: BaseNodeMixin)`.
- [ ] Подключить генератор к сообщению `IMPORT_FIR` в `code.ts`.
- [ ] Протестировать сквозной сценарий на реальном HTML-фрагменте.
- [ ] Переместить карточку в `/done`.
