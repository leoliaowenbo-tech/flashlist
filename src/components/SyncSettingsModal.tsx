import React, { useState, useEffect } from 'react';
import { 
  X, 
  Cloud, 
  Check, 
  AlertCircle, 
  Copy, 
  RefreshCw, 
  ExternalLink,
  ShieldCheck,
  Lock,
  Mail,
  LogOut,
  UserCheck,
  Smartphone,
  Share2
} from 'lucide-react';
import { 
  getSupabaseConfig, 
  saveSupabaseConfig, 
  testSupabaseConnection,
  getCurrentUser,
  signInWithEmail,
  signUpWithEmail,
  signOutAccount
} from '../services/supabase';
import { syncManager } from '../services/syncService';
import { SyncStatus } from '../types/sync';

interface SyncSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  syncStatus: SyncStatus;
  pendingSyncCount?: number;
  lastSyncedAt?: string | null;
  onSyncTriggered?: () => void;
}

const SQL_SCHEMA = `-- =======================================================
-- 闪念清单 (FlashList) Supabase 安全与多端实时同步初始化脚本
-- 在 Supabase 控制台的 SQL Editor 中粘贴并点击 Run 即可
-- =======================================================

-- 1. 创建任务表 (tasks)
CREATE TABLE IF NOT EXISTS public.tasks (
    id TEXT PRIMARY KEY,
    user_id UUID DEFAULT auth.uid(),
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    completed BOOLEAN DEFAULT FALSE,
    priority TEXT DEFAULT 'p4',
    due_date TEXT,
    due_time TEXT,
    list_id TEXT DEFAULT 'inbox',
    tags JSONB DEFAULT '[]'::jsonb,
    subtasks JSONB DEFAULT '[]'::jsonb,
    pinned BOOLEAN DEFAULT FALSE,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    reminder TEXT
);
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS user_id UUID DEFAULT auth.uid();

-- 2. 创建清单分类表 (task_lists)
CREATE TABLE IF NOT EXISTS public.task_lists (
    id TEXT PRIMARY KEY,
    user_id UUID DEFAULT auth.uid(),
    name TEXT NOT NULL,
    color TEXT DEFAULT '#3B82F6',
    icon TEXT,
    folder_id TEXT,
    is_deleted BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.task_lists ADD COLUMN IF NOT EXISTS user_id UUID DEFAULT auth.uid();

-- 3. 创建自动打标规则表 (tag_rules)
CREATE TABLE IF NOT EXISTS public.tag_rules (
    tag TEXT PRIMARY KEY,
    user_id UUID DEFAULT auth.uid(),
    keywords JSONB DEFAULT '[]'::jsonb,
    enabled BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.tag_rules ADD COLUMN IF NOT EXISTS user_id UUID DEFAULT auth.uid();

-- 4. 开启行级安全策略 (RLS) 与邮箱账号隔离
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tag_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anon All Tasks" ON public.tasks;
DROP POLICY IF EXISTS "Anon All Task Lists" ON public.task_lists;
DROP POLICY IF EXISTS "Anon All Tag Rules" ON public.tag_rules;
DROP POLICY IF EXISTS "User Isolated Tasks" ON public.tasks;
DROP POLICY IF EXISTS "User Isolated Task Lists" ON public.task_lists;
DROP POLICY IF EXISTS "User Isolated Tag Rules" ON public.tag_rules;

CREATE POLICY "User Isolated Tasks" ON public.tasks
    FOR ALL TO authenticated, anon
    USING (user_id IS NULL OR user_id = auth.uid())
    WITH CHECK (user_id IS NULL OR user_id = auth.uid());

CREATE POLICY "User Isolated Task Lists" ON public.task_lists
    FOR ALL TO authenticated, anon
    USING (user_id IS NULL OR user_id = auth.uid())
    WITH CHECK (user_id IS NULL OR user_id = auth.uid());

CREATE POLICY "User Isolated Tag Rules" ON public.tag_rules
    FOR ALL TO authenticated, anon
    USING (user_id IS NULL OR user_id = auth.uid())
    WITH CHECK (user_id IS NULL OR user_id = auth.uid());

-- 5. 开启 Supabase Realtime 实时推送
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'tasks'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'task_lists'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.task_lists;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'tag_rules'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.tag_rules;
    END IF;
END $$;`;

export const SyncSettingsModal: React.FC<SyncSettingsModalProps> = ({
  isOpen,
  onClose,
  syncStatus,
  pendingSyncCount = 0,
  lastSyncedAt,
  onSyncTriggered,
}) => {
  const [url, setUrl] = useState('');
  const [anonKey, setAnonKey] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);
  const [copiedMobileLink, setCopiedMobileLink] = useState(false);
  const [activeTab, setActiveTab] = useState<'auth' | 'config' | 'sql' | 'guide'>('auth');

  // 邮箱登录状态
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [authLoading, setAuthLoading] = useState(false);
  const [loggedInEmail, setLoggedInEmail] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const cfg = getSupabaseConfig();
      setUrl(cfg.supabaseUrl || '');
      setAnonKey(cfg.supabaseAnonKey || '');
      setLoggedInEmail(cfg.userEmail || null);
      setTestResult(null);

      // 如果还没配置过 URL，默认打开连接配置页；如果已配置，默认打开邮箱登录/状态页
      if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) {
        setActiveTab('config');
      } else {
        setActiveTab('auth');
      }

      getCurrentUser().then((u) => {
        if (u?.email) {
          setLoggedInEmail(u.email);
        }
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    saveSupabaseConfig({
      supabaseUrl: url.trim(),
      supabaseAnonKey: anonKey.trim(),
      enabled: Boolean(url.trim() && anonKey.trim()),
      userEmail: loggedInEmail,
    });
    syncManager.initRealtimeSubscription();
    onSyncTriggered?.();
    setTestResult({ success: true, message: '云端连接配置已保存！现在可以切换到「邮箱安全登录」绑定你的账号。' });
  };

  const handleTest = async () => {
    if (!url.trim() || !anonKey.trim()) {
      setTestResult({ success: false, message: '请先填写 Supabase URL 和 Anon Key' });
      return;
    }
    setTesting(true);
    setTestResult(null);
    const res = await testSupabaseConnection(url.trim(), anonKey.trim());
    setTesting(false);
    setTestResult(res);
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || !anonKey.trim()) {
      setTestResult({ success: false, message: '请先在「连接配置」中填入 Supabase URL 和 Key' });
      setActiveTab('config');
      return;
    }
    if (!email.trim() || !password) {
      setTestResult({ success: false, message: '请输入邮箱和密码（密码至少 6 位）' });
      return;
    }

    // 确保配置已保存
    saveSupabaseConfig({
      supabaseUrl: url.trim(),
      supabaseAnonKey: anonKey.trim(),
      enabled: true,
      userEmail: loggedInEmail,
    });

    setAuthLoading(true);
    setTestResult(null);
    const res =
      authMode === 'login'
        ? await signInWithEmail(email, password)
        : await signUpWithEmail(email, password);
    setAuthLoading(false);
    setTestResult({ success: res.success, message: res.message });

    if (res.success && res.user?.email) {
      setLoggedInEmail(res.user.email);
      setPassword('');
      syncManager.initRealtimeSubscription();
      onSyncTriggered?.();
    }
  };

  const handleSignOut = async () => {
    await signOutAccount();
    setLoggedInEmail(null);
    setTestResult({ success: true, message: '已退出当前邮箱账号' });
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(SQL_SCHEMA);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  const handleCopyMobileQuickLink = () => {
    if (!url.trim() || !anonKey.trim()) return;
    const base = window.location.origin.startsWith('http')
      ? `${window.location.origin}${window.location.pathname}`
      : 'https://leoliaowenbo-tech.github.io/flashlist/';
    const quickUrl = `${base}?sync_url=${encodeURIComponent(url.trim())}&sync_key=${encodeURIComponent(anonKey.trim())}`;
    navigator.clipboard.writeText(quickUrl);
    setCopiedMobileLink(true);
    setTimeout(() => setCopiedMobileLink(false), 2500);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 顶部标题栏 */}
        <div className="px-4 sm:px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold shrink-0">
              <Cloud className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-semibold text-slate-800 flex items-center gap-2 flex-wrap">
                <span>多端同步与安全登录</span>
                <span
                  className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                    syncStatus === 'connected'
                      ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                      : syncStatus === 'syncing'
                      ? 'bg-amber-50 text-amber-600 border border-amber-200'
                      : syncStatus === 'offline'
                      ? 'bg-amber-50 text-amber-700 border border-amber-200'
                      : 'bg-slate-100 text-slate-500 border border-slate-200'
                  }`}
                >
                  {syncStatus === 'connected'
                    ? '● 实时同步中'
                    : syncStatus === 'syncing'
                    ? '● 正在同步'
                    : syncStatus === 'offline'
                    ? `○ 离线暂存 (${pendingSyncCount})`
                    : '○ 未连接'}
                </span>
              </h2>
              <p className="text-[11px] text-slate-400 truncate">
                iPhone 与 Mac 实时双向同步 · 离线改动自动排队重传
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 导航 Tab */}
        <div className="flex border-b border-slate-100 px-4 sm:px-6 gap-4 sm:gap-6 text-xs font-medium overflow-x-auto">
          <button
            onClick={() => setActiveTab('auth')}
            className={`py-3 border-b-2 transition-colors whitespace-nowrap flex items-center gap-1 ${
              activeTab === 'auth'
                ? 'border-blue-600 text-blue-600 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>邮箱安全登录</span>
          </button>
          <button
            onClick={() => setActiveTab('config')}
            className={`py-3 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'config'
                ? 'border-blue-600 text-blue-600 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            数据库连接配置
          </button>
          <button
            onClick={() => setActiveTab('sql')}
            className={`py-3 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'sql'
                ? 'border-blue-600 text-blue-600 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            一键初始化 SQL
          </button>
          <button
            onClick={() => setActiveTab('guide')}
            className={`py-3 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'guide'
                ? 'border-blue-600 text-blue-600 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            3步开通指南
          </button>
        </div>

        {/* 内容区 */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1 text-sm">
          {/* Tab 1: 邮箱安全登录 */}
          {activeTab === 'auth' && (
            <div className="space-y-4">
              {loggedInEmail ? (
                <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                        <UserCheck className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-xs text-emerald-700 font-semibold">已登录专属加密账号</div>
                        <div className="text-sm font-bold text-slate-800">{loggedInEmail}</div>
                      </div>
                    </div>
                    <button
                      onClick={handleSignOut}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-slate-600 hover:text-red-600 bg-white border border-slate-200 rounded-lg transition-colors"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>退出</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-emerald-700 leading-relaxed">
                    ✓ 你的所有任务、清单与自动打标规则已受账号级权限保护（RLS），只有登录此邮箱的设备才能读取和同步。
                  </p>
                </div>
              ) : (
                <form onSubmit={handleAuthSubmit} className="space-y-3.5">
                  <div className="flex items-center justify-between bg-slate-100 p-1 rounded-xl text-xs">
                    <button
                      type="button"
                      onClick={() => setAuthMode('login')}
                      className={`flex-1 py-1.5 rounded-lg font-medium transition-all ${
                        authMode === 'login'
                          ? 'bg-white text-blue-600 shadow-2xs font-semibold'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      已有账号登录
                    </button>
                    <button
                      type="button"
                      onClick={() => setAuthMode('signup')}
                      className={`flex-1 py-1.5 rounded-lg font-medium transition-all ${
                        authMode === 'signup'
                          ? 'bg-white text-blue-600 shadow-2xs font-semibold'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      首次注册新账号 (免费)
                    </button>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      个人邮箱账号
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        required
                        placeholder="yourname@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      同步密码 (至少 6 位)
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="password"
                        required
                        minLength={6}
                        placeholder="请输入密码..."
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={authLoading}
                    className="w-full py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl shadow-sm shadow-blue-500/20 transition-all"
                  >
                    {authLoading
                      ? '正在验证...'
                      : authMode === 'login'
                      ? '立即登录并开启实时同步'
                      : '一键创建专属同步账号'}
                  </button>
                </form>
              )}

              {/* 手机一键免输密钥专属链接 */}
              {url.trim() && anonKey.trim() && (
                <div className="p-3.5 rounded-xl bg-blue-50/60 border border-blue-100 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-800">
                      <Smartphone className="w-4 h-4 text-blue-600" />
                      <span>iPhone 手机端免填密钥快捷配置</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleCopyMobileQuickLink}
                      className="flex items-center gap-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-medium transition-colors"
                    >
                      {copiedMobileLink ? <Check className="w-3 h-3" /> : <Share2 className="w-3 h-3" />}
                      <span>{copiedMobileLink ? '已复制专属链接' : '复制手机配置链接'}</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    点击复制链接发送到手机微信/备忘录并用 Safari 打开，手机会自动填入 Supabase URL 和 Key，只需登录邮箱即可！
                  </p>
                </div>
              )}

              {testResult && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-start gap-2 ${
                    testResult.success
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-rose-50 text-rose-700 border border-rose-200'
                  }`}
                >
                  {testResult.success ? (
                    <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <span>{testResult.message}</span>
                </div>
              )}
            </div>
          )}

          {/* Tab 2: 数据库连接配置 */}
          {activeTab === 'config' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Supabase Project URL
                </label>
                <input
                  type="text"
                  placeholder="https://xyzcompany.supabase.co"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Supabase Anon Key (公共密钥)
                </label>
                <input
                  type="password"
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  value={anonKey}
                  onChange={(e) => setAnonKey(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono"
                />
              </div>

              {testResult && (
                <div
                  className={`p-3 rounded-lg text-xs flex items-start gap-2 ${
                    testResult.success
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-rose-50 text-rose-700 border border-rose-200'
                  }`}
                >
                  {testResult.success ? (
                    <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <span>{testResult.message}</span>
                </div>
              )}

              {lastSyncedAt && (
                <p className="text-[11px] text-slate-400">
                  上次同步时间：{new Date(lastSyncedAt).toLocaleString('zh-CN')}
                </p>
              )}
            </div>
          )}

          {/* Tab 3: SQL 脚本 */}
          {activeTab === 'sql' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-slate-500">
                  在 Supabase 控制台的 SQL Editor 中执行此脚本以自动建表与开启用户权限隔离：
                </span>
                <button
                  onClick={handleCopySql}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors shrink-0"
                >
                  {copiedSql ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedSql ? '已复制 SQL' : '一键复制'}
                </button>
              </div>
              <pre className="p-3 bg-slate-900 text-slate-200 rounded-xl text-[11px] font-mono overflow-x-auto max-h-56 leading-relaxed select-all">
                {SQL_SCHEMA}
              </pre>
            </div>
          )}

          {/* Tab 4: 指南 */}
          {activeTab === 'guide' && (
            <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
              <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100 flex gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-xs shrink-0">
                  1
                </div>
                <div>
                  <h4 className="font-semibold text-slate-800">使用 GitHub 账号免费登录 Supabase</h4>
                  <p className="text-slate-500 text-[11px] mt-0.5">
                    访问{' '}
                    <a
                      href="https://supabase.com"
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 underline font-medium inline-flex items-center gap-0.5"
                    >
                      supabase.com <ExternalLink className="w-3 h-3" />
                    </a>
                    ，点击 "New project"，填写项目名 `flashlist` 创建免费数据库。
                  </p>
                </div>
              </div>

              <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100 flex gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-xs shrink-0">
                  2
                </div>
                <div>
                  <h4 className="font-semibold text-slate-800">一键粘贴 SQL 建表</h4>
                  <p className="text-slate-500 text-[11px] mt-0.5">
                    在 Supabase 左侧栏点击 <strong>SQL Editor</strong> → <strong>New query</strong>，把上方「一键初始化 SQL」粘贴进去点 <strong>Run</strong>。
                  </p>
                </div>
              </div>

              <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100 flex gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-xs shrink-0">
                  3
                </div>
                <div>
                  <h4 className="font-semibold text-slate-800">填入密钥并注册你的专属邮箱</h4>
                  <p className="text-slate-500 text-[11px] mt-0.5">
                    在 <strong>Project Settings → API</strong> 复制 URL 和 anon key 填入「数据库连接配置」，然后在「邮箱安全登录」中注册你的个人账号即可！
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 底部操作栏 */}
        <div className="px-4 sm:px-6 py-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onSyncTriggered?.();
              }}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>立即同步</span>
              {pendingSyncCount > 0 && (
                <span className="px-1.5 py-0.2 bg-amber-100 text-amber-700 rounded-full text-[10px]">
                  {pendingSyncCount}待传
                </span>
              )}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleTest}
              disabled={testing}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors"
            >
              {testing ? '测试中...' : '测试连接'}
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm shadow-blue-500/20"
            >
              保存连接配置
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
