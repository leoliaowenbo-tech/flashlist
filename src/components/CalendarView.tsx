import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  Plus, 
  Clock, 
  Flag,
  Mic,
  MicOff,
  Sparkles,
  X,
  Check,
  Tag,
  Hash
} from 'lucide-react';
import { Task, TaskList, CalendarViewMode, Priority } from '../types';
import { 
  format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isToday, 
  addDays, 
  subDays,
  addWeeks,
  subWeeks,
  parseISO
} from 'date-fns';
import { PRIORITY_CONFIG } from './PriorityBadge';
import { TaskContextMenu } from './TaskContextMenu';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { parseNaturalDate } from '../utils/dateParser';
import { matchTagsFromText } from '../utils/tagRecognizer';

interface CalendarViewProps {
  tasks: Task[];
  lists: TaskList[];
  allTags?: string[];
  selectedTaskId: string | null;
  onSelectTask: (id: string) => void;
  onAddTask: (task: { title: string; priority: Priority; dueDate?: string; dueTime?: string; listId: string; tags: string[] }) => void;
  onToggleComplete: (id: string) => void;
  onDeleteTask?: (id: string) => void;
  onTogglePin?: (id: string) => void;
  onUpdateTask?: (id: string, updates: Partial<Task>) => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  tasks,
  lists,
  allTags = [],
  selectedTaskId,
  onSelectTask,
  onAddTask,
  onToggleComplete,
  onDeleteTask,
  onTogglePin,
  onUpdateTask,
}) => {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<CalendarViewMode>('month');

  // 右键快捷菜单与删除确认状态
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    task: Task;
  } | null>(null);
  const [confirmDeleteTask, setConfirmDeleteTask] = useState<Task | null>(null);

  // 日历点击新建任务弹窗状态
  const [showAddModal, setShowAddModal] = useState(false);
  const [modalDate, setModalDate] = useState<string>('');
  const [modalTime, setModalTime] = useState<string>('');
  const [modalTitle, setModalTitle] = useState<string>('');
  const [modalPriority, setModalPriority] = useState<Priority>('p4');
  const [modalListId, setModalListId] = useState<string>('inbox');
  const [modalTags, setModalTags] = useState<string[]>([]);
  const [autoCleanTimeInTitle, setAutoCleanTimeInTitle] = useState(true);

  const titleInputRef = useRef<HTMLInputElement>(null);

  // 语音识别集成
  const {
    isListening,
    transcript,
    error: speechError,
    startListening,
    stopListening,
    resetTranscript,
  } = useSpeechRecognition((finalText) => {
    setModalTitle((prev) => (prev ? `${prev} ${finalText}` : finalText).trim());
  });

  useEffect(() => {
    if (isListening && transcript) {
      setModalTitle(transcript);
    }
  }, [isListening, transcript]);

  // 智能自然语言日期/时间解析
  const nlpResult = useMemo(() => {
    return parseNaturalDate(modalTitle);
  }, [modalTitle]);

  // 智能关键词识别标签
  const autoMatchedTags = useMemo(() => {
    return matchTagsFromText(modalTitle);
  }, [modalTitle]);

  const openAddTaskModal = (dateStr: string, timeStr?: string) => {
    setModalDate(dateStr);
    setModalTime(timeStr || '');
    setModalTitle('');
    setModalPriority('p4');
    setModalListId(lists[0]?.id || 'inbox');
    setModalTags([]);
    resetTranscript();
    setShowAddModal(true);
    setTimeout(() => {
      titleInputRef.current?.focus();
    }, 100);
  };

  const handleModalSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!modalTitle.trim()) return;

    if (isListening) {
      stopListening();
    }

    let finalTitle = modalTitle.trim();
    let finalDueDate = modalDate || format(new Date(), 'yyyy-MM-dd');
    let finalDueTime = modalTime || undefined;

    // 如果标题中包含智能识别时间，优先应用
    if (nlpResult.hasDate) {
      if (nlpResult.dueDate) {
        finalDueDate = nlpResult.dueDate;
      }
      if (nlpResult.dueTime) {
        finalDueTime = nlpResult.dueTime;
      }
      if (autoCleanTimeInTitle && nlpResult.cleanTitle) {
        finalTitle = nlpResult.cleanTitle;
      }
    }

    // 智能合并识别到的标签
    const detectedTagNames = autoMatchedTags.map((m) => m.tag);
    const mergedTags = Array.from(new Set([...modalTags, ...detectedTagNames]));

    onAddTask({
      title: finalTitle,
      priority: modalPriority,
      dueDate: finalDueDate,
      dueTime: finalDueTime,
      listId: modalListId,
      tags: mergedTags,
    });

    setShowAddModal(false);
    setModalTitle('');
    resetTranscript();
  };

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

  const handlePrev = () => {
    if (viewMode === 'month') setCurrentDate(subMonths(currentDate, 1));
    else if (viewMode === 'week') setCurrentDate(subWeeks(currentDate, 1));
    else setCurrentDate(subDays(currentDate, 1));
  };

  const handleNext = () => {
    if (viewMode === 'month') setCurrentDate(addMonths(currentDate, 1));
    else if (viewMode === 'week') setCurrentDate(addWeeks(currentDate, 1));
    else setCurrentDate(addDays(currentDate, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const monthDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  const totalWeeks = Math.ceil(monthDays.length / 7);

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const hours = Array.from({ length: 15 }, (_, i) => i + 8);

  // 日历视图任务排序：未完成排在前面，已完成排在后面；次级按置顶、时间、优先级、创建时间排序
  const sortCalendarTasks = (a: Task, b: Task) => {
    // 1. 未完成排在前面，已完成排在后面
    if (a.completed !== b.completed) {
      return a.completed ? 1 : -1;
    }
    // 2. 置顶优先
    if ((a.pinned || false) !== (b.pinned || false)) {
      return a.pinned ? -1 : 1;
    }
    // 3. 具体时间先后 (如 09:00 < 14:00，无时间的排后面)
    if (a.dueTime && b.dueTime) {
      if (a.dueTime !== b.dueTime) return a.dueTime.localeCompare(b.dueTime);
    } else if (a.dueTime && !b.dueTime) {
      return -1;
    } else if (!a.dueTime && b.dueTime) {
      return 1;
    }
    // 4. 优先级 (p1 > p2 > p3 > p4)
    const pWeight: Record<Priority, number> = { p1: 1, p2: 2, p3: 3, p4: 4 };
    if (a.priority !== b.priority) {
      return (pWeight[a.priority] || 4) - (pWeight[b.priority] || 4);
    }
    // 5. 创建时间升序
    return a.createdAt.localeCompare(b.createdAt);
  };

  const getTasksForDay = (date: Date) => {
    const dStr = format(date, 'yyyy-MM-dd');
    return tasks.filter((t) => t.dueDate === dStr).sort(sortCalendarTasks);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-white select-none overflow-hidden">
      {/* 顶部日历控制器 */}
      <div className="h-14 border-b border-slate-200/80 px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-bold text-slate-800">
            {format(currentDate, 'yyyy年 MM月')}
          </h2>
          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg">
            <button
              onClick={handlePrev}
              className="p-1 hover:bg-white hover:shadow-xs rounded text-slate-600 transition-all"
              title="上一段"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={handleToday}
              className="px-2 py-0.5 text-xs font-medium text-slate-700 hover:bg-white hover:shadow-xs rounded transition-all"
            >
              今天
            </button>
            <button
              onClick={handleNext}
              className="p-1 hover:bg-white hover:shadow-xs rounded text-slate-600 transition-all"
              title="下一段"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-xs">
          {(['month', 'week', 'day'] as CalendarViewMode[]).map((mode) => {
            const labels = { month: '月', week: '周', day: '日' };
            return (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1 rounded-md transition-all font-medium ${
                  viewMode === mode
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {labels[mode]}
              </button>
            );
          })}
        </div>
      </div>

      {/* 日历主体区域 */}
      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col">
        {/* 月视图：全面铺满、无85px限制、显示所有任务 */}
        {viewMode === 'month' && (
          <div className="flex-1 min-h-full flex flex-col">
            <div className="grid grid-cols-7 border-b border-slate-200 text-center text-xs font-semibold text-slate-500 py-2.5 bg-slate-50/70 shrink-0">
              <span>一</span>
              <span>二</span>
              <span>三</span>
              <span>四</span>
              <span>五</span>
              <span className="text-blue-600">六</span>
              <span className="text-blue-600">日</span>
            </div>

            <div
              className="flex-1 grid grid-cols-7 divide-x divide-y divide-slate-100 min-h-0"
              style={{
                gridTemplateRows: `repeat(${totalWeeks}, minmax(130px, 1fr))`,
              }}
            >
              {monthDays.map((day, idx) => {
                const dayTasks = getTasksForDay(day);
                const isCurrentMonth = isSameMonth(day, currentDate);
                const isCurrentDay = isToday(day);
                const dateStr = format(day, 'yyyy-MM-dd');

                return (
                  <div
                    key={idx}
                    onClick={(e) => {
                      if (e.target === e.currentTarget) {
                        openAddTaskModal(dateStr);
                      }
                    }}
                    className={`h-full min-h-[130px] p-2 flex flex-col transition-colors group relative cursor-default ${
                      isCurrentMonth ? 'bg-white' : 'bg-slate-50/40'
                    }`}
                  >
                    {/* 日期数字行 */}
                    <div className="flex items-center justify-between mb-1.5 shrink-0">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full transition-all ${
                            isCurrentDay
                              ? 'bg-blue-600 text-white font-bold shadow-xs'
                              : isCurrentMonth
                                ? 'text-slate-700'
                                : 'text-slate-300'
                          }`}
                        >
                          {format(day, 'd')}
                        </span>
                        {dayTasks.length > 0 && (
                          <span className="text-[10px] text-slate-400 font-medium">
                            {dayTasks.length} 项
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openAddTaskModal(dateStr);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-all"
                        title={`在 ${dateStr} 添加任务`}
                      >
                        <Plus size={13} />
                      </button>
                    </div>

                    {/* 任务列表：完全铺满剩余空间，显示所有任务，不设 85px 限制 */}
                    <div 
                      className="flex-1 min-h-0 flex flex-col gap-1 overflow-y-auto pr-0.5"
                      onClick={(e) => {
                        if (e.target === e.currentTarget) {
                          openAddTaskModal(dateStr);
                        }
                      }}
                    >
                      {dayTasks.map((t) => {
                        const isSelected = selectedTaskId === t.id;

                        return (
                          <div
                            key={t.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectTask(t.id);
                            }}
                            onContextMenu={(e) => handleContextMenu(e, t)}
                            title={t.title + (t.dueTime ? ` (${t.dueTime})` : '')}
                            className={`px-2 py-1 rounded-md text-[11px] flex items-center gap-1.5 cursor-pointer transition-all border shrink-0 ${
                              t.completed
                                ? 'bg-slate-100 text-slate-400 border-slate-200/50'
                                : isSelected
                                  ? 'bg-blue-50 text-blue-700 border-blue-300 shadow-2xs font-medium'
                                  : 'bg-slate-50 hover:bg-slate-100/90 text-slate-700 border-slate-200/70 hover:border-slate-300 shadow-2xs'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                t.priority === 'p1' ? 'bg-red-500 ring-2 ring-red-100' :
                                t.priority === 'p2' ? 'bg-amber-500 ring-2 ring-amber-100' :
                                t.priority === 'p3' ? 'bg-blue-500 ring-2 ring-blue-100' : 'bg-slate-400'
                              }`}
                            />
                            {t.dueTime && (
                              <span className="text-[10px] font-medium text-blue-600 bg-blue-100/60 px-1 py-0.2 rounded shrink-0">
                                {t.dueTime}
                              </span>
                            )}
                            <span className="truncate flex-1 font-medium">{t.title}</span>
                            {t.tags && t.tags.length > 0 && (
                              <span className="text-[9px] px-1 py-0.2 bg-slate-200/70 text-slate-500 rounded shrink-0 max-w-[50px] truncate hidden xl:inline">
                                #{t.tags[0]}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 周视图 */}
        {viewMode === 'week' && (
          <div className="h-full flex flex-col min-w-[700px]">
            <div className="grid grid-cols-8 border-b border-slate-200 bg-slate-50 text-xs py-2 text-center font-medium text-slate-500 shrink-0">
              <div className="text-slate-400">时间</div>
              {weekDays.map((d, i) => {
                const isCurrent = isToday(d);
                return (
                  <div key={i} className={`flex flex-col items-center ${isCurrent ? 'text-blue-600 font-bold' : ''}`}>
                    <span>{format(d, 'EEE')}</span>
                    <span className={`w-6 h-6 flex items-center justify-center rounded-full mt-0.5 ${
                      isCurrent ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-700'
                    }`}>
                      {format(d, 'd')}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
              {hours.map((hour) => {
                const hourStr = `${hour.toString().padStart(2, '0')}:00`;
                return (
                  <div key={hour} className="grid grid-cols-8 min-h-[56px] text-xs">
                    <div className="text-slate-400 text-center py-1 border-r border-slate-100 text-[11px]">
                      {hourStr}
                    </div>
                    {weekDays.map((d, colIdx) => {
                      const dStr = format(d, 'yyyy-MM-dd');
                      const hourTasks = tasks.filter(t => 
                        t.dueDate === dStr && 
                        t.dueTime?.startsWith(hour.toString().padStart(2, '0'))
                      ).sort(sortCalendarTasks);

                      return (
                        <div
                          key={colIdx}
                          onClick={() => openAddTaskModal(dStr, hourStr)}
                          className="border-r border-slate-100 p-1 hover:bg-blue-50/30 transition-colors cursor-pointer relative"
                        >
                          {hourTasks.map((t) => (
                            <div
                              key={t.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectTask(t.id);
                              }}
                              onContextMenu={(e) => handleContextMenu(e, t)}
                              className={`p-1 rounded text-[11px] mb-1 border shadow-xs ${
                                t.completed ? 'bg-slate-100 text-slate-400 border-slate-200/50' : 'bg-blue-50 border-blue-200 text-blue-700'
                              }`}
                            >
                              <div className="font-semibold truncate">{t.title}</div>
                              <div className="text-[10px] text-blue-500">{t.dueTime}</div>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 日视图 */}
        {viewMode === 'day' && (
          <div className="p-6 max-w-3xl mx-auto space-y-4 w-full">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 className="text-xl font-bold text-slate-800">
                  {format(currentDate, 'yyyy年MM月dd日 EEEE')}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  当日共 {getTasksForDay(currentDate).length} 项安排
                </p>
              </div>

              <button
                onClick={() => openAddTaskModal(format(currentDate, 'yyyy-MM-dd'))}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm transition-colors"
              >
                <Plus size={14} /> 新建日程
              </button>
            </div>

            <div className="space-y-2">
              {getTasksForDay(currentDate).length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs">
                  <Clock size={36} className="mx-auto mb-2 text-slate-300 stroke-1" />
                  今天暂时没有任何日程安排，点击右上角新建一个吧！
                </div>
              ) : (
                getTasksForDay(currentDate).map((t) => {
                  const pcfg = PRIORITY_CONFIG[t.priority];
                  return (
                    <div
                      key={t.id}
                      onClick={() => onSelectTask(t.id)}
                      onContextMenu={(e) => handleContextMenu(e, t)}
                      className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl hover:border-blue-300 hover:shadow-xs transition-all cursor-pointer"
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleComplete(t.id);
                        }}
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                          t.completed ? 'bg-blue-600 border-blue-600 text-white' : `${pcfg.border}`
                        }`}
                      >
                        {t.completed && '✓'}
                      </button>

                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-medium ${t.completed ? 'text-slate-500' : 'text-slate-800'}`}>
                            {t.title}
                          </span>
                          <span className={`text-xs ${pcfg.color}`}>
                            {pcfg.label}
                          </span>
                        </div>
                        {t.desc && <p className="text-xs text-slate-500 mt-0.5">{t.desc}</p>}
                      </div>

                      {t.dueTime && (
                        <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded-md">
                          {t.dueTime}
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* 智能添加日程任务弹窗 (支持语音输入、时间识别与标签判定) */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-slate-100 p-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <CalendarIcon size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">
                    新建日历日程 · 任务
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    默认日期：{modalDate} {modalTime ? `· ${modalTime}` : ''}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (isListening) stopListening();
                  setShowAddModal(false);
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleModalSubmit} className="space-y-4 pt-4">
              {/* 输入框 + 语音输入按钮 */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  任务名称与说明
                </label>
                <div className="relative flex items-center">
                  <input
                    ref={titleInputRef}
                    type="text"
                    value={modalTitle}
                    onChange={(e) => setModalTitle(e.target.value)}
                    placeholder="输入内容或直接说话，支持识别时间 (如：下午3点例会) 和标签..."
                    className="w-full pl-3 pr-10 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleModalSubmit();
                      } else if (e.key === 'Escape') {
                        if (isListening) stopListening();
                        setShowAddModal(false);
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (isListening) {
                        stopListening();
                      } else {
                        startListening();
                      }
                    }}
                    className={`absolute right-2 p-1.5 rounded-lg transition-all ${
                      isListening
                        ? 'bg-red-500 text-white animate-pulse shadow-xs'
                        : 'text-slate-400 hover:text-blue-600 hover:bg-slate-100'
                    }`}
                    title={isListening ? '点击停止语音录入' : '点击开始语音输入'}
                  >
                    {isListening ? <MicOff size={16} /> : <Mic size={16} />}
                  </button>
                </div>

                {/* 语音中状态提示 */}
                {isListening && (
                  <div className="mt-1.5 flex items-center gap-1.5 text-xs text-red-600 bg-red-50 px-2.5 py-1 rounded-lg">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                    <span>正在倾听您的语音，请说话...</span>
                  </div>
                )}
                {speechError && (
                  <p className="mt-1 text-[11px] text-red-500">{speechError}</p>
                )}
              </div>

              {/* 智能时间判定展示 */}
              {nlpResult.hasDate && (
                <div className="bg-amber-50/70 border border-amber-200/60 rounded-xl p-2.5 flex items-center justify-between text-xs text-amber-800">
                  <div className="flex items-center gap-1.5">
                    <Sparkles size={13} className="text-amber-600 shrink-0" />
                    <span>
                      识别到时间：
                      <strong>{nlpResult.dueDate || modalDate}</strong>
                      {nlpResult.dueTime ? ` ${nlpResult.dueTime}` : ''}
                    </span>
                  </div>
                  <label className="flex items-center gap-1 text-[11px] text-amber-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoCleanTimeInTitle}
                      onChange={(e) => setAutoCleanTimeInTitle(e.target.checked)}
                      className="rounded text-amber-600"
                    />
                    <span>自动清理标题中的时间词</span>
                  </label>
                </div>
              )}

              {/* 智能标签判定展示 */}
              {autoMatchedTags.length > 0 && (
                <div className="bg-indigo-50/70 border border-indigo-200/60 rounded-xl p-2.5 text-xs text-indigo-800 flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1 font-medium shrink-0">
                    <Tag size={13} className="text-indigo-600" />
                    <span>自动识别标签：</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {autoMatchedTags.map((m) => (
                      <span
                        key={m.tag}
                        className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-[11px] font-medium"
                      >
                        #{m.tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* 日期、时间、优先级、清单属性选择 */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">
                    安排日期
                  </label>
                  <input
                    type="date"
                    value={modalDate}
                    onChange={(e) => setModalDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs outline-none focus:border-blue-500 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">
                    具体时间 (可选)
                  </label>
                  <input
                    type="time"
                    value={modalTime}
                    onChange={(e) => setModalTime(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs outline-none focus:border-blue-500 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">
                    优先级
                  </label>
                  <select
                    value={modalPriority}
                    onChange={(e) => setModalPriority(e.target.value as Priority)}
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs outline-none focus:border-blue-500 bg-white"
                  >
                    <option value="p4">无优先级</option>
                    <option value="p3">中优先级 (蓝色)</option>
                    <option value="p2">高优先级 (橙色)</option>
                    <option value="p1">紧急 (红色)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">
                    所属清单
                  </label>
                  <select
                    value={modalListId}
                    onChange={(e) => setModalListId(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs outline-none focus:border-blue-500 bg-white"
                  >
                    <option value="inbox">收集箱</option>
                    {lists.filter(l => l.id !== 'inbox').map(l => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 手动添加附加标签 */}
              {allTags.length > 0 && (
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">
                    选择已有标签：
                  </label>
                  <div className="flex flex-wrap gap-1 max-h-18 overflow-y-auto">
                    {allTags.map((tag) => {
                      const isSelected = modalTags.includes(tag) || autoMatchedTags.some(m => m.tag === tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => {
                            if (modalTags.includes(tag)) {
                              setModalTags(modalTags.filter(t => t !== tag));
                            } else {
                              setModalTags([...modalTags, tag]);
                            }
                          }}
                          className={`px-2 py-0.5 rounded-full text-[11px] transition-colors border ${
                            isSelected
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                        >
                          #{tag}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 弹窗底部操作 */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    if (isListening) stopListening();
                    setShowAddModal(false);
                  }}
                  className="px-3.5 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  取消 (Esc)
                </button>
                <button
                  type="submit"
                  disabled={!modalTitle.trim()}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition-colors shadow-xs"
                >
                  添加日程 (Enter)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 右键快捷菜单 */}
      {contextMenu && (
        <TaskContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          task={contextMenu.task}
          lists={lists}
          onClose={() => setContextMenu(null)}
          onToggleComplete={onToggleComplete}
          onTogglePin={onTogglePin || (() => {})}
          onDeleteTask={(task) => setConfirmDeleteTask(task)}
          onUpdateTask={onUpdateTask}
        />
      )}

      {/* 删除任务确认弹窗 */}
      <DeleteConfirmModal
        task={confirmDeleteTask}
        onCancel={() => setConfirmDeleteTask(null)}
        onConfirm={() => {
          if (confirmDeleteTask && onDeleteTask) {
            onDeleteTask(confirmDeleteTask.id);
            setConfirmDeleteTask(null);
          }
        }}
      />
    </div>
  );
};
