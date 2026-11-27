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
  Clock,
  SlidersHorizontal,
  X,
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
  { label: '日', full: '日曜日', val: 0 },
  { label: '月', full: '月曜日', val: 1 },
  { label: '火', full: '火曜日', val: 2 },
  { label: '水', full: '水曜日', val: 3 },
  { label: '木', full: '木曜日', val: 4 },
  { label: '金', full: '金曜日', val: 5 },
  { label: '土', full: '土曜日', val: 6 },
];

const hasNonBatsuSlot = (r: WeeklyRoutine | null): boolean => {
  if (!r || typeof r !== 'object') return false;
  return Object.values(r).some(
    arr => Array.isArray(arr) && arr.some(s => s.status === 'maru' || s.status === 'sankaku')
  );
};

const getDowBadgeClass = (val: number, hasSlots: boolean) => {
  if (val === 0) {
    return hasSlots
      ? 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300'
      : 'bg-red-50 text-red-500 dark:bg-red-950/30 dark:text-red-400';
  }
  if (val === 6) {
    return hasSlots
      ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300'
      : 'bg-blue-50 text-blue-500 dark:bg-blue-950/30 dark:text-blue-400';
  }
  return hasSlots
    ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'
    : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400';
};

function StatusSegmentPicker({
  value,
  onChange,
  compact = false,
}: {
  value: Status;
  onChange: (next: Status) => void;
  compact?: boolean;
}) {
  return (
    <div className="flex items-center bg-gray-100 dark:bg-gray-800 p-0.5 rounded-lg border border-gray-200/80 dark:border-gray-700 gap-0.5 shrink-0">
      {(['maru', 'sankaku', 'batsu'] as Status[]).map(st => {
        const isActive = value === st;
        const activeStyle =
          st === 'maru'
            ? 'bg-green-50 dark:bg-green-900/40 border-green-300 dark:border-green-700 shadow-xs'
            : st === 'sankaku'
            ? 'bg-orange-50 dark:bg-orange-900/40 border-orange-300 dark:border-orange-700 shadow-xs'
            : 'bg-red-50 dark:bg-red-900/40 border-red-300 dark:border-red-700 shadow-xs';
        return (
          <button
            key={st}
            type="button"
            onClick={() => onChange(st)}
            className={`${compact ? 'px-1.5 py-0.5 text-xs sm:text-sm' : 'px-2.5 py-1 text-sm'} rounded-md border transition ${
              isActive ? activeStyle : 'border-transparent opacity-40 hover:opacity-80'
            }`}
          >
            {st === 'maru' ? '⭕️' : st === 'sankaku' ? '🔺' : '❌'}
          </button>
        );
      })}
    </div>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const [deviceGuestId, setDeviceGuestId] = useState('');
  const [user, setUser] = useState<any>(null);

  const [routine, setRoutine] = useState<WeeklyRoutine>(EMPTY_ROUTINE);
  const [routineMemory, setRoutineMemory] = useState<Record<number, RoutineSlot[]>>({});
  const [isDetailedMode, setIsDetailedMode] = useState(false);
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

    if (localStorage.getItem('routineDetailedMode') === 'true') {
      setIsDetailedMode(true);
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
      let activeRoutine: WeeklyRoutine | null = null;

      if (hasAnyRoutineSlot(localRoutine)) {
        activeRoutine = localRoutine;
        if (!remoteRoutine) {
          await syncRoutineToSupabase(supabase, guestId, localRoutine);
        }
      } else if (remoteRoutine && hasAnyRoutineSlot(remoteRoutine)) {
        activeRoutine = remoteRoutine;
        setRoutine(remoteRoutine);
        localStorage.setItem('weeklyRoutine', JSON.stringify(remoteRoutine));
      }

      if (activeRoutine && hasNonBatsuSlot(activeRoutine)) {
        setIsDetailedMode(true);
        localStorage.setItem('routineDetailedMode', 'true');
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

  const handleModeChange = (nextDetailed: boolean) => {
    if (nextDetailed === isDetailedMode) return;
    if (nextDetailed) {
      setIsDetailedMode(true);
      localStorage.setItem('routineDetailedMode', 'true');
      return;
    }

    if (hasNonBatsuSlot(routine)) {
      if (
        !confirm(
          '現在「◯」や「△」で設定されている枠があります。\n「時間だけ入力」に切り替えると、登録済みの枠はすべて「×（予定あり）」に統一されます。よろしいですか？'
        )
      ) {
        return;
      }
      const normalized: WeeklyRoutine = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
      for (let dow = 0; dow <= 6; dow++) {
        normalized[dow] = (routine[dow] || []).map(s => ({ ...s, status: 'batsu' }));
      }
      saveRoutine(normalized);
      showToast('登録済みの枠をすべて予定あり（×）に統一しました', 'info');
    }

    setBulkStatus('batsu');
    setIsDetailedMode(false);
    localStorage.setItem('routineDetailedMode', 'false');
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
      const currentTimes = (routine[dow] || []).filter(s => !s.isAllDay);
      setRoutineMemory(prev => ({ ...prev, [dow]: currentTimes }));
      const allDaySlot: RoutineSlot = { id: generateId(), isAllDay: true, start: '', end: '', status: 'batsu' };
      saveRoutine({ ...routine, [dow]: [allDaySlot] });
    } else {
      const mem = routineMemory[dow];
      saveRoutine({ ...routine, [dow]: mem && mem.length > 0 ? mem : [] });
    }
  };

  const addSlot = (dow: number) => {
    const current = (routine[dow] || []).filter(s => !s.isAllDay);
    let start = '09:00';
    let end = '17:00';
    if (current.length > 0) {
      const last = current[current.length - 1];
      if (last.end && last.end < '18:00') {
        start = '18:00';
        end = '21:00';
      } else {
        start = '19:00';
        end = '22:00';
      }
    }
    const newSlot: RoutineSlot = { id: generateId(), isAllDay: false, start, end, status: 'batsu' };
    saveRoutine({ ...routine, [dow]: [...current, newSlot] });
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

    const targetStatus: Status = isDetailedMode ? bulkStatus : 'batsu';
    const nextRoutine: WeeklyRoutine = { ...routine };
    bulkDows.forEach(dow => {
      if (bulkIsAllDay) {
        nextRoutine[dow] = [{ id: generateId(), isAllDay: true, start: '', end: '', status: targetStatus }];
      } else {
        const current = (nextRoutine[dow] || []).filter(s => !s.isAllDay);
        nextRoutine[dow] = [
          ...current,
          { id: generateId(), isAllDay: false, start: bulkStart, end: bulkEnd, status: targetStatus },
        ];
      }
    });

    saveRoutine(nextRoutine);
    const dowText = DOW_LABELS.filter(d => bulkDows.includes(d.val))
      .map(d => d.label)
      .join('・');
    showToast(`${dowText}曜日に追加しました✨`, 'success');
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
    <div className="max-w-xl mx-auto px-4 pb-20 space-y-5 [overflow-anchor:none]">
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

      {/* 上部追従ナビゲーションバー */}
      <div className="sticky top-0 z-40 h-14 -mx-4 px-4 bg-white/95 dark:bg-[#0a0a0a]/95 backdrop-blur-md border-b border-gray-100 dark:border-gray-800/80 flex items-center justify-between">
        <button
          type="button"
          onClick={() => {
            const returnPath = localStorage.getItem('returnPath') || '/';
            router.push(returnPath);
          }}
          className="inline-flex items-center gap-1.5 text-sm bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 px-3.5 py-2 rounded-lg font-bold hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors shadow-sm whitespace-nowrap"
        >
          <ArrowLeft size={16} /> 戻る
        </button>
        <h1 className="text-lg sm:text-xl font-extrabold text-gray-800 dark:text-gray-100 tracking-tight whitespace-nowrap">
          ⚙️ 設定
        </h1>
        <div className="w-16" />
      </div>

      {/* カード1：固定シフト */}
      <section className="bg-white dark:bg-gray-900 rounded-xl shadow-md px-4 sm:px-5 pb-6 relative">
        {/* カード最上部の追従ヘッダー（紫アクセントライン＋タイトル＋自動保存＋全クリア） */}
        <div className="sticky top-14 z-30 -mx-4 sm:-mx-5 bg-white dark:bg-[#0a0a0a]">
          <div className="bg-white dark:bg-gray-900 border-t-4 border-t-purple-500 rounded-t-xl px-4 sm:px-5 pt-3.5 pb-3 border-b border-gray-100 dark:border-gray-800 shadow-[0_2px_4px_-2px_rgba(0,0,0,0.06)] flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <CalendarDays className="text-purple-600 dark:text-purple-400 shrink-0" size={19} />
              <h2 className="text-sm sm:text-lg font-extrabold text-gray-800 dark:text-gray-100 whitespace-nowrap">
                固定シフト
              </h2>
              <span className="text-[11px] font-bold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-800/50 px-2 py-0.5 rounded-full whitespace-nowrap shrink-0">
                {totalRoutineSlots}枠
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
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
        </div>

        <div className="space-y-4 pt-4">

        {/* 2択モード切り替えセグメントバー & 1行ガイド */}
        <div className="space-y-2">
          <div
            role="tablist"
            aria-label="シフト入力モード"
            className="grid grid-cols-2 gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl"
          >
            <button
              type="button"
              role="tab"
              aria-selected={!isDetailedMode}
              onClick={() => handleModeChange(false)}
              className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs sm:text-sm transition whitespace-nowrap ${
                !isDetailedMode
                  ? 'bg-white dark:bg-gray-700 text-purple-700 dark:text-purple-300 shadow-xs font-extrabold'
                  : 'text-gray-500 dark:text-gray-400 font-bold hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              <Clock size={14} className="shrink-0" />
              <span>時間だけ入力</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={isDetailedMode}
              onClick={() => handleModeChange(true)}
              className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs sm:text-sm transition whitespace-nowrap ${
                isDetailedMode
                  ? 'bg-white dark:bg-gray-700 text-purple-700 dark:text-purple-300 shadow-xs font-extrabold'
                  : 'text-gray-500 dark:text-gray-400 font-bold hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              <SlidersHorizontal size={14} className="shrink-0" />
              <span>◯・△も設定する</span>
            </button>
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed px-0.5">
            {isDetailedMode
              ? '曜日・時間帯ごとに ⭕️・🔺・❌ を使い分けて登録し、回答画面でワンタップ反映できます。'
              : 'バイトや授業など予定がある時間を入れておくと、回答画面でワンタップで自動的に ❌ にできます。'}
          </p>
        </div>

        {/* スリム化したまとめて追加バー */}
        <div className="bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200/70 dark:border-purple-800/40 rounded-xl p-3 sm:p-3.5 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] sm:text-xs font-bold text-purple-800 dark:text-purple-300 flex items-center gap-1 whitespace-nowrap">
              <Sparkles size={13} className="shrink-0" />
              まとめて追加
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
              平日を選択
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1.5">
            {DOW_LABELS.map(dow => {
              const selected = bulkDows.includes(dow.val);
              const unselectedColor =
                dow.val === 0
                  ? 'text-red-500 dark:text-red-400'
                  : dow.val === 6
                  ? 'text-blue-500 dark:text-blue-400'
                  : 'text-gray-700 dark:text-gray-200';
              return (
                <button
                  key={dow.val}
                  type="button"
                  onClick={() => toggleBulkDow(dow.val)}
                  className={`py-1.5 rounded-lg text-xs font-bold border transition ${
                    selected
                      ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                      : `bg-white dark:bg-gray-800 ${unselectedColor} border-purple-200/80 dark:border-gray-700 hover:bg-purple-100/60`
                  }`}
                >
                  {dow.label}
                </button>
              );
            })}
          </div>

          {/* 3段目: 終日ピル & 時間入力（詳細モード時は◯△×ピッカーも表示） */}
          {isDetailedMode ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setBulkIsAllDay(prev => !prev)}
                  className={`inline-flex items-center gap-1.5 px-2.5 h-8 rounded-lg text-xs font-bold border transition whitespace-nowrap ${
                    bulkIsAllDay
                      ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                      : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-purple-200/80 dark:border-gray-700 hover:border-purple-400'
                  }`}
                >
                  {bulkIsAllDay ? (
                    <Check size={12} strokeWidth={3} />
                  ) : (
                    <span className="w-2.5 h-2.5 rounded-[3px] border border-gray-300 dark:border-gray-600 inline-block" />
                  )}
                  終日
                </button>
                <StatusSegmentPicker value={bulkStatus} onChange={setBulkStatus} />
              </div>

              {!bulkIsAllDay && (
                <div className="flex items-center justify-between bg-white dark:bg-gray-800 px-3 h-9 rounded-lg border border-purple-200/80 dark:border-gray-700">
                  <input
                    type="time"
                    value={bulkStart}
                    onChange={e => setBulkStart(e.target.value)}
                    className="bg-transparent dark:text-gray-100 text-xs sm:text-sm font-semibold flex-1 min-w-0 outline-none text-center"
                  />
                  <span className="text-gray-400 text-xs px-1 shrink-0">〜</span>
                  <input
                    type="time"
                    value={bulkEnd}
                    onChange={e => setBulkEnd(e.target.value)}
                    className="bg-transparent dark:text-gray-100 text-xs sm:text-sm font-semibold flex-1 min-w-0 outline-none text-center"
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setBulkIsAllDay(prev => !prev)}
                className={`inline-flex items-center gap-1.5 px-2.5 h-9 rounded-lg text-xs font-bold border transition whitespace-nowrap shrink-0 ${
                  bulkIsAllDay
                    ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-purple-200/80 dark:border-gray-700 hover:border-purple-400'
                }`}
              >
                {bulkIsAllDay ? (
                  <Check size={12} strokeWidth={3} />
                ) : (
                  <span className="w-2.5 h-2.5 rounded-[3px] border border-gray-300 dark:border-gray-600 inline-block" />
                )}
                終日
              </button>

              {bulkIsAllDay ? (
                <div className="flex-1 min-w-0 h-9 flex items-center justify-center rounded-lg bg-purple-100/70 dark:bg-purple-900/30 border border-purple-200/70 dark:border-purple-800/40 text-xs font-bold text-purple-700 dark:text-purple-300">
                  終日（0:00 〜 23:59）
                </div>
              ) : (
                <div className="flex-1 min-w-0 flex items-center justify-between bg-white dark:bg-gray-800 px-2.5 h-9 rounded-lg border border-purple-200/80 dark:border-gray-700">
                  <input
                    type="time"
                    value={bulkStart}
                    onChange={e => setBulkStart(e.target.value)}
                    className="bg-transparent dark:text-gray-100 text-xs sm:text-sm font-semibold flex-1 min-w-0 outline-none text-center"
                  />
                  <span className="text-gray-400 text-xs px-1 shrink-0">〜</span>
                  <input
                    type="time"
                    value={bulkEnd}
                    onChange={e => setBulkEnd(e.target.value)}
                    className="bg-transparent dark:text-gray-100 text-xs sm:text-sm font-semibold flex-1 min-w-0 outline-none text-center"
                  />
                </div>
              )}
            </div>
          )}

          {/* 4段目: 追加ボタン */}
          <button
            type="button"
            onClick={handleBulkAddRoutine}
            className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-xs sm:text-sm font-bold rounded-lg shadow-xs transition flex items-center justify-center gap-1.5"
          >
            <Plus size={15} />
            <span>
              {bulkDows.length > 0
                ? (() => {
                    const selectedDowText = DOW_LABELS.filter(d => bulkDows.includes(d.val))
                      .map(d => d.label)
                      .join('・');
                    if (!isDetailedMode) return `${selectedDowText}曜日に追加する`;
                    const mark = bulkStatus === 'maru' ? '⭕️' : bulkStatus === 'sankaku' ? '🔺' : '❌';
                    return `${selectedDowText}曜日に ${mark} で追加する`;
                  })()
                : '選んだ曜日にまとめて追加'}
            </span>
          </button>
        </div>

        {/* 7曜日のフラット週間スケジュールボード */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800 overflow-hidden bg-white dark:bg-gray-900">
          {DOW_LABELS.map(dow => {
            const dowSlots = routine[dow.val] || [];
            const allDay = isDowAllDay(dow.val);
            const hasSlots = dowSlots.length > 0;
            const rowBgClass = allDay
              ? 'bg-purple-50/35 dark:bg-purple-950/15'
              : hasSlots
              ? 'bg-white dark:bg-gray-900'
              : 'bg-gray-50/40 dark:bg-gray-900/40';

            return (
              <div key={dow.val} className={`px-3 sm:px-3.5 py-2.5 transition-colors ${rowBgClass}`}>
                {/* 1段目: 曜日バッジ + 終日ピル（全状態で左位置を統一） & 右側アクション */}
                <div className="flex items-center justify-between gap-2 min-h-[32px]">
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-extrabold shrink-0 ${getDowBadgeClass(
                        dow.val,
                        hasSlots
                      )}`}
                    >
                      {dow.label}
                    </span>

                    <button
                      type="button"
                      onClick={() => toggleDowAllDay(dow.val, !allDay)}
                      className={
                        allDay
                          ? 'inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-purple-600 text-white shadow-xs transition whitespace-nowrap'
                          : 'inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-bold text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-purple-300 hover:text-purple-600 transition whitespace-nowrap'
                      }
                    >
                      {allDay ? (
                        <Check size={12} strokeWidth={3} />
                      ) : (
                        <span className="w-2.5 h-2.5 rounded-[3px] border border-gray-300 dark:border-gray-600 inline-block" />
                      )}
                      終日
                    </button>
                  </div>

                  {/* 右側: 状態別 */}
                  <div className="flex items-center shrink-0">
                    {!hasSlots ? (
                      <button
                        type="button"
                        onClick={() => addSlot(dow.val)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-purple-300 hover:text-purple-600 transition whitespace-nowrap"
                      >
                        <Plus size={13} /> 時間追加
                      </button>
                    ) : allDay ? (
                      isDetailedMode ? (
                        <StatusSegmentPicker
                          value={dowSlots[0].status}
                          onChange={st => updateSlot(dow.val, dowSlots[0].id, 'status', st)}
                          compact
                        />
                      ) : (
                        <span className="text-xs font-bold text-purple-700/80 dark:text-purple-300/80 whitespace-nowrap">
                          終日（0:00〜23:59）
                        </span>
                      )
                    ) : (
                      <button
                        type="button"
                        onClick={() => addSlot(dow.val)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-bold text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30 transition whitespace-nowrap"
                      >
                        <Plus size={13} /> 枠を追加
                      </button>
                    )}
                  </div>
                </div>

                {/* 2段目: 個別時間枠リスト */}
                {!allDay && hasSlots && (
                  <div className={`mt-2 space-y-1.5 ${isDetailedMode ? 'sm:pl-9' : 'pl-9'}`}>
                    {dowSlots.map(slot => {
                      const capsuleStatusClass =
                        isDetailedMode && slot.status === 'maru'
                          ? 'border-green-300/90 dark:border-green-800/60 bg-green-50/35 dark:bg-green-950/15'
                          : isDetailedMode && slot.status === 'sankaku'
                          ? 'border-orange-300/90 dark:border-orange-800/60 bg-orange-50/35 dark:bg-orange-950/15'
                          : 'border-gray-200/90 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80';

                      return (
                        <div key={slot.id} className="flex items-center justify-between gap-1.5">
                          <div
                            className={`flex-1 min-w-0 flex items-center justify-between border rounded-lg transition focus-within:border-purple-400 focus-within:bg-white dark:focus-within:bg-gray-800 ${capsuleStatusClass} ${
                              isDetailedMode ? 'px-1.5 py-1' : 'px-3 py-1.5'
                            }`}
                          >
                            <input
                              type="time"
                              value={slot.start}
                              onChange={e => updateSlot(dow.val, slot.id, 'start', e.target.value)}
                              className="bg-transparent text-gray-800 dark:text-gray-100 text-xs sm:text-sm font-semibold min-w-0 flex-1 outline-none text-center"
                            />
                            <span className="text-gray-400 text-xs px-0.5 shrink-0">〜</span>
                            <input
                              type="time"
                              value={slot.end}
                              onChange={e => updateSlot(dow.val, slot.id, 'end', e.target.value)}
                              className="bg-transparent text-gray-800 dark:text-gray-100 text-xs sm:text-sm font-semibold min-w-0 flex-1 outline-none text-center"
                            />
                          </div>

                          {isDetailedMode && (
                            <StatusSegmentPicker
                              value={slot.status}
                              onChange={st => updateSlot(dow.val, slot.id, 'status', st)}
                              compact
                            />
                          )}

                          <button
                            type="button"
                            onClick={() => removeSlot(dow.val, slot.id)}
                            className="text-gray-400 hover:text-red-500 p-1 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 transition shrink-0"
                            title="枠を削除"
                          >
                            <X size={15} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
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
