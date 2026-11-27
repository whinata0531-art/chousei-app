// app/components/CreateEventTab.tsx
import { useState } from 'react';
import { format, isSameDay, subMonths, addMonths } from 'date-fns';
import { ja } from 'date-fns/locale';
import { CalendarDays, History, Calendar as CalendarIcon, ChevronLeft, ChevronRight, ChevronDown, Trash2, Plus, X, CheckCircle2 } from 'lucide-react';
import { useTopPageLogic } from '@/app/hooks/useTopPageLogic';

type Props = { logic: ReturnType<typeof useTopPageLogic> };

export default function CreateEventTab({ logic }: Props) {
  const [isTitleModalOpen, setIsTitleModalOpen] = useState(false);
  const [tempTitle, setTempTitle] = useState('');

  // イベント名が空のときはその場で入力モーダルを開き、入力済みなら作成を実行
  const handleCreateOrOpenModal = () => {
    if (!logic.title.trim()) {
      setTempTitle(logic.title);
      setIsTitleModalOpen(true);
      return;
    }
    logic.handleCreate();
  };

  const handleConfirmTitleModal = () => {
    logic.setTitle(tempTitle.trim());
    setIsTitleModalOpen(false);
  };

  const isDisabled = logic.loading || (Boolean(logic.title.trim()) && logic.totalSlotsCount === 0);
  const buttonLabel = logic.loading
    ? '作成中...'
    : !logic.title.trim()
    ? 'イベント名を入力してね'
    : 'イベントを作成する';
  const isReady = Boolean(logic.title.trim()) && logic.totalSlotsCount > 0;

  return (
    <>
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-md px-4 sm:px-6 pb-6 relative">
        {/* カード最上部の青いバー＋角丸＋余白（常に1つだけ上部に残り、スクロール時は下の要素がこの下にすーっと潜り込む） */}
        <div className="sticky top-0 z-30 -mx-4 sm:-mx-6 bg-white dark:bg-[#0a0a0a]">
          <div className="h-3 bg-white dark:bg-gray-900 border-t-4 border-t-blue-500 dark:border-t-blue-500 rounded-t-xl" />
        </div>

        <div className="space-y-6 pt-3">
        <div className="space-y-4">
          <div>
            <label className="block text-base font-extrabold text-gray-800 dark:text-gray-100 mb-1.5">イベント名 *</label>
            <input type="text" value={logic.title} onChange={e => logic.setTitle(e.target.value)} className="w-full p-2.5 border dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="例: BNS合同練習" />
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
            <div className="p-3.5 sm:p-4 space-y-3.5 border-t border-blue-200/50 dark:border-blue-800/30">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="flex items-center gap-2 flex-1 min-w-0 bg-white dark:bg-gray-800 px-2.5 py-1.5 rounded-lg border border-blue-200/80 dark:border-gray-600">
                  <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 shrink-0 sm:hidden">開始</span>
                  <input
                    type="date"
                    value={logic.bulkStartDate}
                    onChange={e => logic.setBulkStartDate(e.target.value)}
                    className="bg-transparent dark:text-gray-200 text-sm flex-1 min-w-0 outline-none"
                  />
                </div>
                <span className="text-gray-400 text-xs text-center hidden sm:inline shrink-0">〜</span>
                <div className="flex items-center gap-2 flex-1 min-w-0 bg-white dark:bg-gray-800 px-2.5 py-1.5 rounded-lg border border-blue-200/80 dark:border-gray-600">
                  <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 shrink-0 sm:hidden">終了</span>
                  <input
                    type="date"
                    value={logic.bulkEndDate}
                    onChange={e => logic.setBulkEndDate(e.target.value)}
                    className="bg-transparent dark:text-gray-200 text-sm flex-1 min-w-0 outline-none"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-blue-800 dark:text-blue-300">対象の曜日</span>
                  <button
                    type="button"
                    onClick={logic.toggleEveryday}
                    className={`px-3 py-1 rounded-full font-bold text-xs border transition-colors whitespace-nowrap ${logic.selectedDows.length === 7 ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-gray-800 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-gray-700 hover:bg-blue-100/60'}`}
                  >
                    毎日を選択
                  </button>
                </div>
                <div className="grid grid-cols-7 gap-1.5">
                  {logic.DOW_LABELS.map(dow => (
                    <button
                      key={dow.val}
                      type="button"
                      onClick={() => logic.toggleDow(dow.val)}
                      className={`py-2 rounded-lg font-bold text-xs sm:text-sm border transition-colors ${logic.selectedDows.includes(dow.val) ? 'bg-blue-500 text-white border-blue-500 shadow-xs' : 'bg-white dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'}`}
                    >
                      {dow.label}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <input type="checkbox" id="bulkAllDay" checked={logic.bulkIsAllDay} onChange={e => logic.setBulkIsAllDay(e.target.checked)} className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500" />
                <label htmlFor="bulkAllDay" className="text-sm font-bold text-gray-700 dark:text-gray-300 cursor-pointer">時間を指定せず「終日」にする</label>
              </div>

              {!logic.bulkIsAllDay && (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <div className="flex items-center justify-between gap-2 bg-white dark:bg-gray-800 px-3 py-2 rounded-lg border border-blue-200/80 dark:border-gray-700 flex-1 min-w-0">
                    <input type="time" value={logic.bulkStart} onChange={e => logic.setBulkStart(e.target.value)} className="bg-transparent dark:text-gray-200 text-sm flex-1 min-w-0 outline-none text-center" />
                    <span className="text-gray-400 text-xs shrink-0">〜</span>
                    <input type="time" value={logic.bulkEnd} onChange={e => logic.setBulkEnd(e.target.value)} className="bg-transparent dark:text-gray-200 text-sm flex-1 min-w-0 outline-none text-center" />
                  </div>
                  <select value={logic.bulkInterval} onChange={e => logic.setBulkInterval(e.target.value)} className="px-3 py-2 bg-white dark:bg-gray-800 border border-blue-200/80 dark:border-gray-700 rounded-lg text-sm font-bold text-gray-700 dark:text-gray-200 sm:w-32 outline-none">
                    <option value="60">60分枠</option>
                    <option value="90">90分枠</option>
                    <option value="120">2時間枠</option>
                    <option value="180">3時間枠</option>
                  </select>
                </div>
              )}
              <button onClick={logic.generateBulkSlots} className="w-full py-3 bg-blue-600 text-white font-bold rounded-lg shadow-sm hover:bg-blue-700 transition">条件に合う枠を一気に追加する</button>
            </div>
          )}
        </div>

        <div>
          <div className="sticky top-3 z-20 -mx-4 px-4 sm:-mx-6 sm:px-6 pt-1 pb-2.5 mb-4 bg-white dark:bg-gray-900 border-b border-b-gray-100 dark:border-b-gray-800 shadow-[0_2px_4px_-2px_rgba(0,0,0,0.06)] flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-1.5 shrink-0">
              <h3 className="font-extrabold text-sm sm:text-lg text-gray-800 dark:text-gray-100 whitespace-nowrap">個別の日程調整</h3>
              <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full whitespace-nowrap shrink-0">
                {logic.totalSlotsCount}枠
              </span>
            </div>
            <div className="flex items-center justify-end gap-1.5 min-w-0 flex-1">
              {logic.hostHistory.length > 0 && (
                <div className="flex items-center gap-1 text-[11px] sm:text-xs text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-800/50 rounded-md px-1.5 py-1 min-w-0 max-w-[105px] sm:max-w-[160px]">
                  <History size={12} className="shrink-0" />
                  <select onChange={(e) => { logic.loadFromHistory(e.target.value); e.target.value = ""; }} className="bg-transparent font-bold outline-none min-w-0 w-full truncate cursor-pointer">
                    <option value="">履歴コピー</option>
                    {logic.hostHistory.map((h, i) => <option key={i} value={i}>{h.title}</option>)}
                  </select>
                </div>
              )}
              {logic.dayBlocks.length > 0 && (
                <button
                  type="button"
                  onClick={logic.clearAllDayBlocks}
                  className="flex items-center gap-1 px-2 py-1 text-[11px] sm:text-xs font-bold text-red-600 dark:text-red-400 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 border border-red-200 dark:border-red-800/50 rounded-md transition whitespace-nowrap shrink-0"
                >
                  <Trash2 size={12} />
                  <span>全クリア</span>
                </button>
              )}
            </div>
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
                <div className="bg-blue-50 dark:bg-blue-900/20 px-3 sm:px-4 py-2.5 border-b dark:border-gray-700 flex justify-between items-center gap-2 transition-colors">
                  <div className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0">
                    <button onClick={() => logic.toggleDayExpanded(block.id)} className="p-1 hover:bg-blue-100 dark:hover:bg-blue-800 rounded text-blue-600 dark:text-blue-400 shrink-0">
                      {block.isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                    </button>
                    <input type="date" value={block.date} onChange={e => logic.updateDayBlockDate(block.id, e.target.value)} className="w-auto min-w-0 text-sm sm:text-base font-bold text-blue-800 dark:text-blue-300 bg-transparent border-none outline-none focus:ring-0 cursor-pointer shrink-0" />
                    <span className="text-sm font-bold text-blue-600 dark:text-blue-400 hidden sm:inline shrink-0">({format(new Date(block.date ? `${block.date}T00:00:00` : new Date()), 'E', { locale: ja })})</span>
                    
                    <label className="ml-1 sm:ml-2 flex items-center gap-1 text-xs font-bold text-blue-700 dark:text-blue-300 cursor-pointer bg-white/50 dark:bg-gray-800 px-2 py-1 rounded border border-blue-200 dark:border-blue-800/50 whitespace-nowrap shrink-0">
                      <input type="checkbox" checked={block.isAllDay} onChange={e => logic.toggleDayAllDay(block.id, e.target.checked)} className="w-3 h-3 text-blue-600" />
                      終日
                    </label>
                  </div>
                  <button onClick={() => logic.removeDayBlock(block.id)} className="text-red-400 hover:text-red-600 transition p-1 shrink-0"><Trash2 size={18} /></button>
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
                            <div key={time.id} className="flex items-center gap-2 sm:gap-3 bg-gray-50 dark:bg-gray-900 p-2 rounded-lg border dark:border-gray-700 group">
                              <div className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0 pl-1 sm:pl-2">
                                <input type="time" value={time.start} onChange={e => logic.updateTimeSlot(block.id, time.id, 'start', e.target.value)} className="p-1 border dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded text-sm flex-1 min-w-0 outline-none focus:ring-1 focus:ring-blue-500" />
                                <span className="text-gray-400 text-xs shrink-0">〜</span>
                                <input type="time" value={time.end} onChange={e => logic.updateTimeSlot(block.id, time.id, 'end', e.target.value)} className="p-1 border dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded text-sm flex-1 min-w-0 outline-none focus:ring-1 focus:ring-blue-500" />
                              </div>
                              <button onClick={() => logic.removeTimeSlot(block.id, time.id)} className="text-gray-300 hover:text-red-500 p-1 shrink-0"><X size={16}/></button>
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

      {/* 画面下部に常時表示される作成バー（上を調整中でも迷子にならない） */}
      <div className="fixed bottom-0 left-0 right-0 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-t border-gray-200 dark:border-gray-700 shadow-[0_-4px_12px_rgba(0,0,0,0.12)] z-40">
        <div className="max-w-xl mx-auto">
          <button
            onClick={handleCreateOrOpenModal}
            disabled={isDisabled}
            className={`w-full py-3 px-6 font-bold text-base rounded-xl shadow-md transition-all flex items-center justify-center gap-2 ${
              isReady
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : !logic.title.trim()
                ? 'bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                : 'bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed'
            }`}
          >
            <CheckCircle2 size={20} />
            {buttonLabel}
          </button>
        </div>
      </div>

      {/* その場でイベント名を入力できるポップアップモーダル */}
      {isTitleModalOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-start justify-center pt-24 sm:items-center sm:pt-4 p-4"
          onClick={() => setIsTitleModalOpen(false)}
        >
          <div
            className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border dark:border-gray-700 w-full max-w-sm p-5 animate-fade-in"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-base font-extrabold text-gray-800 dark:text-gray-100 mb-3">
              イベント名を入力
            </h3>
            <input
              type="text"
              autoFocus
              value={tempTitle}
              onChange={e => setTempTitle(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && tempTitle.trim()) {
                  handleConfirmTitleModal();
                }
              }}
              className="w-full p-3 border dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none mb-4"
              placeholder="例: BNS合同練習"
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsTitleModalOpen(false)}
                className="flex-1 py-2.5 px-3 rounded-xl text-sm font-bold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleConfirmTitleModal}
                disabled={!tempTitle.trim()}
                className="flex-1 py-2.5 px-3 rounded-xl text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}