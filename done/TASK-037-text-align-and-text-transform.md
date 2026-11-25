---
id: TASK-037
title: Не сохраняются text-align и text-transform
status: done
priority: high
phase: 7
dependencies: []
tags: [extractor, figma-plugin, text, typography, bugfix]
---

# TASK-037: Выравнивание и регистр текста не переносятся в Figma

## 1. Описание задачи
В FIR нет полей для `text-align` и `text-transform`, поэтому все TEXT-узлы рендерятся с `textAlignHorizontal = 'LEFT'` и исходным регистром символов.

Проявления на `alfagreen-fitosteny.html` (viewport 1440):
- Hero-заголовок: `span.hero-heading-first` в эталоне выровнен по правому краю (`.hero-heading-first{text-align:right}`), `span.hero-heading-second` — по левому. В Figma оба узла (`8:1183`, `8:1184`) имеют `textAlignHorizontal: LEFT`, из-за чего «ФИТОСТЕНЫ» уезжает влево и не совпадает с эталоном.
- Навигация шапки и подвала: CSS `text-transform: uppercase`, но в Figma ссылки отображаются как «Услуги», «Проекты», «Магазин» вместо «УСЛУГИ», «ПРОЕКТЫ», «МАГАЗИН»; из-за этого меняется ширина и позиции пунктов.
- Аналогично для мелких label/CTA, где регистр задан только CSS.

## 2. Связанные разделы документации
- [ARCHITECTURE.md](file:///e:/Projects/Dev/html2design/ARCHITECTURE.md) — спецификация `FIRTextData`
- Отчёт: `examples/alfagreen-fitosteny/v6/REPORT.md`, кроп `compare-1-0-700.png`

## 3. Технические детали и требования к реализации
- Расширить `FIRTextData` (`src/types/fir.ts`):
  - `textAlign?: 'LEFT' | 'CENTER' | 'RIGHT' | 'JUSTIFIED'`;
  - `textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize'`.
- В `extractTextData()` (`src/extractor/text-builder.ts`) заполнять их из `getComputedStyle(rootElement)`.
- В `renderTextNode()` (`src/plugin/text-renderer.ts`) выставлять `textNode.textAlignHorizontal` и применять `text-transform` к `characters` (с сохранением длины сегментов: трансформация 1:1 для `toUpperCase`/`toLowerCase`; для `capitalize` пересчитывать границы сегментов).
- Учесть, что `text-transform` влияет на ширину и переносы: применять до установки `textAutoResize`.
- Валидатор FIR обновить опциональными полями, обратная совместимость сохраняется.
- Добавить тесты на right/center/uppercase и на сегменты с разным стилем.

## 4. Критерии приемки (Definition of Done)
- [x] В Figma hero-заголовок совпадает с эталоном: первая строка прижата вправо, вторая — влево.
- [x] Пункты навигации шапки/подвала отображаются в верхнем регистре и по ширине совпадают с эталоном.
- [x] `textAlignHorizontal` в Figma соответствует CSS для всех TEXT-узлов.
- [x] `npm test`, `npm run typecheck`, `npm run build` проходят; старые FIR без новых полей импортируются.

## 5. Чек-лист реализации
- [x] Добавить поля в `FIRTextData` и валидатор.
- [x] Извлекать align/transform.
- [x] Применять в text-renderer с учётом ширины.
- [x] Тесты + пересборка + извлечение.
- [x] Переместить карточку в `/done`.

## 6. Результат
- `FIRTextData` расширен: `textAlign: LEFT|CENTER|RIGHT|JUSTIFIED` и `textTransform: none|uppercase|lowercase|capitalize`.
- Экстрактор заполняет их из `getComputedStyle` и применяет `text-transform` к `characters` (только если длина строки сохраняется, чтобы не сломать диапазоны сегментов).
- `renderTextNode()` выставляет `textAlignHorizontal`. Для right/center/justify + `nowrap`/single-line используется `textAutoResize = 'NONE'`, иначе `WIDTH_AND_HEIGHT` схлопывал бы ширину и выравнивание терялось.
- Проверка FIR: `span.hero-heading-first` → `textAlign: RIGHT`, `span.hero-heading-second` → `LEFT`; навигация → `УСЛУГИ`, `ПРОЕКТЫ`, `МАГАЗИН` с `textTransform: uppercase`.
- Тесты: 90/90; новый файл `tests/text-align-transform.test.ts` (2 кейса).
- E2E v7 (кадр `16:2`): hero выровнен right/left, навигация в верхнем регистре.
