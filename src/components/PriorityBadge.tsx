import React from 'react';
import { Priority } from '../types';
import { Flag } from 'lucide-react';

interface PriorityBadgeProps {
  priority: Priority;
  size?: number;
  showText?: boolean;
}

export const PRIORITY_CONFIG: Record<Priority, { label: string; color: string; border: string; bg: string }> = {
  p1: { label: '高优先级', color: 'text-red-500', border: 'border-red-500', bg: 'bg-red-50' },
  p2: { label: '中优先级', color: 'text-amber-500', border: 'border-amber-500', bg: 'bg-amber-50' },
  p3: { label: '低优先级', color: 'text-blue-500', border: 'border-blue-500', bg: 'bg-blue-50' },
  p4: { label: '无优先级', color: 'text-slate-400', border: 'border-slate-300', bg: 'bg-slate-50' },
};

export const PriorityBadge: React.FC<PriorityBadgeProps> = ({ priority, size = 14, showText = false }) => {
  const cfg = PRIORITY_CONFIG[priority];
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${cfg.color}`}>
      <Flag size={size} className="fill-current" />
      {showText && <span>{cfg.label}</span>}
    </span>
  );
};
