import StarterKit from '@tiptap/starter-kit';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import { useEffect, useRef, type ReactNode } from 'react';
import {
  Bold,
  Code2,
  Heading2,
  Heading3,
  Italic,
  List,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  Strikethrough,
  Undo2,
} from 'lucide-react';
import { t, type I18nKey } from '../../../i18n';
import { cn } from '../../../shared/lib/cn';

interface Props {
  initialContent?: Record<string, unknown> | null;
  onChange?: (json: Record<string, unknown>, text: string) => void;
  autofocus?: boolean;
}

function ToolButton({
  onClick,
  active,
  label,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  label: string;
  children: ReactNode;
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

function Separator(): JSX.Element {
  return <span className="toolsep" aria-hidden />;
}

const iconProps = { size: 16, strokeWidth: 1.9 } as const;

/** Writing surface. Tiptap JSON is the source of truth; HTML is never stored. */
export function ArticleEditor({ initialContent, onChange, autofocus }: Props): JSX.Element {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const editor = useEditor({
    extensions: [StarterKit],
    content: (initialContent ?? { type: 'doc', content: [{ type: 'paragraph' }] }) as never,
    autofocus: autofocus ?? false,
    editorProps: {
      attributes: {
        class: 'kms-prose',
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

  if (!editor) return <div className="min-h-[460px]" aria-hidden />;

  return (
    <div className="tiptap-wrap">
      <Toolbar editor={editor} />
      <div className="mt-6">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }): JSX.Element {
  const label = (key: I18nKey): string => t(key);
  return (
    <div role="toolbar" aria-label={label('editor.toolbar')} className="flex flex-wrap items-center gap-0.5 border-b border-line pb-2">
      <ToolButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} label={label('editor.bold')}>
        <Bold {...iconProps} />
      </ToolButton>
      <ToolButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} label={label('editor.italic')}>
        <Italic {...iconProps} />
      </ToolButton>
      <ToolButton onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} label={label('editor.strike')}>
        <Strikethrough {...iconProps} />
      </ToolButton>
      <Separator />
      <ToolButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        active={editor.isActive('heading', { level: 2 })}
        label={label('editor.heading2')}
      >
        <Heading2 {...iconProps} />
      </ToolButton>
      <ToolButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        active={editor.isActive('heading', { level: 3 })}
        label={label('editor.heading3')}
      >
        <Heading3 {...iconProps} />
      </ToolButton>
      <Separator />
      <ToolButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} label={label('editor.bulletList')}>
        <List {...iconProps} />
      </ToolButton>
      <ToolButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} label={label('editor.orderedList')}>
        <ListOrdered {...iconProps} />
      </ToolButton>
      <ToolButton onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} label={label('editor.quote')}>
        <Quote {...iconProps} />
      </ToolButton>
      <ToolButton onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive('codeBlock')} label={label('editor.codeBlock')}>
        <Code2 {...iconProps} />
      </ToolButton>
      <ToolButton onClick={() => editor.chain().focus().setHorizontalRule().run()} label={label('editor.divider')}>
        <Minus {...iconProps} />
      </ToolButton>
      <span className="flex-1" />
      <ToolButton onClick={() => editor.chain().focus().undo().run()} label={label('editor.undo')}>
        <Undo2 {...iconProps} className="rtl:-scale-x-100" />
      </ToolButton>
      <ToolButton onClick={() => editor.chain().focus().redo().run()} label={label('editor.redo')}>
        <Redo2 {...iconProps} className="rtl:-scale-x-100" />
      </ToolButton>
    </div>
  );
}
