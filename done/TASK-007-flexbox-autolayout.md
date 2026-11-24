---
id: TASK-007
title: Движок маппинга Flexbox в Figma Auto Layout
status: done
priority: high
phase: 2
dependencies: [TASK-005]
tags: [autolayout, flexbox, layout, figma-plugin]
---

# TASK-007: Движок маппинга Flexbox в Figma Auto Layout

## 1. Описание задачи
Реализовать модуль трансляции свойств CSS Flexbox в нативные параметры Figma **Auto Layout**. Плагин должен генерировать «резиновые» фреймы с сохранением направлений, промежутков (`gap`), внутренних отступов (`padding`), правил переноса (`wrap`) и режимов сайзинга (`FILL`, `HUG`, `FIXED`).

## 2. Связанные разделы документации
- [ARCHITECTURE.md](file:///e:/Projects/Dev/html2design/ARCHITECTURE.md) (Раздел 4.2: AutoLayout Engine)
- [KNOWLEDGE_BASE.md](file:///e:/Projects/Dev/html2design/KNOWLEDGE_BASE.md) (Раздел 4: Матрица трансляции CSS -> Figma API)

## 3. Технические детали и требования к реализации
- Создать `src/plugin/layout-engine.ts`.
- В экстракторе (`src/extractor/dom-extractor.ts`):
  - Считывать `flexDirection`, `flexWrap`, `gap` / `rowGap` / `columnGap`.
  - Считывать `paddingTop`, `paddingRight`, `paddingBottom`, `paddingLeft`.
  - Считывать `justifyContent` и `alignItems`.
  - Записывать параметры в `node.layout`.
- В движке плагина (`src/plugin/layout-engine.ts`):
  - Применять к `FrameNode`:
    - `layoutMode`: `'HORIZONTAL'` (для `row`, `row-reverse`) или `'VERTICAL'` (для `column`, `column-reverse`).
    - `layoutWrap`: `'WRAP'` если `flex-wrap: wrap`, иначе `'NO_WRAP'`.
    - `itemSpacing`: значение `gap` в пикселях.
    - `paddingTop`, `paddingRight`, `paddingBottom`, `paddingLeft`.
    - `primaryAxisAlignItems`: маппинг `flex-start` -> `MIN`, `center` -> `CENTER`, `flex-end` -> `MAX`, `space-between` -> `SPACE_BETWEEN`.
    - `counterAxisAlignItems`: `flex-start` -> `MIN`, `center` -> `CENTER`, `flex-end` -> `MAX`.
  - Настройка резиновости детей:
    - Если у дочернего элемента `flex-grow > 0` или ширина 100% -> `child.layoutSizingHorizontal = 'FILL'`.
    - Для контентных блоков -> `child.layoutSizingHorizontal = 'HUG'`.

## 4. Критерии приемки (Definition of Done)
- [x] Горизонтальные и вертикальные flex-контейнеры создаются с включенным Auto Layout в Figma.
- [x] При изменении ширины родительского фрейма в Figma дочерние элементы с `FILL` корректно адаптируются.
- [x] Отступы (`padding`) и промежутки (`gap`) точно соответствуют сайту (попиксельное совпадение).

## 5. Чек-лист реализации
- [x] Расширить экстрактор для сбора flexbox-свойств в `FIRLayout`.
- [x] Создать `src/plugin/layout-engine.ts`.
- [x] Реализовать маппинг выравниваний (primary / counter align).
- [x] Реализовать установку `layoutSizingHorizontal` и `layoutSizingVertical`.
- [x] Протестировать на навигационной панели (navbar) и карточках с flex-раскладкой.
- [x] Переместить карточку в `/done`.
