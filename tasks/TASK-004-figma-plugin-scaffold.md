---
id: TASK-004
title: Каркас Figma Plugin (manifest, UI и связь песочницы)
status: pending
priority: high
phase: 1
dependencies: [TASK-001, TASK-002]
tags: [figma-plugin, manifest, ui, sandbox]
---

# TASK-004: Каркас Figma Plugin

## 1. Описание задачи
Создать манифест и минимально работающий плагин для Figma. Плагин должен открывать интерфейс (iframe UI) с текстовым полем для вставки JSON (FIR) и кнопкой «Импортировать в Figma», а также пересылать данные в песочницу `code.ts` через `figma.ui.postMessage`.

## 2. Связанные разделы документации
- [ARCHITECTURE.md](file:///e:/Projects/Dev/html2design/ARCHITECTURE.md) (Раздел 2: High-Level Design, Plugin Sandbox)
- [AGENTS.md](file:///e:/Projects/Dev/html2design/AGENTS.md) (Безопасность песочницы Figma)

## 3. Технические детали и требования к реализации
- Создать `manifest.json`:
  - `name`: "HTML to Design (Open Source)"
  - `id`: уникальный dev ID
  - `api`: "1.0.0"
  - `main`: "dist/code.js"
  - `ui`: "dist/ui.html"
  - `editorType`: `["figma"]`
- Создать UI: `src/plugin/ui.html` (или `.ts` шаблон):
  - Поле `textarea` для вставки FIR JSON.
  - Кнопка «Импортировать».
  - Обработка клика: отправка сообщения `{ type: 'IMPORT_FIR', payload: json }` через `parent.postMessage`.
- Создать `src/plugin/code.ts`:
  - Инициализация `figma.showUI(__html__, { width: 400, height: 500 })`.
  - Прослушивание `figma.ui.onmessage` и базовое логирование полученного объекта.

## 4. Критерии приемки (Definition of Done)
- [ ] Плагин успешно загружается в Figma Desktop через `Plugins -> Development -> Import plugin from manifest...`.
- [ ] Окно плагина открывается, в него можно вставить тестовый JSON.
- [ ] По нажатию кнопки в консоли плагина Figma логируется валидный объект сообщения.

## 5. Чек-лист реализации
- [ ] Создать `manifest.json`.
- [ ] Создать `src/plugin/ui.html` со стилизованной формой ввода.
- [ ] Написать входную точку `src/plugin/code.ts` с подпиской на `onmessage`.
- [ ] Настроить сборку `ui.html` в `dist/ui.html`.
- [ ] Проверить запуск в приложении Figma.
- [ ] Переместить карточку в `/done`.
