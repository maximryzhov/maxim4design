---
id: TASK-028
title: Умный подбор стилей через listAvailableFontsAsync и извлечение @font-face шрифтов
status: done
priority: high
phase: 6
dependencies: [TASK-006, TASK-019, TASK-026]
tags: [extractor, figma-plugin, fonts, ux]
---

# TASK-028: Умный подбор стилей через listAvailableFontsAsync и извлечение @font-face шрифтов

## 1. Описание задачи
Устранить ложные падения шрифтов на fallback `Inter` и дать пользователю возможность легко доустанавливать отсутствующие кастомные шрифты:
1. **На стороне Figma-плагина (`listAvailableFontsAsync`):** многие шрифты (например, `Manrope`, `Oswald`) присутствуют в Figma, но не загружаются из-за несовпадения точного имени стиля (дробные CSS-веса `550`, `650`, `750`, `760`, `SemiBold` vs `Semi Bold`, `ExtraLight` vs `Extra Light`, `Condensed` и т.д.). Плагин должен один раз получать список доступных шрифтов через `figma.listAvailableFontsAsync()` и подбирать ближайший реальный стиль для нужного `family` перед откатом к `Inter`.
2. **На стороне браузерного экстрактора и UI:** извлекать из `document.fonts` и `CSSFontFaceRule` (`document.styleSheets`) информацию о подключённых `@font-face` (источники `.woff2`/`.ttf`/`data:font/...`), сохранять манифест использованных/отсутствующих шрифтов в FIR и предоставлять пользователю выгрузку файлов шрифтов (или установку/конвертацию через локальный мост).

## 2. Связанные разделы документации
- [ARCHITECTURE.md](file:///e:/Projects/Dev/html2design/ARCHITECTURE.md)
- [KNOWLEDGE_BASE.md](file:///e:/Projects/Dev/html2design/KNOWLEDGE_BASE.md)

## 3. Технические детали и требования к реализации
- **Пункт 1 — Умный подбор стиля в `src/plugin/font-manager.ts`:**
  - Добавить метод `initAvailableFonts(): Promise<void>`, вызывающий `figma.listAvailableFontsAsync()` и строящий индекс `Map<string, Set<string>>` (`familyLower -> Set<style>`).
  - При `loadFontSafely(family, weight, isItalic)`:
    - Проверять, есть ли `family` (без учёта регистра) в доступных шрифтах Figma.
    - Если exact `{ family, style }` отсутствует, подбирать ближайший доступный стиль этого же `family` (с учётом italic и веса: например, `SemiBold`/`Semi Bold`, `Bold`, `Regular`) и только при полном отсутствии семейства откатываться к `Inter`.
- **Пункт 2 — Извлечение `@font-face` и экспорт шрифтов:**
  - Создать `src/extractor/font-extractor.ts`:
    - Сбор метаданных из `document.fonts` (`family`, `weight`, `style`, `status`).
    - Парсинг `CSSFontFaceRule` из `document.styleSheets` (с `try/catch` для CORS-стилей): извлечение `src` (`url(...)` и `data:font/...`).
    - Добавить опциональное поле `fonts?: FIRFontAsset[]` в корень `FIRNode` (или отдельный манифест) в `src/types/fir.ts`.
  - В `src/plugin/ui.html`: в блоке предупреждений об отсутствующих шрифтах отображать список с возможностью скачать/сохранить извлечённые `@font-face` файлы (если они есть в `fir.fonts`) или передать их в локальный мост.

## 4. Критерии приемки (Definition of Done)
- [x] `FontManager` использует `figma.listAvailableFontsAsync()` для точного и приближённого матчинга стилей одного семейства без лишнего отката на `Inter`.
- [x] Экстрактор собирает `@font-face` источники (`woff2`/`ttf`/`data:font/...`) со страницы без падений на cross-origin таблицах стилей.
- [x] В UI плагина при замене шрифта отображается понятный список отсутствующих шрифтов и кнопка выгрузки извлечённых файлов шрифтов (при их наличии).
- [x] Добавлены unit-тесты для `FontManager` (с моком `listAvailableFontsAsync`) и `font-extractor.ts`.

## 5. Чек-лист реализации
- [x] Добавить `initAvailableFonts` и подбор ближайшего стиля в `src/plugin/font-manager.ts`.
- [x] Создать `src/extractor/font-extractor.ts` и расширить контракт в `src/types/fir.ts`.
- [x] Подключить сбор шрифтов в `dom-extractor.ts` и отображение/скачивание в `src/plugin/ui.html`.
- [x] Написать unit-тесты и проверить `npm test`, `npm run typecheck`, `npm run build`.
- [x] Переместить карточку в `/done`.
