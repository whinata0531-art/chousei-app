// app/components/ResponseTab.tsx
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { CalendarCheck, CalendarDays, History } from 'lucide-react';
import { getFixedDate, formatSlotTime } from '@/lib/utils';
import { useEventLogic } from '../hooks/useEventLogic';

type Props = { logic: ReturnType<typeof useEventLogic> };

export default function ResponseTab({ logic }: Props) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl shadow p-6 border-t-4 border-blue-500 relative">
      <div className="mb-4">
        <label className="block text-sm font-bold mb-1 dark:text-gray-300">お名前 *</label>
        <input type="text" value={logic.guestName} onChange={e => logic.setGuestName(e.target.value)}
          className="w-full p-3 bg-gray-50 dark:bg-gray-800 border dark:border-gray-700 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="名前を入力" />
      </div>

      <div className="flex flex-col gap-3 mb-6">
        {logic.isGoogleLoggedIn && (
          <button onClick={logic.applyGoogleCalendar} disabled={logic.loading}
            className="w-full flex items-center justify-center gap-2 py-4 bg-emerald-50 dark:bg-emerald-900/30 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-400 text-base font-bold rounded-xl border-2 border-emerald-200 dark:border-emerald-800/50 shadow-sm transition disabled:opacity-50">
            <CalendarCheck size={20} /> {logic.loading ? '同期中...' : 'Googleカレンダーの予定を自動で反映する'}
          </button>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button onClick={logic.applyWeeklyRoutine} className="w-full flex items-center justify-center gap-2 py-3 bg-purple-50 dark:bg-purple-900/30 hover:bg-purple-100 text-purple-700 dark:text-purple-400 text-sm font-bold rounded-lg border border-purple-200 dark:border-purple-800/50 shadow-sm transition">
            <CalendarDays size={18} /> 設定したシフトを反映
          </button>
          {Object.keys(logic.pastAvailabilities).length > 0 ? (
            <button onClick={logic.applySmartCopy} className="w-full flex items-center justify-center gap-2 py-3 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 text-blue-700 dark:text-blue-400 text-sm font-bold rounded-lg border border-blue-200 dark:border-blue-800/50 shadow-sm transition">
              <History size={18} /> 他の予定からコピー
            </button>
          ) : (
            <div className="w-full flex items-center justify-center gap-2 py-3 bg-gray-50 dark:bg-gray-800 text-gray-400 dark:text-gray-500 text-xs font-bold rounded-lg border border-gray-200 dark:border-gray-700">
              <History size={16} /> 過去の予定はありません
            </div>
          )}
        </div>
      </div>

      <div className="space-y-3 mb-6 mt-4">
        {logic.slots.map((slot, index) => {
          const prevSlot = index > 0 ? logic.slots[index-1] : null;
          const isFirstOfDay = !prevSlot || format(getFixedDate(slot.start_at), 'yyyy-MM-dd') !== format(getFixedDate(prevSlot.start_at), 'yyyy-MM-dd');

          return (
            <div key={slot.id} className="relative">
              {isFirstOfDay && (
                <div className="mt-6 mb-1 flex items-center gap-2">
                  <h3 className="text-sm font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-3 py-1 rounded-full border border-blue-100 dark:border-blue-800/50">
                    {format(getFixedDate(slot.start_at), 'yyyy年M月d日 (E)', { locale: ja })}
                  </h3>
                  <div className="flex-1 h-px bg-blue-200 dark:bg-gray-700"></div>
                </div>
              )}
              <div className={`p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${slot.is_confirmed ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-600/50' : 'bg-white dark:bg-gray-900 dark:border-gray-700'}`}>
                <div className="text-sm font-bold text-gray-700 dark:text-gray-200 flex items-center gap-2">
                  {slot.is_confirmed && <span className="bg-yellow-500 dark:bg-yellow-600 text-xs px-2 py-1 rounded font-bold text-white shadow-sm">仮確定</span>}
                  {formatSlotTime(slot.start_at, slot.end_at)}
                </div>
                <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-lg sm:w-64 shrink-0 gap-1">
                  <button onClick={() => logic.setAnswers({ ...logic.answers, [slot.id]: 'maru' })}
                    className={`flex-1 py-1 text-xl rounded-md transition-all ${logic.answers[slot.id] === 'maru' ? 'bg-white dark:bg-gray-700 shadow border border-green-200 dark:border-green-600 text-green-600' : 'text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 opacity-50'}`}>⭕️</button>
                  <button onClick={() => logic.setAnswers({ ...logic.answers, [slot.id]: 'sankaku' })}
                    className={`flex-1 py-1 text-xl rounded-md transition-all ${logic.answers[slot.id] === 'sankaku' ? 'bg-white dark:bg-gray-700 shadow border border-orange-200 dark:border-orange-600 text-orange-500' : 'text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 opacity-50'}`}>🔺</button>
                  <button onClick={() => logic.setAnswers({ ...logic.answers, [slot.id]: 'batsu' })}
                    className={`flex-1 py-1 text-xl rounded-md transition-all ${logic.answers[slot.id] === 'batsu' ? 'bg-white dark:bg-gray-700 shadow border border-red-200 dark:border-red-600 text-red-500' : 'text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 opacity-50'}`}>❌</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <button onClick={logic.handleSubmit} disabled={logic.loading} className="w-full py-4 bg-green-600 text-white font-bold text-lg rounded-xl shadow-lg hover:bg-green-700 transition-all disabled:opacity-50">
        回答を送信する
      </button>
    </div>
  );
}