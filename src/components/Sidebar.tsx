import React, { useState } from 'react';
import { 
  Inbox, 
  Calendar as CalendarIcon, 
  CalendarDays, 
  Clock, 
  Plus, 
  Hash, 
  Trash2, 
  Pencil,
  FolderPlus, 
  Search,
  CheckCircle2,
  X,
  Palette,
  Sparkles,
  CalendarRange,
  FileText,
  SunMedium
} from 'lucide-react';
import { ViewCategory, TaskList, Task } from '../types';
import { isToday, parseISO, startOfDay, endOfWeek, isSameWeek } from 'date-fns';
import { ListContextMenu } from './ListContextMenu';

interface SidebarProps {
  currentView: ViewCategory;
  currentListId: string | null;
  currentTag: string | null;
  lists: TaskList[];
  tasks: Task[];
  allTags: string[];
  searchQuery: string;
  onSelectView: (view: ViewCategory, listId?: string, tag?: string) => void;
  onAddList: (name: string, color: string) => void;
  onUpdateList?: (id: string, updates: { name: string; color: string }) => void;
  onDeleteList: (id: string) => void;
  onAddTag?: (name: string, keywords?: string[]) => void;
  onDeleteTag?: (name: string) => void;
  onRenameTag?: (oldName: string, newName: string) => void;
  onSearchChange: (q: string) => void;
  onOpenRuleModal?: () => void;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

const COLOR_OPTIONS = [
  '#3B82F6', '#EF4444', '#10B981', '#F59E0B', 
  '#8B5CF6', '#EC4899', '#06B6D4', '#F97316'
];

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  currentListId,
  currentTag,
  lists,
  tasks,
  allTags,
  searchQuery,
  onSelectView,
  onAddList,
  onUpdateList,
  onDeleteList,
  onAddTag,
  onDeleteTag,
  onRenameTag,
  onSearchChange,
  onOpenRuleModal,
  mobileOpen = false,
  onCloseMobile,
}) => {
  const [showAddListModal, setShowAddListModal] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [newListColor, setNewListColor] = useState(COLOR_OPTIONS[0]);

  // 自定义标签弹窗状态
  const [showAddTagModal, setShowAddTagModal] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagKeywords, setNewTagKeywords] = useState('');
  const [newTagError, setNewTagError] = useState('');

  // 清单右键菜单与编辑弹窗状态
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    list: TaskList;
  } | null>(null);
  const [editingList, setEditingList] = useState<TaskList | null>(null);
  const [editListName, setEditListName] = useState('');
  const [editListColor, setEditListColor] = useState(COLOR_OPTIONS[0]);

  // 计算计数 (仅统计未完成任务)
  const inboxCount = tasks.filter(t => !t.completed && t.listId === 'inbox').length;
  const todayCount = tasks.filter(t => {
    if (t.completed || !t.dueDate) return false;
    try { 
      const d = parseISO(t.dueDate); 
      return isToday(d); 
    } catch { return false; }
  }).length;
  const upcomingCount = tasks.filter(t => !t.completed && t.dueDate).length;

  const handleCreateList = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListName.trim()) return;
    onAddList(newListName.trim(), newListColor);
    setNewListName('');
    setShowAddListModal(false);
  };

  const openEditModal = (list: TaskList) => {
    setEditingList(list);
    setEditListName(list.name);
    setEditListColor(list.color || COLOR_OPTIONS[0]);
  };

  const handleUpdateList = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingList || !editListName.trim()) return;
    onUpdateList?.(editingList.id, {
      name: editListName.trim(),
      color: editListColor,
    });
    setEditingList(null);
  };

  const handleDeleteList = (list: TaskList) => {
    if (confirm(`确定删除清单 "${list.name}" 吗？该清单下的任务将移入收集箱。`)) {
      onDeleteList(list.id);
    }
  };

  const handleCreateTag = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newTagName.trim().replace(/^#/, '');
    if (!cleanName) {
      setNewTagError('请输入标签名称');
      return;
    }
    const kwList = newTagKeywords
      .split(/[,，\s]+/)
      .map((k) => k.trim())
      .filter(Boolean);

    onAddTag?.(cleanName, kwList.length > 0 ? kwList : undefined);
    setNewTagName('');
    setNewTagKeywords('');
    setNewTagError('');
    setShowAddTagModal(false);
    handleItemSelect('tag', undefined, cleanName);
  };

  const handleItemSelect = (view: ViewCategory, listId?: string, tag?: string) => {
    onSelectView(view, listId, tag);
    onCloseMobile?.();
  };

  return (
    <>
      {/* 手机端背景遮罩 */}
      {mobileOpen && (
        <div 
          className="fixed inset-0 bg-black/40 z-40 md:hidden backdrop-blur-xs transition-opacity"
          onClick={onCloseMobile}
        />
      )}

      <aside className={`bg-slate-100/95 border-r border-slate-200/80 flex flex-col h-full min-h-0 select-none text-slate-700 shrink-0 transition-all duration-200 z-40 ${
        mobileOpen
          ? 'fixed inset-y-0 left-0 w-72 shadow-2xl md:relative md:w-64 md:shadow-none flex'
          : 'hidden md:flex w-64'
      }`}>
        {/* 顶部标题栏/搜索框 */}
        <div className="p-3 border-b border-slate-200/60 shrink-0">
          <div className="flex items-center justify-between mb-2 px-1">
            <div className="flex items-center gap-2">
              <img
                src="/app-icon.png"
                alt="Logo"
                className="w-7 h-7 rounded-lg shadow-xs object-cover border border-slate-200/50"
              />
              <span className="font-semibold text-slate-800 text-sm tracking-tight">闪念清单 · FlashList</span>
            </div>
            {/* 手机端专有关闭按钮 */}
            <button
              onClick={onCloseMobile}
              className="md:hidden p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60"
            >
              <X size={18} />
            </button>
          </div>

        {/* 快速搜索框 */}
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="搜索任务、标签或清单..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* 导航列表区域 */}
      <div className="flex-1 min-h-0 overflow-y-auto px-2 py-3 space-y-4">
        {/* 系统内置智能清单 */}
        <div className="space-y-0.5">
          <button
            onClick={() => handleItemSelect('inbox')}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              currentView === 'inbox'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'hover:bg-slate-200/70 text-slate-700'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Inbox size={16} className={currentView === 'inbox' ? 'text-white' : 'text-blue-500'} />
              <span>收集箱</span>
            </div>
            {inboxCount > 0 && (
              <span className={`text-[11px] px-1.5 py-0.5 rounded-full ${
                currentView === 'inbox' ? 'bg-blue-700 text-white' : 'bg-slate-200 text-slate-600'
              }`}>
                {inboxCount}
              </span>
            )}
          </button>

          <button
            onClick={() => handleItemSelect('today')}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              currentView === 'today'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'hover:bg-slate-200/70 text-slate-700'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <CalendarIcon size={16} className={currentView === 'today' ? 'text-white' : 'text-amber-500'} />
              <span>今天</span>
            </div>
            {todayCount > 0 && (
              <span className={`text-[11px] px-1.5 py-0.5 rounded-full ${
                currentView === 'today' ? 'bg-blue-700 text-white' : 'bg-slate-200 text-slate-600'
              }`}>
                {todayCount}
              </span>
            )}
          </button>

          <button
            onClick={() => handleItemSelect('upcoming')}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              currentView === 'upcoming'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'hover:bg-slate-200/70 text-slate-700'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Clock size={16} className={currentView === 'upcoming' ? 'text-white' : 'text-purple-500'} />
              <span>待办日历日程</span>
            </div>
            {upcomingCount > 0 && (
              <span className={`text-[11px] px-1.5 py-0.5 rounded-full ${
                currentView === 'upcoming' ? 'bg-blue-700 text-white' : 'bg-slate-200 text-slate-600'
              }`}>
                {upcomingCount}
              </span>
            )}
          </button>

          <button
            onClick={() => handleItemSelect('calendar')}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              currentView === 'calendar'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'hover:bg-slate-200/70 text-slate-700'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <CalendarDays size={16} className={currentView === 'calendar' ? 'text-white' : 'text-emerald-500'} />
              <span>日历视图 (月/周/日)</span>
            </div>
          </button>

          <button
            onClick={() => handleItemSelect('daily-report')}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              currentView === 'daily-report'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'hover:bg-slate-200/70 text-slate-700'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <SunMedium size={16} className={currentView === 'daily-report' ? 'text-white' : 'text-amber-500'} />
              <span>日报导出 (今日/明日)</span>
            </div>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
              currentView === 'daily-report' ? 'bg-blue-700 text-white' : 'bg-amber-50 text-amber-600'
            }`}>
              日报
            </span>
          </button>

          <button
            onClick={() => handleItemSelect('weekly-report')}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              currentView === 'weekly-report'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'hover:bg-slate-200/70 text-slate-700'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <FileText size={16} className={currentView === 'weekly-report' ? 'text-white' : 'text-blue-500'} />
              <span>周报导出 (工作总结)</span>
            </div>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
              currentView === 'weekly-report' ? 'bg-blue-700 text-white' : 'bg-blue-50 text-blue-600'
            }`}>
              导出
            </span>
          </button>
        </div>

        {/* 自定义清单 */}
        <div>
          <div className="flex items-center justify-between px-2.5 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            <span>清单分组</span>
            <button
              onClick={() => setShowAddListModal(true)}
              className="text-slate-400 hover:text-blue-600 transition-colors p-0.5 rounded"
              title="新建清单"
            >
              <Plus size={14} />
            </button>
          </div>

          <div className="space-y-0.5 mt-1">
            {lists.map((list) => {
              const count = tasks.filter(t => !t.completed && t.listId === list.id).length;
              const isActive = currentView === 'list' && currentListId === list.id;

              return (
                <div
                  key={list.id}
                  className={`group flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'hover:bg-slate-200/70 text-slate-700'
                  }`}
                  onClick={() => handleItemSelect('list', list.id)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setContextMenu({
                      x: e.clientX,
                      y: e.clientY,
                      list,
                    });
                  }}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: list.color }}
                    />
                    <span className="truncate">{list.name}</span>
                  </div>

                  <div className="flex items-center gap-1">
                    {count > 0 && (
                      <span className={`text-[11px] px-1.5 py-0.5 rounded-full ${
                        isActive ? 'bg-blue-700 text-white' : 'bg-slate-200 text-slate-600'
                      }`}>
                        {count}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditModal(list);
                      }}
                      className={`opacity-0 group-hover:opacity-100 p-0.5 rounded hover:text-blue-500 transition-all ${
                        isActive ? 'text-white/80 hover:text-white' : 'text-slate-400'
                      }`}
                      title="编辑清单"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteList(list);
                      }}
                      className={`opacity-0 group-hover:opacity-100 p-0.5 rounded hover:text-red-500 transition-all ${
                        isActive ? 'text-white/80 hover:text-white' : 'text-slate-400'
                      }`}
                      title="删除清单"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 标签列表 */}
        <div>
          <div className="px-2.5 py-1 flex items-center justify-between text-[11px] font-semibold text-slate-400">
            <span className="uppercase tracking-wider">标签</span>
            <div className="flex items-center gap-1">
              {onOpenRuleModal && (
                <button
                  type="button"
                  onClick={onOpenRuleModal}
                  className="flex items-center gap-1 text-[11px] text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 px-1.5 py-0.5 rounded transition-colors"
                  title="管理关键词自动打标签规则"
                >
                  <Sparkles size={11} />
                  <span>打标规则</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setNewTagName('');
                  setNewTagKeywords('');
                  setNewTagError('');
                  setShowAddTagModal(true);
                }}
                className="text-slate-400 hover:text-blue-600 hover:bg-slate-200/60 transition-colors p-0.5 rounded"
                title="新建标签"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>

          {allTags.length === 0 ? (
            <div className="px-3 py-2 text-xs text-slate-400 italic">
              暂无标签，点击上方 + 新建
            </div>
          ) : (
            <div className="space-y-0.5 mt-1">
              {allTags.map((tag) => {
                const count = tasks.filter(t => !t.completed && t.tags.includes(tag)).length;
                const isActive = currentView === 'tag' && currentTag === tag;

                return (
                  <div
                    key={tag}
                    onClick={() => handleItemSelect('tag', undefined, tag)}
                    className={`group flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'hover:bg-slate-200/70 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <Hash size={14} className={isActive ? 'text-white' : 'text-slate-400'} />
                      <span className="truncate">{tag}</span>
                    </div>

                    <div className="flex items-center gap-1">
                      {count > 0 && (
                        <span className={`text-[11px] px-1.5 py-0.5 rounded-full ${
                          isActive ? 'bg-blue-700 text-white' : 'bg-slate-200 text-slate-600'
                        }`}>
                          {count}
                        </span>
                      )}
                      {onDeleteTag && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`确定删除标签 "#${tag}" 吗？所有任务中该标签将被移除。`)) {
                              onDeleteTag(tag);
                            }
                          }}
                          className={`opacity-0 group-hover:opacity-100 p-0.5 rounded hover:text-red-500 transition-all ${
                            isActive ? 'text-white/80 hover:text-white' : 'text-slate-400'
                          }`}
                          title={`删除标签 #${tag}`}
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 底部统计与状态栏 */}
      <div className="p-3 shrink-0 border-t border-slate-200/60 text-[11px] text-slate-500 flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          <CheckCircle2 size={13} className="text-emerald-500" />
          已完成 {tasks.filter(t => t.completed).length} 项
        </span>
        <span className="text-slate-400">总计 {tasks.length} 项</span>
      </div>

      {/* 新建清单弹窗 */}
      {showAddListModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-80 p-5 border border-slate-100">
            <h3 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
              <FolderPlus size={16} className="text-blue-600" />
              新建清单
            </h3>
            <form onSubmit={handleCreateList} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">清单名称</label>
                <input
                  type="text"
                  autoFocus
                  placeholder="如：读书笔记、健身计划"
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1 flex items-center gap-1">
                  <Palette size={12} />
                  主题颜色
                </label>
                <div className="flex gap-2">
                  {COLOR_OPTIONS.map((c) => (
                    <button
                      type="button"
                      key={c}
                      onClick={() => setNewListColor(c)}
                      className={`w-6 h-6 rounded-full transition-transform ${
                        newListColor === c ? 'scale-110 ring-2 ring-offset-2 ring-blue-500' : 'hover:scale-105'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddListModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={!newListName.trim()}
                  className="px-3 py-1.5 text-xs bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  创建
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 清单右键快捷菜单 */}
      {contextMenu && (
        <ListContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          list={contextMenu.list}
          onClose={() => setContextMenu(null)}
          onEdit={openEditModal}
          onDelete={handleDeleteList}
        />
      )}

      {/* 编辑清单弹窗 */}
      {editingList && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-80 p-5 border border-slate-100 animate-in fade-in zoom-in-95 duration-100">
            <h3 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
              <Pencil size={16} className="text-blue-600" />
              编辑清单
            </h3>
            <form onSubmit={handleUpdateList} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">清单名称</label>
                <input
                  type="text"
                  autoFocus
                  placeholder="清单名称"
                  value={editListName}
                  onChange={(e) => setEditListName(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1 flex items-center gap-1">
                  <Palette size={12} />
                  主题颜色
                </label>
                <div className="flex gap-2">
                  {COLOR_OPTIONS.map((c) => (
                    <button
                      type="button"
                      key={c}
                      onClick={() => setEditListColor(c)}
                      className={`w-6 h-6 rounded-full transition-transform ${
                        editListColor === c ? 'scale-110 ring-2 ring-offset-2 ring-blue-500' : 'hover:scale-105'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingList(null)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={!editListName.trim()}
                  className="px-3 py-1.5 text-xs bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  保存修改
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 新建自定义标签弹窗 */}
      {showAddTagModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-88 max-w-full p-5 border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <Hash size={16} className="text-blue-600" />
                <span>新建自定义标签</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAddTagModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateTag} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  标签名称 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  autoFocus
                  placeholder="如：财务、健身、学习、汇报"
                  value={newTagName}
                  onChange={(e) => {
                    setNewTagName(e.target.value);
                    setNewTagError('');
                  }}
                  className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
                {newTagError && (
                  <p className="text-[11px] text-red-500 mt-1">{newTagError}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1 flex items-center justify-between">
                  <span>自动识别关键词 (可选)</span>
                  <span className="text-[10px] text-slate-400 font-normal">逗号分隔</span>
                </label>
                <input
                  type="text"
                  placeholder="如：发票, 报销, 账单, 转账"
                  value={newTagKeywords}
                  onChange={(e) => setNewTagKeywords(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  输入关键词后，任务标题含有这些词时将自动被打上该标签。
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddTagModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-xs"
                >
                  创建标签
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </aside>
    </>
  );
};

