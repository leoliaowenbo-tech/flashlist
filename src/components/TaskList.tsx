import React, { useState, useMemo, useEffect } from 'react';
import { 
  Check, 
  Plus, 
  Calendar, 
  Clock, 
  Flag, 
  Tag, 
  ChevronDown, 
  ChevronRight, 
  CheckCircle, 
  Sparkles, 
  CalendarDays, 
  ArrowRight, 
  Mic, 
  MicOff, 
  Pin,
  CalendarRange,
  Rows3,
  AlertCircle
} from 'lucide-react';
import { Task, TaskList, ViewCategory, Priority } from '../types';
import { 
  format, 
  isToday, 
  isPast, 
  parseISO, 
  addDays, 
  isValid, 
  startOfWeek, 
  endOfWeek, 
  getISOWeek, 
  isSameWeek, 
  addWeeks, 
  startOfDay 
} from 'date-fns';
import { PRIORITY_CONFIG } from './PriorityBadge';
import { parseNaturalDate } from '../utils/dateParser';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { matchTagsFromText, MatchedTag } from '../utils/tagRecognizer';
import { TaskContextMenu } from './TaskContextMenu';
import { DeleteConfirmModal } from './DeleteConfirmModal';

interface TaskListProps {
  currentView: ViewCategory;
  currentListId: string | null;
  currentTag: string | null;
  lists: TaskList[];
  tasks: Task[];
  selectedTaskId: string | null;
  onSelectTask: (id: string) => void;
  onToggleComplete: (id: string) => void;
  onTogglePin: (id: string) => void;
  onAddTask: (task: { title: string; priority: Priority; dueDate?: string; dueTime?: string; listId: string; tags: string[] }) => void;
  onDeleteTask: (id: string) => void;
  onUpdateTask?: (id: string, updates: Partial<Task>) => void;
  onSwitchToCalendar: () => void;
  onOpenRuleModal?: () => void;
}

interface WeekGroup {
  key: string;
  title: string;
  dateRange: string;
  isThisWeek: boolean;
  isNextWeek: boolean;
  isPast: boolean;
  isNoDate: boolean;
  order: number;
  tasks: Task[];
}

/**
 * 核心自动排序：从旧到新（升序）
 * 1. 截止日期早的排前面 (如 8月14日 < 10月15日 < 10月16日)
 * 2. 同一天按时间先后 (如 09:00 < 14:00)
 * 3. 没设截止日期的按创建时间从旧到新
 */
export function compareTaskDateAsc(a: Task, b: Task): number {
  if (a.pinned !== b.pinned) {
    return a.pinned ? -1 : 1;
  }
  if (a.dueDate && b.dueDate) {
    if (a.dueDate !== b.dueDate) {
      return a.dueDate.localeCompare(b.dueDate);
    }
    if (a.dueTime && b.dueTime) {
      return a.dueTime.localeCompare(b.dueTime);
    }
    if (a.dueTime) return -1;
    if (b.dueTime) return 1;
    return a.createdAt.localeCompare(b.createdAt);
  }
  if (a.dueDate && !b.dueDate) return -1;
  if (!a.dueDate && b.dueDate) return 1;
  return a.createdAt.localeCompare(b.createdAt);
}

export const TaskListSection: React.FC<TaskListProps> = ({
  currentView,
  currentListId,
  currentTag,
  lists,
  tasks,
  selectedTaskId,
  onSelectTask,
  onToggleComplete,
  onTogglePin,
  onAddTask,
  onDeleteTask,
  onUpdateTask,
  onSwitchToCalendar,
  onOpenRuleModal,
}) => {
  const [quickTitle, setQuickTitle] = useState('');
  const [quickPriority, setQuickPriority] = useState<Priority>('p4');
  const [quickDueDate, setQuickDueDate] = useState<string>(
    format(new Date(), 'yyyy-MM-dd')
  );
  const [quickDueTime, setQuickDueTime] = useState<string>('');
  const [quickListId, setQuickListId] = useState<string>(
    currentView === 'list' && currentListId ? currentListId : 'inbox'
  );

  // 排序与周分组模式状态：待办日历日程 (upcoming) 默认开启按周分组划分！
  const [sortBy, setSortBy] = useState<'date' | 'priority'>('date');
  const [isGroupedByWeek, setIsGroupedByWeek] = useState<boolean>(currentView === 'upcoming');

  // 折叠状态
  const [showPinned, setShowPinned] = useState(true);
  const [collapsedWeeks, setCollapsedWeeks] = useState<Record<string, boolean>>({});
  const [showCompleted, setShowCompleted] = useState(false);
  const [useAutoClean, setUseAutoClean] = useState(true);
  const [inputExpanded, setInputExpanded] = useState(false);

  // 右键快捷菜单与删除确认状态
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    task: Task;
  } | null>(null);
  const [confirmDeleteTask, setConfirmDeleteTask] = useState<Task | null>(null);

  const handleContextMenu = (e: React.MouseEvent, task: Task) => {
    e.preventDefault();
    e.stopPropagation();
    onSelectTask(task.id);
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      task,
    });
  };

  // 视图切换时自动同步模式与默认日期（默认均为今天）
  useEffect(() => {
    if (currentView === 'today') {
      setIsGroupedByWeek(false);
    }
    setQuickDueDate(format(new Date(), 'yyyy-MM-dd'));

    if (currentView === 'upcoming') {
      setIsGroupedByWeek(true);
    }

    if (currentView === 'list' && currentListId) {
      setQuickListId(currentListId);
    } else if (currentView === 'inbox') {
      setQuickListId('inbox');
    }
  }, [currentView, currentListId]);

  // 语音识别集成
  const {
    isListening,
    transcript,
    error: speechError,
    startListening,
    stopListening,
    resetTranscript,
  } = useSpeechRecognition((finalText) => {
    setQuickTitle(prev => (prev ? `${prev} ${finalText}` : finalText).trim());
  });

  useEffect(() => {
    if (isListening && transcript) {
      setQuickTitle(transcript);
    }
  }, [isListening, transcript]);

  // 智能自然语言解析 (实时计算)
  const nlpResult = useMemo(() => {
    return parseNaturalDate(quickTitle);
  }, [quickTitle]);

  // 智能关键词识别自动打标签 (实时计算)
  const autoMatchedTags = useMemo(() => {
    return matchTagsFromText(quickTitle);
  }, [quickTitle]);

  const getViewTitle = () => {
    switch (currentView) {
      case 'inbox': return '收集箱';
      case 'today': return '今天';
      case 'upcoming': return '待办日历日程';
      case 'calendar': return '日历视图';
      case 'list': {
        const l = lists.find(item => item.id === currentListId);
        return l ? l.name : '清单';
      }
      case 'tag': return currentTag ? `#${currentTag}` : '标签';
      default: return '任务列表';
    }
  };

  const handleQuickAdd = (andGoCalendar: boolean = false) => {
    if (!quickTitle.trim()) return;

    if (isListening) {
      stopListening();
    }

    let finalTitle = quickTitle.trim();
    let finalDueDate: string | undefined = quickDueDate || format(new Date(), 'yyyy-MM-dd');
    let finalDueTime = quickDueTime || undefined;

    if (nlpResult.hasDate && nlpResult.dueDate) {
      finalDueDate = nlpResult.dueDate;
      if (nlpResult.dueTime) {
        finalDueTime = nlpResult.dueTime;
      }
      if (useAutoClean && nlpResult.cleanTitle) {
        finalTitle = nlpResult.cleanTitle;
      }
    }

    const autoTagNames = autoMatchedTags.map(m => m.tag);
    const currentViewTags = currentView === 'tag' && currentTag ? [currentTag] : [];
    const finalTags = Array.from(new Set([...currentViewTags, ...autoTagNames]));

    onAddTask({
      title: finalTitle,
      priority: quickPriority,
      dueDate: finalDueDate,
      dueTime: finalDueTime,
      listId: currentView === 'list' && currentListId ? currentListId : quickListId,
      tags: finalTags,
    });

    setQuickTitle('');
    resetTranscript();
    setQuickPriority('p4');
    setQuickDueTime('');
    setQuickDueDate(format(new Date(), 'yyyy-MM-dd'));
    setInputExpanded(false);

    if (andGoCalendar) {
      onSwitchToCalendar();
    }
  };

  // 基础分类：已完成与未完成
  let uncompletedTasks = tasks.filter(t => !t.completed);
  let completedTasks = tasks.filter(t => t.completed);

  // 排序规则：默认从旧到新（升序）！
  if (sortBy === 'priority') {
    const priorityWeight: Record<Priority, number> = { p1: 1, p2: 2, p3: 3, p4: 4 };
    uncompletedTasks = [...uncompletedTasks].sort((a, b) => priorityWeight[a.priority] - priorityWeight[b.priority]);
  } else {
    // 按日期从旧到新
    uncompletedTasks = [...uncompletedTasks].sort(compareTaskDateAsc);
  }

  const pinnedTasks = uncompletedTasks.filter(t => t.pinned);
  const normalUncompletedTasks = uncompletedTasks.filter(t => !t.pinned);

  // 构建周分组逻辑 (按周划分：逾期周、本周、下周、未来各周、无日期)
  const weekGroups = useMemo(() => {
    const now = new Date();
    const thisWeekStart = startOfWeek(now, { weekStartsOn: 1 });
    const thisWeekEnd = endOfWeek(now, { weekStartsOn: 1 });
    const nextWeekStart = addWeeks(thisWeekStart, 1);
    const nextWeekEnd = addWeeks(thisWeekEnd, 1);

    const groupsMap = new Map<string, WeekGroup>();

    uncompletedTasks.forEach(task => {
      if (!task.dueDate) {
        const key = 'no-date';
        if (!groupsMap.has(key)) {
          groupsMap.set(key, {
            key,
            title: '待安排待办',
            dateRange: '尚未设置具体日期',
            isThisWeek: false,
            isNextWeek: false,
            isPast: false,
            isNoDate: true,
            order: 5,
            tasks: [],
          });
        }
        groupsMap.get(key)!.tasks.push(task);
        return;
      }

      try {
        const d = parseISO(task.dueDate);
        if (!isValid(d)) {
          const key = 'no-date';
          if (!groupsMap.has(key)) {
            groupsMap.set(key, {
              key,
              title: '待安排待办',
              dateRange: '尚未设置具体日期',
              isThisWeek: false,
              isNextWeek: false,
              isPast: false,
              isNoDate: true,
              order: 5,
              tasks: [],
            });
          }
          groupsMap.get(key)!.tasks.push(task);
          return;
        }

        const wStart = startOfWeek(d, { weekStartsOn: 1 });
        const wEnd = endOfWeek(d, { weekStartsOn: 1 });
        const weekNum = getISOWeek(d);
        const dateRange = `${format(wStart, 'M月d日')} - ${format(wEnd, 'M月d日')}`;

        if (d < thisWeekStart) {
          // 1. 以前的（所有历史/逾期任务集中在“以前的”，不再按周细分）
          const key = 'past';
          if (!groupsMap.has(key)) {
            groupsMap.set(key, {
              key,
              title: '以前的',
              dateRange: `${format(thisWeekStart, 'M月d日')} 前`,
              isThisWeek: false,
              isNextWeek: false,
              isPast: true,
              isNoDate: false,
              order: 1,
              tasks: [],
            });
          }
          groupsMap.get(key)!.tasks.push(task);
        } else if (isSameWeek(d, now, { weekStartsOn: 1 })) {
          // 2. 本周（本周任务集中在一起）
          const key = 'this-week';
          if (!groupsMap.has(key)) {
            groupsMap.set(key, {
              key,
              title: '本周',
              dateRange: `${format(thisWeekStart, 'M月d日')} - ${format(thisWeekEnd, 'M月d日')}`,
              isThisWeek: true,
              isNextWeek: false,
              isPast: false,
              isNoDate: false,
              order: 2,
              tasks: [],
            });
          }
          groupsMap.get(key)!.tasks.push(task);
        } else if (isSameWeek(d, nextWeekStart, { weekStartsOn: 1 })) {
          // 3. 下一周（下一周任务集中在一起）
          const key = 'next-week';
          if (!groupsMap.has(key)) {
            groupsMap.set(key, {
              key,
              title: '下一周',
              dateRange: `${format(nextWeekStart, 'M月d日')} - ${format(nextWeekEnd, 'M月d日')}`,
              isThisWeek: false,
              isNextWeek: true,
              isPast: false,
              isNoDate: false,
              order: 3,
              tasks: [],
            });
          }
          groupsMap.get(key)!.tasks.push(task);
        } else {
          // 4. 以后（下周之后的所有任务统归“以后”，不再细分更多周）
          const key = 'future';
          if (!groupsMap.has(key)) {
            groupsMap.set(key, {
              key,
              title: '以后',
              dateRange: `${format(addDays(nextWeekEnd, 1), 'M月d日')} 以后`,
              isThisWeek: false,
              isNextWeek: false,
              isPast: false,
              isNoDate: false,
              order: 4,
              tasks: [],
            });
          }
          groupsMap.get(key)!.tasks.push(task);
        }
      } catch {
        // fallback
      }
    });

    // 关键优化：所有周分组严格从旧到新按时间升序排列！
    const sorted = Array.from(groupsMap.values()).sort((a, b) => a.order - b.order);
    // 并且每个周内部的任务，也严格从旧到新排序（置顶任务优先）
    sorted.forEach(g => {
      g.tasks.sort(compareTaskDateAsc);
    });
    return sorted;
  }, [uncompletedTasks]);

  const toggleCollapseWeek = (key: string) => {
    setCollapsedWeeks(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const renderDateBadge = (task: Task) => {
    if (!task.dueDate) return null;
    try {
      const d = parseISO(task.dueDate);
      if (!isValid(d)) return null;

      const past = isPast(d) && !isToday(d) && !task.completed;
      const today = isToday(d);
      const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd') === task.dueDate;

      let text = task.dueDate;
      if (today) text = `今天 ${task.dueTime || ''}`.trim();
      else if (tomorrow) text = `明天 ${task.dueTime || ''}`.trim();
      else text = `${format(d, 'MM月dd日')} ${task.dueTime || ''}`.trim();

      return (
        <span className={`inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded font-medium ${
          task.completed
            ? 'bg-slate-100 text-slate-400'
            : past 
              ? 'bg-red-50 text-red-600 border border-red-200/50' 
              : today 
                ? 'bg-amber-50 text-amber-700 border border-amber-200/50' 
                : 'bg-slate-100 text-slate-600'
        }`}>
          <Calendar size={11} className={past ? 'text-red-500' : today ? 'text-amber-500' : 'text-slate-400'} />
          {text}
        </span>
      );
    } catch {
      return null;
    }
  };

  const renderCompletedBadge = (task: Task) => {
    if (!task.completedAt) return null;
    try {
      const d = parseISO(task.completedAt);
      if (!isValid(d)) {
        return (
          <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded font-normal">
            <CheckCircle size={10} className="text-slate-400" />
            {task.completedAt.slice(0, 10)} 完成
          </span>
        );
      }
      const text = isToday(d) ? '今天完成' : `${format(d, 'MM月dd日')} 完成`;
      return (
        <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded font-normal">
          <CheckCircle size={10} className="text-slate-400" />
          {text}
        </span>
      );
    } catch {
      return null;
    }
  };

  // 单行任务渲染组件
  const renderTaskRow = (task: Task, isDimmedCompleted: boolean = false) => {
    const isSelected = selectedTaskId === task.id;
    const pcfg = PRIORITY_CONFIG[task.priority];
    const listObj = lists.find(l => l.id === task.listId);

    return (
      <div
        key={task.id}
        onClick={() => onSelectTask(task.id)}
        onContextMenu={(e) => handleContextMenu(e, task)}
        className={`group flex items-start gap-3 p-2.5 rounded-xl border transition-all cursor-pointer ${
          isSelected
            ? 'bg-blue-50/70 border-blue-200 shadow-xs'
            : isDimmedCompleted
              ? 'bg-slate-50/70 border-transparent hover:bg-slate-100/70 hover:border-slate-200/60'
              : task.pinned
                ? 'bg-amber-50/25 border-amber-200/70 hover:bg-amber-50/50'
                : 'bg-white border-transparent hover:bg-slate-50 hover:border-slate-200/60'
        }`}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleComplete(task.id);
          }}
          className={`mt-0.5 w-[18px] h-[18px] rounded-full flex items-center justify-center transition-all shrink-0 ${
            task.completed
              ? 'bg-slate-400 hover:bg-slate-500 border border-slate-400 text-white text-[10px]'
              : `border-2 ${pcfg.border} hover:bg-slate-200/50`
          }`}
          title={task.completed ? "标记为未完成" : "标记为已完成"}
        >
          {task.completed ? '✓' : <span className="opacity-0 group-hover:opacity-100 text-[10px] text-slate-400">✓</span>}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {task.pinned && (
              <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0 shadow-2xs ${
                task.completed ? 'text-slate-500 bg-slate-200/70' : 'text-amber-700 bg-amber-100/80'
              }`}>
                <Pin size={10} className={task.completed ? 'fill-slate-400' : 'fill-amber-500'} />
                置顶
              </span>
            )}
            <span className={`text-sm font-medium truncate ${
              task.completed ? 'text-slate-500' : 'text-slate-800'
            }`}>
              {task.title}
            </span>
            {task.priority !== 'p4' && (
              <Flag size={12} className={`${task.completed ? 'text-slate-400 opacity-70' : pcfg.color} shrink-0 fill-current`} />
            )}
          </div>

          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {renderDateBadge(task)}
            {task.completed && renderCompletedBadge(task)}

            {listObj && (
              <span className={`inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded ${
                task.completed ? 'text-slate-400 bg-slate-100' : 'text-slate-500 bg-slate-100'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${task.completed ? 'opacity-60' : ''}`} style={{ backgroundColor: listObj.color }} />
                {listObj.name}
              </span>
            )}

            {task.subtasks.length > 0 && (
              <span className="text-[11px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                {task.subtasks.filter(s => s.completed).length}/{task.subtasks.length} 检查项
              </span>
            )}

            {task.tags.map((t) => (
              <span key={t} className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                task.completed ? 'text-slate-500 bg-slate-100' : 'text-blue-600 bg-blue-50'
              }`}>
                #{t}
              </span>
            ))}
          </div>
        </div>

        {/* 置顶快捷按钮 */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onTogglePin(task.id);
          }}
          className={`mt-0.5 p-1 rounded-md transition-all shrink-0 ${
            task.pinned
              ? 'text-amber-600 hover:text-amber-700 bg-amber-100/70 opacity-100 shadow-2xs'
              : 'text-slate-300 hover:text-slate-600 hover:bg-slate-100 opacity-0 group-hover:opacity-100'
          }`}
          title={task.pinned ? "取消置顶" : "置顶任务"}
        >
          <Pin size={13} className={task.pinned ? "fill-amber-500" : ""} />
        </button>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-white select-none overflow-hidden">
      {/* 顶部标题栏 */}
      <div className="min-h-14 border-b border-slate-200/80 px-3 md:px-6 py-2 flex items-center justify-between shrink-0 flex-wrap gap-2">
        <div>
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            {getViewTitle()}
            <span className="text-xs font-normal text-slate-400">
              ({uncompletedTasks.length} 项待办)
            </span>
          </h2>
          {currentView === 'today' && (
            <p className="text-[11px] text-slate-400">
              {format(new Date(), 'yyyy年MM月dd日 EEEE')} · 自动按时间从早到晚排序
            </p>
          )}
          {currentView === 'upcoming' && (
            <p className="text-[11px] text-slate-400">
              按周集中排列日程待办：本周、下周与未来各周清晰掌控
            </p>
          )}
        </div>

        {/* 顶部操作快捷栏 */}
        <div className="flex items-center gap-1.5 md:gap-2.5 flex-wrap">
          {/* 打标规则按钮 */}
          {onOpenRuleModal && (
            <button
              onClick={onOpenRuleModal}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-medium rounded-lg transition-colors border border-indigo-200/60 shadow-2xs"
              title="查看与自定义关键词自动打标签规则"
            >
              <Sparkles size={14} className="text-indigo-600" />
              <span>打标规则</span>
            </button>
          )}

          {/* 切换日历视图 */}
          <button
            onClick={onSwitchToCalendar}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-medium rounded-lg transition-colors border border-blue-200/60 shadow-2xs"
            title="切换到月/周/日日历时间轴视图"
          >
            <CalendarDays size={14} />
            <span>日历视图</span>
          </button>

          {/* 视图模式切换：按周分组 vs 平铺列表 */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-xs">
            <button
              onClick={() => setIsGroupedByWeek(true)}
              className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1.5 ${
                isGroupedByWeek 
                  ? 'bg-white text-blue-600 shadow-xs font-semibold' 
                  : 'text-slate-500 hover:text-slate-700'
              }`}
              title="按周聚合：本周、下一周和各周任务集中管理"
            >
              <CalendarRange size={13} />
              <span>按周分组</span>
            </button>
            <button
              onClick={() => setIsGroupedByWeek(false)}
              className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1.5 ${
                !isGroupedByWeek 
                  ? 'bg-white text-slate-800 shadow-xs font-medium' 
                  : 'text-slate-500 hover:text-slate-700'
              }`}
              title="平铺列表展示"
            >
              <Rows3 size={13} />
              <span>平铺</span>
            </button>
          </div>

          {/* 排序方式切换：默认从旧到新 */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-xs">
            <button
              onClick={() => setSortBy('date')}
              className={`px-2 py-1 rounded-md transition-all ${
                sortBy === 'date' ? 'bg-white text-slate-800 shadow-xs font-semibold' : 'text-slate-500 hover:text-slate-700'
              }`}
              title="按截止日期从旧到新自动排序"
            >
              从旧到新
            </button>
            <button
              onClick={() => setSortBy('priority')}
              className={`px-2 py-1 rounded-md transition-all ${
                sortBy === 'priority' ? 'bg-white text-slate-800 shadow-xs font-semibold' : 'text-slate-500 hover:text-slate-700'
              }`}
              title="按优先级从高到低排序"
            >
              优先级
            </button>
          </div>
        </div>
      </div>

      {/* 快捷新建输入框（支持智能日期/时间识别 + 原生语音识别） */}
      <div className="p-2.5 md:p-4 border-b border-slate-100 bg-slate-50/50 shrink-0">
        <div className={`bg-white border rounded-xl shadow-xs p-2.5 md:p-3 transition-all ${
          isListening 
            ? 'ring-2 ring-red-500/30 border-red-500 bg-red-50/10' 
            : 'border-slate-200/90 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500'
        }`}>
          <div className="flex items-center gap-2">
            <Plus size={18} className="text-blue-600 shrink-0" />
            <input
              type="text"
              placeholder={isListening ? "正在倾听中，请说话..." : "输入闪念待办，支持自动识别时间与标签..."}
              value={quickTitle}
              onFocus={() => setInputExpanded(true)}
              onChange={(e) => setQuickTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleQuickAdd(false);
                }
              }}
              className="flex-1 min-w-0 text-sm bg-transparent outline-none placeholder:text-slate-400 text-slate-800"
            />

            {/* 手机端快捷发送按钮 */}
            {quickTitle.trim() && (
              <button
                type="button"
                onClick={() => handleQuickAdd(false)}
                className="md:hidden px-2.5 py-1 bg-blue-600 text-white rounded-lg text-xs font-medium shrink-0"
              >
                添加
              </button>
            )}

            {/* 语音识别麦克风按钮 */}
            <button
              type="button"
              onClick={() => {
                if (isListening) {
                  stopListening();
                } else {
                  setInputExpanded(true);
                  startListening();
                }
              }}
              className={`flex items-center gap-1 px-2 md:px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 ${
                isListening
                  ? 'bg-red-500 text-white animate-pulse shadow-md ring-2 ring-red-300'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
              title={isListening ? "点击停止录音" : "点击语音输入任务"}
            >
              {isListening ? (
                <>
                  <MicOff size={14} className="animate-bounce" />
                  <span className="hidden sm:inline">停止录音</span>
                </>
              ) : (
                <>
                  <Mic size={14} className="text-blue-600" />
                  <span className="hidden sm:inline">语音输入</span>
                </>
              )}
            </button>
          </div>

          {/* 语音录制提示 */}
          {isListening && (
            <div className="mt-2.5 p-2 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between text-xs text-red-700 animate-in fade-in">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                <span className="font-semibold">麦克风收音中：</span>
                <span className="text-red-900 font-mono">
                  {transcript || '请直接说出任务及时间，如“下周三下午3点开会”...'}
                </span>
              </div>
              <span className="text-[11px] text-red-500 font-medium">说完了点击停止或回车</span>
            </div>
          )}

          {speechError && (
            <div className="mt-2 text-xs text-amber-700 bg-amber-50 p-2 rounded-lg border border-amber-200">
              ⚠️ {speechError}
            </div>
          )}

          {/* 智能自然语言识别提示卡片 */}
          {nlpResult.hasDate && (
            <div className="mt-2.5 p-2 bg-gradient-to-r from-blue-50/80 to-indigo-50/80 border border-blue-200/70 rounded-lg flex items-center justify-between text-xs animate-in fade-in duration-150">
              <div className="flex items-center gap-2 text-blue-900">
                <Sparkles size={14} className="text-blue-600 shrink-0" />
                <span className="font-semibold text-blue-800">已智能识别：</span>
                <span className="bg-white/90 text-blue-700 font-mono px-2 py-0.5 rounded border border-blue-200 shadow-2xs font-medium">
                  📅 {nlpResult.dueDate} {nlpResult.dueTime ? `🕒 ${nlpResult.dueTime}` : ''}
                </span>
                <span className="text-slate-500 text-[11px]">
                  任务标题：<strong className="text-slate-800">“{nlpResult.cleanTitle}”</strong>
                </span>
              </div>

              <label className="flex items-center gap-1.5 text-slate-500 text-[11px] cursor-pointer hover:text-slate-700">
                <input
                  type="checkbox"
                  checked={useAutoClean}
                  onChange={(e) => setUseAutoClean(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-0"
                />
                <span>自动净化标题</span>
              </label>
            </div>
          )}

          {/* 快捷属性选择器 (日期、时间、优先级、清单) */}
          <div className={`${inputExpanded || quickTitle.trim() ? 'flex' : 'hidden md:flex'} items-center justify-between mt-3 pt-2.5 border-t border-slate-100 flex-wrap gap-2`}>
            <div className="flex items-center gap-3 text-xs flex-wrap">
              {/* 日期选择 */}
              <div className="flex items-center gap-1 text-slate-500">
                <Calendar size={14} className="text-slate-400" />
                <input
                  type="date"
                  value={quickDueDate}
                  onChange={(e) => setQuickDueDate(e.target.value)}
                  className="bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded-md text-xs text-slate-700 outline-none cursor-pointer"
                />
              </div>

              {/* 时间选择 */}
              <div className="flex items-center gap-1 text-slate-500">
                <Clock size={14} className="text-slate-400" />
                <input
                  type="time"
                  value={quickDueTime}
                  onChange={(e) => setQuickDueTime(e.target.value)}
                  className="bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded-md text-xs text-slate-700 outline-none cursor-pointer"
                />
              </div>

              {/* 优先级 */}
              <div className="flex items-center gap-1">
                {(['p1', 'p2', 'p3', 'p4'] as Priority[]).map((p) => {
                  const cfg = PRIORITY_CONFIG[p];
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setQuickPriority(p)}
                      className={`p-1 rounded transition-all ${
                        quickPriority === p ? `${cfg.bg} ring-1 ring-inset ring-current` : 'hover:bg-slate-100'
                      }`}
                      title={cfg.label}
                    >
                      <Flag size={12} className={cfg.color} />
                    </button>
                  );
                })}
              </div>

              {currentView !== 'list' && (
                <select
                  value={quickListId}
                  onChange={(e) => setQuickListId(e.target.value)}
                  className="bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded-md text-xs text-slate-600 outline-none cursor-pointer"
                >
                  <option value="inbox">收集箱</option>
                  {lists.map(l => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              )}
            </div>

            <div className="flex items-center gap-2">
              {nlpResult.hasDate && (
                <button
                  type="button"
                  onClick={() => handleQuickAdd(true)}
                  disabled={!quickTitle.trim()}
                  className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-medium px-2.5 py-1 rounded-lg transition-colors text-xs flex items-center gap-1 border border-indigo-200/60"
                  title="添加后直接跳转到日历时间轴"
                >
                  <span>添加并查看日历</span>
                  <ArrowRight size={12} />
                </button>
              )}

              <button
                type="button"
                onClick={() => handleQuickAdd(false)}
                disabled={!quickTitle.trim()}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-medium px-3.5 py-1 rounded-lg transition-colors text-xs shadow-xs"
              >
                确定添加
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 任务内容列表主体 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {uncompletedTasks.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center text-slate-400 text-xs">
            <CheckCircle size={36} className="text-slate-300 stroke-1 mb-2" />
            <p>没有未完成的任务</p>
            <p className="text-[11px] text-slate-400 mt-0.5">所有事项都已妥善安排，轻松一下吧！</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* 1. 按周划分模式：展示各周分组（本周、下周、未来周、逾期周等） */}
            {isGroupedByWeek ? (
              <div className="space-y-3">
                {weekGroups.map(group => {
                  const isCollapsed = collapsedWeeks[group.key] || false;

                  return (
                    <div key={group.key} className="space-y-1">
                      {/* 周分组卡片头 */}
                      <button
                        type="button"
                        onClick={() => toggleCollapseWeek(group.key)}
                        className={`w-full flex items-center justify-between p-2 rounded-xl transition-all text-xs font-bold cursor-pointer ${
                          group.isThisWeek
                            ? 'bg-blue-50/90 text-blue-900 border border-blue-200 shadow-2xs'
                            : group.isNextWeek
                              ? 'bg-indigo-50/80 text-indigo-900 border border-indigo-200/70 shadow-2xs'
                              : group.isPast
                                ? 'bg-amber-50/80 text-amber-900 border border-amber-200/70 shadow-2xs'
                                : 'bg-slate-100/80 text-slate-700 hover:bg-slate-100 border border-slate-200/60'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {isCollapsed ? <ChevronRight size={14} className="shrink-0" /> : <ChevronDown size={14} className="shrink-0" />}
                          <span className="truncate">{group.title}</span>
                          <span className="text-[11px] font-normal text-slate-400 hidden sm:inline">
                            ({group.dateRange})
                          </span>
                        </div>
                        <span className="text-[11px] font-normal px-2 py-0.5 rounded-full bg-white text-slate-700 border border-slate-200/60 shadow-2xs shrink-0">
                          {group.tasks.length} 项
                        </span>
                      </button>

                      {/* 周分组任务列表 */}
                      {!isCollapsed && (
                        <div className="space-y-1 pl-1 pt-0.5">
                          {group.tasks.map(task => renderTaskRow(task))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              /* 2. 平铺展示模式：严格按从旧到新排序（置顶任务优先） */
              <div className="space-y-1">
                {uncompletedTasks.map(task => renderTaskRow(task))}
              </div>
            )}
          </div>
        )}

        {/* 4. 已完成任务（默认折叠） */}
        {completedTasks.length > 0 && (
          <div className="pt-4 border-t border-slate-100">
            <button
              onClick={() => setShowCompleted(!showCompleted)}
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 mb-2 py-1 px-2 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            >
              {showCompleted ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <span>已完成 ({completedTasks.length} 项)</span>
            </button>

            {showCompleted && (
              <div className="space-y-1 mt-1">
                {completedTasks.map(task => renderTaskRow(task, true))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 右键快捷菜单 */}
      {contextMenu && (
        <TaskContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          task={contextMenu.task}
          lists={lists}
          onClose={() => setContextMenu(null)}
          onToggleComplete={onToggleComplete}
          onTogglePin={onTogglePin}
          onDeleteTask={(task) => setConfirmDeleteTask(task)}
          onUpdateTask={onUpdateTask}
        />
      )}

      {/* 删除任务确认弹窗 */}
      <DeleteConfirmModal
        task={confirmDeleteTask}
        onCancel={() => setConfirmDeleteTask(null)}
        onConfirm={() => {
          if (confirmDeleteTask) {
            onDeleteTask(confirmDeleteTask.id);
            setConfirmDeleteTask(null);
          }
        }}
      />
    </div>
  );
};
