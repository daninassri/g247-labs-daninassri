// Formulario de receta (crear y editar). Muestra junto a cada campo la incidencia de Zod.
import { useState } from "react";

const CATEGORIES = ["entrante", "principal", "postre", "vegetariano", "rapida"];

function FieldError({ id, message }) {
  if (!message) return null;
  return (
    <p id={id} className="field-error" role="alert">
      {message}
    </p>
  );
}

export default function RecipeForm({ initial, submitLabel, onSubmit }) {
  const [values, setValues] = useState({
    title: initial?.title ?? "",
    minutes: initial?.minutes ?? "",
    category: initial?.category ?? "",
    favorite: initial?.favorite ?? false,
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const set = (name) => (event) => {
    const value = event.target.type === "checkbox" ? event.target.checked : event.target.value;
    setValues((v) => ({ ...v, [name]: value }));
  };

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setFieldErrors({});
    setFormError(null);
    try {
      await onSubmit({
        title: values.title,
        minutes: values.minutes === "" ? undefined : Number(values.minutes),
        category: values.category === "" ? undefined : values.category,
        favorite: values.favorite,
      });
    } catch (error) {
      setFieldErrors(error.fieldErrors ?? {});
      setFormError(error.message);
      setSubmitting(false);
    }
  }

  const describe = (name) => (fieldErrors[name] ? name + "-error" : undefined);

  return (
    <form onSubmit={handleSubmit} noValidate className="form">
      {formError && (
        <p className="alert" role="alert">
          {formError}
        </p>
      )}

      <div className="field">
        <label htmlFor="title">Título</label>
        <input id="title" type="text" value={values.title} onChange={set("title")}
          aria-invalid={Boolean(fieldErrors.title)} aria-describedby={describe("title")} />
        <FieldError id="title-error" message={fieldErrors.title} />
      </div>

      <div className="field">
        <label htmlFor="minutes">Minutos</label>
        <input id="minutes" type="number" value={values.minutes} onChange={set("minutes")}
          aria-invalid={Boolean(fieldErrors.minutes)} aria-describedby={describe("minutes")} />
        <FieldError id="minutes-error" message={fieldErrors.minutes} />
      </div>

      <div className="field">
        <label htmlFor="category">Categoría</label>
        <select id="category" value={values.category} onChange={set("category")}
          aria-invalid={Boolean(fieldErrors.category)} aria-describedby={describe("category")}>
          <option value="">Elige una categoría</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <FieldError id="category-error" message={fieldErrors.category} />
      </div>

      <div className="field field-check">
        <input id="favorite" type="checkbox" checked={values.favorite} onChange={set("favorite")} />
        <label htmlFor="favorite">Favorita</label>
        <FieldError id="favorite-error" message={fieldErrors.favorite} />
      </div>

      <button type="submit" className="btn" disabled={submitting}>
        {submitting ? "Guardando..." : submitLabel}
      </button>
    </form>
  );
}
