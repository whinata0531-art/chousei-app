'use client';

import { Link as LinkIcon, Share2, ChevronRight, Settings, ArrowUp } from 'lucide-react';
import Link from 'next/link';
import { useTopPageLogic } from '@/app/hooks/useTopPageLogic';
import CreateEventTab from '@/app/components/CreateEventTab';
import TopMyScheduleTab from '@/app/components/TopMyScheduleTab';

export default function TopPage() {
  const logic = useTopPageLogic();

  if (logic.createdEventId) {
    const eventUrl = `${window.location.origin}/event/${logic.createdEventId}`;
    return (
      <div className="max-w-xl mx-auto p-6 mt-10 bg-white dark:bg-gray-900 rounded-xl shadow-md space-y-6">
        <h1 className="text-2xl font-bold text-center text-green-600 dark:text-green-400">イベント作成完了！🎉</h1>
        <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-xl border border-blue-200 dark:border-blue-800/30 shadow-sm text-center">
          <p className="font-bold text-lg text-blue-900 dark:text-blue-300 mb-2">共有＆集計用 URL</p>
          <p className="text-sm text-blue-700 dark:text-blue-400 mb-4">※回答も集計の確認も、このURL一つで全員ができます！</p>
          <div className="flex items-center gap-2 mb-4">
            <input readOnly value={eventUrl} className="flex-1 p-3 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg text-sm text-gray-700 dark:text-gray-200 focus:outline-none" />
            <button onClick={() => { navigator.clipboard.writeText(eventUrl); alert('コピーしました！'); }} className="p-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors">
              <LinkIcon size={20} />
            </button>
          </div>
          
          <div className="space-y-3">
            <button onClick={() => logic.handleShare(eventUrl)} className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg flex items-center justify-center gap-2 shadow-md transition-all">
              <Share2 size={20} /> LINEやXでメンバーに共有する
            </button>
            <Link href={`/event/${logic.createdEventId}`} className="w-full py-3 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50 font-bold rounded-lg flex items-center justify-center gap-2 shadow-sm transition-all">
              さっそく自分で回答する <ChevronRight size={20} />
            </Link>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="max-w-xl mx-auto p-4 mt-6 space-y-6 pb-20">
      <div className="flex justify-between items-center px-1 mb-2">
        <h1 className="text-2xl font-extrabold text-gray-800 dark:text-gray-100 tracking-tight">📝 最強調整</h1>
        <Link href="/settings" className="flex items-center gap-1 text-sm bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 px-3 py-2 rounded-lg font-bold hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors shadow-sm border border-gray-200 dark:border-gray-700">
          <Settings size={16} /> 設定
        </Link>
      </div>

      <div className="flex bg-gray-200 dark:bg-gray-800 rounded-lg p-1 shadow">
        <button onClick={() => logic.setActiveTab('create')} className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${logic.activeTab === 'create' ? 'bg-white dark:bg-gray-700 shadow text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}>
          🗓 イベント作成
        </button>
        <button onClick={() => logic.setActiveTab('my-schedule')} className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${logic.activeTab === 'my-schedule' ? 'bg-white dark:bg-gray-700 shadow text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}>
          📅 マイ予定・履歴
        </button>
      </div>

      {/* 💡 部品化したタブを呼び出す！超スッキリ！ */}
      {logic.activeTab === 'create' && <CreateEventTab logic={logic} />}
      {logic.activeTab === 'my-schedule' && <TopMyScheduleTab logic={logic} />}

      {logic.showScrollTop && (
        <button onClick={logic.scrollToTop} className="fixed bottom-6 right-6 p-4 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg transition-all z-50 animate-fade-in-up">
          <ArrowUp size={24} />
        </button>
      )}
    </div>
  );
}