'use client';

import { use } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { Pin, Trash2, Settings, Home, ArrowUp, Edit3, Check } from 'lucide-react';
import { getFixedDate, formatSlotTime } from '../../../lib/utils';
import { useEventLogic } from '../../hooks/useEventLogic';

// 💡 NEW: さっき作った3つのタブの部品を呼び出す！
import ResponseTab from '../../components/ResponseTab';
import ResultTab from '../../components/ResultTab';
import MyScheduleTab from '../../components/MyScheduleTab';

export default function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = use(params);
  
  // 裏方の処理を呼び出す
  const logic = useEventLogic(eventId);

  if (logic.loading) return <div className="text-center mt-20">読み込み中...</div>;
  if (!logic.event) return <div className="text-center mt-20 text-red-500 font-bold">イベントが見つかりません（削除された可能性があります）</div>;

  return (
    <div className="max-w-2xl mx-auto p-4 mt-4 space-y-6 pb-20">
      
      {/* 〜〜 ヘッダー部分 〜〜 */}
      <div className="flex justify-between items-center mb-4">
        <Link href="/" className="flex items-center gap-1 text-sm bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 px-4 py-2 rounded-lg font-bold hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors shadow-sm">
          <Home size={16} /> トップへ
        </Link>
        {/* 💡 onClickを追加して、移動する瞬間に自分の場所（トップだから '/'）をメモる！ */}
        <Link 
          href="/settings" 
          onClick={() => localStorage.setItem('returnPath', window.location.pathname)}
          className="flex items-center gap-1 text-sm bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 px-3 py-2 rounded-lg font-bold hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors shadow-sm border border-gray-200 dark:border-gray-700"
        >
          <Settings size={16} /> 設定
        </Link>
      </div>

      {/* 〜〜 イベントタイトル＆メモ編集部分 〜〜 */}
      <div className="text-center mb-6">
        {logic.isHost && logic.isEditingTitle ? (
          <div className="flex flex-col items-center justify-center gap-2 mb-4 w-full">
            <div className="flex items-center gap-2 w-full">
              <input type="text" value={logic.editTitleStr} onChange={e => logic.setEditTitleStr(e.target.value)} className="p-2 border dark:border-gray-700 rounded-lg text-xl font-bold text-gray-800 dark:text-gray-100 dark:bg-gray-800 outline-none focus:ring-2 focus:ring-blue-500 flex-1" />
              <button onClick={logic.handleSaveEventInfo} className="p-2 bg-green-500 hover:bg-green-600 text-white rounded-lg shadow-sm transition shrink-0">
                <Check size={20}/>
              </button>
            </div>
            <textarea value={logic.editDescStr} onChange={e => logic.setEditDescStr(e.target.value)} className="w-full p-2 border dark:border-gray-700 rounded-lg text-sm text-gray-700 dark:text-gray-300 dark:bg-gray-800 outline-none focus:ring-2 focus:ring-blue-500 h-20 resize-none" placeholder="メモ（任意）" />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 mb-2 group">
            <div className="flex items-center justify-center gap-3">
              <h1 className="text-3xl font-bold text-gray-800 dark:text-blue-400 break-words">{logic.event.title}</h1>
              {logic.isHost && (
                <button 
                  onClick={() => { logic.setEditTitleStr(logic.event.title); logic.setEditDescStr(logic.event.description || ''); logic.setIsEditingTitle(true); }} 
                  className="flex-shrink-0 text-gray-500 bg-gray-100 hover:bg-blue-50 hover:text-blue-600 dark:text-gray-400 dark:bg-gray-800 dark:hover:bg-gray-700 dark:hover:text-blue-400 p-2 rounded-full transition shadow-sm"
                  title="イベント情報を編集"
                >
                  <Edit3 size={18} />
                </button>
              )}
            </div>
            {!logic.isEditingTitle && logic.event.description && (
              <p className="text-gray-600 dark:text-gray-300 whitespace-pre-wrap mt-2">{logic.event.description}</p>
            )}
          </div>
        )}
      </div>

      {/* 〜〜 仮確定アラート 〜〜 */}
      {logic.isEventConfirmed && logic.activeTab !== 'my-schedule' && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border-4 border-yellow-400 dark:border-yellow-600/50 p-6 rounded-2xl shadow-md text-center">
          <div className="flex items-center justify-center gap-2 text-yellow-600 dark:text-yellow-400 mb-2">
            <Pin size={24} />
            <h2 className="text-xl font-extrabold dark:text-gray-100">仮確定の日程があります！</h2>
          </div>
          <div className="bg-white dark:bg-gray-800/80 border dark:border-gray-700 rounded-lg p-3 inline-block shadow-sm">
            {logic.confirmedSlots.map(s => (
              <div key={s.id} className="text-lg font-bold text-gray-800 dark:text-gray-100">
                {format(getFixedDate(s.start_at), 'M/d (E)', { locale: ja })} {formatSlotTime(s.start_at, s.end_at)}
              </div>
            ))}
          </div>
          <p className="text-xs text-yellow-700 dark:text-yellow-300/80 mt-4 font-bold">
            ※マイ予定タブに追加されました！<br />
            ※他イベントのスマートコピーでは自動的に「予定あり❌」になります。
          </p>
        </div>
      )}

      {/* 〜〜 タブ切り替えボタン 〜〜 */}
      <div className="flex bg-gray-200 dark:bg-gray-800 rounded-lg p-1 sticky top-4 z-30 shadow">
        <button onClick={() => logic.setActiveTab('response')} className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-md transition-all ${logic.activeTab === 'response' ? 'bg-white dark:bg-gray-700 shadow text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}>
          📝 回答
        </button>
        <button onClick={() => logic.setActiveTab('result')} className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-md transition-all ${logic.activeTab === 'result' ? 'bg-white dark:bg-gray-700 shadow text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}>
          📊 集計
        </button>
        <button onClick={() => logic.setActiveTab('my-schedule')} className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-md transition-all ${logic.activeTab === 'my-schedule' ? 'bg-white dark:bg-gray-700 shadow text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}>
          📅 マイ予定
        </button>
      </div>

      {/* 💡 NEW: 各タブの中身を、部品化して超スッキリ呼び出す！！ */}
      {logic.activeTab === 'response' && <ResponseTab logic={logic} />}
      {logic.activeTab === 'result' && <ResultTab logic={logic} />}
      {logic.activeTab === 'my-schedule' && <MyScheduleTab logic={logic} />}

      {/* 〜〜 管理者メニュー 〜〜 */}
      {logic.isHost && (
        <div className="mt-12 pt-6 border-t border-gray-200 dark:border-gray-700">
          <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-xl border border-gray-200 dark:border-gray-700 text-center space-y-6">
            <h3 className="text-gray-800 dark:text-gray-200 font-bold flex items-center justify-center gap-2">
              👑 管理者メニュー
            </h3>
            
            <Link href={`/event/${eventId}/edit`} className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-sm transition-colors">
              <Edit3 size={20} /> イベント内容・日程を編集する
            </Link>

            <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
              <h4 className="text-red-800 dark:text-red-400 font-bold mb-2 flex items-center justify-center gap-2 text-sm">
                <Trash2 size={18} /> イベントの完全削除
              </h4>
              <p className="text-xs text-red-600 dark:text-red-500 mb-4">全員の回答データも消滅し、二度と復元できません。</p>
              <button onClick={logic.handleDeleteEvent} className="w-full sm:w-auto px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg shadow-sm transition-colors text-sm">
                本当のこのイベントを削除する
              </button>
            </div>
          </div>
        </div>
      )}

      {logic.showScrollTop && (
        <button onClick={logic.scrollToTop} className="fixed bottom-6 right-6 p-4 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg transition-all z-50 animate-fade-in-up">
          <ArrowUp size={24} />
        </button>
      )}
    </div>
  );
}