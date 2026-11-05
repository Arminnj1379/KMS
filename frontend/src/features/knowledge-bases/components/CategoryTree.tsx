import { useState } from 'react';
import { Folder, FolderPlus, Pencil, Plus, Trash2 } from 'lucide-react';
import { t } from '../../../i18n';
import { toApiMessage } from '../../../shared/lib/api-client';
import { useToast } from '../../../shared/ui/Toast';
import { Button } from '../../../shared/ui/Button';
import { ConfirmDialog, Dialog, DialogFooter } from '../../../shared/ui/Dialog';
import { Field, Select, TextInput } from '../../../shared/ui/Field';
import { EmptyState } from '../../../shared/ui/Feedback';
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
  const toast = useToast();
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [editing, setEditing] = useState<CategoryNode | null>(null);
  const [deleting, setDeleting] = useState<CategoryNode | null>(null);
  const [form, setForm] = useState({ title: '', slug: '', description: '', parentId: '' });
  const all = flatten(nodes);

  function openAdd(parentId: string | null): void {
    setAddingTo(parentId ?? 'root');
    setEditing(null);
    setForm({ title: '', slug: '', description: '', parentId: parentId ?? '' });
  }

  function openEdit(node: CategoryNode): void {
    setEditing(node);
    setAddingTo(null);
    setForm({ title: node.title, slug: node.slug, description: node.description ?? '', parentId: node.parentId ?? '' });
  }

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
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
        toast.success(t('common.savedToast'));
        setEditing(null);
      } else {
        await create.mutateAsync({
          title: form.title,
          slug: form.slug,
          description: form.description || undefined,
          parentId: form.parentId === '' ? undefined : form.parentId,
        });
        toast.success(t('kb.categoryCreatedToast'));
        setAddingTo(null);
      }
    } catch (err) {
      toast.error(toApiMessage(err, t('common.error')));
    }
  }

  async function onDelete(): Promise<void> {
    if (!deleting) return;
    try {
      await remove.mutateAsync(deleting.id);
      toast.success(t('kb.categoryDeletedToast'));
      setDeleting(null);
    } catch (err) {
      toast.error(toApiMessage(err, t('common.error')));
    }
  }

  function renderNodes(list: CategoryNode[], depth: number): JSX.Element[] {
    return list.map((n) => (
      <li key={n.id}>
        <div
          className="group flex items-center gap-2.5 rounded-control px-3 py-2 text-[14px] transition-colors hover:bg-surface-muted"
          style={{ marginInlineStart: depth * 22 }}
        >
          <Folder size={16} className="shrink-0 text-accent" aria-hidden />
          <span className="min-w-0 truncate font-semibold">{n.title}</span>
          <span dir="ltr" className="hidden min-w-0 truncate font-mono text-[12px] text-ink-4 sm:block">
            {n.path}
          </span>
          {canManage && (
            <span className="ms-auto flex shrink-0 gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
              <Button variant="ghost" size="icon-sm" onClick={() => openAdd(n.id)} title={t('kb.addChild')} aria-label={t('kb.addChild')}>
                <FolderPlus size={15} />
              </Button>
              <Button variant="ghost" size="icon-sm" onClick={() => openEdit(n)} title={t('common.edit')} aria-label={t('common.edit')}>
                <Pencil size={14} />
              </Button>
              <Button variant="ghost" size="icon-sm" onClick={() => setDeleting(n)} title={t('kb.delete')} aria-label={t('kb.delete')} className="hover:text-danger">
                <Trash2 size={14} />
              </Button>
            </span>
          )}
        </div>
        {n.children.length > 0 && <ul>{renderNodes(n.children, depth + 1)}</ul>}
      </li>
    ));
  }

  const showForm = addingTo !== null || editing !== null;
  const parentOptions = all.filter((c) => !editing || (c.id !== editing.id && !c.path.startsWith(`${editing.path}/`)));

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <Button variant="secondary" size="sm" onClick={() => openAdd(null)}>
            <Plus size={15} />
            {t('kb.addCategory')}
          </Button>
        </div>
      )}
      {nodes.length === 0 && <EmptyState icon={Folder} title={t('kb.noCategories')} hint={t('kb.noCategoriesHint')} className="py-8" />}
      {nodes.length > 0 && <ul className="space-y-0.5">{renderNodes(nodes, 0)}</ul>}

      <Dialog
        open={showForm}
        title={editing ? t('common.edit') : addingTo === 'root' ? t('kb.addCategory') : t('kb.addChild')}
        onClose={() => {
          setAddingTo(null);
          setEditing(null);
        }}
      >
        <form onSubmit={(e) => void submit(e)} className="space-y-5" noValidate>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label={t('kb.categoryTitle')}>
              <TextInput value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
            </Field>
            {!editing && (
              <Field label={t('kb.slug')}>
                <TextInput value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} required dir="ltr" pattern="[a-z0-9]+(-[a-z0-9]+)*" />
              </Field>
            )}
          </div>
          <Field label={t('kb.parent')}>
            <Select value={form.parentId} onChange={(e) => setForm({ ...form, parentId: e.target.value })}>
              <option value="">{t('kb.root')}</option>
              {parentOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.path}
                </option>
              ))}
            </Select>
          </Field>
          {(create.isError || update.isError) && (
            <p className="form-error">{toApiMessage(create.error ?? update.error, t('common.error'))}</p>
          )}
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setAddingTo(null);
                setEditing(null);
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button type="submit" variant="primary" disabled={create.isPending || update.isPending}>
              {t('common.save')}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>

      <ConfirmDialog
        open={deleting !== null}
        title={t('kb.delete')}
        body={t('kb.categoryDeleteConfirm', { title: deleting?.title ?? '' })}
        confirmLabel={t('kb.delete')}
        danger
        pending={remove.isPending}
        onClose={() => setDeleting(null)}
        onConfirm={() => void onDelete()}
      />
    </div>
  );
}
