# Lab 9 — Hooks en la práctica: carga, éxito y error

Proyecto Vite + React (continuación del Lab 8) que carga datos de la API pública JSONPlaceholder con Axios.

## Cómo ejecutarlo

    npm install
    cp .env.example .env.local
    npm run dev

`.env.local` define `VITE_API_URL`, la dirección base de la API, y no se entrega al repositorio.

## Componentes

- `src/api.js`: cliente Axios con `baseURL` tomada de `VITE_API_URL` y las funciones `getUsers()` y `getPosts()`.
- `src/UserList.jsx`: carga `/users` con los estados `users`, `loading` y `error`, y muestra `name` y `email`.
- `src/PostList.jsx`: aplica el mismo patrón a `/posts` y muestra `title` y `body`.
- `src/App.jsx`: renderiza las dos listas, cada una con su `<h2>`. Sus peticiones son independientes.

Cada lista carga los datos con `useEffect` al montarse y tiene un botón `Refresh` que repite la petición, también tras un error. Mientras hay una petición en curso, el botón está deshabilitado.

## Cuántas publicaciones se muestran

Se muestran solo las diez primeras de las cien publicaciones, para que la página sea breve y legible sin añadir paginación.
