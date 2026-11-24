---
id: TASK-021
title: Исправление ширины контейнеров Auto Layout, центрирования кнопок и absolute-позиций
status: done
priority: high
phase: 5
dependencies: [TASK-007, TASK-015]
tags: [extractor, figma-plugin, layout, bugfix]
---

# TASK-021: Исправление ширины контейнеров Auto Layout, центрирования кнопок и absolute-позиций

## 1. Описание задачи
При визуальном сравнении `alfagreen-fitosteny.html` в Figma Desktop обнаружены расхождения в раскладке:
1. Контейнер `header.site-header` (`display: flex; justify-content: space-between`) сжался по ширине до ~780px вместо `1353px`, так как не была зафиксирована `FIXED` ширина при наличии `bounds.width`.
2. Внутри кнопок-обёрток (`FRAME` с дочерним `TEXT`, например `ОБСУДИТЬ ОЗЕЛЕНЕНИЕ`) текст прижат к верхнему левому углу вместо центрирования по центру кнопки.
3. Абсолютно спозиционированная карточка `.hero-card` (`left: 8px; bottom: 25px`) сместилась к центру относительно родителя `.hero`.

## 2. Связанные разделы документации
- [ARCHITECTURE.md](file:///e:/Projects/Dev/html2design/ARCHITECTURE.md)
- [KNOWLEDGE_BASE.md](file:///e:/Projects/Dev/html2design/KNOWLEDGE_BASE.md)

## 3. Технические детали и требования к реализации
- В `src/extractor/layout-analyzer.ts` и `src/plugin/layout-engine.ts`:
  - Для flex-контейнеров с `justify-content: space-between` или явной фиксированной/процентной шириной задавать `sizingHorizontal: 'FIXED'`, чтобы `primaryAxisSizingMode = 'FIXED'` сохранял `bounds.width`.
  - Для текстовых кнопок с box-стилями в `src/extractor/dom-extractor.ts` прокидывать корректный `layout` (или выравнивание `CENTER` / `SPACE_BETWEEN` и `padding`), чтобы дочерний `TEXT` центрировался внутри кнопки.
  - Проверить расчёт `childRelX` / `childRelY` для `position: absolute` детей внутри `FRAME` с `layoutMode === 'NONE'` и в Auto Layout родителях (`layoutPositioning = 'ABSOLUTE'`).

## 4. Критерии приемки (Definition of Done)
- [x] `header.site-header` занимает полную ширину `1353px` с корректным распределением логотипа, меню и телефона.
- [x] Текст в кнопках `Подробнее` и `ОБСУДИТЬ ОЗЕЛЕНЕНИЕ` отцентрован внутри пилюли.
- [x] `.hero-card` располагается слева внизу hero-секции (`x ≈ 8px`), совпадая с браузерным скриншотом.

## 5. Чек-лист реализации
- [x] Исправить `sizingHorizontal` / `FIXED` для `space-between` в `layout-analyzer.ts` / `layout-engine.ts`.
- [x] Исправить центрирование текста в стилизованных кнопках в `dom-extractor.ts`.
- [x] Проверить абсолютное позиционирование `.hero-card` и добавить тесты.
- [x] Переместить карточку в `/done`.
