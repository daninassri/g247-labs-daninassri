import { useEffect, useState } from "react";
import { getPosts } from "./api.js";

export default function PostList() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function loadPosts() {
    setLoading(true);
    setError(null);
    try {
      const data = await getPosts();
      setPosts(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // La carga inicial al montar es lo que pide el enunciado
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadPosts();
  }, []);

  let content;
  if (loading) {
    content = <p>Cargando publicaciones...</p>;
  } else if (error) {
    content = <p role="alert">No se pudieron cargar las publicaciones: {error}</p>;
  } else {
    // Se muestran solo las 10 primeras (ver README)
    content = (
      <ul>
        {posts.slice(0, 10).map((post) => (
          <li key={post.id}>
            <strong>{post.title}</strong>
            <p>{post.body}</p>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <section>
      {content}
      <button onClick={loadPosts} disabled={loading}>
        Refresh
      </button>
    </section>
  );
}
