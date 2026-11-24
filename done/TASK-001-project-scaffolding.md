---
id: TASK-001
title: Инициализация структуры проекта и сборки
status: done
priority: high
phase: 1
dependencies: []
tags: [setup, typescript, build, config]
---

# TASK-001: Инициализация структуры проекта и сборки

## 1. Описание задачи
Создать базовую структуру монорепозитория/проекта для разработки плагина Figma и браузерного экстрактора. Настроить конфигурацию TypeScript, линтер и систему сборки через `esbuild` для быстрой компиляции `code.ts` (песочница Figma) и `ui.html` / `ui.ts`.

## 2. Связанные разделы документации
- [ARCHITECTURE.md](file:///e:/Projects/Dev/html2design/ARCHITECTURE.md) (Разделы 1, 2)
- [AGENTS.md](file:///e:/Projects/Dev/html2design/AGENTS.md) (Правила написания кода)

## 3. Технические детали и требования к реализации
- Инициализировать `package.json` со скриптами сборки (`build`, `watch`, `typecheck`).
- Установить зависимости:
  - Dev: `typescript`, `@figma/plugin-typings`, `esbuild`.
- Настроить `tsconfig.json` со строгим режимом (`strict: true`, `target: ES2020`).
- Организовать структуру папок:
  ```
  src/
  ├── types/         # Спецификация контракта FIR
  ├── extractor/     # Браузерный DOM-экстрактор
  └── plugin/        # Код Figma-плагина (code.ts, ui/)
  ```
- Настроить `esbuild.config.js` для бандлинга плагина в один результирующий файл `dist/code.js`.

## 4. Критерии приемки (Definition of Done)
- [x] `npm run build` успешно собирает тестовый файл плагина в `dist/code.js` без ошибок типов.
- [x] `@figma/plugin-typings` подключены и корректно подсказывают глобальные типы Figma API (`figma.createFrame` и т.д.).
- [x] Режим `watch` корректно пересобирает проект при изменениях в `src/`.

## 5. Чек-лист реализации
- [x] Создать `package.json` и настроить dev-зависимости.
- [x] Создать `tsconfig.json`.
- [x] Создать конфигурацию `esbuild`.
- [x] Добавить базовые файлы-заглушки в `src/`.
- [x] Проверить сборку через `npm run build`.
- [x] Переместить карточку в `/done`.
