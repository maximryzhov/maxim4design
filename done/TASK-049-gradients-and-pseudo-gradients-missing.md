---
id: TASK-049
title: Градиентные pseudo-elements и фоны не импортируются
status: done
priority: medium
phase: 7
dependencies: []
tags: [extractor, figma-plugin, gradients, pseudo-elements, styles, bugfix]
---

# TASK-049: Градиенты и pseudo-elements с градиентом отсутствуют в Figma

## 1. Описание задачи

На проверяемой странице есть градиентная подложка `.about-feature::before`
(`linear-gradient(transparent, #171b17a8)`), которая должна затемнять нижнюю часть
большой карточки материалов. В FIR она отсутствовала: `extractPseudoElement()`
отбрасывал pseudo, у которого прозрачный `background-color` и нет рамок/теней.

После проверки фактического DOM (не только CSS) выяснилось, что правила
`.material-card::after`, `.service-visual::after`, `.project-tile::after` и
`.product-image` в текущей v8-разметке **не используются**: `document.querySelector`
их не находит, элементов с `background-image: *-gradient(...)` — 0. Поэтому
реальный дефект страницы — именно потерянная `.about-feature::before`; остальные
селекторы — CSS-наследие.

Тем не менее поддержка градиентов реализована обобщённо: парсер `linear/radial-gradient`,
gradient paint в плагине и корректный `inset` для pseudo-элементов.

Ожидаемое поведение: градиентная подложка сохраняется как редактируемый
RECTANGLE/FRAME с `GRADIENT_LINEAR` fill, а pseudo-элементы без реального
оформления не создают лишних слоёв.

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

- [x] В FIR есть узел `::before` для `.about-feature` с `backgroundGradient`
  (LINEAR, 180°, 2 stops).
- [x] Плагин создаёт `GRADIENT_LINEAR` fill из этого узла (unit-тест `applyStyles`).
- [x] Pseudo с градиентом и `inset` получает корректные bounds (unit-тест).
- [x] Pseudo без реального оформления не создаёт лишних RECTANGLE/TEXT.
- [x] `npm test`, `npm run typecheck`, `npm run build` проходят.
- [x] Нет регрессий в количестве узлов и в существующих стилях.

## 5. Чек-лист реализации

- [x] Проверить фактический DOM, а не только CSS-селекторы.
- [x] Добавить gradient paint в FIR и экстрактор.
- [x] Применить gradient paint в плагине.
- [x] Научить pseudo-extractor градиентам и absolute inset.
- [x] Пересобрать `dist` и проверить FIR на реальной странице.
- [x] Переместить карточку в `/done`.

## 6. Результат

- `FIRStyle` получил `backgroundGradient` (`LINEAR/RADIAL`, angle, stops).
  `parseCssGradient()` разбирает `linear-gradient`/`radial-gradient`, проценты,
  `transparent` и rgba/hex-цвета; `style-applier.ts` создаёт нативный
  `GRADIENT_LINEAR`/`GRADIENT_RADIAL` paint (identity transform = top→bottom).
- `extractPseudoElement()` теперь считает градиент визуальным оформлением,
  выводит width/height из `inset`/`left/right/top/bottom` и не создаёт pseudo
  без явного box/оформления.
- Реальная страница (`fir-049b.json`): **1** pseudo-узел — `.about-feature::before`,
  1368×433.17, 180°, 2 stops; других элементов с градиентом в текущем DOM нет.
- Всего 110/110 тестов, включая 3 новых gradient/pseudo; `tsc --noEmit` и
  `npm run build` — без ошибок.
- Повторный визуальный импорт в Figma не выполнялся; gradient fill проверен
  unit-тестом `applyStyles`, FIR содержит корректный узел.
