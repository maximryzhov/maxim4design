---
id: TASK-044
title: Контактное растение зеркалится, но кроп/масштаб не совпадает с эталоном
status: pending
priority: medium
phase: 7
dependencies: [TASK-039, TASK-011]
tags: [extractor, figma-plugin, images, transform, crop, bugfix]
---

# TASK-044: Кроп и масштаб `img.contact-plant` после mirror-трансформации

## 1. Описание задачи
После TASK-039 для `img.contact-plant` применяется `scaleX(-1)` через `relativeTransform`, но в v7 растение визуально отличается от эталона: листья крупнее и заходят на заголовок «ВАША СТЕНА…» / в область формы, тогда как в эталоне силуэт растения компактнее и повторяет левую дугу.

Данные FIR:
- `img.contact-plant` — IMAGE 1206.98×1206.98, x = 180.59, y = 7734.98;
- `transform = { scaleX: -1, scaleY: 1, rotation: 0, translateX: 0, translateY: 0 }`;
- CSS: `position:absolute; width:88.23%; aspect-ratio:1; object-fit:cover; left:10.57%; top:-3.7%; transform:scaleX(-1)`.

Подозреваемые причины (проверить по порядку):
1. `relativeTransform = [[-1,0,x+width],[0,1,y]]` отражает **ноду** вместе с заливкой, но image fill может интерпретироваться иначе, чем CSS-трансформация; нужна проверка экспорта 1:1.
2. В FIR нет `object-position`; при `scaleMode: FILL` Figma всегда центрирует кроп, а CSS `object-position` (если задан в другом медиа-правиле) может смещать его.
3. Исходная картинка имеет неквадратный natural size; `imageToDataUrl()` уменьшает её по `maxDimension`, и после `FILL` в квадрат 1207×1207 центр кропа может отличаться от браузерного `object-fit: cover`.
4. `clipsContent` у `div.contact-surface` может не совпадать с CSS `overflow:hidden`, из-за чего картинка визуально «расползается».

## 2. Связанные разделы документации
- [ARCHITECTURE.md](file:///e:/Projects/Dev/html2design/ARCHITECTURE.md)
- [TASK-039](file:///e:/Projects/Dev/html2design/done/TASK-039-css-transform-support.md)
- [KNOWLEDGE_BASE.md](file:///e:/Projects/Dev/html2design/KNOWLEDGE_BASE.md) — «Баг 9: Картинки: background-image, object-fit и асинхронность»
- Отчёт: `examples/alfagreen-fitosteny/v6/REPORT.md`, `v7-compare-6-3450-4377.png`

## 3. Технические детали и требования к реализации
- Сравнить 1:1 экспорт `img.contact-plant` из Figma с браузерным кропом при 1440px; зафиксировать naturalWidth/naturalHeight и итоговый кроп.
- Добавить в `FIRImageData` опциональное `objectPosition` (CSS `object-position`) и применять его:
  - для `scaleMode: FILL/FIT` — сдвиг/кроп через `imageTransform` (CROP) или рассчитанный paint-трансформ;
  - для `background-position` — аналогично.
- Проверить зеркалирование: применять `scaleX(-1)` к заливке **относительно центра** ноды, а не менять translation так, чтобы картинка уезжала; при необходимости использовать `relativeTransform` с `m02 = x + width` и `m12 = y` (текущий вариант) и подтвердить экспортом.
- Убедиться, что `clipsContent` у `div.contact-surface` = true (CSS `overflow:hidden`).
- Не менять размеры/позицию других изображений; регрессионный тест для hero-art и about-wall-art.
- Добавить unit-тест на парсинг `object-position` и на зеркалирование вокруг центра.

## 4. Критерии приемки (Definition of Done)
- [ ] Контактное растение в Figma совпадает с эталоном по силуэту и кропу (листья не заходят на заголовок сильнее, чем в эталоне).
- [ ] Зеркалирование применено ровно один раз, без двойного отражения.
- [ ] `object-position` сохраняется в FIR и учитывается при рендере.
- [ ] Нет регрессий для `img.hero-art`, `img.about-wall-art`, `img.services-bg`.
- [ ] `npm test`, `npm run typecheck`, `npm run build` проходят.

## 5. Чек-лист реализации
- [ ] Снять 1:1 эталон и Figma-экспорт растения, сравнить кроп.
- [ ] Проверить natural size и текущий `scaleMode`.
- [ ] Добавить `object-position` и/или скорректировать paint-трансформ.
- [ ] Проверить `clipsContent` родителя.
- [ ] Тесты + пересборка + импорт.
- [ ] Переместить карточку в `/done`.
