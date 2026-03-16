'use client';

import { useState, useEffect } from 'react';
import { Settings, CalendarDays, ArrowLeft, Trash2, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation'; // 💡 これを追加！

type RoutineSlot = { id: string; isAllDay: boolean; start: string; end: string; status: 'maru' | 'sankaku' | 'batsu' };
type WeeklyRoutine = Record<number, RoutineSlot[]>;

export default function SettingsPage() {
  const router = useRouter(); // 💡 ルーターを準備
  const [deviceGuestId, setDeviceGuestId] = useState('');
  const [transferIdInput, setTransferIdInput] = useState('');

  const [routine, setRoutine] = useState<WeeklyRoutine>({
    0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: []
  });

  const DOW_LABELS = [
    { label: '日曜日', val: 0, color: 'text-red-500' }, { label: '月曜日', val: 1, color: 'text-gray-700 dark:text-gray-300' }, 
    { label: '火曜日', val: 2, color: 'text-gray-700 dark:text-gray-300' }, { label: '水曜日', val: 3, color: 'text-gray-700 dark:text-gray-300' }, 
    { label: '木曜日', val: 4, color: 'text-gray-700 dark:text-gray-300' }, { label: '金曜日', val: 5, color: 'text-gray-700 dark:text-gray-300' }, 
    { label: '土曜日', val: 6, color: 'text-blue-500' },
  ];

  useEffect(() => {
    let currentGuestId = localStorage.getItem('deviceGuestId');
    if (!currentGuestId) {
      currentGuestId = crypto.randomUUID();
      localStorage.setItem('deviceGuestId', currentGuestId);
    }
    setDeviceGuestId(currentGuestId);

    const savedRoutine = localStorage.getItem('weeklyRoutine');
    if (savedRoutine) {
      const parsed = JSON.parse(savedRoutine);
      if (typeof parsed[0] === 'string') {
        setRoutine({ 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] });
      } else {
        setRoutine(parsed);
      }
    }
  }, []);

  const saveRoutine = (newRoutine: WeeklyRoutine) => {
    setRoutine(newRoutine);
    localStorage.setItem('weeklyRoutine', JSON.stringify(newRoutine));
  };

  const addSlot = (dow: number) => {
    const newSlot: RoutineSlot = { id: crypto.randomUUID(), isAllDay: false, start: '12:00', end: '18:00', status: 'maru' };
    saveRoutine({ ...routine, [dow]: [...routine[dow], newSlot] });
  };

  const updateSlot = (dow: number, id: string, field: keyof RoutineSlot, value: any) => {
    const updatedSlots = routine[dow].map(s => s.id === id ? { ...s, [field]: value } : s);
    saveRoutine({ ...routine, [dow]: updatedSlots });
  };

  const removeSlot = (dow: number, id: string) => {
    saveRoutine({ ...routine, [dow]: routine[dow].filter(s => s.id !== id) });
  };

  const handleTransfer = () => {
    if (transferIdInput.length < 20) return alert('正しい引き継ぎIDを入力してください！');
    if (confirm('現在のデータに上書きして引き継ぎますか？')) {
      localStorage.setItem('deviceGuestId', transferIdInput.trim());
      alert('引き継ぎが完了しました！トップページに戻ります。');
      window.location.href = '/';
    }
  };

  return (
    <div className="max-w-xl mx-auto p-4 mt-6 space-y-8 pb-20">
      <div className="flex items-center justify-between border-b dark:border-gray-700 pb-4 sticky top-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md z-10 pt-2">
        <div className="flex items-center gap-3">
          {/* 💡 router.back() を使って「直前のページに戻る」ように変更！ */}
          <button onClick={() => router.back()} className="p-2 bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700 rounded-full transition shadow-sm">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">設定</h1>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-md p-6 border-t-4 border-purple-500">
        <div className="flex items-center gap-2 mb-4 text-purple-600 dark:text-purple-400">
          <CalendarDays size={24} />
          <h2 className="text-xl font-bold dark:text-gray-100">曜日ごとの固定シフト</h2>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg border border-purple-100 dark:border-purple-800/30">
          「月曜の14-16時は⭕️、20-24時は🔺」のように、いつもの予定を登録しておくと、回答画面でワンタップで一気に自動入力できます！
        </p>
        
        <div className="space-y-6">
          {DOW_LABELS.map(dow => (
            <div key={dow.val} className="border dark:border-gray-700 rounded-xl overflow-hidden shadow-sm">
              <div className={`bg-gray-100 dark:bg-gray-800 px-4 py-2 font-bold ${dow.color} border-b dark:border-gray-700 flex justify-between items-center`}>
                {dow.label}
                <button onClick={() => addSlot(dow.val)} className="text-xs flex items-center gap-1 bg-white dark:bg-gray-700 border dark:border-gray-600 px-2 py-1 rounded text-gray-600 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 shadow-sm transition">
                  <Plus size={14}/> 枠を追加
                </button>
              </div>
              
              <div className="p-3 space-y-3 bg-white dark:bg-gray-900">
                {routine[dow.val].length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-2">固定の予定はありません</p>
                ) : (
                  routine[dow.val].map(slot => (
                    <div key={slot.id} className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700 relative flex flex-col gap-2">
                      <button onClick={() => removeSlot(dow.val, slot.id)} className="absolute top-2 right-2 text-gray-400 hover:text-red-500 transition">
                        <Trash2 size={16} />
                      </button>

                      <div className="flex items-center gap-3 pr-6">
                        <div className="flex bg-gray-200 dark:bg-gray-700 p-1 rounded-lg shrink-0 gap-1">
                          <button onClick={() => updateSlot(dow.val, slot.id, 'status', 'maru')} className={`w-10 py-1 text-sm rounded-md transition-all ${slot.status === 'maru' ? 'bg-white shadow text-green-600 font-bold' : 'text-gray-400 hover:bg-gray-400 opacity-50'}`}>⭕️</button>
                          <button onClick={() => updateSlot(dow.val, slot.id, 'status', 'sankaku')} className={`w-10 py-1 text-sm rounded-md transition-all ${slot.status === 'sankaku' ? 'bg-white shadow text-orange-500 font-bold' : 'text-gray-400 hover:bg-gray-400 opacity-50'}`}>🔺</button>
                          <button onClick={() => updateSlot(dow.val, slot.id, 'status', 'batsu')} className={`w-10 py-1 text-sm rounded-md transition-all ${slot.status === 'batsu' ? 'bg-white shadow text-red-500 font-bold' : 'text-gray-400 hover:bg-gray-400 opacity-50'}`}>❌</button>
                        </div>
                        <label className="flex items-center gap-1 text-xs font-bold text-gray-600 dark:text-gray-300 cursor-pointer bg-white dark:bg-gray-700 px-2 py-1 rounded border dark:border-gray-600">
                          <input type="checkbox" checked={slot.isAllDay} onChange={e => updateSlot(dow.val, slot.id, 'isAllDay', e.target.checked)} className="w-3 h-3" /> 終日
                        </label>
                      </div>

                      {!slot.isAllDay && (
                        <div className="flex items-center gap-2">
                          <input type="time" value={slot.start} onChange={e => updateSlot(dow.val, slot.id, 'start', e.target.value)} className="p-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-lg text-sm flex-1 focus:ring-2 focus:ring-purple-500 outline-none" />
                          <span className="text-gray-400">〜</span>
                          <input type="time" value={slot.end} onChange={e => updateSlot(dow.val, slot.id, 'end', e.target.value)} className="p-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-lg text-sm flex-1 focus:ring-2 focus:ring-purple-500 outline-none" />
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-md p-6 border-t-4 border-gray-500">
        <div className="flex items-center gap-2 mb-6 text-gray-700 dark:text-gray-300">
          <Settings size={24} />
          <h2 className="text-xl font-bold dark:text-gray-100">データ引き継ぎ設定</h2>
        </div>
        <div className="space-y-8">
          <div>
            <label className="block text-sm font-bold mb-2 text-blue-800 dark:text-blue-400">① 今のデータを引き継ぎたい場合</label>
            <div className="flex gap-2">
              <input readOnly value={deviceGuestId} className="flex-1 p-3 bg-gray-100 dark:bg-gray-800 border dark:border-gray-700 rounded-lg text-xs text-gray-600 dark:text-gray-300 outline-none" />
              <button onClick={() => { navigator.clipboard.writeText(deviceGuestId); alert('コピーしました！'); }} className="p-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-bold rounded-lg hover:bg-gray-300 transition shrink-0">コピー</button>
            </div>
          </div>
          <div className="border-t dark:border-gray-700 pt-6">
            <label className="block text-sm font-bold mb-2 text-green-800 dark:text-green-400">② 別のデータをここに復元したい場合</label>
            <div className="flex gap-2">
              <input value={transferIdInput} onChange={e => setTransferIdInput(e.target.value)} placeholder="引き継ぎIDをペースト" className="flex-1 p-3 border dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-green-500" />
              <button onClick={handleTransfer} className="p-3 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 transition shadow shrink-0">復元する</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}