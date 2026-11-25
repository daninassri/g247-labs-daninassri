import UserList from "./UserList.jsx";
import PostList from "./PostList.jsx";

export default function App() {
  return (
    <main>
      <h1>Datos desde una API</h1>
      <h2>Usuarios</h2>
      <UserList />
      <h2>Publicaciones</h2>
      <PostList />
    </main>
  );
}
