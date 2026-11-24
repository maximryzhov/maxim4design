---
id: TASK-027
title: Адаптивное сжатие встроенных PNG с альфа-каналом и контроль размера FIR JSON
status: pending
priority: low
phase: 6
dependencies: [TASK-020]
tags: [extractor, images, performance]
---

# TASK-027: Адаптивное сжатие встроенных PNG с альфа-каналом и контроль размера FIR JSON

## 1. Описание задачи
Встроенная hero-графика с прозрачностью (`fit-opening-art` на `alfagreen-fitosteny.html`) сохраняется в Base64 PNG размером ~3.26 МБ, из-за чего итоговый FIR JSON достигает ~9.65 МБ. При этом отображаемый размер картинки на экране может быть меньше исходного разрешения в 2–3 раза.

## 2. Связанные разделы документации
- [ARCHITECTURE.md](file:///e:/Projects/Dev/html2design/ARCHITECTURE.md)

## 3. Технические детали и требования к реализации
- В `src/extractor/image-loader.ts` (`resolveTreeImagesAsync`):
  - Учитывать реальные рендерные размеры ноды `node.bounds.width` и `node.bounds.height`: вычислять `targetMaxDim = Math.min(2048, Math.max(900, Math.round(Math.max(node.bounds.width, node.bounds.height) * 1.5)))`.
  - Для изображений с прозрачностью, превышающих 1.5 МБ в PNG, применять дополнительное уменьшение масштаба до `1280px` по длинной стороне, чтобы удерживать общий размер FIR JSON в комфортных пределах для буфера обмена и `postMessage`.

## 4. Критерии приемки (Definition of Done)
- [ ] Размер `alfagreen-fir.json` существенно уменьшен без заметной потери чёткости на `1440×900`.
- [ ] Добавлен unit-тест в `tests/image-pipeline.test.ts`.

## 5. Чек-лист реализации
- [ ] Передавать `bounds`-ориентированный `maxDimension` в `resolveTreeImagesAsync` (`src/extractor/image-loader.ts`).
- [ ] Добавить unit-тест в `tests/image-pipeline.test.ts`.
- [ ] Проверить `npm test` и `npm run build`.
- [ ] Переместить карточку в `/done`.
