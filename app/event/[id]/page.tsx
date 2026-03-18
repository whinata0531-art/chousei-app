'use client';

import { use } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { ChevronDown, ChevronRight, Pin, CalendarCheck, History, CalendarDays, Trash2, Settings, Home, ArrowUp, Edit3, Check } from 'lucide-react';
import { getFixedDate, formatSlotTime } from '../../../lib/utils';
import { useEventLogic } from '../../hooks/useEventLogic';

export default function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = use(params);
  
  // 💡 裏方の処理を呼び出す！
  const logic = useEventLogic(eventId);

  // 💡 UI表示用の便利関数
  const getStatusIcon = (s: string) => s === 'maru' ? '⭕️' : s === 'sankaku' ? '🔺' : s === 'batsu' ? '❌' : '-';

  if (logic.loading) return <div className="text-center mt-20">読み込み中...</div>;
  if (!logic.event) return <div className="text-center mt-20 text-red-500 font-bold">イベントが見つかりません（削除された可能性があります）</div>;

  return (
    <div className="max-w-2xl mx-auto p-4 mt-4 space-y-6 pb-20">
      
      {/* 〜〜 ヘッダー部分 〜〜 */}
      <div className="flex justify-between items-center mb-4">
        <Link href="/" className="flex items-center gap-1 text-sm bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 px-4 py-2 rounded-lg font-bold hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors shadow-sm">
          <Home size={16} /> トップへ
        </Link>
        <Link href="/settings" className="flex items-center gap-1 text-sm bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 px-4 py-2 rounded-lg font-bold hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors shadow-sm border border-gray-200 dark:border-gray-700">
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

      {/* 〜〜 回答タブ 〜〜 */}
      {logic.activeTab === 'response' && (
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow p-6 border-t-4 border-blue-500 relative">
          <div className="mb-4">
            <label className="block text-sm font-bold mb-1 dark:text-gray-300">お名前 *</label>
            <input type="text" value={logic.guestName} onChange={e => logic.setGuestName(e.target.value)}
              className="w-full p-3 bg-gray-50 dark:bg-gray-800 border dark:border-gray-700 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="名前を入力" />
          </div>

          <div className="flex flex-col gap-3 mb-6">
            {logic.isGoogleLoggedIn && (
              <button 
                onClick={logic.applyGoogleCalendar} 
                disabled={logic.loading}
                className="w-full flex items-center justify-center gap-2 py-4 bg-emerald-50 dark:bg-emerald-900/30 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-400 text-base font-bold rounded-xl border-2 border-emerald-200 dark:border-emerald-800/50 shadow-sm transition disabled:opacity-50"
              >
                <CalendarCheck size={20} /> 
                {logic.loading ? '同期中...' : 'Googleカレンダーの予定を自動で ❌ にする'}
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
      )}

      {/* 〜〜 集計タブ 〜〜 */}
      {logic.activeTab === 'result' && (
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
      )}

      {/* 〜〜 マイ予定タブ 〜〜 */}
      {logic.activeTab === 'my-schedule' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-md p-6 border-t-4 border-yellow-400 dark:border-yellow-500">
            <div className="flex items-center gap-2 mb-6 text-yellow-600 dark:text-yellow-500">
              <CalendarCheck size={24} />
              <h2 className="text-xl font-bold dark:text-gray-100">あなたが参加する確定予定</h2>
            </div>
            {logic.fetchingSchedules ? <p className="text-center text-gray-500 py-10">読み込み中...</p> : logic.mySchedules.length === 0 ? (
              <div className="text-center py-6 bg-gray-50 dark:bg-gray-800 rounded-lg"><p className="text-gray-500 font-bold">まだ確定した予定はありません。</p></div>
            ) : (
              <div className="space-y-4">
                {logic.mySchedules.map((schedule, i) => {
                  const isFirstOfDay = i === 0 || format(getFixedDate(logic.mySchedules[i - 1].start_at), 'yyyy-MM-dd') !== format(getFixedDate(schedule.start_at), 'yyyy-MM-dd');
                  return (
                    <div key={schedule.id}>
                      {isFirstOfDay && <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 mb-2 mt-4 border-b dark:border-gray-700 pb-1">{format(getFixedDate(schedule.start_at), 'yyyy年M月d日 (E)', { locale: ja })}</h3>}
                      <div className="block bg-white dark:bg-gray-800/80 border-2 border-yellow-300 dark:border-yellow-600/50 p-4 rounded-xl shadow-sm">
                        <div className="flex justify-between items-center mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs bg-yellow-500 dark:bg-yellow-600 text-white px-2 py-1 rounded-full font-bold shadow-sm">📌 仮確定</span>
                            <span className="font-extrabold text-lg text-gray-800 dark:text-gray-100">{formatSlotTime(schedule.start_at, schedule.end_at)}</span>
                          </div>
                        </div>
                        <p className="text-sm text-gray-700 dark:text-gray-300 font-bold truncate pr-4">{schedule.eventTitle}</p>
                        
                        {logic.isGoogleLoggedIn && (
                          <div className="mt-3 pt-3 border-t dark:border-gray-700 text-right">
                            <button 
                              onClick={() => logic.addSlotToGoogleCalendar(schedule.start_at, schedule.end_at, schedule.eventTitle)} 
                              disabled={logic.loading} 
                              className="px-3 py-1.5 text-xs font-bold bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 rounded-lg transition-colors border border-blue-200 dark:border-blue-800/50 shadow-sm"
                            >
                              📅 Googleカレンダーに追加
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

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