import React, { useEffect, useRef, useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { TaskList } from '../types';

interface ListContextMenuProps {
  x: number;
  y: number;
  list: TaskList;
  onClose: () => void;
  onEdit: (list: TaskList) => void;
  onDelete: (list: TaskList) => void;
}

export const ListContextMenu: React.FC<ListContextMenuProps> = ({
  x,
  y,
  list,
  onClose,
  onEdit,
  onDelete,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [adjustedPos, setAdjustedPos] = useState({ x, y });

  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const menuWidth = rect.width || 160;
      const menuHeight = rect.height || 100;

      let newX = x;
      let newY = y;

      if (x + menuWidth > window.innerWidth - 12) {
        newX = Math.max(12, window.innerWidth - menuWidth - 12);
      }
      if (y + menuHeight > window.innerHeight - 12) {
        newY = Math.max(12, window.innerHeight - menuHeight - 12);
      }

      setAdjustedPos({ x: newX, y: newY });
    }
  }, [x, y]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    const handleScroll = () => {
      onClose();
    };

    const timer = setTimeout(() => {
      window.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('contextmenu', handleClickOutside);
      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('scroll', handleScroll, true);
    }, 50);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('contextmenu', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      style={{ left: `${adjustedPos.x}px`, top: `${adjustedPos.y}px` }}
      onClick={(e) => e.stopPropagation()}
      className="fixed z-50 bg-white/95 backdrop-blur-md rounded-xl shadow-2xl border border-slate-200/90 p-1 min-w-[150px] text-xs text-slate-700 select-none animate-in fade-in zoom-in-95 duration-100"
    >
      <div className="px-2.5 py-1.5 font-medium text-slate-400 text-[10px] uppercase tracking-wider flex items-center gap-1.5 truncate border-b border-slate-100 mb-1">
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: list.color }}
        />
        <span className="truncate">{list.name}</span>
      </div>

      <button
        type="button"
        onClick={() => {
          onEdit(list);
          onClose();
        }}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 transition-colors text-left"
      >
        <Pencil size={13} className="text-slate-500" />
        <span>编辑清单</span>
      </button>

      <div className="h-px bg-slate-100 my-1" />

      <button
        type="button"
        onClick={() => {
          onDelete(list);
          onClose();
        }}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors text-left font-medium"
      >
        <Trash2 size={13} className="shrink-0" />
        <span>删除清单</span>
      </button>
    </div>
  );
};
