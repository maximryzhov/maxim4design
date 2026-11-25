---
id: TASK-043
title: Текст кнопки «ОБСУДИТЬ ПРОЕКТ» переносится в две строки и вылезает из кнопки
status: done
priority: medium
phase: 7
dependencies: [TASK-040]
tags: [figma-plugin, text, fonts, overflow, bugfix]
---

# TASK-043: Переполнение single-line CTA после алиаса ContactBebasExpanded → Oswald

## 1. Описание задачи
После TASK-040 кастомные шрифты заменяются на Oswald. В контактной форме CTA-кнопка `button#submit-button.btn.btn-dark` (205.36×62.84) содержит текст «ОБСУДИТЬ ПРОЕКТ», который в v7 рендерится **в две строки** («ОБСУДИТЬ» / «ПРОЕКТ»), причём вторая строка выходит за зелёную плашку.

Данные FIR:
- `button#submit-button...-text` — TEXT 158.08×22.30;
- `textData.isSingleLine = true`, `whiteSpace = nowrap`, `textAlign = CENTER`;
- шрифт `ContactBebasExpanded`, 21.6189px → алиас `Oswald/Bold`.

Причина: overflow-guard в `text-renderer.ts` срабатывает только при `firstFontSize >= 24`, поэтому 21.6px пропускается. Для `textAlign = CENTER` и `nowrap` выставляется `textAutoResize = 'NONE'`, и Figma переносит текст по словам в фиксированной ширине 158px, хотя CSS требует одну строку.

## 2. Связанные разделы документации
- [ARCHITECTURE.md](file:///e:/Projects/Dev/html2design/ARCHITECTURE.md)
- [TASK-040](file:///e:/Projects/Dev/html2design/done/TASK-040-custom-font-fallback-overflow.md)
- Отчёт: `examples/alfagreen-fitosteny/v6/REPORT.md`, `v7-compare-6-3450-4377.png`

## 3. Технические детали и требования к реализации
- В `text-renderer.ts` распространить fit-guard на **все** `whiteSpace = nowrap`/`isSingleLine` тексты (порог 12px, не 24px):
  - измерять полную строку через `measureTextWidth()` для текущего (алиасного) шрифта;
  - если `measured > availableWidth`, пропорционально уменьшать `fontSize`/`letterSpacing` до вписывания;
  - либо для CTA использовать `textAutoResize = 'WIDTH_AND_HEIGHT'` и не позволять auto-layout родителя сжимать текст (проверить `layoutGrow`/`layoutSizingHorizontal`).
- Проверить, что после алиаса `ContactBebasExpanded` → `Oswald` ширина текста на 21.6px не превышает 158px с учётом `letter-spacing`.
- Не ломать обычные заголовки/абзацы: guard применять к single-line/nowrap и к текстам внутри фиксированных по ширине контейнеров.
- Добавить unit-тест: nowrap-текст 21.6px с измеренной шириной 190px в боксе 158px → размер уменьшается, текст остаётся одной строкой.

## 4. Критерии приемки (Definition of Done)
- [x] В Figma CTA «ОБСУДИТЬ ПРОЕКТ» — одна строка внутри кнопки 205×63.
- [x] Нет выхода текста за зелёную плашку и обрезки по краям.
- [x] Другие single-line CTA/подписи не уменьшаются без необходимости.
- [x] `npm test`, `npm run typecheck`, `npm run build` проходят.

## 5. Чек-лист реализации
- [x] Расширить условие fit-guard на nowrap/single-line 12px+.
- [x] Проверить измерение ширины на алиасном шрифте.
- [x] Добавить тест на CTA.
- [x] Пересобрать и проверить экспорт контактной формы.
- [x] Переместить карточку в `/done`.

## 6. Результат
- Fit-guard в `text-renderer.ts` теперь срабатывает не только при `fontSize >= 24`, но и для любого single-line/nowrap текста с `textAlign CENTER|RIGHT|JUSTIFIED` (порог 12px): измеряет полную строку через `measureTextWidth()` и уменьшает `fontSize`/`lineHeight`/`letterSpacing` до вписывания.
- Для CTA 158.08px с шрифтом Oswald 21.62px (алиас ContactBebasExpanded) строка «ОБСУДИТЬ ПРОЕКТ» ужимается и остаётся одной строкой; `textAutoResize` остаётся `NONE`, ширина 158.08.
- Unit-тест: `renderTextNode shrinks oversized centered CTA text to keep one line`; всего 100/100.
- Проверка в Figma: импортирован тестовый кадр `cta-test3` (300×120, кнопка 205.36×62.84); текст «ОБСУДИТЬ ПРОЕКТ» — одна строка внутри плашки, без обрезки (`plugin-cta-fixed5.png`). Плагин показал alias «ContactBebasExpanded → Oswald (Bold)».
- `dist/code.js`: SHA256 `CB6D3A02…2F03`.
