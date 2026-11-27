'use client';

import { useState, useEffect, useMemo, use } from 'react';
import {
  Plus,
  Trash2,
  ArrowLeft,
  ArrowUp,
  CalendarDays,
  CheckCircle2,
  X,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Loader2,
} from 'lucide-react';
import {
  addMinutes,
  format,
  addDays,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  subMonths,
  addMonths,
  isSameDay,
} from 'date-fns';
import { ja } from 'date-fns/locale';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { generateId } from '@/lib/utils';

type TimeSlot = { id: string; start: string; end: string };
type DayBlock = { id: string; date: string; isAllDay: boolean; isExpanded: boolean; times: TimeSlot[] };

const DOW_LABELS = [
  { label: '日', val: 0 },
  { label: '月', val: 1 },
  { label: '火', val: 2 },
  { label: '水', val: 3 },
  { label: '木', val: 4 },
  { label: '金', val: 5 },
  { label: '土', val: 6 },
];

export default function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = use(params);
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [initialTitle, setInitialTitle] = useState('');
  const [initialDescription, setInitialDescription] = useState('');
  const [dayBlocks, setDayBlocks] = useState<DayBlock[]>([]);
  const [oldSlots, setOldSlots] = useState<any[]>([]);

  const [dayMemory, setDayMemory] = useState<Record<string, { isAllDay: boolean; times: TimeSlot[] }>>({});
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(startOfMonth(new Date()));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  // 期間と曜日で一括追加用の状態
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [bulkStartDate, setBulkStartDate] = useState('');
  const [bulkEndDate, setBulkEndDate] = useState('');
  const [selectedDows, setSelectedDows] = useState<number[]>([]);
  const [bulkStart, setBulkStart] = useState('12:00');
  const [bulkEnd, setBulkEnd] = useState('18:00');
  const [bulkInterval, setBulkInterval] = useState('120');
  const [bulkIsAllDay, setBulkIsAllDay] = useState(false);

  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'info') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(prev => (prev?.message === message ? null : prev));
    }, 3200);
  };

  useEffect(() => {
    const scrollContainer = document.getElementById('app-scroll-container');
    if (scrollContainer) scrollContainer.scrollTop = 0;

    const handleScroll = () => {
      setShowScrollTop(prev => {
        const y = scrollContainer ? scrollContainer.scrollTop : window.scrollY;
        const next = y > 300;
        return prev !== next ? next : prev;
      });
    };
    const target: HTMLElement | Window = scrollContainer || window;
    target.addEventListener('scroll', handleScroll, { passive: true });
    return () => target.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const fetchEvent = async () => {
      let currentGuestId = localStorage.getItem('deviceGuestId');
      if (!currentGuestId) {
        currentGuestId = generateId();
        localStorage.setItem('deviceGuestId', currentGuestId);
      }

      const { data: eData } = await supabase.from('events').select('*').eq('id', eventId).single();
      if (!eData) {
        alert('イベントが見つかりません');
        router.push('/');
        return;
      }
      setTitle(eData.title);
      setDescription(eData.description || '');
      setInitialTitle(eData.title);
      setInitialDescription(eData.description || '');

      const { data: sData } = await supabase.from('slots').select('*').eq('event_id', eventId).order('start_at');
      if (sData) {
        setOldSlots(sData);
        const grouped: Record<string, { isAllDay: boolean; times: TimeSlot[] }> = {};
        sData.forEach(s => {
          const date = s.start_at.split('T')[0];
          const start = s.start_at.split('T')[1].substring(0, 5);
          const end = s.end_at.split('T')[1].substring(0, 5);
          const isAllDay = start === '00:00' && end === '23:59';

          if (!grouped[date]) grouped[date] = { isAllDay: false, times: [] };
          if (isAllDay) grouped[date].isAllDay = true;
          else grouped[date].times.push({ id: generateId(), start, end });
        });

        const initialBlocks = Object.keys(grouped).map(date => ({
          id: generateId(),
          date,
          isAllDay: grouped[date].isAllDay,
          isExpanded: true,
          times: grouped[date].times.length > 0 ? grouped[date].times : [{ id: generateId(), start: '', end: '' }],
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
      id: generateId(),
      date: dateStr,
      isAllDay: mem ? mem.isAllDay : false,
      isExpanded: true,
      times: mem ? mem.times : [{ id: generateId(), start: '', end: '' }],
    };
    setDayBlocks([...dayBlocks, newBlock].sort((a, b) => a.date.localeCompare(b.date)));
  };

  const removeDayBlock = (blockId: string) => {
    const block = dayBlocks.find(b => b.id === blockId);
    if (block) setDayMemory(prev => ({ ...prev, [block.date]: { isAllDay: block.isAllDay, times: block.times } }));
    setDayBlocks(dayBlocks.filter(b => b.id !== blockId));
  };

  const clearAllDayBlocks = () => {
    if (dayBlocks.length === 0) return;
    if (
      !confirm(
        '表示中の日程を一旦すべてクリアしますか？\n（※クリア後に同じ日時の枠を追加し直せば、既存の回答データは消えずに引き継がれます）'
      )
    ) {
      return;
    }
    setDayBlocks([]);
    setDayMemory({});
  };

  const updateDayBlockDate = (blockId: string, newDate: string) => {
    setDayBlocks(dayBlocks.map(b => (b.id === blockId ? { ...b, date: newDate } : b)).sort((a, b) => a.date.localeCompare(b.date)));
  };

  const toggleDayExpanded = (blockId: string) => {
    setDayBlocks(dayBlocks.map(b => (b.id === blockId ? { ...b, isExpanded: !b.isExpanded } : b)));
  };

  const toggleDayAllDay = (blockId: string, checked: boolean) => {
    setDayBlocks(dayBlocks.map(b => (b.id === blockId ? { ...b, isAllDay: checked } : b)));
  };

  const addTimeSlot = (blockId: string) => {
    setDayBlocks(
      dayBlocks.map(b => {
        if (b.id === blockId) {
          const lastTime = b.times[b.times.length - 1];
          let newStart = '12:00';
          let newEnd = '14:00';
          if (lastTime && lastTime.end) {
            newStart = lastTime.end;
            try {
              newEnd = format(addMinutes(new Date(`2000-01-01T${newStart}`), 120), 'HH:mm');
            } catch {
              newEnd = '23:59';
            }
          }
          return { ...b, times: [...b.times, { id: generateId(), start: newStart, end: newEnd }] };
        }
        return b;
      })
    );
  };

  const removeTimeSlot = (blockId: string, timeId: string) => {
    setDayBlocks(dayBlocks.map(b => (b.id === blockId ? { ...b, times: b.times.filter(t => t.id !== timeId) } : b)));
  };

  const updateTimeSlot = (blockId: string, timeId: string, field: keyof TimeSlot, value: any) => {
    setDayBlocks(
      dayBlocks.map(b => (b.id === blockId ? { ...b, times: b.times.map(t => (t.id === timeId ? { ...t, [field]: value } : t)) } : b))
    );
  };

  const toggleCalendarDate = (dateStr: string) => {
    const block = dayBlocks.find(b => b.date === dateStr);
    if (block) {
      setDayMemory(prev => ({ ...prev, [dateStr]: { isAllDay: block.isAllDay, times: block.times } }));
      setDayBlocks(dayBlocks.filter(b => b.date !== dateStr));
    } else {
      const mem = dayMemory[dateStr];
      const newBlock: DayBlock = {
        id: generateId(),
        date: dateStr,
        isAllDay: mem ? mem.isAllDay : false,
        isExpanded: true,
        times: mem ? mem.times : [{ id: generateId(), start: '', end: '' }],
      };
      setDayBlocks([...dayBlocks, newBlock].sort((a, b) => a.date.localeCompare(b.date)));
    }
  };

  const toggleDow = (val: number) => {
    setSelectedDows(prev => (prev.includes(val) ? prev.filter(d => d !== val) : [...prev, val]));
  };

  const toggleEveryday = () => {
    if (selectedDows.length === 7) setSelectedDows([]);
    else setSelectedDows([0, 1, 2, 3, 4, 5, 6]);
  };

  const generateBulkSlots = () => {
    if (!bulkStartDate || !bulkEndDate || selectedDows.length === 0) {
      showToast('期間と曜日を指定してね！', 'info');
      return;
    }
    if (!bulkIsAllDay && (!bulkStart || !bulkEnd)) {
      showToast('時間を指定するか、終日にチェックを入れてね！', 'info');
      return;
    }

    const start = new Date(bulkStartDate);
    const end = new Date(bulkEndDate);
    if (start > end) {
      showToast('終了日は開始日より後に設定してね！', 'error');
      return;
    }

    const interval = parseInt(bulkInterval);
    const newBlocks: DayBlock[] = [...dayBlocks];

    let currentDate = start;
    while (currentDate <= end) {
      if (selectedDows.includes(currentDate.getDay())) {
        const dateStr = format(currentDate, 'yyyy-MM-dd');
        const existingBlock = newBlocks.find(b => b.date === dateStr);

        if (bulkIsAllDay) {
          if (existingBlock) {
            existingBlock.isAllDay = true;
          } else {
            newBlocks.push({
              id: generateId(),
              date: dateStr,
              isAllDay: true,
              isExpanded: true,
              times: [{ id: generateId(), start: '', end: '' }],
            });
          }
        } else {
          const generatedTimes: TimeSlot[] = [];
          const dayStart = new Date(`${dateStr}T${bulkStart}`);
          const dayEnd = new Date(`${dateStr}T${bulkEnd}`);
          let currentSlot = dayStart;
          while (currentSlot < dayEnd) {
            const nextSlot = addMinutes(currentSlot, interval);
            if (nextSlot > dayEnd) break;
            generatedTimes.push({ id: generateId(), start: format(currentSlot, 'HH:mm'), end: format(nextSlot, 'HH:mm') });
            currentSlot = nextSlot;
          }

          if (existingBlock) {
            const validExistingTimes = existingBlock.times.filter(t => t.start && t.end);
            existingBlock.times = [...validExistingTimes, ...generatedTimes];
            existingBlock.isAllDay = false;
          } else {
            const mem = dayMemory[dateStr];
            const baseTimes = mem ? mem.times.filter(t => t.start && t.end) : [];
            newBlocks.push({
              id: generateId(),
              date: dateStr,
              isAllDay: false,
              isExpanded: true,
              times: [...baseTimes, ...generatedTimes],
            });
          }
        }
      }
      currentDate = addDays(currentDate, 1);
    }

    newBlocks.sort((a, b) => a.date.localeCompare(b.date));
    setDayBlocks(newBlocks);
    setIsBulkOpen(false);
    showToast('条件に合う日程枠を追加しました✨', 'success');
  };

  const scrollToTop = () => {
    const scrollContainer = document.getElementById('app-scroll-container');
    if (scrollContainer) scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
    else window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const calendarDays = eachDayOfInterval({ start: startOfMonth(calendarMonth), end: endOfMonth(calendarMonth) });
  const firstDayOfWeek = calendarDays[0].getDay();
  const paddingDays = Array.from({ length: firstDayOfWeek }).map((_, i) => i);

  // 変更前との差分をリアルタイム計算
  const diffSummary = useMemo(() => {
    const flatSlots: { startAt: string; endAt: string }[] = [];
    dayBlocks.forEach(block => {
      if (block.date) {
        if (block.isAllDay) {
          flatSlots.push({ startAt: `${block.date}T00:00`, endAt: `${block.date}T23:59` });
        } else {
          block.times.forEach(t => {
            if (t.start && t.end) flatSlots.push({ startAt: `${block.date}T${t.start}`, endAt: `${block.date}T${t.end}` });
          });
        }
      }
    });

    const oldKeys = oldSlots.map(s => `${s.start_at}_${s.end_at}`);
    const newSlotsFormatted = flatSlots.map(s => ({
      event_id: eventId,
      start_at: `${s.startAt}:00+00:00`,
      end_at: `${s.endAt}:00+00:00`,
    }));
    const newKeys = newSlotsFormatted.map(s => `${s.start_at}_${s.end_at}`);

    const toInsert = newSlotsFormatted.filter(s => !oldKeys.includes(`${s.start_at}_${s.end_at}`));
    const toDeleteIds = oldSlots.filter(s => !newKeys.includes(`${s.start_at}_${s.end_at}`)).map(s => s.id);
    const keptCount = oldSlots.length - toDeleteIds.length;
    const isInfoChanged = title !== initialTitle || description !== initialDescription;

    return {
      flatSlots,
      toInsert,
      toDeleteIds,
      addedCount: toInsert.length,
      removedCount: toDeleteIds.length,
      keptCount,
      isInfoChanged,
    };
  }, [dayBlocks, oldSlots, eventId, title, initialTitle, description, initialDescription]);

  const totalSlotsCount = diffSummary.flatSlots.length;
  const isReady = Boolean(title.trim()) && totalSlotsCount > 0;
  const hasSlotChanges = diffSummary.addedCount > 0 || diffSummary.removedCount > 0;

  // 安全な保存処理（変更分だけをDBに送る）
  const handleSave = async () => {
    if (!title.trim() || totalSlotsCount === 0) {
      showToast('イベント名と少なくとも1つの日程を入力してね！', 'error');
      return;
    }
    setSaving(true);

    try {
      if (diffSummary.toDeleteIds.length > 0) {
        await supabase.from('slots').delete().in('id', diffSummary.toDeleteIds);
      }
      if (diffSummary.toInsert.length > 0) {
        await supabase.from('slots').insert(diffSummary.toInsert);
      }
      await supabase.from('events').update({ title: title.trim(), description }).eq('id', eventId);

      router.push(`/event/${eventId}`);
    } catch {
      showToast('保存中にエラーが発生しました💦', 'error');
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 text-gray-500 dark:text-gray-400">
        <Loader2 size={34} className="animate-spin text-blue-600 dark:text-blue-400" />
        <p className="text-sm font-bold tracking-wide">イベント情報を読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto p-4 mt-4 space-y-5 pb-36 [overflow-anchor:none]">
      {/* トースト通知 */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-md pointer-events-none animate-fade-in">
          <div
            className={`px-4 py-3 rounded-xl shadow-lg border font-bold text-sm flex items-center justify-center gap-2 text-center backdrop-blur-md ${
              toast.type === 'error'
                ? 'bg-red-600/95 text-white border-red-500'
                : toast.type === 'info'
                ? 'bg-gray-900/95 dark:bg-gray-100/95 text-white dark:text-gray-900 border-gray-700'
                : 'bg-green-600/95 text-white border-green-500'
            }`}
          >
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* ヘッダー */}
      <div className="flex items-center justify-between px-1">
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center gap-1.5 text-sm bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 px-3.5 py-2 rounded-lg font-bold hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors shadow-sm"
        >
          <ArrowLeft size={16} /> 戻る
        </button>
        <h1 className="text-xl font-extrabold text-gray-800 dark:text-gray-100 tracking-tight">✏️ イベント編集</h1>
        <div className="w-16" />
      </div>

      {/* メイン編集カード（CreateEventTabとデザイン統一） */}
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-md px-6 pb-6 relative">
        {/* 上部の青いアクセントバー（Sticky固定） */}
        <div className="sticky top-0 z-30 -mx-6 bg-white dark:bg-[#0a0a0a]">
          <div className="h-3 bg-white dark:bg-gray-900 border-t-4 border-t-blue-500 dark:border-t-blue-500 rounded-t-xl" />
        </div>

        <div className="space-y-6 pt-3">
          {/* イベント名＆メモ */}
          <div className="space-y-4">
            <div>
              <label className="block text-base font-extrabold text-gray-800 dark:text-gray-100 mb-1.5">
                イベント名 *
              </label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full p-2.5 border dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="例: BNS合同練習"
              />
            </div>
            <div>
              <label className="block text-sm font-bold mb-1 dark:text-gray-300">メモ（任意）</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="w-full p-2 border dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded focus:ring-2 focus:ring-blue-500 outline-none h-20 resize-none"
                placeholder="場所や持ち物、補足情報など"
              />
            </div>
          </div>

          {/* 期間と曜日で一括追加 */}
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800/30 overflow-hidden shadow-sm transition-all">
            <button
              type="button"
              onClick={() => setIsBulkOpen(!isBulkOpen)}
              className="w-full flex items-center justify-between p-4 bg-blue-100/50 dark:bg-blue-900/40 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors"
            >
              <div className="flex items-center gap-2 text-blue-800 dark:text-blue-300 font-bold">
                <CalendarDays size={18} />
                <span>期間と曜日で一括追加</span>
              </div>
              <div className="text-blue-600 dark:text-blue-400 bg-white/50 dark:bg-gray-800/50 p-1 rounded-full">
                {isBulkOpen ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
              </div>
            </button>

            {isBulkOpen && (
              <div className="p-4 space-y-4 border-t border-blue-200/50 dark:border-blue-800/30">
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={bulkStartDate}
                    onChange={e => setBulkStartDate(e.target.value)}
                    className="p-2 border dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 rounded text-sm flex-1 outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-gray-500">〜</span>
                  <input
                    type="date"
                    value={bulkEndDate}
                    onChange={e => setBulkEndDate(e.target.value)}
                    className="p-2 border dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 rounded text-sm flex-1 outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex gap-2 flex-wrap items-center">
                  {DOW_LABELS.map(dow => (
                    <button
                      key={dow.val}
                      type="button"
                      onClick={() => toggleDow(dow.val)}
                      className={`w-10 h-10 rounded-full font-bold text-sm border transition-colors ${
                        selectedDows.includes(dow.val)
                          ? 'bg-blue-500 text-white border-blue-500'
                          : 'bg-white dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                      }`}
                    >
                      {dow.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={toggleEveryday}
                    className={`ml-2 px-3 py-2 rounded-full font-bold text-sm border transition-colors ${
                      selectedDows.length === 7
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700 dark:border-gray-700'
                    }`}
                  >
                    毎日
                  </button>
                </div>

                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="checkbox"
                    id="editBulkAllDay"
                    checked={bulkIsAllDay}
                    onChange={e => setBulkIsAllDay(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                  />
                  <label htmlFor="editBulkAllDay" className="text-sm font-bold text-gray-700 dark:text-gray-300 cursor-pointer">
                    時間を指定せず「終日」にする
                  </label>
                </div>

                {!bulkIsAllDay && (
                  <div className="flex items-center gap-2 bg-white dark:bg-gray-800 p-2 rounded border dark:border-gray-700">
                    <input
                      type="time"
                      value={bulkStart}
                      onChange={e => setBulkStart(e.target.value)}
                      className="p-1 border-b dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 text-sm flex-1 outline-none"
                    />
                    <span className="text-gray-500">〜</span>
                    <input
                      type="time"
                      value={bulkEnd}
                      onChange={e => setBulkEnd(e.target.value)}
                      className="p-1 border-b dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 text-sm flex-1 outline-none"
                    />
                    <select
                      value={bulkInterval}
                      onChange={e => setBulkInterval(e.target.value)}
                      className="p-1 border-l dark:border-gray-600 pl-2 text-sm flex-1 text-gray-600 dark:text-gray-300 dark:bg-gray-800 outline-none"
                    >
                      <option value="60">60分枠</option>
                      <option value="90">90分枠</option>
                      <option value="120">2時間枠</option>
                      <option value="180">3時間枠</option>
                    </select>
                  </div>
                )}
                <button
                  type="button"
                  onClick={generateBulkSlots}
                  className="w-full py-3 bg-blue-600 text-white font-bold rounded-lg shadow-sm hover:bg-blue-700 transition mt-2"
                >
                  条件に合う枠を一気に追加する
                </button>
              </div>
            )}
          </div>

          {/* Sticky見出し＋全クリアボタン */}
          <div>
            <div className="sticky top-3 z-20 -mx-6 px-6 pt-1 pb-2.5 mb-4 bg-white dark:bg-gray-900 border-b border-b-gray-100 dark:border-b-gray-800 shadow-[0_2px_4px_-2px_rgba(0,0,0,0.06)] flex justify-between items-center gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <h2 className="font-bold text-base sm:text-lg dark:text-gray-100 whitespace-nowrap">日程の編集</h2>
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full whitespace-nowrap">
                  {totalSlotsCount}枠
                </span>
              </div>
              {dayBlocks.length > 0 && (
                <button
                  type="button"
                  onClick={clearAllDayBlocks}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-red-600 dark:text-red-400 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 border border-red-200 dark:border-red-800/50 rounded-md transition whitespace-nowrap"
                >
                  <Trash2 size={13} />
                  <span>全クリア</span>
                </button>
              )}
            </div>

            {/* カレンダーから日付追加 */}
            <div className="mb-6">
              <button
                type="button"
                onClick={() => setShowCalendar(!showCalendar)}
                className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold border transition-colors ${
                  showCalendar
                    ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800/50 text-blue-600 dark:text-blue-400'
                    : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <CalendarIcon size={18} /> {showCalendar ? 'カレンダーを閉じる' : '日付を追加する'}
              </button>

              {showCalendar && (
                <div className="mt-3 p-4 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-xl shadow-sm animate-fade-in">
                  <div className="flex justify-between items-center mb-4 px-2">
                    <button
                      type="button"
                      onClick={() => setCalendarMonth(subMonths(calendarMonth, 1))}
                      className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full dark:text-gray-200"
                    >
                      <ChevronLeft size={20} />
                    </button>
                    <span className="font-bold dark:text-gray-100">{format(calendarMonth, 'yyyy年 M月')}</span>
                    <button
                      type="button"
                      onClick={() => setCalendarMonth(addMonths(calendarMonth, 1))}
                      className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full dark:text-gray-200"
                    >
                      <ChevronRight size={20} />
                    </button>
                  </div>
                  <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-gray-500 dark:text-gray-400 mb-2">
                    {['日', '月', '火', '水', '木', '金', '土'].map(d => (
                      <div key={d}>{d}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {paddingDays.map(d => (
                      <div key={`pad-${d}`} />
                    ))}
                    {calendarDays.map(d => {
                      const dateStr = format(d, 'yyyy-MM-dd');
                      const isSelected = dayBlocks.some(b => b.date === dateStr);
                      const isToday = isSameDay(d, new Date());
                      return (
                        <button
                          key={dateStr}
                          type="button"
                          onClick={() => toggleCalendarDate(dateStr)}
                          className={`aspect-square flex items-center justify-center rounded-full text-sm transition-colors ${
                            isSelected
                              ? 'bg-blue-500 text-white font-bold shadow-md transform scale-105'
                              : isToday
                              ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-bold border border-blue-200 dark:border-blue-800/50'
                              : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                          }`}
                        >
                          {format(d, 'd')}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-center text-gray-500 dark:text-gray-400 mt-4">
                    日付をタップすると、その日のブロックが追加/削除されます
                  </p>
                </div>
              )}
            </div>

            {/* 日付ブロック一覧 */}
            <div className="space-y-4">
              {dayBlocks.map(block => (
                <div
                  key={block.id}
                  className="border dark:border-gray-700 rounded-xl overflow-hidden shadow-sm bg-white dark:bg-gray-800 transition-all hover:border-blue-300 dark:hover:border-blue-700"
                >
                  <div className="bg-blue-50 dark:bg-blue-900/20 px-3 sm:px-4 py-3 border-b dark:border-gray-700 flex justify-between items-center gap-2 transition-colors">
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0">
                      <button
                        type="button"
                        onClick={() => toggleDayExpanded(block.id)}
                        className="p-1 hover:bg-blue-100 dark:hover:bg-blue-800 rounded text-blue-600 dark:text-blue-400 shrink-0"
                      >
                        {block.isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                      </button>
                      <input
                        type="date"
                        value={block.date}
                        onChange={e => updateDayBlockDate(block.id, e.target.value)}
                        className="font-bold text-sm sm:text-base text-blue-800 dark:text-blue-300 bg-transparent border-none outline-none focus:ring-0 cursor-pointer w-[7.5rem] sm:w-32 shrink-0"
                      />
                      <span className="text-sm font-bold text-blue-600 dark:text-blue-400 hidden sm:inline shrink-0">
                        ({format(new Date(block.date ? `${block.date}T00:00:00` : new Date()), 'E', { locale: ja })})
                      </span>

                      <label className="ml-1 sm:ml-2 flex items-center gap-1 text-xs font-bold text-blue-700 dark:text-blue-300 cursor-pointer bg-white/50 dark:bg-gray-800 px-2 py-1 rounded border border-blue-200 dark:border-blue-800/50 whitespace-nowrap shrink-0">
                        <input
                          type="checkbox"
                          checked={block.isAllDay}
                          onChange={e => toggleDayAllDay(block.id, e.target.checked)}
                          className="w-3 h-3 text-blue-600"
                        />
                        終日
                      </label>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeDayBlock(block.id)}
                      className="text-red-400 hover:text-red-600 transition p-1 shrink-0"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>

                  {block.isExpanded && (
                    <div className="p-3 bg-white dark:bg-gray-800">
                      {block.isAllDay ? (
                        <div className="text-center py-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 text-blue-600 dark:text-blue-400 font-bold text-sm">
                          🌟 終日 (0:00〜23:59) で設定されています
                          <p className="text-xs text-gray-400 font-normal mt-1">
                            ※チェックを外すと記憶していた個別の時間枠に戻ります
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {block.times.length === 0 ? (
                            <p className="text-xs text-gray-400 text-center py-2">時間が設定されていません</p>
                          ) : (
                            block.times.map(time => (
                              <div
                                key={time.id}
                                className="flex items-center gap-3 bg-gray-50 dark:bg-gray-900 p-2 rounded-lg border dark:border-gray-700 group"
                              >
                                <div className="flex items-center gap-2 flex-1 pl-2">
                                  <input
                                    type="time"
                                    value={time.start}
                                    onChange={e => updateTimeSlot(block.id, time.id, 'start', e.target.value)}
                                    className="p-1 border dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded text-sm flex-1 outline-none focus:ring-1 focus:ring-blue-500"
                                  />
                                  <span className="text-gray-400 text-xs">〜</span>
                                  <input
                                    type="time"
                                    value={time.end}
                                    onChange={e => updateTimeSlot(block.id, time.id, 'end', e.target.value)}
                                    className="p-1 border dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded text-sm flex-1 outline-none focus:ring-1 focus:ring-blue-500"
                                  />
                                </div>
                                <button
                                  type="button"
                                  onClick={() => removeTimeSlot(block.id, time.id)}
                                  className="text-gray-300 hover:text-red-500 p-1"
                                >
                                  <X size={16} />
                                </button>
                              </div>
                            ))
                          )}
                          <button
                            type="button"
                            onClick={() => addTimeSlot(block.id)}
                            className="w-full py-2 text-sm font-bold text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-900/10 hover:bg-blue-100 dark:hover:bg-blue-900/30 border border-blue-100 dark:border-blue-800/30 rounded-lg transition-colors flex items-center justify-center gap-1 mt-2"
                          >
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
                <p className="text-gray-500 dark:text-gray-400 font-bold mb-1">日付がありません</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
                  上の「期間と曜日で一括追加」やカレンダーから日程を追加してね
                </p>
                <button
                  type="button"
                  onClick={() => addDayBlock()}
                  className="px-4 py-2 bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 text-sm font-bold rounded-lg shadow-sm border dark:border-gray-600"
                >
                  今日を追加する
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* トップへ戻るボタン */}
      <button
        type="button"
        onClick={scrollToTop}
        aria-hidden={!showScrollTop}
        tabIndex={showScrollTop ? 0 : -1}
        className={`fixed bottom-28 right-6 p-4 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg transition-all duration-200 z-40 ${
          showScrollTop ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
      >
        <ArrowUp size={24} />
      </button>

      {/* 下部固定の保存バー（セーフエリア対応 ＋ 変更差分プレビュー付き） */}
      <div className="fixed bottom-0 left-0 right-0 px-4 pt-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-t border-gray-200 dark:border-gray-700 shadow-[0_-4px_12px_rgba(0,0,0,0.12)] z-40">
        <div className="max-w-xl mx-auto space-y-2">
          {hasSlotChanges && (
            <div className="text-center text-[11px] sm:text-xs font-bold text-gray-600 dark:text-gray-300 bg-blue-50/80 dark:bg-blue-900/25 border border-blue-200/70 dark:border-blue-800/40 rounded-lg py-1.5 px-2.5">
              <span>✨ </span>
              {diffSummary.addedCount > 0 && (
                <span className="text-green-700 dark:text-green-400">追加 +{diffSummary.addedCount}枠</span>
              )}
              {diffSummary.addedCount > 0 && diffSummary.removedCount > 0 && <span className="mx-1">/</span>}
              {diffSummary.removedCount > 0 && (
                <span className="text-red-600 dark:text-red-400">削除 -{diffSummary.removedCount}枠</span>
              )}
              <span className="text-gray-500 dark:text-gray-400 ml-1">
                （変更のない {diffSummary.keptCount}枠 の回答データは維持されます）
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !isReady}
            className={`w-full py-3 px-6 font-bold text-base rounded-xl shadow-md transition-all flex items-center justify-center gap-2 ${
              isReady && !saving
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed'
            }`}
          >
            {saving ? <Loader2 size={20} className="animate-spin" /> : <CheckCircle2 size={20} />}
            <span>{saving ? '保存中...' : '変更を保存する'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
