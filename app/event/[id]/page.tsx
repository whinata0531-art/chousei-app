'use client';

import { use } from 'react';
import Link from 'next/link';
import { Settings, Home, ArrowUp, Edit3, Loader2 } from 'lucide-react';
import { useEventLogic } from '../../hooks/useEventLogic';

import ResponseTab from '../../components/ResponseTab';
import ResultTab from '../../components/ResultTab';
import RecentEventsModal from '../../components/RecentEventsModal';

export default function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = use(params);
  
  // 裏方の処理を呼び出す
  const logic = useEventLogic(eventId);

  if (logic.loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 text-gray-500 dark:text-gray-400">
        <Loader2 size={36} className="animate-spin text-blue-600 dark:text-blue-400" />
        <p className="text-sm font-bold tracking-wide">イベント情報を読み込み中...</p>
      </div>
    );
  }
  if (!logic.event) return <div className="text-center mt-20 text-red-500 font-bold">イベントが見つかりません（削除された可能性があります）</div>;

  const hasBottomBar =
    (logic.activeTab === 'result' && logic.isShareSelectMode) ||
    (logic.activeTab === 'response' && logic.showScrollTop);

  return (
    <div className="max-w-2xl mx-auto p-4 mt-4 pb-24 [overflow-anchor:none]">
      {/* 〜〜 トースト通知（alertの代わりのプロっぽい通知バー） 〜〜 */}
      {logic.toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-md pointer-events-none animate-fade-in">
          <div
            className={`px-4 py-3 rounded-xl shadow-lg border font-bold text-sm flex items-center justify-center gap-2 text-center backdrop-blur-md ${
              logic.toast.type === 'error'
                ? 'bg-red-600/95 text-white border-red-500'
                : logic.toast.type === 'info'
                ? 'bg-gray-900/95 dark:bg-gray-100/95 text-white dark:text-gray-900 border-gray-700'
                : 'bg-green-600/95 text-white border-green-500'
            }`}
          >
            <span>{logic.toast.message}</span>
          </div>
        </div>
      )}

      {/* 〜〜 ヘッダー部分 〜〜 */}
      <div className="flex justify-between items-center mb-6">
        <Link href="/" className="flex items-center gap-1 text-sm bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 px-4 py-2 rounded-lg font-bold hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors shadow-sm">
          <Home size={16} /> トップへ
        </Link>
        <div className="flex items-center gap-2">
          <RecentEventsModal
            recentEvents={logic.recentEvents}
            onRemove={logic.removeRecentEvent}
            currentEventId={eventId}
          />
          {/* 💡 onClickを追加して、移動する瞬間に自分の場所をメモる！ */}
          <Link 
            href="/settings" 
            onClick={() => localStorage.setItem('returnPath', window.location.pathname)}
            className="flex items-center gap-1 text-sm bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 px-3 py-2 rounded-lg font-bold hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors shadow-sm border border-gray-200 dark:border-gray-700"
          >
            <Settings size={16} /> 設定
          </Link>
        </div>
      </div>

      {/* 〜〜 イベントタイトル＆メモ＆編集導線 〜〜 */}
      <div className="text-center mb-4 flex flex-col items-center gap-2">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-blue-400 break-words">
          {logic.event.title}
        </h1>
        {logic.event.description && (
          <p className="text-gray-600 dark:text-gray-300 whitespace-pre-wrap text-sm mt-1">
            {logic.event.description}
          </p>
        )}
        <Link
          href={`/event/${eventId}/edit`}
          className="mt-1 inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-gray-600 dark:text-gray-300 bg-gray-100 hover:bg-blue-50 hover:text-blue-600 dark:bg-gray-800 dark:hover:bg-gray-700 dark:hover:text-blue-400 rounded-full border border-gray-200 dark:border-gray-700 transition shadow-xs"
        >
          <Edit3 size={14} />
          <span>日程・内容を編集する</span>
        </Link>
      </div>

      {/* 〜〜 タブ切り替えボタン（回答タブ時は下端の青いバーも同一sticky内に統合し、別階層のsticky干渉を防ぐ） 〜〜 */}
      <div className="sticky top-0 z-30 bg-white dark:bg-[#0a0a0a] pt-2 -mx-4 px-4 will-change-transform">
        <div className="pb-3">
          <div className="flex h-11 bg-gray-200 dark:bg-gray-800 rounded-lg p-1 shadow-sm">
            <button onClick={() => logic.setActiveTab('response')} className={`flex-1 text-sm font-bold rounded-md transition-all ${logic.activeTab === 'response' ? 'bg-white dark:bg-gray-700 shadow text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}>
              📝 回答
            </button>
            <button onClick={() => logic.setActiveTab('result')} className={`flex-1 text-sm font-bold rounded-md transition-all ${logic.activeTab === 'result' ? 'bg-white dark:bg-gray-700 shadow text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}>
              📊 集計
            </button>
          </div>
        </div>
        {logic.activeTab === 'response' && (
          <div className="h-3 bg-white dark:bg-gray-900 border-t-4 border-t-blue-500 dark:border-t-blue-500 rounded-t-xl pointer-events-none" />
        )}
      </div>

      {/* 💡 各タブの中身を呼び出す */}
      {logic.activeTab === 'response' && <ResponseTab logic={logic} />}
      {logic.activeTab === 'result' && <ResultTab logic={logic} />}

      <button
        onClick={logic.scrollToTop}
        aria-hidden={!logic.showScrollTop}
        tabIndex={logic.showScrollTop ? 0 : -1}
        className={`fixed right-6 p-4 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg transition-all duration-200 z-40 ${
          hasBottomBar ? 'bottom-24' : 'bottom-6'
        } ${
          logic.showScrollTop
            ? 'opacity-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
      >
        <ArrowUp size={24} />
      </button>
    </div>
  );
}
