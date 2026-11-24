---
id: TASK-002
title: Спецификация и TypeScript-типы FIR (Figma Intermediate Representation)
status: pending
priority: high
phase: 1
dependencies: [TASK-001]
tags: [types, fir, contract, architecture]
---

# TASK-002: Спецификация и TypeScript-типы FIR

## 1. Описание задачи
Описать строгие TypeScript-интерфейсы промежуточного формата данных FIR (Figma Intermediate Representation) в файле `src/types/fir.ts`. Этот контракт является единым источником правды как для DOM-экстрактора, так и для генератора нод в Figma.

## 2. Связанные разделы документации
- [ARCHITECTURE.md](file:///e:/Projects/Dev/html2design/ARCHITECTURE.md) (Раздел 3: Спецификация контракта данных FIR)
- [KNOWLEDGE_BASE.md](file:///e:/Projects/Dev/html2design/KNOWLEDGE_BASE.md) (Матрица трансляции CSS -> Figma)

## 3. Технические детали и требования к реализации
- Создать файл `src/types/fir.ts`.
- Определить типы:
  - `FIRNodeType`: `'FRAME' | 'TEXT' | 'VECTOR' | 'IMAGE' | 'RECTANGLE'`.
  - `RGBAColor`: `{ r: number; g: number; b: number; a: number }` (значения в диапазоне 0..1).
  - `FIRBounds`: координаты и габариты `{ x, y, width, height }`.
  - `FIRLayout`: свойства Flexbox/Auto Layout (`mode`, `wrap`, `itemSpacing`, `padding`, `primaryAlign`, `counterAlign`).
  - `FIRStyle`: заливки (`backgroundColor`), скругления (`borderRadius`), границы (`borders`), тени (`shadows`), размытие (`blur`).
  - `FIRTextData` и `TextSegment` для инлайн-стилизации текста.
  - `FIRNode`: рекурсивная структура узла со списком дочерних элементов `children?: FIRNode[]`.
- Предоставить хелпер-валидатор (type guard) `isFIRNode(data: unknown): data is FIRNode`.

## 4. Критерии приемки (Definition of Done)
- [ ] Все структуры из Раздела 3 ARCHITECTURE.md полностью перенесены в код без использования типа `any`.
- [ ] Типы экспортируются и доступны для импорта как в экстракторе, так и в коде плагина.
- [ ] Создан юнит-тест или валидатор типов на корректность сборки структуры дерева.

## 5. Чек-лист реализации
- [ ] Создать `src/types/fir.ts`.
- [ ] Описать геометрические и цветовые типы.
- [ ] Описать структуру стилей, раскладки и типографики.
- [ ] Описать рекурсивный узел `FIRNode`.
- [ ] Добавить Type Guards / хелперы валидации.
- [ ] Переместить карточку в `/done`.
