---
id: TASK-006
title: Сервис безопасной загрузки шрифтов (FontLoader с кэшем и фоллбеками)
status: pending
priority: critical
phase: 2
dependencies: [TASK-005]
tags: [figma-plugin, typography, fonts, fallback]
---

# TASK-006: Сервис безопасной загрузки шрифтов

## 1. Описание задачи
Создать надежный сервис управления шрифтами `FontManager` для песочницы Figma. Сервис должен уметь загружать произвольные начертания и семейства, кэшировать уже загруженные шрифты и безопасно откатываться на системный `Inter` / `Roboto` при отсутствии веб-шрифта в каталоге Figma.

## 2. Связанные разделы документации
- [ARCHITECTURE.md](file:///e:/Projects/Dev/html2design/ARCHITECTURE.md) (Раздел 6: Стратегия отказоустойчивости)
- [KNOWLEDGE_BASE.md](file:///e:/Projects/Dev/html2design/KNOWLEDGE_BASE.md) (Баг 1: Фатальный краш на шрифтах `figma.loadFontAsync`)

## 3. Технические детали и требования к реализации
- Создать `src/plugin/font-manager.ts`.
- Реализовать класс `FontManager`:
  - Кэш `Set<string>` загруженных ключей шрифтов вида `"${family}-${style}"`.
  - Маппинг числового веса CSS (`fontWeight`: 400, 500, 600, 700) в стили Figma:
    - 400 -> "Regular", 500 -> "Medium", 600 -> "SemiBold", 700 -> "Bold", 800/900 -> "Black".
  - Метод `loadFontSafely(family: string, weight: number, isItalic?: boolean): Promise<FontName>`.
  - Цепочка fallback:
    1. Попытка загрузить запрошенный шрифт `{ family, style }`.
    2. Попытка загрузить `{ family: "Inter", style }` с тем же стилем начертания.
    3. Гарантированный откат на `{ family: "Inter", style: "Regular" }`.
  - Метод предварительной пакетной загрузки: `preloadFonts(fonts: Array<{ family: string, weight: number }>)`.

## 4. Критерии приемки (Definition of Done)
- [ ] Никакие кастомные шрифты (например, "Geist", "SF Pro Display", редкие Google Fonts) не вызывают падения плагина.
- [ ] При повторном запросе того же шрифта не происходит лишних вызовов `figma.loadFontAsync` (работает кэш).
- [ ] Текст сохраняет визуальный вес (Bold, Medium) даже при откате на шрифт Inter.

## 5. Чек-лист реализации
- [ ] Создать `src/plugin/font-manager.ts`.
- [ ] Реализовать маппер CSS fontWeight -> Figma style name.
- [ ] Реализовать `loadFontSafely` с трехступенчатым fallback.
- [ ] Добавить кэширование загруженных шрифтов.
- [ ] Интегрировать `FontManager` в генератор нод.
- [ ] Переместить карточку в `/done`.
