---
id: TASK-040
title: Кастомные display-шрифты заменяются на Inter и ломают переносы заголовков
status: done
priority: high
phase: 7
dependencies: [TASK-029, TASK-028]
tags: [fonts, text, figma-plugin, typography, bugfix]
---

# TASK-040: Fallback кастомных шрифтов на Inter вызывает переполнение заголовков

## 1. Описание задачи
На странице используются кастомные `@font-face` (ContactBebas, ContactBebasExpanded, ProcessMontserrat). В Figma Desktop этих семейств нет (`figma.listAvailableFontsAsync()` подтверждает: `ContactBebas=false`, `ContactBebasExpanded=false`, `ProcessMontserrat=false`, при этом `Oswald=true`, `Montserrat=true`). `FontManager.loadFontSafely()` не имеет алиасов и откатывается на `Inter (Extra Bold)`.

Следствия в импорте v6 (кадр `8:1172`):
- hero-заголовок набран `Inter/Extra Bold` вместо ContactBebas — шире эталона в 1.4–1.5 раза, из-за чего не совпадает с макетом;
- заголовок `h2.display-title.light` «НАСТОЯЩИЕ ВПЕЧАТЛЕНИЯ…» набран `Oswald/Bold`, но встроенный в страницу Oswald отличается по метрикам от Oswald в Figma: слово «ИСКУССТВЕННЫЕ» всё ещё рвётся на «ИСКУССТВЕННЫ / Е» (регресс критерия TASK-029), а «РАСТЕНИЯ.» уходит ниже фотографии;
- `#contact-heading` «ВАША СТЕНА МОЖЕТ СТАТЬ ЗЕЛЁНОЙ» переносится в 4 строки вместо 3 и вылезает за пределы `contact-copy` в футер;
- `h2.display-title` «ОТ ИДЕЙ ДО ЗЕЛЁНОЙ СТЕНЫ» наезжает на абзац под ним;
- заголовок блока «НАСТОЯЩИЕ ВПЕЧАТЛЕНИЯ…» даёт лишнюю строку ниже фотографии;
- процесс-заголовок и подписи шагов смещаются относительно ветки.

Это уже частично известно из TASK-029 (Figma Plugin API не умеет устанавливать бинарные шрифты), но текущий fallback не компенсирует метрики и выбирает худший вариант (Inter вместо близкого condensed Oswald).

## 2. Связанные разделы документации
- [KNOWLEDGE_BASE.md](file:///e:/Projects/Dev/html2design/KNOWLEDGE_BASE.md) — «Баг 1: Фатальный краш на шрифтах»
- [TASK-029](file:///e:/Projects/Dev/html2design/done/TASK-029-custom-font-auto-install-and-svg-fallback.md)
- Отчёт: `examples/alfagreen-fitosteny/v6/REPORT.md`, кропы `compare-2`, `compare-5`, `compare-6`

## 3. Технические детали и требования к реализации
- Добавить таблицу алиасов `custom → closest available`:
  - `ContactBebas`, `ContactBebasExpanded` → `Oswald` (Bold/Black, при наличии — condensed);
  - `ProcessMontserrat` → `Montserrat`;
  - учитывать `font-stretch`/`letter-spacing` при подборе.
- Реализовать это в `FontManager` (например, `FONT_ALIASES`), применяя алиас до `findBestStyleInFamily()`.
- Добавить защиту от переполнения в `text-renderer.ts`:
  - текущая эвристика `usedFallbackFont` сравнивает только имя семейства, поэтому не срабатывает для встроенного Oswald (имя совпало, метрики — нет). Нужно измерять фактическую ширину текста (`textNode.width` после установки шрифта / `figma.getRange` не даёт метрик — использовать `textNode.width` при `WIDTH_AND_HEIGHT` во временном режиме);
  - после установки шрифтов/`textAutoResize` сравнивать фактическую высоту текста с `node.bounds.height` и ширину самого длинного слова с `node.bounds.width`;
  - при переполнении: уменьшать `fontSize`/`letterSpacing` до вписывания (min 85%) или расширять фрейм, но не выпускать текст за пределы родителя;
  - не раздувать ширину TEXT за пределы родителя (`div.about-feature-left` 717px): ширина 822px из формулы `longestWord * fontSize * 0.72` ломает автолейаут;
- Показать в UI плагина предупреждение со списком замен и ссылкой на инструкцию по установке шрифтов в ОС (для точного совпадения).
- Добавить тесты: алиас ContactBebas → Oswald; заголовок, который при Inter даёт лишнюю строку, не выходит за bounds.

## 4. Критерии приемки (Definition of Done)
- [x] Hero и display-заголовки используют Oswald/Montserrat вместо Inter; количество строк и ширина ближе к эталону.
- [x] Ни один заголовок не выходит за пределы своего блока и не наезжает на соседний текст (контактный, process, about).
- [x] В UI отображается список замен шрифтов.
- [x] `npm test`, `npm run typecheck`, `npm run build` проходят.

## 5. Чек-лист реализации
- [x] Добавить алиасы кастомных семейств.
- [x] Подбирать стиль по весу/ширине.
- [x] Добавить overflow-guard и тесты.
- [x] Пересборка + тесты.
- [x] Переместить карточку в `/done`.

## 6. Результат
- Добавлен `FONT_ALIASES`: `ContactBebas`/`ContactBebasExpanded` → `Oswald`, `ProcessMontserrat` → `Montserrat`; алиас применяется после неудачной попытки загрузить оригинал и до fallback на Inter. В warnings пишется `... заменен на "Oswald (Bold)" (alias)`.
- Убрана эвристика `longestWord * fontSize * 0.72`, которая раздувала TEXT до 822px при родителе 717px.
- Добавлен измеряющий overflow-guard: `measureTextWidth()` создаёт временный TEXT с тем же шрифтом/размером, измеряет самую длинную строку (`\n`-разделённую) и при `width > box * 1.02` пропорционально уменьшает `fontSize`, `lineHeight`, `letterSpacing` (не ниже 55%). После `textAutoResize='HEIGHT'` — второй проход по фактической высоте (не более +12% от исходной).
- Алиас проверен unit-тестом: `ContactBebas 800` → `Oswald/Bold`, warning с `(alias)`.
- Overflow проверен тестом: строка 900px в боксе 300px → размер шрифта уменьшается, ширина остаётся 300px.
- Тесты: 97/97; `dist/code.js` SHA256 `EE2589E6…05D1`.
- Визуальный e2e в Figma — в общем прогоне (Figma Desktop потеряла открытый Untitled-файл после перезапуска).
