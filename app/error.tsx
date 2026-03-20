'use client'; // 💡 エラー画面は必ず 'use client' にするというNext.jsの絶対ルール！

import { useEffect } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // 💡 本当はここでエラー監視ツール（Sentryなど）に裏で通知を送ったりするよ！
    console.error('🔥 アプリでエラーが発生しました:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 text-center border-t-4 border-red-500 animate-fade-in-up">
        
        <div className="flex justify-center mb-6">
          <div className="bg-red-100 dark:bg-red-900/30 p-4 rounded-full">
            <AlertTriangle className="text-red-500 w-12 h-12" />
          </div>
        </div>
        
        <h1 className="text-2xl font-extrabold text-gray-800 dark:text-gray-100 mb-3 tracking-tight">
          ただいまアクセス集中につき<br/>ちょっとパンクしてます！🤯
        </h1>
        
        <p className="text-gray-600 dark:text-gray-400 mb-8 text-sm leading-relaxed font-bold">
          たくさんの方にご利用いただき、サーバーが一時的にダウンしているか、通信に失敗しました。<br/><br/>
          データは安全に金庫に守られていますので、数分待ってからもう一度お試しください🙇‍♂️
        </p>

        <button
          onClick={() => reset()} // 💡 これを押すと、Next.jsがもう一回通信をリトライしてくれる！
          className="w-full flex items-center justify-center gap-2 bg-blue-600 dark:bg-blue-500 text-white py-3 px-4 rounded-xl font-bold hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors shadow-md"
        >
          <RefreshCcw size={20} />
          もう一度読み込んでみる
        </button>
        
      </div>
    </div>
  );
}