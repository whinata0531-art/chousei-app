// app/components/CreateEventTab.tsx
import { format, isSameDay, subMonths, addMonths } from 'date-fns';
import { ja } from 'date-fns/locale';
import { CalendarDays, History, Calendar as CalendarIcon, ChevronLeft, ChevronRight, ChevronDown, Trash2, Plus, X, CheckCircle2 } from 'lucide-react';
import { useTopPageLogic } from '@/app/hooks/useTopPageLogic';

type Props = { logic: ReturnType<typeof useTopPageLogic> };

export default function CreateEventTab({ logic }: Props) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl shadow-md p-6 border-t-4 border-blue-500">
      <div className="space-y-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold mb-1 dark:text-gray-300">イベント名 *</label>
            <input type="text" value={logic.title} onChange={e => logic.setTitle(e.target.value)} className="w-full p-2 border dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded focus:ring-2 focus:ring-blue-500 outline-none" placeholder="例: BNS合同練習" />
          </div>
          <div>
            <label className="block text-sm font-bold mb-1 dark:text-gray-300">メモ（任意）</label>
            <textarea value={logic.description} onChange={e => logic.setDescription(e.target.value)} className="w-full p-2 border dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded focus:ring-2 focus:ring-blue-500 outline-none h-20 resize-none" placeholder="場所や持ち物、補足情報など" />
          </div>
        </div>
        
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800/30 overflow-hidden shadow-sm transition-all">
          <button 
            onClick={() => logic.setIsBulkOpen(!logic.isBulkOpen)}
            className="w-full flex items-center justify-between p-4 bg-blue-100/50 dark:bg-blue-900/40 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors"
          >
            <div className="flex items-center gap-2 text-blue-800 dark:text-blue-300 font-bold">
              <CalendarDays size={18} />
              <span>期間と曜日で一括作成</span>
            </div>
            <div className="text-blue-600 dark:text-blue-400 bg-white/50 dark:bg-gray-800/50 p-1 rounded-full">
              {logic.isBulkOpen ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
            </div>
          </button>

          {logic.isBulkOpen && (
            <div className="p-4 space-y-4 border-t border-blue-200/50 dark:border-blue-800/30">
              <div className="flex items-center gap-2">
                <input type="date" value={logic.bulkStartDate} onChange={e => logic.setBulkStartDate(e.target.value)} className="p-2 border dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 rounded text-sm flex-1 outline-none focus:ring-2 focus:ring-blue-500" />
                <span className="text-gray-500">〜</span>
                <input type="date" value={logic.bulkEndDate} onChange={e => logic.setBulkEndDate(e.target.value)} className="p-2 border dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 rounded text-sm flex-1 outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="flex gap-2 flex-wrap items-center">
                {logic.DOW_LABELS.map(dow => (
                  <button key={dow.val} onClick={() => logic.toggleDow(dow.val)}
                    className={`w-10 h-10 rounded-full font-bold text-sm border transition-colors ${logic.selectedDows.includes(dow.val) ? 'bg-blue-500 text-white border-blue-500' : 'bg-white dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'}`}>
                    {dow.label}
                  </button>
                ))}
                <button onClick={logic.toggleEveryday} className={`ml-2 px-3 py-2 rounded-full font-bold text-sm border transition-colors ${logic.selectedDows.length === 7 ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700 dark:border-gray-700'}`}>
                  毎日
                </button>
              </div>
              
              <div className="flex items-center gap-2 mb-2">
                <input type="checkbox" id="bulkAllDay" checked={logic.bulkIsAllDay} onChange={e => logic.setBulkIsAllDay(e.target.checked)} className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500" />
                <label htmlFor="bulkAllDay" className="text-sm font-bold text-gray-700 dark:text-gray-300 cursor-pointer">時間を指定せず「終日」にする</label>
              </div>

              {!logic.bulkIsAllDay && (
                <div className="flex items-center gap-2 bg-white dark:bg-gray-800 p-2 rounded border dark:border-gray-700">
                  <input type="time" value={logic.bulkStart} onChange={e => logic.setBulkStart(e.target.value)} className="p-1 border-b dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 text-sm flex-1 outline-none" />
                  <span className="text-gray-500">〜</span>
                  <input type="time" value={logic.bulkEnd} onChange={e => logic.setBulkEnd(e.target.value)} className="p-1 border-b dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 text-sm flex-1 outline-none" />
                  <select value={logic.bulkInterval} onChange={e => logic.setBulkInterval(e.target.value)} className="p-1 border-l dark:border-gray-600 pl-2 text-sm flex-1 text-gray-600 dark:text-gray-300 dark:bg-gray-800 outline-none">
                    <option value="60">60分枠</option>
                    <option value="90">90分枠</option>
                    <option value="120">2時間枠</option>
                    <option value="180">3時間枠</option>
                  </select>
                </div>
              )}
              <button onClick={logic.generateBulkSlots} className="w-full py-3 bg-blue-600 text-white font-bold rounded-lg shadow-sm hover:bg-blue-700 transition mt-2">条件に合う枠を一気に追加する</button>
            </div>
          )}
        </div>

        <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-xl border border-green-200 dark:border-green-800/30 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="text-green-800 dark:text-green-400 font-bold">
            有効な候補日程: <span className="text-xl">{logic.totalSlotsCount}</span> 枠
          </div>
          <button onClick={logic.handleCreate} disabled={logic.loading || logic.totalSlotsCount === 0 || !logic.title} className={`w-full sm:w-auto px-8 py-3 font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 ${logic.totalSlotsCount > 0 && logic.title ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}>
            <CheckCircle2 size={20} />
            {logic.loading ? '作成中...' : 'イベントを作成する'}
          </button>
        </div>

        <div>
          <div className="flex justify-between items-end mb-4 border-b dark:border-gray-700 pb-2">
            <h3 className="font-bold text-lg dark:text-gray-100">個別の日程調整</h3>
            {logic.hostHistory.length > 0 && (
              <div className="flex items-center gap-1 text-xs text-purple-600 dark:text-purple-400">
                <History size={14} />
                <select onChange={(e) => { logic.loadFromHistory(e.target.value); e.target.value = ""; }} className="bg-purple-50 dark:bg-purple-900/30 border dark:border-purple-800/50 rounded p-1 max-w-[150px] outline-none">
                  <option value="">過去の履歴からコピー</option>
                  {logic.hostHistory.map((h, i) => <option key={i} value={i}>{h.title}</option>)}
                </select>
              </div>
            )}
          </div>
          
          <div className="mb-6">
            <button 
              onClick={() => logic.setShowCalendar(!logic.showCalendar)} 
              className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold border transition-colors ${logic.showCalendar ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800/50 text-blue-600 dark:text-blue-400' : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
            >
              <CalendarIcon size={18} /> {logic.showCalendar ? 'カレンダーを閉じる' : '日付を追加する'}
            </button>

            {logic.showCalendar && (
              <div className="mt-3 p-4 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-xl shadow-sm animate-fade-in">
                <div className="flex justify-between items-center mb-4 px-2">
                  <button onClick={() => logic.setCalendarMonth(subMonths(logic.calendarMonth, 1))} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full dark:text-gray-200"><ChevronLeft size={20}/></button>
                  <span className="font-bold dark:text-gray-100">{format(logic.calendarMonth, 'yyyy年 M月')}</span>
                  <button onClick={() => logic.setCalendarMonth(addMonths(logic.calendarMonth, 1))} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full dark:text-gray-200"><ChevronRight size={20}/></button>
                </div>
                <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-gray-500 dark:text-gray-400 mb-2">
                  {['日', '月', '火', '水', '木', '金', '土'].map(d => <div key={d}>{d}</div>)}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {logic.paddingDays.map(d => <div key={`pad-${d}`}></div>)}
                  {logic.calendarDays.map(d => {
                    const dateStr = format(d, 'yyyy-MM-dd');
                    const isSelected = logic.dayBlocks.some(b => b.date === dateStr);
                    const isToday = isSameDay(d, new Date());
                    return (
                      <button
                        key={dateStr}
                        onClick={() => logic.toggleCalendarDate(dateStr)}
                        className={`aspect-square flex items-center justify-center rounded-full text-sm transition-colors ${isSelected ? 'bg-blue-500 text-white font-bold shadow-md transform scale-105' : isToday ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-bold border border-blue-200 dark:border-blue-800/50' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                      >
                        {format(d, 'd')}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-center text-gray-500 dark:text-gray-400 mt-4">日付をタップすると、その日のブロックが追加/削除されます</p>
              </div>
            )}
          </div>

          <div className="space-y-4">
            {logic.dayBlocks.map((block) => (
              <div key={block.id} className="border dark:border-gray-700 rounded-xl overflow-hidden shadow-sm bg-white dark:bg-gray-800 transition-all hover:border-blue-300 dark:hover:border-blue-700">
                <div className="bg-blue-50 dark:bg-blue-900/20 px-4 py-3 border-b dark:border-gray-700 flex justify-between items-center transition-colors">
                  <div className="flex items-center gap-2 flex-1">
                    <button onClick={() => logic.toggleDayExpanded(block.id)} className="p-1 hover:bg-blue-100 dark:hover:bg-blue-800 rounded text-blue-600 dark:text-blue-400">
                      {block.isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                    </button>
                    <input type="date" value={block.date} onChange={e => logic.updateDayBlockDate(block.id, e.target.value)} className="font-bold text-blue-800 dark:text-blue-300 bg-transparent border-none outline-none focus:ring-0 cursor-pointer w-32" />
                    <span className="text-sm font-bold text-blue-600 dark:text-blue-400 hidden sm:inline">({format(new Date(block.date || new Date()), 'E', { locale: ja })})</span>
                    
                    <label className="ml-2 flex items-center gap-1 text-xs font-bold text-blue-700 dark:text-blue-300 cursor-pointer bg-white/50 dark:bg-gray-800 px-2 py-1 rounded border border-blue-200 dark:border-blue-800/50">
                      <input type="checkbox" checked={block.isAllDay} onChange={e => logic.toggleDayAllDay(block.id, e.target.checked)} className="w-3 h-3 text-blue-600" />
                      終日
                    </label>
                  </div>
                  <button onClick={() => logic.removeDayBlock(block.id)} className="text-red-400 hover:text-red-600 transition p-1"><Trash2 size={18} /></button>
                </div>
                
                {block.isExpanded && (
                  <div className="p-3 bg-white dark:bg-gray-800">
                    {block.isAllDay ? (
                      <div className="text-center py-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 text-blue-600 dark:text-blue-400 font-bold text-sm">
                        🌟 終日 (0:00〜23:59) で設定されています
                        <p className="text-xs text-gray-400 font-normal mt-1">※チェックを外すと記憶していた個別の時間枠に戻ります</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {block.times.length === 0 ? (
                          <p className="text-xs text-gray-400 text-center py-2">時間が設定されていません</p>
                        ) : (
                          block.times.map((time) => (
                            <div key={time.id} className="flex items-center gap-3 bg-gray-50 dark:bg-gray-900 p-2 rounded-lg border dark:border-gray-700 group">
                              <div className="flex items-center gap-2 flex-1 pl-2">
                                <input type="time" value={time.start} onChange={e => logic.updateTimeSlot(block.id, time.id, 'start', e.target.value)} className="p-1 border dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded text-sm flex-1 outline-none focus:ring-1 focus:ring-blue-500" />
                                <span className="text-gray-400 text-xs">〜</span>
                                <input type="time" value={time.end} onChange={e => logic.updateTimeSlot(block.id, time.id, 'end', e.target.value)} className="p-1 border dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded text-sm flex-1 outline-none focus:ring-1 focus:ring-blue-500" />
                              </div>
                              <button onClick={() => logic.removeTimeSlot(block.id, time.id)} className="text-gray-300 hover:text-red-500 p-1"><X size={16}/></button>
                            </div>
                          ))
                        )}
                        <button onClick={() => logic.addTimeSlot(block.id)} className="w-full py-2 text-sm font-bold text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-900/10 hover:bg-blue-100 dark:hover:bg-blue-900/30 border border-blue-100 dark:border-blue-800/30 rounded-lg transition-colors flex items-center justify-center gap-1 mt-2">
                          <Plus size={16} /> この日に時間を追加
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {logic.dayBlocks.length === 0 && (
            <div className="mt-4 text-center py-8 bg-gray-50 dark:bg-gray-800 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700">
              <p className="text-gray-500 dark:text-gray-400 font-bold mb-2">日付がありません</p>
              <button onClick={() => logic.addDayBlock()} className="px-4 py-2 bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 text-sm font-bold rounded-lg shadow-sm border dark:border-gray-600">今日を追加する</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}