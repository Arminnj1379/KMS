import StarterKit from '@tiptap/starter-kit';
import { EditorContent, useEditor } from '@tiptap/react';
import { useEffect, useRef } from 'react';
import {
  Bold,
  Code2,
  Heading2,
  Heading3,
  Italic,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Strikethrough,
  Undo2,
} from 'lucide-react';
import { cn } from '../../../shared/lib/cn';

interface Props {
  initialContent?: Record<string, unknown> | null;
  onChange?: (json: Record<string, unknown>, text: string) => void;
  autofocus?: boolean;
}

function ToolbarButton({
  onClick,
  active,
  label,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  label: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active ?? false}
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      className={cn('toolbtn', active && 'toolbtn-active')}
    >
      {children}
    </button>
  );
}

const iconProps = { size: 16, strokeWidth: 2 } as const;

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

  const toggle = (fn: () => void) => () => fn();

  return (
    <div className="surface-flat tiptap-wrap overflow-hidden">
      <div dir="ltr" className="hairline-b flex flex-wrap items-center gap-0.5 bg-slate-50/80 px-2 py-1.5 dark:bg-slate-900">
        <ToolbarButton onClick={toggle(() => editor.chain().focus().toggleBold().run())} active={editor.isActive('bold')} label="درشت">
          <Bold {...iconProps} />
        </ToolbarButton>
        <ToolbarButton onClick={toggle(() => editor.chain().focus().toggleItalic().run())} active={editor.isActive('italic')} label="کج">
          <Italic {...iconProps} />
        </ToolbarButton>
        <ToolbarButton onClick={toggle(() => editor.chain().focus().toggleStrike().run())} active={editor.isActive('strike')} label="خط‌خورده">
          <Strikethrough {...iconProps} />
        </ToolbarButton>
        <span className="mx-1 h-5 w-px bg-slate-200 dark:bg-slate-700" aria-hidden />
        <ToolbarButton onClick={toggle(() => editor.chain().focus().toggleHeading({ level: 2 }).run())} active={editor.isActive('heading', { level: 2 })} label="تیتر ۲">
          <Heading2 {...iconProps} />
        </ToolbarButton>
        <ToolbarButton onClick={toggle(() => editor.chain().focus().toggleHeading({ level: 3 }).run())} active={editor.isActive('heading', { level: 3 })} label="تیتر ۳">
          <Heading3 {...iconProps} />
        </ToolbarButton>
        <span className="mx-1 h-5 w-px bg-slate-200 dark:bg-slate-700" aria-hidden />
        <ToolbarButton onClick={toggle(() => editor.chain().focus().toggleBulletList().run())} active={editor.isActive('bulletList')} label="فهرست">
          <List {...iconProps} />
        </ToolbarButton>
        <ToolbarButton onClick={toggle(() => editor.chain().focus().toggleOrderedList().run())} active={editor.isActive('orderedList')} label="فهرست شماره‌دار">
          <ListOrdered {...iconProps} />
        </ToolbarButton>
        <ToolbarButton onClick={toggle(() => editor.chain().focus().toggleBlockquote().run())} active={editor.isActive('blockquote')} label="نقل‌قول">
          <Quote {...iconProps} />
        </ToolbarButton>
        <ToolbarButton onClick={toggle(() => editor.chain().focus().toggleCodeBlock().run())} active={editor.isActive('codeBlock')} label="کد">
          <Code2 {...iconProps} />
        </ToolbarButton>
        <span className="mx-1 h-5 w-px bg-slate-200 dark:bg-slate-700" aria-hidden />
        <ToolbarButton onClick={toggle(() => editor.chain().focus().undo().run())} label="بازگردانی">
          <Undo2 {...iconProps} />
        </ToolbarButton>
        <ToolbarButton onClick={toggle(() => editor.chain().focus().redo().run())} label="تکرار">
          <Redo2 {...iconProps} />
        </ToolbarButton>
      </div>
      <div dir="rtl">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
