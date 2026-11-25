---
id: TASK-050
title: Шеврон select не переносится в Figma
status: done
priority: medium
phase: 7
dependencies: []
tags: [extractor, form-controls, select, background-image, bugfix]
---

# TASK-050: Шеврон `<select>` теряется при импорте

## 1. Описание задачи

В блоке обратной связи (`section#contact`) выпадающий список «Что хотели бы
озеленить?» в браузере имеет кастомный шеврон справа. В Figma `select#lead-service`
представляет собой только серый прямоугольник с текстом выбранного значения —
стрелки нет.

В CSS страницы:

```css
#lead-form select{
  appearance:none;
  background-image:url("data:image/svg+xml,… <path d='m1 1 5 5 5-5' …>");
  background-repeat:no-repeat;
  background-position:right 17px center;
  padding-right:35px;
}
```

В FIR у `select#lead-service` есть только один TEXT-ребёнок; `imageData` для
фонового SVG отсутствует. В Figma узел `1:301` (`select#lead-service`) содержит
один TEXT-узел, без VECTOR/RECTANGLE со стрелкой.

## 2. Связанные разделы документации

- [ARCHITECTURE.md](../ARCHITECTURE.md), §4.1 (Form controls / Asset Serializer).
- [KNOWLEDGE_BASE.md](../KNOWLEDGE_BASE.md) — формы и background-image.
- [TASK-033](../done/TASK-033-native-select-background-size-fix.md),
  [TASK-036](../done/TASK-036-form-controls-rendering.md).
- Отчёт: [`examples/alfagreen-fitosteny/v8/REPORT.md`](../examples/alfagreen-fitosteny/v8/REPORT.md).
- Артефакты: `figma/compare-contact.png`, `figma-tree.json`, `fir.json`.

## 3. Технические детали и требования к реализации

Причина:

1. `isSmallBackgroundIcon()` (`src/extractor/image-loader.ts:302`) безусловно
   возвращает `true` для `SELECT` (`:308`), чтобы не тащить весь фон селекта
   как картинку.
2. В результате `extractImageData()` для `SELECT` возвращает `undefined` и
   CSS-стрелка не попадает ни в `imageData`, ни отдельным узлом.
3. В `buildFormControlNode()` (`src/extractor/dom-extractor.ts:371`) шеврон
   не создаётся; в FIR у select только текстовый ребёнок.

Требования:

- Не отбрасывать SELECT-background целиком: извлекать стрелку как отдельный
  VECTOR/IMAGE-узел, позиционированный по `background-position`/`background-size`
  (right 17px center, 12×8 px), либо как отдельный `svgContent`.
- Учитывать `padding-right`, чтобы текст не наезжал на стрелку.
- Если стрелка задана data-URI SVG — сохранять `svgContent` и рендерить
  нативным вектором; если PNG/JPEG — IMAGE-узлом.
- Для нативных `select` без кастомного фона (нет background-image) ничего не
  добавлять.
- Добавить unit-тест: select с background-image SVG → в FIR есть VECTOR-ребёнок
  с правильными bounds; ширина текста уменьшена на padding-right.
- Проверить, что стрелка не масштабируется на весь селект (регрессия TASK-033).

## 4. Критерии приемки (Definition of Done)

- [x] В FIR у `select#lead-service` есть дочерний узел шеврона с bounds справа.
- [x] Текст выбранного значения не перекрывает шеврон (ширина уменьшена).
- [x] Select без кастомного фона не получает лишних узлов.
- [x] `npm test`, `npm run typecheck`, `npm run build` проходят.
- [x] Шеврон не масштабируется на весь селект (bounds 14.86×20.27, не 598×43).

## 5. Чек-лист реализации

- [x] Воспроизвести отсутствие шеврона.
- [x] Извлечь SVG/PNG стрелку селекта отдельным узлом.
- [x] Учесть background-position/size/padding-right.
- [x] Добавить unit-тест.
- [x] Пересобрать `dist` и проверить FIR на реальной странице.
- [x] Переместить карточку в `/done`.

## 6. Результат

- `buildFormControlNode()` для `<select>` извлекает `background-image` стрелки
  отдельным IMAGE/VECTOR-ребёнком, вычисляет размер из `background-size`,
  позицию — из `background-position`, включая Chrome-представление
  `calc(100% - 11.67px) 50%`; текст получает уменьшенную ширину.
- На реальной странице (`fir-050b.json`) в `select#lead-service` два ребёнка:
  TEXT (ширина 520.11 вместо 541.0) и IMAGE-стрелка
  `{x:1320.29, y:8073.86, w:14.86, h:20.27}` с PNG data-URI 366 байт.
- Добавлен unit-тест на SVG-стрелку; всего 111/111. `tsc --noEmit` и
  `npm run build` — без ошибок; `dist/extractor.js` SHA256 `66BA7D62…EBE3`.
- Повторный визуальный импорт в Figma не выполнялся; FIR содержит отдельный
  маленький узел, а `renderImageNode`/`renderVectorNode` уже покрыты тестами.
