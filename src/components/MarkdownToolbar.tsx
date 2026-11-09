import React from 'react';
import { 
  Bold, 
  Italic, 
  Heading2, 
  List, 
  ListOrdered, 
  CheckSquare, 
  Quote, 
  Code, 
  Link as LinkIcon, 
  Table as TableIcon,
  Minus
} from 'lucide-react';

interface MarkdownToolbarProps {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (newValue: string) => void;
}

export const MarkdownToolbar: React.FC<MarkdownToolbarProps> = ({
  textareaRef,
  value,
  onChange,
}) => {
  const applyFormat = (prefix: string, suffix: string = '', defaultPlaceholder: string = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);
    const textToInsert = selectedText || defaultPlaceholder;

    const newText = value.substring(0, start) + prefix + textToInsert + suffix + value.substring(end);
    onChange(newText);

    // 重新聚焦并选中文本
    setTimeout(() => {
      textarea.focus();
      const newCursorStart = start + prefix.length;
      const newCursorEnd = newCursorStart + textToInsert.length;
      textarea.setSelectionRange(newCursorStart, newCursorEnd);
    }, 10);
  };

  const applyLinePrefix = (prefix: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = value.substring(0, start);
    const after = value.substring(end);

    // 检查是否已经在行首
    const lastNewline = before.lastIndexOf('\n');
    const lineStart = lastNewline === -1 ? 0 : lastNewline + 1;
    const currentLineBefore = value.substring(lineStart, start);

    let newText = '';
    let newCursorPos = 0;

    if (currentLineBefore.trim() === '') {
      newText = value.substring(0, lineStart) + prefix + value.substring(start);
      newCursorPos = lineStart + prefix.length;
    } else {
      newText = value.substring(0, start) + '\n' + prefix + after;
      newCursorPos = start + 1 + prefix.length;
    }

    onChange(newText);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 10);
  };

  const insertTable = () => {
    const tableTemplate = '\n| 标题 1 | 标题 2 | 标题 3 |\n| --- | --- | --- |\n| 内容 1 | 内容 2 | 内容 3 |\n';
    applyFormat('', '', tableTemplate);
  };

  return (
    <div className="flex items-center flex-wrap gap-0.5 p-1 bg-slate-50 border border-slate-200/80 rounded-lg text-slate-600 mb-2">
      <button
        type="button"
        onClick={() => applyFormat('**', '**', '加粗文本')}
        className="p-1.5 hover:bg-white hover:text-blue-600 rounded text-slate-600 transition-colors"
        title="加粗 (**文本**)"
      >
        <Bold size={13} />
      </button>

      <button
        type="button"
        onClick={() => applyFormat('*', '*', '斜体文本')}
        className="p-1.5 hover:bg-white hover:text-blue-600 rounded text-slate-600 transition-colors"
        title="斜体 (*文本*)"
      >
        <Italic size={13} />
      </button>

      <button
        type="button"
        onClick={() => applyLinePrefix('### ')}
        className="p-1.5 hover:bg-white hover:text-blue-600 rounded text-slate-600 transition-colors"
        title="标题 (### 三级标题)"
      >
        <Heading2 size={13} />
      </button>

      <span className="w-[1px] h-3.5 bg-slate-200 mx-0.5" />

      <button
        type="button"
        onClick={() => applyLinePrefix('- [ ] ')}
        className="p-1.5 hover:bg-white hover:text-blue-600 rounded text-slate-600 transition-colors"
        title="待办清单 (- [ ] 项)"
      >
        <CheckSquare size={13} />
      </button>

      <button
        type="button"
        onClick={() => applyLinePrefix('- ')}
        className="p-1.5 hover:bg-white hover:text-blue-600 rounded text-slate-600 transition-colors"
        title="无序列表 (- 列表项)"
      >
        <List size={13} />
      </button>

      <button
        type="button"
        onClick={() => applyLinePrefix('1. ')}
        className="p-1.5 hover:bg-white hover:text-blue-600 rounded text-slate-600 transition-colors"
        title="有序列表 (1. 列表项)"
      >
        <ListOrdered size={13} />
      </button>

      <button
        type="button"
        onClick={() => applyLinePrefix('> ')}
        className="p-1.5 hover:bg-white hover:text-blue-600 rounded text-slate-600 transition-colors"
        title="引用块 (> 引用内容)"
      >
        <Quote size={13} />
      </button>

      <span className="w-[1px] h-3.5 bg-slate-200 mx-0.5" />

      <button
        type="button"
        onClick={() => applyFormat('`', '`', 'code')}
        className="p-1.5 hover:bg-white hover:text-blue-600 rounded text-slate-600 transition-colors"
        title="行内代码 (`code`)"
      >
        <Code size={13} />
      </button>

      <button
        type="button"
        onClick={() => applyFormat('\n```\n', '\n```\n', '代码块内容')}
        className="px-1.5 py-1 text-[11px] font-mono hover:bg-white hover:text-blue-600 rounded text-slate-600 transition-colors"
        title="多行代码块 (```)"
      >
        {'```'}
      </button>

      <button
        type="button"
        onClick={() => applyFormat('[', '](https://)', '链接文字')}
        className="p-1.5 hover:bg-white hover:text-blue-600 rounded text-slate-600 transition-colors"
        title="超链接 ([文字](URL))"
      >
        <LinkIcon size={13} />
      </button>

      <button
        type="button"
        onClick={insertTable}
        className="p-1.5 hover:bg-white hover:text-blue-600 rounded text-slate-600 transition-colors"
        title="插入 Markdown 表格"
      >
        <TableIcon size={13} />
      </button>

      <button
        type="button"
        onClick={() => applyLinePrefix('---\n')}
        className="p-1.5 hover:bg-white hover:text-blue-600 rounded text-slate-600 transition-colors"
        title="水平分割线 (---)"
      >
        <Minus size={13} />
      </button>
    </div>
  );
};
