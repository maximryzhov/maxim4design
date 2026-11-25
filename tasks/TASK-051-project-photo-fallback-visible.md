---
id: TASK-051
title: Fallback-подписи project-photo-fallback остаются видимыми слоями
status: pending
priority: low
phase: 7
dependencies: []
tags: [extractor, images, fallback, css-has, bugfix]
---

# TASK-051: `project-photo-fallback` не скрывается после встраивания фото

## 1. Описание задачи

В карточках проектов (`section#projects`) в FIR и Figma остаются видимые текстовые
слои `span.project-photo-fallback` с названием проекта. В браузере они скрыты
CSS-правилом:

```css
.project-photo:has(img[src^="data:"]) .project-photo-fallback { display:none }
```

Правило рассчитано на то, что после встраивания все `<img>` станут `data:…` и
fallback исчезнет. Но экстрактор строит FIR **до** подмены `src` на data-URI,
поэтому видит fallback как видимый (`opacity:0.7`) и сохраняет его.

В `fir.json` — 6 таких узлов (по одному на карточку), в Figma — `1:132`, `1:142`,
`1:152`, `1:162`, `1:172`, `1:182`. Пока изображение непрозрачное, слой закрыт
фото; но при пустом/прозрачном изображении (TASK-046) fallback-текст становится
виден поверх белой карточки — например, «ЖК «Яркий»» и «Приёмная офиса продаж».

## 2. Связанные разделы документации

- [ARCHITECTURE.md](../ARCHITECTURE.md), §4.1 (Asset Serializer), §6.
- [KNOWLEDGE_BASE.md](../KNOWLEDGE_BASE.md) — fallback-изображения.
- [TASK-011](../done/TASK-011-image-pipeline.md),
  [TASK-020](../done/TASK-020-async-external-image-fetching.md).
- Отчёт: [`examples/alfagreen-fitosteny/v8/REPORT.md`](../examples/alfagreen-fitosteny/v8/REPORT.md).
- Артефакты: `figma/compare-projects.png`, `figma-tree.json`, `fir.json`.

## 3. Технические детали и требования к реализации

Причина:

1. `:has(img[src^="data:"])` зависит от текущего `src`; на момент обхода DOM
   `img.src` ещё оригинальный URL.
2. `resolveTreeImagesAsync()` (`src/extractor/image-loader.ts:252`) заменяет
   `imageData.base64` уже после построения дерева, но **не пересчитывает
   видимость** соседних fallback-узлов.
3. В FIR нет признака «это fallback»; узел выглядит обычным TEXT с opacity 0.7.

Требования:

- После успешного встраивания изображения (base64 начинается с `data:image/`)
  удалять/помечать `visible:false` узлы-fallback внутри того же image-контейнера.
- Не привязываться к имени класса: определить контейнер с `img` и соседним
  текстом, который в браузере скрыт правилом `:has`; либо вычислять видимость
  уже после подмены `src` (временно подставить data-URI и пересчитать
  `getComputedStyle`).
- Если изображение не встроилось — fallback, наоборот, нужно оставить видимым.
- Добавить unit-тест: контейнер с img+fallback и успешным base64 → fallback
  `visible:false`/отсутствует; при неудаче — остаётся.

## 4. Критерии приемки (Definition of Done)

- [ ] В FIR у карточек проектов с успешно встроенным фото нет видимых
  `project-photo-fallback`.
- [ ] В Figma на карточках с реальными фото нет лишних текстовых слоёв.
- [ ] При неудачном встраивании fallback остаётся видимым и читаемым.
- [ ] `npm test`, `npm run typecheck`, `npm run build` проходят.
- [ ] Нет регрессий для карточек услуг/материалов.

## 5. Чек-лист реализации

- [ ] Воспроизвести видимые fallback-слои в `figma-tree.json`.
- [ ] Пересчитывать/скрывать fallback после resolveTreeImagesAsync.
- [ ] Добавить unit-тест на оба сценария.
- [ ] Пересобрать `dist`, импортировать, сравнить projects.
- [ ] Переместить карточку в `/done`.
