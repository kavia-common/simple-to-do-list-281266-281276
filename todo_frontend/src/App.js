import React, { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import { createTodo, deleteTodo, listTodos, updateTodo } from "./api/todos";

/**
 * Normalizes a backend todo object to what the UI expects.
 * Backend fields can vary; we handle common variants safely.
 */
function normalizeTodo(raw) {
  const id = raw?.id ?? raw?.todo_id ?? raw?._id;
  const title = raw?.title ?? raw?.text ?? "";
  const completed = Boolean(raw?.completed ?? raw?.is_completed ?? raw?.done);
  return { id, title, completed, raw };
}

/**
 * Returns a human-friendly message for fetch errors.
 */
function toErrorMessage(e) {
  if (!e) return "Unknown error";
  if (typeof e === "string") return e;
  return e.message || "Something went wrong";
}

// PUBLIC_INTERFACE
function App() {
  /** Main single-page Todo application UI (CRUD + complete) wired to FastAPI backend. */
  const [todos, setTodos] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [savingIds, setSavingIds] = useState(() => new Set());
  const [error, setError] = useState(null);

  const [newTitle, setNewTitle] = useState("");

  const [editingId, setEditingId] = useState(null);
  const [editingTitle, setEditingTitle] = useState("");

  const inputRef = useRef(null);

  const stats = useMemo(() => {
    const total = todos.length;
    const done = todos.filter((t) => t.completed).length;
    return { total, done, open: total - done };
  }, [todos]);

  async function refresh() {
    setError(null);
    try {
      const res = await listTodos();
      const arr = Array.isArray(res) ? res : res?.items || res?.todos || [];
      setTodos(arr.map(normalizeTodo).filter((t) => t.id !== undefined && t.id !== null));
    } catch (e) {
      setError(toErrorMessage(e));
    } finally {
      setInitialLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  function setSaving(id, isSaving) {
    setSavingIds((prev) => {
      const next = new Set(prev);
      if (isSaving) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  const isBusy = initialLoading;

  // PUBLIC_INTERFACE
  async function handleAdd(e) {
    /** Create a new todo from the input field and refresh the list. */
    e.preventDefault();
    const title = newTitle.trim();
    if (!title) return;

    setError(null);
    try {
      // Optimistic UI: add a temporary placeholder row.
      const tempId = `temp-${Date.now()}`;
      const optimistic = { id: tempId, title, completed: false, raw: null };
      setTodos((prev) => [optimistic, ...prev]);
      setNewTitle("");

      const created = await createTodo({ title });
      const normalized = normalizeTodo(created);

      setTodos((prev) =>
        prev.map((t) => (t.id === tempId ? normalized : t))
      );

      // Focus back to input for rapid entry
      inputRef.current?.focus();
    } catch (e2) {
      setError(toErrorMessage(e2));
      // If creation failed, re-fetch to ensure consistency
      refresh();
    }
  }

  // PUBLIC_INTERFACE
  async function handleToggle(todo) {
    /** Toggle completed state for a given todo. */
    if (!todo?.id) return;
    setError(null);
    setSaving(todo.id, true);

    const nextCompleted = !todo.completed;

    // Optimistic update
    setTodos((prev) =>
      prev.map((t) => (t.id === todo.id ? { ...t, completed: nextCompleted } : t))
    );

    try {
      await updateTodo(todo.id, { completed: nextCompleted });
    } catch (e) {
      setError(toErrorMessage(e));
      // revert by re-fetching truth
      await refresh();
    } finally {
      setSaving(todo.id, false);
    }
  }

  // PUBLIC_INTERFACE
  function startEdit(todo) {
    /** Enter inline edit mode for the specified todo. */
    setEditingId(todo.id);
    setEditingTitle(todo.title);
  }

  // PUBLIC_INTERFACE
  function cancelEdit() {
    /** Exit edit mode without saving changes. */
    setEditingId(null);
    setEditingTitle("");
  }

  // PUBLIC_INTERFACE
  async function saveEdit(todo) {
    /** Persist inline edit changes to the backend. */
    const title = editingTitle.trim();
    if (!title) return;

    setError(null);
    setSaving(todo.id, true);

    // Optimistic update
    setTodos((prev) => prev.map((t) => (t.id === todo.id ? { ...t, title } : t)));

    try {
      await updateTodo(todo.id, { title });
      cancelEdit();
    } catch (e) {
      setError(toErrorMessage(e));
      await refresh();
    } finally {
      setSaving(todo.id, false);
    }
  }

  // PUBLIC_INTERFACE
  async function handleDelete(todo) {
    /** Delete a todo and remove it from the list (optimistic), with rollback on failure. */
    if (!todo?.id) return;
    setError(null);
    setSaving(todo.id, true);

    const before = todos;

    // Optimistic remove
    setTodos((prev) => prev.filter((t) => t.id !== todo.id));

    try {
      await deleteTodo(todo.id);
    } catch (e) {
      setError(toErrorMessage(e));
      setTodos(before);
    } finally {
      setSaving(todo.id, false);
    }
  }

  function isSaving(todoId) {
    return savingIds.has(todoId);
  }

  return (
    <div className="app">
      <div className="container">
        <div className="header">
          <div className="brand">
            <h1 className="title">Todo</h1>
            <p className="subtitle">
              A clean, single-page task list with add, edit, delete, and complete.
            </p>
          </div>

          <div className="badge" aria-label="Task counts">
            <span className="dot" aria-hidden="true" />
            <span>
              {stats.open} open • {stats.done} done • {stats.total} total
            </span>
          </div>
        </div>

        <div className="card" role="region" aria-label="Todo app">
          <div className="cardBody">
            <form className="formRow" onSubmit={handleAdd}>
              <input
                ref={inputRef}
                className="input"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Add a task…"
                aria-label="New todo title"
                disabled={isBusy}
              />
              <button
                className="btn btnPrimary"
                type="submit"
                disabled={isBusy || !newTitle.trim()}
              >
                Add
              </button>
            </form>

            {error ? (
              <div className="alert" role="alert">
                {error}
              </div>
            ) : null}

            <div className="footerHint">
              Tip: Press <span className="kbd">Enter</span> to add. Click a checkbox
              to complete. Use Edit/Delete on each item.
            </div>
          </div>

          <div className="metaRow">
            <div className="metaText">
              {initialLoading ? "Loading tasks…" : "Synced with backend"}
            </div>
            <button className="btn btnGhost btnSmall" onClick={refresh} disabled={initialLoading}>
              Refresh
            </button>
          </div>

          <ul className="list" aria-label="Todo list">
            {initialLoading ? (
              <li className="item">
                <div className="checkbox" aria-hidden="true" />
                <div className="itemTitle">
                  <div className="itemTitleMain">Loading…</div>
                  <div className="itemTitleSub">Please wait</div>
                </div>
                <div className="actions" aria-hidden="true" />
              </li>
            ) : todos.length === 0 ? (
              <li className="item">
                <div className="checkbox" aria-hidden="true" />
                <div className="itemTitle">
                  <div className="itemTitleMain">No tasks yet</div>
                  <div className="itemTitleSub">Add your first todo above</div>
                </div>
                <div className="actions" aria-hidden="true" />
              </li>
            ) : (
              todos.map((t) => {
                const saving = isSaving(t.id);
                const editing = editingId === t.id;

                return (
                  <li className="item" key={t.id}>
                    <button
                      type="button"
                      className={`checkbox ${t.completed ? "checkboxChecked" : ""}`}
                      onClick={() => handleToggle(t)}
                      aria-label={t.completed ? "Mark as not completed" : "Mark as completed"}
                      disabled={saving}
                    >
                      {t.completed ? <span className="checkmark" aria-hidden="true" /> : null}
                    </button>

                    <div className="itemTitle">
                      {editing ? (
                        <div className="inlineEdit">
                          <input
                            className="input"
                            value={editingTitle}
                            onChange={(e) => setEditingTitle(e.target.value)}
                            aria-label="Edit todo title"
                            disabled={saving}
                            onKeyDown={(e) => {
                              if (e.key === "Escape") cancelEdit();
                            }}
                          />
                        </div>
                      ) : (
                        <>
                          <div className={`itemTitleMain ${t.completed ? "itemTitleDone" : ""}`}>
                            {t.title}
                          </div>
                          <div className="itemTitleSub">
                            {t.completed ? "Completed" : "Open"} {saving ? "• Saving…" : ""}
                          </div>
                        </>
                      )}
                    </div>

                    <div className="actions">
                      {editing ? (
                        <>
                          <button
                            type="button"
                            className="btn btnSmall btnPrimary"
                            onClick={() => saveEdit(t)}
                            disabled={saving || !editingTitle.trim()}
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            className="btn btnSmall"
                            onClick={cancelEdit}
                            disabled={saving}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="btn btnSmall"
                            onClick={() => startEdit(t)}
                            disabled={saving}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="btn btnSmall btnDanger"
                            onClick={() => handleDelete(t)}
                            disabled={saving}
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default App;
