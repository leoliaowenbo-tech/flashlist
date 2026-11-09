import React, { useState, useEffect, useMemo } from 'react';
import { 
  FileText, 
  Copy, 
  Download, 
  Printer, 
  RefreshCw, 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Trash2, 
  Sparkles, 
  Check, 
  CheckCircle2, 
  Edit3, 
  Eye, 
  FolderCheck, 
  Layers,
  ArrowRight,
  ExternalLink,
  BookOpen,
  Filter,
  CheckSquare,
  SunMedium
} from 'lucide-react';
import { Task } from '../types';
import { 
  REPORT_SECTIONS, 
  ReportItem, 
  TEMPLATE_EXAMPLE_ITEMS, 
  getWeekRange, 
  convertTasksToReportItems, 
  generateWeeklyReportContent, 
  copyReportToClipboard, 
  downloadReportFile,
  ExportFormatStyle,
  getAvailableWeeksWithTaskCounts,
  AvailableWeekOption
} from '../utils/weeklyReportGenerator';
import { extractTaskMetadata, rephraseTaskToReportLanguage, KNOWN_SCHOOLS } from '../utils/localReportRephraser';
import { format, addWeeks, subWeeks, parseISO, startOfDay, endOfDay } from 'date-fns';

interface WeeklyReportViewProps {
  tasks: Task[];
  onBackToTasks?: () => void;
  onSwitchToDaily?: () => void;
}

export const WeeklyReportView: React.FC<WeeklyReportViewProps> = ({ 
  tasks,
  onBackToTasks,
  onSwitchToDaily
}) => {
  // 当前基准日期与周偏移量 (0: 本周, -1: 上周, 1: 下周)
  const [weekOffset, setWeekOffset] = useState<number>(0);
  const [baseDate, setBaseDate] = useState<Date>(new Date());
  
  // 自定义日期范围模式
  const [useCustomRange, setUseCustomRange] = useState<boolean>(false);
  const [customStart, setCustomStart] = useState<string>(format(subWeeks(new Date(), 1), 'yyyy-MM-dd'));
  const [customEnd, setCustomEnd] = useState<string>(format(new Date(), 'yyyy-MM-dd'));

  // 任务纳入筛选条件
  const [includeCompleted, setIncludeCompleted] = useState<boolean>(true);
  const [includeDue, setIncludeDue] = useState<boolean>(true);
  const [includeCreated, setIncludeCreated] = useState<boolean>(false);

  // 本地周报语言规范转述开关 (默认开启：自动抽取学校、课程书名号、规范完成动作)
  const [enableRephrasing, setEnableRephrasing] = useState<boolean>(true);

  // 模板示例预览模式标识 (为 true 时显示模板示例，切换周自动退出该模式并加载真实任务)
  const [isExampleMode, setIsExampleMode] = useState<boolean>(false);

  // 周报条目状态
  const [reportItems, setReportItems] = useState<ReportItem[]>([]);
  
  // 预览格式与视图模式
  const [formatStyle, setFormatStyle] = useState<ExportFormatStyle>('standard');
  const [withNumbering, setWithNumbering] = useState<boolean>(true); // 默认自动换行并加 1. 2. 3. 序号
  const [isDirectEditing, setIsDirectEditing] = useState<boolean>(false);
  const [editedText, setEditedText] = useState<string>('');
  const [activeMobileTab, setActiveMobileTab] = useState<'organize' | 'preview'>('preview');

  // 操作反馈状态
  const [copied, setCopied] = useState<boolean>(false);
  const [copyToast, setCopyToast] = useState<string | null>(null);
  
  // 新增项目输入框状态 (sectionId -> text)
  const [newInputs, setNewInputs] = useState<Record<string, string>>({});
  // 正在内联编辑的项目 ID
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemText, setEditingItemText] = useState<string>('');

  // 扫描计算最近各周的历史任务分布，供周选择下拉菜单快捷切换使用
  const availableWeeks = useMemo(() => {
    return getAvailableWeeksWithTaskCounts(tasks, { includeCompleted, includeDue });
  }, [tasks, includeCompleted, includeDue]);

  // 计算当前周的起止范围 (包含 startOfDay 与 endOfDay 全覆盖)
  const currentWeekInfo = useMemo(() => {
    if (useCustomRange && customStart && customEnd) {
      try {
        const s = startOfDay(parseISO(customStart));
        const e = endOfDay(parseISO(customEnd));
        return {
          start: s,
          end: e,
          displayLabel: `自定义范围 (${customStart} ~ ${customEnd})`,
          year: s.getFullYear(),
          isoWeek: 0,
        };
      } catch (err) {
        // fallback
      }
    }
    return getWeekRange(baseDate, weekOffset);
  }, [baseDate, weekOffset, useCustomRange, customStart, customEnd]);

  // 从当前任务列表初始化/扫描生成周报条目
  const scanTasksIntoReport = (rephraseFlag?: boolean) => {
    const flag = typeof rephraseFlag === 'boolean' ? rephraseFlag : enableRephrasing;
    const items = convertTasksToReportItems(tasks, currentWeekInfo, {
      includeCompleted,
      includeDue,
      enableRephrasing: flag,
    });
    setReportItems(items);
    setIsDirectEditing(false);
    setIsExampleMode(false);
  };

  // 快捷切换周
  const handleChangeWeekOffset = (newOffset: number) => {
    setUseCustomRange(false);
    setIsExampleMode(false);
    setWeekOffset(newOffset);
    const target = availableWeeks.find(w => w.offset === newOffset);
    if (target) {
      showToast(`已切换至 ${target.shortLabel}，共找到 ${target.taskCount} 项工作`);
    }
  };

  // 切换智能转述开关
  const handleToggleRephrasing = () => {
    const nextVal = !enableRephrasing;
    setEnableRephrasing(nextVal);
    scanTasksIntoReport(nextVal);
    showToast(nextVal ? '已开启周报规范语言智能转述 (自动识别学校/课程/规范动作)' : '已切换为原始任务标题模式');
  };

  // 当周范围或任务列表变动时，默认自动提取对应周真实任务
  useEffect(() => {
    if (!isExampleMode) {
      scanTasksIntoReport();
    }
  }, [
    currentWeekInfo.start.getTime(), 
    currentWeekInfo.end.getTime(), 
    includeCompleted, 
    includeDue,
    tasks.length
  ]);

  // 联动更新预览文本
  useEffect(() => {
    if (!isDirectEditing) {
      const generated = generateWeeklyReportContent(reportItems, formatStyle, { withNumbering });
      setEditedText(generated);
    }
  }, [reportItems, formatStyle, withNumbering, isDirectEditing]);

  // 载入模板示例数据 (供用户参考排版)
  const handleLoadTemplateExample = () => {
    setIsExampleMode(true);
    setReportItems(TEMPLATE_EXAMPLE_ITEMS);
    setIsDirectEditing(false);
    showToast('已载入周报标准模板示例数据（仅供参考格式）');
  };

  // 添加自定义条目到板块
  const handleAddItem = (sectionId: string, subSectionId?: string) => {
    const textKey = subSectionId ? `${sectionId}_${subSectionId}` : sectionId;
    const text = (newInputs[textKey] || '').trim();
    if (!text) return;

    const meta = extractTaskMetadata(text);
    const rephrased = enableRephrasing
      ? rephraseTaskToReportLanguage(text, sectionId)
      : text;

    const newItem: ReportItem = {
      id: `custom_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title: rephrased || text,
      rawTitle: text,
      school: meta.school,
      course: meta.course,
      action: meta.actionText,
      sectionId,
      subSectionId,
      isCustom: true,
    };

    setReportItems(prev => [...prev, newItem]);
    setNewInputs(prev => ({ ...prev, [textKey]: '' }));
  };

  // 删除周报条目
  const handleDeleteItem = (itemId: string) => {
    setReportItems(prev => prev.filter(i => i.id !== itemId));
  };

  // 修改条目分类板块
  const handleMoveSection = (itemId: string, newSectionId: string, newSubSectionId?: string) => {
    setReportItems(prev => prev.map(i => {
      if (i.id === itemId) {
        return { ...i, sectionId: newSectionId, subSectionId: newSubSectionId };
      }
      return i;
    }));
  };

  // 保存内联编辑
  const handleSaveInlineEdit = (itemId: string) => {
    if (editingItemText.trim()) {
      setReportItems(prev => prev.map(i => {
        if (i.id === itemId) {
          return { ...i, title: editingItemText.trim() };
        }
        return i;
      }));
    }
    setEditingItemId(null);
    setEditingItemText('');
  };

  // 一键复制
  const handleCopy = async () => {
    const textToCopy = isDirectEditing 
      ? editedText 
      : generateWeeklyReportContent(reportItems, formatStyle, { withNumbering });
    const success = await copyReportToClipboard(textToCopy);
    if (success) {
      setCopied(true);
      showToast('周报全文已成功复制到剪贴板！可以直接粘贴到微信/飞书/邮件中');
      setTimeout(() => setCopied(false), 2500);
    } else {
      showToast('复制失败，请手动全选右侧文本复制');
    }
  };

  // 导出文本文件 (.txt)
  const handleExportTxt = () => {
    const content = isDirectEditing 
      ? editedText 
      : generateWeeklyReportContent(reportItems, formatStyle, { withNumbering });
    const filename = `${currentWeekInfo.displayLabel.replace(/[\s\(\)~:]+/g, '_')}_工作周报.txt`;
    downloadReportFile(filename, content, 'text/plain;charset=utf-8');
    showToast(`已导出 ${filename}`);
  };

  // 导出 Markdown 文件 (.md)
  const handleExportMd = () => {
    const content = generateWeeklyReportContent(reportItems, 'markdown', { withNumbering });
    const filename = `${currentWeekInfo.displayLabel.replace(/[\s\(\)~:]+/g, '_')}_工作周报.md`;
    downloadReportFile(filename, content, 'text/markdown;charset=utf-8');
    showToast(`已导出 ${filename}`);
  };

  // 打印或另存为 PDF
  const handlePrint = () => {
    window.print();
  };

  const showToast = (msg: string) => {
    setCopyToast(msg);
    setTimeout(() => setCopyToast(null), 3000);
  };

  // 计算条目总数与有效板块数
  const totalItemsCount = reportItems.length;
  const activeSectionsCount = REPORT_SECTIONS.filter(s => reportItems.some(i => i.sectionId === s.id)).length;

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-slate-50 overflow-hidden text-slate-800">
      {/* 顶部操作与周控制栏 - 单行紧凑高适用性布局，严防爆框折行 */}
      <header className="bg-white border-b border-slate-200 px-3 py-1.5 shrink-0 flex items-center justify-between flex-wrap gap-2 shadow-2xs">
        {/* 左侧：标题、徽章与日报/周报切换 */}
        <div className="flex items-center gap-2 shrink-0">
          {onSwitchToDaily && (
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200/80 mr-1">
              <button
                type="button"
                onClick={onSwitchToDaily}
                className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors"
                title="切换到工作日报"
              >
                <SunMedium size={13} className="text-amber-500" />
                <span>工作日报</span>
              </button>
              <button
                type="button"
                className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-white text-blue-600 shadow-xs"
              >
                <FileText size={13} className="text-blue-500" />
                <span>工作周报</span>
              </button>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-bold text-slate-800 whitespace-nowrap">周报导出</span>
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-100 whitespace-nowrap hidden xl:inline">
              业务标准模板
            </span>
          </div>
        </div>

        {/* 中间：周期切换与周次下拉快捷选择 */}
        <div className="flex items-center gap-1 bg-slate-100/90 p-0.5 rounded-xl border border-slate-200/80 shrink-0">
          <button
            onClick={() => handleChangeWeekOffset(weekOffset - 1)}
            className="p-1 hover:bg-white rounded-lg text-slate-600 transition-colors"
            title="上一周"
          >
            <ChevronLeft size={14} />
          </button>

          <div className="flex items-center gap-1 px-1 text-xs font-medium text-slate-700">
            <Calendar size={13} className="text-blue-600 shrink-0" />
            <select
              value={useCustomRange ? 'custom' : weekOffset}
              onChange={(e) => {
                const val = e.target.value;
                if (val === 'custom') {
                  setUseCustomRange(true);
                  setIsExampleMode(false);
                } else {
                  handleChangeWeekOffset(Number(val));
                }
              }}
              className="bg-white border border-slate-200 text-xs font-medium text-slate-800 rounded-lg px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-2xs cursor-pointer max-w-[165px] truncate"
              title="下拉切换任意周"
            >
              {availableWeeks.map((w) => (
                <option key={w.offset} value={w.offset}>
                  {w.displayLabel}
                </option>
              ))}
              <option value="custom">📅 自定义日期区间...</option>
            </select>
          </div>

          <button
            onClick={() => handleChangeWeekOffset(weekOffset + 1)}
            className="p-1 hover:bg-white rounded-lg text-slate-600 transition-colors"
            title="下一周"
          >
            <ChevronRight size={14} />
          </button>

          {(weekOffset !== 0 || useCustomRange) && (
            <button
              onClick={() => handleChangeWeekOffset(0)}
              className="text-[11px] px-1.5 py-0.5 bg-white hover:bg-blue-50 text-blue-600 font-medium rounded-lg shadow-2xs border border-slate-200 transition-colors shrink-0"
              title="快速返回本周"
            >
              本周
            </button>
          )}

          <button
            onClick={() => {
              setUseCustomRange(!useCustomRange);
              setIsExampleMode(false);
            }}
            className={`text-[11px] px-1.5 py-0.5 rounded-lg border transition-colors shrink-0 ${
              useCustomRange 
                ? 'bg-blue-600 text-white border-blue-600' 
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            自定义
          </button>
        </div>

        {/* 右侧：快捷操作按钮组 */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={handleToggleRephrasing}
            className={`flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-lg border transition-all ${
              enableRephrasing
                ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-2xs'
                : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
            }`}
            title="规范转述：本地自动识别学校、课程、并转述为规范完成动作"
          >
            <Sparkles size={13} className={enableRephrasing ? 'text-indigo-600' : 'text-slate-400'} />
            <span className="hidden 2xl:inline">{enableRephrasing ? '规范转述:开' : '规范转述:关'}</span>
          </button>

          <button
            onClick={handleLoadTemplateExample}
            className={`flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-lg border transition-colors ${
              isExampleMode
                ? 'bg-amber-100 text-amber-900 border-amber-300 font-bold'
                : 'text-amber-700 bg-amber-50 hover:bg-amber-100/80 border-amber-200'
            }`}
            title="查看 11 个板块标准业务模板参考示例"
          >
            <BookOpen size={13} className="text-amber-600" />
            <span>{isExampleMode ? '模板中' : '模板示例'}</span>
          </button>

          <button
            onClick={() => scanTasksIntoReport()}
            className="p-1.5 text-slate-600 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors"
            title="重新扫描归集"
          >
            <RefreshCw size={13} />
          </button>

          <button
            onClick={handleCopy}
            className={`flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-lg shadow-xs transition-all ${
              copied
                ? 'bg-emerald-600 text-white'
                : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-98'
            }`}
            title="一键复制周报全文"
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
            <span>{copied ? '已复制' : '复制周报'}</span>
          </button>
        </div>
      </header>

      {/* 模板示例提示指示条 */}
      {isExampleMode && (
        <div className="bg-amber-50 border-b border-amber-200 px-3 py-1.5 shrink-0 flex items-center justify-between text-xs text-amber-900 animate-in fade-in">
          <div className="flex items-center gap-1.5">
            <BookOpen size={13} className="text-amber-600 shrink-0" />
            <span className="text-[11px]">正在查看<strong>【标准模板示例数据】</strong></span>
          </div>
          <button
            onClick={() => scanTasksIntoReport()}
            className="px-2 py-0.5 bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-medium rounded shadow-2xs transition-colors shrink-0"
          >
            恢复载入该周实际任务
          </button>
        </div>
      )}

      {/* 自定义日期范围展开条 */}
      {useCustomRange && (
        <div className="bg-blue-50/60 border-b border-blue-100 px-3 py-1.5 shrink-0 flex items-center gap-2 text-xs text-blue-900 animate-in fade-in duration-150">
          <span className="font-medium flex items-center gap-1 text-[11px]">
            <Filter size={12} />
            设置起止日期：
          </span>
          <input
            type="date"
            value={customStart}
            onChange={(e) => setCustomStart(e.target.value)}
            className="px-2 py-1 bg-white border border-blue-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <span>至</span>
          <input
            type="date"
            value={customEnd}
            onChange={(e) => setCustomEnd(e.target.value)}
            className="px-2 py-1 bg-white border border-blue-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            onClick={() => scanTasksIntoReport()}
            className="px-2.5 py-1 bg-blue-600 text-white rounded font-medium hover:bg-blue-700"
          >
            按该区间提取
          </button>
        </div>
      )}

      {/* 手机端 Tab 切换 */}
      <div className="md:hidden flex border-b border-slate-200 bg-white">
        <button
          onClick={() => setActiveMobileTab('preview')}
          className={`flex-1 py-2 text-xs font-medium border-b-2 text-center transition-colors ${
            activeMobileTab === 'preview'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500'
          }`}
        >
          周报预览与导出
        </button>
        <button
          onClick={() => setActiveMobileTab('organize')}
          className={`flex-1 py-2 text-xs font-medium border-b-2 text-center transition-colors ${
            activeMobileTab === 'organize'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500'
          }`}
        >
          分类与增减 ({totalItemsCount}项)
        </button>
      </div>

      {/* 主工作区：左侧结构化分类整理 + 右侧实时周报文本预览 */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* 左侧：结构化板块管理面板 */}
        <div className={`w-full md:w-[48%] lg:w-[45%] border-r border-slate-200 bg-white flex flex-col min-h-0 overflow-hidden ${
          activeMobileTab === 'organize' ? 'flex' : 'hidden md:flex'
        }`}>
          {/* 左侧头部筛选与统计 */}
          <div className="p-2.5 px-3 border-b border-slate-100 bg-slate-50/70 shrink-0 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-slate-600">
              <span className="font-semibold text-slate-700">共 {totalItemsCount} 项工作</span>
              <span className="text-slate-300">|</span>
              <span className="text-[11px] text-slate-500">覆盖 {activeSectionsCount}/11 个板块</span>
            </div>

            <div className="flex items-center gap-2.5 text-[11px] text-slate-500">
              <label className="flex items-center gap-1 cursor-pointer hover:text-slate-700">
                <input
                  type="checkbox"
                  checked={includeCompleted}
                  onChange={(e) => setIncludeCompleted(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <span>已完成</span>
              </label>
              <label className="flex items-center gap-1 cursor-pointer hover:text-slate-700">
                <input
                  type="checkbox"
                  checked={includeDue}
                  onChange={(e) => setIncludeDue(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <span>本周排期</span>
              </label>
            </div>
          </div>

          {/* 若该周无任务记录，提供明显提示与快捷跳转按钮 */}
          {totalItemsCount === 0 && !isExampleMode && (
            <div className="m-3 p-4 bg-amber-50/80 border border-amber-200 rounded-xl text-center text-xs text-amber-900 space-y-2 shrink-0">
              <p className="font-semibold text-amber-800">
                💡 当前周期（{currentWeekInfo.displayLabel}）暂无任务记录
              </p>
              <p className="text-slate-500 text-[11px]">
                该时间段内暂无已完成或排期的任务。您可直接在下方各板块补充，或一键跳转至有任务的周：
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                <button
                  onClick={() => handleChangeWeekOffset(0)}
                  className="px-2.5 py-1 bg-white hover:bg-blue-600 hover:text-white border border-amber-200 rounded-lg text-blue-700 font-medium transition-colors shadow-2xs"
                >
                  本周 (10/12~10/18 · 60项)
                </button>
                <button
                  onClick={() => handleChangeWeekOffset(-1)}
                  className="px-2.5 py-1 bg-white hover:bg-blue-600 hover:text-white border border-amber-200 rounded-lg text-blue-700 font-medium transition-colors shadow-2xs"
                >
                  上周 (10/05~10/11 · 13项)
                </button>
              </div>
            </div>
          )}

          {/* 11个板块列表 */}
          <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
            {REPORT_SECTIONS.map((section) => {
              const items = reportItems.filter(i => i.sectionId === section.id);
              const count = items.length;

              return (
                <div 
                  key={section.id}
                  className="border border-slate-200/90 rounded-xl bg-white shadow-2xs overflow-hidden"
                >
                  {/* 板块标头 */}
                  <div className="px-3.5 py-2.5 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-3.5 bg-blue-600 rounded-full" />
                      <span className="text-xs font-bold text-slate-800">
                        {section.title}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                        count > 0 
                          ? 'bg-blue-100 text-blue-700' 
                          : 'bg-slate-100 text-slate-400'
                      }`}>
                        {count} 项
                      </span>
                    </div>
                  </div>

                  {/* 板块内容区 */}
                  <div className="p-3 space-y-2">
                    {/* 普通板块 */}
                    {!section.hasSubsections ? (
                      <>
                        {items.length === 0 ? (
                          <div className="text-[11px] text-slate-400 py-1.5 px-2 bg-slate-50 rounded-lg flex items-center justify-between">
                            <span>
                              {section.defaultPlaceholder 
                                ? `默认输出：${section.defaultPlaceholder}` 
                                : '暂无本周对应工作'}
                            </span>
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            {items.map((item) => (
                              <div
                                key={item.id}
                                className="group flex flex-col gap-1.5 p-2 rounded-lg bg-slate-50/80 hover:bg-slate-100 border border-slate-200/70 transition-all text-xs overflow-hidden"
                              >
                                {editingItemId === item.id ? (
                                  <div className="flex gap-1.5">
                                    <input
                                      type="text"
                                      autoFocus
                                      value={editingItemText}
                                      onChange={(e) => setEditingItemText(e.target.value)}
                                      onKeyDown={(e) => e.key === 'Enter' && handleSaveInlineEdit(item.id)}
                                      className="flex-1 px-2 py-1 bg-white border border-blue-500 rounded text-xs focus:outline-none"
                                    />
                                    <button
                                      onClick={() => handleSaveInlineEdit(item.id)}
                                      className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                                    >
                                      保存
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex items-start justify-between gap-2 min-w-0">
                                    <div className="font-medium text-slate-800 leading-snug flex-1 min-w-0 select-text break-words">
                                      {item.title}
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0 opacity-70 group-hover:opacity-100 transition-opacity">
                                      <button
                                        onClick={() => {
                                          setEditingItemId(item.id);
                                          setEditingItemText(item.title);
                                        }}
                                        className="p-1 text-slate-400 hover:text-blue-600 rounded"
                                        title="修改文字"
                                      >
                                        <Edit3 size={12} />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteItem(item.id)}
                                        className="p-1 text-slate-400 hover:text-red-500 rounded"
                                        title="从周报中移除"
                                      >
                                        <Trash2 size={12} />
                                      </button>
                                    </div>
                                  </div>
                                )}

                                {/* 底部属性与板块调整 */}
                                <div className="flex flex-wrap items-center justify-between gap-1 pt-1 border-t border-slate-200/50 text-[10px]">
                                  <div className="flex flex-wrap items-center gap-1">
                                    {item.school && (
                                      <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200/60 font-medium">
                                        🏫 {item.school}
                                      </span>
                                    )}
                                    {item.course && (
                                      <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200/60 font-medium">
                                        📖 《{item.course}》
                                      </span>
                                    )}
                                    {item.rawTitle && item.rawTitle !== item.title && (
                                      <span className="text-slate-400 truncate max-w-[150px]" title={`原始任务便签: ${item.rawTitle}`}>
                                        原: {item.rawTitle}
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-1 ml-auto shrink-0">
                                    <span className="text-slate-400">移至:</span>
                                    <select
                                      value={item.sectionId}
                                      onChange={(e) => handleMoveSection(item.id, e.target.value)}
                                      className="text-[10px] bg-white border border-slate-200 rounded px-1 py-0.5 text-slate-600 focus:outline-none max-w-[120px] truncate"
                                      title="调整到其他周报板块"
                                    >
                                      {REPORT_SECTIONS.map((s) => (
                                        <option key={s.id} value={s.id}>
                                          {s.categoryName}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* 快速新增输入行 */}
                        <div className="flex items-center gap-1.5 pt-1">
                          <input
                            type="text"
                            placeholder={`添加工作项到 [${section.categoryName}]...`}
                            value={newInputs[section.id] || ''}
                            onChange={(e) => setNewInputs({ ...newInputs, [section.id]: e.target.value })}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddItem(section.id)}
                            className="flex-1 px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white placeholder:text-slate-400"
                          />
                          <button
                            onClick={() => handleAddItem(section.id)}
                            disabled={!newInputs[section.id]?.trim()}
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-600 text-xs font-medium rounded-lg disabled:opacity-40 transition-colors flex items-center gap-1"
                          >
                            <Plus size={13} />
                            <span>添加</span>
                          </button>
                        </div>
                      </>
                    ) : (
                      /* 处理包含子分类的板块（如：十、售后服务及其他工作） */
                      <div className="space-y-3">
                        {section.subsections?.map((sub) => {
                          const subItems = items.filter(i => i.subSectionId === sub.id);
                          const subInputKey = `${section.id}_${sub.id}`;

                          return (
                            <div key={sub.id} className="border border-slate-100 rounded-lg p-2.5 bg-slate-50/40">
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="text-[11px] font-semibold text-slate-700">
                                  {sub.title}
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  {subItems.length} 项
                                </span>
                              </div>

                              {subItems.length === 0 ? (
                                <p className="text-[11px] text-slate-400 italic mb-2">暂无该子类项</p>
                              ) : (
                                <div className="space-y-1.5 mb-2">
                                  {subItems.map((item) => (
                                    <div
                                      key={item.id}
                                      className="group flex items-start justify-between gap-2 p-1.5 rounded bg-white border border-slate-200/70 text-xs overflow-hidden"
                                    >
                                      <div className="flex-1 min-w-0 leading-relaxed text-slate-700 select-text">
                                        <div className="font-medium text-slate-800 break-words">{item.title}</div>
                                        {(item.school || item.course || (item.rawTitle && item.rawTitle !== item.title)) && (
                                          <div className="flex flex-wrap items-center gap-1 mt-0.5 text-[10px]">
                                            {item.school && (
                                              <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200/60 font-medium">
                                                🏫 {item.school}
                                              </span>
                                            )}
                                            {item.course && (
                                              <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200/60 font-medium">
                                                📖 《{item.course}》
                                              </span>
                                            )}
                                            {item.rawTitle && item.rawTitle !== item.title && (
                                              <span className="text-slate-400 truncate max-w-[180px]" title={`原任务: ${item.rawTitle}`}>
                                                原: {item.rawTitle}
                                              </span>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-1 shrink-0">
                                        <button
                                          onClick={() => handleDeleteItem(item.id)}
                                          className="p-1 text-slate-400 hover:text-red-500 rounded"
                                          title="移除"
                                        >
                                          <Trash2 size={11} />
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* 子分类新增 */}
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="text"
                                  placeholder={`补充 ${sub.title.replace('：', '')}...`}
                                  value={newInputs[subInputKey] || ''}
                                  onChange={(e) => setNewInputs({ ...newInputs, [subInputKey]: e.target.value })}
                                  onKeyDown={(e) => e.key === 'Enter' && handleAddItem(section.id, sub.id)}
                                  className="flex-1 px-2 py-1 text-xs bg-white border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-slate-400"
                                />
                                <button
                                  onClick={() => handleAddItem(section.id, sub.id)}
                                  disabled={!newInputs[subInputKey]?.trim()}
                                  className="px-2 py-1 bg-white hover:bg-blue-600 hover:text-white border border-slate-200 text-slate-600 text-[11px] rounded disabled:opacity-40 transition-colors"
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 右侧：实时周报预览与全文编辑导出 */}
        <div className={`flex-1 min-h-0 flex flex-col bg-slate-50 overflow-hidden ${
          activeMobileTab === 'preview' ? 'flex' : 'hidden md:flex'
        }`}>
          {/* 预览顶栏控制区 - 单行紧凑高适用性布局 */}
          <div className="h-11 px-3 bg-white border-b border-slate-200 flex items-center justify-between gap-2 shrink-0">
            {/* 排版格式切换与自动序号控制 */}
            <div className="flex items-center gap-1.5 min-w-0">
              <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200/50">
                <button
                  onClick={() => {
                    setFormatStyle('standard');
                    setIsDirectEditing(false);
                  }}
                  className={`px-2 py-0.5 text-xs font-medium rounded transition-colors ${
                    formatStyle === 'standard' && !isDirectEditing
                      ? 'bg-white text-blue-600 shadow-2xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  标准版
                </button>
                <button
                  onClick={() => {
                    setFormatStyle('markdown');
                    setIsDirectEditing(false);
                  }}
                  className={`px-2 py-0.5 text-xs font-medium rounded transition-colors ${
                    formatStyle === 'markdown' && !isDirectEditing
                      ? 'bg-white text-blue-600 shadow-2xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Markdown
                </button>
              </div>

              <button
                onClick={() => {
                  const next = !withNumbering;
                  setWithNumbering(next);
                  setIsDirectEditing(false);
                  showToast(next ? '已开启 1. 2. 3. 序号' : '已关闭序号');
                }}
                className={`flex items-center gap-1 px-2 py-1 text-xs rounded-lg border transition-all ${
                  withNumbering
                    ? 'bg-blue-50 border-blue-200 text-blue-700 font-semibold'
                    : 'bg-white border-slate-200 text-slate-500'
                }`}
                title="切换任务前是否自动加上 1. 2. 3. 序号"
              >
                <span>序号</span>
                <span className={`w-1.5 h-1.5 rounded-full ${withNumbering ? 'bg-blue-600' : 'bg-slate-300'}`} />
              </button>
            </div>

            {/* 编辑/导出操作按钮 */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => setIsDirectEditing(!isDirectEditing)}
                className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg border transition-colors ${
                  isDirectEditing
                    ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-semibold'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
                title="自由编辑文本"
              >
                <Edit3 size={12} />
                <span>{isDirectEditing ? '编辑中' : '自由编辑'}</span>
              </button>

              <button
                onClick={handleExportTxt}
                className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"
                title="导出为 .txt 纯文本文件"
              >
                <Download size={13} />
              </button>

              <button
                onClick={handlePrint}
                className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"
                title="打印或导出为 PDF"
              >
                <Printer size={13} />
              </button>
            </div>
          </div>

          {/* 实时文本区域 */}
          <div className="flex-1 min-h-0 flex flex-col p-3 bg-slate-50">
            <div className="flex-1 min-h-0 flex flex-col w-full">
              {/* 白色卡片容器 */}
              <div className="flex-1 min-h-0 bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden flex flex-col">
                {isDirectEditing ? (
                  <textarea
                    value={editedText}
                    onChange={(e) => setEditedText(e.target.value)}
                    className="flex-1 min-h-0 w-full p-4 font-mono text-xs leading-relaxed text-slate-800 focus:outline-none resize-none overflow-y-auto"
                    placeholder="可在此自由调整周报文字..."
                  />
                ) : (
                  <div className="flex-1 min-h-0 p-4 overflow-y-auto select-text font-sans">
                    <pre className="whitespace-pre-wrap font-sans text-xs leading-loose text-slate-800 tracking-normal">
                      {editedText}
                    </pre>
                  </div>
                )}
              </div>

              {/* 底部信息与复制按钮 (固定在卡片底部，shrink-0，绝不挤压或被挤出屏幕！) */}
              <div className="mt-2.5 shrink-0 flex items-center justify-between text-xs text-slate-500 px-1">
                <span className="text-[11px] text-slate-500 truncate">
                  共 {editedText.length} 字符 · {totalItemsCount} 项工作事项
                </span>

                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg shadow-xs transition-all active:scale-98 shrink-0"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copied ? '已复制！' : '复制周报文本'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 消息 Toast 反馈提示 */}
      {copyToast && (
        <div className="fixed bottom-12 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 text-white text-xs font-medium px-4 py-2 rounded-full shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-150 backdrop-blur-xs">
          <CheckCircle2 size={15} className="text-emerald-400" />
          <span>{copyToast}</span>
        </div>
      )}
    </div>
  );
};
