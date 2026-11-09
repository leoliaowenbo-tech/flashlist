import React, { useState, useEffect } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  X, 
  Calendar as CalendarIcon
} from 'lucide-react';
import { 
  format, 
  parseISO, 
  isValid, 
  isToday, 
  addDays, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  addMonths, 
  subMonths,
  nextSaturday,
  nextMonday
} from 'date-fns';

interface DatePickerPopoverProps {
  dueDate?: string;
  dueTime?: string;
  onChange: (dueDate: string | undefined, dueTime?: string | undefined) => void;
  onClose: () => void;
}

export const DatePickerPopover: React.FC<DatePickerPopoverProps> = ({
  dueDate,
  dueTime,
  onChange,
  onClose,
}) => {
  // 当前正在浏览的月份视图
  const [viewMonth, setViewMonth] = useState<Date>(() => {
    if (dueDate) {
      try {
        const d = parseISO(dueDate);
        if (isValid(d)) return d;
      } catch (e) {
        /* ignore */
      }
    }
    return new Date();
  });

  // 如果外部传入的 dueDate 发生改变且有效，同步更新浏览的月份
  useEffect(() => {
    if (dueDate) {
      try {
        const d = parseISO(dueDate);
        if (isValid(d)) {
          setViewMonth(d);
        }
      } catch (e) {
        /* ignore */
      }
    }
  }, [dueDate]);

  // 快捷日期计算
  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');
  const tomorrowStr = format(addDays(today, 1), 'yyyy-MM-dd');
  const weekendDate = nextSaturday(today);
  const weekendStr = format(weekendDate, 'yyyy-MM-dd');
  const nextWeekDate = nextMonday(today);
  const nextWeekStr = format(nextWeekDate, 'yyyy-MM-dd');

  // 日历网格计算（周一至周日）
  const monthStart = startOfMonth(viewMonth);
  const monthEnd = endOfMonth(monthStart);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const monthDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  // 切换月份
  const handlePrevMonth = () => setViewMonth(prev => subMonths(prev, 1));
  const handleNextMonth = () => setViewMonth(prev => addMonths(prev, 1));
  const handleJumpToToday = () => {
    setViewMonth(today);
    onChange(todayStr, dueTime);
  };

  const handleSelectDay = (day: Date) => {
    const dayStr = format(day, 'yyyy-MM-dd');
    onChange(dayStr, dueTime);
    if (!isSameMonth(day, viewMonth)) {
      setViewMonth(day);
    }
  };

  const handleQuickSelect = (targetStr: string, targetDate: Date) => {
    onChange(targetStr, dueTime);
    setViewMonth(targetDate);
  };

  const handleClear = () => {
    onChange(undefined, undefined);
  };

  const timePresets = ['09:00', '12:00', '18:00', '21:00'];

  return (
    <div 
      className="absolute left-0 top-full mt-2 w-[288px] bg-white rounded-2xl shadow-2xl border border-slate-200/90 p-3.5 z-50 text-xs animate-in fade-in zoom-in-95 duration-150 select-none text-slate-700"
      onClick={(e) => e.stopPropagation()}
    >
      {/* 快捷推荐胶囊栏 */}
      <div className="grid grid-cols-4 gap-1.5 mb-3">
        <button
          type="button"
          onClick={() => handleQuickSelect(todayStr, today)}
          className={`py-1 px-1.5 text-center rounded-lg text-[11px] font-medium transition-all ${
            dueDate === todayStr
              ? 'bg-blue-600 text-white shadow-xs font-semibold'
              : 'bg-slate-50 hover:bg-blue-50 hover:text-blue-600 text-slate-600 border border-slate-100'
          }`}
        >
          今天
        </button>
        <button
          type="button"
          onClick={() => handleQuickSelect(tomorrowStr, addDays(today, 1))}
          className={`py-1 px-1.5 text-center rounded-lg text-[11px] font-medium transition-all ${
            dueDate === tomorrowStr
              ? 'bg-blue-600 text-white shadow-xs font-semibold'
              : 'bg-slate-50 hover:bg-blue-50 hover:text-blue-600 text-slate-600 border border-slate-100'
          }`}
        >
          明天
        </button>
        <button
          type="button"
          onClick={() => handleQuickSelect(weekendStr, weekendDate)}
          className={`py-1 px-1.5 text-center rounded-lg text-[11px] font-medium transition-all ${
            dueDate === weekendStr
              ? 'bg-blue-600 text-white shadow-xs font-semibold'
              : 'bg-slate-50 hover:bg-blue-50 hover:text-blue-600 text-slate-600 border border-slate-100'
          }`}
        >
          本周末
        </button>
        <button
          type="button"
          onClick={() => handleQuickSelect(nextWeekStr, nextWeekDate)}
          className={`py-1 px-1.5 text-center rounded-lg text-[11px] font-medium transition-all ${
            dueDate === nextWeekStr
              ? 'bg-blue-600 text-white shadow-xs font-semibold'
              : 'bg-slate-50 hover:bg-blue-50 hover:text-blue-600 text-slate-600 border border-slate-100'
          }`}
        >
          下周
        </button>
      </div>

      {/* 月份导航栏 */}
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-slate-800 text-[13px] tracking-tight">
            {format(viewMonth, 'yyyy年 M月')}
          </span>
          {!isSameMonth(viewMonth, today) && (
            <button
              type="button"
              onClick={handleJumpToToday}
              className="text-[10px] text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100/80 px-1.5 py-0.5 rounded transition-colors"
              title="回到今天所在的月份"
            >
              今
            </button>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            title="上个月"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={handleNextMonth}
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            title="下个月"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* 星期表头 */}
      <div className="grid grid-cols-7 mb-1 text-center">
        {['一', '二', '三', '四', '五', '六', '日'].map((w, idx) => (
          <span 
            key={idx} 
            className={`text-[11px] font-semibold py-0.5 ${
              idx >= 5 ? 'text-blue-500/80' : 'text-slate-400'
            }`}
          >
            {w}
          </span>
        ))}
      </div>

      {/* 日历日期矩阵 */}
      <div className="grid grid-cols-7 gap-y-1 mb-3">
        {monthDays.map((day, idx) => {
          const dStr = format(day, 'yyyy-MM-dd');
          const isSelected = dueDate === dStr;
          const isCurrentDay = isToday(day);
          const inCurrentMonth = isSameMonth(day, viewMonth);

          return (
            <div key={idx} className="flex items-center justify-center">
              <button
                type="button"
                onClick={() => handleSelectDay(day)}
                className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-medium transition-all ${
                  isSelected
                    ? 'bg-blue-600 text-white font-bold shadow-sm shadow-blue-500/40 ring-2 ring-blue-600/20 scale-105'
                    : isCurrentDay
                      ? 'border border-blue-500 text-blue-600 font-bold bg-blue-50/60 hover:bg-blue-100/60'
                      : inCurrentMonth
                        ? 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                        : 'text-slate-300 hover:bg-slate-50 hover:text-slate-500'
                }`}
                title={dStr}
              >
                {format(day, 'd')}
              </button>
            </div>
          );
        })}
      </div>

      {/* 时间提醒与设置 */}
      <div className="pt-2.5 border-t border-slate-100 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-slate-600 font-medium text-[11px]">
            <Clock size={13} className="text-slate-400" />
            <span>时间提醒</span>
          </div>
          <div className="flex items-center gap-1">
            <input
              type="time"
              value={dueTime || ''}
              onChange={(e) => {
                const val = e.target.value || undefined;
                onChange(dueDate || todayStr, val);
              }}
              className="px-2 py-0.5 text-xs bg-slate-50 border border-slate-200 rounded-md text-slate-700 focus:outline-none focus:border-blue-500 focus:bg-white"
            />
            {dueTime && (
              <button
                type="button"
                onClick={() => onChange(dueDate, undefined)}
                className="p-1 text-slate-400 hover:text-red-500 rounded hover:bg-slate-100 transition-colors"
                title="清除时间提醒"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* 常用时间快捷点选 */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-slate-400 shrink-0">快捷:</span>
          <div className="flex items-center gap-1 flex-1">
            {timePresets.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => onChange(dueDate || todayStr, t)}
                className={`flex-1 py-0.5 text-[10px] rounded transition-colors text-center ${
                  dueTime === t
                    ? 'bg-blue-50 text-blue-600 font-semibold border border-blue-200'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-500 border border-slate-100'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 底部操作栏 */}
      <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
        <div>
          {(dueDate || dueTime) && (
            <button
              type="button"
              onClick={handleClear}
              className="text-rose-500 hover:text-rose-600 hover:bg-rose-50 px-2 py-1 rounded-md text-[11px] font-medium transition-colors"
            >
              清除日期
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="px-3.5 py-1 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-lg text-xs font-medium shadow-xs transition-colors"
        >
          确定
        </button>
      </div>
    </div>
  );
};
