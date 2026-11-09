import React, { useState, useEffect, useRef } from 'react';
import { 
  CheckCircle, 
  Circle, 
  Pin, 
  Trash2, 
  Copy, 
  Flag, 
  Calendar, 
  Folder, 
  ChevronRight,
  Check
} from 'lucide-react';
import { Task, TaskList, Priority } from '../types';
import { PRIORITY_CONFIG } from './PriorityBadge';
import { format, addDays, nextMonday } from 'date-fns';

interface TaskContextMenuProps {
  x: number;
  y: number;
  task: Task;
  lists: TaskList[];
  onClose: () => void;
  onToggleComplete: (id: string) => void;
  onTogglePin: (id: string) => void;
  onDeleteTask: (task: Task) => void;
  onUpdateTask?: (id: string, updates: Partial<Task>) => void;
}

export const TaskContextMenu: React.FC<TaskContextMenuProps> = ({
  x,
  y,
  task,
  lists,
  onClose,
  onToggleComplete,
  onTogglePin,
  onDeleteTask,
  onUpdateTask,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [adjustedPos, setAdjustedPos] = useState({ x, y });
  const [activeSubmenu, setActiveSubmenu] = useState<'date' | 'list' | null>(null);
  const [copied, setCopied] = useState(false);

  // 边界自适应调整，防止菜单超出视口
  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const menuWidth = rect.width || 210;
      const menuHeight = rect.height || 320;

      let newX = x;
      let newY = y;

      if (x + menuWidth > window.innerWidth - 12) {
        newX = Math.max(12, window.innerWidth - menuWidth - 12);
      }
      if (y + menuHeight > window.innerHeight - 12) {
        newY = Math.max(12, window.innerHeight - menuHeight - 12);
      }

      setAdjustedPos({ x: newX, y: newY });
    }
  }, [x, y]);

  // 点击外部、右键其他区域、按 Esc 或滚动时自动关闭菜单
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    const handleScroll = () => {
      onClose();
    };

    window.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('contextmenu', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleScroll, true);

    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('contextmenu', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [onClose]);

  const handleCopyTitle = async () => {
    try {
      await navigator.clipboard.writeText(task.title);
      setCopied(true);
      setTimeout(() => {
        onClose();
      }, 500);
    } catch {
      onClose();
    }
  };

  const handleSetDate = (dateStr?: string) => {
    if (onUpdateTask) {
      onUpdateTask(task.id, { 
        dueDate: dateStr,
        dueTime: dateStr ? task.dueTime : undefined
      });
    }
    onClose();
  };

  const handleSetPriority = (p: Priority) => {
    if (onUpdateTask) {
      onUpdateTask(task.id, { priority: p });
    }
    onClose();
  };

  const handleMoveList = (listId: string) => {
    if (onUpdateTask) {
      onUpdateTask(task.id, { listId });
    }
    onClose();
  };

  // 子菜单展开方向：如果靠近右边框则向左展开
  const isNearRightEdge = adjustedPos.x + 380 > window.innerWidth;

  return (
    <div
      ref={menuRef}
      style={{ left: `${adjustedPos.x}px`, top: `${adjustedPos.y}px` }}
      onClick={(e) => e.stopPropagation()}
      className="fixed z-50 bg-white/95 backdrop-blur-md rounded-xl shadow-2xl border border-slate-200/90 p-1 min-w-[200px] text-xs text-slate-700 select-none animate-in fade-in zoom-in-95 duration-100"
    >
      {/* 快捷操作：完成状态 */}
      <button
        type="button"
        onClick={() => {
          onToggleComplete(task.id);
          onClose();
        }}
        className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 transition-colors text-left"
      >
        {task.completed ? (
          <>
            <Circle size={14} className="text-slate-400" />
            <span>标为未完成</span>
          </>
        ) : (
          <>
            <CheckCircle size={14} className="text-emerald-600" />
            <span>标为已完成</span>
          </>
        )}
      </button>

      {/* 快捷操作：置顶切换 */}
      <button
        type="button"
        onClick={() => {
          onTogglePin(task.id);
          onClose();
        }}
        className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 transition-colors text-left"
      >
        <Pin size={14} className={task.pinned ? "fill-amber-500 text-amber-600" : "text-slate-400"} />
        <span>{task.pinned ? '取消置顶' : '置顶任务'}</span>
      </button>

      {/* 快捷操作：复制任务标题 */}
      <button
        type="button"
        onClick={handleCopyTitle}
        className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 transition-colors text-left"
      >
        {copied ? (
          <>
            <Check size={14} className="text-emerald-600" />
            <span className="text-emerald-600 font-medium">已复制标题！</span>
          </>
        ) : (
          <>
            <Copy size={14} className="text-slate-400" />
            <span>复制任务标题</span>
          </>
        )}
      </button>

      <div className="h-px bg-slate-100 my-1" />

      {/* 优先级快速切换行 */}
      <div className="px-2.5 py-1.5 flex items-center justify-between text-slate-500">
        <span className="text-[11px]">优先级</span>
        <div className="flex items-center gap-1">
          {(['p1', 'p2', 'p3', 'p4'] as Priority[]).map((p) => {
            const cfg = PRIORITY_CONFIG[p];
            const isActive = task.priority === p;
            return (
              <button
                key={p}
                type="button"
                onClick={() => handleSetPriority(p)}
                title={cfg.label}
                className={`p-1 rounded-md transition-all ${
                  isActive
                    ? 'bg-slate-200/90 shadow-2xs ring-1 ring-slate-300'
                    : 'hover:bg-slate-100 opacity-60 hover:opacity-100'
                }`}
              >
                <Flag size={12} className={`${cfg.color} ${isActive ? 'fill-current' : ''}`} />
              </button>
            );
          })}
        </div>
      </div>

      {/* 截止日期二级菜单 */}
      <div 
        className="relative"
        onMouseEnter={() => setActiveSubmenu('date')}
        onMouseLeave={() => setActiveSubmenu(null)}
      >
        <div className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer">
          <div className="flex items-center gap-2.5">
            <Calendar size={14} className="text-slate-400" />
            <span>设置截止日期</span>
          </div>
          <ChevronRight size={13} className="text-slate-400" />
        </div>

        {activeSubmenu === 'date' && (
          <div 
            className={`absolute top-0 ${isNearRightEdge ? 'right-full mr-1' : 'left-full ml-1'} bg-white/95 backdrop-blur-md rounded-xl shadow-2xl border border-slate-200/90 p-1 min-w-[140px] animate-in fade-in zoom-in-95 duration-100`}
          >
            <button
              type="button"
              onClick={() => handleSetDate(format(new Date(), 'yyyy-MM-dd'))}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-slate-100 transition-colors text-left"
            >
              <span>今天</span>
              {task.dueDate === format(new Date(), 'yyyy-MM-dd') && <Check size={12} className="text-blue-600" />}
            </button>
            <button
              type="button"
              onClick={() => handleSetDate(format(addDays(new Date(), 1), 'yyyy-MM-dd'))}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-slate-100 transition-colors text-left"
            >
              <span>明天</span>
              {task.dueDate === format(addDays(new Date(), 1), 'yyyy-MM-dd') && <Check size={12} className="text-blue-600" />}
            </button>
            <button
              type="button"
              onClick={() => handleSetDate(format(nextMonday(new Date()), 'yyyy-MM-dd'))}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-slate-100 transition-colors text-left"
            >
              <span>下周一</span>
              {task.dueDate === format(nextMonday(new Date()), 'yyyy-MM-dd') && <Check size={12} className="text-blue-600" />}
            </button>
            {task.dueDate && (
              <>
                <div className="h-px bg-slate-100 my-1" />
                <button
                  type="button"
                  onClick={() => handleSetDate(undefined)}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-red-50 text-red-600 transition-colors text-left"
                >
                  <span>清除截止日期</span>
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* 移动到清单二级菜单 */}
      <div 
        className="relative"
        onMouseEnter={() => setActiveSubmenu('list')}
        onMouseLeave={() => setActiveSubmenu(null)}
      >
        <div className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer">
          <div className="flex items-center gap-2.5">
            <Folder size={14} className="text-slate-400" />
            <span>移动到清单</span>
          </div>
          <ChevronRight size={13} className="text-slate-400" />
        </div>

        {activeSubmenu === 'list' && (
          <div 
            className={`absolute top-0 ${isNearRightEdge ? 'right-full mr-1' : 'left-full ml-1'} bg-white/95 backdrop-blur-md rounded-xl shadow-2xl border border-slate-200/90 p-1 min-w-[150px] max-h-56 overflow-y-auto animate-in fade-in zoom-in-95 duration-100`}
          >
            <button
              type="button"
              onClick={() => handleMoveList('inbox')}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-slate-100 transition-colors text-left"
            >
              <span>收集箱</span>
              {task.listId === 'inbox' && <Check size={12} className="text-blue-600" />}
            </button>
            {lists.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => handleMoveList(l.id)}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-slate-100 transition-colors text-left"
              >
                <div className="flex items-center gap-2 truncate">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: l.color }} />
                  <span className="truncate">{l.name}</span>
                </div>
                {task.listId === l.id && <Check size={12} className="text-blue-600 shrink-0" />}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="h-px bg-slate-100 my-1" />

      {/* 核心需求：删除任务 */}
      <button
        type="button"
        onClick={() => {
          onDeleteTask(task);
          onClose();
        }}
        className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors text-left font-medium"
      >
        <Trash2 size={14} className="shrink-0" />
        <span>删除任务</span>
      </button>
    </div>
  );
};
