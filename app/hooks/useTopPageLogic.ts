'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { addMinutes, format, addDays, startOfMonth, endOfMonth, eachDayOfInterval, subMonths, addMonths, isSameDay } from 'date-fns';
import { getFixedDate } from '@/lib/utils';

// 💡 型定義（一旦ここにまとめておくね！）
export type HistoryItem = { title: string; slots: { startAt: string; endAt: string }[] };
export type ConfirmedSchedule = { id: string; event_id: string; start_at: string; end_at: string; eventTitle: string };
export type RecentEvent = { id: string; title: string; lastAccessed: number };
export type TimeSlot = { id: string; start: string; end: string };
export type DayBlock = { id: string; date: string; isAllDay: boolean; isExpanded: boolean; times: TimeSlot[] };

export function useTopPageLogic() {
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

  // UI描画用の計算値
  const calendarDays = eachDayOfInterval({ start: startOfMonth(calendarMonth), end: endOfMonth(calendarMonth) });
  const firstDayOfWeek = calendarDays[0].getDay();
  const paddingDays = Array.from({ length: firstDayOfWeek }).map((_, i) => i);
  const totalSlotsCount = dayBlocks.reduce((acc, block) => acc + (block.isAllDay ? 1 : block.times.filter(t => t.start && t.end).length), 0);

  return {
    activeTab, setActiveTab, title, setTitle, description, setDescription,
    dayBlocks, showCalendar, setShowCalendar, calendarMonth, setCalendarMonth,
    createdEventId, loading, hostHistory, mySchedules, fetchingSchedules, recentEvents,
    isBulkOpen, setIsBulkOpen, bulkStartDate, setBulkStartDate, bulkEndDate, setBulkEndDate,
    selectedDows, bulkStart, setBulkStart, bulkEnd, setBulkEnd, bulkInterval, setBulkInterval,
    bulkIsAllDay, setBulkIsAllDay, showScrollTop, DOW_LABELS,
    calendarDays, paddingDays, totalSlotsCount,
    removeRecentEvent, addDayBlock, removeDayBlock, updateDayBlockDate,
    toggleDayExpanded, toggleDayAllDay, addTimeSlot, removeTimeSlot, updateTimeSlot,
    toggleCalendarDate, loadFromHistory, toggleDow, toggleEveryday, generateBulkSlots,
    handleCreate, handleShare, scrollToTop
  };
}