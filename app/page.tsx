'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, Trash2, Link, Share2, CalendarDays, History } from 'lucide-react';
import { addMinutes, format, addDays } from 'date-fns';

type HistoryItem = { title: string; slots: { startAt: string; endAt: string }[] };

export default function CreateEvent() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [slots, setSlots] = useState([{ startAt: '', endAt: '' }]);
  const [createdEventId, setCreatedEventId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hostHistory, setHostHistory] = useState<HistoryItem[]>([]);

  const [bulkStartDate, setBulkStartDate] = useState('');
  const [bulkEndDate, setBulkEndDate] = useState('');
  const [selectedDows, setSelectedDows] = useState<number[]>([]);
  const [bulkStart, setBulkStart] = useState('12:00');
  const [bulkEnd, setBulkEnd] = useState('18:00');
  const [bulkInterval, setBulkInterval] = useState('120');

  const DOW_LABELS = [
    { label: '日', val: 0 }, { label: '月', val: 1 }, { label: '火', val: 2 },
    { label: '水', val: 3 }, { label: '木', val: 4 }, { label: '金', val: 5 }, { label: '土', val: 6 },
  ];

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('hostEventHistory');
      if (saved) setHostHistory(JSON.parse(saved));
    }
  }, []);

  const addSlot = () => setSlots([...slots, { startAt: '', endAt: '' }]);
  const removeSlot = (index: number) => setSlots(slots.filter((_, i) => i !== index));

  const loadFromHistory = (index: string) => {
    if (index === '') return;
    const item = hostHistory[Number(index)];
    if (item) {
      setSlots(item.slots);
      alert(`「${item.title}」の日程構成をコピーしたよ！`);
    }
  };

  const toggleDow = (val: number) => {
    setSelectedDows(prev => prev.includes(val) ? prev.filter(d => d !== val) : [...prev, val]);
  };

  const generateBulkSlots = () => {
    if (!bulkStartDate || !bulkEndDate || selectedDows.length === 0 || !bulkStart || !bulkEnd) {
      return alert('期間、曜日、時間をすべて指定してね！');
    }
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
          newSlots.push({
            startAt: format(currentSlot, "yyyy-MM-dd'T'HH:mm"),
            endAt: format(nextSlot, "yyyy-MM-dd'T'HH:mm")
          });
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

    const { data: eventData, error: eventError } = await supabase
      .from('events').insert([{ title, description }]).select('id').single();

    if (eventError || !eventData) {
      alert('エラーが発生しました'); setLoading(false); return;
    }

    const slotsToInsert = slots.map(s => ({
      event_id: eventData.id, start_at: new Date(s.startAt).toISOString(), end_at: new Date(s.endAt).toISOString(),
    }));

    await supabase.from('slots').insert(slotsToInsert);

    const updatedHistory = [{ title, slots }, ...hostHistory.filter(h => h.title !== title)].slice(0, 5);
    localStorage.setItem('hostEventHistory', JSON.stringify(updatedHistory));
    setHostHistory(updatedHistory);

    setCreatedEventId(eventData.id);
    setLoading(false);
  };

  const handleShare = async (url: string) => {
    if (navigator.share) {
      try {
        await navigator.share({ title: '日程調整', text: `${title} の日程調整をお願いします！`, url });
      } catch (error) {
        console.log('共有キャンセル');
      }
    } else {
      alert('URLをコピーしてね！');
    }
  };

  if (createdEventId) {
    const eventUrl = `${window.location.origin}/event/${createdEventId}`;
    return (
      <div className="max-w-xl mx-auto p-6 mt-10 bg-white rounded-xl shadow-md space-y-6">
        <h1 className="text-2xl font-bold text-center text-green-600">イベント作成完了！🎉</h1>
        <div className="bg-blue-50 p-6 rounded-xl border border-blue-200 shadow-sm text-center">
          <p className="font-bold text-lg text-blue-900 mb-2">共有＆集計用 URL</p>
          <p className="text-sm text-blue-700 mb-4">※回答も集計の確認も、このURL一つで全員ができます！コピーし忘れに注意！</p>
          <div className="flex items-center gap-2 mb-4">
            <input readOnly value={eventUrl} className="flex-1 p-3 bg-white border rounded-lg text-sm text-gray-700 focus:outline-none" />
            <button onClick={() => navigator.clipboard.writeText(eventUrl)} className="p-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"><Link size={20} /></button>
          </div>
          <button onClick={() => handleShare(eventUrl)} className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg flex items-center justify-center gap-2 shadow-md transition-all">
            <Share2 size={20} /> LINEやXでメンバーに共有する
          </button>
        </div>
      </div>
    );
  }

  // --- 手動入力や一括追加のUIは変更なし（前のコードと同じ） ---
  return (
    <div className="max-w-xl mx-auto p-6 mt-10 bg-white rounded-xl shadow-md">
      <h1 className="text-2xl font-bold mb-6">🗓 新しいイベントを作成</h1>
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-bold mb-1">イベント名 *</label>
          <input type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full p-2 border rounded" placeholder="例: BNS合同練習" />
        </div>
        
        {/* 一括作成ツール */}
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

        {/* 手動追加 ＆ 履歴呼び出し */}
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

        <button onClick={handleCreate} disabled={loading} className="w-full py-3 bg-green-600 text-white font-bold rounded-lg mt-6">
          {loading ? '作成中...' : 'イベントを作成する'}
        </button>
      </div>
    </div>
  );
}