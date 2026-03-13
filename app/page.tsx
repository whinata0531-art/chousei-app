'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, Trash2, Link as LinkIcon, Share2, CalendarDays, History, CalendarCheck, ChevronRight, Settings } from 'lucide-react';
import { addMinutes, format, addDays } from 'date-fns';
import { ja } from 'date-fns/locale';
import Link from 'next/link';

type HistoryItem = { title: string; slots: { startAt: string; endAt: string }[] };
type ConfirmedSchedule = { id: string; event_id: string; start_at: string; end_at: string; eventTitle: string };
type RecentEvent = { id: string; title: string; lastAccessed: number };

const getFixedDate = (dbDateStr: string) => {
  return new Date(dbDateStr.substring(0, 16));
};

export default function TopPage() {
  const [activeTab, setActiveTab] = useState<'create' | 'my-schedule' | 'settings'>('create');
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [slots, setSlots] = useState([{ startAt: '', endAt: '' }]);
  const [createdEventId, setCreatedEventId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hostHistory, setHostHistory] = useState<HistoryItem[]>([]);

  const [mySchedules, setMySchedules] = useState<ConfirmedSchedule[]>([]);
  const [fetchingSchedules, setFetchingSchedules] = useState(false);
  const [recentEvents, setRecentEvents] = useState<RecentEvent[]>([]);

  const [bulkStartDate, setBulkStartDate] = useState('');
  const [bulkEndDate, setBulkEndDate] = useState('');
  const [selectedDows, setSelectedDows] = useState<number[]>([]);
  const [bulkStart, setBulkStart] = useState('12:00');
  const [bulkEnd, setBulkEnd] = useState('18:00');
  const [bulkInterval, setBulkInterval] = useState('120');

  const [deviceGuestId, setDeviceGuestId] = useState('');
  const [transferIdInput, setTransferIdInput] = useState('');

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
      
      // 💡 マイ予定とクラウド履歴の取得を同時実行！
      fetchMySchedules(currentGuestId);
      fetchRecentEvents(currentGuestId);
    }
  }, []);

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

  const addSlot = () => setSlots([...slots, { startAt: '', endAt: '' }]);
  const removeSlot = (index: number) => setSlots(slots.filter((_, i) => i !== index));

  const loadFromHistory = (index: string) => {
    if (index === '') return;
    const item = hostHistory[Number(index)];
    if (item) { setSlots(item.slots); alert(`「${item.title}」の日程構成をコピーしたよ！`); }
  };

  const toggleDow = (val: number) => { setSelectedDows(prev => prev.includes(val) ? prev.filter(d => d !== val) : [...prev, val]); };

  const generateBulkSlots = () => {
    if (!bulkStartDate || !bulkEndDate || selectedDows.length === 0 || !bulkStart || !bulkEnd) return alert('期間、曜日、時間をすべて指定してね！');
    const start = new Date(bulkStartDate);
    const end = new Date(bulkEndDate);
    if (start > end) return alert('終了日は開始日より後に設定してね！');

    const interval = parseInt(bulkInterval);
    const newSlots: { startAt: string; endAt: string }[] = [];

    let currentDate = start;
    while (currentDate <= end) {
      if (selectedDows.includes(currentDate.getDay())) {
        const dateStr = format(currentDate, 'yyyy-MM-dd');
        const dayStart = new Date(`${dateStr}T${bulkStart}`);
        const dayEnd = new Date(`${dateStr}T${bulkEnd}`);

        let currentSlot = dayStart;
        while (currentSlot < dayEnd) {
          const nextSlot = addMinutes(currentSlot, interval);
          if (nextSlot > dayEnd) break;
          newSlots.push({ startAt: format(currentSlot, "yyyy-MM-dd'T'HH:mm"), endAt: format(nextSlot, "yyyy-MM-dd'T'HH:mm") });
          currentSlot = nextSlot;
        }
      }
      currentDate = addDays(currentDate, 1);
    }

    if (newSlots.length === 0) return alert('条件に合う日がなかったよ😢');
    setSlots((slots.length === 1 && !slots[0].startAt) ? newSlots : [...slots, ...newSlots]);
  };

  const handleCreate = async () => {
    if (!title || slots.some(s => !s.startAt || !s.endAt)) return alert('タイトルとすべての日程を入力してね！');
    setLoading(true);

    const { data: eventData, error: eventError } = await supabase.from('events').insert([{ title, description, host_id: deviceGuestId }]).select('id').single();
    if (eventError || !eventData) { alert('エラーが発生しました'); setLoading(false); return; }

    const slotsToInsert = slots.map(s => ({
      event_id: eventData.id,
      start_at: `${s.startAt}:00+00:00`, 
      end_at: `${s.endAt}:00+00:00`,
    }));

    await supabase.from('slots').insert(slotsToInsert);
    const updatedHistory = [{ title, slots }, ...hostHistory.filter(h => h.title !== title)].slice(0, 5);
    localStorage.setItem('hostEventHistory', JSON.stringify(updatedHistory));
    setHostHistory(updatedHistory);

    // 💡 自分が作ったイベントもクラウドの履歴に保存
    await supabase.from('user_recent_events').upsert({
      guest_id: deviceGuestId,
      event_id: eventData.id,
      event_title: title,
      accessed_at: Date.now()
    }, { onConflict: 'guest_id,event_id' });
    
    await fetchRecentEvents(deviceGuestId);

    setCreatedEventId(eventData.id);
    setLoading(false);
  };

  const handleShare = async (url: string) => {
    if (navigator.share) {
      try { await navigator.share({ title: '日程調整', text: `${title} の日程調整をお願いします！`, url }); } catch (error) {}
    } else { alert('URLをコピーしてね！'); }
  };

  const handleTransfer = () => {
    if (transferIdInput.length < 20) {
      return alert('正しい引き継ぎIDを入力してください！');
    }
    if (confirm('現在のデータに上書きして引き継ぎますか？')) {
      localStorage.setItem('deviceGuestId', transferIdInput.trim());
      alert('データの引き継ぎが完了しました！画面を再読み込みします。');
      window.location.reload();
    }
  };

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
    <div className="max-w-xl mx-auto p-4 mt-6 space-y-6">
      <div className="flex bg-gray-200 rounded-lg p-1 shadow">
        <button onClick={() => setActiveTab('create')} className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-md transition-all ${activeTab === 'create' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
          🗓 作成
        </button>
        <button onClick={() => setActiveTab('my-schedule')} className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-md transition-all ${activeTab === 'my-schedule' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
          📅 マイ予定
        </button>
        <button onClick={() => setActiveTab('settings')} className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-md transition-all ${activeTab === 'settings' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
          ⚙️ 設定
        </button>
      </div>

      {activeTab === 'create' && (
        <div className="bg-white rounded-xl shadow-md p-6 border-t-4 border-blue-500">
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-bold mb-1">イベント名 *</label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full p-2 border rounded" placeholder="例: BNS合同練習" />
            </div>
            
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 space-y-3">
              <label className="block text-sm font-bold flex items-center gap-1 text-blue-800">
                <CalendarDays size={16} /> 期間と曜日で一括作成
              </label>
              <div className="flex items-center gap-2">
                <input type="date" value={bulkStartDate} onChange={e => setBulkStartDate(e.target.value)} className="p-2 border rounded text-sm flex-1" />
                <span className="text-gray-500">〜</span>
                <input type="date" value={bulkEndDate} onChange={e => setBulkEndDate(e.target.value)} className="p-2 border rounded text-sm flex-1" />
              </div>
              <div className="flex gap-2 flex-wrap">
                {DOW_LABELS.map(dow => (
                  <button key={dow.val} onClick={() => toggleDow(dow.val)}
                    className={`w-10 h-10 rounded-full font-bold text-sm border ${selectedDows.includes(dow.val) ? 'bg-blue-500 text-white' : 'bg-white'}`}>
                    {dow.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input type="time" value={bulkStart} onChange={e => setBulkStart(e.target.value)} className="p-2 border rounded text-sm flex-1" />
                <span className="text-gray-500">〜</span>
                <input type="time" value={bulkEnd} onChange={e => setBulkEnd(e.target.value)} className="p-2 border rounded text-sm flex-1" />
                <select value={bulkInterval} onChange={e => setBulkInterval(e.target.value)} className="p-2 border rounded text-sm flex-1">
                  <option value="60">60分枠</option>
                  <option value="90">90分枠</option>
                  <option value="120">2時間枠</option>
                  <option value="180">3時間枠</option>
                </select>
              </div>
              <button onClick={generateBulkSlots} className="w-full py-2 bg-blue-600 text-white font-bold rounded">枠を追加する</button>
            </div>

            <div>
              <div className="flex justify-between items-end mb-2">
                <label className="block text-sm font-bold">候補日程 *</label>
                {hostHistory.length > 0 && (
                  <div className="flex items-center gap-1 text-xs text-purple-600">
                    <History size={14} />
                    <select onChange={(e) => { loadFromHistory(e.target.value); e.target.value = ""; }} className="bg-purple-50 border rounded p-1 max-w-[150px]">
                      <option value="">過去の調整からコピー</option>
                      {hostHistory.map((h, i) => <option key={i} value={i}>{h.title}</option>)}
                    </select>
                  </div>
                )}
              </div>
              {slots.map((slot, index) => (
                <div key={index} className="flex items-center gap-2 mb-2">
                  <input type="datetime-local" value={slot.startAt} onChange={e => {
                    const newSlots = [...slots]; newSlots[index].startAt = e.target.value; setSlots(newSlots);
                  }} className="p-2 border rounded text-sm flex-1" />
                  <span>〜</span>
                  <input type="datetime-local" value={slot.endAt} onChange={e => {
                    const newSlots = [...slots]; newSlots[index].endAt = e.target.value; setSlots(newSlots);
                  }} className="p-2 border rounded text-sm flex-1" />
                  <button onClick={() => removeSlot(index)} className="p-2 text-red-500 rounded"><Trash2 size={20} /></button>
                </div>
              ))}
              <button onClick={addSlot} className="flex items-center gap-1 text-sm text-gray-500 mt-2 border px-3 py-1 rounded"><Plus size={16} /> 空の枠を追加</button>
            </div>

            <button onClick={handleCreate} disabled={loading} className="w-full py-3 bg-green-600 text-white font-bold rounded-lg mt-6 shadow">
              {loading ? '作成中...' : 'イベントを作成する'}
            </button>
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

      {activeTab === 'settings' && (
        <div className="bg-white rounded-xl shadow-md p-6 border-t-4 border-gray-500">
          <div className="flex items-center gap-2 mb-6 text-gray-700">
            <Settings size={24} />
            <h2 className="text-xl font-bold">データ引き継ぎ設定</h2>
          </div>

          <p className="text-sm text-gray-600 mb-6 bg-gray-50 p-4 rounded-lg border">
            ホーム画面に追加したアプリ版や、別のブラウザで、現在のクラウドデータを完全に同期できます。
          </p>

          <div className="space-y-8">
            <div>
              <label className="block text-sm font-bold mb-2 text-blue-800">① 今のデータを引き継ぎたい場合</label>
              <p className="text-xs text-gray-500 mb-2">下のIDをコピーして、引き継ぎ先のアプリで入力してください。</p>
              <div className="flex gap-2">
                <input readOnly value={deviceGuestId} className="flex-1 p-3 bg-gray-100 border rounded-lg text-xs text-gray-600 outline-none" />
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(deviceGuestId); 
                    alert('引き継ぎIDをコピーしました！\n引き継ぎ先のアプリを開いてペーストしてください。');
                  }} 
                  className="p-3 bg-gray-200 text-gray-700 font-bold rounded-lg hover:bg-gray-300 transition shrink-0"
                >
                  コピー
                </button>
              </div>
            </div>

            <div className="border-t pt-6">
              <label className="block text-sm font-bold mb-2 text-green-800">② 別のデータをここに復元したい場合</label>
              <p className="text-xs text-gray-500 mb-2">コピーした引き継ぎIDを下にペーストして復元ボタンを押してください。</p>
              <div className="flex gap-2">
                <input 
                  value={transferIdInput} 
                  onChange={e => setTransferIdInput(e.target.value)} 
                  placeholder="引き継ぎIDをペースト" 
                  className="flex-1 p-3 border border-gray-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-green-500" 
                />
                <button 
                  onClick={handleTransfer} 
                  className="p-3 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 transition shadow shrink-0"
                >
                  復元する
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}