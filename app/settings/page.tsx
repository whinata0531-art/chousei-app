'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  CalendarDays,
  ArrowLeft,
  Trash2,
  Plus,
  CheckCircle2,
  CloudCheck,
  Sparkles,
  LogOut,
  Check,
  RefreshCw,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import {
  generateId,
  hasAnyRoutineSlot,
  syncRoutineToSupabase,
  parseRoutineFromSmartCopyRows,
} from '../../lib/utils';
import GoogleLoginButton from '../components/GoogleLoginButton';

type Status = 'maru' | 'sankaku' | 'batsu';
type RoutineSlot = { id: string; isAllDay: boolean; start: string; end: string; status: Status };
type WeeklyRoutine = Record<number, RoutineSlot[]>;

const EMPTY_ROUTINE: WeeklyRoutine = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };

const DOW_LABELS = [
  { label: '日', full: '日曜日', val: 0, color: 'text-red-500' },
  { label: '月', full: '月曜日', val: 1, color: 'text-gray-700 dark:text-gray-200' },
  { label: '火', full: '火曜日', val: 2, color: 'text-gray-700 dark:text-gray-200' },
  { label: '水', full: '水曜日', val: 3, color: 'text-gray-700 dark:text-gray-200' },
  { label: '木', full: '木曜日', val: 4, color: 'text-gray-700 dark:text-gray-200' },
  { label: '金', full: '金曜日', val: 5, color: 'text-gray-700 dark:text-gray-200' },
  { label: '土', full: '土曜日', val: 6, color: 'text-blue-500' },
];

export default function SettingsPage() {
  const router = useRouter();
  const [deviceGuestId, setDeviceGuestId] = useState('');
  const [user, setUser] = useState<any>(null);

  const [routine, setRoutine] = useState<WeeklyRoutine>(EMPTY_ROUTINE);
  const [routineMemory, setRoutineMemory] = useState<Record<number, RoutineSlot[]>>({});
  const [saveBadge, setSaveBadge] = useState<'idle' | 'saved'>('idle');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  // まとめてシフト追加用の状態
  const [bulkDows, setBulkDows] = useState<number[]>([]);
  const [bulkIsAllDay, setBulkIsAllDay] = useState(false);
  const [bulkStart, setBulkStart] = useState('09:00');
  const [bulkEnd, setBulkEnd] = useState('17:00');
  const [bulkStatus, setBulkStatus] = useState<Status>('batsu');

  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(prev => (prev?.message === message ? null : prev));
    }, 3200);
  };

  useEffect(() => {
    // 回答画面の案内モーダルから飛んできた場合のトリガーフラグを掃除
    if (localStorage.getItem('openShiftAccordion') === 'true') {
      localStorage.removeItem('openShiftAccordion');
    }

    let currentGuestId = localStorage.getItem('deviceGuestId');
    if (!currentGuestId) {
      currentGuestId = generateId();
      localStorage.setItem('deviceGuestId', currentGuestId);
    }
    setDeviceGuestId(currentGuestId);

    // ローカルとSupabaseのシフト設定を同期する
    const loadAndSyncRoutine = async (guestId: string) => {
      let localRoutine: WeeklyRoutine | null = null;
      const savedRoutine = localStorage.getItem('weeklyRoutine');
      if (savedRoutine) {
        try {
          const parsed = JSON.parse(savedRoutine);
          if (typeof parsed[0] !== 'string') {
            localRoutine = parsed;
            setRoutine(parsed);
          }
        } catch {}
      }

      const { data: rows } = await supabase
        .from('user_smart_copies')
        .select('*')
        .eq('guest_id', guestId)
        .like('time_key', 'ROUTINE::%');

      const remoteRoutine = rows && rows.length > 0 ? parseRoutineFromSmartCopyRows(rows) : null;

      if (hasAnyRoutineSlot(localRoutine)) {
        if (!remoteRoutine) {
          await syncRoutineToSupabase(supabase, guestId, localRoutine);
        }
      } else if (remoteRoutine && hasAnyRoutineSlot(remoteRoutine)) {
        setRoutine(remoteRoutine);
        localStorage.setItem('weeklyRoutine', JSON.stringify(remoteRoutine));
      }
    };

    loadAndSyncRoutine(currentGuestId);

    const checkAuthAndMerge = async (session: any) => {
      if (session?.provider_token) {
        localStorage.setItem('google_provider_token', session.provider_token);
      }
      if (session?.provider_refresh_token) {
        localStorage.setItem('google_refresh_token', session.provider_refresh_token);
      }

      if (session?.user) {
        setUser(session.user);

        if (currentGuestId && currentGuestId !== session.user.id) {
          await Promise.all([
            supabase.from('events').update({ host_id: session.user.id }).eq('host_id', currentGuestId),
            supabase.from('responses').update({ guest_id: session.user.id }).eq('guest_id', currentGuestId),
            supabase.from('user_recent_events').update({ guest_id: session.user.id }).eq('guest_id', currentGuestId),
            supabase.from('user_smart_copies').update({ guest_id: session.user.id }).eq('guest_id', currentGuestId),
          ]);

          localStorage.setItem('deviceGuestId', session.user.id);
          setDeviceGuestId(session.user.id);
          currentGuestId = session.user.id;
          await loadAndSyncRoutine(session.user.id);

          showToast('🎉 Googleアカウントと過去のデータを紐付けました！', 'success');
        }
      }
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      checkAuthAndMerge(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.provider_token) {
        localStorage.setItem('google_provider_token', session.provider_token);
      }
      if (session?.provider_refresh_token) {
        localStorage.setItem('google_refresh_token', session.provider_refresh_token);
      }

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
        checkAuthAndMerge(session);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const saveRoutine = (newRoutine: WeeklyRoutine) => {
    setRoutine(newRoutine);
    localStorage.setItem('weeklyRoutine', JSON.stringify(newRoutine));
    const guestId = deviceGuestId || localStorage.getItem('deviceGuestId') || '';
    if (guestId) {
      syncRoutineToSupabase(supabase, guestId, newRoutine);
    }
    setSaveBadge('saved');
    setTimeout(() => setSaveBadge('idle'), 2000);
  };

  const totalRoutineSlots = useMemo(
    () => Object.values(routine).reduce((acc, arr) => acc + (Array.isArray(arr) ? arr.length : 0), 0),
    [routine]
  );

  const isDowAllDay = (dow: number) => {
    const slots = routine[dow];
    return slots && slots.length === 1 && slots[0].isAllDay;
  };

  const toggleDowAllDay = (dow: number, checked: boolean) => {
    if (checked) {
      setRoutineMemory(prev => ({ ...prev, [dow]: routine[dow] }));
      const allDaySlot: RoutineSlot = { id: generateId(), isAllDay: true, start: '', end: '', status: 'batsu' };
      saveRoutine({ ...routine, [dow]: [allDaySlot] });
    } else {
      const mem = routineMemory[dow];
      saveRoutine({ ...routine, [dow]: mem && mem.length > 0 ? mem : [] });
    }
  };

  const addSlot = (dow: number) => {
    const newSlot: RoutineSlot = { id: generateId(), isAllDay: false, start: '12:00', end: '18:00', status: 'batsu' };
    saveRoutine({ ...routine, [dow]: [...routine[dow], newSlot] });
  };

  const updateSlot = (dow: number, id: string, field: keyof RoutineSlot, value: any) => {
    const updatedSlots = routine[dow].map(s => (s.id === id ? { ...s, [field]: value } : s));
    saveRoutine({ ...routine, [dow]: updatedSlots });
  };

  const removeSlot = (dow: number, id: string) => {
    saveRoutine({ ...routine, [dow]: routine[dow].filter(s => s.id !== id) });
  };

  const clearAllRoutine = () => {
    if (totalRoutineSlots === 0) return;
    if (!confirm('登録されている固定シフトをすべてクリアしますか？')) return;
    setRoutineMemory({});
    saveRoutine({ 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] });
    showToast('固定シフトをすべてクリアしました', 'info');
  };

  const toggleBulkDow = (val: number) => {
    setBulkDows(prev => (prev.includes(val) ? prev.filter(d => d !== val) : [...prev, val]));
  };

  const toggleWeekdays = () => {
    const weekdays = [1, 2, 3, 4, 5];
    const allSelected = weekdays.every(d => bulkDows.includes(d)) && bulkDows.length === 5;
    setBulkDows(allSelected ? [] : weekdays);
  };

  const handleBulkAddRoutine = () => {
    if (bulkDows.length === 0) {
      showToast('追加したい曜日を選んでね！', 'info');
      return;
    }
    if (!bulkIsAllDay && (!bulkStart || !bulkEnd)) {
      showToast('開始時刻と終了時刻を入力してね！', 'error');
      return;
    }

    const nextRoutine: WeeklyRoutine = { ...routine };
    bulkDows.forEach(dow => {
      if (bulkIsAllDay) {
        nextRoutine[dow] = [{ id: generateId(), isAllDay: true, start: '', end: '', status: bulkStatus }];
      } else {
        const current = (nextRoutine[dow] || []).filter(s => !s.isAllDay);
        nextRoutine[dow] = [
          ...current,
          { id: generateId(), isAllDay: false, start: bulkStart, end: bulkEnd, status: bulkStatus },
        ];
      }
    });

    saveRoutine(nextRoutine);
    const dowText = DOW_LABELS.filter(d => bulkDows.includes(d.val))
      .map(d => d.label)
      .join('・');
    showToast(`${dowText}曜日にシフトを追加しました✨`, 'success');
    setBulkDows([]);
  };

  const handleLogout = async () => {
    if (confirm('ログアウトしますか？（保存済みのシフトや回答データは消えません）')) {
      localStorage.removeItem('google_provider_token');
      localStorage.removeItem('google_refresh_token');
      await supabase.auth.signOut();
      window.location.reload();
    }
  };

  return (
    <div className="max-w-xl mx-auto p-4 mt-4 space-y-6 pb-20">
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
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => {
            const returnPath = localStorage.getItem('returnPath') || '/';
            router.push(returnPath);
          }}
          className="inline-flex items-center gap-1.5 text-sm bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 px-3.5 py-2 rounded-lg font-bold hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors shadow-sm"
        >
          <ArrowLeft size={16} /> 戻る
        </button>
        <h1 className="text-xl font-extrabold text-gray-800 dark:text-gray-100 tracking-tight">⚙️ 設定</h1>
        <div className="w-16" />
      </div>

      {/* カード1：曜日ごとの固定シフト */}
      <section className="bg-white dark:bg-gray-900 rounded-xl shadow-md border-t-4 border-t-purple-500 px-5 pb-6 pt-5 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b dark:border-gray-800 pb-3">
          <div className="flex items-center gap-1.5 min-w-0">
            <CalendarDays className="text-purple-600 dark:text-purple-400 shrink-0" size={20} />
            <h2 className="text-base sm:text-lg font-extrabold text-gray-800 dark:text-gray-100 whitespace-nowrap">
              曜日ごとの固定シフト
            </h2>
            <span className="text-[11px] font-bold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-800/50 px-2 py-0.5 rounded-full whitespace-nowrap shrink-0">
              {totalRoutineSlots}枠
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 ml-auto">
            <span
              className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full transition-colors whitespace-nowrap ${
                saveBadge === 'saved'
                  ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
              }`}
            >
              {saveBadge === 'saved' ? <Check size={12} /> : <CloudCheck size={12} />}
              {saveBadge === 'saved' ? '保存しました' : '自動保存'}
            </span>
            {totalRoutineSlots > 0 && (
              <button
                type="button"
                onClick={clearAllRoutine}
                className="flex items-center gap-1 px-2 py-1 text-[11px] font-bold text-red-600 dark:text-red-400 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 border border-red-200 dark:border-red-800/50 rounded-md transition whitespace-nowrap"
              >
                <Trash2 size={12} />
                <span>全クリア</span>
              </button>
            )}
          </div>
        </div>

        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
          授業やバイトなど毎週の予定を登録しておくと、回答画面でワンタップで自動入力できます（クラウドに自動保存されます）。
        </p>

        {/* 曜日を選んでまとめて追加パネル */}
        <div className="bg-purple-50/70 dark:bg-purple-900/15 border border-purple-200 dark:border-purple-800/40 rounded-xl p-3.5 sm:p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] sm:text-xs font-bold text-purple-800 dark:text-purple-300 flex items-center gap-1 whitespace-nowrap">
              <Sparkles size={13} className="shrink-0" />
              曜日を選んでまとめて追加
            </span>
            <button
              type="button"
              onClick={toggleWeekdays}
              className={`text-[11px] font-bold px-2.5 py-1 rounded-full border transition whitespace-nowrap shrink-0 ${
                [1, 2, 3, 4, 5].every(d => bulkDows.includes(d)) && bulkDows.length === 5
                  ? 'bg-purple-600 text-white border-purple-600'
                  : 'bg-white dark:bg-gray-800 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-700 hover:bg-purple-100'
              }`}
            >
              平日まとめて選択
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1.5">
            {DOW_LABELS.map(dow => {
              const selected = bulkDows.includes(dow.val);
              return (
                <button
                  key={dow.val}
                  type="button"
                  onClick={() => toggleBulkDow(dow.val)}
                  className={`py-2 rounded-lg text-xs font-bold border transition ${
                    selected
                      ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-purple-200 dark:border-gray-700 hover:bg-purple-100/60'
                  }`}
                >
                  {dow.label}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="flex items-center gap-1.5 text-xs font-bold text-gray-700 dark:text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={bulkIsAllDay}
                onChange={e => setBulkIsAllDay(e.target.checked)}
                className="w-3.5 h-3.5 text-purple-600 rounded"
              />
              終日にする
            </label>

            <div className="flex bg-white dark:bg-gray-800 p-0.5 rounded-lg border border-purple-200 dark:border-gray-700 gap-1">
              <button
                type="button"
                onClick={() => setBulkStatus('maru')}
                className={`px-2.5 py-1 text-sm rounded-md transition ${
                  bulkStatus === 'maru'
                    ? 'bg-green-50 dark:bg-green-900/40 shadow-xs border border-green-300 dark:border-green-700'
                    : 'opacity-45 hover:opacity-80'
                }`}
              >
                ⭕️
              </button>
              <button
                type="button"
                onClick={() => setBulkStatus('sankaku')}
                className={`px-2.5 py-1 text-sm rounded-md transition ${
                  bulkStatus === 'sankaku'
                    ? 'bg-orange-50 dark:bg-orange-900/40 shadow-xs border border-orange-300 dark:border-orange-700'
                    : 'opacity-45 hover:opacity-80'
                }`}
              >
                🔺
              </button>
              <button
                type="button"
                onClick={() => setBulkStatus('batsu')}
                className={`px-2.5 py-1 text-sm rounded-md transition ${
                  bulkStatus === 'batsu'
                    ? 'bg-red-50 dark:bg-red-900/40 shadow-xs border border-red-300 dark:border-red-700'
                    : 'opacity-45 hover:opacity-80'
                }`}
              >
                ❌
              </button>
            </div>
          </div>

          {!bulkIsAllDay && (
            <div className="flex items-center gap-2 bg-white dark:bg-gray-800 p-2 rounded-lg border border-purple-200/80 dark:border-gray-700">
              <input
                type="time"
                value={bulkStart}
                onChange={e => setBulkStart(e.target.value)}
                className="p-1 bg-transparent dark:text-gray-100 text-sm flex-1 outline-none text-center"
              />
              <span className="text-gray-400 text-xs">〜</span>
              <input
                type="time"
                value={bulkEnd}
                onChange={e => setBulkEnd(e.target.value)}
                className="p-1 bg-transparent dark:text-gray-100 text-sm flex-1 outline-none text-center"
              />
            </div>
          )}

          <button
            type="button"
            onClick={handleBulkAddRoutine}
            className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-xs sm:text-sm font-bold rounded-lg shadow-xs transition flex items-center justify-center gap-1.5"
          >
            <Plus size={16} /> 選んだ曜日にまとめて追加する
          </button>
        </div>

        {/* 7曜日のスリム一覧 */}
        <div className="space-y-2.5">
          {DOW_LABELS.map(dow => {
            const dowSlots = routine[dow.val] || [];
            const allDay = isDowAllDay(dow.val);

            if (dowSlots.length === 0) {
              return (
                <div
                  key={dow.val}
                  className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-800/40"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`font-bold text-sm whitespace-nowrap ${dow.color}`}>{dow.full}</span>
                    <label className="flex items-center gap-1 text-[11px] font-bold text-blue-700 dark:text-blue-300 cursor-pointer bg-white dark:bg-gray-800 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800/50 whitespace-nowrap shrink-0">
                      <input
                        type="checkbox"
                        checked={false}
                        onChange={e => toggleDowAllDay(dow.val, e.target.checked)}
                        className="w-3 h-3 text-blue-600"
                      />
                      終日
                    </label>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => addSlot(dow.val)}
                      className="text-[11px] font-bold flex items-center gap-0.5 px-2.5 py-1 rounded-md bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 transition whitespace-nowrap"
                    >
                      <Plus size={12} /> 追加
                    </button>
                  </div>
                </div>
              );
            }

            if (allDay) {
              return (
                <div
                  key={dow.val}
                  className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl border border-blue-200 dark:border-blue-800/60 bg-blue-50/50 dark:bg-blue-900/15 shadow-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`font-bold text-sm whitespace-nowrap ${dow.color}`}>{dow.full}</span>
                    <label className="flex items-center gap-1 text-[11px] font-bold text-blue-700 dark:text-blue-300 cursor-pointer bg-white dark:bg-gray-800 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800/50 whitespace-nowrap shrink-0">
                      <input
                        type="checkbox"
                        checked={true}
                        onChange={e => toggleDowAllDay(dow.val, e.target.checked)}
                        className="w-3 h-3 text-blue-600"
                      />
                      終日
                    </label>
                  </div>
                  <div className="flex items-center shrink-0">
                    <div className="flex bg-gray-200/80 dark:bg-gray-700 p-0.5 rounded-md gap-0.5">
                      {(['maru', 'sankaku', 'batsu'] as Status[]).map(st => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => updateSlot(dow.val, dowSlots[0].id, 'status', st)}
                          className={`px-2 py-0.5 text-sm rounded transition ${
                            dowSlots[0].status === st
                              ? 'bg-white dark:bg-gray-600 shadow-xs font-bold'
                              : 'opacity-40 hover:opacity-75'
                          }`}
                        >
                          {st === 'maru' ? '⭕️' : st === 'sankaku' ? '🔺' : '❌'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={dow.val}
                className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden bg-white dark:bg-gray-900 shadow-xs"
              >
                <div className="bg-gray-50 dark:bg-gray-800/80 px-3.5 py-2 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`font-bold text-sm whitespace-nowrap ${dow.color}`}>{dow.full}</span>
                    <label className="flex items-center gap-1 text-[11px] font-bold text-blue-700 dark:text-blue-300 cursor-pointer bg-white dark:bg-gray-700 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800/50 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={false}
                        onChange={e => toggleDowAllDay(dow.val, e.target.checked)}
                        className="w-3 h-3 text-blue-600"
                      />
                      終日
                    </label>
                  </div>
                  <button
                    type="button"
                    onClick={() => addSlot(dow.val)}
                    className="text-[11px] font-bold flex items-center gap-0.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 px-2 py-1 rounded-md text-gray-700 dark:text-gray-200 hover:bg-gray-100 transition whitespace-nowrap"
                  >
                    <Plus size={12} /> 枠を追加
                  </button>
                </div>

                <div className="p-2.5 space-y-2">
                  {dowSlots.map(slot => (
                    <div
                      key={slot.id}
                      className="flex items-center justify-between gap-1.5 bg-gray-50 dark:bg-gray-800/70 px-2.5 py-2 rounded-lg border border-gray-200 dark:border-gray-700"
                    >
                      <div className="flex items-center gap-1 min-w-0 flex-1">
                        <input
                          type="time"
                          value={slot.start}
                          onChange={e => updateSlot(dow.val, slot.id, 'start', e.target.value)}
                          className="p-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 dark:text-gray-100 rounded text-xs sm:text-sm min-w-0 flex-1 max-w-[92px] outline-none focus:ring-1 focus:ring-purple-500"
                        />
                        <span className="text-gray-400 text-xs shrink-0">〜</span>
                        <input
                          type="time"
                          value={slot.end}
                          onChange={e => updateSlot(dow.val, slot.id, 'end', e.target.value)}
                          className="p-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 dark:text-gray-100 rounded text-xs sm:text-sm min-w-0 flex-1 max-w-[92px] outline-none focus:ring-1 focus:ring-purple-500"
                        />
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <div className="flex bg-gray-200/80 dark:bg-gray-700 p-0.5 rounded-md gap-0.5">
                          {(['maru', 'sankaku', 'batsu'] as Status[]).map(st => (
                            <button
                              key={st}
                              type="button"
                              onClick={() => updateSlot(dow.val, slot.id, 'status', st)}
                              className={`px-1.5 py-0.5 text-sm rounded transition ${
                                slot.status === st
                                  ? 'bg-white dark:bg-gray-600 shadow-xs'
                                  : 'opacity-40 hover:opacity-75'
                              }`}
                            >
                              {st === 'maru' ? '⭕️' : st === 'sankaku' ? '🔺' : '❌'}
                            </button>
                          ))}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeSlot(dow.val, slot.id)}
                          className="text-gray-400 hover:text-red-500 p-1 transition"
                          title="枠を削除"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* カード2：Googleアカウント・カレンダー連携 */}
      <section className="bg-white dark:bg-gray-900 rounded-xl shadow-md border-t-4 border-t-emerald-500 px-5 pb-6 pt-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b dark:border-gray-800 pb-3">
          <div className="flex items-center gap-2">
            <RefreshCw className="text-emerald-600 dark:text-emerald-400 shrink-0" size={19} />
            <h2 className="text-base sm:text-lg font-extrabold text-gray-800 dark:text-gray-100">
              Googleカレンダー連携・データ引き継ぎ
            </h2>
          </div>
          {user && (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 shrink-0">
              <CheckCircle2 size={12} /> 連携中
            </span>
          )}
        </div>

        {user ? (
          <div className="bg-emerald-50/60 dark:bg-emerald-900/15 p-5 rounded-xl border border-emerald-200 dark:border-emerald-800/40 flex flex-col items-center text-center gap-3">
            <div className="text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-1.5 text-base">
              <CheckCircle2 size={20} /> Google連携が完了しています
            </div>
            <p className="text-xs sm:text-sm font-bold text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700">
              {user.email}
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
              回答画面の「Googleカレンダーから自動反映」で予定が被っている枠を一発で ❌ にでき、スマホを変えても同じアカウントで履歴やシフトを引き継げます。
            </p>
            <button
              type="button"
              onClick={handleLogout}
              className="mt-1 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <LogOut size={14} /> ログアウト
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/70 border border-gray-200 dark:border-gray-700">
                <p className="font-bold text-gray-800 dark:text-gray-100 mb-1">📅 空き時間を自動判定</p>
                <p className="text-gray-500 dark:text-gray-400 leading-relaxed">
                  Googleカレンダーと照合し、予定が入っている候補枠をワンタップで ❌ にできます（予定内容は保存しません）。
                </p>
              </div>
              <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/70 border border-gray-200 dark:border-gray-700">
                <p className="font-bold text-gray-800 dark:text-gray-100 mb-1">☁️ 端末間のデータ引き継ぎ</p>
                <p className="text-gray-500 dark:text-gray-400 leading-relaxed">
                  機種変更や別ブラウザでも、作成した履歴・固定シフト・過去予定コピーをそのまま復元できます。
                </p>
              </div>
            </div>

            <div className="max-w-xs mx-auto space-y-2.5">
              <GoogleLoginButton />

              <div className="p-3 bg-yellow-50/90 dark:bg-yellow-900/20 rounded-xl text-[11px] text-yellow-800 dark:text-yellow-200 leading-relaxed border border-yellow-200 dark:border-yellow-800/40">
                <p className="font-bold mb-0.5">⚠️ 確認画面が出た場合（審査申請準備中）</p>
                <p className="opacity-90">
                  「Googleで確認されていません」と表示された場合は、左下の
                  <span className="font-bold bg-white/70 dark:bg-black/20 px-1 rounded mx-0.5">詳細</span>
                  ＞
                  <span className="font-bold bg-white/70 dark:bg-black/20 px-1 rounded mx-0.5">最強調整に移動</span>
                  から進めます（読み取り専用権限のみ使用しています）。
                </p>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* フッター */}
      <footer className="pt-2 text-center text-xs text-gray-400 dark:text-gray-500 flex items-center justify-center gap-4">
        <Link href="/terms" className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
          利用規約
        </Link>
        <span>·</span>
        <Link href="/privacy" className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
          プライバシーポリシー
        </Link>
      </footer>
    </div>
  );
}
