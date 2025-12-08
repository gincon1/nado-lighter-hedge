/**
 * 确认弹窗组件
 * Confirmation modal component
 */

import { X } from 'lucide-react';
import { ReactNode } from 'react';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  content: ReactNode;
}

export function ConfirmModal({ isOpen, onClose, onConfirm, title, content }: ConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 背景遮罩 */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* 弹窗内容 */}
      <div className="relative bg-gray-900 border border-gray-700 rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* 头部 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-800 rounded transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* 内容 */}
        <div className="px-4 py-4 text-gray-300">
          {content}
        </div>

        {/* 底部按钮 */}
        <div className="flex justify-end gap-3 px-4 py-3 border-t border-gray-800">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium transition-colors"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-sm font-medium transition-colors"
          >
            确认开始
          </button>
        </div>
      </div>
    </div>
  );
}
