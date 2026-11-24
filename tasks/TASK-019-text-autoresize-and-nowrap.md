---
id: TASK-019
title: Фикс переноса строк и textAutoResize при fallback-шрифтах
status: pending
priority: high
phase: 5
dependencies: [TASK-006, TASK-008]
tags: [extractor, figma-plugin, typography, bugfix]
---

# TASK-019: Фикс переноса строк и textAutoResize при fallback-шрифтах

## 1. Описание задачи
При импорте реальных сайтов (например, `alfagreen-fitosteny.html`), использующих узкие или кастомные шрифты (`Oswald`, `Manrope` с дробными весами, `@font-face`), Figma заменяет отсутствующий шрифт на более широкий `Inter`. Из-за того, что `TextNode` получает жёсткую ширину `bounds.width` из `getBoundingClientRect()`, текст переносится на несколько строк (например, `АЛЬФАГРИН.` → `АЛЬФАГР\nИН.`, `+7 917 772-35-56` → 2 строки, `ФИТОСТЕНЫ` перекрывает `КАК ЖИВЫЕ`).

## 2. Связанные разделы документации
- [ARCHITECTURE.md](file:///e:/Projects/Dev/html2design/ARCHITECTURE.md)
- [KNOWLEDGE_BASE.md](file:///e:/Projects/Dev/html2design/KNOWLEDGE_BASE.md)

## 3. Технические детали и требования к реализации
- В `src/types/fir.ts` (`FIRTextData`): добавить опциональные поля `whiteSpace?: string` и `isSingleLine?: boolean`.
- В `src/extractor/text-builder.ts`:
  - Извлекать `computed.whiteSpace` (`nowrap`, `pre`, `normal`).
  - Определять однострочный текст (например, `whiteSpace === 'nowrap'` или `bounds.height <= lineHeight * 1.35`).
- В `src/plugin/text-renderer.ts`:
  - Если `whiteSpace === 'nowrap'` или текст однострочный (заголовок, пункт меню, телефон, кнопка), устанавливать `textNode.textAutoResize = 'WIDTH_AND_HEIGHT'` (или `HEIGHT` для многострочных абзацев) вместо жесткой обрезки по ширине браузерного рендера.

## 4. Критерии приемки (Definition of Done)
- [ ] Однострочные элементы меню, телефоны и заголовки с `white-space: nowrap` не переносятся на вторую строку в Figma при fallback на `Inter`.
- [ ] Многострочные абзацы корректно переносятся по ширине контейнера (`textAutoResize = 'HEIGHT'`).
- [ ] Добавлены unit-тесты в `tests/text-ranges.test.ts`.

## 5. Чек-лист реализации
- [ ] Обновить `FIRTextData` в `src/types/fir.ts`.
- [ ] Обновить `src/extractor/text-builder.ts` и `src/plugin/text-renderer.ts`.
- [ ] Добавить тесты и проверить `npm test` и `npm run build`.
- [ ] Переместить карточку в `/done`.
