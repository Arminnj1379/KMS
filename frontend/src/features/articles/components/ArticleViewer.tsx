import StarterKit from '@tiptap/starter-kit';
import { EditorContent, useEditor } from '@tiptap/react';
import { useEffect } from 'react';

interface Props {
  content: Record<string, unknown>;
}

/** Read-only Tiptap renderer for published/preview display. */
export function ArticleViewer({ content }: Props): JSX.Element {
  const editor = useEditor({
    extensions: [StarterKit],
    content: content as never,
    editable: false,
    editorProps: {
      attributes: {
        class: 'px-1 py-2 text-sm leading-8 prose dark:prose-invert max-w-none',
        dir: 'auto',
      },
    },
  });

  useEffect(() => {
    if (editor && content) {
      editor.commands.setContent(content as never);
    }
  }, [editor, content]);

  useEffect(() => {
    return () => {
      editor?.destroy();
    };
  }, [editor]);

  if (!editor) return <p className="py-8 text-center text-sm text-slate-500">…</p>;

  return (
    <div dir="rtl" className="rounded-xl bg-white dark:bg-slate-950">
      <EditorContent editor={editor} />
    </div>
  );
}
