import { useState } from 'react';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { CalendarCheck, History as HistoryIcon, ChevronRight, ChevronDown, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { getFixedDate, formatSlotTime } from '@/lib/utils';
import { useTopPageLogic } from '@/app/hooks/useTopPageLogic';

type Props = { logic: ReturnType<typeof useTopPageLogic> };

export default function TopMyScheduleTab({ logic }: Props) {
  // 💡 見た目だけの状態（過去の予定を開くかどうか）
  const [showPast, setShowPast] = useState(false);

  const now = new Date();
  const upcomingSchedules = logic.mySchedules.filter(s => getFixedDate(s.end_at) >= now);
  const pastSchedules = logic.mySchedules.filter(s => getFixedDate(s.end_at) < now);

  const renderSchedule = (schedule: any, i: number, list: any[]) => {
    const isFirstOfDay = i === 0 || format(getFixedDate(list[i - 1].start_at), 'yyyy-MM-dd') !== format(getFixedDate(schedule.start_at), 'yyyy-MM-dd');
    return (
      <div key={schedule.id}>
        {isFirstOfDay && (
          <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 mb-2 mt-4 border-b dark:border-gray-700 pb-1">
            {format(getFixedDate(schedule.start_at), 'yyyy年M月d日 (E)', { locale: ja })}
          </h3>
        )}
        {/* 💡 ここから！ div を Link に変えて、イベントページへのURLを指定！ */}
        <Link href={`/event/${schedule.event_id}`} className="block bg-white dark:bg-gray-800 border-2 border-yellow-300 dark:border-yellow-600 p-4 rounded-xl shadow-sm hover:bg-yellow-50 dark:hover:bg-gray-700 transition-colors group">
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs bg-yellow-400 text-white px-2 py-1 rounded-full font-bold shadow-sm">📌 仮確定</span>
              <span className="font-extrabold text-lg text-gray-800 dark:text-gray-100 group-hover:text-yellow-600 dark:group-hover:text-yellow-400 transition-colors">
                {formatSlotTime(schedule.start_at, schedule.end_at)}
              </span>
            </div>
            {/* 💡 飛べることのアピールアイコン */}
            <ChevronRight size={18} className="text-gray-400 group-hover:text-yellow-500 transition-colors" />
          </div>
          <p className="text-sm text-gray-700 dark:text-gray-300 font-bold truncate pr-4">{schedule.eventTitle}</p>
        </Link>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      
      {/* 〜〜 マイ予定エリア 〜〜 */}
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-md p-6 border-t-4 border-yellow-400">
        <div className="flex items-center gap-2 mb-6 text-yellow-600 dark:text-yellow-500">
          <CalendarCheck size={24} />
          <h2 className="text-xl font-bold dark:text-gray-100">あなたが参加する確定予定</h2>
        </div>
        
        {logic.fetchingSchedules ? (
          <p className="text-center text-gray-500 py-10">読み込み中...</p>
        ) : logic.mySchedules.length === 0 ? (
          <div className="text-center py-6 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <p className="text-gray-500 font-bold">まだ確定した予定はありません。</p>
          </div>
        ) : (
          <div className="space-y-4">
            {upcomingSchedules.length > 0 ? (
              upcomingSchedules.map((s, i) => renderSchedule(s, i, upcomingSchedules))
            ) : (
              <p className="text-center text-gray-500 font-bold py-4">今後の予定はありません。</p>
            )}

            {pastSchedules.length > 0 && (
              <div className="pt-6 mt-4 border-t border-gray-100 dark:border-gray-800">
                <button 
                  onClick={() => setShowPast(!showPast)} 
                  className="w-full flex items-center justify-center gap-2 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 font-bold rounded-xl transition-colors border border-gray-200 dark:border-gray-700"
                >
                  {showPast ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                  終了した過去の予定 ({pastSchedules.length}件)
                </button>
                
                {showPast && (
                  <div className="mt-4 space-y-4 animate-fade-in">
                    {pastSchedules.map((s, i) => renderSchedule(s, i, pastSchedules))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 〜〜 履歴エリア（横スクロール化！） 〜〜 */}
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-md pt-6 pb-2 border-t-4 border-blue-400 overflow-hidden">
        <div className="flex items-center gap-2 mb-4 px-6 text-blue-600 dark:text-blue-400">
          <HistoryIcon size={24} />
          <h2 className="text-xl font-bold dark:text-gray-100">最近見た・調整中のイベント</h2>
        </div>
        
        {logic.recentEvents.length === 0 ? (
          <div className="px-6 pb-6">
            <p className="text-center text-gray-500 py-6 bg-gray-50 dark:bg-gray-800 rounded-lg font-bold">まだ履歴がありません。</p>
          </div>
        ) : (
          /* 💡 横スクロール（カルーセル）の設定！スマホでめっちゃ気持ちよくスワイプできる！ */
          <div className="flex overflow-x-auto gap-4 px-6 pb-6 pt-2 snap-x snap-mandatory [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {logic.recentEvents.map(re => (
              <Link 
                key={re.id} 
                href={`/event/${re.id}`} 
                className="min-w-[260px] snap-start shrink-0 block bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 rounded-xl hover:bg-blue-50 dark:hover:bg-gray-700 transition shadow-sm group relative"
              >
                <div className="flex justify-between items-start mb-4 pr-6">
                  <span className="font-bold text-gray-800 dark:text-gray-100 line-clamp-2 leading-tight">{re.title}</span>
                </div>
                <div className="flex items-center justify-between mt-auto">
                  <div className="flex items-center gap-1 text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800/50 px-3 py-1.5 rounded-lg transition shrink-0">
                    開く <ChevronRight size={14} />
                  </div>
                </div>
                <button 
                  onClick={(e) => logic.removeRecentEvent(e, re.id)} 
                  className="absolute right-2 top-2 p-2 text-gray-300 hover:text-red-500 transition-colors z-10 bg-white/50 dark:bg-gray-800/50 rounded-full" 
                  title="履歴から削除"
                >
                  <Trash2 size={16} />
                </button>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}