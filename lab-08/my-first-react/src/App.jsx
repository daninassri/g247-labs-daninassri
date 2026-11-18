import List from "./List.jsx";

export default function App() {
  const items = [
    { id: 1, title: "Tortilla de patatas", minutes: 45, category: "principal" },
    { id: 2, title: "Gazpacho andaluz", minutes: 15, category: "entrante" },
    { id: 3, title: "Paella valenciana", minutes: 90, category: "principal" },
    { id: 4, title: "Crema catalana", minutes: 30, category: "postre" },
    { id: 5, title: "Ensalada de garbanzos", minutes: 20, category: "vegetariano" },
  ];

  return (
    <main>
      <h1>Recetas</h1>
      <List items={items} />
    </main>
  );
}
