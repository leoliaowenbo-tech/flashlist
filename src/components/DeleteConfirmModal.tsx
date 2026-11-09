import React, { useEffect } from 'react';
import { Trash2 } from 'lucide-react';
import { Task } from '../types';

interface DeleteConfirmModalProps {
  task: Task | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  task,
  onConfirm,
  onCancel,
}) => {
  useEffect(() => {
    if (!task) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        onConfirm();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [task, onConfirm, onCancel]);

  if (!task) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs animate-in fade-in duration-150 select-none"
      onClick={onCancel}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-slate-200/90 p-5 max-w-sm w-full mx-4 animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-full bg-red-50 border border-red-100 flex items-center justify-center text-red-500 shrink-0">
            <Trash2 size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-slate-800">确认删除任务？</h3>
            <p className="text-xs text-slate-600 mt-1.5 font-medium bg-slate-50 p-2.5 rounded-xl border border-slate-200/60 truncate">
              {task.title}
            </p>
            <p className="text-[11px] text-slate-400 mt-2">
              删除后该任务将被永久移除，无法恢复。
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 mt-5 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onCancel}
            className="px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            取消
          </button>
          <button
            type="button"
            autoFocus
            onClick={onConfirm}
            className="px-4 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 active:bg-red-800 rounded-lg transition-colors shadow-xs cursor-pointer"
          >
            确认删除
          </button>
        </div>
      </div>
    </div>
  );
};
