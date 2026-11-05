import StarterKit from '@tiptap/starter-kit';
import { EditorContent, useEditor } from '@tiptap/react';
import { useEffect } from 'react';

interface Props {
  content: Record<string, unknown>;
}

/** Read-only Tiptap renderer. Shares the `kms-prose` typography with the editor. */
export function ArticleViewer({ content }: Props): JSX.Element | null {
  const editor = useEditor({
    extensions: [StarterKit],
    content: content as never,
    editable: false,
    editorProps: {
      attributes: {
        class: 'kms-prose',
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

  if (!editor) return null;

  return (
    <div dir="rtl">
      <EditorContent editor={editor} />
    </div>
  );
}
