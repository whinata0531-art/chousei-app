// app/components/ResultTab.tsx
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { getFixedDate, formatSlotTime } from '@/lib/utils';
import { useEventLogic } from '../hooks/useEventLogic';

type Props = { logic: ReturnType<typeof useEventLogic> };

export default function ResultTab({ logic }: Props) {
  const getStatusIcon = (s: string) => s === 'maru' ? '⭕️' : s === 'sankaku' ? '🔺' : s === 'batsu' ? '❌' : '-';

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow border-t-4 border-green-500 transition-all">
        <div className="sticky top-[4.5rem] z-20 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md p-6 border-b dark:border-gray-700 shadow-sm rounded-t-xl">
          <button onClick={() => logic.setIsSummaryOpen(!logic.isSummaryOpen)} className="w-full flex items-center justify-between focus:outline-none">
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">📊 日程ごとの集計</h2>
            <div className="p-1 bg-gray-100 dark:bg-gray-800 rounded-full hover:bg-gray-200 transition-colors">
              {logic.isSummaryOpen ? <ChevronDown size={20} className="text-gray-600 dark:text-gray-300" /> : <ChevronRight size={20} className="text-gray-600 dark:text-gray-300" />}
            </div>
          </button>
        </div>

        {logic.isSummaryOpen && (
          <div className="p-6 pt-4">
            <div className="flex flex-col sm:flex-row gap-4 mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border dark:border-gray-700">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-gray-700 dark:text-gray-300">並び替え:</span>
                <select value={logic.sortType} onChange={e => logic.setSortType(e.target.value)} className="p-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded text-sm bg-white outline-none">
                  <option value="time">⏰ 日時が早い順</option>
                  <option value="maru">⭕️ 参加者が多い順</option>
                  <option value="batsu">❌ 不参加が少ない順</option>
                </select>
              </div>
              <div className="flex items-center gap-2 sm:border-l dark:border-gray-600 sm:pl-4">
                <input type="checkbox" id="hideBatsu" checked={logic.hideBatsu} onChange={e => logic.setHideBatsu(e.target.checked)} className="w-4 h-4" />
                <label htmlFor="hideBatsu" className="text-sm font-medium dark:text-gray-300 cursor-pointer">❌を除外</label>
              </div>
            </div>

            <div className="space-y-4">
              {logic.sortedAndFilteredSlots.map((slot) => {
                const tier = logic.getSlotTier(slot);
                const highlightClass = 
                  tier === 1 ? 'bg-green-50 border-green-400 ring-2 ring-green-200 dark:bg-green-900/30 dark:border-green-600 dark:ring-green-800/50' :
                  tier === 2 ? 'bg-orange-50 border-orange-300 dark:bg-yellow-900/20 dark:border-yellow-600/50' :
                  'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700';

                return (
                  <div key={slot.id} className={`p-4 border rounded-xl flex flex-col gap-4 transition-all ${slot.is_confirmed ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-400 dark:border-yellow-600/50 shadow-md transform scale-[1.02]' : highlightClass}`}>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        {slot.is_confirmed && <span className="inline-block px-3 py-1 bg-yellow-500 dark:bg-yellow-600 text-white text-xs font-bold rounded-full mb-2 shadow-sm animate-pulse">✨ 仮確定 ✨</span>}
                        {!slot.is_confirmed && tier === 1 && <span className="inline-block px-2 py-1 bg-green-500 text-white text-xs font-bold rounded mb-1 shadow-sm">🌟 おすすめ</span>}
                        <div className="font-bold text-lg dark:text-gray-100">
                          {format(getFixedDate(slot.start_at), 'M/d (E)', { locale: ja })} {formatSlotTime(slot.start_at, slot.end_at)}
                        </div>
                      </div>
                      <div className="flex gap-4 text-center">
                        <div><div className="text-xs text-gray-500">⭕️</div><div className="font-bold text-green-600 dark:text-green-400 text-xl">{slot.maru}</div></div>
                        <div><div className="text-xs text-gray-500">🔺</div><div className="font-bold text-orange-500 dark:text-orange-400 text-xl">{slot.sankaku}</div></div>
                        <div><div className="text-xs text-gray-500">❌</div><div className="font-bold text-red-500 dark:text-red-400 text-xl">{slot.batsu}</div></div>
                      </div>
                    </div>

                    <div className="border-t border-gray-200/60 dark:border-gray-700 pt-3 mt-1 text-right flex justify-end gap-2">
                      <button 
                        onClick={() => logic.toggleConfirmSlot(slot.id, slot.is_confirmed, slot.start_at, slot.end_at)}
                        className={`px-4 py-2 text-sm font-bold rounded-lg shadow transition-colors ${slot.is_confirmed ? 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600' : 'bg-yellow-400 dark:bg-yellow-500/80 text-yellow-900 dark:text-yellow-50 hover:bg-yellow-500 dark:hover:bg-yellow-500'}`}
                      >
                        {slot.is_confirmed ? '仮確定を解除' : '📌 仮確定にする'}
                      </button>
                    </div>
                  </div>
                );
              })}
              {logic.sortedAndFilteredSlots.length === 0 && <p className="text-gray-500 text-center py-4">条件に合う日程がありません。</p>}
            </div>
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl shadow p-6 overflow-hidden">
        <h2 className="text-xl font-bold mb-4 dark:text-gray-100">👥 回答者マトリックス</h2>
        {logic.matrix.length === 0 ? (
          <p className="text-gray-500">まだ回答がありません。</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left whitespace-nowrap border-collapse">
              <thead>
                <tr>
                  <th className="p-3 border-b-2 bg-gray-50 dark:bg-gray-800 font-bold text-gray-700 dark:text-gray-300 sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">名前</th>
                  {[...logic.aggregated].sort((a, b) => a.originalIndex - b.originalIndex).map(slot => {
                    const tier = logic.getSlotTier(slot);
                    const headerClass = 
                      slot.is_confirmed ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700/50' :
                      tier === 1 ? 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-400 border-green-300 dark:border-green-700' :
                      tier === 2 ? 'bg-orange-100 dark:bg-yellow-900/30 text-orange-800 dark:text-yellow-400 border-orange-200 dark:border-yellow-700/50' : 
                      'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 dark:border-gray-700';
                    
                    return (
                      <th key={slot.id} className={`p-3 border-b-2 text-xs font-medium ${headerClass}`}>
                        {slot.is_confirmed && '📌'}{!slot.is_confirmed && tier === 1 && '🌟'}<br/>
                        {format(getFixedDate(slot.start_at), 'M/d(E)', { locale: ja })}<br/>
                        {formatSlotTime(slot.start_at, slot.end_at)}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {logic.matrix.map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="p-3 border-b dark:border-gray-700 font-medium sticky left-0 bg-white dark:bg-gray-900 dark:text-gray-100 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">{row.guestName}</td>
                    {[...logic.aggregated].sort((a, b) => a.originalIndex - b.originalIndex).map(slot => {
                      const tier = logic.getSlotTier(slot);
                      const cellClass = 
                        slot.is_confirmed ? 'bg-yellow-50 dark:bg-yellow-900/20' :
                        tier === 1 ? 'bg-green-50 dark:bg-green-900/20' :
                        tier === 2 ? 'bg-orange-50/50 dark:bg-yellow-900/20' : 'dark:bg-gray-800';
                        
                      return (
                        <td key={slot.id} className={`p-3 border-b dark:border-gray-700 text-center text-xl ${cellClass}`}>{getStatusIcon(row.answers[slot.id])}</td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}