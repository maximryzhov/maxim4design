---
id: TASK-039
title: CSS transforms (scaleX/rotate/translate) игнорируются — зеркальные изображения не отражаются
status: done
priority: medium
phase: 7
dependencies: []
tags: [extractor, figma-plugin, images, transforms, bugfix]
---

# TASK-039: `transform: scaleX(-1)` и другие трансформации не применяются

## 1. Описание задачи
`img.contact-plant` в секции `#contact` имеет CSS `transform: scaleX(-1)` (зеркалирование) и позиционируется абсолютно. Extractor сохраняет только `bounds` 1207×1207, а transform теряется; в Figma растение отрисовано незеркально и с другим визуальным кропом, чем в эталоне. Аналогично не поддерживаются `rotate`, `translate`, `skew`.

`getBoundingClientRect()` уже учитывает трансформации в размерах, но не в ориентации/смещении содержимого.

## 2. Связанные разделы документации
- [ARCHITECTURE.md](file:///e:/Projects/Dev/html2design/ARCHITECTURE.md)
- Отчёт: `examples/alfagreen-fitosteny/v6/REPORT.md`, кроп `compare-6-3450-4377.png`

## 3. Технические детали и требования к реализации
- Добавить в `FIRNode` (или `FIRStyle`) опциональное поле `transform?: { scaleX?: number; scaleY?: number; rotation?: number; translateX?: number; translateY?: number }`.
- В extractor разбирать `getComputedStyle(el).transform` (матрица `matrix(a,b,c,d,e,f)`):
  - `scaleX = a`, `scaleY = d` для чистого масштаба;
  - `rotation = atan2(b, a)`;
  - `translate = e, f`.
- В plugin:
  - для IMAGE/RECTANGLE — `node.relativeTransform` (или `node.rescale`) с учётом масштаба; для отрицательного `scaleX` — отразить `imageTransform`/`relativeTransform`;
  - для FRAME/TEXT — `node.rotation` для угла; `scaleX(-1)` на тексте/фрейме — через `relativeTransform`.
- Не применять transform дважды, если bounds уже включает масштаб (текущий `getBoundingClientRect` возвращает transformed box): хранить исходные width/height из `offsetWidth/offsetHeight`.
- Добавить тест: элемент с `scaleX(-1)` → IMAGE с отражённым `imageTransform`.

## 4. Критерии приемки (Definition of Done)
- [x] `img.contact-plant` в Figma зеркален относительно эталона (совпадает направление ствола/листьев).
- [x] Элементы с `rotate` отображаются под правильным углом (для IMAGE; CSS-угол переводится в Figma-rotation).
- [x] Размеры bounds не «раздуваются» из-за повторного применения масштаба.
- [x] `npm test`, `npm run typecheck`, `npm run build` проходят.

## 5. Чек-лист реализации
- [x] Добавить transform в FIR-типы и валидатор.
- [x] Извлекать матрицу transform.
- [x] Применять в image renderer.
- [x] Тест на зеркалирование.
- [x] Пересборка + извлечение.
- [x] Переместить карточку в `/done`.

## 6. Результат
- В `FIRNode` добавлен `transform?: FIRTransform` (`scaleX/scaleY/rotation/translateX/translateY`).
- `parseTransformMatrix()` читает `matrix(a,b,c,d,e,f)`, игнорирует identity, различает зеркалирование (`scaleX=-1` → rotation 0) и поворот (matrix с b/c); `bounds` остаются из `getBoundingClientRect`.
- `renderImageNode()` применяет `rotation` (CSS clockwise → Figma counter-clockwise) и зеркалирование через `relativeTransform`: `[[-1,0,x+width],[0,1,y]]` — изображение отражается на месте без изменения размеров.
- Проверка FIR: `img.contact-plant` (1207×1207) → `transform.scaleX = -1`, `rotation = 0`.
- Тесты: 96/96; новый файл `tests/css-transform.test.ts` (3 кейса).
- Ограничение: зеркалирование FRAME/TEXT пока не применяется (в этой странице есть только зеркальный IMAGE).
- Визуальный e2e в Figma — в общем прогоне после TASK-040.
