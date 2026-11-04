import StarterKit from '@tiptap/starter-kit';
import { EditorContent, useEditor } from '@tiptap/react';
import { useEffect, useRef } from 'react';

interface Props {
  initialContent?: Record<string, unknown> | null;
  onChange?: (json: Record<string, unknown>, text: string) => void;
  autofocus?: boolean;
}

function ToolbarButton({
  onClick,
  active,
  label,
}: {
  onClick: () => void;
  active?: boolean;
  label: string;
}): JSX.Element {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      className={`rounded-md px-2 py-1 text-sm ${active ? 'bg-brand-500 text-white' : 'hover:bg-slate-200 dark:hover:bg-slate-800'}`}
    >
      {label}
    </button>
  );
}

/** Persian-first Tiptap editor (JSON is the source of truth; HTML never stored). */
export function ArticleEditor({ initialContent, onChange, autofocus }: Props): JSX.Element {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const editor = useEditor({
    extensions: [StarterKit],
    content: (initialContent ?? { type: 'doc', content: [{ type: 'paragraph' }] }) as never,
    autofocus: autofocus ?? false,
    editorProps: {
      attributes: {
        class: 'min-h-64 px-4 py-3 text-sm leading-7 outline-none prose dark:prose-invert max-w-none',
        dir: 'auto',
      },
    },
    onUpdate: ({ editor: e }) => {
      onChangeRef.current?.(e.getJSON() as Record<string, unknown>, e.getText());
    },
  });

  useEffect(() => {
    return () => {
      editor?.destroy();
    };
  }, [editor]);

  if (!editor) return <p className="py-8 text-center text-sm text-slate-500">…</p>;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-300 dark:border-slate-700">
      <div dir="ltr" className="flex flex-wrap items-center gap-1 border-b border-slate-200 bg-slate-50 px-2 py-1.5 dark:border-slate-800 dark:bg-slate-900">
        <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} label="B" />
        <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} label="I" />
        <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} label="S" />
        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} label="H2" />
        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} label="H3" />
        <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} label="• List" />
        <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} label="1. List" />
        <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} label="❝" />
        <ToolbarButton onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive('codeBlock')} label="{ }" />
        <ToolbarButton onClick={() => editor.chain().focus().undo().run()} label="↩" />
        <ToolbarButton onClick={() => editor.chain().focus().redo().run()} label="↪" />
      </div>
      <div dir="rtl" className="bg-white dark:bg-slate-950">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
