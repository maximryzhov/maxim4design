# База знаний: Движок конвертации веб-интерфейсов в слои Figma (maxim4design)

Комплексное руководство, архитектурный обзор открытых решений, каталог известных багов, подводных камней и готовых рецептов для реализации конвертера веб-страниц в нативные редактируемые слои Figma.

---

## Содержание
1. [Обзор архитектуры и конвейера](#1-обзор-архитектуры-и-конвейера)
2. [Каталог открытых репозиториев и готовых решений](#2-каталог-открытых-репозиториев-и-готовых-решений)
3. [Каталог багов, краевых случаев (Edge Cases) и готовых решений](#3-каталог-багов-краевых-случаев-edge-cases-и-готовых-решений)
   - [Баг 1: Фатальный краш на шрифтах (`figma.loadFontAsync`)](#баг-1-фатальный-краш-на-шрифтах-figmaloadfontasync)
   - [Баг 2: Черные или сломанные SVG (`currentColor`, CSS-переменные)](#баг-2-черные-или-сломанные-svg-currentcolor-css-переменные)
   - [Баг 3: Разорванный текст при инлайн-стилях (`span`, `b`, `a`)](#баг-3-разорванный-текст-при-инлайн-стилях-span-b-a)
   - [Баг 4: Коллапс пробелов и переносов строк (Whitespace Collapsing)](#баг-4-коллапс-пробелов-и-переносов-строк-whitespace-collapsing)
   - [Баг 5: Игнорирование псевдоэлементов (`::before`, `::after`)](#баг-5-игнорирование-псевдоэлементов-before-after)
   - [Баг 6: CSS Grid и сложные раскладки vs Auto Layout](#баг-6-css-grid-и-сложные-раскладки-vs-auto-layout)
   - [Баг 7: Нарушение иерархии слоев (Stacking Contexts & Z-Index)](#баг-7-нарушение-иерархии-слоев-stacking-contexts--z-index)
   - [Баг 8: Localhost, закрытые страницы и CORS-блокировки](#баг-8-localhost-закрытые-страницы-и-cors-блокировки)
   - [Баг 9: Картинки: background-image, object-fit и асинхронность](#баг-9-картинки-background-image-object-fit-и-асинхронность)
   - [Баг 10: Парсинг теней (box-shadow) и фильтров размытия](#баг-10-парсинг-теней-box-shadow-и-фильтров-размытия)
   - [Баг 11: Границы элементов (Borders с разными сторонами)](#баг-11-границы-элементов-borders-с-разными-сторонами)
4. [Матрица трансляции: CSS -> Figma API](#4-матрица-трансляции-css---figma-api)
5. [Рекомендуемый стек и пошаговый план разработки](#5-рекомендуемый-стек-и-пошаговый-план-разработки)

---

## 1. Обзор архитектуры и конвейера

Процесс конвертации всегда разделен на два изолированных контекста:

```
[ Браузерный контекст (Web Page / Extension / Puppeteer) ]
   │
   ├─ 1. Обход DOM-дерева (DOM Walker)
   ├─ 2. Снятие вычисленных стилей (window.getComputedStyle)
   ├─ 3. Вычисление физических координат (getBoundingClientRect)
   ├─ 4. Запекание ассетов (SVG sanitize, inline base64 images)
   │
   ▼
[ Промежуточный JSON-манифест (Figma Intermediate Representation) ]
   │
   ▼
[ Контекст Figma Plugin (Sandbox Figma API) ]
   │
   ├─ 1. Предзагрузка необходимых шрифтов (Font Loader Queue)
   ├─ 2. Рекурсивное создание нод (FrameNode, TextNode, RectangleNode)
   ├─ 3. Настройка Auto Layout (Flexbox -> layoutMode, gap, padding)
   └─ 4. Заполнение заливок (Fills), обводок (Strokes) и эффектов (Effects)
```

---

## 2. Каталог открытых репозиториев и готовых решений

### 1. `BuilderIO/figma-html` (включает `@builder.io/html-to-figma`)
* **Репозиторий:** [github.com/BuilderIO/figma-html](https://github.com/BuilderIO/figma-html)
* **Назначение:** Официальный открытый монорепозиторий от команды Builder.io. Содержит как конвертер HTML-в-Figma, так и генератор кода из Figma.
* **Что взять:**
  * Код обхода DOM: `packages/core/src/helpers/html-to-figma`.
  * Матрицы трансформации градиентов (`GradientPaint` <-> CSS angles).
  * Логику сжатия и очистки избыточных DOM-нод (например, пропуск скрытых `display: none` элементов).
* **Слабые места:** Не всегда идеально маппит современные свойства Figma (например, `layoutWrap` или свежие типы Auto Layout).

### 2. `figitdesign/web-to-figma` (пакет `@figit/dom-to-figma`)
* **Репозиторий:** [github.com/figitdesign/web-to-figma](https://github.com/figitdesign/web-to-figma)
* **Назначение:** Современная модульная библиотека на TypeScript для конвертации веб-элементов в структуры данных Figma.
* **Что взять:**
  * Чистую систему типов для промежуточного AST (дерева слоев).
  * Корректный парсинг цветов (поддержка `rgba`, `rgb`, `hsl`, hex).
  * Обработку рамок (`border`) и скруглений (`borderRadius`).

### 3. `kbishopzz/HTML-to-Figma`
* **Репозиторий:** [github.com/kbishopzz/HTML-to-Figma](https://github.com/kbishopzz/HTML-to-Figma)
* **Назначение:** Полноценный плагин с бэкендом на Node.js + Puppeteer.
* **Что взять:**
  * Готовый алгоритм трансляции CSS Flexbox в нативный Figma Auto Layout (`layoutMode`, `primaryAxisAlignItems`, `counterAxisAlignItems`, `itemSpacing`).
  * Реализацию передачи данных между внешним скриптом и UI-фреймом плагина.

### 4. `kevicebryan/open-htmltofigma`
* **Репозиторий:** [github.com/kevicebryan/open-htmltofigma](https://github.com/kevicebryan/open-htmltofigma)
* **Назначение:** Открытый проект, созданный для прямого импорта разметки в холст Figma.
* **Что взять:**
  * Минималистичный шаблон плагина для быстрого старта (scaffolding).
  * Логику пользовательского интерфейса (вставка URL / загрузка файла / выбор вьюпорта).

### 5. `brainly/html-sketchapp` (Исторический базис)
* **Репозиторий:** [github.com/brainly/html-sketchapp](https://github.com/brainly/html-sketchapp)
* **Назначение:** Архитектурный прародитель всех современных трансляторов в векторные редакторы.
* **Что взять:**
  * Алгоритм правильного обхода текстовых нод (`TextNode`) с сохранением инлайн-стилей.
  * Математику пересчета координат относительно родительских контейнеров.

---

## 3. Каталог багов, краевых случаев (Edge Cases) и готовых решений

### Баг 1: Фатальный краш на шрифтах (`figma.loadFontAsync`)
* **Проблема:** Веб-страницы используют тысячи кастомных веб-шрифтов (Google Fonts, Adobe Typekit, локальные `.woff2`). Если в плагине попытаться задать шрифт или создать `TextNode` без предварительного вызова `figma.loadFontAsync({ family, style })`, или если запрошенный шрифт отсутствует в системе/каталоге Figma — плагин выбрасывает исключение и останавливает импорт.
* **Решение:**
  1. Реализовать очередь загрузки с безопасным откатом (fallback-цепочкой).
  2. Всегда загружать базовый системный шрифт (например, `Inter`, `Roboto` или `Arial`) при инициализации плагина.
  3. Оборачивать загрузку каждого шрифта в `try/catch`.

```typescript
const DEFAULT_FONT: FontName = { family: "Inter", style: "Regular" };

async function safeLoadFont(family: string, weight: string = "Regular"): Promise<FontName> {
  const targetFont: FontName = { family, style: weight };
  try {
    await figma.loadFontAsync(targetFont);
    return targetFont;
  } catch (err) {
    console.warn(`Шрифт ${family} (${weight}) не найден в Figma. Используем fallback.`);
    await figma.loadFontAsync(DEFAULT_FONT);
    return DEFAULT_FONT;
  }
}
```

---

### Баг 2: Черные или сломанные SVG (`currentColor`, CSS-переменные)
* **Проблема:** Метод `figma.createNodeFromSvg(svgString)` не имеет доступа к CSS-каскаду страницы. Если в SVG используется `fill="currentColor"`, `stroke="currentColor"` или `fill="var(--icon-color)"`, Figma не сможет вычислить цвет и отрисует иконку черной (или выдаст синтаксическую ошибку).
* **Решение:** Перед отправкой SVG в Figma (на этапе парсера в браузере) произвести запекание цвета:
  1. Вычислить реальный цвет родительского элемента через `window.getComputedStyle(element).color`.
  2. Заменить все вхождения `currentColor` и CSS-переменных на полученный `rgb(...)` / `#hex`.

```javascript
function inlineSvgComputedStyles(svgElement) {
  const computed = window.getComputedStyle(svgElement);
  const currentColor = computed.color;
  let svgString = svgElement.outerHTML;

  // Заменяем currentColor на вычисленный цвет
  svgString = svgString.replace(/currentColor/g, currentColor);

  // Резолвим fill/stroke если они не были явно заданы
  if (!svgElement.getAttribute('fill') && !svgElement.style.fill) {
    svgString = svgString.replace('<svg', `<svg fill="${currentColor}"`);
  }
  return svgString;
}
```

---

### Баг 3: Разорванный текст при инлайн-стилях (`span`, `b`, `a`)
* **Проблема:** Пример HTML: `<p>Текст с <b>жирным</b> и <a href="#">ссылкой</a></p>`. Если создавать отдельный `figma.createText()` для каждого дочернего узла, то:
  * Текст потеряет автоматический перенос строк (word wrap).
  * Будет невозможно редактировать абзац как единый блок.
* **Решение:**
  1. Создавать **один общий** `TextNode` для блочного контейнера.
  2. Записывать в `characters` полный объединенный текст.
  3. Использовать API частичной стилизации диапазонов:
     * `node.setRangeFontName(start, end, fontName)`
     * `node.setRangeFills(start, end, fills)`
     * `node.setRangeFontSize(start, end, size)`

---

### Баг 4: Коллапс пробелов и переносов строк (Whitespace Collapsing)
* **Проблема:** В браузере последовательности пробелов и символов переноса строки по умолчанию схлопываются в один пробел (`white-space: normal`). Если взять сырой `node.textContent`, в Figma попадут переносы и табуляции исходного HTML-кода, из-за чего дизайн разъедется.
* **Решение:**
  * Учитывать вычисленное свойство `whiteSpace`:
    * Если `normal` / `nowrap`: заменять `/\s+/g` на одиночный пробел.
    * Если `pre` / `pre-wrap`: сохранять переносы как есть.
  * Предпочитать использование `node.innerText` (в браузере он уже учитывает визуальный рендеринг текста).

---

### Баг 5: Игнорирование псевдоэлементов (`::before`, `::after`)
* **Проблема:** Иконки (FontAwesome, Material Icons), маркеры списков, бейджи и фоновые декорации часто верстаются через `::before` и `::after`. Метод `element.childNodes` их полностью игнорирует.
* **Решение:** При обходе каждого элемента явно проверять наличие псевдоэлементов и создавать для них виртуальные ноды:

```javascript
function extractPseudoElement(element, pseudo) {
  const styles = window.getComputedStyle(element, pseudo);
  const content = styles.content;
  if (!content || content === 'none' || content === '""' || content === "''") {
    return null;
  }
  return {
    type: 'PSEUDO',
    content: content.replace(/^['"]|['"]$/g, ''), // удаляем кавычки
    styles: {
      color: styles.color,
      fontSize: styles.fontSize,
      fontFamily: styles.fontFamily,
      display: styles.display,
      // ...остальные стили
    }
  };
}
```

---

### Баг 6: CSS Grid и сложные раскладки vs Auto Layout
* **Проблема:** В Figma нет полноценной поддержки CSS Grid (двумерной сетки с `grid-template-columns`, `repeat()`, `fr` units).
* **Стратегия решения:**
  * **Flexbox:** 1-в-1 маппится в Figma Auto Layout (горизонтальный или вертикальный режим, `layoutWrap: "WRAP"`).
  * **CSS Grid:**
    * *Стратегия 1 (Надежная, для сохранения визуала):* Родительский контейнер создается как Frame с **абсолютным позиционированием** дочерних элементов по их реальным экранным координатам (`getBoundingClientRect`).
    * *Стратегия 2 (Продвинутая):* Если грид представляет собой простую сетку колонок или строк (1D), конвертировать его во вложенные горизонтальные/вертикальные фреймы Auto Layout.

---

### Баг 7: Нарушение иерархии слоев (Stacking Contexts & Z-Index)
* **Проблема:** Порядок элементов в дереве DOM часто отличается от визуального порядка отрисовки из-за `z-index`, `position: relative / fixed`, `opacity < 1` и `transform`. В Figma порядок добавления (`appendChild`) жестко определяет, какой слой лежит выше.
* **Решение:**
  Перед рекурсивным добавлением детей сортировать их по вычисленному `zIndex`:
  * Элементы с `z-index: auto` или `0` рендерятся в порядке следования в DOM.
  * Элементы с явным `z-index` (положительным или отрицательным) сортируются соответственно.

---

### Баг 8: Localhost, закрытые страницы и CORS-блокировки
* **Проблема:** Если архитектура построена только на бэкенде с headless-браузером (Puppeteer / Playwright), он не сможет получить доступ к:
  * Страницам на `http://localhost:3000` / локальным стендам.
  * Страницам за корпоративным VPN или базовой авторизацией.
  * Страницам, требующим пользовательскую сессию (Cookie).
* **Решение:**
  * Не полагаться исключительно на Puppeteer-сервер.
  * Реализовать **клиентский экстрактор** (Chrome Extension или DevTools Snippet / Bookmarklet), который выполняется прямо в активной вкладке пользователя и экспортирует сериализованный JSON в буфер обмена или через локальный WebSocket.

---

### Баг 9: Картинки: background-image, object-fit и асинхронность
* **Проблема:**
  1. В Figma картинка — это не отдельный тип ноды, а заливка типа `IMAGE` внутри `FrameNode` или `RectangleNode`.
  2. Браузерные ссылки на картинки нельзя просто передать по URL в Figma API; их нужно скачивать и конвертировать в `Uint8Array`.
* **Решение:**
  1. Экстрактор выкачивает картинку или преобразует ее в `ArrayBuffer` / `Uint8Array`.
  2. В Figma создается хэш картинки: `const image = figma.createImage(uint8Array)`.
  3. Применяется заливка с правильным `scaleMode`:
     * `object-fit: cover` -> `scaleMode: "FILL"`
     * `object-fit: contain` -> `scaleMode: "FIT"`
     * `object-fit: none` -> `scaleMode: "CROP"`

---

### Баг 10: Парсинг теней (box-shadow) и фильтров размытия
* **Проблема:** CSS свойство `box-shadow` может содержать множественные тени, параметры `inset`, отрицательные радиусы и цвета в разных форматах.
* **Решение:**
  * Разбирать строку через регулярное выражение на компоненты: `offsetX`, `offsetY`, `blurRadius`, `spread`, `color`, `isInset`.
  * Маппить:
    * Обычная тень -> `DropShadowEffect` (`type: "DROP_SHADOW"`).
    * `inset` тень -> `InnerShadowEffect` (`type: "INNER_SHADOW"`).
    * `backdrop-filter: blur(...)` -> `BackgroundBlurEffect` (`type: "BACKGROUND_BLUR"`).
    * `filter: blur(...)` -> `LayerBlurEffect` (`type: "LAYER_BLUR"`).

---

### Баг 11: Границы элементов (Borders с разными сторонами)
* **Проблема:** В CSS границы для четырех сторон могут быть разными: `border-top`, `border-left` и т.д. До недавнего времени в Figma толщина обводки была единой.
* **Решение:** В современном Figma API поддерживаются индивидуальные веса обводок:
  * `node.strokeTopWeight = parseFloat(styles.borderTopWidth)`
  * `node.strokeBottomWeight = parseFloat(styles.borderBottomWidth)`
  * `node.strokeLeftWeight = parseFloat(styles.borderLeftWidth)`
  * `node.strokeRightWeight = parseFloat(styles.borderRightWidth)`

---

## 4. Матрица трансляции: CSS -> Figma API

| CSS Свойство | Figma API Свойство | Примечание / Значение |
| :--- | :--- | :--- |
| `display: flex; flex-direction: row` | `frame.layoutMode = "HORIZONTAL"` | Горизонтальный Auto Layout |
| `display: flex; flex-direction: column` | `frame.layoutMode = "VERTICAL"` | Вертикальный Auto Layout |
| `flex-wrap: wrap` | `frame.layoutWrap = "WRAP"` | Поддержка переноса Auto Layout |
| `gap: 16px` | `frame.itemSpacing = 16` | Расстояние между элементами |
| `padding: 10px 20px` | `paddingTop`, `paddingBottom`, `paddingLeft`, `paddingRight` | Внутренние отступы |
| `justify-content: center` | `frame.primaryAxisAlignItems = "CENTER"` | Выравнивание по главной оси |
| `justify-content: space-between` | `frame.primaryAxisAlignItems = "SPACE_BETWEEN"` | Авто-растяжение между детьми |
| `align-items: center` | `frame.counterAxisAlignItems = "CENTER"` | Выравнивание по поперечной оси |
| `background-color: rgba(...)` | `frame.fills = [{ type: 'SOLID', color: {r,g,b}, opacity }]` | Нормализация цвета (0..1) |
| `border-radius: 8px` | `frame.cornerRadius = 8` | Общее скругление |
| `overflow: hidden` | `frame.clipsContent = true` | Обрезка по границам фрейма |
| `opacity: 0.8` | `node.opacity = 0.8` | Прозрачность слоя |
| `font-size: 16px` | `textNode.fontSize = 16` | Размер шрифта |
| `font-weight: 700` | `fontName.style = "Bold"` | Маппинг числового веса в стиль |
| `line-height: 24px` | `textNode.lineHeight = { value: 24, unit: 'PIXELS' }` | Межстрочный интервал |
| `letter-spacing: 0.5px` | `textNode.letterSpacing = { value: 0.5, unit: 'PIXELS' }` | Межбуквенный интервал |

---

## 5. Рекомендуемый стек и пошаговый план разработки

### Рекомендуемый стек
* **Язык:** TypeScript (строгая типизация между экстрактором и плагином критически важна).
* **Сборщик:** `esbuild` или `vite` (мгновенная сборка кода плагина).
* **Figma Typings:** `@figma/plugin-typings`.
* **Клиентский сборщик:** Легковесный Bookmarklet / Chrome Extension Content Script (без тяжелых зависимостей).

### Итеративный план разработки (MVP за 3 шага)

1. **Шаг 1: Минимальный экстрактор DOM (DevTools Snippet)**
   * Скрипт в консоли браузера выбирает узел `$0` (выделенный элемент).
   * Собирает JSON: `tag`, `text`, `styles` (цвета, размеры, flex-параметры).
   * Копирует JSON в буфер (`navigator.clipboard.writeText`).

2. **Шаг 2: Базовый импортер в Figma**
   * Плагин с простым окном (UI iframe) и кнопкой «Вставить из буфера».
   * Фоллбек-загрузчик шрифта `Inter`.
   * Рекурсивная генерация нод:
     * Если есть дочерние элементы -> `figma.createFrame()`.
     * Если текстовый лист -> `figma.createText()`.

3. **Шаг 3: Наращивание функционала**
   * Включение Auto Layout для flex-контейнеров.
   * Добавление конвертации картинок в `Uint8Array`.
   * Поддержка `figma.createNodeFromSvg` с санитизацией `currentColor`.
