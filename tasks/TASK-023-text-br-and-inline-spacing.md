---
id: TASK-023
title: Обработка тега br и сохранение пробелов между inline-элементами в text-builder
status: pending
priority: high
phase: 6
dependencies: [TASK-008, TASK-019]
tags: [extractor, typography, bugfix]
---

# TASK-023: Обработка тега br и сохранение пробелов между inline-элементами в text-builder

## 1. Описание задачи
При импорте `alfagreen-fitosteny.html` в многострочных заголовках с `<br>` и соседними `<span>` слова склеиваются без пробела или переноса строки (например: `ВПЕЧАТЛЕНИЯ.ИСКУССТВЕННЫЕРАСТЕНИЯ.`, `ПРОСТРАНСТВАСВОЯ`, `ОТ ИДЕИДО ЗЕЛЁНОЙ`).

## 2. Связанные разделы документации
- [ARCHITECTURE.md](file:///e:/Projects/Dev/html2design/ARCHITECTURE.md)
- [KNOWLEDGE_BASE.md](file:///e:/Projects/Dev/html2design/KNOWLEDGE_BASE.md)

## 3. Технические детали и требования к реализации
- В `src/extractor/text-builder.ts` (`collectFromNode`):
  - При встрече элемента `BR` добавлять символ переноса строки `\n` в `state.characters` (и продлевать/корректировать сегменты).
  - При переходе между соседними inline-элементами (`<span>...</span>\n<span>...</span>`) проверять наличие разделяющего пробела/переноса в DOM-узлах (`TextNode`) и не удалять его полностью при нормализации, если `state.characters` не пуст и не заканчивается пробелом/переносом.

## 4. Критерии приемки (Definition of Done)
- [ ] Заголовки с `<br>` внутри переносятся в Figma по `\n` без склейки слов.
- [ ] Соседние `<span>` с пробельным узлом между ними разделяются пробелом.
- [ ] Добавлены unit-тесты в `tests/text-ranges.test.ts`.

## 5. Чек-лист реализации
- [ ] Добавить обработку `BR` и межузловых пробелов в `src/extractor/text-builder.ts`.
- [ ] Добавить unit-тесты в `tests/text-ranges.test.ts`.
- [ ] Проверить `npm test` и `npm run build`.
- [ ] Переместить карточку в `/done`.
