---
id: TASK-048
title: CSS transform теряется у текстовых контейнеров — «+» открытого FAQ не поворачивается
status: pending
priority: medium
phase: 7
dependencies: []
tags: [extractor, transforms, text-container, faq, bugfix]
---

# TASK-048: Потеря CSS transform у текстовых контейнеров

## 1. Описание задачи

У открытого пункта FAQ иконка «+» в браузере повёрнута на 45° и выглядит как «×»
(`.faq-items details[open] .faq-plus { transform: rotate(45deg); background: var(--green); color:#fff }`).
В Figma у открытого пункта остаётся неповёрнутый «+»: цвета открытого состояния
применились (зелёный круг, белый глиф), а поворот — нет.

Проверка в браузере через CDP:

```
getComputedStyle(document.querySelector('.faq-plus')).transform
→ "matrix(0.707107, 0.707107, -0.707107, 0.707107, 0, 0)"
```

При этом в FIR у узла `span.faq-plus` поле `transform` **отсутствует**
(`fir.json`, обе секции FAQ/advantages), хотя bounding box уже повёрнут:
37×37 → 52.33×52.33. В Figma узел `span.faq-plus` имеет размер 52.33×52.33,
но текст «+» не повёрнут.

## 2. Связанные разделы документации

- [ARCHITECTURE.md](../ARCHITECTURE.md), §3 (FIRTransform), §4.2 (рендеринг).
- [KNOWLEDGE_BASE.md](../KNOWLEDGE_BASE.md) — CSS transform.
- [TASK-039](../done/TASK-039-css-transform-support.md) — поддержка CSS transform.
- [TASK-042](../done/TASK-042-faq-plus-icon-centering.md) — центрирование FAQ plus.
- Отчёт: [`examples/alfagreen-fitosteny/v8/REPORT.md`](../examples/alfagreen-fitosteny/v8/REPORT.md).
- Артефакты: `dom-transform.json`, `fir.json`, `figma-tree.json`,
  `figma/compare-faq.png`, `figma/compare-advantages.png`.

## 3. Технические детали и требования к реализации

Причина:

1. `parseTransformMatrix()` (`src/extractor/dom-extractor.ts:337`) корректно
   разбирает `matrix(...)` и возвращает `{rotation:45,...}` — проверено на
   синтетическом `div` с `transform:rotate(45deg)`.
2. `.faq-plus` — `SPAN` с одним текстовым ребёнком, поэтому попадает в ветку
   «текстовый контейнер» `traverseElement()` (`src/extractor/dom-extractor.ts:678`
   и `:693`). В этих `return` **нет поля `transform`**, в отличие от общего
   frame-return на `:773`.
3. В результате теряется не только поворот FAQ plus, но и любой transform у
   inline/text-контейнеров (scale/rotate/skew).
4. `renderTextNode()` (`src/plugin/text-renderer.ts:86`) вообще не применяет
   `transform` из FIR.

Требования:

- Прокинуть `transform` во все ветки `traverseElement()`: text-container,
  button-like, buildFormControlNode, hidden-input.
- В `renderTextNode()` (и/или в обёртке `renderFIRNode`) применять поворот
  вокруг центра ноды: `node.rotation = transform.rotation` или
  `relativeTransform` с корректным pivot; для вложенного TEXT внутри контейнера
  поворачивать контейнер, а не текст отдельно.
- Учесть, что bounds уже являются **bounding box после transform**; при повороте
  вокруг центра 52.33×52.33 координаты нужно скорректировать, чтобы визуальный
  центр совпал с исходным 37×37.
- Добавить unit-тест: `span` с `transform:rotate(45deg)` и текстом внутри
  сохраняет `transform.rotation=45` и рендерится повёрнутым.
- Не ломать `contact-plant` (`scaleX(-1)`), где transform уже обрабатывается
  через `flipX` битмапа.

## 4. Критерии приемки (Definition of Done)

- [ ] В FIR у `span.faq-plus` открытого пункта есть `transform.rotation = 45`.
- [ ] В Figma открытый пункт FAQ показывает «×» (повёрнутый «+»), закрытые — «+».
- [ ] Поворот применяется ровно один раз, без двойного отражения/смещения.
- [ ] `npm test`, `npm run typecheck`, `npm run build` проходят.
- [ ] `contact-plant` и другие изображения с transform не регрессировали.

## 5. Чек-лист реализации

- [ ] Воспроизвести отсутствие transform на `span.faq-plus`.
- [ ] Добавить `transform` в text-container/button ветки экстрактора.
- [ ] Применить rotation в рендерере с корректным pivot.
- [ ] Add unit-test на rotate + текст.
- [ ] Пересобрать `dist`, импортировать, проверить `compare-faq.png`.
- [ ] Переместить карточку в `/done`.
