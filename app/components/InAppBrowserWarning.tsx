'use client';

import { useEffect, useState } from 'react';
import { Info, ExternalLink } from 'lucide-react';

export default function InAppBrowserWarning() {
  const [isInApp, setIsInApp] = useState(false);
  const [isLine, setIsLine] = useState(false);

  useEffect(() => {
    // ユーザーのブラウザ情報（User-Agent）をチェック
    const ua = navigator.userAgent || navigator.vendor || (window as any).opera;
    
    // LINEかどうかを特別に判定（強制突破コマンドが使えるから）
    if (ua.indexOf('Line') > -1) {
      setIsInApp(true);
      setIsLine(true);
    } 
    // 💡 ここに「Discord」と「Twitter」を追加！
    else if (
      ua.indexOf('Instagram') > -1 || 
      ua.indexOf('FBAV') > -1 || 
      ua.indexOf('Discord') > -1 || 
      ua.indexOf('Twitter') > -1 // ← X（Twitter）もここでキャッチ！
    ) {
      setIsInApp(true);
    }
  }, []);

  // 💡 ボタンを押した時の処理
  const handleOpenExternal = () => {
    if (isLine) {
      // LINE専用の強制突破コマンド！
      const currentUrl = window.location.href;
      const separator = currentUrl.includes('?') ? '&' : '?';
      window.location.href = currentUrl + separator + 'openExternalBrowser=1';
    } else {
      // インスタ等はどうしても無理なのでアラートでお願いする
      alert('Instagramなどでは自動で開けないため、画面のメニュー（︙など）から「ブラウザで開く」を選んでね！🙏');
    }
  };

  if (!isInApp) return null; // 普通のブラウザなら何も出さない！

  return (
    <div className="bg-slate-50 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 p-3 shadow-sm sticky top-0 z-50">
      <div className="max-w-xl mx-auto flex items-start gap-3 text-slate-700 dark:text-slate-300">
        <Info size={20} className="shrink-0 mt-0.5 text-blue-500" />
        <div className="text-xs sm:text-sm">
          <p className="font-bold mb-1 text-slate-800 dark:text-slate-200">
            💡 SafariやChromeで開くのがおすすめ！
          </p>
          <p className="font-medium text-slate-600 dark:text-slate-400 leading-relaxed mb-2">
            今のまま（アプリ内ブラウザ）だと、後で開き直した時に<strong className="text-red-500 dark:text-red-400 font-bold">入力データが消えてしまう</strong>ことがあります💦
          </p>
          
          {/* 💡 本物のボタンに進化したよ！ */}
          <button 
            onClick={handleOpenExternal}
            className="inline-flex items-center gap-1 font-bold bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/50 dark:hover:bg-blue-800/60 text-blue-700 dark:text-blue-300 px-3 py-1.5 rounded-lg transition-colors border border-blue-200 dark:border-blue-800 shadow-sm active:scale-95"
          >
            <ExternalLink size={16} /> ここを押してブラウザで開く
          </button>
          
        </div>
      </div>
    </div>
  );
}