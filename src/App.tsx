import React, { useState } from 'react';
import { useTaskStore } from './store/useTaskStore';
import { Sidebar } from './components/Sidebar';
import { TaskListSection } from './components/TaskList';
import { CalendarView } from './components/CalendarView';
import { TaskDetail } from './components/TaskDetail';
import { TagRuleModal } from './components/TagRuleModal';
import { SyncSettingsModal } from './components/SyncSettingsModal';
import { WeeklyReportView } from './components/WeeklyReportView';
import { DailyReportView } from './components/DailyReportView';
import { 
  Menu, 
  Cloud, 
  RefreshCw, 
  FileText, 
  SunMedium, 
  Volume2, 
  VolumeX,
  Inbox,
  Calendar as CalendarIcon,
  CalendarDays,
  Clock
} from 'lucide-react';
import { isToday, parseISO } from 'date-fns';

export function App() {
  const {
    tasks,
    lists,
    currentView,
    currentListId,
    currentTag,
    selectedTaskId,
    selectedTask,
    searchQuery,
    allTags,
    filteredTasks,
    syncStatus,
    pendingSyncCount,
    lastSyncedAt,
    soundEnabled,
    toggleSound,
    setCurrentView,
    setCurrentListId,
    setCurrentTag,
    setSelectedTaskId,
    setSearchQuery,
    addTask,
    updateTask,
    autoTagAllTasks,
    toggleTaskCompletion,
    toggleTaskPin,
    deleteTask,
    addList,
    updateList,
    deleteList,
    addTag,
    deleteTag,
    renameTag,
    triggerSync,
  } = useTaskStore();

  const [showRuleModal, setShowRuleModal] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const handleSelectView = (view: any, listId?: string, tag?: string) => {
    setCurrentView(view);
    setCurrentListId(listId || null);
    setCurrentTag(tag || null);
  };

  const isMacDesktop =
    typeof navigator !== 'undefined' &&
    /Macintosh/.test(navigator.userAgent) &&
    !(navigator.maxTouchPoints && navigator.maxTouchPoints > 1);

  const todayCount = tasks.filter((t) => {
    if (t.completed || !t.dueDate) return false;
    try {
      return isToday(parseISO(t.dueDate));
    } catch {
      return false;
    }
  }).length;

  const inboxCount = tasks.filter((t) => !t.completed && t.listId === 'inbox').length;

  return (
    <div className="flex flex-col h-dvh-safe w-screen overflow-hidden bg-slate-100 text-slate-800">
      {/* 
        桌面与移动端自适应顶栏：
        - iPhone 全屏 PWA 预留顶部刘海安全区 pt-safe
        - macOS 桌面端：由 DraggableWKWebView 原生接管拖拽移动窗口，md:pl-20 为左侧红黄绿交通灯留出空间
      */}
      <header
        className={`pt-safe bg-slate-200/80 border-b border-slate-300/60 select-none shrink-0 cursor-default`}
      >
        <div
          className={`h-11 flex items-center px-3 md:px-4 ${
            isMacDesktop ? 'md:pl-20' : 'md:pl-4'
          } justify-between`}
        >
          <div className="flex items-center gap-2 min-w-0">
            {/* 手机端汉堡展开菜单按钮 */}
            <button
              onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
              className="md:hidden p-1.5 -ml-1 text-slate-600 hover:text-slate-900 active:bg-slate-300/70 rounded-lg transition-colors"
              title="展开菜单"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* 顶部中央标题提示 */}
            <div className="text-xs font-semibold text-slate-700 flex items-center gap-1.5 pointer-events-none truncate">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shrink-0" />
              <span className="tracking-tight truncate">闪念清单</span>
              <span className="text-[11px] font-normal text-slate-400 hidden sm:inline">
                (共 {tasks.filter((t) => !t.completed).length} 项待办)
              </span>
            </div>
          </div>

          {/* 右侧小部件：提示音、导出日报/周报与多端云同步按钮 */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* 任务完成提示音控制按钮 */}
            <button
              onClick={toggleSound}
              className={`flex items-center gap-1 text-[11px] font-medium px-2 sm:px-2.5 py-1 rounded-lg border transition-all ${
                soundEnabled
                  ? 'bg-amber-50 text-amber-700 border-amber-200/80 hover:bg-amber-100/70 shadow-xs'
                  : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50'
              }`}
              title={
                soundEnabled
                  ? '完成提示音已开启（点击静音）'
                  : '完成提示音已静音（点击开启）'
              }
            >
              {soundEnabled ? (
                <Volume2 className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              ) : (
                <VolumeX className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              )}
              <span className="hidden sm:inline">{soundEnabled ? '提示音' : '已静音'}</span>
            </button>

            <button
              onClick={() =>
                setCurrentView(currentView === 'daily-report' ? 'today' : 'daily-report')
              }
              className={`hidden sm:flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-lg border transition-all ${
                currentView === 'daily-report'
                  ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
              title={currentView === 'daily-report' ? '返回任务列表' : '查看或导出今日工作日报'}
            >
              <SunMedium className="w-3.5 h-3.5" />
              <span>{currentView === 'daily-report' ? '返回待办' : '日报'}</span>
            </button>

            <button
              onClick={() =>
                setCurrentView(currentView === 'weekly-report' ? 'today' : 'weekly-report')
              }
              className={`hidden sm:flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-lg border transition-all ${
                currentView === 'weekly-report'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
              title={currentView === 'weekly-report' ? '返回任务列表' : '查看或导出本周工作周报'}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>{currentView === 'weekly-report' ? '返回待办' : '周报'}</span>
            </button>

            <button
              onClick={() => setShowSyncModal(true)}
              className={`flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-lg border transition-all ${
                syncStatus === 'connected'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100/80 shadow-xs'
                  : syncStatus === 'syncing' || syncStatus === 'offline'
                  ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100/80 shadow-xs'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
              title="点击配置/查看手机与电脑云同步状态"
            >
              {syncStatus === 'syncing' ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-600" />
              ) : (
                <Cloud
                  className={`w-3.5 h-3.5 ${
                    syncStatus === 'connected'
                      ? 'text-emerald-600'
                      : syncStatus === 'offline'
                      ? 'text-amber-600'
                      : 'text-slate-400'
                  }`}
                />
              )}
              <span>
                {syncStatus === 'connected'
                  ? pendingSyncCount > 0
                    ? `同步(${pendingSyncCount})`
                    : '已同步'
                  : syncStatus === 'syncing'
                  ? '同步中...'
                  : syncStatus === 'offline'
                  ? `离线(${pendingSyncCount})`
                  : '云同步'}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* 主界面布局 */}
      <main className="flex-1 min-h-0 flex overflow-hidden relative">
        {/* 左侧：侧边栏与分组导航 (手机端支持抽屉式展示) */}
        <Sidebar
          currentView={currentView}
          currentListId={currentListId}
          currentTag={currentTag}
          lists={lists}
          tasks={tasks}
          allTags={allTags}
          searchQuery={searchQuery}
          onSelectView={handleSelectView}
          onAddList={addList}
          onUpdateList={updateList}
          onDeleteList={deleteList}
          onAddTag={addTag}
          onDeleteTag={deleteTag}
          onRenameTag={renameTag}
          onSearchChange={setSearchQuery}
          onOpenRuleModal={() => setShowRuleModal(true)}
          mobileOpen={mobileSidebarOpen}
          onCloseMobile={() => setMobileSidebarOpen(false)}
        />

        {/* 中间主要视图区：日报视图 或 周报视图 或 日历视图 或 任务列表 */}
        <div className="flex-1 min-h-0 flex flex-col min-w-0 overflow-hidden">
          {currentView === 'daily-report' ? (
            <DailyReportView
              tasks={tasks}
              onBackToTasks={() => setCurrentView('today')}
              onSwitchToWeekly={() => setCurrentView('weekly-report')}
            />
          ) : currentView === 'weekly-report' ? (
            <WeeklyReportView
              tasks={tasks}
              onBackToTasks={() => setCurrentView('today')}
              onSwitchToDaily={() => setCurrentView('daily-report')}
            />
          ) : currentView === 'calendar' ? (
            <CalendarView
              tasks={tasks}
              lists={lists}
              allTags={allTags}
              selectedTaskId={selectedTaskId}
              onSelectTask={setSelectedTaskId}
              onAddTask={addTask}
              onToggleComplete={toggleTaskCompletion}
              onDeleteTask={deleteTask}
              onTogglePin={toggleTaskPin}
              onUpdateTask={updateTask}
            />
          ) : (
            <TaskListSection
              currentView={currentView}
              currentListId={currentListId}
              currentTag={currentTag}
              lists={lists}
              tasks={filteredTasks}
              selectedTaskId={selectedTaskId}
              onSelectTask={setSelectedTaskId}
              onToggleComplete={toggleTaskCompletion}
              onTogglePin={toggleTaskPin}
              onAddTask={addTask}
              onDeleteTask={deleteTask}
              onUpdateTask={updateTask}
              onSwitchToCalendar={() => setCurrentView('calendar')}
              onOpenRuleModal={() => setShowRuleModal(true)}
            />
          )}
        </div>

        {/* 右侧：任务详情与属性面板 (手机端全屏覆盖，桌面端三栏展示) */}
        {selectedTask && currentView !== 'weekly-report' && currentView !== 'daily-report' && (
          <TaskDetail
            task={selectedTask}
            lists={lists}
            allTags={allTags}
            onClose={() => setSelectedTaskId(null)}
            onUpdate={updateTask}
            onDelete={deleteTask}
            onToggleComplete={toggleTaskCompletion}
            onAddTag={addTag}
          />
        )}
      </main>

      {/* iPhone 手机端专属底部固定 Tab 导航栏 (适配底部 Home 指示条安全区) */}
      <nav className="md:hidden bg-white/95 backdrop-blur-md border-t border-slate-200/80 pb-safe shrink-0 z-30 select-none">
        <div className="grid grid-cols-5 h-13 items-center px-1">
          <button
            onClick={() => handleSelectView('today')}
            className={`flex flex-col items-center justify-center py-1 gap-0.5 relative transition-colors ${
              currentView === 'today' ? 'text-blue-600 font-semibold' : 'text-slate-500'
            }`}
          >
            <div className="relative">
              <CalendarIcon className="w-5 h-5" />
              {todayCount > 0 && (
                <span className="absolute -top-1.5 -right-2.5 min-w-[15px] h-[15px] px-1 rounded-full bg-amber-500 text-white text-[9px] font-bold flex items-center justify-center">
                  {todayCount > 99 ? '99+' : todayCount}
                </span>
              )}
            </div>
            <span className="text-[10px]">今天</span>
          </button>

          <button
            onClick={() => handleSelectView('upcoming')}
            className={`flex flex-col items-center justify-center py-1 gap-0.5 transition-colors ${
              currentView === 'upcoming' ? 'text-blue-600 font-semibold' : 'text-slate-500'
            }`}
          >
            <Clock className="w-5 h-5" />
            <span className="text-[10px]">日程</span>
          </button>

          <button
            onClick={() => handleSelectView('inbox')}
            className={`flex flex-col items-center justify-center py-1 gap-0.5 relative transition-colors ${
              currentView === 'inbox' ? 'text-blue-600 font-semibold' : 'text-slate-500'
            }`}
          >
            <div className="relative">
              <Inbox className="w-5 h-5" />
              {inboxCount > 0 && (
                <span className="absolute -top-1.5 -right-2.5 min-w-[15px] h-[15px] px-1 rounded-full bg-blue-500 text-white text-[9px] font-bold flex items-center justify-center">
                  {inboxCount > 99 ? '99+' : inboxCount}
                </span>
              )}
            </div>
            <span className="text-[10px]">收集箱</span>
          </button>

          <button
            onClick={() => handleSelectView('calendar')}
            className={`flex flex-col items-center justify-center py-1 gap-0.5 transition-colors ${
              currentView === 'calendar' ? 'text-blue-600 font-semibold' : 'text-slate-500'
            }`}
          >
            <CalendarDays className="w-5 h-5" />
            <span className="text-[10px]">日历</span>
          </button>

          <button
            onClick={() =>
              handleSelectView(
                currentView === 'daily-report' || currentView === 'weekly-report'
                  ? currentView
                  : 'daily-report'
              )
            }
            className={`flex flex-col items-center justify-center py-1 gap-0.5 transition-colors ${
              currentView === 'daily-report' || currentView === 'weekly-report'
                ? 'text-blue-600 font-semibold'
                : 'text-slate-500'
            }`}
          >
            <FileText className="w-5 h-5" />
            <span className="text-[10px]">日报/周报</span>
          </button>
        </div>
      </nav>

      {/* 关键词自动打标规则管理弹窗 */}
      <TagRuleModal
        isOpen={showRuleModal}
        onClose={() => setShowRuleModal(false)}
        onRulesUpdated={autoTagAllTasks}
      />

      {/* 云端多端同步设置弹窗 */}
      <SyncSettingsModal
        isOpen={showSyncModal}
        onClose={() => setShowSyncModal(false)}
        syncStatus={syncStatus}
        pendingSyncCount={pendingSyncCount}
        lastSyncedAt={lastSyncedAt}
        onSyncTriggered={triggerSync}
      />
    </div>
  );
}

export default App;
