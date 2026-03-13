'use client';

import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { use } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronRight, PlusCircle, Pin, CalendarCheck, History } from 'lucide-react';

type Slot = { id: string; start_at: string; end_at: string; is_confirmed: boolean };
type Status = 'maru' | 'sankaku' | 'batsu';
type PastAvailability = { status: Status; updated: number };

type AggregatedSlot = Slot & { maru: number; sankaku: number; batsu: number; total: number; originalIndex: number; };
type MatrixData = { guestId: string; guestName: string; answers: Record<string, string>; };

type ConfirmedSchedule = { id: string; event_id: string; start_at: string; end_at: string; eventTitle: string };
type RecentEvent = { id: string; title: string; lastAccessed: number };

const getFixedDate = (dbDateStr: string) => {
  return new Date(dbDateStr.substring(0, 16));
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
  const [sortType, setSortType] = useState('maru');
  const [hideBatsu, setHideBatsu] = useState(false);
  const [isSummaryOpen, setIsSummaryOpen] = useState(true); 

  const [mySchedules, setMySchedules] = useState<ConfirmedSchedule[]>([]);
  const [fetchingSchedules, setFetchingSchedules] = useState(false);
  const [recentEvents, setRecentEvents] = useState<RecentEvent[]>([]);

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
        // 💡 クラウドに「このイベント見たよ！」を記録
        await supabase.from('user_recent_events').upsert({
          guest_id: currentGuestId,
          event_id: eventId,
          event_title: eData.title,
          accessed_at: Date.now()
        }, { onConflict: 'guest_id,event_id' });
      }
      
      if (sData) {
        setSlots(sData);
        const initialAnswers: Record<string, Status> = {};
        sData.forEach(s => initialAnswers[s.id] = 'maru'); 

        const { data: existingResponse } = await supabase
          .from('responses')
          .select('id, guest_name')
          .eq('event_id', eventId)
          .eq('guest_id', currentGuestId)
          .single();

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

        // 💡 クラウドの「最強コピー記憶」を取得
        const { data: copies } = await supabase.from('user_smart_copies').select('*').eq('guest_id', currentGuestId);
        if (copies) {
          const parsed: Record<string, PastAvailability> = {};
          copies.forEach((c: any) => {
            parsed[c.time_key] = { status: c.status as Status, updated: c.updated_at };
          });
          setPastAvailabilities(parsed);
        }

        // 💡 仮確定された日程があったら、クラウドの記憶に強制的に「バツ」を書き込む
        const confirmedSlots = sData.filter(s => s.is_confirmed);
        if (confirmedSlots.length > 0 && existingResponse) {
          const copyUpserts: any[] = [];
          const now = Date.now();
          confirmedSlots.forEach(slot => {
            if (loadedAnswers[slot.id] === 'maru' || loadedAnswers[slot.id] === 'sankaku') {
              copyUpserts.push({ 
                guest_id: currentGuestId, 
                time_key: `${slot.start_at}_${slot.end_at}`, 
                status: 'batsu', 
                updated_at: now 
              });
            }
          });
          if (copyUpserts.length > 0) {
            await supabase.from('user_smart_copies').upsert(copyUpserts, { onConflict: 'guest_id,time_key' });
          }
        }
      }

      if (sData) await fetchStats(sData);
      setLoading(false);
    };
    fetchAll();
  }, [eventId]);

  const fetchRecentEvents = async (guestId: string) => {
    const { data } = await supabase
      .from('user_recent_events')
      .select('*')
      .eq('guest_id', guestId)
      .order('accessed_at', { ascending: false })
      .limit(10);
    if (data) {
      setRecentEvents(data.map((d: any) => ({ id: d.event_id, title: d.event_title, lastAccessed: d.accessed_at })));
    }
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
      .upsert(
        { event_id: eventId, guest_id: deviceGuestId, guest_name: guestName, updated_at: new Date().toISOString() }, 
        { onConflict: 'event_id,guest_id' }
      )
      .select('id').single();

    if (resData) {
      await supabase.from('availabilities').delete().eq('response_id', resData.id);
      const avails = Object.entries(answers).map(([slotId, status]) => ({ response_id: resData.id, slot_id: slotId, status }));
      await supabase.from('availabilities').insert(avails);

      // 💡 最強コピーの記憶をクラウド（Supabase）に保存！
      const now = Date.now();
      const copyUpserts = slots.map(slot => ({
        guest_id: deviceGuestId,
        time_key: `${slot.start_at}_${slot.end_at}`,
        status: answers[slot.id],
        updated_at: now
      }));
      await supabase.from('user_smart_copies').upsert(copyUpserts, { onConflict: 'guest_id,time_key' });

      localStorage.setItem('lastGuestName', guestName);

      alert('回答を保存しました！🎉\nクラウドに同期されたよ！');
      await fetchStats(slots);
      await fetchMySchedules(deviceGuestId);
      setActiveTab('result');
    }
    setLoading(false);
  };

  const sortedAndFilteredSlots = useMemo(() => {
    let result = [...aggregated];
    if (hideBatsu) result = result.filter(s => s.batsu === 0);
    result.sort((a, b) => {
      if (a.is_confirmed && !b.is_confirmed) return -1;
      if (!a.is_confirmed && b.is_confirmed) return 1;

      if (sortType === 'maru') {
        if (b.maru !== a.maru) return b.maru - a.maru;
        if (b.sankaku !== a.sankaku) return b.sankaku - a.sankaku;
        return getFixedDate(a.start_at).getTime() - getFixedDate(b.start_at).getTime();
      } else if (sortType === 'time') {
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

  if (loading) return <div className="text-center mt-20">読み込み中...</div>;
  if (!event) return <div className="text-center mt-20 text-red-500 font-bold">イベントが見つかりません</div>;

  const confirmedSlots = slots.filter(s => s.is_confirmed);
  const isEventConfirmed = confirmedSlots.length > 0;

  return (
    <div className="max-w-2xl mx-auto p-4 mt-4 space-y-6">
      <div className="flex justify-end mb-2">
        <Link 
          href="/" 
          className="flex items-center gap-1 text-sm bg-blue-50 text-blue-600 px-3 py-2 rounded-lg font-bold hover:bg-blue-100 transition-colors border border-blue-200 shadow-sm"
        >
          <PlusCircle size={16} /> 新しく作る
        </Link>
      </div>

      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold mb-2 text-gray-800">{event.title}</h1>
        {event.description && <p className="text-gray-600 whitespace-pre-wrap">{event.description}</p>}
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
                {format(getFixedDate(s.start_at), 'M/d (E) HH:mm', { locale: ja })} 〜 {format(getFixedDate(s.end_at), 'HH:mm')}
              </div>
            ))}
          </div>
          <p className="text-xs text-yellow-700 mt-4 font-bold">
            ※マイ予定タブに追加されました！<br />
            ※他イベントのスマートコピーでは自動的に「予定あり❌」になります。
          </p>
        </div>
      )}

      <div className="flex bg-gray-200 rounded-lg p-1 sticky top-4 z-20 shadow">
        <button onClick={() => setActiveTab('response')} className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-md transition-all ${activeTab === 'response' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
          📝 回答
        </button>
        <button onClick={() => setActiveTab('result')} className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-md transition-all ${activeTab === 'result' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
          📊 集計
        </button>
        <button onClick={() => setActiveTab('my-schedule')} className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-md transition-all ${activeTab === 'my-schedule' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
          📅 マイ予定
        </button>
      </div>

      {activeTab === 'response' && (
        <div className="bg-white rounded-xl shadow p-6 border-t-4 border-blue-500 relative">
          <div className="mb-4">
            <label className="block text-sm font-bold mb-1">お名前 *</label>
            <input type="text" value={guestName} onChange={e => setGuestName(e.target.value)}
              className="w-full p-3 bg-gray-50 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="名前を入力" />
          </div>

          {Object.keys(pastAvailabilities).length > 0 && (
            <div className="bg-purple-50 p-4 rounded-lg mb-6 border border-purple-100">
              <p className="text-sm text-purple-800 font-bold mb-2">💡 クラウドの予定から推測できます</p>
              <button onClick={applySmartCopy} className="w-full py-2 bg-purple-600 text-white text-sm font-bold rounded shadow hover:bg-purple-700 transition">
                スマートコピーで一括入力
              </button>
            </div>
          )}

          <div className="space-y-3 mb-6 mt-4">
            {slots.map(slot => (
              <div key={slot.id} className={`p-3 border rounded-lg hover:bg-gray-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${slot.is_confirmed ? 'bg-yellow-50 border-yellow-300' : ''}`}>
                <div className="text-sm font-bold text-gray-700 flex items-center gap-2">
                  {slot.is_confirmed && <span className="bg-yellow-400 text-xs px-2 py-1 rounded font-bold">仮確定</span>}
                  {format(getFixedDate(slot.start_at), 'M/d (E) HH:mm', { locale: ja })} 〜 {format(getFixedDate(slot.end_at), 'HH:mm')}
                </div>
                <div className="flex bg-gray-100 p-1 rounded-lg sm:w-64 shrink-0 gap-1">
                  <button onClick={() => setAnswers({ ...answers, [slot.id]: 'maru' })}
                    className={`flex-1 py-1 text-xl rounded-md transition-all ${answers[slot.id] === 'maru' ? 'bg-white shadow border border-green-200 text-green-600' : 'text-gray-400 hover:bg-gray-200 opacity-50'}`}>⭕️</button>
                  <button onClick={() => setAnswers({ ...answers, [slot.id]: 'sankaku' })}
                    className={`flex-1 py-1 text-xl rounded-md transition-all ${answers[slot.id] === 'sankaku' ? 'bg-white shadow border border-orange-200 text-orange-500' : 'text-gray-400 hover:bg-gray-200 opacity-50'}`}>🔺</button>
                  <button onClick={() => setAnswers({ ...answers, [slot.id]: 'batsu' })}
                    className={`flex-1 py-1 text-xl rounded-md transition-all ${answers[slot.id] === 'batsu' ? 'bg-white shadow border border-red-200 text-red-500' : 'text-gray-400 hover:bg-gray-200 opacity-50'}`}>❌</button>
                </div>
              </div>
            ))}
          </div>

          <button onClick={handleSubmit} disabled={loading} className="w-full py-4 bg-green-600 text-white font-bold text-lg rounded-xl shadow-lg hover:bg-green-700 transition-all disabled:opacity-50">
            回答を送信する
          </button>
        </div>
      )}

      {activeTab === 'result' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow p-6 border-t-4 border-green-500 transition-all">
            <button 
              onClick={() => setIsSummaryOpen(!isSummaryOpen)}
              className="w-full flex items-center justify-between focus:outline-none"
            >
              <h2 className="text-xl font-bold text-gray-800">📊 日程ごとの集計</h2>
              <div className="p-1 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors">
                {isSummaryOpen ? <ChevronDown size={20} className="text-gray-600" /> : <ChevronRight size={20} className="text-gray-600" />}
              </div>
            </button>

            {isSummaryOpen && (
              <div className="mt-6">
                <div className="flex flex-col sm:flex-row gap-4 mb-6 p-4 bg-gray-50 rounded-lg border">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-700">並び替え:</span>
                    <select value={sortType} onChange={e => setSortType(e.target.value)} className="p-2 border rounded text-sm bg-white">
                      <option value="maru">⭕️ 参加者が多い順</option>
                      <option value="time">⏰ 日時が早い順</option>
                      <option value="batsu">❌ 不参加が少ない順</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2 sm:border-l sm:pl-4">
                    <input type="checkbox" id="hideBatsu" checked={hideBatsu} onChange={e => setHideBatsu(e.target.checked)} className="w-4 h-4" />
                    <label htmlFor="hideBatsu" className="text-sm font-medium cursor-pointer">❌を除外</label>
                  </div>
                </div>

                <div className="space-y-4">
                  {sortedAndFilteredSlots.map((slot, i) => (
                    <div key={slot.id} className={`p-4 border rounded-xl flex flex-col gap-4 transition-all ${slot.is_confirmed ? 'bg-yellow-100 border-yellow-400 shadow-md transform scale-[1.02]' : 'bg-white'}`}>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                          {slot.is_confirmed && <span className="inline-block px-3 py-1 bg-yellow-500 text-white text-xs font-bold rounded-full mb-2 shadow-sm animate-pulse">✨ 仮確定 ✨</span>}
                          <div className="font-bold text-lg">
                            {format(getFixedDate(slot.start_at), 'M/d (E) HH:mm', { locale: ja })} 〜 {format(getFixedDate(slot.end_at), 'HH:mm')}
                          </div>
                        </div>
                        <div className="flex gap-4 text-center">
                          <div><div className="text-xs text-gray-500">⭕️</div><div className="font-bold text-green-600 text-xl">{slot.maru}</div></div>
                          <div><div className="text-xs text-gray-500">🔺</div><div className="font-bold text-orange-500 text-xl">{slot.sankaku}</div></div>
                          <div><div className="text-xs text-gray-500">❌</div><div className="font-bold text-red-500 text-xl">{slot.batsu}</div></div>
                        </div>
                      </div>

                      <div className="border-t pt-3 mt-1 text-right">
                        <button 
                          onClick={() => toggleConfirmSlot(slot.id, slot.is_confirmed)}
                          className={`px-4 py-2 text-sm font-bold rounded-lg shadow transition-colors ${slot.is_confirmed ? 'bg-gray-200 text-gray-700 hover:bg-gray-300' : 'bg-yellow-400 text-yellow-900 hover:bg-yellow-500'}`}
                        >
                          {slot.is_confirmed ? '仮確定を解除' : '📌 仮確定にする (全員操作可)'}
                        </button>
                      </div>
                    </div>
                  ))}
                  {sortedAndFilteredSlots.length === 0 && <p className="text-gray-500 text-center py-4">条件に合う日程がありません。</p>}
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow p-6 overflow-hidden">
            <h2 className="text-xl font-bold mb-4">👥 回答者マトリックス</h2>
            {matrix.length === 0 ? (
              <p className="text-gray-500">まだ回答がありません。</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left whitespace-nowrap border-collapse">
                  <thead>
                    <tr>
                      <th className="p-3 border-b-2 bg-gray-50 font-bold text-gray-700 sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">名前</th>
                      {[...aggregated].sort((a, b) => a.originalIndex - b.originalIndex).map(slot => (
                        <th key={slot.id} className={`p-3 border-b-2 text-xs font-medium ${slot.is_confirmed ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-50 text-gray-600'}`}>
                          {slot.is_confirmed && '📌'}<br/>
                          {format(getFixedDate(slot.start_at), 'M/d(E)', { locale: ja })}<br/>{format(getFixedDate(slot.start_at), 'HH:mm')}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {matrix.map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="p-3 border-b font-medium sticky left-0 bg-white z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">{row.guestName}</td>
                        {[...aggregated].sort((a, b) => a.originalIndex - b.originalIndex).map(slot => (
                          <td key={slot.id} className={`p-3 border-b text-center text-xl ${slot.is_confirmed ? 'bg-yellow-50' : ''}`}>{getStatusIcon(row.answers[slot.id])}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'my-schedule' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-md p-6 border-t-4 border-yellow-400">
            <div className="flex items-center gap-2 mb-6 text-yellow-600">
              <CalendarCheck size={24} />
              <h2 className="text-xl font-bold">あなたが参加する確定予定</h2>
            </div>
            
            {fetchingSchedules ? (
              <p className="text-center text-gray-500 py-10">読み込み中...</p>
            ) : mySchedules.length === 0 ? (
              <div className="text-center py-6 bg-gray-50 rounded-lg">
                <p className="text-gray-500 font-bold">まだ確定した予定はありません。</p>
              </div>
            ) : (
              <div className="space-y-4">
                {mySchedules.map((schedule, i) => {
                  const isFirstOfDay = i === 0 || format(getFixedDate(mySchedules[i - 1].start_at), 'yyyy-MM-dd') !== format(getFixedDate(schedule.start_at), 'yyyy-MM-dd');
                  return (
                    <div key={schedule.id}>
                      {isFirstOfDay && (
                        <h3 className="text-sm font-bold text-gray-500 mb-2 mt-4 border-b pb-1">
                          {format(getFixedDate(schedule.start_at), 'yyyy年M月d日 (E)', { locale: ja })}
                        </h3>
                      )}
                      <Link href={`/event/${schedule.event_id}`} className="block bg-white border-2 border-yellow-300 p-4 rounded-xl hover:bg-yellow-50 active:bg-yellow-100 transition shadow-sm group">
                        <div className="flex justify-between items-center mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs bg-yellow-400 text-white px-2 py-1 rounded-full font-bold shadow-sm">📌 仮確定</span>
                            <span className="font-extrabold text-lg text-gray-800">
                              {format(getFixedDate(schedule.start_at), 'HH:mm')} 〜 {format(getFixedDate(schedule.end_at), 'HH:mm')}
                            </span>
                          </div>
                        </div>
                        <div className="flex justify-between items-center">
                          <p className="text-sm text-gray-700 font-bold truncate pr-4">{schedule.eventTitle}</p>
                          <div className="flex items-center gap-1 text-xs font-bold text-blue-600 bg-blue-50 px-3 py-2 rounded-lg group-hover:bg-blue-100 transition">
                            調整画面へ <ChevronRight size={14} />
                          </div>
                        </div>
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-md p-6 border-t-4 border-blue-400">
            <div className="flex items-center gap-2 mb-6 text-blue-600">
              <History size={24} />
              <h2 className="text-xl font-bold">最近見た・調整中のイベント</h2>
            </div>
            {recentEvents.length === 0 ? (
              <p className="text-center text-gray-500 py-6 bg-gray-50 rounded-lg font-bold">まだ履歴がありません。</p>
            ) : (
              <div className="space-y-3">
                {recentEvents.map(re => (
                  <Link key={re.id} href={`/event/${re.id}`} className="block bg-white border border-gray-200 p-4 rounded-xl hover:bg-blue-50 transition shadow-sm group">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-gray-800">{re.title}</span>
                      <div className="flex items-center gap-1 text-xs font-bold text-blue-600 bg-blue-50 border border-blue-100 px-3 py-2 rounded-lg group-hover:bg-blue-100 transition">
                        開く <ChevronRight size={14} />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}