import React, { useState, useEffect } from 'react';
import { X, Tag, Plus, RotateCcw, Check, Sparkles, AlertCircle, Trash2, Tag as TagIcon } from 'lucide-react';
import { TagRule, getTagRules, saveTagRules, DEFAULT_TAG_RULES } from '../utils/tagRecognizer';

interface TagRuleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRulesUpdated?: () => void;
}

export const TagRuleModal: React.FC<TagRuleModalProps> = ({
  isOpen,
  onClose,
  onRulesUpdated,
}) => {
  const [rules, setRules] = useState<TagRule[]>([]);
  const [newKeywordInputs, setNewKeywordInputs] = useState<Record<string, string>>({});
  const [saveSuccess, setSaveSuccess] = useState(false);

  // 新增标签表单状态
  const [showAddTagForm, setShowAddTagForm] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagKeywords, setNewTagKeywords] = useState('');
  const [addTagError, setAddTagError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setRules(getTagRules());
      setSaveSuccess(false);
      setShowAddTagForm(false);
      setNewTagName('');
      setNewTagKeywords('');
      setAddTagError('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAddNewTagRule = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTag = newTagName.trim().replace(/^#/, '');
    if (!cleanTag) {
      setAddTagError('请输入标签名称');
      return;
    }
    if (rules.some(r => r.tag.toLowerCase() === cleanTag.toLowerCase())) {
      setAddTagError(`标签 #${cleanTag} 已存在`);
      return;
    }

    const kwList = newTagKeywords
      .split(/[,，\s]+/)
      .map(k => k.trim())
      .filter(Boolean);

    const newRule: TagRule = {
      tag: cleanTag,
      keywords: kwList,
      enabled: true,
    };

    setRules(prev => [newRule, ...prev]);
    setNewTagName('');
    setNewTagKeywords('');
    setAddTagError('');
    setShowAddTagForm(false);
  };

  const handleDeleteRule = (ruleIndex: number) => {
    const targetTag = rules[ruleIndex].tag;
    if (confirm(`确定要移除标签规则 "#${targetTag}" 吗？（不会影响已有任务上的该标签）`)) {
      setRules(prev => prev.filter((_, i) => i !== ruleIndex));
    }
  };

  const handleToggleRule = (index: number) => {
    setRules(prev => {
      const next = [...prev];
      next[index] = { ...next[index], enabled: !next[index].enabled };
      return next;
    });
  };

  const handleRemoveKeyword = (ruleIndex: number, kwIndex: number) => {
    setRules(prev => {
      const next = [...prev];
      const targetRule = next[ruleIndex];
      const updatedKeywords = targetRule.keywords.filter((_, i) => i !== kwIndex);
      next[ruleIndex] = { ...targetRule, keywords: updatedKeywords };
      return next;
    });
  };

  const handleAddKeyword = (ruleIndex: number) => {
    const targetTag = rules[ruleIndex].tag;
    const inputVal = (newKeywordInputs[targetTag] || '').trim();
    if (!inputVal) return;

    setRules(prev => {
      const next = [...prev];
      const targetRule = next[ruleIndex];
      if (!targetRule.keywords.includes(inputVal)) {
        next[ruleIndex] = {
          ...targetRule,
          keywords: [...targetRule.keywords, inputVal],
        };
      }
      return next;
    });

    setNewKeywordInputs(prev => ({ ...prev, [targetTag]: '' }));
  };

  const handleResetToDefault = () => {
    if (confirm('确定要恢复默认的 10 大分类关键词规则吗？已有的自定义词汇将被重置。')) {
      setRules(DEFAULT_TAG_RULES);
      saveTagRules(DEFAULT_TAG_RULES);
      onRulesUpdated?.();
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    }
  };

  const handleSave = () => {
    saveTagRules(rules);
    onRulesUpdated?.();
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      onClose();
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col border border-slate-200/90 overflow-hidden animate-in fade-in duration-200">
        {/* 标题栏 */}
        <div className="px-6 py-4 border-b border-slate-200/80 flex items-center justify-between bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-200/60 shadow-2xs">
              <Sparkles size={16} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">
                关键词智能打标规则
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                在输入任务或语音说话时，检测到下列词汇将自动关联对应标签
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowAddTagForm(v => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-medium shadow-xs transition-colors"
            >
              <Plus size={14} />
              <span>新建标签规则</span>
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* 规则列表区域 */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* 新增标签分类表单卡片 */}
          {showAddTagForm && (
            <form
              onSubmit={handleAddNewTagRule}
              className="p-4 bg-gradient-to-r from-indigo-50/90 to-purple-50/80 border border-indigo-200 rounded-xl space-y-3 animate-in fade-in slide-in-from-top-2 duration-150"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-xs text-indigo-900 flex items-center gap-1.5">
                  <TagIcon size={14} className="text-indigo-600" />
                  创建全新自定义标签及识别词
                </span>
                <button
                  type="button"
                  onClick={() => setShowAddTagForm(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    标签名称 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    autoFocus
                    placeholder="如：技术调研、重点客户"
                    value={newTagName}
                    onChange={(e) => {
                      setNewTagName(e.target.value);
                      setAddTagError('');
                    }}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    触发关键词（逗号或空格隔开，可选）
                  </label>
                  <input
                    type="text"
                    placeholder="如：调研, POC, 竞品, 架构"
                    value={newTagKeywords}
                    onChange={(e) => setNewTagKeywords(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>

              {addTagError && (
                <div className="text-[11px] text-red-600 flex items-center gap-1">
                  <AlertCircle size={12} />
                  <span>{addTagError}</span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAddTagForm(false)}
                  className="px-3 py-1 text-xs text-slate-600 hover:bg-slate-200/60 rounded-md transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-md font-medium shadow-2xs transition-colors"
                >
                  确认添加
                </button>
              </div>
            </form>
          )}

          {rules.map((rule, ruleIdx) => {
            const inputVal = newKeywordInputs[rule.tag] || '';

            return (
              <div
                key={rule.tag}
                className={`p-3.5 rounded-xl border transition-all ${
                  rule.enabled
                    ? 'bg-white border-slate-200/80 shadow-2xs hover:border-slate-300'
                    : 'bg-slate-50/80 border-slate-200/40 opacity-60'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 font-semibold text-xs text-indigo-800 bg-indigo-50 border border-indigo-200/80 px-2.5 py-0.5 rounded-md">
                      <Tag size={12} className="text-indigo-600" />
                      #{rule.tag}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      ({rule.keywords.length} 个触发词)
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 cursor-pointer text-xs">
                      <input
                        type="checkbox"
                        checked={rule.enabled}
                        onChange={() => handleToggleRule(ruleIdx)}
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-slate-500 text-[11px]">
                        {rule.enabled ? '已启用' : '已停用'}
                      </span>
                    </label>

                    <button
                      type="button"
                      onClick={() => handleDeleteRule(ruleIdx)}
                      className="p-1 text-slate-300 hover:text-red-500 rounded transition-colors"
                      title="移除此标签规则"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* 关键词标签集合 */}
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  {rule.keywords.map((kw, kwIdx) => (
                    <span
                      key={`${kw}-${kwIdx}`}
                      className="inline-flex items-center gap-1 bg-slate-100 hover:bg-slate-200/80 text-slate-700 text-xs px-2 py-0.5 rounded-md border border-slate-200/60 transition-colors"
                    >
                      <span>{kw}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveKeyword(ruleIdx, kwIdx)}
                        className="text-slate-400 hover:text-red-500 p-0.5"
                        title="删除该关键词"
                      >
                        <X size={11} />
                      </button>
                    </span>
                  ))}

                  {/* 添加关键词输入 */}
                  <div className="inline-flex items-center gap-1">
                    <input
                      type="text"
                      placeholder="+ 添加词"
                      value={inputVal}
                      onChange={(e) =>
                        setNewKeywordInputs(prev => ({
                          ...prev,
                          [rule.tag]: e.target.value,
                        }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddKeyword(ruleIdx);
                        }
                      }}
                      className="w-20 px-2 py-0.5 text-xs bg-slate-50 border border-dashed border-slate-300 rounded-md outline-none focus:w-28 focus:border-indigo-500 focus:bg-white transition-all text-slate-700 placeholder:text-slate-400"
                    />
                    {inputVal.trim() && (
                      <button
                        type="button"
                        onClick={() => handleAddKeyword(ruleIdx)}
                        className="p-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-xs shadow-2xs"
                      >
                        <Plus size={11} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* 底部按钮栏 */}
        <div className="px-6 py-3 border-t border-slate-200/80 flex items-center justify-between bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetToDefault}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 px-3 py-1.5 rounded-lg hover:bg-slate-200/60 transition-colors"
            >
              <RotateCcw size={13} />
              <span>重置为默认规则</span>
            </button>
            <button
              type="button"
              onClick={() => {
                saveTagRules(rules);
                onRulesUpdated?.();
                setSaveSuccess(true);
                setTimeout(() => setSaveSuccess(false), 2000);
              }}
              className="flex items-center gap-1.5 text-xs text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/80 px-3 py-1.5 rounded-lg transition-colors font-medium"
              title="立即将当前关键词规则扫描并直接打标到所有任务"
            >
              <Sparkles size={13} />
              <span>一键直接打标所有任务</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {saveSuccess && (
              <span className="text-xs text-emerald-600 font-medium flex items-center gap-1 mr-2">
                <Check size={14} /> 已保存配置
              </span>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs text-slate-600 hover:bg-slate-200/60 rounded-lg transition-colors font-medium"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
            >
              <Check size={13} />
              <span>保存修改</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
