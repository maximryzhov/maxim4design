---
id: TASK-003
title: Базовый DOM Extractor (выделение элемента, геометрия и базовые стили)
status: done
priority: high
phase: 1
dependencies: [TASK-002]
tags: [extractor, dom, styles, browser]
---

# TASK-003: Базовый DOM Extractor

## 1. Описание задачи
Реализовать браузерный скрипт обхода DOM-дерева, который принимает корневой HTML-элемент (или `$0` в консоли DevTools), считывает его геометрию (`getBoundingClientRect`), вычисленные стили (`window.getComputedStyle`) и рекурсивно формирует валидное дерево `FIRNode`.

## 2. Связанные разделы документации
- [ARCHITECTURE.md](file:///e:/Projects/Dev/html2design/ARCHITECTURE.md) (Раздел 4.1: Модуль экстракции)
- [KNOWLEDGE_BASE.md](file:///e:/Projects/Dev/html2design/KNOWLEDGE_BASE.md) (Фильтрация узлов и разбор цветов)

## 3. Технические детали и требования к реализации
- Создать модуль в `src/extractor/dom-extractor.ts`.
- Реализовать фильтрацию:
  - Игнорировать теги `SCRIPT`, `STYLE`, `NOSCRIPT`, `TEMPLATE`.
  - Игнорировать элементы с `display: none` или `visibility: hidden`.
- Реализовать конвертер цветов:
  - Функция `parseCssColor(colorStr: string): RGBAColor | undefined`, умеющая парсить `rgba(...)`, `rgb(...)`, `#hex`, `transparent`.
- Считывание геометрии:
  - `getBoundingClientRect()` для вычисления абсолютных координат и размеров.
- Определение типа ноды:
  - Если узел содержит только текст или это текстовый лист -> `TEXT`.
  - Если содержит дочерние элементы -> `FRAME`.
- Экспорт функции: `extractFIRFromElement(rootElement: HTMLElement): FIRNode`.

## 4. Критерии приемки (Definition of Done)
- [x] Скрипт можно запустить в консоли браузера на реальной странице (например, на кнопке или карточке товара).
- [x] Скрипт возвращает валидный JSON, соответствующий интерфейсу `FIRNode`.
- [x] Корректно рассчитываются ширина, высота и цвета фона/текста.

## 5. Чек-лист реализации
- [x] Создать `src/extractor/dom-extractor.ts`.
- [x] Написать парсер цветов `parseCssColor`.
- [x] Реализовать рекурсивный обход `traverseElement(el)`.
- [x] Добавить фильтр невидимых элементов.
- [x] Протестировать генерацию FIR в браузере.
- [x] Переместить карточку в `/done`.
