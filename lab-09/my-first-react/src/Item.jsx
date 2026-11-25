import { useState } from "react";

export default function Item({ item }) {
  const [count, setCount] = useState(0);

  return (
    <li>
      <strong>{item.title}</strong> — {item.category}, {item.minutes} min{" "}
      <button onClick={() => setCount(count + 1)}>Clicked {count} times</button>
    </li>
  );
}
