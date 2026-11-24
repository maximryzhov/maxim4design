---
id: TASK-011
title: Конвейер растровых изображений (fetch -> Uint8Array -> figma.createImage)
status: pending
priority: high
phase: 3
dependencies: [TASK-005]
tags: [images, assets, figma-plugin, extractor]
---

# TASK-011: Конвейер растровых изображений

## 1. Описание задачи
Реализовать конвейер загрузки и внедрения изображений (теги `<img>` и CSS `background-image`). Изображения должны скачиваться экстрактором, конвертироваться в бинарный буфер / Base64 и внедряться в Figma через `figma.createImage()` с корректным маппингом `object-fit` (`FILL`, `FIT`, `CROP`).

## 2. Связанные разделы документации
- [ARCHITECTURE.md](file:///e:/Projects/Dev/html2design/ARCHITECTURE.md) (Раздел 4.1: Asset Serializer, Раздел 6: CORS)
- [KNOWLEDGE_BASE.md](file:///e:/Projects/Dev/html2design/KNOWLEDGE_BASE.md) (Баг 9: Картинки: background-image, object-fit)

## 3. Технические детали и требования к реализации
- В экстракторе (`src/extractor/image-loader.ts`):
  - Обработка `<img>` (атрибут `src` или `currentSrc`) и контейнеров с `background-image: url(...)`.
  - Извлечение картинки в Base64 через `fetch(url) -> blob -> FileReader` или отрисовку во временный `<canvas>` с экспортом в `toDataURL()`.
  - Определение режима масштабирования (`object-fit: cover` -> `'FILL'`, `contain` -> `'FIT'`).
  - Ограничение максимального разрешения (downscale для картинок > 4K во избежание переполнения памяти).
- В плагине (`src/plugin/image-renderer.ts`):
  - Конвертация Base64-строки в `Uint8Array`.
  - Вызов `const imageHash = figma.createImage(uint8Array).hash`.
  - Применение заливки:
    ```typescript
    node.fills = [{
      type: 'IMAGE',
      imageHash,
      scaleMode: node.imageData.scaleMode
    }];
    ```

## 4. Критерии приемки (Definition of Done)
- [ ] Теги `<img>` и фоновые изображения корректно отрисовываются на слоях Figma.
- [ ] Сохраняются правильные пропорции (`object-fit: cover` заполняет контейнер без искажения пропорций сторон).
- [ ] Блокировка по CORS обрабатывается: создается серый плейсхолдер с сохранением точных габаритов.

## 5. Чек-лист реализации
- [ ] Создать `src/extractor/image-loader.ts`.
- [ ] Реализовать конвертер Base64 <-> Uint8Array.
- [ ] Создать `src/plugin/image-renderer.ts`.
- [ ] Добавить fallback для недоступных картинок (placeholder).
- [ ] Протестировать импорт галереи карточек с картинками и аватарами.
- [ ] Переместить карточку в `/done`.
