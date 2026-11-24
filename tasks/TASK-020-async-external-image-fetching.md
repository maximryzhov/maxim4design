---
id: TASK-020
title: Асинхронная загрузка внешних HTTP-изображений и сжатие крупных Base64
status: pending
priority: high
phase: 5
dependencies: [TASK-011]
tags: [extractor, images, performance, bugfix]
---

# TASK-020: Асинхронная загрузка внешних HTTP-изображений и сжатие крупных Base64

## 1. Описание задачи
При тестировании `alfagreen-fitosteny.html` выявлены две проблемы в пайплайне изображений:
1. Картинки с внешними URL (`https://alfa-green.ru/wp-content/uploads/...`, например `img#hero-card-image`) попадают в `imageData.base64` как сырая URL-строка, из-за чего `base64ToUint8Array` в Figma не может их декодировать и рисует серый плейсхолдер.
2. Встроенные `data:image/png;base64,...` изображения большого размера достигают 3.26 МБ в Base64 на одну картинку, что раздувает FIR JSON до ~10 МБ.

## 2. Связанные разделы документации
- [ARCHITECTURE.md](file:///e:/Projects/Dev/html2design/ARCHITECTURE.md) (Раздел 6: CORS блокировка картинок)
- [KNOWLEDGE_BASE.md](file:///e:/Projects/Dev/html2design/KNOWLEDGE_BASE.md)

## 3. Технические детали и требования к реализации
- Перевести `extractFIRFromElement` (или добавить `extractFIRFromElementAsync`) в асинхронный режим для подгрузки и конвертации изображений в `src/extractor/image-loader.ts`.
- Для `<img>` с `http://` / `https://`: загружать через `fetch` / `Image` + `<canvas>` (или через background script в Chrome Extension для обхода CORS) и конвертировать в PNG/JPEG Base64.
- Для крупных `data:image/*` (> 1 МБ или > 2048px): выполнять ресайз через `<canvas>` с ограничением до лимита Figma (4096px) или целевого размера макета (`bounds.width * 2`), конвертируя фото в JPEG (quality ~0.85) или сжатый PNG.

## 4. Критерии приемки (Definition of Done)
- [ ] `img#hero-card-image` и другие внешние картинки рендерятся в Figma как настоящие изображения, а не плейсхолдеры.
- [ ] Размер итогового FIR JSON для `alfagreen-fitosteny.html` снижен как минимум в 2–3 раза за счёт оптимизации изображений.
- [ ] При реальной CORS-ошибке сохраняется корректный fallback на плейсхолдер.

## 5. Чек-лист реализации
- [ ] Реализовать асинхронную загрузку и ресайз в `src/extractor/image-loader.ts`.
- [ ] Поддержать асинхронное разрешение изображений в экстракторе и расширении Chrome.
- [ ] Обновить/добавить тесты в `tests/image-pipeline.test.ts`.
- [ ] Переместить карточку в `/done`.
