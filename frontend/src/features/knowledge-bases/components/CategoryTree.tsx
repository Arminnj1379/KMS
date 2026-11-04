import { useState } from 'react';
import { t } from '../../../i18n';
import { toApiMessage } from '../../../shared/lib/api-client';
import { useCreateCategory, useDeleteCategory, useUpdateCategory } from '../hooks';
import type { CategoryNode } from '../api';

interface Props {
  kbId: string;
  nodes: CategoryNode[];
  canManage: boolean;
}

function flatten(nodes: CategoryNode[], out: CategoryNode[] = []): CategoryNode[] {
  for (const n of nodes) {
    out.push(n);
    flatten(n.children, out);
  }
  return out;
}

export function CategoryTree({ kbId, nodes, canManage }: Props): JSX.Element {
  const create = useCreateCategory(kbId);
  const update = useUpdateCategory(kbId);
  const remove = useDeleteCategory(kbId);
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [editing, setEditing] = useState<CategoryNode | null>(null);
  const [form, setForm] = useState({ title: '', slug: '', description: '', parentId: '' });
  const [error, setError] = useState<string | null>(null);
  const all = flatten(nodes);

  function openAdd(parentId: string | null): void {
    setAddingTo(parentId ?? 'root');
    setEditing(null);
    setForm({ title: '', slug: '', description: '', parentId: parentId ?? '' });
    setError(null);
  }

  function openEdit(node: CategoryNode): void {
    setEditing(node);
    setAddingTo(null);
    setForm({ title: node.title, slug: node.slug, description: node.description ?? '', parentId: node.parentId ?? '' });
    setError(null);
  }

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    try {
      if (editing) {
        await update.mutateAsync({
          catId: editing.id,
          input: {
            title: form.title,
            description: form.description || undefined,
            parentId: form.parentId === '' ? null : form.parentId,
          },
        });
        setEditing(null);
      } else {
        await create.mutateAsync({
          title: form.title,
          slug: form.slug,
          description: form.description || undefined,
          parentId: form.parentId === '' ? undefined : form.parentId,
        });
        setAddingTo(null);
      }
    } catch (err) {
      setError(toApiMessage(err, t('common.error')));
    }
  }

  async function onDelete(node: CategoryNode): Promise<void> {
    setError(null);
    try {
      await remove.mutateAsync(node.id);
    } catch (err) {
      setError(toApiMessage(err, t('common.error')));
    }
  }

  function renderNodes(list: CategoryNode[], depth: number): JSX.Element[] {
    return list.map((n) => (
      <li key={n.id} className="mt-1">
        <div
          className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm dark:border-slate-800"
          style={{ marginInlineStart: depth * 16 }}
        >
          <span className="font-medium">{n.title}</span>
          <span dir="ltr" className="text-xs text-slate-400">{n.path}</span>
          {canManage && (
            <span className="ms-auto flex gap-1">
              <button
                type="button"
                onClick={() => openAdd(n.id)}
                className="rounded border border-slate-300 px-2 py-0.5 text-xs dark:border-slate-700"
              >
                {t('kb.addChild')}
              </button>
              <button
                type="button"
                onClick={() => openEdit(n)}
                className="rounded border border-slate-300 px-2 py-0.5 text-xs dark:border-slate-700"
              >
                {t('common.edit')}
              </button>
              <button
                type="button"
                onClick={() => void onDelete(n)}
                className="rounded border border-red-300 px-2 py-0.5 text-xs text-red-600 dark:border-red-900"
              >
                {t('kb.delete')}
              </button>
            </span>
          )}
        </div>
        {n.children.length > 0 && <ul>{renderNodes(n.children, depth + 1)}</ul>}
      </li>
    ));
  }

  const showForm = addingTo !== null || editing !== null;

  return (
    <div>
      {canManage && (
        <div className="mb-3">
          <button
            type="button"
            onClick={() => openAdd(null)}
            className="rounded-lg bg-brand-500 px-3 py-1.5 text-sm font-semibold text-white"
          >
            {t('kb.addCategory')}
          </button>
        </div>
      )}
      {nodes.length === 0 && <p className="text-sm text-slate-500">{t('common.empty')}</p>}
      <ul>{renderNodes(nodes, 0)}</ul>
      {showForm && (
        <form onSubmit={(e) => void submit(e)} className="mt-4 space-y-3 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              {t('kb.categoryTitle')}
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </label>
            {!editing && (
              <label className="block text-sm">
                {t('kb.slug')}
                <input
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                  required
                  dir="ltr"
                  pattern="[a-z0-9]+(-[a-z0-9]+)*"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950"
                />
              </label>
            )}
            <label className="block text-sm">
              {t('kb.parent')}
              <select
                value={form.parentId}
                onChange={(e) => setForm({ ...form, parentId: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="">{t('kb.root')}</option>
                {all
                  .filter((c) => !editing || (c.id !== editing.id && !c.path.startsWith(`${editing.path}/`)))
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.path}
                    </option>
                  ))}
              </select>
            </label>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={create.isPending || update.isPending}
              className="rounded-lg bg-brand-500 px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {t('common.save')}
            </button>
            <button
              type="button"
              onClick={() => {
                setAddingTo(null);
                setEditing(null);
              }}
              className="rounded-lg border border-slate-300 px-4 py-1.5 text-sm dark:border-slate-700"
            >
              {t('common.cancel')}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
