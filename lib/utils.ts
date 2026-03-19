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