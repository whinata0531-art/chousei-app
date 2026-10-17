// app/components/ResponseTab.tsx
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { CalendarCheck, CalendarDays, History, Loader2, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';
import { getFixedDate, formatSlotTime } from '@/lib/utils';
import { useEventLogic } from '../hooks/useEventLogic';
import { Slot, Status } from '../types';

type Props = { logic: ReturnType<typeof useEventLogic> };

export default function ResponseTab({ logic }: Props) {
  const router = useRouter();
  const [isBulkOpen, setIsBulkOpen] = useState(false);

  // 日付ごとに候補枠をグループ化（日付見出しをセクションごとにSticky固定するため）
  const groupedByDate: { dateKey: string; label: string; slots: Slot[] }[] = [];
  logic.slots.forEach(slot => {
    const d = getFixedDate(slot.start_at);
    const dateKey = format(d, 'yyyy-MM-dd');
    const lastGroup = groupedByDate[groupedByDate.length - 1];
    if (!lastGroup || lastGroup.dateKey !== dateKey) {
      groupedByDate.push({
        dateKey,
        label: format(d, 'yyyy年M月d日 (E)', { locale: ja }),
        slots: [slot],
      });
    } else {
      lastGroup.slots.push(slot);
    }
  });

  // 全枠一括変更
  const handleBulkSetAll = (status: Status) => {
    const next: Record<string, Status> = {};
    logic.slots.forEach(s => {
      next[s.id] = status;
    });
    logic.setAnswers(next);
    setIsBulkOpen(false);
    const label = status === 'maru' ? '⭕️' : status === 'sankaku' ? '🔺' : '❌';
    logic.showToast(`すべての枠を「${label}」に変更しました`, 'info');
  };

  return (
    <>
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow px-6 pb-6 relative">
        {/* カード最上部の青いバー＋角丸＋余白（常に1つだけ上部に残り、スクロール時は名前欄などがこの下にすーっと潜り込む） */}
        <div className="sticky top-[3.75rem] z-30 -mx-6 bg-gray-50 dark:bg-[#0a0a0a]">
          <div className="h-3 bg-white dark:bg-gray-900 border-t-4 border-t-blue-500 dark:border-t-blue-500 rounded-t-xl" />
        </div>

        <div className="mb-4 pt-3">
          <label className="block text-sm font-bold mb-1 dark:text-gray-300">お名前 *</label>
          <input
            type="text"
            value={logic.guestName}
            onChange={e => logic.setGuestName(e.target.value)}
            className="w-full p-3 bg-gray-50 dark:bg-gray-800 border dark:border-gray-700 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="名前を入力"
          />
        </div>

        <div className="flex flex-col gap-2.5 mb-5">
          {logic.isGoogleLoggedIn && (
            <button
              onClick={logic.applyGoogleCalendar}
              disabled={logic.submitting}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-3 bg-emerald-50 dark:bg-emerald-900/30 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-400 text-sm font-bold rounded-lg border border-emerald-200 dark:border-emerald-800/50 shadow-sm transition disabled:opacity-50 whitespace-nowrap"
            >
              <CalendarCheck size={18} className="shrink-0" />
              <span>{logic.submitting ? '同期中...' : 'Googleカレンダーから自動反映'}</span>
            </button>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              onClick={logic.applyWeeklyRoutine}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-3 bg-purple-50 dark:bg-purple-900/30 hover:bg-purple-100 text-purple-700 dark:text-purple-400 text-sm font-bold rounded-lg border border-purple-200 dark:border-purple-800/50 shadow-sm transition whitespace-nowrap"
            >
              <CalendarDays size={18} className="shrink-0" /> 設定したシフトを反映
            </button>
            {Object.keys(logic.pastAvailabilities).length > 0 ? (
              <button
                onClick={logic.applySmartCopy}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-3 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 text-blue-700 dark:text-blue-400 text-sm font-bold rounded-lg border border-blue-200 dark:border-blue-800/50 shadow-sm transition whitespace-nowrap"
              >
                <History size={18} className="shrink-0" /> 他の予定からコピー
              </button>
            ) : (
              <div className="w-full flex items-center justify-center gap-2 py-2.5 px-3 bg-gray-50 dark:bg-gray-800 text-gray-400 dark:text-gray-500 text-xs font-bold rounded-lg border border-gray-200 dark:border-gray-700 whitespace-nowrap">
                <History size={16} className="shrink-0" /> 過去の予定はありません
              </div>
            )}
          </div>
        </div>

        {/* 見出し＆端のコンパクトな一括変更アコーディオン */}
        <div className="mb-2">
          <div className="flex justify-between items-end border-b dark:border-gray-700 pb-2">
            <h3 className="font-bold text-base text-gray-800 dark:text-gray-100">日程の選択</h3>
            <button
              type="button"
              onClick={() => setIsBulkOpen(!isBulkOpen)}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50/70 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 border border-blue-200 dark:border-blue-800 rounded-md transition"
            >
              <span>一括変更</span>
              {isBulkOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>

          {isBulkOpen && (
            <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-800/80 rounded-lg border border-gray-200 dark:border-gray-700 grid grid-cols-3 gap-2 animate-fade-in">
              <button
                type="button"
                onClick={() => handleBulkSetAll('maru')}
                className="py-1.5 px-2 text-xs font-bold bg-white dark:bg-gray-800 hover:bg-green-50 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-700 rounded-md shadow-xs transition whitespace-nowrap"
              >
                すべて ⭕️
              </button>
              <button
                type="button"
                onClick={() => handleBulkSetAll('sankaku')}
                className="py-1.5 px-2 text-xs font-bold bg-white dark:bg-gray-800 hover:bg-orange-50 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-700 rounded-md shadow-xs transition whitespace-nowrap"
              >
                すべて 🔺
              </button>
              <button
                type="button"
                onClick={() => handleBulkSetAll('batsu')}
                className="py-1.5 px-2 text-xs font-bold bg-white dark:bg-gray-800 hover:bg-red-50 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-700 rounded-md shadow-xs transition whitespace-nowrap"
              >
                すべて ❌
              </button>
            </div>
          )}
        </div>

        {/* 日付ごとのグループ（普段はシンプルな日付バーで、スクロール時に上部の青いバーの下にピタッと合体する） */}
        <div className="space-y-4 mb-6">
          {groupedByDate.map(group => (
            <div key={group.dateKey} className="relative">
              <div className="sticky top-[4.5rem] z-20 -mx-6 px-6 pt-1 pb-2.5 bg-white dark:bg-gray-900 border-b border-b-gray-100 dark:border-b-gray-800 shadow-[0_2px_4px_-2px_rgba(0,0,0,0.06)] flex items-center justify-between">
                <span className="text-sm font-bold text-blue-700 dark:text-blue-400 flex items-center gap-1.5">
                  📅 {group.label}
                </span>
                <span className="text-[11px] font-bold text-gray-400 dark:text-gray-500">
                  {group.slots.length}枠
                </span>
              </div>

              <div className="space-y-2.5 pt-2.5">
                {group.slots.map(slot => (
                  <div
                    key={slot.id}
                    className={`p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      slot.is_confirmed
                        ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-600/50'
                        : 'bg-white dark:bg-gray-900 dark:border-gray-700'
                    }`}
                  >
                    <div className="text-sm font-bold text-gray-700 dark:text-gray-200 flex items-center gap-2">
                      {slot.is_confirmed && (
                        <span className="bg-yellow-500 dark:bg-yellow-600 text-xs px-2 py-1 rounded font-bold text-white shadow-sm">
                          仮確定
                        </span>
                      )}
                      {formatSlotTime(slot.start_at, slot.end_at)}
                    </div>
                    <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-lg sm:w-64 shrink-0 gap-1">
                      <button
                        onClick={() => logic.setAnswers({ ...logic.answers, [slot.id]: 'maru' })}
                        className={`flex-1 py-1 text-xl rounded-md transition-all ${
                          logic.answers[slot.id] === 'maru'
                            ? 'bg-white dark:bg-gray-700 shadow border border-green-200 dark:border-green-600 text-green-600'
                            : 'text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 opacity-50'
                        }`}
                      >
                        ⭕️
                      </button>
                      <button
                        onClick={() => logic.setAnswers({ ...logic.answers, [slot.id]: 'sankaku' })}
                        className={`flex-1 py-1 text-xl rounded-md transition-all ${
                          logic.answers[slot.id] === 'sankaku'
                            ? 'bg-white dark:bg-gray-700 shadow border border-orange-200 dark:border-orange-600 text-orange-500'
                            : 'text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 opacity-50'
                        }`}
                      >
                        🔺
                      </button>
                      <button
                        onClick={() => logic.setAnswers({ ...logic.answers, [slot.id]: 'batsu' })}
                        className={`flex-1 py-1 text-xl rounded-md transition-all ${
                          logic.answers[slot.id] === 'batsu'
                            ? 'bg-white dark:bg-gray-700 shadow border border-red-200 dark:border-red-600 text-red-500'
                            : 'text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 opacity-50'
                        }`}
                      >
                        ❌
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={logic.handleSubmit}
          disabled={logic.submitting}
          className="w-full py-4 bg-green-600 text-white font-bold text-lg rounded-xl shadow-lg hover:bg-green-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {logic.submitting ? <Loader2 size={22} className="animate-spin" /> : <CheckCircle2 size={22} />}
          {logic.submitting ? '送信中...' : '回答を送信する'}
        </button>
      </div>

      {/* スクロール時に画面下部に追従する送信バー（日程が多いイベントでもすぐ保存できる） */}
      {logic.showScrollTop && (
        <div className="fixed bottom-0 left-0 right-0 mb-0 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-t border-gray-200 dark:border-gray-700 shadow-[0_-4px_12px_rgba(0,0,0,0.12)] z-40">
          <div className="max-w-2xl mx-auto">
            <button
              onClick={logic.handleSubmit}
              disabled={logic.submitting}
              className="w-full py-3 px-6 bg-green-600 hover:bg-green-700 text-white font-bold text-base rounded-xl shadow-md transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {logic.submitting ? <Loader2 size={20} className="animate-spin" /> : <CheckCircle2 size={20} />}
              {logic.submitting ? '送信中...' : '回答を送信する'}
            </button>
          </div>
        </div>
      )}

      {/* 📅 固定シフト未登録時のコンパクトな案内モーダル */}
      {logic.isShiftPromptOpen && (
        <div className="fixed inset-0 mb-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border dark:border-gray-700 w-full max-w-xs p-5 text-center animate-fade-in">
            <div className="w-11 h-11 mx-auto mb-3 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <CalendarDays size={22} />
            </div>
            <h3 className="text-base font-bold text-gray-800 dark:text-gray-100 mb-1.5">
              固定シフトを登録しますか？
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed mb-4">
              バイトや授業など、毎週の予定を登録しておくとワンタップで自動反映できます。
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => logic.setIsShiftPromptOpen(false)}
                className="flex-1 py-2.5 px-3 rounded-xl text-xs font-bold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition"
              >
                あとで
              </button>
              <button
                type="button"
                onClick={() => {
                  logic.setIsShiftPromptOpen(false);
                  localStorage.setItem('returnPath', window.location.pathname);
                  localStorage.setItem('openShiftAccordion', 'true');
                  router.push('/settings');
                }}
                className="flex-1 py-2.5 px-3 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white shadow-sm transition"
              >
                登録する
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}