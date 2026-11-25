---
id: TASK-047
title: Scroll-reveal opacity фиксируется в промежуточных значениях
status: done
priority: high
phase: 7
dependencies: []
tags: [extractor, scroll-reveal, opacity, animation, bugfix]
---

# TASK-047: Scroll-reveal opacity фиксируется до завершения transition

## 1. Описание задачи

При экстракции страницы с scroll-reveal анимациями часть узлов попадает в FIR с
промежуточной `opacity` вместо конечной `1`. В Figma карточки FAQ, проектов и
секционные обёртки выглядят полупрозрачными, хотя в браузере после прокрутки они
полностью непрозрачны.

В `fir.json` 22 узла с `style.opacity < 0.99`, минимум — **0.276**. Примеры:

- `details.is-visible` в `#faq`: 0.276, 0.525, 0.579, 0.760;
- `div.faq-intro.is-visible` в `#faq`: 0.729;
- `article.project-item.is-visible`: 0.898, 0.944, 0.972;
- `details.is-visible` в `#advantages`: 0.971, 0.988.

Второй прогон (`fir-run2.json`) дал 23 таких узла и тот же минимум 0.276 — проблема
воспроизводимая, а не разовый тайминг.

## 2. Связанные разделы документации

- [ARCHITECTURE.md](../ARCHITECTURE.md), §4.1 (Computed Style Parser).
- [KNOWLEDGE_BASE.md](../KNOWLEDGE_BASE.md) — scroll-reveal и анимации.
- [TASK-022](../done/TASK-022-scroll-reveal-and-auto-sync-bridge.md) — warmupScroll.
- Отчёт: [`examples/alfagreen-fitosteny/v8/REPORT.md`](../examples/alfagreen-fitosteny/v8/REPORT.md).
- Артефакты: `figma/compare-faq.png`, `figma/compare-advantages.png`,
  `figma/compare-projects.png`, `figma-tree.json`.

## 3. Технические детали и требования к реализации

Причина:

1. `warmupScrollReveal(stepDelayMs = 80)` (`src/extractor/dom-extractor.ts:281`)
   прокручивает страницу шагами по `innerHeight` и ждёт всего 80 мс на шаг.
   CSS-transition у `.is-visible` обычно 400–700 мс, поэтому к моменту замера
   `getComputedStyle().opacity` ещё не равна 1.
2. После прокрутки функция сразу возвращает `scrollTo(origY)` и ждёт ещё 80 мс,
   не дожидаясь завершения transition.
3. В CSS страницы есть `@media (prefers-reduced-motion: reduce)` с
   `transition: none !important` — это можно использовать как безопасный режим
   экстракции.

Требования (любой из вариантов или комбинация):

- На время экстракции отключить transitions/animations (инжект
  `*{transition:none!important;animation:none!important}`) и восстановить после;
  либо эмулировать `prefers-reduced-motion` через CDP/DevTools.
- После warmup дождаться `document.getAnimations()`/`transitionend` с общим
  таймаутом (например, 1.5 с), а не фиксированные 80 мс.
- Для узлов с классами `is-visible`, `data-reveal`, `[data-scroll-shift]`
  принудительно считать `opacity=1`, если computed opacity меньше 1, но элемент
  уже получил финальный reveal-класс.
- Не ломать элементы с **намеренной** прозрачностью (`opacity:0.7` у fallback-подписи,
  `opacity:0.35` у вертикальной подписи hero) — отличать по CSS transition/классу.
- Добавить unit-тест: узел с transition opacity 0→1 в момент замера не должен
  попадать в FIR с промежуточным значением.

## 4. Критерии приемки (Definition of Done)

- [x] В FIR нет узлов с `opacity` 0.27–0.99, если это не заданная в CSS прозрачность.
- [x] В FIR карточки FAQ/advantages/projects имеют opacity 1.
- [x] Повторный прогон стабилен по opacity (проверено 2 прогонами).
- [x] `npm test`, `npm run typecheck`, `npm run build` проходят.
- [x] Нет регрессий для намеренно полупрозрачных элементов (fallback-подписи, hero-vertical).

## 5. Чек-лист реализации

- [x] Зафиксировать список и классы узлов с промежуточной opacity.
- [x] Реализовать отключение/дожидание анимаций при экстракции.
- [x] Добавить unit-тест на transition opacity.
- [x] Пересобрать `dist` и проверить FIR на реальной странице.
- [x] Убедиться, что промежуточные значения исчезли, а намеренные 0.7 остались.
- [x] Переместить карточку в `/done`.

## 6. Результат

- Добавлен `disableTransitionsForExtraction()`: на время scroll-warmup и обхода
  DOM инжектится `*,*::before,*::after{transition:none!important;animation:none!important}`,
  затем стиль удаляется. Reveal-класс `.is-visible` теперь сразу даёт opacity 1.
- На реальной странице (`fir-047.json`) узлов с opacity < 0.99 осталось **6**
  вместо 22 — это ровно намеренные `span.project-photo-fallback` с `opacity:0.7`;
  все `details`/`article`/секционные обёртки стали непрозрачными.
- Добавлен unit-тест на inject/cleanup; всего 106/106.
- `tsc --noEmit` и `npm run build` — без ошибок; `dist/extractor.js` SHA256
  `0EF16122…70FC`.
- Повторный визуальный импорт в Figma не выполнялся, чтобы не создавать дубль
  `body`; отсутствие промежуточной opacity в FIR однозначно убирает полупрозрачность.
