---
id: TASK-013
title: Детектор и сборщик псевдоэлементов (::before и ::after)
status: pending
priority: medium
phase: 3
dependencies: [TASK-003, TASK-005]
tags: [pseudo-elements, extractor, dom, styles]
---

# TASK-013: Детектор и сборщик псевдоэлементов

## 1. Описание задачи
Реализовать механизм обнаружения и извлечения CSS-псевдоэлементов `::before` и `::after`. В современном вебе они активно используются для бейджей, иконок шрифтовых гарнитур (FontAwesome), кастомных чекбоксов и фоновых градиентных подложек.

## 2. Связанные разделы документации
- [ARCHITECTURE.md](file:///e:/Projects/Dev/html2design/ARCHITECTURE.md) (Раздел 4.1: Tree Sanitizer)
- [KNOWLEDGE_BASE.md](file:///e:/Projects/Dev/html2design/KNOWLEDGE_BASE.md) (Баг 5: Игнорирование псевдоэлементов)

## 3. Технические детали и требования к реализации
- В экстракторе (`src/extractor/pseudo-extractor.ts`):
  - При обходе каждого HTML-элемента проверять оба псевдоэлемента:
    ```javascript
    const beforeStyles = window.getComputedStyle(el, '::before');
    const afterStyles = window.getComputedStyle(el, '::after');
    ```
  - Проверять условие видимости:
    - `content !== 'none' && content !== '""' && content !== "''"`.
    - Либо если заданы размеры (`width > 0 && height > 0`) и цвет фона/картинка.
  - Если псевдоэлемент активен:
    - Создавать виртуальный `FIRNode`.
    - Если есть текстовый `content` -> генерировать как дочерний `TEXT` узел.
    - Если чисто декоративный блок -> генерировать как `FRAME` / `RECTANGLE`.
    - Добавлять в `children` родителя: `::before` в начало массива, `::after` в конец.

## 4. Критерии приемки (Definition of Done)
- [ ] Иконки шрифтов (например, `<i class="fa fa-star"></i>`, где символ лежит в `::before`) корректно извлекаются и импортируются.
- [ ] Декоративные полоски и плашки, сделанные через `::after { content: ""; position: absolute; ... }`, не пропадают при импорте.

## 5. Чек-лист реализации
- [ ] Создать `src/extractor/pseudo-extractor.ts`.
- [ ] Добавить интеграцию с основным циклом `traverseElement`.
- [ ] Обработать очистку кавычек в свойстве `content`.
- [ ] Протестировать на странице с иконками FontAwesome и кастомными тумблерами (switch/toggle).
- [ ] Переместить карточку в `/done`.
