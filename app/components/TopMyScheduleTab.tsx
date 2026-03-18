// app/components/TopMyScheduleTab.tsx
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { CalendarCheck, History as HistoryIcon, ChevronRight, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { getFixedDate } from '@/lib/utils';
import { useTopPageLogic } from '@/app/hooks/useTopPageLogic';

type Props = { logic: ReturnType<typeof useTopPageLogic> };

export default function TopMyScheduleTab({ logic }: Props) {
  return (
    <div className="space-y-6">
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
            {logic.mySchedules.map((schedule, i) => {
              const isFirstOfDay = i === 0 || format(getFixedDate(logic.mySchedules[i - 1].start_at), 'yyyy-MM-dd') !== format(getFixedDate(schedule.start_at), 'yyyy-MM-dd');
              return (
                <div key={schedule.id}>
                  {isFirstOfDay && (
                    <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 mb-2 mt-4 border-b dark:border-gray-700 pb-1">
                      {format(getFixedDate(schedule.start_at), 'yyyy年M月d日 (E)', { locale: ja })}
                    </h3>
                  )}
                  <div className="block bg-white dark:bg-gray-800 border-2 border-yellow-300 dark:border-yellow-600 p-4 rounded-xl shadow-sm">
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs bg-yellow-400 text-white px-2 py-1 rounded-full font-bold shadow-sm">📌 仮確定</span>
                        <span className="font-extrabold text-lg text-gray-800 dark:text-gray-100">
                          {format(getFixedDate(schedule.start_at), 'HH:mm')} 〜 {format(getFixedDate(schedule.end_at), 'HH:mm')}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300 font-bold truncate pr-4">{schedule.eventTitle}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-md p-6 border-t-4 border-blue-400">
        <div className="flex items-center gap-2 mb-6 text-blue-600 dark:text-blue-400">
          <HistoryIcon size={24} />
          <h2 className="text-xl font-bold dark:text-gray-100">最近見た・調整中のイベント</h2>
        </div>
        {logic.recentEvents.length === 0 ? <p className="text-center text-gray-500 py-6 bg-gray-50 dark:bg-gray-800 rounded-lg font-bold">まだ履歴がありません。</p> : (
          <div className="space-y-3">
            {logic.recentEvents.map(re => (
              <Link key={re.id} href={`/event/${re.id}`} className="block bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 rounded-xl hover:bg-blue-50 dark:hover:bg-gray-700 transition shadow-sm group relative">
                <div className="flex justify-between items-center pr-10">
                  <span className="font-bold text-gray-800 dark:text-gray-100 truncate">{re.title}</span>
                  <div className="flex items-center gap-1 text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800/50 px-3 py-2 rounded-lg transition shrink-0">開く <ChevronRight size={14} /></div>
                </div>
                <button onClick={(e) => logic.removeRecentEvent(e, re.id)} className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-red-500 transition-colors z-10" title="履歴から削除"><Trash2 size={18} /></button>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}