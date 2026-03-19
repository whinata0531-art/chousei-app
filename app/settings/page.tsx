'use client';

import { useState, useEffect } from 'react';
import { Settings, CalendarDays, ArrowLeft, Trash2, Plus, CheckCircle2, ChevronDown, ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase'; // パスは適宜合わせてね！
import GoogleLoginButton from '../components/GoogleLoginButton';

type RoutineSlot = { id: string; isAllDay: boolean; start: string; end: string; status: 'maru' | 'sankaku' | 'batsu' };
type WeeklyRoutine = Record<number, RoutineSlot[]>;

function AccordionItem({ 
  title, 
  icon, 
  borderColorClass, 
  children 
}: { 
  title: string, 
  icon: React.ReactNode, 
  borderColorClass: string, 
  children: React.ReactNode 
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={`bg-white dark:bg-gray-900 rounded-xl shadow-md border-t-4 ${borderColorClass} overflow-hidden`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex justify-between items-center p-6 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
      >
        <div className="flex items-center gap-2 text-gray-800 dark:text-gray-100">
          {icon}
          <h2 className="text-xl font-bold">{title}</h2>
        </div>
        <div className="text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 p-1 rounded-full">
          {isOpen ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
        </div>
      </button>
      
      {isOpen && (
        <div className="px-6 pb-6 pt-0">
          {children}
        </div>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const [deviceGuestId, setDeviceGuestId] = useState('');
  const [user, setUser] = useState<any>(null);

  const [routine, setRoutine] = useState<WeeklyRoutine>({
    0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: []
  });

  const [routineMemory, setRoutineMemory] = useState<Record<number, RoutineSlot[]>>({});

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

    // 💡 関数をちょっと書き換え！（sessionを引数でもらうようにしたよ）
    const checkAuthAndMerge = async (session: any) => {
      if (session?.user) {
        setUser(session.user); // ここで「連携完了！」に切り替わる！
        
        if (currentGuestId && currentGuestId !== session.user.id) {
          console.log('🔄 過去のデータをGoogleアカウントに紐付け中...');
          
          await Promise.all([
            supabase.from('events').update({ host_id: session.user.id }).eq('host_id', currentGuestId),
            supabase.from('responses').update({ guest_id: session.user.id }).eq('guest_id', currentGuestId),
            supabase.from('user_recent_events').update({ guest_id: session.user.id }).eq('guest_id', currentGuestId)
          ]);
          
          localStorage.setItem('deviceGuestId', session.user.id);
          setDeviceGuestId(session.user.id);
          
          alert('🎉 過去のデータがすべてGoogleアカウントに紐付けられました！');
        }
      }
    };
    
    // 💡 ① まず最初に一回チェックする
    supabase.auth.getSession().then(({ data: { session } }) => {
      checkAuthAndMerge(session);
    });

    // 💡 ② ここが超重要！！ログイン状態の変化を「監視」する！
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Googleから帰ってきて解読が終わった瞬間にここが動く！
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        checkAuthAndMerge(session);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
      }
    });

    const savedRoutine = localStorage.getItem('weeklyRoutine');
    if (savedRoutine) {
      const parsed = JSON.parse(savedRoutine);
      if (typeof parsed[0] === 'string') {
        setRoutine({ 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] });
      } else {
        setRoutine(parsed);
      }
    }

    // 💡 ③ ページを閉じる時に監視カメラをお片付け
    return () => {
      subscription.unsubscribe();
    };
  }, []); // ← useEffectの最後

  const saveRoutine = (newRoutine: WeeklyRoutine) => {
    setRoutine(newRoutine);
    localStorage.setItem('weeklyRoutine', JSON.stringify(newRoutine));
  };

  const isDowAllDay = (dow: number) => {
    const slots = routine[dow];
    return slots && slots.length === 1 && slots[0].isAllDay;
  };

  const toggleDowAllDay = (dow: number, checked: boolean) => {
    if (checked) {
      setRoutineMemory(prev => ({ ...prev, [dow]: routine[dow] }));
      const allDaySlot: RoutineSlot = { id: crypto.randomUUID(), isAllDay: true, start: '', end: '', status: 'maru' };
      saveRoutine({ ...routine, [dow]: [allDaySlot] });
    } else {
      const mem = routineMemory[dow];
      saveRoutine({ ...routine, [dow]: mem && mem.length > 0 ? mem : [] });
    }
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

  const handleLogout = async () => {
    if (confirm('ログアウトしますか？（データは消えません！）')) {
      await supabase.auth.signOut();
      window.location.reload(); 
    }
  };

  return (
    <div className="max-w-xl mx-auto p-4 mt-6 space-y-6 pb-20">
      <div className="flex items-center justify-between border-b dark:border-gray-700 pb-4 sticky top-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md z-10 pt-2">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => {
              // 💡 ポケットからメモを取り出す（もし無かったら安全のためにトップ '/' に帰す）
              const returnPath = localStorage.getItem('returnPath') || '/';
              router.push(returnPath);
            }} 
            className="p-2 bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700 rounded-full transition shadow-sm"
         >
            <ArrowLeft size={20} />
         </button>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">設定</h1>
        </div>
      </div>

      {/* 📦 アコーディオン1：曜日ごとの固定シフト */}
      <AccordionItem 
        title="曜日ごとの固定シフト" 
        icon={<CalendarDays className="text-purple-600 dark:text-purple-400" size={24} />}
        borderColorClass="border-purple-500"
      >
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg border border-purple-100 dark:border-purple-800/30">
          「月曜の14-16時は⭕️、20-24時は🔺」のように、いつもの予定を登録しておくと、回答画面でワンタップで一気に自動入力できます！
        </p>
        
        <div className="space-y-6">
          {DOW_LABELS.map(dow => (
            <div key={dow.val} className="border dark:border-gray-700 rounded-xl overflow-hidden shadow-sm">
              <div className={`bg-gray-100 dark:bg-gray-800 px-4 py-3 font-bold ${dow.color} border-b dark:border-gray-700 flex justify-between items-center`}>
                <div className="flex items-center gap-3">
                  <span>{dow.label}</span>
                  <label className="flex items-center gap-1 text-xs font-bold text-blue-700 dark:text-blue-300 cursor-pointer bg-white/50 dark:bg-gray-700 px-2 py-1 rounded border border-blue-200 dark:border-blue-800/50">
                    <input type="checkbox" checked={isDowAllDay(dow.val)} onChange={e => toggleDowAllDay(dow.val, e.target.checked)} className="w-3 h-3 text-blue-600" />
                    終日
                  </label>
                </div>
                {!isDowAllDay(dow.val) && (
                  <button onClick={() => addSlot(dow.val)} className="text-xs flex items-center gap-1 bg-white dark:bg-gray-700 border dark:border-gray-600 px-2 py-1 rounded text-gray-600 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 shadow-sm transition">
                    <Plus size={14}/> 枠を追加
                  </button>
                )}
              </div>
              
              <div className="p-3 bg-white dark:bg-gray-900">
                {isDowAllDay(dow.val) ? (
                  <div className="text-center py-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700 flex flex-col items-center gap-3">
                    <div className="text-blue-600 dark:text-blue-400 font-bold text-sm">
                      🌟 終日 (0:00〜23:59) で設定されています
                    </div>
                    <div className="flex bg-gray-200 dark:bg-gray-700 p-1 rounded-lg shrink-0 gap-1">
                      <button onClick={() => updateSlot(dow.val, routine[dow.val][0].id, 'status', 'maru')} className={`w-12 py-1.5 text-sm rounded-md transition-all ${routine[dow.val][0].status === 'maru' ? 'bg-white shadow text-green-600 font-bold' : 'text-gray-400 hover:bg-gray-400 opacity-50'}`}>⭕️</button>
                      <button onClick={() => updateSlot(dow.val, routine[dow.val][0].id, 'status', 'sankaku')} className={`w-12 py-1.5 text-sm rounded-md transition-all ${routine[dow.val][0].status === 'sankaku' ? 'bg-white shadow text-orange-500 font-bold' : 'text-gray-400 hover:bg-gray-400 opacity-50'}`}>🔺</button>
                      <button onClick={() => updateSlot(dow.val, routine[dow.val][0].id, 'status', 'batsu')} className={`w-12 py-1.5 text-sm rounded-md transition-all ${routine[dow.val][0].status === 'batsu' ? 'bg-white shadow text-red-500 font-bold' : 'text-gray-400 hover:bg-gray-400 opacity-50'}`}>❌</button>
                    </div>
                    <p className="text-xs text-gray-400 font-normal">※チェックを外すと記憶していた個別の時間枠に戻ります</p>
                  </div>
                ) : (
                  <div className="space-y-3">
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
                          </div>
                          <div className="flex items-center gap-2">
                            <input type="time" value={slot.start} onChange={e => updateSlot(dow.val, slot.id, 'start', e.target.value)} className="p-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-lg text-sm flex-1 focus:ring-2 focus:ring-purple-500 outline-none" />
                            <span className="text-gray-400 text-xs">〜</span>
                            <input type="time" value={slot.end} onChange={e => updateSlot(dow.val, slot.id, 'end', e.target.value)} className="p-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-lg text-sm flex-1 focus:ring-2 focus:ring-purple-500 outline-none" />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </AccordionItem>

      {/* 📦 アコーディオン2：Google連携のみに特化！ */}
      <AccordionItem 
        title="データ引き継ぎ・連携" 
        icon={<Settings className="text-gray-700 dark:text-gray-300" size={24} />}
        borderColorClass="border-gray-500"
      >
        <div className="mt-2">
          {user ? (
            <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 flex flex-col items-center gap-3">
              <div className="text-green-600 dark:text-green-400 font-bold flex items-center gap-2 text-xl">
                <CheckCircle2 size={28} /> 連携完了！
              </div>
              <p className="text-sm font-bold text-gray-700 dark:text-gray-300">
                {user.email}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-2 mb-2">
                データは安全にバックアップされています。スマホを変えても、このアカウントでログインすればすぐに続きから使えます！
              </p>
              <button 
                onClick={handleLogout}
                className="px-6 py-2 text-sm font-bold text-gray-500 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                ログアウト
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center text-center gap-5 p-2">
              <p className="text-sm text-gray-600 dark:text-gray-400 font-bold leading-relaxed">
                Googleアカウントと連携すると、今後のデータが自動でバックアップされ、カレンダーの予定と完全に同期できるようになります！
              </p>
              <div className="w-full max-w-sm">
                <GoogleLoginButton />
              </div>
            </div>
          )}
        </div>
      </AccordionItem>
    </div>
  );
}