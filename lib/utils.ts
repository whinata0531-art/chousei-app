// lib/utils.ts

import { format } from 'date-fns';
// 💡 locale/ja が使われていない場合は消してもOKだけど、念のため入れておく！
import { ja } from 'date-fns/locale'; 

// 💡 データベースの文字列を正しい時間（Date型）に変換する関数
export const getFixedDate = (dbDateStr: string) => {
  return new Date(dbDateStr.substring(0, 16));
};

// 💡 開始時間と終了時間から「12:00 〜 14:00」や「終日」の文字列を作る関数
export const formatSlotTime = (startStr: string, endStr: string) => {
  const sTime = format(getFixedDate(startStr), 'HH:mm');
  const eTime = format(getFixedDate(endStr), 'HH:mm');
  if (sTime === '00:00' && eTime === '23:59') return '終日';
  return `${sTime} 〜 ${eTime}`;
};

// HTTPS環境なら本物を、HTTP環境（スマホテスト等）なら代用品を使う自家製IDツール
export const generateId = () => {
  return (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
    ? crypto.randomUUID()
    : Math.random().toString(36).substring(2) + Date.now().toString(36);
};

// 💡 曜日ごとの固定シフトが1件以上設定されているか判定
export const hasAnyRoutineSlot = (routine: any): boolean => {
  if (!routine || typeof routine !== 'object') return false;
  return Object.values(routine).some(arr => Array.isArray(arr) && arr.length > 0);
};

// 💡 曜日ごとの固定シフトを Supabase (user_smart_copies) に保存・同期する
export const syncRoutineToSupabase = async (supabase: any, guestId: string, routine: any) => {
  if (!guestId || !routine) return;
  try {
    // 既存の ROUTINE::* レコードを一旦クリア
    await supabase
      .from('user_smart_copies')
      .delete()
      .eq('guest_id', guestId)
      .like('time_key', 'ROUTINE::%');

    const rows: { guest_id: string; time_key: string; status: string; updated_at: number }[] = [];
    const now = Date.now();
    for (let dow = 0; dow <= 6; dow++) {
      const slots = routine[dow] || [];
      if (!Array.isArray(slots)) continue;
      for (const s of slots) {
        const rangeStr = s.isAllDay ? 'ALLDAY' : `${s.start}-${s.end}`;
        rows.push({
          guest_id: guestId,
          time_key: `ROUTINE::${dow}::${rangeStr}::${s.id || generateId()}`,
          status: s.status,
          updated_at: now,
        });
      }
    }
    if (rows.length > 0) {
      await supabase
        .from('user_smart_copies')
        .upsert(rows, { onConflict: 'guest_id,time_key' });
    }
  } catch (e) {
    console.error('シフトのクラウド保存に失敗:', e);
  }
};

// 💡 Supabase の user_smart_copies の行配列から ROUTINE::* を復元する
export const parseRoutineFromSmartCopyRows = (rows: any[]) => {
  const routine: Record<number, any[]> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
  let found = false;
  for (const r of rows) {
    if (typeof r.time_key !== 'string' || !r.time_key.startsWith('ROUTINE::')) continue;
    const parts = r.time_key.split('::');
    if (parts.length < 4) continue;
    const dow = Number(parts[1]);
    if (isNaN(dow) || dow < 0 || dow > 6) continue;
    const rangeStr = parts[2];
    const slotId = parts.slice(3).join('::');
    const isAllDay = rangeStr === 'ALLDAY';
    let start = '12:00';
    let end = '18:00';
    if (!isAllDay && rangeStr.includes('-')) {
      const [s, e] = rangeStr.split('-');
      start = s;
      end = e;
    }
    routine[dow].push({
      id: slotId,
      isAllDay,
      start: isAllDay ? '' : start,
      end: isAllDay ? '' : end,
      status: r.status,
    });
    found = true;
  }
  return found ? routine : null;
};