'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, Trash2, Link as LinkIcon, Share2, CalendarDays, History, CalendarCheck, ChevronRight, Settings, CheckCircle2, ArrowUp, X, Calendar as CalendarIcon, ChevronLeft, ChevronDown } from 'lucide-react';
import { addMinutes, format, addDays, startOfMonth, endOfMonth, eachDayOfInterval, subMonths, addMonths, isSameDay } from 'date-fns';
import { ja } from 'date-fns/locale';
import Link from 'next/link';

type HistoryItem = { title: string; slots: { startAt: string; endAt: string }[] };
type ConfirmedSchedule = { id: string; event_id: string; start_at: string; end_at: string; eventTitle: string };
type RecentEvent = { id: string; title: string; lastAccessed: number };

type TimeSlot = { id: string; start: string; end: string };
type DayBlock = { id: string; date: string; isAllDay: boolean; isExpanded: boolean; times: TimeSlot[] };

const getFixedDate = (dbDateStr: string) => new Date(dbDateStr.substring(0, 16));

export default function TopPage() {
  const [activeTab, setActiveTab] = useState<'create' | 'my-schedule'>('create');
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  
  const [dayBlocks, setDayBlocks] = useState<DayBlock[]>([
    { id: crypto.randomUUID(), date: format(new Date(), 'yyyy-MM-dd'), isAllDay: false, isExpanded: true, times: [{ id: crypto.randomUUID(), start: '', end: '' }] }
  ]);

  const [dayMemory, setDayMemory] = useState<Record<string, { isAllDay: boolean; times: TimeSlot[] }>>({});
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(startOfMonth(new Date()));

  const [createdEventId, setCreatedEventId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hostHistory, setHostHistory] = useState<HistoryItem[]>([]);

  const [mySchedules, setMySchedules] = useState<ConfirmedSchedule[]>([]);
  const [fetchingSchedules, setFetchingSchedules] = useState(false);
  const [recentEvents, setRecentEvents] = useState<RecentEvent[]>([]);

  // 💡 一括作成エリアの開閉状態を管理（初期値は false = 閉じてる）
  const [isBulkOpen, setIsBulkOpen] = useState(false);

  const [bulkStartDate, setBulkStartDate] = useState('');
  const [bulkEndDate, setBulkEndDate] = useState('');
  const [selectedDows, setSelectedDows] = useState<number[]>([]);
  const [bulkStart, setBulkStart] = useState('12:00');
  const [bulkEnd, setBulkEnd] = useState('18:00');
  const [bulkInterval, setBulkInterval] = useState('120');
  const [bulkIsAllDay, setBulkIsAllDay] = useState(false); 

  const [deviceGuestId, setDeviceGuestId] = useState('');
  const [showScrollTop, setShowScrollTop] = useState(false); 

  const DOW_LABELS = [
    { label: '日', val: 0 }, { label: '月', val: 1 }, { label: '火', val: 2 },
    { label: '水', val: 3 }, { label: '木', val: 4 }, { label: '金', val: 5 }, { label: '土', val: 6 },
  ];

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('hostEventHistory');
      if (saved) setHostHistory(JSON.parse(saved));
      
      let currentGuestId = localStorage.getItem('deviceGuestId');
      if (!currentGuestId) {
        currentGuestId = crypto.randomUUID();
        localStorage.setItem('deviceGuestId', currentGuestId);
      }
      setDeviceGuestId(currentGuestId);
      
      fetchMySchedules(currentGuestId);
      fetchRecentEvents(currentGuestId);

      const handleScroll = () => setShowScrollTop(window.scrollY > 300);
      window.addEventListener('scroll', handleScroll);
      return () => window.removeEventListener('scroll', handleScroll);
    }
  }, []);

  const fetchRecentEvents = async (guestId: string) => {
    const { data } = await supabase.from('user_recent_events').select('*').eq('guest_id', guestId).order('accessed_at', { ascending: false }).limit(10);
    if (data) setRecentEvents(data.map((d: any) => ({ id: d.event_id, title: d.event_title, lastAccessed: d.accessed_at })));
  };

  const fetchMySchedules = async (guestId: string) => {
    setFetchingSchedules(true);
    const { data: resData } = await supabase.from('responses').select('id, event_id').eq('guest_id', guestId);
    if (!resData || resData.length === 0) { setFetchingSchedules(false); return; }

    const resIds = resData.map(r => r.id);
    const { data: avails } = await supabase.from('availabilities').select('slot_id, status').in('response_id', resIds).in('status', ['maru', 'sankaku']);
    if (!avails || avails.length === 0) { setFetchingSchedules(false); return; }

    const slotIds = avails.map(a => a.slot_id);
    const { data: slotsData } = await supabase.from('slots').select('*').in('id', slotIds).eq('is_confirmed', true);
    if (!slotsData || slotsData.length === 0) { setFetchingSchedules(false); return; }

    const eventIds = [...new Set(slotsData.map(s => s.event_id))];
    const { data: eventsData } = await supabase.from('events').select('id, title').in('id', eventIds);

    const schedules = slotsData.map(slot => {
      const event = eventsData?.find(e => e.id === slot.event_id);
      return { ...slot, eventTitle: event?.title || '不明なイベント' };
    });

    schedules.sort((a, b) => getFixedDate(a.start_at).getTime() - getFixedDate(b.start_at).getTime());
    setMySchedules(schedules);
    setFetchingSchedules(false);
  };

  const removeRecentEvent = async (e: React.MouseEvent, eventId: string) => {
    e.preventDefault();
    if (!confirm('このイベントを履歴から削除しますか？')) return;
    await supabase.from('user_recent_events').delete().eq('guest_id', deviceGuestId).eq('event_id', eventId);
    setRecentEvents(prev => prev.filter(re => re.id !== eventId));
  };

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
      const newBlocks = [...dayBlocks, newBlock];
      newBlocks.sort((a, b) => a.date.localeCompare(b.date));
      setDayBlocks(newBlocks);
    }
  };

  const calendarDays = eachDayOfInterval({ start: startOfMonth(calendarMonth), end: endOfMonth(calendarMonth) });
  const firstDayOfWeek = calendarDays[0].getDay();
  const paddingDays = Array.from({ length: firstDayOfWeek }).map((_, i) => i);

  const loadFromHistory = (index: string) => {
    if (index === '') return;
    const item = hostHistory[Number(index)];
    if (item) {
      const grouped: Record<string, { isAllDay: boolean, times: TimeSlot[] }> = {};
      item.slots.forEach(s => {
        const date = s.startAt.split('T')[0];
        const start = s.startAt.split('T')[1].substring(0, 5);
        const end = s.endAt.split('T')[1].substring(0, 5);
        const isAllDay = start === '00:00' && end === '23:59';
        
        if (!grouped[date]) grouped[date] = { isAllDay: false, times: [] };
        if (isAllDay) grouped[date].isAllDay = true;
        else grouped[date].times.push({ id: crypto.randomUUID(), start, end });
      });

      const newBlocks = Object.keys(grouped).map(date => ({
        id: crypto.randomUUID(), date, isAllDay: grouped[date].isAllDay, isExpanded: true,
        times: grouped[date].times.length > 0 ? grouped[date].times : [{ id: crypto.randomUUID(), start: '', end: '' }]
      }));
      newBlocks.sort((a, b) => a.date.localeCompare(b.date));
      setDayBlocks(newBlocks);
      alert(`「${item.title}」の日程構成をコピーしたよ！`);
    }
  };

  const toggleDow = (val: number) => { setSelectedDows(prev => prev.includes(val) ? prev.filter(d => d !== val) : [...prev, val]); };
  const toggleEveryday = () => { if (selectedDows.length === 7) setSelectedDows([]); else setSelectedDows([0, 1, 2, 3, 4, 5, 6]); };

  const generateBulkSlots = () => {
    if (!bulkStartDate || !bulkEndDate || selectedDows.length === 0) return alert('期間と曜日を指定してね！');
    if (!bulkIsAllDay && (!bulkStart || !bulkEnd)) return alert('時間を指定するか、終日にチェックを入れてね！');
    
    const start = new Date(bulkStartDate);
    const end = new Date(bulkEndDate);
    if (start > end) return alert('終了日は開始日より後に設定してね！');

    const interval = parseInt(bulkInterval);
    const newBlocks: DayBlock[] = [...dayBlocks];

    let currentDate = start;
    while (currentDate <= end) {
      if (selectedDows.includes(currentDate.getDay())) {
        const dateStr = format(currentDate, 'yyyy-MM-dd');
        const existingBlock = newBlocks.find(b => b.date === dateStr);

        if (bulkIsAllDay) {
          if (existingBlock) { existingBlock.isAllDay = true; } 
          else { newBlocks.push({ id: crypto.randomUUID(), date: dateStr, isAllDay: true, isExpanded: true, times: [{ id: crypto.randomUUID(), start: '', end: '' }] }); }
        } else {
          const generatedTimes: TimeSlot[] = [];
          const dayStart = new Date(`${dateStr}T${bulkStart}`);
          const dayEnd = new Date(`${dateStr}T${bulkEnd}`);
          let currentSlot = dayStart;
          while (currentSlot < dayEnd) {
            const nextSlot = addMinutes(currentSlot, interval);
            if (nextSlot > dayEnd) break;
            generatedTimes.push({ id: crypto.randomUUID(), start: format(currentSlot, "HH:mm"), end: format(nextSlot, "HH:mm") });
            currentSlot = nextSlot;
          }

          if (existingBlock) {
             const validExistingTimes = existingBlock.times.filter(t => t.start && t.end);
             existingBlock.times = [...validExistingTimes, ...generatedTimes];
             existingBlock.isAllDay = false; 
          } else {
             const mem = dayMemory[dateStr];
             const baseTimes = mem ? mem.times.filter(t => t.start && t.end) : [];
             newBlocks.push({ id: crypto.randomUUID(), date: dateStr, isAllDay: false, isExpanded: true, times: [...baseTimes, ...generatedTimes] });
          }
        }
      }
      currentDate = addDays(currentDate, 1);
    }

    if (newBlocks.length === dayBlocks.length) return alert('条件に合う日がなかったよ😢');
    newBlocks.sort((a, b) => a.date.localeCompare(b.date));
    setDayBlocks(newBlocks.filter(b => b.date !== format(new Date(), 'yyyy-MM-dd') || b.times.some(t => t.start && t.end) || b.isAllDay));
    // 生成したら一括作成エリアを閉じる！
    setIsBulkOpen(false);
  };

  const handleCreate = async () => {
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

    if (!title || flatSlotsToSubmit.length === 0) return alert('タイトルと、少なくとも1つの「有効な時間枠」を入力してね！');
    setLoading(true);

    const { data: eventData, error: eventError } = await supabase.from('events').insert([{ title, description, host_id: deviceGuestId }]).select('id').single();
    if (eventError || !eventData) { alert('エラーが発生しました'); setLoading(false); return; }

    const slotsToInsert = flatSlotsToSubmit.map(s => ({ event_id: eventData.id, start_at: `${s.startAt}:00+00:00`, end_at: `${s.endAt}:00+00:00` }));

    await supabase.from('slots').insert(slotsToInsert);
    const updatedHistory = [{ title, slots: flatSlotsToSubmit }, ...hostHistory.filter(h => h.title !== title)].slice(0, 5);
    localStorage.setItem('hostEventHistory', JSON.stringify(updatedHistory));
    setHostHistory(updatedHistory);

    await supabase.from('user_recent_events').upsert({ guest_id: deviceGuestId, event_id: eventData.id, event_title: title, accessed_at: Date.now() }, { onConflict: 'guest_id,event_id' });
    await fetchRecentEvents(deviceGuestId);

    setCreatedEventId(eventData.id);
    setLoading(false);
  };

  const handleShare = async (url: string) => {
    if (navigator.share) {
      try { await navigator.share({ title: '日程調整', text: `${title} の日程調整をお願いします！`, url }); } catch (error) {}
    } else { alert('URLをコピーしてね！'); }
  };

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });
  const totalSlotsCount = dayBlocks.reduce((acc, block) => acc + (block.isAllDay ? 1 : block.times.filter(t => t.start && t.end).length), 0);

  if (createdEventId) {
    const eventUrl = `${window.location.origin}/event/${createdEventId}`;
    return (
      <div className="max-w-xl mx-auto p-6 mt-10 bg-white rounded-xl shadow-md space-y-6">
        <h1 className="text-2xl font-bold text-center text-green-600">イベント作成完了！🎉</h1>
        <div className="bg-blue-50 p-6 rounded-xl border border-blue-200 shadow-sm text-center">
          <p className="font-bold text-lg text-blue-900 mb-2">共有＆集計用 URL</p>
          <p className="text-sm text-blue-700 mb-4">※回答も集計の確認も、このURL一つで全員ができます！</p>
          <div className="flex items-center gap-2 mb-4">
            <input readOnly value={eventUrl} className="flex-1 p-3 bg-white border rounded-lg text-sm text-gray-700 focus:outline-none" />
            <button onClick={() => navigator.clipboard.writeText(eventUrl)} className="p-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"><LinkIcon size={20} /></button>
          </div>
          <button onClick={() => handleShare(eventUrl)} className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg flex items-center justify-center gap-2 shadow-md transition-all">
            <Share2 size={20} /> LINEやXでメンバーに共有する
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto p-4 mt-6 space-y-6 pb-20">
      <div className="flex justify-between items-center px-1 mb-2">
        <h1 className="text-2xl font-extrabold text-gray-800 dark:text-gray-100 tracking-tight">📝 最強調整</h1>
        <Link href="/settings" className="flex items-center gap-1 text-sm bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 px-3 py-2 rounded-lg font-bold hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors shadow-sm border border-gray-200 dark:border-gray-700">
          <Settings size={16} /> 設定
        </Link>
      </div>

      <div className="flex bg-gray-200 dark:bg-gray-800 rounded-lg p-1 shadow">
        <button onClick={() => setActiveTab('create')} className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${activeTab === 'create' ? 'bg-white dark:bg-gray-700 shadow text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}>
          🗓 イベント作成
        </button>
        <button onClick={() => setActiveTab('my-schedule')} className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${activeTab === 'my-schedule' ? 'bg-white dark:bg-gray-700 shadow text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}>
          📅 マイ予定・履歴
        </button>
      </div>

      {activeTab === 'create' && (
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-md p-6 border-t-4 border-blue-500">
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-bold mb-1 dark:text-gray-300">イベント名 *</label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full p-2 border dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded focus:ring-2 focus:ring-blue-500 outline-none" placeholder="例: BNS合同練習" />
            </div>
            
            {/* 💡 一括作成エリアを折りたたみ式に進化！ */}
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800/30 overflow-hidden shadow-sm transition-all">
              <button 
                onClick={() => setIsBulkOpen(!isBulkOpen)}
                className="w-full flex items-center justify-between p-4 bg-blue-100/50 dark:bg-blue-900/40 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors"
              >
                <div className="flex items-center gap-2 text-blue-800 dark:text-blue-300 font-bold">
                  <CalendarDays size={18} />
                  <span>期間と曜日で一括作成</span>
                </div>
                <div className="text-blue-600 dark:text-blue-400 bg-white/50 dark:bg-gray-800/50 p-1 rounded-full">
                  {isBulkOpen ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                </div>
              </button>

              {isBulkOpen && (
                <div className="p-4 space-y-4 border-t border-blue-200/50 dark:border-blue-800/30">
                  <div className="flex items-center gap-2">
                    <input type="date" value={bulkStartDate} onChange={e => setBulkStartDate(e.target.value)} className="p-2 border dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 rounded text-sm flex-1 outline-none focus:ring-2 focus:ring-blue-500" />
                    <span className="text-gray-500">〜</span>
                    <input type="date" value={bulkEndDate} onChange={e => setBulkEndDate(e.target.value)} className="p-2 border dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 rounded text-sm flex-1 outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div className="flex gap-2 flex-wrap items-center">
                    {DOW_LABELS.map(dow => (
                      <button key={dow.val} onClick={() => toggleDow(dow.val)}
                        className={`w-10 h-10 rounded-full font-bold text-sm border transition-colors ${selectedDows.includes(dow.val) ? 'bg-blue-500 text-white border-blue-500' : 'bg-white dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'}`}>
                        {dow.label}
                      </button>
                    ))}
                    <button onClick={toggleEveryday} className={`ml-2 px-3 py-2 rounded-full font-bold text-sm border transition-colors ${selectedDows.length === 7 ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700 dark:border-gray-700'}`}>
                      毎日
                    </button>
                  </div>
                  
                  <div className="flex items-center gap-2 mb-2">
                    <input type="checkbox" id="bulkAllDay" checked={bulkIsAllDay} onChange={e => setBulkIsAllDay(e.target.checked)} className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500" />
                    <label htmlFor="bulkAllDay" className="text-sm font-bold text-gray-700 dark:text-gray-300 cursor-pointer">時間を指定せず「終日」にする</label>
                  </div>

                  {!bulkIsAllDay && (
                    <div className="flex items-center gap-2 bg-white dark:bg-gray-800 p-2 rounded border dark:border-gray-700">
                      <input type="time" value={bulkStart} onChange={e => setBulkStart(e.target.value)} className="p-1 border-b dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 text-sm flex-1 outline-none" />
                      <span className="text-gray-500">〜</span>
                      <input type="time" value={bulkEnd} onChange={e => setBulkEnd(e.target.value)} className="p-1 border-b dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 text-sm flex-1 outline-none" />
                      <select value={bulkInterval} onChange={e => setBulkInterval(e.target.value)} className="p-1 border-l dark:border-gray-600 pl-2 text-sm flex-1 text-gray-600 dark:text-gray-300 dark:bg-gray-800 outline-none">
                        <option value="60">60分枠</option>
                        <option value="90">90分枠</option>
                        <option value="120">2時間枠</option>
                        <option value="180">3時間枠</option>
                      </select>
                    </div>
                  )}
                  <button onClick={generateBulkSlots} className="w-full py-3 bg-blue-600 text-white font-bold rounded-lg shadow-sm hover:bg-blue-700 transition mt-2">条件に合う枠を一気に追加する</button>
                </div>
              )}
            </div>

            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-xl border border-green-200 dark:border-green-800/30 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="text-green-800 dark:text-green-400 font-bold">
                有効な候補日程: <span className="text-xl">{totalSlotsCount}</span> 枠
              </div>
              <button onClick={handleCreate} disabled={loading || totalSlotsCount === 0 || !title} className={`w-full sm:w-auto px-8 py-3 font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 ${totalSlotsCount > 0 && title ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}>
                <CheckCircle2 size={20} />
                {loading ? '作成中...' : 'イベントを作成する'}
              </button>
            </div>

            <div>
              <div className="flex justify-between items-end mb-4 border-b dark:border-gray-700 pb-2">
                <h3 className="font-bold text-lg dark:text-gray-100">個別の日程調整</h3>
                {hostHistory.length > 0 && (
                  <div className="flex items-center gap-1 text-xs text-purple-600 dark:text-purple-400">
                    <History size={14} />
                    <select onChange={(e) => { loadFromHistory(e.target.value); e.target.value = ""; }} className="bg-purple-50 dark:bg-purple-900/30 border dark:border-purple-800/50 rounded p-1 max-w-[150px] outline-none">
                      <option value="">過去からコピー</option>
                      {hostHistory.map((h, i) => <option key={i} value={i}>{h.title}</option>)}
                    </select>
                  </div>
                )}
              </div>
              
              <div className="mb-6">
                <button 
                  onClick={() => setShowCalendar(!showCalendar)} 
                  className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold border transition-colors ${showCalendar ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800/50 text-blue-600 dark:text-blue-400' : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                >
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
                          <button
                            key={dateStr}
                            onClick={() => toggleCalendarDate(dateStr)}
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
                                    <input type="time" value={time.start} onChange={e => updateTimeSlot(block.id, time.id, 'start', e.target.value)} className="p-1 border dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded text-sm flex-1 outline-none focus:ring-1 focus:ring-blue-500" />
                                    <span className="text-gray-400 text-xs">〜</span>
                                    <input type="time" value={time.end} onChange={e => updateTimeSlot(block.id, time.id, 'end', e.target.value)} className="p-1 border dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded text-sm flex-1 outline-none focus:ring-1 focus:ring-blue-500" />
                                  </div>
                                  <button onClick={() => removeTimeSlot(block.id, time.id)} className="text-gray-300 hover:text-red-500 p-1"><X size={16}/></button>
                                </div>
                              ))
                            )}
                            <button onClick={() => addTimeSlot(block.id)} className="w-full py-2 text-sm font-bold text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-900/10 hover:bg-blue-100 dark:hover:bg-blue-900/30 border border-blue-100 dark:border-blue-800/30 rounded-lg transition-colors flex items-center justify-center gap-1 mt-2">
                              <Plus size={16} /> この日に時間を追加
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {dayBlocks.length === 0 && (
                <div className="mt-4 text-center py-8 bg-gray-50 dark:bg-gray-800 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700">
                  <p className="text-gray-500 dark:text-gray-400 font-bold mb-2">日付がありません</p>
                  <button onClick={() => addDayBlock()} className="px-4 py-2 bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 text-sm font-bold rounded-lg shadow-sm border dark:border-gray-600">今日を追加する</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'my-schedule' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-md p-6 border-t-4 border-yellow-400">
            <div className="flex items-center gap-2 mb-6 text-yellow-600 dark:text-yellow-500">
              <CalendarCheck size={24} />
              <h2 className="text-xl font-bold dark:text-gray-100">あなたが参加する確定予定</h2>
            </div>
            
            {fetchingSchedules ? (
              <p className="text-center text-gray-500 py-10">読み込み中...</p>
            ) : mySchedules.length === 0 ? (
              <div className="text-center py-6 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <p className="text-gray-500 font-bold">まだ確定した予定はありません。</p>
              </div>
            ) : (
              <div className="space-y-4">
                {mySchedules.map((schedule, i) => {
                  const isFirstOfDay = i === 0 || format(getFixedDate(mySchedules[i - 1].start_at), 'yyyy-MM-dd') !== format(getFixedDate(schedule.start_at), 'yyyy-MM-dd');
                  return (
                    <div key={schedule.id}>
                      {isFirstOfDay && (
                        <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 mb-2 mt-4 border-b dark:border-gray-700 pb-1">
                          {format(getFixedDate(schedule.start_at), 'yyyy年M月d日 (E)', { locale: ja })}
                        </h3>
                      )}
                      <div className="block bg-white dark:bg-gray-800 border-2 border-yellow-300 dark:border-yellow-600 p-4 rounded-xl shadow-sm">
                        <div className="flex justify-between items-center mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs bg-yellow-400 text-white px-2 py-1 rounded-full font-bold shadow-sm">📌 仮確定</span>
                            <span className="font-extrabold text-lg text-gray-800 dark:text-gray-100">
                              {format(getFixedDate(schedule.start_at), 'HH:mm')} 〜 {format(getFixedDate(schedule.end_at), 'HH:mm')}
                            </span>
                          </div>
                        </div>
                        <p className="text-sm text-gray-700 dark:text-gray-300 font-bold truncate pr-4">{schedule.eventTitle}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-md p-6 border-t-4 border-blue-400">
            <div className="flex items-center gap-2 mb-6 text-blue-600 dark:text-blue-400">
              <History size={24} />
              <h2 className="text-xl font-bold dark:text-gray-100">最近見た・調整中のイベント</h2>
            </div>
            {recentEvents.length === 0 ? <p className="text-center text-gray-500 py-6 bg-gray-50 dark:bg-gray-800 rounded-lg font-bold">まだ履歴がありません。</p> : (
              <div className="space-y-3">
                {recentEvents.map(re => (
                  <Link key={re.id} href={`/event/${re.id}`} className="block bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 rounded-xl hover:bg-blue-50 dark:hover:bg-gray-700 transition shadow-sm group relative">
                    <div className="flex justify-between items-center pr-10">
                      <span className="font-bold text-gray-800 dark:text-gray-100 truncate">{re.title}</span>
                      <div className="flex items-center gap-1 text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800/50 px-3 py-2 rounded-lg transition shrink-0">開く <ChevronRight size={14} /></div>
                    </div>
                    <button onClick={(e) => removeRecentEvent(e, re.id)} className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-red-500 transition-colors z-10" title="履歴から削除"><Trash2 size={18} /></button>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {showScrollTop && (
        <button onClick={scrollToTop} className="fixed bottom-6 right-6 p-4 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg transition-all z-50 animate-fade-in-up">
          <ArrowUp size={24} />
        </button>
      )}
    </div>
  );
}