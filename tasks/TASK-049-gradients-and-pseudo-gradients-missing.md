---
id: TASK-049
title: Градиентные pseudo-elements и фоны не импортируются
status: pending
priority: medium
phase: 7
dependencies: []
tags: [extractor, figma-plugin, gradients, pseudo-elements, styles, bugfix]
---

# TASK-049: Градиенты и pseudo-elements с градиентом отсутствуют в Figma

## 1. Описание задачи

На проверяемой странице многие визуальные акценты построены на CSS-градиентах:

- `.material-card::after` — затемняющий градиент поверх фотоматериалов
  (`linear-gradient(transparent 15%, #e1e7dd 63%, …)` и варианты);
- `.service-visual::after` — нижняя тёмная подложка под подписью;
- `.about-feature::before` — градиент от прозрачного к `#171b17a8`;
- `.product-image` — фон `linear-gradient(180deg,#f5f7f3,#eef2eb)`.

В FIR **нет ни одного** узла `::before`/`::after`, а у `div.product-image` вместо
градиента стоит белый/плоский фон. В Figma:
- карточки проектов/услуг/материалов теряют затемнение, текст на светлых фото
  читается хуже (см. `figma/compare-projects.png`, `compare-services.png`,
  `compare-materials.png`);
- фон изображений товаров становится белым вместо светло-зелёного градиента.

Ожидаемое поведение: градиентные подложки и overlay-слои сохраняются как
редактируемые FRAME/RECTANGLE с gradient fill либо как запечённый слой.

## 2. Связанные разделы документации

- [ARCHITECTURE.md](../ARCHITECTURE.md), §3 `FIRStyle` (fills/effects), §4.1 (Computed Style Parser).
- [KNOWLEDGE_BASE.md](../KNOWLEDGE_BASE.md) — фоны, pseudo-elements, градиенты.
- [TASK-009](../done/TASK-009-borders-and-radius.md),
  [TASK-013](../done/TASK-013-pseudo-elements.md),
  [TASK-012](../done/TASK-012-shadows-and-blur.md).
- Отчёт: [`examples/alfagreen-fitosteny/v8/REPORT.md`](../examples/alfagreen-fitosteny/v8/REPORT.md).
- Артефакты: `figma/compare-projects.png`, `compare-services.png`,
  `compare-materials.png`, `figma-tree.json`, `fir.json`.

## 3. Технические детали и требования к реализации

Причина:

1. `extractElementStyles()` (`src/extractor/style-extractor.ts:74`) читает только
   `background-color`, рамки, радиусы, тени, blur и opacity. `background-image:
   linear-gradient(...)` полностью игнорируется.
2. `extractPseudoElement()` (`src/extractor/pseudo-extractor.ts:8`) считает
   `hasVisualDecoration` по `backgroundColor`/`borders`/`shadows`
   (`:34-36`). У градиентной подложки `backgroundColor` прозрачный, рамок и теней
   нет → узел отбрасывается как «невидимый».
3. В `FIRStyle` (`src/types/fir.ts:88`) нет типа для gradient paint — только
   `backgroundColor`, поэтому даже при извлечении некуда положить stops.

Требования:

- Расширить `FIRStyle`/`FIRPaint`: `linear-gradient`/`radial-gradient` со stops
  (position + RGBA), углом/направлением; применить в `style-applier.ts` как
  Figma `GRADIENT_LINEAR`/`GRADIENT_RADIAL` paint.
- В `extractElementStyles()` разбирать `computed.backgroundImage` с несколькими
  слоями; сохранять порядок (background layering).
- В `extractPseudoElement()` учитывать gradient как визуальное оформление и
  корректно считать `inset`/`width/height` для absolute pseudo (`inset:auto 0 0`,
  `height:28%` и т.п.).
- Для pseudo с `z-index:-1` (about-feature::before) сохранять порядок слоёв,
  чтобы подложка была под контентом, а не над ним.
- Если полноценный gradient paint пока невозможен — как минимум запекать
  градиент в растр/полупрозрачный прямоугольник, чтобы не терять контраст текста.
- Добавить unit-тесты: `linear-gradient` → stops; pseudo только с градиентом
  создаёт узел; `inset`-позиционирование.

## 4. Критерии приемки (Definition of Done)

- [ ] В FIR есть узлы `::before`/`::after` для `.material-card`, `.service-visual`,
  `.about-feature` (или эквивалентные градиентные подложки).
- [ ] В Figma карточки проектов/услуг/материалов имеют затемнение, как в браузере.
- [ ] `div.product-image` имеет градиентный фон, а не белый.
- [ ] Порядок слоёв не ломает текст и изображения.
- [ ] `npm test`, `npm run typecheck`, `npm run build` проходят.
- [ ] Визуальные метрики `compare-projects/services/materials` улучшились.

## 5. Чек-лист реализации

- [ ] Воспроизвести отсутствие pseudo-узлов и градиентных фонов.
- [ ] Добавить gradient paint в FIR и экстрактор.
- [ ] Применить gradient paint в плагине.
- [ ] Научить pseudo-extractor градиентам и absolute inset.
- [ ] Пересобрать `dist`, импортировать, сравнить секции.
- [ ] Переместить карточку в `/done`.
