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
import { Menu, Cloud, RefreshCw, FileText, SunMedium, Volume2, VolumeX } from 'lucide-react';

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
    syncError,
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

  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPod|iPad/.test(navigator.platform || navigator.userAgent);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-100 text-slate-800">
      {/* 
        桌面与移动端自适应顶栏：
        - macOS 桌面端：由 DraggableWKWebView 原生接管拖拽移动窗口，md:pl-20 为左侧原生红黄绿交通灯留出空间
        - Windows 桌面端：标准系统顶栏与原生控制按钮，md:pl-4 紧凑对称排版
        - 移动端：显示抽屉汉堡菜单与同步状态
      */}
      <header 
        className={`h-11 bg-slate-200/70 border-b border-slate-300/60 flex items-center px-3 md:px-4 ${isMac ? 'md:pl-20' : 'md:pl-4'} select-none shrink-0 justify-between cursor-default`}
      >
        <div className="flex items-center gap-2">
          {/* 手机端汉堡展开菜单按钮 */}
          <button
            onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
            className="md:hidden p-1.5 -ml-1 text-slate-600 hover:text-slate-900 hover:bg-slate-300/60 rounded-lg transition-colors"
            title="展开菜单"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* 顶部中央标题提示 */}
          <div className="text-xs font-semibold text-slate-700 flex items-center gap-2 pointer-events-none">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <span className="tracking-tight">闪念清单 · FlashList</span>
            <span className="text-[11px] font-normal text-slate-400 hidden sm:inline">
              (共 {tasks.filter(t => !t.completed).length} 项待办)
            </span>
          </div>
        </div>

        {/* 右侧小部件：导出日报/周报与多端云同步按钮 */}
        <div className="flex items-center gap-2">
          {/* 任务完成提示音控制按钮 */}
          <button
            onClick={toggleSound}
            className={`flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-lg border transition-all ${
              soundEnabled
                ? 'bg-amber-50 text-amber-700 border-amber-200/80 hover:bg-amber-100/70 shadow-xs'
                : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50'
            }`}
            title={soundEnabled ? '完成提示音已开启（经典马里奥金币音效，点击静音）' : '完成提示音已静音（点击开启）'}
          >
            {soundEnabled ? (
              <Volume2 className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            ) : (
              <VolumeX className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            )}
            <span className="hidden sm:inline">{soundEnabled ? '提示音' : '已静音'}</span>
          </button>

          <button
            onClick={() => setCurrentView(currentView === 'daily-report' ? 'today' : 'daily-report')}
            className={`flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-lg border transition-all ${
              currentView === 'daily-report'
                ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
            title={currentView === 'daily-report' ? '返回任务列表' : '查看或导出今日工作日报'}
          >
            <SunMedium className="w-3.5 h-3.5" />
            <span>{currentView === 'daily-report' ? '返回待办' : '导出日报'}</span>
          </button>

          <button
            onClick={() => setCurrentView(currentView === 'weekly-report' ? 'today' : 'weekly-report')}
            className={`flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-lg border transition-all ${
              currentView === 'weekly-report'
                ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
            title={currentView === 'weekly-report' ? '返回任务列表' : '查看或导出本周工作周报'}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>{currentView === 'weekly-report' ? '返回待办' : '导出周报'}</span>
          </button>

          <button
            onClick={() => setShowSyncModal(true)}
            className={`flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-lg border transition-all ${
              syncStatus === 'connected'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100/80 shadow-xs'
                : syncStatus === 'syncing'
                ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100/80 shadow-xs'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
            title="点击配置/查看手机与电脑云同步状态"
          >
            {syncStatus === 'syncing' ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-600" />
            ) : (
              <Cloud className={`w-3.5 h-3.5 ${syncStatus === 'connected' ? 'text-emerald-600' : 'text-slate-400'}`} />
            )}
            <span>
              {syncStatus === 'connected' 
                ? '云同步已连接' 
                : syncStatus === 'syncing' 
                ? '正在同步...' 
                : '多端同步 (未连接)'}
            </span>
          </button>
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

        {/* 右侧：任务详情与属性面板 (手机端全屏覆盖，桌面端三栏展示，日报/周报视图下不占用空间) */}
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
        lastSyncedAt={lastSyncedAt}
        onSyncTriggered={triggerSync}
      />
    </div>
  );
}

export default App;
