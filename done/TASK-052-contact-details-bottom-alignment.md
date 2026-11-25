---
id: TASK-052
title: margin-top:auto не выражается в Auto Layout — контактные данные уезжают вверх
status: done
priority: medium
phase: 7
dependencies: []
tags: [figma-plugin, autolayout, margins, contact, bugfix]
---

# TASK-052: Потеря `margin-top:auto` / прижатия к низу в Auto Layout

## 1. Описание задачи

В блоке `section#contact` контактные данные (телефон, e-mail, адрес) в браузере
прижаты к низу левой колонки:

```css
.contact-details{ margin-top:auto; display:flex; flex-direction:column; gap:9px }
```

В Figma `div.contact-details` находится на **47 px выше**:
- FIR: `y = 8413.3` (абзац/ссылки внизу колонки);
- Figma: `y = 8366.03` (узел `1:282`, FRAME, Auto Layout VERTICAL).

Из-за этого между адресом и низом зелёной карточки появляется пустой пояс, а
блок контактов визуально «плавает» выше, чем в эталоне. Дополнительно заголовок
`ВАША СТЕНА…` из-за fallback-шрифта сжался с 74.62 px до 56.05 px, и Auto Layout
подтянул следующий элемент вверх — `margin-top:auto` не компенсировал разницу.

## 2. Связанные разделы документации

- [ARCHITECTURE.md](../ARCHITECTURE.md), §4.2 (Auto Layout Engine).
- [KNOWLEDGE_BASE.md](../KNOWLEDGE_BASE.md) — flexbox/auto layout, `margin:auto`.
- [TASK-007](../done/TASK-007-flexbox-autolayout.md),
  [TASK-021](../done/TASK-021-autolayout-button-alignment-and-sizing.md),
  [TASK-032](../done/TASK-032-flex-child-margins-to-item-spacing.md).
- Отчёт: [`examples/alfagreen-fitosteny/v8/REPORT.md`](../examples/alfagreen-fitosteny/v8/REPORT.md).
- Артефакты: `figma/compare-contact.png`, `figma-tree.json`, `fir.json`.

## 3. Технические детали и требования к реализации

Причина:

1. `applyAutoLayout()` (`src/plugin/layout-engine.ts:6`) задаёт mode, gap, padding
   и выравнивания, но не умеет `margin-top:auto`/`margin-left:auto`.
2. `analyzeElementLayout()` (`src/extractor/layout-analyzer.ts`) не сохраняет
   auto-margins в `FIRLayout`.
3. В Figma Auto Layout нет auto-margin: для прижатия нужен либо spacer-frame с
   `layoutGrow=1`, либо `primaryAxisAlignItems=SPACE_BETWEEN`, либо
   `layoutPositioning=ABSOLUTE` с координатой из FIR.
4. При сжатии заголовка (fallback) фиксированная позиция из FIR не удерживается,
   потому что родитель — Auto Layout.

Требования:

- В FIR добавить признак auto-margin (например, `margin: {top:'auto'}` или
  `layout.autoMarginTop:true`) на основе `getComputedStyle().marginTop === 'auto'`
  (Chrome отдаёт вычисленное значение в px — нужен анализ CSS-правил/`flexGrow`).
- В плагине для вертикального Auto Layout с auto-margin сверху вставлять
  spacer-frame `layoutGrow=1` перед блоком (или включать
  `primaryAxisAlignItems='SPACE_BETWEEN'`, если это безопасно).
- Для горизонтальных `margin-left:auto` — spacer слева.
- Учесть, что `margin-top:auto` может стоять у нескольких детей; не ломать
  `gap`/`padding`.
- Добавить unit-тест: контейнер VERTICAL с тремя детьми, у последнего
  auto-margin-top → последний прижат к низу, координата совпадает с FIR.
- Проверить контактный блок и футер (там тоже есть auto-раскладка).

## 4. Критерии приемки (Definition of Done)

- [x] `div.contact-details` помечен `autoMarginTop` в FIR и рендерится на своей
  абсолютной координате (y=8413.3), не подтягиваясь к заголовку.
- [x] Телефон/e-mail/адрес не «уезжают» вверх.
- [x] Auto Layout отключается только у контейнеров с таким ребёнком; остальные
  секции не затронуты.
- [x] `npm test`, `npm run typecheck`, `npm run build` проходят.
- [x] Нет ложных срабатываний на геометрию (проверено 7 реальных случаев).

## 5. Чек-лист реализации

- [x] Воспроизвести сдвиг 47 px на `figma-tree.json`.
- [x] Извлекать auto-margins в FIR (по CSS-правилам, не по геометрии).
- [x] Реализовать fallback на absolute layout для контейнера с auto-margin.
- [x] Добавить unit-тест.
- [x] Пересобрать `dist` и проверить FIR на реальной странице.
- [x] Переместить карточку в `/done`.

## 6. Результат

- `hasAutoMarginTopRule()` ищет в same-origin stylesheet правило
  `margin-top:auto`, совпадающее с элементом (Chrome в `getComputedStyle`
  отдаёт уже использованное `0px`), и ставит `autoMarginTop` на FIR-ребёнка.
- В `renderFIRNode()` контейнер с таким ребёнком больше не включает Auto Layout:
  дети позиционируются абсолютно по FIR-координатам. Это сохраняет низ колонки
  при любом размере fallback-заголовка.
- На реальной странице (`fir-052b.json`) размечено **7** детей: 6
  `a.pill-link` внутри `div.project-meta` и `div.contact-details`
  (y=8413.3, низ колонки 8483.7).
- Добавлен unit-тест рендера (VERTICAL-контейнер с auto-margin → layoutMode NONE,
  child.y=250); всего 113/113. `tsc --noEmit` и `npm run build` — без ошибок;
  `dist/code.js` SHA256 `7B8396A6…B7B3`, `dist/extractor.js` `3CFB5932…DFE1`.
- Повторный визуальный импорт в Figma не выполнялся; поведение проверено на FIR
  и Figma-моке рендерера.
