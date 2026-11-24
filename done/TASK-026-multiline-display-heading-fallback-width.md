---
id: TASK-026
title: Защита многострочных display-заголовков от разрыва слов при fallback-шрифтах
status: done
priority: medium
phase: 6
dependencies: [TASK-019]
tags: [figma-plugin, typography, bugfix]
---

# TASK-026: Защита многострочных display-заголовков от разрыва слов при fallback-шрифтах

## 1. Описание задачи
Крупные многострочные заголовки (например, `ЗЕЛЕНЬ НА СВОЁМ МЕСТЕ`, `ВАША СТЕНА МОЖЕТ СТАТЬ ЗЕЛЁНОЙ`), рассчитанные в браузере под узкий шрифт `Oswald` (`font-stretch: ultra-condensed`), при замене в Figma на более широкий `Inter Black` не помещаются в `bounds.width` и рвутся посередине слова (`ЗЕЛЕН\nЬНА`, `СТЕНАМ\nОЖЕТ`).

## 2. Связанные разделы документации
- [ARCHITECTURE.md](file:///e:/Projects/Dev/html2design/ARCHITECTURE.md)
- [KNOWLEDGE_BASE.md](file:///e:/Projects/Dev/html2design/KNOWLEDGE_BASE.md)

## 3. Технические детали и требования к реализации
- В `src/plugin/text-renderer.ts`:
  - Отслеживать, произошла ли замена шрифта на fallback (`segFont.family !== requestedFamily`) через `fontManager`.
  - Если для многострочного крупного текста (`fontSize >= 28` или заголовка) произошёл fallback на `Inter` и ширина контейнера жёстко ограничена браузерным condensed-шрифтом, добавлять небольшой запас ширины (например, `+12%`–`+18%` при `textAutoResize = 'HEIGHT'` или корректировать `letterSpacing` до `-3%`), чтобы слова не разрывались посимвольно.

## 4. Критерии приемки (Definition of Done)
- [x] Многострочные заголовки не рвут слова посередине (`ЗЕЛЕН\nЬНА` → перенос только по границам слов).
- [x] Добавлен unit-тест в `tests/text-ranges.test.ts`.

## 5. Чек-лист реализации
- [x] Реализовать компенсацию ширины/трекинга при fallback в `src/plugin/text-renderer.ts`.
- [x] Добавить unit-тест и проверить `npm test` и `npm run build`.
- [x] Переместить карточку в `/done`.
