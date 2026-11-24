---
id: TASK-016
title: Клиентский экстрактор (Bookmarklet и Chrome Extension)
status: pending
priority: high
phase: 4
dependencies: [TASK-003, TASK-010, TASK-011]
tags: [extension, bookmarklet, browser, integration]
---

# TASK-016: Клиентский экстрактор (Bookmarklet и Chrome Extension)

## 1. Описание задачи
Собрать браузерный инструмент для захвата веб-страницы в один клик. Инструмент должен работать прямо в активной вкладке пользователя, чтобы иметь доступ к `localhost`, страницам за корпоративным VPN и закрытым интерфейсам под логином (обходя CORS и проблемы авторизации headless-браузеров).

## 2. Связанные разделы документации
- [ARCHITECTURE.md](file:///e:/Projects/Dev/html2design/ARCHITECTURE.md) (Раздел 2: High-Level Design, Web Context)
- [KNOWLEDGE_BASE.md](file:///e:/Projects/Dev/html2design/KNOWLEDGE_BASE.md) (Баг 8: Localhost, закрытые страницы и CORS)

## 3. Технические детали и требования к реализации
- Создать папку `src/extension/`:
  - `manifest.json` (Manifest V3):
    - `permissions`: `["activeTab", "scripting"]`.
    - `action`: всплывающее окно (popup) с кнопками «Захватить всю страницу» и «Захватить выделенный элемент».
  - `content-script.ts`:
    - Инжектируется на страницу, запускает `extractFIRFromElement(document.body)`.
    - Реализует режим подсветки (hover outline) для выбора конкретного блока мышью.
    - Автоматически копирует сжатый JSON в буфер обмена (`navigator.clipboard.writeText`) или шлет сообщение через WebSocket на локальный сервер (если запущен).
  - Сборка бандла Bookmarklet (`dist/bookmarklet.js`):
    - Скомпилированная в одну строчку самовызывающаяся функция `javascript:(function(){...})()`.

## 4. Критерии приемки (Definition of Done)
- [ ] Расширение успешно загружается в Google Chrome в режиме разработчика (`Developer mode`).
- [ ] По клику на иконку расширения страница или выбранный блок парсится и валидный FIR JSON помещается в буфер обмена.
- [ ] Работает на локальном сервере `http://localhost:3000` и страницах под сессией/паролем.

## 5. Чек-лист реализации
- [ ] Создать `src/extension/manifest.json`.
- [ ] Написать UI всплывающего окна `src/extension/popup.html`.
- [ ] Реализовать интерактивный селектор элементов на странице.
- [ ] Настроить сборку расширения и букмарклета в `esbuild.config.js`.
- [ ] Протестировать захват локального сайта.
- [ ] Переместить карточку в `/done`.
