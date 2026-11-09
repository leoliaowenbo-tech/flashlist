import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  X, 
  Trash2, 
  Calendar, 
  Clock, 
  Flag, 
  Folder, 
  Plus, 
  Check, 
  Pin, 
  ListChecks, 
  AlignLeft, 
  Menu,
  MoreHorizontal,
  Sparkles,
  ChevronDown,
  Copy,
  Eye,
  Edit3
} from 'lucide-react';
import { Task, TaskList, Priority, SubTask } from '../types';
import { PRIORITY_CONFIG } from './PriorityBadge';
import { format, parseISO, isValid, isToday, isTomorrow, addDays, startOfDay } from 'date-fns';
import { matchTagsFromText } from '../utils/tagRecognizer';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { MarkdownRenderer, toggleMarkdownCheckbox } from './MarkdownRenderer';
import { MarkdownToolbar } from './MarkdownToolbar';
import { DatePickerPopover } from './DatePickerPopover';
import { playTaskCompleteSound } from '../utils/sound';

interface TaskDetailProps {
  task: Task | null;
  lists: TaskList[];
  allTags?: string[];
  onClose: () => void;
  onUpdate: (id: string, updates: Partial<Task>) => void;
  onDelete: (id: string) => void;
  onToggleComplete: (id: string) => void;
  onAddTag?: (name: string) => void;
}

type PopoverType = 'date' | 'priority' | 'list' | 'tag' | 'more' | null;

export const TaskDetail: React.FC<TaskDetailProps> = ({
  task,
  lists,
  allTags = [],
  onClose,
  onUpdate,
  onDelete,
  onToggleComplete,
  onAddTag,
}) => {
  const [openPopover, setOpenPopover] = useState<PopoverType>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [mode, setMode] = useState<'checklist' | 'text'>('text');
  // 描述视图模式：'preview' 直接渲染 Markdown 格式，'edit' 源码编辑
  const [descViewMode, setDescViewMode] = useState<'preview' | 'edit'>('preview');
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [newTagInput, setNewTagInput] = useState('');
  const [focusNewItemIndex, setFocusNewItemIndex] = useState<number | null>(null);

  const descTextareaRef = useRef<HTMLTextAreaElement>(null);
  const newSubtaskInputRef = useRef<HTMLInputElement>(null);
  const subtaskInputRefs = useRef<(HTMLTextAreaElement | null)[]>([]);

  // 任务切换时自适应初始化模式
  useEffect(() => {
    if (task) {
      if (task.subtasks && task.subtasks.length > 0) {
        setMode('checklist');
      } else {
        setMode('text');
      }
      // 如果任务已有描述内容，默认直接渲染 Markdown 文本；若无描述，则默认提供编辑输入区
      if (task.desc && task.desc.trim()) {
        setDescViewMode('preview');
      } else {
        setDescViewMode('edit');
      }
      setOpenPopover(null);
    }
  }, [task?.id]);

  // 新插入子项后的自动聚焦
  useEffect(() => {
    if (focusNewItemIndex !== null && subtaskInputRefs.current[focusNewItemIndex]) {
      subtaskInputRefs.current[focusNewItemIndex]?.focus();
      setFocusNewItemIndex(null);
    }
  }, [focusNewItemIndex, task?.subtasks]);

  // 智能建议标签（根据标题与内容）
  const suggestedTags = useMemo(() => {
    if (!task) return [];
    const textToMatch = `${task.title} ${task.desc || ''}`;
    const matched = matchTagsFromText(textToMatch);
    return matched.filter(m => !task.tags.includes(m.tag));
  }, [task?.title, task?.desc, task?.tags]);

  // 库中已有但当前任务未添加的标签
  const availableExistingTags = useMemo(() => {
    if (!task) return [];
    return allTags.filter(t => !task.tags.includes(t));
  }, [allTags, task?.tags]);

  if (!task) return null;

  const pcfg = PRIORITY_CONFIG[task.priority];
  const currentList = lists.find(l => l.id === task.listId);

  // 切换 清单/检查项模式 vs 纯文本描述模式
  const handleToggleMode = () => {
    if (mode === 'checklist') {
      // 切换为文本模式：如果存在子任务，将子任务转化为文本
      if (task.subtasks.length > 0) {
        const subtaskLines = task.subtasks.map((s) => 
          `- [${s.completed ? 'x' : ' '}] ${s.title}`
        ).join('\n');
        const updatedDesc = task.desc 
          ? `${task.desc}\n\n${subtaskLines}`
          : subtaskLines;
        onUpdate(task.id, { desc: updatedDesc });
      }
      setMode('text');
    } else {
      // 切换为清单模式：如果已有文本描述，解析每行为检查项
      if (task.desc && task.desc.trim()) {
        const lines = task.desc.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        const parsedSubtasks: SubTask[] = lines.map(line => {
          // 匹配 - [x] 或 - [ ]
          const boxMatch = line.match(/^-\s*\[([ xX])\]\s*(.+)$/);
          if (boxMatch) {
            return {
              id: `sub_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              completed: boxMatch[1].toLowerCase() === 'x',
              title: boxMatch[2].trim(),
            };
          }
          // 匹配数字序号如 1. 2.
          const numMatch = line.match(/^\d+[\.\、\)]\s*(.+)$/);
          return {
            id: `sub_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            completed: false,
            title: numMatch ? numMatch[1].trim() : line,
          };
        });
        if (parsedSubtasks.length > 0) {
          onUpdate(task.id, { 
            subtasks: [...task.subtasks, ...parsedSubtasks] 
          });
        }
      }
      setMode('checklist');
    }
  };

  // 插入新子任务
  const insertSubtaskAt = (index: number) => {
    const newSub: SubTask = {
      id: `sub_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title: '',
      completed: false,
    };
    const updated = [...task.subtasks];
    updated.splice(index + 1, 0, newSub);
    onUpdate(task.id, { subtasks: updated });
    setFocusNewItemIndex(index + 1);
  };

  // 底部新增子任务
  const handleAddSubtask = () => {
    if (!newSubtaskTitle.trim()) return;
    const newSub: SubTask = {
      id: `sub_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title: newSubtaskTitle.trim(),
      completed: false,
    };
    onUpdate(task.id, { subtasks: [...task.subtasks, newSub] });
    setNewSubtaskTitle('');
  };

  const toggleSubtask = (subId: string) => {
    let justCompleted = false;
    const updated = task.subtasks.map(s => {
      if (s.id === subId) {
        const nextState = !s.completed;
        if (nextState) {
          justCompleted = true;
        }
        return { ...s, completed: nextState };
      }
      return s;
    });
    if (justCompleted) {
      playTaskCompleteSound();
    }
    onUpdate(task.id, { subtasks: updated });
  };

  const updateSubtaskTitle = (subId: string, title: string) => {
    const updated = task.subtasks.map(s => 
      s.id === subId ? { ...s, title } : s
    );
    onUpdate(task.id, { subtasks: updated });
  };

  const deleteSubtask = (subId: string, focusPrevIndex?: number) => {
    onUpdate(task.id, { subtasks: task.subtasks.filter(s => s.id !== subId) });
    if (typeof focusPrevIndex === 'number' && focusPrevIndex >= 0) {
      setTimeout(() => {
        subtaskInputRefs.current[focusPrevIndex]?.focus();
      }, 50);
    }
  };

  // 标签处理
  const handleAddTag = (tagToAdd: string) => {
    const cleanTag = tagToAdd.trim().replace(/^#/, '');
    if (!cleanTag) return;
    if (!task.tags.includes(cleanTag)) {
      onUpdate(task.id, { tags: [...task.tags, cleanTag] });
    }
    onAddTag?.(cleanTag);
    setNewTagInput('');
    setOpenPopover(null);
  };

  const removeTag = (tagToRemove: string) => {
    onUpdate(task.id, { tags: task.tags.filter(t => t !== tagToRemove) });
  };

  // 切换 Markdown 文本中的任务复选框 (- [ ] <-> - [x])
  const handleToggleMarkdownCheckbox = (checkboxIndex: number) => {
    if (!task) return;
    const currentDesc = task.desc || '';
    // 检查是否是从未完成标记为已完成
    let matchIdx = 0;
    const regex = /^(\s*[-*+]\s+\[)([ xX])(\]\s+.*)$/gm;
    let m;
    while ((m = regex.exec(currentDesc)) !== null) {
      if (matchIdx === checkboxIndex) {
        if (m[2].toLowerCase() !== 'x') {
          playTaskCompleteSound();
        }
        break;
      }
      matchIdx++;
    }
    const updated = toggleMarkdownCheckbox(currentDesc, checkboxIndex);
    onUpdate(task.id, { desc: updated });
  };

  // 顶栏日期文字渲染
  const renderDateDisplay = () => {
    if (!task.dueDate) {
      return (
        <span className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
          <Calendar size={14} className="text-slate-400" />
          <span>设置日期</span>
        </span>
      );
    }

    let dateText = task.dueDate;
    let isOverdue = false;
    try {
      const d = parseISO(task.dueDate);
      if (isValid(d)) {
        const today = startOfDay(new Date());
        if (isToday(d)) {
          dateText = '今天';
        } else if (isTomorrow(d)) {
          dateText = '明天';
        } else {
          dateText = format(d, 'M月d日');
        }
        if (!task.completed && d < today) {
          isOverdue = true;
        }
      }
    } catch (e) { /* ignore */ }

    if (task.dueTime) {
      dateText += ` ${task.dueTime}`;
    }

    return (
      <span className={`flex items-center gap-1.5 text-xs font-medium ${isOverdue ? 'text-red-600' : 'text-blue-600'}`}>
        <Calendar size={14} className={isOverdue ? 'text-red-500' : 'text-blue-500'} />
        <span>{dateText}</span>
      </span>
    );
  };

  let createdFormatted = '';
  try {
    const d = parseISO(task.createdAt);
    if (isValid(d)) createdFormatted = format(d, 'yyyy/MM/dd HH:mm');
  } catch (e) { /* ignore */ }

  return (
    <>
      <aside className="fixed inset-0 z-50 w-full md:relative md:w-[380px] md:z-auto border-l border-slate-200/80 bg-white flex flex-col h-full pt-safe pb-safe select-none shadow-xl md:shadow-xs shrink-0 overflow-hidden">
        {/* 全局透明遮罩，用于点击外部关闭 Popover */}
        {openPopover && (
          <div 
            className="fixed inset-0 z-30 bg-transparent"
            onClick={() => setOpenPopover(null)} 
          />
        )}

        {/* 顶部工具栏：完全仿照参考设计 (模式切换 | 设置日期 | 清单选择 | 优先级旗标 | 置顶 | 更多/关闭) */}
        <div className="h-12 border-b border-slate-200/70 px-3.5 flex items-center justify-between text-slate-600 shrink-0 bg-slate-50/40 relative z-40">
          {/* 左侧：清单/文本模式切换 | 设置日期 | 清单选择 */}
          <div className="flex items-center gap-1.5">
            {/* 模式切换按钮 (参考设计中的左上角模式图标) */}
            <button
              onClick={handleToggleMode}
              className={`p-1.5 rounded-md transition-all flex items-center justify-center ${
                mode === 'checklist'
                  ? 'text-blue-600 bg-blue-50 ring-1 ring-blue-500/30 font-semibold'
                  : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
              }`}
              title={mode === 'checklist' ? '当前：检查项模式（点击切换为长文本笔记）' : '当前：长文本笔记模式（点击切换为检查项）'}
            >
              {mode === 'checklist' ? (
                <ListChecks size={16} className="text-blue-600" />
              ) : (
                <AlignLeft size={16} />
              )}
            </button>

            <span className="w-[1px] h-3.5 bg-slate-200 mx-0.5" />

            {/* 设置日期按钮与弹出框 */}
            <div className="relative">
              <button
                onClick={() => setOpenPopover(openPopover === 'date' ? null : 'date')}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors ${
                  openPopover === 'date'
                    ? 'bg-blue-50 ring-1 ring-blue-300'
                    : 'hover:bg-slate-100'
                }`}
                title="设置截止日期与时间"
              >
                {renderDateDisplay()}
              </button>

              {/* 日期设置弹出框 */}
              {openPopover === 'date' && (
                <DatePickerPopover
                  dueDate={task.dueDate}
                  dueTime={task.dueTime}
                  onChange={(newDueDate, newDueTime) => {
                    onUpdate(task.id, { 
                      dueDate: newDueDate, 
                      dueTime: newDueTime 
                    });
                  }}
                  onClose={() => setOpenPopover(null)}
                />
              )}
            </div>

            {/* 清单选择器 (无需默认占据表单整行) */}
            <div className="relative">
              <button
                onClick={() => setOpenPopover(openPopover === 'list' ? null : 'list')}
                className="flex items-center gap-1 px-1.5 py-1 rounded-md text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                title="切换任务所属清单"
              >
                <Folder size={13} style={{ color: currentList?.color || '#3B82F6' }} />
                <span className="max-w-[70px] truncate">{currentList?.name || '收集箱'}</span>
                <ChevronDown size={11} className="text-slate-400" />
              </button>

              {openPopover === 'list' && (
                <div className="absolute left-0 top-full mt-1.5 w-44 bg-white rounded-xl shadow-xl border border-slate-200 p-1.5 z-50 text-xs animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-2 py-1 text-[11px] font-semibold text-slate-400">选择所属清单</div>
                  <button
                    onClick={() => {
                      onUpdate(task.id, { listId: 'inbox' });
                      setOpenPopover(null);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors ${
                      task.listId === 'inbox' ? 'bg-blue-50 text-blue-600 font-medium' : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-500" />
                      收集箱
                    </span>
                    {task.listId === 'inbox' && <Check size={12} />}
                  </button>
                  {lists.map(l => (
                    <button
                      key={l.id}
                      onClick={() => {
                        onUpdate(task.id, { listId: l.id });
                        setOpenPopover(null);
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors ${
                        task.listId === l.id ? 'bg-blue-50 text-blue-600 font-medium' : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: l.color }} />
                        <span className="truncate">{l.name}</span>
                      </span>
                      {task.listId === l.id && <Check size={12} />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 右侧：优先级旗标、置顶、关闭 */}
          <div className="flex items-center gap-1">
            {/* 优先级选择 */}
            <div className="relative">
              <button
                onClick={() => setOpenPopover(openPopover === 'priority' ? null : 'priority')}
                className={`p-1.5 rounded-md transition-colors ${
                  task.priority !== 'p4' ? 'hover:bg-slate-100' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                }`}
                title={`优先级：${pcfg.label}`}
              >
                <Flag 
                  size={16} 
                  className={`${task.priority !== 'p4' ? `${pcfg.color} fill-current` : 'text-slate-400'}`} 
                />
              </button>

              {openPopover === 'priority' && (
                <div className="absolute right-0 top-full mt-1.5 w-36 bg-white rounded-xl shadow-xl border border-slate-200 p-1.5 z-50 text-xs animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-2 py-1 text-[11px] font-semibold text-slate-400">设置优先级</div>
                  {(['p1', 'p2', 'p3', 'p4'] as Priority[]).map((p) => {
                    const cfg = PRIORITY_CONFIG[p];
                    const isSelected = task.priority === p;
                    return (
                      <button
                        key={p}
                        onClick={() => {
                          onUpdate(task.id, { priority: p });
                          setOpenPopover(null);
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors ${
                          isSelected ? 'bg-slate-100 font-medium text-slate-900' : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <Flag size={13} className={`${cfg.color} ${p !== 'p4' ? 'fill-current' : ''}`} />
                          <span>{cfg.label}</span>
                        </span>
                        {isSelected && <Check size={12} className="text-blue-600" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 置顶 */}
            <button
              onClick={() => onUpdate(task.id, { pinned: !task.pinned })}
              className={`p-1.5 rounded-md transition-colors ${
                task.pinned
                  ? 'text-amber-600 bg-amber-50 hover:bg-amber-100'
                  : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
              }`}
              title={task.pinned ? "取消置顶" : "置顶任务"}
            >
              <Pin size={15} className={task.pinned ? "fill-amber-500" : ""} />
            </button>

            {/* 关闭详情（手机端显示明显返回按钮） */}
            <button
              onClick={onClose}
              className="px-2 py-1 md:p-1.5 text-slate-600 md:text-slate-400 hover:text-slate-800 bg-slate-100 md:bg-transparent hover:bg-slate-200/70 rounded-lg transition-colors flex items-center gap-1 text-xs font-medium"
              title="关闭详情"
            >
              <span className="md:hidden">完成</span>
              <X size={16} />
            </button>
          </div>
        </div>

        {/* 主体内容区域：大标题 + 描述/检查项 + 底部标签 (完全依照参考布局) */}
        <div className="flex-1 overflow-y-auto p-5 flex flex-col space-y-3">
          {/* 任务大标题行：大号文字 + 右侧菜单图标 (仿照种子加工与贮藏右侧的 ≡ 图标) */}
          <div className="flex items-start justify-between gap-2 shrink-0">
            <div className="flex items-start gap-2.5 flex-1 min-w-0">
              <button
                onClick={() => onToggleComplete(task.id)}
                className={`mt-1 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all shrink-0 ${
                  task.completed 
                    ? 'bg-blue-600 border-blue-600 text-white shadow-xs' 
                    : `${pcfg.border} hover:bg-slate-100`
                }`}
                title={task.completed ? '标记为未完成' : '标记为已完成'}
              >
                {task.completed && <Check size={12} strokeWidth={3} />}
              </button>

              <textarea
                value={task.title}
                onChange={(e) => onUpdate(task.id, { title: e.target.value })}
                placeholder="任务标题"
                rows={1}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = 'auto';
                  target.style.height = `${target.scrollHeight}px`;
                }}
                className={`flex-1 text-lg font-bold outline-none resize-none bg-transparent placeholder:text-slate-300 leading-snug transition-colors ${
                  task.completed ? 'text-slate-500' : 'text-slate-800'
                }`}
              />
            </div>

            {/* 标题右侧的操作菜单 ≡ */}
            <div className="relative shrink-0">
              <button
                onClick={() => setOpenPopover(openPopover === 'more' ? null : 'more')}
                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
                title="任务操作"
              >
                <Menu size={18} />
              </button>

              {openPopover === 'more' && (
                <div className="absolute right-0 top-full mt-1.5 w-36 bg-white rounded-xl shadow-xl border border-slate-200 p-1.5 z-50 text-xs animate-in fade-in zoom-in-95 duration-100">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(task.title);
                      setOpenPopover(null);
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-slate-700 hover:bg-slate-50 text-left transition-colors"
                  >
                    <Copy size={13} />
                    <span>复制标题</span>
                  </button>
                  <button
                    onClick={() => {
                      onUpdate(task.id, { pinned: !task.pinned });
                      setOpenPopover(null);
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-slate-700 hover:bg-slate-50 text-left transition-colors"
                  >
                    <Pin size={13} />
                    <span>{task.pinned ? '取消置顶' : '置顶任务'}</span>
                  </button>
                  <button
                    onClick={() => {
                      setOpenPopover(null);
                      setShowDeleteModal(true);
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-red-600 hover:bg-red-50 text-left transition-colors"
                  >
                    <Trash2 size={13} />
                    <span>删除任务</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* “描述”小标题 + 原生 Markdown 格式直接渲染切换 */}
          <div className="flex items-center justify-between text-xs font-semibold text-slate-400 select-none pt-1">
            <div className="flex items-center gap-1.5">
              <span>描述</span>
              <span 
                className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-blue-50 text-blue-600 border border-blue-200/60"
                title="已开启原生 Markdown 格式直接渲染"
              >
                MD
              </span>
            </div>

            {mode === 'checklist' ? (
              task.subtasks.length > 0 && (
                <span className="text-[11px] font-normal text-slate-400">
                  已完成 {task.subtasks.filter(s => s.completed).length}/{task.subtasks.length}
                </span>
              )
            ) : (
              /* Markdown 直接渲染 / 源码编辑 切换器 */
              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-[11px]">
                <button
                  type="button"
                  onClick={() => setDescViewMode('preview')}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-md transition-all font-medium ${
                    descViewMode === 'preview'
                      ? 'bg-white text-blue-600 shadow-2xs font-semibold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                  title="直接渲染 Markdown 格式文本效果"
                >
                  <Eye size={12} />
                  <span>渲染</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDescViewMode('edit');
                    setTimeout(() => descTextareaRef.current?.focus(), 50);
                  }}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-md transition-all font-medium ${
                    descViewMode === 'edit'
                      ? 'bg-white text-blue-600 shadow-2xs font-semibold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                  title="编辑 Markdown 源码内容"
                >
                  <Edit3 size={12} />
                  <span>编辑</span>
                </button>
              </div>
            )}
          </div>

          {/* 主体核心输入窗口：写描述、要点或检查项列表 */}
          <div className="flex-1 flex flex-col min-h-[220px]">
            {mode === 'checklist' ? (
              /* 检查项清单视图：带复选框的列表，支持直接编辑、回车换行、退格删除 */
              <div className="space-y-1.5 flex-1">
                {task.subtasks.map((sub, index) => (
                  <div
                    key={sub.id}
                    className="group flex items-start gap-2.5 py-1 px-1 rounded-lg hover:bg-slate-50/80 transition-colors"
                  >
                    {/* 复选框 (仿照参考截图的圆角小方框) */}
                    <button
                      type="button"
                      onClick={() => toggleSubtask(sub.id)}
                      className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center transition-all shrink-0 ${
                        sub.completed 
                          ? 'bg-blue-600 border-blue-600 text-white' 
                          : 'border-slate-300 hover:border-blue-500 bg-white'
                      }`}
                    >
                      {sub.completed && <Check size={11} strokeWidth={3} />}
                    </button>

                    {/* 标题文本输入 (无边框，如文档般自由编写) */}
                    <textarea
                      ref={(el) => {
                        subtaskInputRefs.current[index] = el;
                      }}
                      rows={1}
                      value={sub.title}
                      onChange={(e) => updateSubtaskTitle(sub.id, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          insertSubtaskAt(index);
                        } else if (e.key === 'Backspace' && !sub.title) {
                          e.preventDefault();
                          deleteSubtask(sub.id, index - 1);
                        }
                      }}
                      onInput={(e) => {
                        const target = e.target as HTMLTextAreaElement;
                        target.style.height = 'auto';
                        target.style.height = `${target.scrollHeight}px`;
                      }}
                      className={`flex-1 text-sm bg-transparent outline-none resize-none leading-relaxed transition-colors ${
                        sub.completed ? 'text-slate-400' : 'text-slate-800'
                      }`}
                    />

                    {/* 删除子项按钮 */}
                    <button
                      type="button"
                      onClick={() => deleteSubtask(sub.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-300 hover:text-red-500 rounded transition-opacity"
                      title="删除检查项"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))}

                {/* 新增检查项快捷输入行 */}
                <div className="flex items-center gap-2.5 py-1.5 px-1 mt-1 text-slate-400">
                  <Plus size={15} className="shrink-0 text-slate-400" />
                  <input
                    ref={newSubtaskInputRef}
                    type="text"
                    placeholder="添加检查项..."
                    value={newSubtaskTitle}
                    onChange={(e) => setNewSubtaskTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddSubtask();
                      }
                    }}
                    className="flex-1 text-sm bg-transparent outline-none placeholder:text-slate-400 text-slate-700"
                  />
                </div>

                {/* 兼容：当从滴答清单同步或带有附加备注时直接以 Markdown 渲染展示 */}
                {task.desc && (
                  <div className="mt-4 pt-3 border-t border-slate-100">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] font-semibold text-slate-400">补充笔记 (Markdown)</span>
                      <button
                        type="button"
                        onClick={() => {
                          setMode('text');
                          setDescViewMode('edit');
                          setTimeout(() => descTextareaRef.current?.focus(), 50);
                        }}
                        className="text-[11px] text-blue-600 hover:text-blue-800 flex items-center gap-1 font-medium"
                      >
                        <Edit3 size={11} />
                        <span>编辑笔记</span>
                      </button>
                    </div>
                    <div className="bg-slate-50/70 p-2.5 rounded-lg border border-slate-100">
                      <MarkdownRenderer
                        content={task.desc}
                        onToggleCheckbox={handleToggleMarkdownCheckbox}
                        onClickEdit={() => {
                          setMode('text');
                          setDescViewMode('edit');
                          setTimeout(() => descTextareaRef.current?.focus(), 50);
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            ) : descViewMode === 'preview' ? (
              /* 直接渲染 Markdown 格式效果视图 */
              <div className="flex-1 flex flex-col min-h-[220px]">
                <MarkdownRenderer
                  content={task.desc || ''}
                  onClickEdit={() => {
                    setDescViewMode('edit');
                    setTimeout(() => descTextareaRef.current?.focus(), 50);
                  }}
                  onToggleCheckbox={handleToggleMarkdownCheckbox}
                  className="flex-1"
                  placeholder="写下详细的描述说明... 支持标题(#)、待办(- [ ])、加粗(**)、代码块(```)、表格等 Markdown 格式"
                />
              </div>
            ) : (
              /* 纯文本 Markdown 编写与格式化工具栏窗口 */
              <div className="flex-1 flex flex-col min-h-[220px]">
                <MarkdownToolbar
                  textareaRef={descTextareaRef}
                  value={task.desc || ''}
                  onChange={(val) => onUpdate(task.id, { desc: val })}
                />
                <textarea
                  ref={descTextareaRef}
                  value={task.desc || ''}
                  onChange={(e) => onUpdate(task.id, { desc: e.target.value })}
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                      e.preventDefault();
                      setDescViewMode('preview');
                    }
                  }}
                  placeholder="写下详细的描述说明... 支持 Markdown 语法 (# 标题, - [ ] 待办, **加粗**, 表格, 代码块等)。按 Cmd+Enter 快速完成并直接渲染。"
                  className="w-full flex-1 min-h-[240px] text-sm text-slate-700 placeholder:text-slate-400 leading-relaxed outline-none border-none resize-none bg-transparent font-sans"
                  autoFocus={!task.desc}
                />
                <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px] text-slate-400">
                  <span>提示：按 Cmd+Enter 快速切换为渲染预览</span>
                  <button
                    type="button"
                    onClick={() => setDescViewMode('preview')}
                    className="flex items-center gap-1 px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-md font-medium transition-colors"
                  >
                    <Eye size={12} />
                    <span>完成并直接渲染</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 底部：标签区域 (胶囊样式，完全仿照参考设计中的 [课程需求汇总] [+]) */}
          <div className="pt-3 border-t border-slate-100/80 flex flex-wrap items-center gap-2 shrink-0">
            {task.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1.5 text-xs bg-slate-100 hover:bg-slate-200/80 text-slate-700 px-3 py-1 rounded-full transition-colors group cursor-default"
              >
                <span>{tag}</span>
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  className="opacity-50 hover:opacity-100 hover:text-red-600 transition-opacity"
                  title="移除标签"
                >
                  <X size={11} />
                </button>
              </span>
            ))}

            {/* 添加标签胶囊按钮 (+) */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenPopover(openPopover === 'tag' ? null : 'tag')}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors text-xs"
                title="添加标签"
              >
                <Plus size={14} />
              </button>

              {/* 标签选择与输入弹出框 */}
              {openPopover === 'tag' && (
                <div className="absolute left-0 bottom-full mb-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 p-2.5 z-50 text-xs animate-in fade-in zoom-in-95 duration-100">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleAddTag(newTagInput);
                    }}
                    className="mb-2"
                  >
                    <input
                      type="text"
                      autoFocus
                      placeholder="输入标签名后按回车..."
                      value={newTagInput}
                      onChange={(e) => setNewTagInput(e.target.value)}
                      className="w-full text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                    />
                  </form>

                  {/* 常用已有标签 */}
                  {availableExistingTags.length > 0 && (
                    <div className="mb-2">
                      <div className="text-[11px] font-semibold text-slate-400 mb-1">选择已有标签：</div>
                      <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                        {availableExistingTags.map(tag => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => handleAddTag(tag)}
                            className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full text-[11px] transition-colors"
                          >
                            #{tag}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 智能建议标签 */}
                  {suggestedTags.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1 text-[11px] font-semibold text-indigo-700 mb-1">
                        <Sparkles size={11} />
                        <span>智能识别标签：</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {suggestedTags.map(({ tag }) => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => handleAddTag(tag)}
                            className="px-2 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-full text-[11px] border border-indigo-200/60 transition-colors"
                          >
                            +{tag}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 极简底栏 */}
        {createdFormatted && (
          <div className="px-5 py-2.5 border-t border-slate-100 text-[11px] text-slate-400 flex items-center justify-between shrink-0">
            <span>创建于 {createdFormatted}</span>
          </div>
        )}
      </aside>

      {/* 删除确认对话框 */}
      {showDeleteModal && (
        <DeleteConfirmModal
          task={task}
          onConfirm={() => {
            setShowDeleteModal(false);
            onDelete(task.id);
          }}
          onCancel={() => setShowDeleteModal(false)}
        />
      )}
    </>
  );
};
