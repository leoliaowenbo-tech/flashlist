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
  Server,
  Zap,
  Info
} from 'lucide-react';
import { getSupabaseConfig, saveSupabaseConfig, testSupabaseConnection } from '../services/supabase';
import { syncManager } from '../services/syncService';
import { SyncStatus } from '../types/sync';

interface SyncSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  syncStatus: SyncStatus;
  lastSyncedAt?: string | null;
  onSyncTriggered?: () => void;
}

const SQL_SCHEMA = `-- =======================================================
-- 闪念清单 (FlashList) Supabase 快速初始化脚本
-- 在 Supabase 控制台的 SQL Editor 中粘贴运行即可
-- =======================================================

CREATE TABLE IF NOT EXISTS public.tasks (
    id TEXT PRIMARY KEY,
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

CREATE TABLE IF NOT EXISTS public.task_lists (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#3B82F6',
    icon TEXT,
    folder_id TEXT,
    is_deleted BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.tag_rules (
    tag TEXT PRIMARY KEY,
    keywords JSONB DEFAULT '[]'::jsonb,
    enabled BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tag_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anon All Tasks" ON public.tasks;
CREATE POLICY "Anon All Tasks" ON public.tasks FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Anon All Task Lists" ON public.task_lists;
CREATE POLICY "Anon All Task Lists" ON public.task_lists FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Anon All Tag Rules" ON public.tag_rules;
CREATE POLICY "Anon All Tag Rules" ON public.tag_rules FOR ALL TO anon USING (true) WITH CHECK (true);

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
  lastSyncedAt,
  onSyncTriggered,
}) => {
  const [url, setUrl] = useState('');
  const [anonKey, setAnonKey] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);
  const [activeTab, setActiveTab] = useState<'config' | 'sql' | 'guide'>('config');

  useEffect(() => {
    if (isOpen) {
      const cfg = getSupabaseConfig();
      setUrl(cfg.supabaseUrl || '');
      setAnonKey(cfg.supabaseAnonKey || '');
      setTestResult(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    saveSupabaseConfig({
      supabaseUrl: url.trim(),
      supabaseAnonKey: anonKey.trim(),
      enabled: Boolean(url.trim() && anonKey.trim()),
    });
    syncManager.initRealtimeSubscription();
    onSyncTriggered?.();
    setTestResult({ success: true, message: '配置已保存并开始同步！' });
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

  const handleCopySql = () => {
    navigator.clipboard.writeText(SQL_SCHEMA);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 顶部标题栏 */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
                云端多端同步设置
                <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                  syncStatus === 'connected' 
                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                    : syncStatus === 'syncing'
                    ? 'bg-amber-50 text-amber-600 border border-amber-200'
                    : 'bg-slate-100 text-slate-500 border border-slate-200'
                }`}>
                  {syncStatus === 'connected' ? '● 实时同步中' : syncStatus === 'syncing' ? '● 正在同步' : '○ 离线/未配置'}
                </span>
              </h2>
              <p className="text-xs text-slate-400">基于 Supabase 实现手机与电脑端零延迟自动双向同步 (完全免费)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 导航 Tab */}
        <div className="flex border-b border-slate-100 px-6 gap-6 text-xs font-medium">
          <button
            onClick={() => setActiveTab('config')}
            className={`py-3 border-b-2 transition-colors ${
              activeTab === 'config'
                ? 'border-blue-600 text-blue-600 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            连接配置
          </button>
          <button
            onClick={() => setActiveTab('sql')}
            className={`py-3 border-b-2 transition-colors flex items-center gap-1 ${
              activeTab === 'sql'
                ? 'border-blue-600 text-blue-600 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            一键初始化 SQL
          </button>
          <button
            onClick={() => setActiveTab('guide')}
            className={`py-3 border-b-2 transition-colors ${
              activeTab === 'guide'
                ? 'border-blue-600 text-blue-600 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            3步极速开通指南
          </button>
        </div>

        {/* 内容区 */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1 text-sm">
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

          {activeTab === 'sql' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  在 Supabase 控制台的 SQL Editor 中执行此脚本以自动建表与开启推送：
                </span>
                <button
                  onClick={handleCopySql}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
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

          {activeTab === 'guide' && (
            <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
              <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100 flex gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-xs shrink-0">
                  1
                </div>
                <div>
                  <h4 className="font-semibold text-slate-800">注册并新建免费项目</h4>
                  <p className="text-slate-500 text-[11px] mt-0.5">
                    访问 <a href="https://supabase.com" target="_blank" rel="noreferrer" className="text-blue-600 underline font-medium inline-flex items-center gap-0.5">supabase.com <ExternalLink className="w-3 h-3" /></a>，点击 "New project"，填写任意项目名称并设置数据库密码。
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
                    在 Supabase 左侧栏点击 <strong>SQL Editor</strong>，点击 <strong>New query</strong>，将第二页的 SQL 全部粘贴进去，点击右下角 <strong>Run</strong>。
                  </p>
                </div>
              </div>

              <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100 flex gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-xs shrink-0">
                  3
                </div>
                <div>
                  <h4 className="font-semibold text-slate-800">复制密钥到此处</h4>
                  <p className="text-slate-500 text-[11px] mt-0.5">
                    在 Supabase 左下角 <strong>Project Settings → API</strong> 中，复制 <strong>Project URL</strong> 和 <strong>anon public key</strong> 粘贴到上面的连接配置中保存即可！
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 底部操作栏 */}
        <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onSyncTriggered?.();
              }}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              立即触发同步
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
              保存并连接
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
