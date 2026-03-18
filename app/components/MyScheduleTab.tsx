// app/components/MyScheduleTab.tsx
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { CalendarCheck } from 'lucide-react';
import { getFixedDate, formatSlotTime } from '@/lib/utils';
import { useEventLogic } from '../hooks/useEventLogic';

type Props = { logic: ReturnType<typeof useEventLogic> };

export default function MyScheduleTab({ logic }: Props) {
  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-md p-6 border-t-4 border-yellow-400 dark:border-yellow-500">
        <div className="flex items-center gap-2 mb-6 text-yellow-600 dark:text-yellow-500">
          <CalendarCheck size={24} />
          <h2 className="text-xl font-bold dark:text-gray-100">あなたが参加する確定予定</h2>
        </div>
        {logic.fetchingSchedules ? <p className="text-center text-gray-500 py-10">読み込み中...</p> : logic.mySchedules.length === 0 ? (
          <div className="text-center py-6 bg-gray-50 dark:bg-gray-800 rounded-lg"><p className="text-gray-500 font-bold">まだ確定した予定はありません。</p></div>
        ) : (
          <div className="space-y-4">
            {logic.mySchedules.map((schedule, i) => {
              const isFirstOfDay = i === 0 || format(getFixedDate(logic.mySchedules[i - 1].start_at), 'yyyy-MM-dd') !== format(getFixedDate(schedule.start_at), 'yyyy-MM-dd');
              return (
                <div key={schedule.id}>
                  {isFirstOfDay && <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 mb-2 mt-4 border-b dark:border-gray-700 pb-1">{format(getFixedDate(schedule.start_at), 'yyyy年M月d日 (E)', { locale: ja })}</h3>}
                  <div className="block bg-white dark:bg-gray-800/80 border-2 border-yellow-300 dark:border-yellow-600/50 p-4 rounded-xl shadow-sm">
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs bg-yellow-500 dark:bg-yellow-600 text-white px-2 py-1 rounded-full font-bold shadow-sm">📌 仮確定</span>
                        <span className="font-extrabold text-lg text-gray-800 dark:text-gray-100">{formatSlotTime(schedule.start_at, schedule.end_at)}</span>
                      </div>
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300 font-bold truncate pr-4">{schedule.eventTitle}</p>
                    
                    {logic.isGoogleLoggedIn && (
                      <div className="mt-3 pt-3 border-t dark:border-gray-700 text-right">
                        <button 
                          onClick={() => logic.addSlotToGoogleCalendar(schedule.start_at, schedule.end_at, schedule.eventTitle)} 
                          disabled={logic.loading} 
                          className="px-3 py-1.5 text-xs font-bold bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 rounded-lg transition-colors border border-blue-200 dark:border-blue-800/50 shadow-sm"
                        >
                          📅 Googleカレンダーに追加
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}