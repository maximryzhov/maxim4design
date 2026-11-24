---
id: TASK-041
title: Кнопка «Скачать отсутствующие шрифты» в UI плагина
status: done
priority: high
phase: 7
dependencies: [TASK-028, TASK-029]
tags: [figma-plugin, ui, fonts, feature]
---

# TASK-041: Скачивание отсутствующих шрифтов из плагина

## 1. Описание задачи
Figma Plugin API не позволяет загрузить бинарный шрифт в редактор: `figma.loadFontAsync()` работает только с уже доступными шрифтами ([документация Figma](https://developers.figma.com/docs/plugins/api/properties/figma-loadfontasync/)). Поэтому реализован практический обход, как у html.to.design: плагин показывает отсутствующие семейства и даёт скачать исходные `@font-face`-файлы, а пользователь устанавливает их в ОС (или админ загружает в организацию). После установки и перезапуска Figma повторный импорт использует настоящие шрифты.

Токен Figma здесь не участвует: REST API не отдаёт и не устанавливает шрифты. Скачивание идёт из `sourceUrl`, который экстрактор уже получил из CSS страницы.

## 2. Связанные разделы документации
- [KNOWLEDGE_BASE.md](file:///e:/Projects/Dev/html2design/KNOWLEDGE_BASE.md) — «Баг 1: Фатальный краш на шрифтах»
- [TASK-029](file:///e:/Projects/Dev/html2design/done/TASK-029-custom-font-auto-install-and-svg-fallback.md)
- [html.to.design — Missing fonts](https://html.to.design/docs/missing-fonts/)

## 3. Технические детали и требования к реализации
- `src/plugin/font-manager.ts`:
  - `isFamilyAvailable(family)` — проверка по индексу `listAvailableFontsAsync()`.
  - `selectMissingFontAssets(fonts, isAvailable)` — только семейства, которых нет в Figma, с непустым `sourceUrl`, без дублей.
- `src/plugin/code.ts`: в сообщение `SUCCESS` добавлено поле `missingFonts` (вместо передачи всех `data.fonts` — экономия ~1.1 МБ на этой странице).
- `src/plugin/ui.html`:
  - карточка «Отсутствующие шрифты» со списком (family + weight + реальный формат), кнопками «Скачать» и «Скачать все»;
  - скачивание через Blob + `<a download>` (data URL не навигирует iframe);
  - определение расширения по сигнатуре файла (`OTTO` → `.otf`, `true`/`0x00010000` → `.ttf`, `wOFF`/`wOF2`), а не по CSS-подсказке `format("truetype")`;
  - инструкции для Windows/macOS, браузера (FigmaAgent), ChromeOS/Linux и предупреждение про WOFF/WOFF2;
  - карточка скрывается при новом импорте/очистке.
- Тесты: `tests/font-manager.test.ts` — `isFamilyAvailable`, `selectMissingFontAssets`.

## 4. Критерии приемки (Definition of Done)
- [x] В UI появляется карточка с 3 отсутствующими шрифтами (`ContactBebas`, `ContactBebasExpanded`, `ProcessMontserrat`).
- [x] Кнопка «Скачать» сохраняет валидный файл шрифта; для CFF-шрифта выставляется расширение `.otf` (сигнатура `OTTO`), для TrueType — `.ttf`.
- [x] Сообщение `SUCCESS` содержит только отсутствующие шрифты; размер payload уменьшен.
- [x] `npm run typecheck`, `npm test` (74/74), `npm run build` проходят.
- [x] UI-логика проверена в headless Chrome на реальном FIR: карточка рендерится, файл `ContactBebas-800.otf` (62 180 байт, `OTTO`) скачивается.

## 5. Чек-лист реализации
- [x] Добавить `isFamilyAvailable` и `selectMissingFontAssets`.
- [x] Передавать `missingFonts` в `SUCCESS`.
- [x] Добавить карточку, список и скачивание в UI.
- [x] Определять расширение по сигнатуре шрифта.
- [x] Добавить unit-тесты.
- [x] Собрать и проверить UI в headless Chrome.
- [x] Переместить карточку в `/done`.

## 6. Примечание
Установка шрифта в ОС остаётся ручным действием пользователя (Windows: ПКМ → «Установить»; macOS: Font Book). Для браузера нужен FigmaAgent; для ChromeOS/Linux — загрузка в аккаунт/организацию. Токен Figma для этого не используется и не может использоваться.
