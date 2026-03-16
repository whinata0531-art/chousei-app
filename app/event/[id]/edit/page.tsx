'use client';

import { useState, useEffect, use } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, Trash2, ArrowLeft, CalendarDays, CheckCircle2, X, Calendar as CalendarIcon, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { addMinutes, format, addDays, startOfMonth, endOfMonth, eachDayOfInterval, subMonths, addMonths, isSameDay } from 'date-fns';
import { ja } from 'date-fns/locale';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type TimeSlot = { id: string; start: string; end: string };
type DayBlock = { id: string; date: string; isAllDay: boolean; isExpanded: boolean; times: TimeSlot[] };

const getFixedDate = (dbDateStr: string) => new Date(dbDateStr.substring(0, 16));

export default function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = use(params);
  const router = useRouter();
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dayBlocks, setDayBlocks] = useState<DayBlock[]>([]);
  const [oldSlots, setOldSlots] = useState<any[]>([]); // 変更前のデータを保持
  
  const [dayMemory, setDayMemory] = useState<Record<string, { isAllDay: boolean; times: TimeSlot[] }>>({});
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(startOfMonth(new Date()));
  const [loading, setLoading] = useState(true);
  const [deviceGuestId, setDeviceGuestId] = useState('');

  useEffect(() => {
    const fetchEvent = async () => {
      let currentGuestId = localStorage.getItem('deviceGuestId');
      if (!currentGuestId) {
        currentGuestId = crypto.randomUUID();
        localStorage.setItem('deviceGuestId', currentGuestId);
      }
      setDeviceGuestId(currentGuestId);

      const { data: eData } = await supabase.from('events').select('*').eq('id', eventId).single();
      if (!eData || eData.host_id !== currentGuestId) {
        alert('権限がありません！');
        router.push('/');
        return;
      }
      setTitle(eData.title);
      setDescription(eData.description || '');

      const { data: sData } = await supabase.from('slots').select('*').eq('event_id', eventId).order('start_at');
      if (sData) {
        setOldSlots(sData);
        // 既存の日程をDayBlock形式に変換
        const grouped: Record<string, { isAllDay: boolean, times: TimeSlot[] }> = {};
        sData.forEach(s => {
          const date = s.start_at.split('T')[0];
          const start = s.start_at.split('T')[1].substring(0, 5);
          const end = s.end_at.split('T')[1].substring(0, 5);
          const isAllDay = start === '00:00' && end === '23:59';
          
          if (!grouped[date]) grouped[date] = { isAllDay: false, times: [] };
          if (isAllDay) grouped[date].isAllDay = true;
          else grouped[date].times.push({ id: crypto.randomUUID(), start, end });
        });

        const initialBlocks = Object.keys(grouped).map(date => ({
          id: crypto.randomUUID(), date, isAllDay: grouped[date].isAllDay, isExpanded: true,
          times: grouped[date].times.length > 0 ? grouped[date].times : [{ id: crypto.randomUUID(), start: '', end: '' }]
        }));
        initialBlocks.sort((a, b) => a.date.localeCompare(b.date));
        setDayBlocks(initialBlocks);
      }
      setLoading(false);
    };
    fetchEvent();
  }, [eventId, router]);

  const addDayBlock = (dateStr: string = format(new Date(), 'yyyy-MM-dd')) => {
    const mem = dayMemory[dateStr];
    const newBlock: DayBlock = { 
      id: crypto.randomUUID(), date: dateStr, 
      isAllDay: mem ? mem.isAllDay : false, isExpanded: true, 
      times: mem ? mem.times : [{ id: crypto.randomUUID(), start: '', end: '' }] 
    };
    setDayBlocks([...dayBlocks, newBlock].sort((a, b) => a.date.localeCompare(b.date)));
  };

  const removeDayBlock = (blockId: string) => {
    const block = dayBlocks.find(b => b.id === blockId);
    if (block) setDayMemory(prev => ({ ...prev, [block.date]: { isAllDay: block.isAllDay, times: block.times } }));
    setDayBlocks(dayBlocks.filter(b => b.id !== blockId));
  };

  const updateDayBlockDate = (blockId: string, newDate: string) => {
    setDayBlocks(dayBlocks.map(b => b.id === blockId ? { ...b, date: newDate } : b).sort((a, b) => a.date.localeCompare(b.date)));
  };

  const toggleDayExpanded = (blockId: string) => {
    setDayBlocks(dayBlocks.map(b => b.id === blockId ? { ...b, isExpanded: !b.isExpanded } : b));
  };

  const toggleDayAllDay = (blockId: string, checked: boolean) => {
    setDayBlocks(dayBlocks.map(b => b.id === blockId ? { ...b, isAllDay: checked } : b));
  };

  const addTimeSlot = (blockId: string) => {
    setDayBlocks(dayBlocks.map(b => {
      if (b.id === blockId) {
        const lastTime = b.times[b.times.length - 1];
        let newStart = '12:00'; let newEnd = '14:00';
        if (lastTime && lastTime.end) {
          newStart = lastTime.end;
          try { newEnd = format(addMinutes(new Date(`2000-01-01T${newStart}`), 120), 'HH:mm'); } catch (e) { newEnd = '23:59'; }
        }
        return { ...b, times: [...b.times, { id: crypto.randomUUID(), start: newStart, end: newEnd }] };
      }
      return b;
    }));
  };

  const removeTimeSlot = (blockId: string, timeId: string) => {
    setDayBlocks(dayBlocks.map(b => b.id === blockId ? { ...b, times: b.times.filter(t => t.id !== timeId) } : b));
  };

  const updateTimeSlot = (blockId: string, timeId: string, field: keyof TimeSlot, value: any) => {
    setDayBlocks(dayBlocks.map(b => b.id === blockId ? { ...b, times: b.times.map(t => t.id === timeId ? { ...t, [field]: value } : t) } : b));
  };

  const toggleCalendarDate = (dateStr: string) => {
    const block = dayBlocks.find(b => b.date === dateStr);
    if (block) {
      setDayMemory(prev => ({ ...prev, [dateStr]: { isAllDay: block.isAllDay, times: block.times } }));
      setDayBlocks(dayBlocks.filter(b => b.date !== dateStr));
    } else {
      const mem = dayMemory[dateStr];
      const newBlock: DayBlock = {
        id: crypto.randomUUID(), date: dateStr,
        isAllDay: mem ? mem.isAllDay : false, isExpanded: true,
        times: mem ? mem.times : [{ id: crypto.randomUUID(), start: '', end: '' }]
      };
      setDayBlocks([...dayBlocks, newBlock].sort((a, b) => a.date.localeCompare(b.date)));
    }
  };

  const calendarDays = eachDayOfInterval({ start: startOfMonth(calendarMonth), end: endOfMonth(calendarMonth) });
  const firstDayOfWeek = calendarDays[0].getDay();
  const paddingDays = Array.from({ length: firstDayOfWeek }).map((_, i) => i);

  // 💡 安全な保存処理（変更分だけをDBに送る）
  const handleSave = async () => {
    const flatSlotsToSubmit: { startAt: string, endAt: string }[] = [];
    dayBlocks.forEach(block => {
      if (block.isAllDay) {
        flatSlotsToSubmit.push({ startAt: `${block.date}T00:00`, endAt: `${block.date}T23:59` });
      } else {
        block.times.forEach(t => {
          if (t.start && t.end) flatSlotsToSubmit.push({ startAt: `${block.date}T${t.start}`, endAt: `${block.date}T${t.end}` });
        });
      }
    });

    if (!title || flatSlotsToSubmit.length === 0) return alert('タイトルと少なくとも1つの日程を入力してね！');
    setLoading(true);

    // 既存のキーと新しいキーを比較
    const oldKeys = oldSlots.map(s => `${s.start_at}_${s.end_at}`);
    const newSlotsFormatted = flatSlotsToSubmit.map(s => ({
      event_id: eventId,
      start_at: `${s.startAt}:00+00:00`,
      end_at: `${s.endAt}:00+00:00`
    }));
    const newKeys = newSlotsFormatted.map(s => `${s.start_at}_${s.end_at}`);

    // 新規追加分と削除分を分ける（既存は維持されるので回答データが消えない！）
    const toInsert = newSlotsFormatted.filter(s => !oldKeys.includes(`${s.start_at}_${s.end_at}`));
    const toDeleteIds = oldSlots.filter(s => !newKeys.includes(`${s.start_at}_${s.end_at}`)).map(s => s.id);

    try {
      if (toDeleteIds.length > 0) await supabase.from('slots').delete().in('id', toDeleteIds);
      if (toInsert.length > 0) await supabase.from('slots').insert(toInsert);
      await supabase.from('events').update({ title, description }).eq('id', eventId);
      
      alert('イベントを更新しました！🎉');
      router.push(`/event/${eventId}`);
    } catch (e) {
      alert('エラーが発生しました');
      setLoading(false);
    }
  };

  const totalSlotsCount = dayBlocks.reduce((acc, block) => acc + (block.isAllDay ? 1 : block.times.filter(t => t.start && t.end).length), 0);

  if (loading) return <div className="text-center mt-20">読み込み中...</div>;

  return (
    <div className="max-w-xl mx-auto p-4 mt-6 space-y-6 pb-20">
      <div className="flex items-center justify-between border-b dark:border-gray-700 pb-4 sticky top-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md z-10 pt-2">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-2 bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700 rounded-full transition shadow-sm">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">イベント編集</h1>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-md p-6 border-t-4 border-blue-500">
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-bold mb-1 dark:text-gray-300">イベント名 *</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full p-2 border dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-bold mb-1 dark:text-gray-300">メモ（任意）</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full p-2 border dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded focus:ring-2 focus:ring-blue-500 outline-none h-24" placeholder="持ち物や場所など" />
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-md p-6">
        <div className="flex items-center gap-2 mb-6 border-b dark:border-gray-700 pb-2 text-blue-600 dark:text-blue-400">
          <CalendarDays size={20} />
          <h2 className="text-lg font-bold">日程の編集</h2>
        </div>

        <div className="mb-6">
          <button onClick={() => setShowCalendar(!showCalendar)} className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold border transition-colors ${showCalendar ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800/50 text-blue-600 dark:text-blue-400' : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
            <CalendarIcon size={18} /> {showCalendar ? 'カレンダーを閉じる' : 'カレンダーから日付を追加する'}
          </button>
          {showCalendar && (
            <div className="mt-3 p-4 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-xl shadow-sm animate-fade-in">
              <div className="flex justify-between items-center mb-4 px-2">
                <button onClick={() => setCalendarMonth(subMonths(calendarMonth, 1))} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full dark:text-gray-200"><ChevronLeft size={20}/></button>
                <span className="font-bold dark:text-gray-100">{format(calendarMonth, 'yyyy年 M月')}</span>
                <button onClick={() => setCalendarMonth(addMonths(calendarMonth, 1))} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full dark:text-gray-200"><ChevronRight size={20}/></button>
              </div>
              <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-gray-500 dark:text-gray-400 mb-2">
                {['日', '月', '火', '水', '木', '金', '土'].map(d => <div key={d}>{d}</div>)}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {paddingDays.map(d => <div key={`pad-${d}`}></div>)}
                {calendarDays.map(d => {
                  const dateStr = format(d, 'yyyy-MM-dd');
                  const isSelected = dayBlocks.some(b => b.date === dateStr);
                  const isToday = isSameDay(d, new Date());
                  return (
                    <button key={dateStr} onClick={() => toggleCalendarDate(dateStr)} className={`aspect-square flex items-center justify-center rounded-full text-sm transition-colors ${isSelected ? 'bg-blue-500 text-white font-bold shadow-md transform scale-105' : isToday ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-bold border border-blue-200 dark:border-blue-800/50' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
                      {format(d, 'd')}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          {dayBlocks.map((block) => (
            <div key={block.id} className="border dark:border-gray-700 rounded-xl overflow-hidden shadow-sm bg-white dark:bg-gray-800 transition-all hover:border-blue-300 dark:hover:border-blue-700">
              <div className="bg-blue-50 dark:bg-blue-900/20 px-4 py-3 border-b dark:border-gray-700 flex justify-between items-center transition-colors">
                <div className="flex items-center gap-2 flex-1">
                  <button onClick={() => toggleDayExpanded(block.id)} className="p-1 hover:bg-blue-100 dark:hover:bg-blue-800 rounded text-blue-600 dark:text-blue-400">
                    {block.isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                  </button>
                  <input type="date" value={block.date} onChange={e => updateDayBlockDate(block.id, e.target.value)} className="font-bold text-blue-800 dark:text-blue-300 bg-transparent border-none outline-none focus:ring-0 cursor-pointer w-32" />
                  <span className="text-sm font-bold text-blue-600 dark:text-blue-400 hidden sm:inline">({format(new Date(block.date || new Date()), 'E', { locale: ja })})</span>
                  
                  <label className="ml-2 flex items-center gap-1 text-xs font-bold text-blue-700 dark:text-blue-300 cursor-pointer bg-white/50 dark:bg-gray-800 px-2 py-1 rounded border border-blue-200 dark:border-blue-800/50">
                    <input type="checkbox" checked={block.isAllDay} onChange={e => toggleDayAllDay(block.id, e.target.checked)} className="w-3 h-3 text-blue-600" />
                    終日
                  </label>
                </div>
                <button onClick={() => removeDayBlock(block.id)} className="text-red-400 hover:text-red-600 transition p-1"><Trash2 size={18} /></button>
              </div>
              
              {block.isExpanded && (
                <div className="p-3 bg-white dark:bg-gray-800">
                  {block.isAllDay ? (
                    <div className="text-center py-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 text-blue-600 dark:text-blue-400 font-bold text-sm">
                      🌟 終日 (0:00〜23:59)
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {block.times.length === 0 ? <p className="text-xs text-gray-400 text-center py-2">時間がありません</p> : (
                        block.times.map((time) => (
                          <div key={time.id} className="flex items-center gap-3 bg-gray-50 dark:bg-gray-900 p-2 rounded-lg border dark:border-gray-700 group">
                            <div className="flex items-center gap-2 flex-1 pl-2">
                              <input type="time" value={time.start} onChange={e => updateTimeSlot(block.id, time.id, 'start', e.target.value)} className="p-1 border dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded text-sm flex-1 outline-none focus:ring-1 focus:ring-blue-500" />
                              <span className="text-gray-400 text-xs">〜</span>
                              <input type="time" value={time.end} onChange={e => updateTimeSlot(block.id, time.id, 'end', e.target.value)} className="p-1 border dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded text-sm flex-1 outline-none focus:ring-1 focus:ring-blue-500" />
                            </div>
                            <button onClick={() => removeTimeSlot(block.id, time.id)} className="text-gray-300 hover:text-red-500 p-1"><X size={16}/></button>
                          </div>
                        ))
                      )}
                      <button onClick={() => addTimeSlot(block.id)} className="w-full py-2 text-sm font-bold text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-900/10 hover:bg-blue-100 border border-blue-100 rounded-lg transition-colors flex items-center justify-center gap-1 mt-2">
                        <Plus size={16} /> この日に時間を追加
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md border-t dark:border-gray-700 z-50 flex justify-center shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
        <button onClick={handleSave} disabled={loading || totalSlotsCount === 0 || !title} className={`w-full max-w-xl py-4 font-bold text-lg rounded-xl shadow-md transition-all flex items-center justify-center gap-2 ${totalSlotsCount > 0 && title ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}>
          <CheckCircle2 size={24} />
          {loading ? '保存中...' : '変更を保存する'}
        </button>
      </div>
    </div>
  );
}