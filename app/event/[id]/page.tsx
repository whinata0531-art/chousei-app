'use client';

import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { use } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronRight, Pin, CalendarCheck, History, CalendarDays, Trash2, Settings, Home, ArrowUp, Edit3, Check } from 'lucide-react'; // 💡 新しいアイコン追加！

type Slot = { id: string; start_at: string; end_at: string; is_confirmed: boolean };
type Status = 'maru' | 'sankaku' | 'batsu';
type PastAvailability = { status: Status; updated: number };

type AggregatedSlot = Slot & { maru: number; sankaku: number; batsu: number; total: number; originalIndex: number; };
type MatrixData = { guestId: string; guestName: string; answers: Record<string, string>; };

type ConfirmedSchedule = { id: string; event_id: string; start_at: string; end_at: string; eventTitle: string };
type RecentEvent = { id: string; title: string; lastAccessed: number };

type RoutineSlot = { id: string; isAllDay: boolean; start: string; end: string; status: Status };
type WeeklyRoutine = Record<number, RoutineSlot[]>;

const getFixedDate = (dbDateStr: string) => new Date(dbDateStr.substring(0, 16));

const formatSlotTime = (startStr: string, endStr: string) => {
  const sTime = format(getFixedDate(startStr), 'HH:mm');
  const eTime = format(getFixedDate(endStr), 'HH:mm');
  if (sTime === '00:00' && eTime === '23:59') return '終日';
  return `${sTime} 〜 ${eTime}`;
};

export default function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = use(params);
  const [activeTab, setActiveTab] = useState<'response' | 'result' | 'my-schedule'>('response');
  const [event, setEvent] = useState<any>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);

  const [deviceGuestId, setDeviceGuestId] = useState('');
  const [guestName, setGuestName] = useState('');
  const [answers, setAnswers] = useState<Record<string, Status>>({});
  const [pastAvailabilities, setPastAvailabilities] = useState<Record<string, PastAvailability>>({});

  const [aggregated, setAggregated] = useState<AggregatedSlot[]>([]);
  const [matrix, setMatrix] = useState<MatrixData[]>([]);
  const [sortType, setSortType] = useState('time');
  const [hideBatsu, setHideBatsu] = useState(false);
  const [isSummaryOpen, setIsSummaryOpen] = useState(true); 

  const [mySchedules, setMySchedules] = useState<ConfirmedSchedule[]>([]);
  const [fetchingSchedules, setFetchingSchedules] = useState(false);
  const [recentEvents, setRecentEvents] = useState<RecentEvent[]>([]);

  const [showScrollTop, setShowScrollTop] = useState(false); // 💡 スクロールボタン用
  
  // 💡 タイトル編集用
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitleStr, setEditTitleStr] = useState('');

  useEffect(() => {
    const fetchAll = async () => {
      let currentGuestId = localStorage.getItem('deviceGuestId');
      if (!currentGuestId) {
        currentGuestId = crypto.randomUUID();
        localStorage.setItem('deviceGuestId', currentGuestId);
      }
      setDeviceGuestId(currentGuestId);

      fetchMySchedules(currentGuestId);
      fetchRecentEvents(currentGuestId);

      const { data: eData } = await supabase.from('events').select('*').eq('id', eventId).single();
      const { data: sData } = await supabase.from('slots').select('*').eq('event_id', eventId).order('start_at');
      
      if (eData) {
        setEvent(eData);
        await supabase.from('user_recent_events').upsert({ guest_id: currentGuestId, event_id: eventId, event_title: eData.title, accessed_at: Date.now() }, { onConflict: 'guest_id,event_id' });
      }
      
      if (sData) {
        setSlots(sData);
        const initialAnswers: Record<string, Status> = {};
        sData.forEach(s => initialAnswers[s.id] = 'maru'); 

        const { data: existingResponse } = await supabase.from('responses').select('id, guest_name').eq('event_id', eventId).eq('guest_id', currentGuestId).single();

        let loadedAnswers = { ...initialAnswers };

        if (existingResponse) {
          setGuestName(existingResponse.guest_name);
          const { data: aData } = await supabase.from('availabilities').select('slot_id, status').eq('response_id', existingResponse.id);
          if (aData) {
            aData.forEach(a => loadedAnswers[a.slot_id] = a.status as Status);
            setAnswers(loadedAnswers);
          }
        } else {
          const savedName = localStorage.getItem('lastGuestName');
          if (savedName) setGuestName(savedName);
          setAnswers(loadedAnswers);
        }

        const { data: copies } = await supabase.from('user_smart_copies').select('*').eq('guest_id', currentGuestId);
        if (copies) {
          const parsed: Record<string, PastAvailability> = {};
          copies.forEach((c: any) => parsed[c.time_key] = { status: c.status as Status, updated: c.updated_at });
          setPastAvailabilities(parsed);
        }

        const confirmedSlots = sData.filter(s => s.is_confirmed);
        if (confirmedSlots.length > 0 && existingResponse) {
          const copyUpserts: any[] = [];
          const now = Date.now();
          confirmedSlots.forEach(slot => {
            if (loadedAnswers[slot.id] === 'maru' || loadedAnswers[slot.id] === 'sankaku') {
              copyUpserts.push({ guest_id: currentGuestId, time_key: `${slot.start_at}_${slot.end_at}`, status: 'batsu', updated_at: now });
            }
          });
          if (copyUpserts.length > 0) await supabase.from('user_smart_copies').upsert(copyUpserts, { onConflict: 'guest_id,time_key' });
        }
      }

      if (sData) await fetchStats(sData);
      setLoading(false);
    };
    fetchAll();

    const handleScroll = () => setShowScrollTop(window.scrollY > 300);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [eventId]);

  const fetchRecentEvents = async (guestId: string) => {
    const { data } = await supabase.from('user_recent_events').select('*').eq('guest_id', guestId).order('accessed_at', { ascending: false }).limit(10);
    if (data) setRecentEvents(data.map((d: any) => ({ id: d.event_id, title: d.event_title, lastAccessed: d.accessed_at })));
  };

  const fetchStats = async (currentSlots: Slot[]) => {
    const { data: responses } = await supabase.from('responses').select('*').eq('event_id', eventId).order('created_at');
    if (!responses) return;
    const resIds = responses.map(r => r.id);
    const { data: avails } = await supabase.from('availabilities').select('*').in('response_id', resIds);

    let stats = currentSlots.map((slot, index) => {
      const slotAvails = avails?.filter(a => a.slot_id === slot.id) || [];
      return {
        ...slot,
        maru: slotAvails.filter(a => a.status === 'maru').length,
        sankaku: slotAvails.filter(a => a.status === 'sankaku').length,
        batsu: slotAvails.filter(a => a.status === 'batsu').length,
        total: slotAvails.length,
        originalIndex: index,
      };
    });
    setAggregated(stats);

    const matrixData: MatrixData[] = responses.map(res => {
      const userAvails = avails?.filter(a => a.response_id === res.id) || [];
      const userAnswers: Record<string, string> = {};
      userAvails.forEach(a => userAnswers[a.slot_id] = a.status);
      return { guestId: res.guest_id, guestName: res.guest_name, answers: userAnswers };
    });
    setMatrix(matrixData);
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

  const toggleConfirmSlot = async (slotId: string, currentIsConfirmed: boolean) => {
    if (!confirm(currentIsConfirmed ? 'この日程の仮確定を解除しますか？' : 'この日程を仮確定にしますか？\n（マイページに反映され、他イベントのスマートコピーでは❌になります）')) return;
    setLoading(true);
    await supabase.from('slots').update({ is_confirmed: !currentIsConfirmed }).eq('id', slotId);
    window.location.reload(); 
  };

  const applyWeeklyRoutine = () => {
    const savedRoutine = localStorage.getItem('weeklyRoutine');
    if (!savedRoutine) {
      return alert('「⚙️設定」から固定シフトを登録してね！');
    }
    const routine: WeeklyRoutine = JSON.parse(savedRoutine);
    const newAnswers = { ...answers };
    let appliedCount = 0;

    slots.forEach(slot => {
      const slotDate = getFixedDate(slot.start_at);
      const dow = slotDate.getDay();
      const rSlots = routine[dow] || [];
      if (rSlots.length === 0) return;

      const sStart = slotDate.getTime();
      const sEnd = getFixedDate(slot.end_at).getTime();
      const baseDateStr = slot.start_at.substring(0, 10); 

      const overlaps: { start: number; end: number; status: Status }[] = [];

      rSlots.forEach(rs => {
        const pStart = rs.isAllDay ? new Date(`${baseDateStr}T00:00:00`).getTime() : new Date(`${baseDateStr}T${rs.start}:00`).getTime();
        const pEnd = rs.isAllDay ? new Date(`${baseDateStr}T23:59:00`).getTime() : new Date(`${baseDateStr}T${rs.end}:00`).getTime();
        if (Math.max(sStart, pStart) < Math.min(sEnd, pEnd)) {
          overlaps.push({ start: pStart, end: pEnd, status: rs.status });
        }
      });

      if (overlaps.length > 0) {
        let hasBatsu = false;
        let hasSankaku = false;
        let allCovered = true;
        let anyCovered = false;

        for (let t = sStart; t < sEnd; t += 60000) {
          const coveringPast = overlaps.find(o => o.start <= t && t < o.end);
          if (coveringPast) {
            anyCovered = true;
            if (coveringPast.status === 'batsu') hasBatsu = true;
            if (coveringPast.status === 'sankaku') hasSankaku = true;
          } else {
            allCovered = false; 
          }
        }

        if (anyCovered) {
          if (hasBatsu) { newAnswers[slot.id] = 'batsu'; appliedCount++; }
          else if (hasSankaku) { newAnswers[slot.id] = 'sankaku'; appliedCount++; }
          else if (allCovered) { newAnswers[slot.id] = 'maru'; appliedCount++; }
        }
      }
    });

    if (appliedCount === 0) alert('候補日程に合致するシフト設定がありませんでした。');
    else { setAnswers(newAnswers); alert(`設定したシフトを ${appliedCount} 件の日程に反映したよ！`); }
  };

  const applySmartCopy = () => {
    const newAnswers = { ...answers };
    let appliedCount = 0;

    slots.forEach(slot => {
      const sStart = getFixedDate(slot.start_at).getTime();
      const sEnd = getFixedDate(slot.end_at).getTime();

      const overlaps: { start: number; end: number; status: Status; updated: number }[] = [];
      Object.entries(pastAvailabilities).forEach(([key, past]) => {
        const [pStartStr, pEndStr] = key.split('_');
        const pStart = getFixedDate(pStartStr).getTime();
        const pEnd = getFixedDate(pEndStr).getTime();
        
        if (Math.max(sStart, pStart) < Math.min(sEnd, pEnd)) {
          overlaps.push({ start: pStart, end: pEnd, status: past.status, updated: past.updated });
        }
      });

      if (overlaps.length > 0) {
        overlaps.sort((a, b) => b.updated - a.updated);

        let hasBatsu = false;
        let hasSankaku = false;
        let allCovered = true;
        let anyCovered = false;

        for (let t = sStart; t < sEnd; t += 60000) {
          const coveringPast = overlaps.find(o => o.start <= t && t < o.end);
          if (coveringPast) {
            anyCovered = true;
            if (coveringPast.status === 'batsu') hasBatsu = true;
            if (coveringPast.status === 'sankaku') hasSankaku = true;
          } else {
            allCovered = false;
          }
        }

        if (anyCovered) {
          if (hasBatsu) { newAnswers[slot.id] = 'batsu'; appliedCount++; }
          else if (hasSankaku) { newAnswers[slot.id] = 'sankaku'; appliedCount++; }
          else if (allCovered) { newAnswers[slot.id] = 'maru'; appliedCount++; }
        }
      }
    });

    setAnswers(newAnswers);
    alert(`クラウドの予定を優先して ${appliedCount} 件の回答を推測したよ！\n※念のためズレがないか確認してね！`);
  };

  const handleSubmit = async () => {
    if (!guestName) return alert('名前を入力してね！');
    setLoading(true);

    const { data: resData } = await supabase
      .from('responses')
      .upsert({ event_id: eventId, guest_id: deviceGuestId, guest_name: guestName, updated_at: new Date().toISOString() }, { onConflict: 'event_id,guest_id' })
      .select('id').single();

    if (resData) {
      await supabase.from('availabilities').delete().eq('response_id', resData.id);
      const avails = Object.entries(answers).map(([slotId, status]) => ({ response_id: resData.id, slot_id: slotId, status }));
      await supabase.from('availabilities').insert(avails);

      const now = Date.now();
      const copyUpserts = slots.map(slot => ({ guest_id: deviceGuestId, time_key: `${slot.start_at}_${slot.end_at}`, status: answers[slot.id], updated_at: now }));
      await supabase.from('user_smart_copies').upsert(copyUpserts, { onConflict: 'guest_id,time_key' });

      localStorage.setItem('lastGuestName', guestName);
      alert('回答を保存しました！🎉\nクラウドに同期されたよ！');
      await fetchStats(slots);
      await fetchMySchedules(deviceGuestId);
      setActiveTab('result');
    }
    setLoading(false);
  };

  const handleDeleteEvent = async () => {
    if (!confirm('【警告】\n本当にこのイベントを完全に削除しますか？\n全員の回答データも消滅し、二度と復元できません！！')) return;
    setLoading(true);
    await supabase.from('events').delete().eq('id', eventId);
    alert('イベントを完全に削除しました。');
    window.location.href = '/'; 
  };

  // 💡 上に戻る処理
  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  // 💡 タイトル保存処理
  const handleSaveTitle = async () => {
    if (!editTitleStr.trim()) return alert('タイトルを入力してください');
    setLoading(true);
    await supabase.from('events').update({ title: editTitleStr }).eq('id', eventId);
    setEvent({ ...event, title: editTitleStr });
    setIsEditingTitle(false);
    setLoading(false);
  };

  const sortedAndFilteredSlots = useMemo(() => {
    let result = [...aggregated];
    if (hideBatsu) result = result.filter(s => s.batsu === 0);
    result.sort((a, b) => {
      if (a.is_confirmed && !b.is_confirmed) return -1;
      if (!a.is_confirmed && b.is_confirmed) return 1;

      if (sortType === 'time') {
        return getFixedDate(a.start_at).getTime() - getFixedDate(b.start_at).getTime();
      } else if (sortType === 'maru') {
        if (b.maru !== a.maru) return b.maru - a.maru;
        if (b.sankaku !== a.sankaku) return b.sankaku - a.sankaku;
        return getFixedDate(a.start_at).getTime() - getFixedDate(b.start_at).getTime();
      } else if (sortType === 'batsu') {
        if (a.batsu !== b.batsu) return a.batsu - b.batsu;
        if (b.maru !== a.maru) return b.maru - a.maru;
        return getFixedDate(a.start_at).getTime() - getFixedDate(b.start_at).getTime();
      }
      return 0;
    });
    return result;
  }, [aggregated, hideBatsu, sortType]);

  const getStatusIcon = (s: string) => s === 'maru' ? '⭕️' : s === 'sankaku' ? '🔺' : s === 'batsu' ? '❌' : '-';

  const validAggregated = aggregated.filter(s => s.total > 0);
  const maxMaru = validAggregated.length > 0 ? Math.max(...validAggregated.map(s => s.maru)) : 0;

  const getSlotTier = (slot: AggregatedSlot) => {
    if (slot.total === 0) return 0;
    if (slot.batsu === 0 && slot.maru > 0 && slot.maru === maxMaru) return 1; 
    if (slot.batsu === 0) return 2; 
    return 0;
  };

  if (loading) return <div className="text-center mt-20">読み込み中...</div>;
  if (!event) return <div className="text-center mt-20 text-red-500 font-bold">イベントが見つかりません（削除された可能性があります）</div>;

  const confirmedSlots = slots.filter(s => s.is_confirmed);
  const isEventConfirmed = confirmedSlots.length > 0;
  
  const isHost = event.host_id === deviceGuestId;

  return (
    <div className="max-w-2xl mx-auto p-4 mt-4 space-y-6 pb-20">
      <div className="flex justify-between items-center mb-4">
        <Link href="/" className="flex items-center gap-1 text-sm bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 px-4 py-2 rounded-lg font-bold hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors shadow-sm">
          <Home size={16} /> トップへ
        </Link>
        <Link href="/settings" className="flex items-center gap-1 text-sm bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 px-4 py-2 rounded-lg font-bold hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors shadow-sm border border-gray-200 dark:border-gray-700">
          <Settings size={16} /> 設定
        </Link>
      </div>

      <div className="text-center mb-6">
        {/* 💡 タイトル編集機能の追加！ */}
        {isHost && isEditingTitle ? (
          <div className="flex items-center justify-center gap-2 mb-2">
            <input type="text" value={editTitleStr} onChange={e => setEditTitleStr(e.target.value)} className="p-2 border rounded-lg text-xl font-bold text-gray-800 dark:text-gray-100 dark:bg-gray-800 outline-none focus:ring-2 focus:ring-blue-500" />
            <button onClick={handleSaveTitle} className="p-2 bg-green-500 hover:bg-green-600 text-white rounded-lg shadow-sm transition">
              <Check size={20}/>
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 mb-2 group">
            <h1 className="text-3xl font-bold text-gray-800 dark:text-blue-400">{event.title}</h1>
            {isHost && (
              <button onClick={() => { setEditTitleStr(event.title); setIsEditingTitle(true); }} className="text-gray-400 hover:text-blue-500 opacity-0 group-hover:opacity-100 transition p-1">
                <Edit3 size={20} />
              </button>
            )}
          </div>
        )}
        {event.description && <p className="text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{event.description}</p>}
      </div>

      {isEventConfirmed && activeTab !== 'my-schedule' && (
        <div className="bg-yellow-50 border-4 border-yellow-400 p-6 rounded-2xl shadow-md text-center">
          <div className="flex items-center justify-center gap-2 text-yellow-600 mb-2">
            <Pin size={24} />
            <h2 className="text-xl font-extrabold">仮確定の日程があります！</h2>
          </div>
          <div className="bg-white rounded-lg p-3 inline-block shadow-sm">
            {confirmedSlots.map(s => (
              <div key={s.id} className="text-lg font-bold text-gray-800">
                {format(getFixedDate(s.start_at), 'M/d (E)', { locale: ja })} {formatSlotTime(s.start_at, s.end_at)}
              </div>
            ))}
          </div>
          <p className="text-xs text-yellow-700 mt-4 font-bold">
            ※マイ予定タブに追加されました！<br />
            ※他イベントのスマートコピーでは自動的に「予定あり❌」になります。
          </p>
        </div>
      )}

      <div className="flex bg-gray-200 dark:bg-gray-800 rounded-lg p-1 sticky top-4 z-30 shadow">
        <button onClick={() => setActiveTab('response')} className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-md transition-all ${activeTab === 'response' ? 'bg-white dark:bg-gray-700 shadow text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}>
          📝 回答
        </button>
        <button onClick={() => setActiveTab('result')} className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-md transition-all ${activeTab === 'result' ? 'bg-white dark:bg-gray-700 shadow text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}>
          📊 集計
        </button>
        <button onClick={() => setActiveTab('my-schedule')} className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-md transition-all ${activeTab === 'my-schedule' ? 'bg-white dark:bg-gray-700 shadow text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}>
          📅 マイ予定
        </button>
      </div>

      {activeTab === 'response' && (
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow p-6 border-t-4 border-blue-500 relative">
          <div className="mb-4">
            <label className="block text-sm font-bold mb-1 dark:text-gray-300">お名前 *</label>
            <input type="text" value={guestName} onChange={e => setGuestName(e.target.value)}
              className="w-full p-3 bg-gray-50 dark:bg-gray-800 border dark:border-gray-700 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="名前を入力" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
            <button onClick={applyWeeklyRoutine} className="w-full flex items-center justify-center gap-2 py-3 bg-purple-50 dark:bg-purple-900/30 hover:bg-purple-100 text-purple-700 dark:text-purple-400 text-sm font-bold rounded-lg border border-purple-200 dark:border-purple-800/50 shadow-sm transition">
              <CalendarDays size={18} /> 設定したシフトを反映
            </button>
            
            {Object.keys(pastAvailabilities).length > 0 ? (
              <button onClick={applySmartCopy} className="w-full flex items-center justify-center gap-2 py-3 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 text-blue-700 dark:text-blue-400 text-sm font-bold rounded-lg border border-blue-200 dark:border-blue-800/50 shadow-sm transition">
                <History size={18} /> 他の予定からスマートコピー
              </button>
            ) : (
              <div className="w-full flex items-center justify-center gap-2 py-3 bg-gray-50 dark:bg-gray-800 text-gray-400 dark:text-gray-500 text-xs font-bold rounded-lg border border-gray-200 dark:border-gray-700">
                <History size={16} /> 過去の予定はありません
              </div>
            )}
          </div>

          {/* 💡 ゲスト回答画面でも同じ日付を線とバッジでまとめる！ */}
          <div className="space-y-3 mb-6 mt-4">
            {slots.map((slot, index) => {
              const prevSlot = index > 0 ? slots[index-1] : null;
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
                  <div className={`p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${slot.is_confirmed ? 'bg-yellow-50 border-yellow-300' : 'bg-white dark:bg-gray-900 dark:border-gray-700'}`}>
                    <div className="text-sm font-bold text-gray-700 dark:text-gray-200 flex items-center gap-2">
                      {slot.is_confirmed && <span className="bg-yellow-400 text-xs px-2 py-1 rounded font-bold text-white">仮確定</span>}
                      {formatSlotTime(slot.start_at, slot.end_at)}
                    </div>
                    <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-lg sm:w-64 shrink-0 gap-1">
                      <button onClick={() => setAnswers({ ...answers, [slot.id]: 'maru' })}
                        className={`flex-1 py-1 text-xl rounded-md transition-all ${answers[slot.id] === 'maru' ? 'bg-white dark:bg-gray-700 shadow border border-green-200 dark:border-green-600 text-green-600' : 'text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 opacity-50'}`}>⭕️</button>
                      <button onClick={() => setAnswers({ ...answers, [slot.id]: 'sankaku' })}
                        className={`flex-1 py-1 text-xl rounded-md transition-all ${answers[slot.id] === 'sankaku' ? 'bg-white dark:bg-gray-700 shadow border border-orange-200 dark:border-orange-600 text-orange-500' : 'text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 opacity-50'}`}>🔺</button>
                      <button onClick={() => setAnswers({ ...answers, [slot.id]: 'batsu' })}
                        className={`flex-1 py-1 text-xl rounded-md transition-all ${answers[slot.id] === 'batsu' ? 'bg-white dark:bg-gray-700 shadow border border-red-200 dark:border-red-600 text-red-500' : 'text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 opacity-50'}`}>❌</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <button onClick={handleSubmit} disabled={loading} className="w-full py-4 bg-green-600 text-white font-bold text-lg rounded-xl shadow-lg hover:bg-green-700 transition-all disabled:opacity-50">
            回答を送信する
          </button>
        </div>
      )}

      {activeTab === 'result' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow border-t-4 border-green-500 transition-all">
            
            <div className="sticky top-[4.5rem] z-20 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md p-6 border-b dark:border-gray-700 shadow-sm rounded-t-xl">
              <button onClick={() => setIsSummaryOpen(!isSummaryOpen)} className="w-full flex items-center justify-between focus:outline-none">
                <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">📊 日程ごとの集計</h2>
                <div className="p-1 bg-gray-100 dark:bg-gray-800 rounded-full hover:bg-gray-200 transition-colors">
                  {isSummaryOpen ? <ChevronDown size={20} className="text-gray-600 dark:text-gray-300" /> : <ChevronRight size={20} className="text-gray-600 dark:text-gray-300" />}
                </div>
              </button>
            </div>

            {isSummaryOpen && (
              <div className="p-6 pt-4">
                <div className="flex flex-col sm:flex-row gap-4 mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border dark:border-gray-700">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-700 dark:text-gray-300">並び替え:</span>
                    <select value={sortType} onChange={e => setSortType(e.target.value)} className="p-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded text-sm bg-white outline-none">
                      <option value="time">⏰ 日時が早い順</option>
                      <option value="maru">⭕️ 参加者が多い順</option>
                      <option value="batsu">❌ 不参加が少ない順</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2 sm:border-l dark:border-gray-600 sm:pl-4">
                    <input type="checkbox" id="hideBatsu" checked={hideBatsu} onChange={e => setHideBatsu(e.target.checked)} className="w-4 h-4" />
                    <label htmlFor="hideBatsu" className="text-sm font-medium dark:text-gray-300 cursor-pointer">❌を除外</label>
                  </div>
                </div>

                <div className="space-y-4">
                  {sortedAndFilteredSlots.map((slot, i) => {
                    const tier = getSlotTier(slot);
                    const highlightClass = 
                      tier === 1 ? 'bg-green-50 border-green-400 ring-2 ring-green-200 dark:bg-green-900/30 dark:border-green-600 dark:ring-green-800/50' :
                      tier === 2 ? 'bg-orange-50 border-orange-300 dark:bg-orange-900/30 dark:border-orange-700' : 
                      'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700';

                    return (
                      <div key={slot.id} className={`p-4 border rounded-xl flex flex-col gap-4 transition-all ${slot.is_confirmed ? 'bg-yellow-100 border-yellow-400 shadow-md transform scale-[1.02]' : highlightClass}`}>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div>
                            {slot.is_confirmed && <span className="inline-block px-3 py-1 bg-yellow-500 text-white text-xs font-bold rounded-full mb-2 shadow-sm animate-pulse">✨ 仮確定 ✨</span>}
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

                        <div className="border-t border-gray-200/60 dark:border-gray-700 pt-3 mt-1 text-right">
                          <button 
                            onClick={() => toggleConfirmSlot(slot.id, slot.is_confirmed)}
                            className={`px-4 py-2 text-sm font-bold rounded-lg shadow transition-colors ${slot.is_confirmed ? 'bg-gray-200 text-gray-700 hover:bg-gray-300' : 'bg-yellow-400 text-yellow-900 hover:bg-yellow-500'}`}
                          >
                            {slot.is_confirmed ? '仮確定を解除' : '📌 仮確定にする (全員操作可)'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {sortedAndFilteredSlots.length === 0 && <p className="text-gray-500 text-center py-4">条件に合う日程がありません。</p>}
                </div>
              </div>
            )}
          </div>

          {/* 💡 ダークモードのマトリックス白文字バグを完全に修正！(dark:bg-gray-900 dark:text-gray-100 等を追加) */}
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow p-6 overflow-hidden">
            <h2 className="text-xl font-bold mb-4 dark:text-gray-100">👥 回答者マトリックス</h2>
            {matrix.length === 0 ? (
              <p className="text-gray-500">まだ回答がありません。</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left whitespace-nowrap border-collapse">
                  <thead>
                    <tr>
                      <th className="p-3 border-b-2 bg-gray-50 dark:bg-gray-800 font-bold text-gray-700 dark:text-gray-300 sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">名前</th>
                      {[...aggregated].sort((a, b) => a.originalIndex - b.originalIndex).map(slot => {
                        const tier = getSlotTier(slot);
                        const headerClass = 
                          slot.is_confirmed ? 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-400 border-yellow-300 dark:border-yellow-700' :
                          tier === 1 ? 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-400 border-green-300 dark:border-green-700' :
                          tier === 2 ? 'bg-orange-100 dark:bg-orange-900/50 text-orange-800 dark:text-orange-400 border-orange-200 dark:border-orange-800' : 
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
                    {matrix.map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        {/* 💡 ここの td に dark:bg-gray-900 dark:text-gray-100 を明示的に指定して白浮きを防止！ */}
                        <td className="p-3 border-b dark:border-gray-700 font-medium sticky left-0 bg-white dark:bg-gray-900 dark:text-gray-100 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">{row.guestName}</td>
                        {[...aggregated].sort((a, b) => a.originalIndex - b.originalIndex).map(slot => {
                          const tier = getSlotTier(slot);
                          const cellClass = 
                            slot.is_confirmed ? 'bg-yellow-50 dark:bg-yellow-900/20' :
                            tier === 1 ? 'bg-green-50 dark:bg-green-900/20' :
                            tier === 2 ? 'bg-orange-50/50 dark:bg-orange-900/10' : 'dark:bg-gray-800';
                            
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

      {/* マイ予定タブ */}
      {activeTab === 'my-schedule' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-md p-6 border-t-4 border-yellow-400">
            <div className="flex items-center gap-2 mb-6 text-yellow-600 dark:text-yellow-500">
              <CalendarCheck size={24} />
              <h2 className="text-xl font-bold dark:text-gray-100">あなたが参加する確定予定</h2>
            </div>
            {fetchingSchedules ? <p className="text-center text-gray-500 py-10">読み込み中...</p> : mySchedules.length === 0 ? (
              <div className="text-center py-6 bg-gray-50 dark:bg-gray-800 rounded-lg"><p className="text-gray-500 font-bold">まだ確定した予定はありません。</p></div>
            ) : (
              <div className="space-y-4">
                {mySchedules.map((schedule, i) => {
                  const isFirstOfDay = i === 0 || format(getFixedDate(mySchedules[i - 1].start_at), 'yyyy-MM-dd') !== format(getFixedDate(schedule.start_at), 'yyyy-MM-dd');
                  return (
                    <div key={schedule.id}>
                      {isFirstOfDay && <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 mb-2 mt-4 border-b dark:border-gray-700 pb-1">{format(getFixedDate(schedule.start_at), 'yyyy年M月d日 (E)', { locale: ja })}</h3>}
                      <div className="block bg-white dark:bg-gray-800 border-2 border-yellow-300 dark:border-yellow-600 p-4 rounded-xl shadow-sm">
                        <div className="flex justify-between items-center mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs bg-yellow-400 text-white px-2 py-1 rounded-full font-bold shadow-sm">📌 仮確定</span>
                            <span className="font-extrabold text-lg text-gray-800 dark:text-gray-100">{formatSlotTime(schedule.start_at, schedule.end_at)}</span>
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
        </div>
      )}

{isHost && (
        <div className="mt-12 pt-6 border-t border-gray-200 dark:border-gray-700">
          <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-xl border border-gray-200 dark:border-gray-700 text-center space-y-6">
            <h3 className="text-gray-800 dark:text-gray-200 font-bold flex items-center justify-center gap-2">
              👑 管理者メニュー
            </h3>
            
            {/* 💡 編集ページへのリンクを追加！ */}
            <Link href={`/event/${eventId}/edit`} className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-sm transition-colors">
              <Edit3 size={20} /> イベント内容・日程を編集する
            </Link>

            <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
              <h4 className="text-red-800 dark:text-red-400 font-bold mb-2 flex items-center justify-center gap-2 text-sm">
                <Trash2 size={18} /> イベントの完全削除
              </h4>
              <p className="text-xs text-red-600 dark:text-red-500 mb-4">全員の回答データも消滅し、二度と復元できません。</p>
              <button onClick={handleDeleteEvent} className="w-full sm:w-auto px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg shadow-sm transition-colors text-sm">
                本当にこのイベントを削除する
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 💡 スクロール上に戻るボタン！ */}
      {showScrollTop && (
        <button onClick={scrollToTop} className="fixed bottom-6 right-6 p-4 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg transition-all z-50 animate-fade-in-up">
          <ArrowUp size={24} />
        </button>
      )}
    </div>
  );
}