import React, { useState, useEffect, useMemo } from 'react';
import { 
  FileText, 
  Copy, 
  Download, 
  RefreshCw, 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Trash2, 
  Sparkles, 
  Check, 
  CheckCircle2, 
  Clock, 
  Edit3, 
  Eye, 
  ListPlus, 
  ArrowRightLeft, 
  X,
  ArrowRight,
  SunMedium,
  CheckSquare
} from 'lucide-react';
import { Task } from '../types';
import { 
  DailyReportItem, 
  DailyReportFormatStyle, 
  extractDailyReportItems, 
  generateDailyReportContent, 
  copyDailyReportToClipboard, 
  downloadDailyReportFile 
} from '../utils/dailyReportGenerator';
import { extractTaskMetadata, rephraseTaskToReportLanguage } from '../utils/localReportRephraser';
import { format, addDays, subDays, isToday, isSameDay, parseISO, isValid } from 'date-fns';

interface DailyReportViewProps {
  tasks: Task[];
  onBackToTasks?: () => void;
  onSwitchToWeekly?: () => void;
}

export const DailyReportView: React.FC<DailyReportViewProps> = ({
  tasks,
  onBackToTasks,
  onSwitchToWeekly,
}) => {
  // 当前日报选定日期 (默认今天)
  const [reportDate, setReportDate] = useState<Date>(new Date());

  // 选项设置
  const [enableRephrasing, setEnableRephrasing] = useState<boolean>(true); // 默认开启智能转述
  const [withNumbering, setWithNumbering] = useState<boolean>(true); // 默认带 1. 2. 3. 序号
  const [formatStyle, setFormatStyle] = useState<DailyReportFormatStyle>('standard');
  const [isDirectEditing, setIsDirectEditing] = useState<boolean>(false);
  const [editedText, setEditedText] = useState<string>('');

  // 今日完成条目与明日预计条目
  const [completedItems, setCompletedItems] = useState<DailyReportItem[]>([]);
  const [plannedItems, setPlannedItems] = useState<DailyReportItem[]>([]);

  // 快捷添加输入框
  const [newCompletedInput, setNewCompletedInput] = useState<string>('');
  const [newPlannedInput, setNewPlannedInput] = useState<string>('');

  // 从待办列表中快速选取的弹窗
  const [showTaskPicker, setShowTaskPicker] = useState<boolean>(false);

  // 反馈状态
  const [copied, setCopied] = useState<boolean>(false);
  const [copyToast, setCopyToast] = useState<string | null>(null);
  const [activeMobileTab, setActiveMobileTab] = useState<'organize' | 'preview'>('preview');

  // 单条内联编辑
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState<string>('');

  // 扫描并初始化指定日期的任务
  const scanTasks = (targetDate: Date = reportDate, rephraseFlag: boolean = enableRephrasing) => {
    const { completedItems: c, plannedItems: p } = extractDailyReportItems(tasks, targetDate, {
      enableRephrasing: rephraseFlag,
    });
    setCompletedItems(c);
    setPlannedItems(p);
    setIsDirectEditing(false);
  };

  // 当任务变动或目标日期变动时自动重新扫描
  useEffect(() => {
    scanTasks(reportDate, enableRephrasing);
  }, [reportDate, tasks]);

  // 联动更新预览文本
  useEffect(() => {
    if (!isDirectEditing) {
      const text = generateDailyReportContent(completedItems, plannedItems, reportDate, {
        formatStyle,
        withNumbering,
      });
      setEditedText(text);
    }
  }, [completedItems, plannedItems, reportDate, formatStyle, withNumbering, isDirectEditing]);

  const showToast = (msg: string) => {
    setCopyToast(msg);
    setTimeout(() => setCopyToast(null), 3000);
  };

  // 切换智能转述
  const handleToggleRephrase = () => {
    const nextVal = !enableRephrasing;
    setEnableRephrasing(nextVal);
    scanTasks(reportDate, nextVal);
    showToast(nextVal ? '已开启规范汇报语言智能转述 (自动识别学校/课程/规范动作)' : '已切换为原始任务标题模式');
  };

  // 添加自定义已完成
  const handleAddCompleted = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = newCompletedInput.trim();
    if (!text) return;
    const meta = extractTaskMetadata(text);
    const title = enableRephrasing ? rephraseTaskToReportLanguage(text, 'daily') : text;
    setCompletedItems((prev) => [
      ...prev,
      {
        id: `custom_comp_${Date.now()}`,
        title,
        rawTitle: text,
        school: meta.school,
        course: meta.course,
        action: meta.actionText,
        type: 'completed',
        isCustom: true,
      },
    ]);
    setNewCompletedInput('');
  };

  // 添加自定义明日预计
  const handleAddPlanned = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = newPlannedInput.trim();
    if (!text) return;
    const meta = extractTaskMetadata(text);
    const title = enableRephrasing ? rephraseTaskToReportLanguage(text, 'daily') : text;
    setPlannedItems((prev) => [
      ...prev,
      {
        id: `custom_plan_${Date.now()}`,
        title,
        rawTitle: text,
        school: meta.school,
        course: meta.course,
        action: meta.actionText,
        type: 'planned',
        isCustom: true,
      },
    ]);
    setNewPlannedInput('');
  };

  // 删除条目
  const handleDeleteItem = (id: string, type: 'completed' | 'planned') => {
    if (type === 'completed') {
      setCompletedItems((prev) => prev.filter((item) => item.id !== id));
    } else {
      setPlannedItems((prev) => prev.filter((item) => item.id !== id));
    }
  };

  // 在今日完成与明日预计之间移动条目
  const handleMoveItem = (item: DailyReportItem) => {
    if (item.type === 'completed') {
      setCompletedItems((prev) => prev.filter((i) => i.id !== item.id));
      setPlannedItems((prev) => [...prev, { ...item, type: 'planned' }]);
    } else {
      setPlannedItems((prev) => prev.filter((i) => i.id !== item.id));
      setCompletedItems((prev) => [...prev, { ...item, type: 'completed' }]);
    }
  };

  // 保存内联编辑
  const handleSaveInlineEdit = (id: string, type: 'completed' | 'planned') => {
    if (!editingText.trim()) return;
    const updater = (list: DailyReportItem[]) =>
      list.map((item) => (item.id === id ? { ...item, title: editingText.trim() } : item));
    if (type === 'completed') {
      setCompletedItems(updater);
    } else {
      setPlannedItems(updater);
    }
    setEditingId(null);
  };

  // 从未完成待办中快速加入明日预计
  const handleImportTaskToPlanned = (task: Task) => {
    const meta = extractTaskMetadata(task.title, task.desc);
    const title = enableRephrasing ? rephraseTaskToReportLanguage(task.title, 'daily') : task.title;
    setPlannedItems((prev) => [
      ...prev,
      {
        id: `imported_plan_${task.id}_${Date.now()}`,
        sourceTaskId: task.id,
        title,
        rawTitle: task.title,
        school: meta.school,
        course: meta.course,
        action: meta.actionText,
        type: 'planned',
      },
    ]);
    showToast(`已将「${task.title}」加入明日预计`);
  };

  // 一键复制
  const handleCopy = async () => {
    const textToCopy = isDirectEditing
      ? editedText
      : generateDailyReportContent(completedItems, plannedItems, reportDate, {
          formatStyle,
          withNumbering,
        });

    const success = await copyDailyReportToClipboard(textToCopy);
    if (success) {
      setCopied(true);
      showToast('工作日报已成功复制到剪贴板！可直接粘贴至微信/钉钉/邮件');
      setTimeout(() => setCopied(false), 2000);
    } else {
      showToast('复制失败，请手动全选复制');
    }
  };

  // 下载导出
  const handleDownload = () => {
    const textToExport = isDirectEditing
      ? editedText
      : generateDailyReportContent(completedItems, plannedItems, reportDate, {
          formatStyle,
          withNumbering,
        });
    downloadDailyReportFile(textToExport, reportDate, formatStyle);
    showToast('日报文件已开始下载！');
  };

  // 待办任务列表候选 (未完成)
  const uncompletedTasks = useMemo(() => {
    return tasks.filter((t) => !t.completed);
  }, [tasks]);

  const weekdayNames = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  const dateDisplay = `${format(reportDate, 'yyyy年MM月dd日')} ${weekdayNames[reportDate.getDay()]}`;

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 overflow-hidden select-none relative">
      {/* 顶部全局提示 Toast */}
      {copyToast && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-slate-900/90 text-white px-4 py-2 rounded-xl text-xs shadow-xl flex items-center gap-2 backdrop-blur-xs animate-in fade-in slide-in-from-top-2 duration-200">
          <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
          <span>{copyToast}</span>
        </div>
      )}

      {/* 顶栏工具栏 */}
      <div className="min-h-14 border-b border-slate-200/80 px-3 md:px-6 py-2 flex items-center justify-between flex-wrap gap-2 shrink-0 bg-white shadow-2xs">
        {/* 左侧：标题、日报/周报切换、日期切换 */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* 日报 / 周报 切换标签组 */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200/80">
            <button
              type="button"
              className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-white text-blue-600 shadow-xs"
            >
              <SunMedium size={13} className="text-amber-500" />
              <span>日报</span>
            </button>
            <button
              type="button"
              onClick={onSwitchToWeekly}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors"
            >
              <FileText size={13} className="text-slate-400" />
              <span>周报</span>
            </button>
          </div>

          <div className="h-4 w-[1px] bg-slate-200 mx-0.5 hidden sm:block" />

          {/* 日期导航 */}
          <div className="flex items-center gap-1 bg-slate-50 border border-slate-200/80 rounded-lg p-0.5">
            <button
              onClick={() => setReportDate((prev) => subDays(prev, 1))}
              className="p-1 rounded hover:bg-white hover:shadow-2xs text-slate-500 hover:text-slate-800 transition-all"
              title="前一天"
            >
              <ChevronLeft size={15} />
            </button>

            <span className="text-xs font-semibold text-slate-700 px-1.5 min-w-[115px] text-center">
              {dateDisplay}
            </span>

            <button
              onClick={() => setReportDate((prev) => addDays(prev, 1))}
              className="p-1 rounded hover:bg-white hover:shadow-2xs text-slate-500 hover:text-slate-800 transition-all"
              title="后一天"
            >
              <ChevronRight size={15} />
            </button>
          </div>

          {/* 快捷跳转至“今天” */}
          {!isToday(reportDate) && (
            <button
              onClick={() => setReportDate(new Date())}
              className="text-[11px] font-medium text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100/70 px-2 py-1 rounded-md transition-colors"
            >
              今天
            </button>
          )}
        </div>

        {/* 右侧：转述、序号、编辑模式、一键复制、导出、返回 */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* 智能规范转述开关 */}
          <button
            onClick={handleToggleRephrase}
            className={`flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg border transition-all ${
              enableRephrasing
                ? 'bg-amber-50 text-amber-700 border-amber-300 font-medium shadow-2xs'
                : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
            }`}
            title="自动识别学校全称、课程《书名号》并规范化为汇报动作"
          >
            <Sparkles size={13} className={enableRephrasing ? 'text-amber-500 animate-spin-slow' : 'text-slate-400'} />
            <span className="hidden sm:inline">智能规范转述</span>
          </button>

          {/* 1.2.3 自动序号开关 */}
          <button
            onClick={() => setWithNumbering(!withNumbering)}
            className={`hidden sm:flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border transition-all ${
              withNumbering
                ? 'bg-blue-50 text-blue-700 border-blue-200 font-medium'
                : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
            }`}
            title="开启/关闭序号 1. 2. 3. 换行排版"
          >
            <span>序号换行</span>
          </button>

          {/* 格式切换: 标准文本 / Markdown */}
          <div className="hidden lg:flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
            <button
              onClick={() => setFormatStyle('standard')}
              className={`px-2 py-1 rounded-md transition-all font-medium ${
                formatStyle === 'standard' ? 'bg-white text-slate-800 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              标准文本
            </button>
            <button
              onClick={() => setFormatStyle('markdown')}
              className={`px-2 py-1 rounded-md transition-all font-medium ${
                formatStyle === 'markdown' ? 'bg-white text-slate-800 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Markdown
            </button>
          </div>

          {/* 自由编辑模式切换 */}
          <button
            onClick={() => setIsDirectEditing(!isDirectEditing)}
            className={`flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg border transition-all ${
              isDirectEditing
                ? 'bg-purple-50 text-purple-700 border-purple-200 font-medium'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {isDirectEditing ? <Eye size={13} /> : <Edit3 size={13} />}
            <span className="hidden sm:inline">{isDirectEditing ? '预览模式' : '自由编辑'}</span>
          </button>

          {/* 一键复制 */}
          <button
            onClick={handleCopy}
            className={`flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg shadow-xs transition-all active:scale-95 ${
              copied
                ? 'bg-emerald-600 text-white'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            <span>{copied ? '已复制' : '复制日报'}</span>
          </button>

          {/* 下载文件 */}
          <button
            onClick={handleDownload}
            className="hidden sm:flex p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition-colors"
            title="下载为文件"
          >
            <Download size={14} />
          </button>

          {/* 返回任务列表 */}
          {onBackToTasks && (
            <button
              onClick={onBackToTasks}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors hidden md:block"
            >
              返回待办
            </button>
          )}
        </div>
      </div>

      {/* 手机端专属 Tab 切换 */}
      <div className="md:hidden flex border-b border-slate-200 bg-white shrink-0">
        <button
          onClick={() => setActiveMobileTab('preview')}
          className={`flex-1 py-2 text-xs font-medium border-b-2 text-center transition-colors ${
            activeMobileTab === 'preview'
              ? 'border-blue-600 text-blue-600 font-semibold'
              : 'border-transparent text-slate-500'
          }`}
        >
          日报预览与复制
        </button>
        <button
          onClick={() => setActiveMobileTab('organize')}
          className={`flex-1 py-2 text-xs font-medium border-b-2 text-center transition-colors ${
            activeMobileTab === 'organize'
              ? 'border-blue-600 text-blue-600 font-semibold'
              : 'border-transparent text-slate-500'
          }`}
        >
          今日/明日条目整理 ({completedItems.length + plannedItems.length}项)
        </button>
      </div>

      {/* 主体工作区：左右双栏（手机端按 Tab 切换） */}
      <div className="flex-1 flex overflow-hidden p-3 md:p-4 gap-4 min-h-0">
        {/* 左栏：今日完成 与 明日预计 结构化任务列表 */}
        <div className={`w-full md:w-1/2 flex-col gap-4 overflow-y-auto pr-0.5 ${
          activeMobileTab === 'organize' ? 'flex' : 'hidden md:flex'
        }`}>
          {/* 卡片 1: 今日完成工作 */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-4 flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xs">
                  一
                </div>
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <span>今日完成工作</span>
                  <span className="text-xs font-normal text-slate-400">
                    ({completedItems.length} 项)
                  </span>
                </h3>
              </div>
              <button
                type="button"
                onClick={() => scanTasks(reportDate, enableRephrasing)}
                className="text-[11px] text-slate-400 hover:text-blue-600 flex items-center gap-1 transition-colors"
                title="重新扫描今日已完成任务"
              >
                <RefreshCw size={11} />
                <span>刷新</span>
              </button>
            </div>

            {/* 条目列表 */}
            <div className="py-2.5 space-y-2 flex-1">
              {completedItems.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                  <CheckCircle2 size={24} className="mx-auto mb-1 text-slate-300" />
                  <p>该日期下暂无标记完成的任务</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">可以在下方直接输入添加，或在任务列表中勾选完成</p>
                </div>
              ) : (
                completedItems.map((item, idx) => (
                  <div
                    key={item.id}
                    className="group flex items-start gap-2 p-2 rounded-xl bg-slate-50/70 hover:bg-slate-100/80 border border-slate-100 hover:border-slate-200 transition-all text-xs"
                  >
                    <span className="font-semibold text-emerald-600 shrink-0 mt-0.5">
                      {idx + 1}.
                    </span>

                    {editingId === item.id ? (
                      <div className="flex-1 flex items-center gap-1.5">
                        <input
                          type="text"
                          value={editingText}
                          onChange={(e) => setEditingText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveInlineEdit(item.id, 'completed');
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          autoFocus
                          className="flex-1 px-2 py-1 text-xs bg-white border border-blue-400 rounded-md outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveInlineEdit(item.id, 'completed')}
                          className="p-1 text-emerald-600 hover:bg-white rounded"
                        >
                          <Check size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="p-1 text-slate-400 hover:bg-white rounded"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex-1 text-slate-700 leading-relaxed select-text">
                          {item.title}
                        </div>

                        {/* 操作悬浮菜单 */}
                        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 shrink-0 transition-opacity">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(item.id);
                              setEditingText(item.title);
                            }}
                            className="p-1 text-slate-400 hover:text-blue-600 rounded hover:bg-white transition-colors"
                            title="编辑"
                          >
                            <Edit3 size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveItem(item)}
                            className="p-1 text-slate-400 hover:text-indigo-600 rounded hover:bg-white transition-colors"
                            title="移动至明日预计"
                          >
                            <ArrowRightLeft size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteItem(item.id, 'completed')}
                            className="p-1 text-slate-400 hover:text-red-500 rounded hover:bg-white transition-colors"
                            title="删除"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* 新增输入 */}
            <form onSubmit={handleAddCompleted} className="pt-2 border-t border-slate-100 flex gap-2">
              <input
                type="text"
                placeholder="+ 输入今日完成的工作，回车快速添加..."
                value={newCompletedInput}
                onChange={(e) => setNewCompletedInput(e.target.value)}
                className="flex-1 px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-blue-500 transition-all text-slate-700"
              />
              <button
                type="submit"
                disabled={!newCompletedInput.trim()}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-xl text-xs font-medium transition-colors"
              >
                添加
              </button>
            </form>
          </div>

          {/* 卡片 2: 明日预计工作 */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-4 flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs">
                  二
                </div>
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <span>明日预计工作</span>
                  <span className="text-xs font-normal text-slate-400">
                    ({plannedItems.length} 项)
                  </span>
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowTaskPicker(!showTaskPicker)}
                className="text-[11px] text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100/70 px-2 py-0.5 rounded-lg flex items-center gap-1 font-medium transition-colors"
              >
                <ListPlus size={12} />
                <span>从待办任务添加</span>
              </button>
            </div>

            {/* 条目列表 */}
            <div className="py-2.5 space-y-2 flex-1">
              {plannedItems.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                  <Clock size={24} className="mx-auto mb-1 text-slate-300" />
                  <p>暂无明日预计任务</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">可以在下方直接输入添加，或点击右上角“从待办任务添加”</p>
                </div>
              ) : (
                plannedItems.map((item, idx) => (
                  <div
                    key={item.id}
                    className="group flex items-start gap-2 p-2 rounded-xl bg-slate-50/70 hover:bg-slate-100/80 border border-slate-100 hover:border-slate-200 transition-all text-xs"
                  >
                    <span className="font-semibold text-blue-600 shrink-0 mt-0.5">
                      {idx + 1}.
                    </span>

                    {editingId === item.id ? (
                      <div className="flex-1 flex items-center gap-1.5">
                        <input
                          type="text"
                          value={editingText}
                          onChange={(e) => setEditingText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveInlineEdit(item.id, 'planned');
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          autoFocus
                          className="flex-1 px-2 py-1 text-xs bg-white border border-blue-400 rounded-md outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveInlineEdit(item.id, 'planned')}
                          className="p-1 text-blue-600 hover:bg-white rounded"
                        >
                          <Check size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="p-1 text-slate-400 hover:bg-white rounded"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex-1 text-slate-700 leading-relaxed select-text">
                          {item.title}
                        </div>

                        {/* 操作悬浮菜单 */}
                        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 shrink-0 transition-opacity">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(item.id);
                              setEditingText(item.title);
                            }}
                            className="p-1 text-slate-400 hover:text-blue-600 rounded hover:bg-white transition-colors"
                            title="编辑"
                          >
                            <Edit3 size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveItem(item)}
                            className="p-1 text-slate-400 hover:text-emerald-600 rounded hover:bg-white transition-colors"
                            title="移动至今日完成"
                          >
                            <ArrowRightLeft size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteItem(item.id, 'planned')}
                            className="p-1 text-slate-400 hover:text-red-500 rounded hover:bg-white transition-colors"
                            title="删除"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* 新增输入 */}
            <form onSubmit={handleAddPlanned} className="pt-2 border-t border-slate-100 flex gap-2">
              <input
                type="text"
                placeholder="+ 输入明日预计的工作，回车快速添加..."
                value={newPlannedInput}
                onChange={(e) => setNewPlannedInput(e.target.value)}
                className="flex-1 px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-blue-500 transition-all text-slate-700"
              />
              <button
                type="submit"
                disabled={!newPlannedInput.trim()}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-xl text-xs font-medium transition-colors"
              >
                添加
              </button>
            </form>
          </div>
        </div>

        {/* 右栏：实时预览与一键复制面板 */}
        <div className={`w-full md:w-1/2 bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-4 flex-col ${
          activeMobileTab === 'preview' ? 'flex' : 'hidden md:flex'
        }`}>
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
            <div className="flex items-center gap-2">
              <FileText size={16} className="text-blue-600" />
              <h3 className="text-sm font-bold text-slate-800">
                {isDirectEditing ? '自由编辑日报文本' : '日报生成预览'}
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400">
                {editedText.length} 字
              </span>
              <button
                type="button"
                onClick={handleCopy}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold shadow-xs transition-all active:scale-95 ${
                  copied
                    ? 'bg-emerald-600 text-white'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                {copied ? <Check size={13} /> : <Copy size={13} />}
                <span>{copied ? '已复制' : '复制预览'}</span>
              </button>
            </div>
          </div>

          {/* 预览与编辑主体 */}
          <div className="flex-1 mt-3 overflow-hidden flex flex-col">
            {isDirectEditing ? (
              <textarea
                value={editedText}
                onChange={(e) => setEditedText(e.target.value)}
                placeholder="在此直接编辑日报文字..."
                className="w-full flex-1 p-3.5 bg-slate-50/70 border border-slate-200 rounded-xl text-xs leading-relaxed text-slate-800 font-mono outline-none focus:border-blue-500 focus:bg-white resize-none"
              />
            ) : (
              <div className="flex-1 p-4 bg-slate-50/70 border border-slate-100 rounded-xl overflow-y-auto font-mono text-xs leading-relaxed text-slate-800 whitespace-pre-wrap select-text">
                {editedText}
              </div>
            )}
          </div>

          {/* 底部使用提示 */}
          <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
            <span>支持自由调整、一键复制并粘贴至企业微信或工作群</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => scanTasks(reportDate, enableRephrasing)}
                className="hover:text-blue-600 transition-colors"
              >
                重置内容
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 从未完成待办中快速加入明日预计的弹窗 */}
      {showTaskPicker && (
        <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-4 border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <ListPlus size={16} className="text-blue-600" />
                <span>选择待办任务加入「明日预计工作」</span>
              </h3>
              <button
                onClick={() => setShowTaskPicker(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X size={15} />
              </button>
            </div>

            <div className="max-h-72 overflow-y-auto py-2 space-y-1.5">
              {uncompletedTasks.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-400">
                  暂无未完成的待办任务
                </div>
              ) : (
                uncompletedTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between p-2 rounded-xl bg-slate-50 hover:bg-blue-50/60 border border-slate-100 hover:border-blue-200 transition-all text-xs"
                  >
                    <div className="flex-1 truncate mr-2">
                      <p className="font-medium text-slate-700 truncate">{task.title}</p>
                      {task.dueDate && (
                        <p className="text-[10px] text-slate-400">截止: {task.dueDate}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleImportTaskToPlanned(task)}
                      className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-medium shrink-0 transition-colors"
                    >
                      加入明日
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setShowTaskPicker(false)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition-colors"
              >
                完成
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
