'use client';

import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { use } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronRight, PlusCircle } from 'lucide-react';

type Slot = { id: string; start_at: string; end_at: string };
type Status = 'maru' | 'sankaku' | 'batsu';
type PastAvailability = { status: Status; updated: number };

type AggregatedSlot = Slot & { maru: number; sankaku: number; batsu: number; total: number; originalIndex: number; };
type MatrixData = { guestName: string; answers: Record<string, string>; };

// 💡 時差バグ修正！タイムゾーン情報を切り捨てて、ホストが入力した「文字盤の数字」のままの時間を生成する関数
const getFixedDate = (dbDateStr: string) => {
  return new Date(dbDateStr.substring(0, 16));
};

export default function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = use(params);
  const [activeTab, setActiveTab] = useState<'response' | 'result'>('response');
  const [event, setEvent] = useState<any>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);

  // 回答用ステート
  const [guestName, setGuestName] = useState('');
  const [answers, setAnswers] = useState<Record<string, Status>>({});
  const [pastAvailabilities, setPastAvailabilities] = useState<Record<string, PastAvailability>>({});

  // 集計用ステート
  const [aggregated, setAggregated] = useState<AggregatedSlot[]>([]);
  const [matrix, setMatrix] = useState<MatrixData[]>([]);
  const [sortType, setSortType] = useState('maru');
  const [hideBatsu, setHideBatsu] = useState(false);
  const [isSummaryOpen, setIsSummaryOpen] = useState(true); 

  useEffect(() => {
    const fetchAll = async () => {
      const { data: eData } = await supabase.from('events').select('*').eq('id', eventId).single();
      const { data: sData } = await supabase.from('slots').select('*').eq('event_id', eventId).order('start_at');
      
      if (eData) setEvent(eData);
      if (sData) {
        setSlots(sData);
        const initialAnswers: Record<string, Status> = {};
        sData.forEach(s => initialAnswers[s.id] = 'maru'); 

        // 💡 過去の名前があれば、画面を開いた瞬間に自動で入力＆履歴をロードする！
        const savedName = localStorage.getItem('lastGuestName');
        if (savedName) {
          setGuestName(savedName);
          await loadUserData(savedName, initialAnswers, sData);
        } else {
          setAnswers(initialAnswers);
        }
      }

      if (sData) await fetchStats(sData);
      setLoading(false);
    };
    fetchAll();
  }, [eventId]);

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
      return { guestName: res.guest_name, answers: userAnswers };
    });
    setMatrix(matrixData);
  };

  // 指定した名前の人のデータを読み込む関数
  const loadUserData = async (name: string, defaultAnswers: Record<string, Status>, currentSlots: Slot[]) => {
    const { data } = await supabase.from('responses').select('id').eq('event_id', eventId).eq('guest_name', name).single();
    let loadedAnswers = { ...defaultAnswers };

    if (data) {
      const { data: aData } = await supabase.from('availabilities').select('slot_id, status').eq('response_id', data.id);
      if (aData) {
        aData.forEach(a => loadedAnswers[a.slot_id] = a.status as Status);
      }
    }
    setAnswers(loadedAnswers);

    const globalDataStr = localStorage.getItem('globalAvailabilities');
    if (globalDataStr) {
      const globalData = JSON.parse(globalDataStr);
      if (globalData[name]) {
        const parsed: Record<string, PastAvailability> = {};
        Object.entries(globalData[name]).forEach(([k, v]) => {
          if (typeof v === 'string') parsed[k] = { status: v as Status, updated: 0 };
          else parsed[k] = v as PastAvailability;
        });
        setPastAvailabilities(parsed);
      }
    }
  };

  const handleNameBlur = async () => {
    if (!guestName) return;
    await loadUserData(guestName, answers, slots);
  };

  const applySmartCopy = () => {
    const newAnswers = { ...answers };
    let appliedCount = 0;

    slots.forEach(slot => {
      // 💡 時差修正版の時間を取得
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
    alert(`最新の予定を優先して ${appliedCount} 件の回答を推測したよ！\n※念のためズレがないか確認してね！`);
  };

  const handleSubmit = async () => {
    if (!guestName) return alert('名前を入力してね！');
    setLoading(true);

    const { data: resData } = await supabase
      .from('responses').upsert({ event_id: eventId, guest_name: guestName, updated_at: new Date().toISOString() }, { onConflict: 'event_id,guest_name' })
      .select('id').single();

    if (resData) {
      await supabase.from('availabilities').delete().eq('response_id', resData.id);
      const avails = Object.entries(answers).map(([slotId, status]) => ({ response_id: resData.id, slot_id: slotId, status }));
      await supabase.from('availabilities').insert(avails);

      const globalDataStr = localStorage.getItem('globalAvailabilities');
      const globalData = globalDataStr ? JSON.parse(globalDataStr) : {};
      const myTimes = globalData[guestName] || {};
      const now = Date.now();
      slots.forEach(slot => myTimes[`${slot.start_at}_${slot.end_at}`] = { status: answers[slot.id], updated: now });
      globalData[guestName] = myTimes;
      localStorage.setItem('globalAvailabilities', JSON.stringify(globalData));

      // 💡 次回から自動入力されるように名前を保存！
      localStorage.setItem('lastGuestName', guestName);

      alert('回答を保存しました！🎉\nみんなの回答タブも更新されたよ！');
      await fetchStats(slots);
      setActiveTab('result');
    }
    setLoading(false);
  };

  const sortedAndFilteredSlots = useMemo(() => {
    let result = [...aggregated];
    if (hideBatsu) result = result.filter(s => s.batsu === 0);
    result.sort((a, b) => {
      // 💡 時差修正版のDateを使って並び替え
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

  return (
    <div className="max-w-2xl mx-auto p-4 mt-4 space-y-6">
      <div className="flex justify-end mb-2">
        <Link 
          href="/" 
          className="flex items-center gap-1 text-sm bg-blue-50 text-blue-600 px-3 py-2 rounded-lg font-bold hover:bg-blue-100 transition-colors border border-blue-200 shadow-sm"
        >
          <PlusCircle size={16} />
          自分も新しくイベントを作る
        </Link>
      </div>

      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold mb-2 text-gray-800">{event.title}</h1>
        {event.description && <p className="text-gray-600 whitespace-pre-wrap">{event.description}</p>}
      </div>

      <div className="flex bg-gray-200 rounded-lg p-1 sticky top-4 z-20 shadow">
        <button onClick={() => setActiveTab('response')} className={`flex-1 py-3 text-sm font-bold rounded-md transition-all ${activeTab === 'response' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
          📝 回答を入力する
        </button>
        <button onClick={() => setActiveTab('result')} className={`flex-1 py-3 text-sm font-bold rounded-md transition-all ${activeTab === 'result' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
          📊 みんなの回答を見る
        </button>
      </div>

      {activeTab === 'response' && (
        <div className="bg-white rounded-xl shadow p-6 border-t-4 border-blue-500">
          <div className="mb-4">
            <label className="block text-sm font-bold mb-1">お名前 *</label>
            <input type="text" value={guestName} onChange={e => setGuestName(e.target.value)} onBlur={handleNameBlur}
              className="w-full p-3 bg-gray-50 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="名前を入力（自動で保存されます）" />
          </div>

          {Object.keys(pastAvailabilities).length > 0 && (
            <div className="bg-purple-50 p-4 rounded-lg mb-6 border border-purple-100">
              <p className="text-sm text-purple-800 font-bold mb-2">💡 前回の名前を自動入力しました！</p>
              <button onClick={applySmartCopy} className="w-full py-2 bg-purple-600 text-white text-sm font-bold rounded shadow hover:bg-purple-700 transition">
                最新の予定から推測して一括入力（最強コピー）
              </button>
            </div>
          )}

          <div className="space-y-3 mb-6 mt-4">
            {slots.map(slot => (
              <div key={slot.id} className="p-3 border rounded-lg hover:bg-gray-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="text-sm font-bold text-gray-700">
                  {/* 💡 ここでも getFixedDate を使う */}
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
                    <div key={slot.id} className={`p-4 border rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${i === 0 && sortType === 'maru' ? 'bg-yellow-50 border-yellow-300' : 'bg-white'}`}>
                      <div>
                        {i === 0 && sortType === 'maru' && <span className="inline-block px-2 py-1 bg-yellow-400 text-xs font-bold rounded mb-2">🏆 最有力候補</span>}
                        <div className="font-bold text-lg">
                          {/* 💡 ここでも getFixedDate を使う */}
                          {format(getFixedDate(slot.start_at), 'M/d (E) HH:mm', { locale: ja })} 〜 {format(getFixedDate(slot.end_at), 'HH:mm')}
                        </div>
                      </div>
                      <div className="flex gap-4 text-center">
                        <div><div className="text-xs text-gray-500">⭕️</div><div className="font-bold text-green-600 text-xl">{slot.maru}</div></div>
                        <div><div className="text-xs text-gray-500">🔺</div><div className="font-bold text-orange-500 text-xl">{slot.sankaku}</div></div>
                        <div><div className="text-xs text-gray-500">❌</div><div className="font-bold text-red-500 text-xl">{slot.batsu}</div></div>
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
                        <th key={slot.id} className="p-3 border-b-2 bg-gray-50 text-xs font-medium text-gray-600">
                          {/* 💡 ここでも getFixedDate を使う */}
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
                          <td key={slot.id} className="p-3 border-b text-center text-xl">{getStatusIcon(row.answers[slot.id])}</td>
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
    </div>
  );
}