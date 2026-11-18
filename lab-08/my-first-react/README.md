# Lab 8 — Primeros componentes React

Proyecto Vite + React con un árbol de componentes `App → List → Item`.
Tema propio: recetas.

## Cómo ejecutarlo

```bash
npm install
npm run dev
```

## Componentes

- `App.jsx`: guarda el array de cinco recetas, muestra el título y pasa el array a `List` con `items`.
- `List.jsx`: recibe `items` y crea un `Item` por receta con `.map()`, usando `key={item.id}`.
- `Item.jsx`: recibe `item`, muestra título, categoría y minutos, y contiene el contador con `useState`.

## Pregunta: si el contador se sitúa dentro de `Item`, ¿cuántos contadores independientes existen?

Existen cinco contadores independientes, uno por cada `Item` que se renderiza, porque cada instancia del componente tiene su propio estado.
