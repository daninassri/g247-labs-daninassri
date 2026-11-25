import { useEffect, useState } from "react";
import { getUsers } from "./api.js";

export default function UserList() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function loadUsers() {
    setLoading(true);
    setError(null);
    try {
      const data = await getUsers();
      setUsers(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // La carga inicial al montar es lo que pide el enunciado
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadUsers();
  }, []);

  let content;
  if (loading) {
    content = <p>Cargando usuarios...</p>;
  } else if (error) {
    content = <p role="alert">No se pudieron cargar los usuarios: {error}</p>;
  } else {
    content = (
      <ul>
        {users.map((user) => (
          <li key={user.id}>
            <strong>{user.name}</strong> — {user.email}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <section>
      {content}
      <button onClick={loadUsers} disabled={loading}>
        Refresh
      </button>
    </section>
  );
}
