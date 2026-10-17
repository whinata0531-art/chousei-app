'use client';

import { useState } from 'react';
import Link from 'next/link';
import { History, X, ChevronRight, Trash2 } from 'lucide-react';
import { RecentEvent } from '@/app/types';

type Props = {
  recentEvents: RecentEvent[];
  onRemove: (e: React.MouseEvent, eventId: string) => void;
  currentEventId?: string;
};

export default function RecentEventsModal({ recentEvents, onRemove, currentEventId }: Props) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-1.5 text-sm bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 px-3 py-2 rounded-lg font-bold hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors shadow-sm border border-gray-200 dark:border-gray-700"
      >
        <History size={16} className="text-blue-600 dark:text-blue-400" />
        <span>履歴</span>
        {recentEvents.length > 0 && (
          <span className="text-[11px] bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded-full leading-none">
            {recentEvents.length}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 mb-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border dark:border-gray-700 w-full max-w-md overflow-hidden animate-fade-in"
            onClick={e => e.stopPropagation()}
          >
            {/* モーダルヘッダー */}
            <div className="flex items-center justify-between px-5 py-4 border-b dark:border-gray-700 bg-blue-50/70 dark:bg-blue-900/20">
              <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400">
                <History size={20} />
                <h2 className="text-base font-bold text-gray-800 dark:text-gray-100">
                  最近見た・調整中のイベント
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition"
              >
                <X size={20} />
              </button>
            </div>

            {/* イベントリスト */}
            <div className="p-4 max-h-[65vh] overflow-y-auto space-y-2.5">
              {recentEvents.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
                  <p className="text-sm text-gray-500 dark:text-gray-400 font-bold">
                    まだ閲覧したイベントの履歴がありません
                  </p>
                </div>
              ) : (
                recentEvents.map(re => {
                  const isCurrent = currentEventId === re.id;
                  return (
                    <Link
                      key={re.id}
                      href={`/event/${re.id}`}
                      onClick={() => setIsOpen(false)}
                      className={`flex items-center justify-between gap-3 p-3.5 rounded-xl border transition shadow-xs group ${
                        isCurrent
                          ? 'bg-blue-50/80 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700'
                          : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/70'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {isCurrent && (
                            <span className="shrink-0 text-[10px] font-bold bg-blue-600 text-white px-2 py-0.5 rounded-full">
                              表示中
                            </span>
                          )}
                          <span className="font-bold text-sm text-gray-800 dark:text-gray-100 truncate">
                            {re.title}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={e => onRemove(e, re.id)}
                          className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition"
                          title="履歴から削除"
                        >
                          <Trash2 size={16} />
                        </button>
                        <ChevronRight
                          size={18}
                          className="text-gray-400 group-hover:text-blue-500 transition"
                        />
                      </div>
                    </Link>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
