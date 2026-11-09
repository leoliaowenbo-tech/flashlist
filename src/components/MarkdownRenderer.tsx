import React, { useMemo } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { Edit3, FileText } from 'lucide-react';

interface MarkdownRendererProps {
  content: string;
  onClickEdit?: () => void;
  onToggleCheckbox?: (checkboxIndex: number) => void;
  className?: string;
  placeholder?: string;
}

/**
 * 切换 Markdown 文本中第 N 个任务复选框 (- [ ] <-> - [x])
 */
export function toggleMarkdownCheckbox(markdown: string, checkboxIndex: number): string {
  let currentIndex = 0;
  const regex = /^(\s*[-*+]\s+\[)([ xX])(\]\s+.*)$/gm;
  return markdown.replace(regex, (match, prefix, check, suffix) => {
    if (currentIndex === checkboxIndex) {
      currentIndex++;
      return prefix + (check.toLowerCase() === 'x' ? ' ' : 'x') + suffix;
    }
    currentIndex++;
    return match;
  });
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  onClickEdit,
  onToggleCheckbox,
  className = '',
  placeholder = '暂无详细描述，点击进入编辑模式以 Markdown 格式记录...',
}) => {
  // 解析并净化 HTML
  const renderedHtml = useMemo(() => {
    if (!content || !content.trim()) return '';

    try {
      let rawHtml = marked.parse(content, {
        breaks: true,
        gfm: true,
      }) as string;

      // 移除 marked 自动给 checkbox 加上的 disabled=""，以便用户直接在预览中点击切换勾选
      rawHtml = rawHtml.replace(/disabled=""/g, '');

      // 消毒并保留必要的属性与标签
      const cleanHtml = DOMPurify.sanitize(rawHtml, {
        ADD_TAGS: ['input'],
        ADD_ATTR: ['type', 'checked', 'target', 'rel'],
      });

      return cleanHtml;
    } catch (e) {
      console.error('Markdown parse error:', e);
      return `<p class="text-red-500">渲染失败: ${(e as Error).message}</p>`;
    }
  }, [content]);

  // 处理内容区域点击：区分复选框切换、链接跳转与点击编辑
  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;

    // 1. 点击了任务复选框
    if (target && target.tagName.toLowerCase() === 'input' && (target as HTMLInputElement).type === 'checkbox') {
      e.stopPropagation();
      if (onToggleCheckbox) {
        const container = e.currentTarget;
        const allCheckboxes = Array.from(container.querySelectorAll('input[type="checkbox"]'));
        const index = allCheckboxes.indexOf(target as HTMLInputElement);
        if (index !== -1) {
          onToggleCheckbox(index);
        }
      }
      return;
    }

    // 2. 点击了超链接
    const linkEl = target.closest('a');
    if (linkEl && linkEl.href) {
      e.stopPropagation();
      e.preventDefault();
      try {
        window.open(linkEl.href, '_blank', 'noopener,noreferrer');
      } catch (err) {
        console.error('Failed to open link:', err);
      }
      return;
    }

    // 3. 点击其他区域，触发进入编辑模式
    if (onClickEdit) {
      onClickEdit();
    }
  };

  if (!content || !content.trim()) {
    return (
      <div
        onClick={onClickEdit}
        className={`group p-4 rounded-xl border border-dashed border-slate-200 hover:border-blue-400 bg-slate-50/50 hover:bg-blue-50/30 transition-all cursor-pointer flex flex-col items-center justify-center text-center text-slate-400 hover:text-blue-600 ${className}`}
      >
        <FileText size={24} className="mb-2 text-slate-300 group-hover:text-blue-500 transition-colors" />
        <p className="text-xs font-medium text-slate-500 group-hover:text-blue-600 mb-1">
          {placeholder}
        </p>
        <span className="text-[11px] text-slate-400 group-hover:text-blue-500 flex items-center gap-1">
          <Edit3 size={12} />
          点击此处开始编写 Markdown 笔记
        </span>
      </div>
    );
  }

  return (
    <div className={`relative group ${className}`}>
      {/* 鼠标悬浮时右上角浮现快捷“编辑”提示 */}
      {onClickEdit && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClickEdit();
          }}
          className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-all px-2 py-1 bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-300 text-slate-600 hover:text-blue-600 rounded-lg text-xs font-medium shadow-xs flex items-center gap-1 z-10"
          title="点击编辑 Markdown 内容"
        >
          <Edit3 size={12} />
          <span>编辑</span>
        </button>
      )}

      {/* 渲染后的 Markdown 文本容器 */}
      <div
        className="markdown-body p-2.5 rounded-xl hover:bg-slate-50/60 transition-colors cursor-text min-h-[120px]"
        dangerouslySetInnerHTML={{ __html: renderedHtml }}
        onClick={handleClick}
      />
    </div>
  );
};
