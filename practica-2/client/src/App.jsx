import { Route, Routes } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import NotFoundPage from "./pages/NotFoundPage.jsx";
import RecipeDetailPage from "./pages/RecipeDetailPage.jsx";
import RecipeEditPage from "./pages/RecipeEditPage.jsx";
import RecipeListPage from "./pages/RecipeListPage.jsx";
import RecipeNewPage from "./pages/RecipeNewPage.jsx";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<RecipeListPage />} />
        <Route path="recipes/:id" element={<RecipeDetailPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route path="recipes/new" element={<RecipeNewPage />} />
          <Route path="recipes/:id/edit" element={<RecipeEditPage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
