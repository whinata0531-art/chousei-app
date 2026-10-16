// app/components/ResultTab.tsx
import { useState } from 'react';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { ChevronDown, ChevronRight, Share2, Copy, Check, X, CheckSquare, Square, Send } from 'lucide-react';
import { getFixedDate, formatSlotTime } from '@/lib/utils';
import { useEventLogic } from '../hooks/useEventLogic';
import { AggregatedSlot } from '../types';

type Props = { logic: ReturnType<typeof useEventLogic> };

export default function ResultTab({ logic }: Props) {
  const getStatusIcon = (s: string) => s === 'maru' ? '⭕️' : s === 'sankaku' ? '🔺' : s === 'batsu' ? '❌' : '-';

  // 📤 候補日程の共有モード・モーダル用の状態
  const [isShareSelectMode, setIsShareSelectMode] = useState(false);
  const [selectedSlotIds, setSelectedSlotIds] = useState<string[]>([]);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareText, setShareText] = useState('');
  const [copied, setCopied] = useState(false);

  // 共有用の時間フォーマット（例: "20-22", "19:30-21:30", "終日"）
  const formatShareTime = (startStr: string, endStr: string) => {
    const sDate = getFixedDate(startStr);
    const eDate = getFixedDate(endStr);
    const sFull = format(sDate, 'HH:mm');
    const eFull = format(eDate, 'HH:mm');
    if (sFull === '00:00' && eFull === '23:59') return '終日';

    const fmtHourMin = (d: Date) => {
      const m = d.getMinutes();
      return m === 0 ? `${d.getHours()}` : `${d.getHours()}:${String(m).padStart(2, '0')}`;
    };
    return `${fmtHourMin(sDate)}-${fmtHourMin(eDate)}`;
  };

  // 1枠分の共有テキストを生成（例: "10/18 20-22 もに×スパ△" / "10/30 17-19 やぴ、スパ、キャンプ場△"）
  const formatSlotShareLine = (slot: AggregatedSlot) => {
    const dateStr = format(getFixedDate(slot.start_at), 'M/d');
    const timeStr = formatShareTime(slot.start_at, slot.end_at);

    const sankakuNames: string[] = [];
    const batsuNames: string[] = [];
    let firstSankakuIdx = Infinity;
    let firstBatsuIdx = Infinity;

    logic.matrix.forEach((row, idx) => {
      const status = row.answers[slot.id];
      if (status === 'sankaku') {
        sankakuNames.push(row.guestName);
        if (firstSankakuIdx === Infinity) firstSankakuIdx = idx;
      } else if (status === 'batsu') {
        batsuNames.push(row.guestName);
        if (firstBatsuIdx === Infinity) firstBatsuIdx = idx;
      }
    });

    const sankakuPart = sankakuNames.length > 0 ? `${sankakuNames.join('、')}△` : '';
    const batsuPart = batsuNames.length > 0 ? `${batsuNames.join('、')}×` : '';

    let namesPart = '';
    if (sankakuPart && batsuPart) {
      namesPart = firstBatsuIdx < firstSankakuIdx ? `${batsuPart}${sankakuPart}` : `${sankakuPart}${batsuPart}`;
    } else {
      namesPart = sankakuPart || batsuPart;
    }

    return namesPart ? `${dateStr} ${timeStr} ${namesPart}` : `${dateStr} ${timeStr}`;
  };

  // 日程選択のON/OFF切り替え
  const toggleSelectSlot = (slotId: string) => {
    setSelectedSlotIds(prev =>
      prev.includes(slotId) ? prev.filter(id => id !== slotId) : [...prev, slotId]
    );
  };

  // 選択した日程からテキストを生成して共有モーダルを開く（日時順に並べる）
  const handleProceedToShare = () => {
    if (selectedSlotIds.length === 0) return;
    const selectedSlots = logic.aggregated
      .filter(s => selectedSlotIds.includes(s.id))
      .sort((a, b) => getFixedDate(a.start_at).getTime() - getFixedDate(b.start_at).getTime());

    const generated = selectedSlots.map(formatSlotShareLine).join('\n');
    setShareText(generated);
    setCopied(false);
    setIsShareModalOpen(true);
  };

  // クリップボードにコピー
  const handleCopyShareText = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = shareText;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  // OSの共有シート（他のアプリの入力欄へ直接流し込む）を開く
  const handleNativeShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ text: shareText });
      } catch (e: any) {
        // ユーザーがキャンセルした場合は何もしない
        if (e?.name !== 'AbortError') {
          console.error('共有エラー:', e);
        }
      }
    } else {
      // Web Share API非対応ブラウザ（一部のPCブラウザなど）ではLINE共有URLまたはコピーへ誘導
      window.open(`https://line.me/R/share?text=${encodeURIComponent(shareText)}`, '_blank');
    }
  };

  // LINEで直接共有（トークの入力欄に自動入力される）
  const handleLineShare = () => {
    window.open(`https://line.me/R/share?text=${encodeURIComponent(shareText)}`, '_blank');
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow border-t-4 border-green-500 transition-all">
        <div className="sticky top-[4.5rem] z-20 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md p-6 border-b dark:border-gray-700 shadow-sm rounded-t-xl">
          <button onClick={() => logic.setIsSummaryOpen(!logic.isSummaryOpen)} className="w-full flex items-center justify-between focus:outline-none">
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">📊 日程ごとの集計</h2>
            <div className="p-1 bg-gray-100 dark:bg-gray-800 rounded-full hover:bg-gray-200 transition-colors">
              {logic.isSummaryOpen ? <ChevronDown size={20} className="text-gray-600 dark:text-gray-300" /> : <ChevronRight size={20} className="text-gray-600 dark:text-gray-300" />}
            </div>
          </button>
        </div>

        {logic.isSummaryOpen && (
          <div className="p-6 pt-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border dark:border-gray-700">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-gray-700 dark:text-gray-300">並び替え:</span>
                  <select value={logic.sortType} onChange={e => logic.setSortType(e.target.value)} className="p-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded text-sm bg-white outline-none">
                    <option value="time">⏰ 日時が早い順</option>
                    <option value="maru">⭕️ 参加者が多い順</option>
                    <option value="batsu">❌ 不参加が少ない順</option>
                  </select>
                </div>
                <div className="flex items-center gap-2 sm:border-l dark:border-gray-600 sm:pl-4">
                  <input type="checkbox" id="hideBatsu" checked={logic.hideBatsu} onChange={e => logic.setHideBatsu(e.target.checked)} className="w-4 h-4" />
                  <label htmlFor="hideBatsu" className="text-sm font-medium dark:text-gray-300 cursor-pointer">❌を除外</label>
                </div>
              </div>

              <button
                onClick={() => {
                  if (isShareSelectMode) {
                    setIsShareSelectMode(false);
                    setSelectedSlotIds([]);
                  } else {
                    setIsShareSelectMode(true);
                  }
                }}
                className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-bold text-sm shadow-sm transition-all shrink-0 ${
                  isShareSelectMode
                    ? 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                <Share2 size={16} />
                {isShareSelectMode ? '選択をやめる' : '候補日程を共有'}
              </button>
            </div>

            {/* 📤 共有モード中のガイド＆一括選択バー */}
            {isShareSelectMode && (
              <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-300 dark:border-blue-700 rounded-xl space-y-3 animate-fade-in">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-blue-800 dark:text-blue-300">
                    ☑️ 共有したい日程をタップして選んでね！（現在 {selectedSlotIds.length} 件選択中）
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      const recIds = logic.sortedAndFilteredSlots.filter(s => logic.getSlotTier(s) === 1).map(s => s.id);
                      setSelectedSlotIds(prev => Array.from(new Set([...prev, ...recIds])));
                    }}
                    className="px-3 py-1.5 text-xs font-bold bg-white dark:bg-gray-800 text-green-700 dark:text-green-400 border border-green-300 dark:border-green-700 rounded-lg hover:bg-green-50 transition"
                  >
                    🌟 おすすめを追加
                  </button>
                  {logic.confirmedSlots.length > 0 && (
                    <button
                      onClick={() => {
                        const confIds = logic.confirmedSlots.map(s => s.id);
                        setSelectedSlotIds(prev => Array.from(new Set([...prev, ...confIds])));
                      }}
                      className="px-3 py-1.5 text-xs font-bold bg-white dark:bg-gray-800 text-yellow-700 dark:text-yellow-400 border border-yellow-300 dark:border-yellow-700 rounded-lg hover:bg-yellow-50 transition"
                    >
                      📌 仮確定を追加
                    </button>
                  )}
                  <button
                    onClick={() => setSelectedSlotIds(logic.sortedAndFilteredSlots.map(s => s.id))}
                    className="px-3 py-1.5 text-xs font-bold bg-white dark:bg-gray-800 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700 rounded-lg hover:bg-blue-100 transition"
                  >
                    表示中をすべて選択
                  </button>
                  {selectedSlotIds.length > 0 && (
                    <button
                      onClick={() => setSelectedSlotIds([])}
                      className="px-3 py-1.5 text-xs font-bold bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 transition"
                    >
                      選択をクリア
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-4">
              {logic.sortedAndFilteredSlots.map((slot) => {
                const tier = logic.getSlotTier(slot);
                const isSelected = selectedSlotIds.includes(slot.id);
                const highlightClass = 
                  tier === 1 ? 'bg-green-50 border-green-400 ring-2 ring-green-200 dark:bg-green-900/30 dark:border-green-600 dark:ring-green-800/50' :
                  tier === 2 ? 'bg-orange-50 border-orange-300 dark:bg-yellow-900/20 dark:border-yellow-600/50' :
                  'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700';

                return (
                  <div
                    key={slot.id}
                    onClick={isShareSelectMode ? () => toggleSelectSlot(slot.id) : undefined}
                    className={`p-4 border rounded-xl flex flex-col gap-3 transition-all ${
                      isShareSelectMode ? 'cursor-pointer select-none' : ''
                    } ${
                      isShareSelectMode && isSelected
                        ? 'ring-4 ring-blue-500 border-blue-500 bg-blue-50/60 dark:bg-blue-900/30 transform scale-[1.01]'
                        : slot.is_confirmed
                        ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-400 dark:border-yellow-600/50 shadow-md transform scale-[1.02]'
                        : highlightClass
                    }`}
                  >
                    {/* 1. 日時やラベル（一番上） */}
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div>
                        {slot.is_confirmed && <span className="inline-block px-3 py-1 bg-yellow-500 dark:bg-yellow-600 text-white text-[10px] font-bold rounded-full mb-1.5 shadow-sm animate-pulse">✨ 仮確定 ✨</span>}
                        {!slot.is_confirmed && tier === 1 && <span className="inline-block px-2 py-1 bg-green-500 text-white text-[10px] font-bold rounded mb-1.5 shadow-sm">🌟 おすすめ</span>}
                        <div className="font-bold text-base sm:text-lg dark:text-gray-100 tracking-tight">
                          {format(getFixedDate(slot.start_at), 'M/d (E)', { locale: ja })} {formatSlotTime(slot.start_at, slot.end_at)}
                        </div>
                      </div>

                      {isShareSelectMode && (
                        <div className={`p-1 rounded-lg transition-colors ${isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'}`}>
                          {isSelected ? <CheckSquare size={26} /> : <Square size={26} />}
                        </div>
                      )}
                    </div>

                    {/* 2. 左に集計、右に名前（横並びにして空きスペースをフル活用！） */}
                    <div className="flex flex-row items-start justify-between gap-3 mb-2">
      
                      {/* 左側：〇△×の集計 */}
                      <div className="flex gap-4 text-center shrink-0 pt-1">
                        <div><div className="text-[12px] text-gray-500 font-medium">⭕️</div><div className="font-bold text-green-600 dark:text-green-400 text-xl leading-none mt-1">{slot.maru}</div></div>
                        <div><div className="text-[12px] text-gray-500 font-medium">🔺</div><div className="font-bold text-orange-500 dark:text-orange-400 text-xl leading-none mt-1">{slot.sankaku}</div></div>
                        <div><div className="text-[12px] text-gray-500 font-medium">❌</div><div className="font-bold text-red-500 dark:text-red-400 text-xl leading-none mt-1">{slot.batsu}</div></div>
                      </div>

                      {/* 右側：名前バッジ（右詰めで配置し、人数が多い場合は折り返す） */}
                      <div className="flex-1 flex flex-wrap justify-end content-start gap-1 pl-3 border-l border-gray-100 dark:border-gray-700 min-h-[40px]">
                        {logic.matrix.map((row, idx) => {
                          const status = row.answers[slot.id];
                          if (status !== 'sankaku' && status !== 'batsu') return null;
                          const config = 
                            status === 'sankaku' ? { icon: '△', css: 'bg-orange-50 text-orange-700 border-orange-200' } :
                            status === 'batsu' ? { icon: '×', css: 'bg-red-50 text-red-700 border-red-200' } :
                            { icon: '-', css: 'bg-gray-50 text-gray-400 border-gray-100' };

                          return (
                            <div key={idx} className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold border ${config.css}`}>
                              <span>{config.icon}</span>
                              <span className="max-w-[70px] truncate">{row.guestName}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {!isShareSelectMode && (
                      <div className="border-t border-gray-200/60 dark:border-gray-700 pt-3 mt-1 text-right flex justify-end gap-2">
                        <button 
                          onClick={() => logic.toggleConfirmSlot(slot.id, slot.is_confirmed, slot.start_at, slot.end_at)}
                          className={`px-4 py-2 text-sm font-bold rounded-lg shadow transition-colors ${slot.is_confirmed ? 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600' : 'bg-yellow-400 dark:bg-yellow-500/80 text-yellow-900 dark:text-yellow-50 hover:bg-yellow-500 dark:hover:bg-yellow-500'}`}
                        >
                          {slot.is_confirmed ? '仮確定を解除' : '📌 仮確定にする'}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
              {logic.sortedAndFilteredSlots.length === 0 && <p className="text-gray-500 text-center py-4">条件に合う日程がありません。</p>}
            </div>
          </div>
        )}
      </div>

      {/* 📤 日程選択モード中の画面下部固定バー */}
      {isShareSelectMode && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-t-2 border-blue-500 shadow-[0_-4px_12px_rgba(0,0,0,0.15)] z-40">
          <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
            <button
              onClick={() => {
                setIsShareSelectMode(false);
                setSelectedSlotIds([]);
              }}
              className="px-4 py-3 rounded-xl font-bold text-sm bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 transition"
            >
              キャンセル
            </button>
            <button
              onClick={handleProceedToShare}
              disabled={selectedSlotIds.length === 0}
              className={`flex-1 py-3 px-6 rounded-xl font-bold text-base shadow-md transition-all flex items-center justify-center gap-2 ${
                selectedSlotIds.length > 0
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed'
              }`}
            >
              <Share2 size={18} />
              共有へ進む（{selectedSlotIds.length}件）
            </button>
          </div>
        </div>
      )}

      {/* 📤 共有・コピー用モーダル */}
      {isShareModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border dark:border-gray-700 w-full max-w-lg overflow-hidden animate-fade-in">
            <div className="flex items-center justify-between px-6 py-4 border-b dark:border-gray-700 bg-blue-50 dark:bg-blue-900/20">
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                <Share2 size={20} className="text-blue-600 dark:text-blue-400" />
                候補日程の共有
              </h3>
              <button
                onClick={() => setIsShareModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1.5">
                  共有テキスト（ここで直接文字を編集・追記することもできます）
                </label>
                <textarea
                  value={shareText}
                  onChange={e => setShareText(e.target.value)}
                  rows={Math.min(10, Math.max(4, shareText.split('\n').length + 1))}
                  className="w-full p-3 border dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-100 font-mono text-sm leading-relaxed focus:ring-2 focus:ring-blue-500 outline-none resize-y"
                />
              </div>

              <div className="flex flex-col gap-3 pt-2">
                <button
                  onClick={handleCopyShareText}
                  className={`w-full py-3.5 px-4 rounded-xl font-bold text-base shadow-sm transition-all flex items-center justify-center gap-2 ${
                    copied
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-800 hover:bg-gray-900 dark:bg-gray-100 dark:hover:bg-white text-white dark:text-gray-900'
                  }`}
                >
                  {copied ? <Check size={20} /> : <Copy size={20} />}
                  {copied ? 'コピーしました！' : 'そのままコピーする'}
                </button>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    onClick={handleNativeShare}
                    className="w-full py-3.5 px-4 rounded-xl font-bold text-sm bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-all flex items-center justify-center gap-2"
                  >
                    <Share2 size={18} />
                    他のアプリで共有
                  </button>

                  <button
                    onClick={handleLineShare}
                    className="w-full py-3.5 px-4 rounded-xl font-bold text-sm bg-[#06C755] hover:bg-[#05b34c] text-white shadow-sm transition-all flex items-center justify-center gap-2"
                  >
                    <Send size={18} />
                    LINEに入力して送る
                  </button>
                </div>
              </div>

              <div className="pt-2 flex justify-between items-center border-t dark:border-gray-800 text-sm">
                <button
                  onClick={() => setIsShareModalOpen(false)}
                  className="text-blue-600 dark:text-blue-400 font-bold hover:underline py-1"
                >
                  ← 日程を選び直す
                </button>
                <button
                  onClick={() => {
                    setIsShareModalOpen(false);
                    setIsShareSelectMode(false);
                    setSelectedSlotIds([]);
                  }}
                  className="text-gray-500 dark:text-gray-400 hover:text-gray-700 font-medium py-1"
                >
                  完了して閉じる
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-900 rounded-xl shadow p-6 overflow-hidden">
        <h2 className="text-xl font-bold mb-4 dark:text-gray-100">👥 回答者マトリックス</h2>
        {logic.matrix.length === 0 ? (
          <p className="text-gray-500">まだ回答がありません。</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left whitespace-nowrap border-collapse">
              <thead>
                <tr>
                  <th className="p-3 border-b-2 bg-gray-50 dark:bg-gray-800 font-bold text-gray-700 dark:text-gray-300 sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">名前</th>
                  {[...logic.aggregated].sort((a, b) => a.originalIndex - b.originalIndex).map(slot => {
                    const tier = logic.getSlotTier(slot);
                    const headerClass = 
                      slot.is_confirmed ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700/50' :
                      tier === 1 ? 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-400 border-green-300 dark:border-green-700' :
                      tier === 2 ? 'bg-orange-100 dark:bg-yellow-900/30 text-orange-800 dark:text-yellow-400 border-orange-200 dark:border-yellow-700/50' : 
                      'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 dark:border-gray-700';
                    
                    return (
                      <th key={slot.id} className={`p-3 border-b-2 text-xs font-medium ${headerClass}`}>
                        {slot.is_confirmed && '📌'}{!slot.is_confirmed && tier === 1 && '🌟'}<br/>
                        {format(getFixedDate(slot.start_at), 'M/d(E)', { locale: ja })}<br/>
                        {formatSlotTime(slot.start_at, slot.end_at)}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {logic.matrix.map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="p-3 border-b dark:border-gray-700 font-medium sticky left-0 bg-white dark:bg-gray-900 dark:text-gray-100 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">{row.guestName}</td>
                    {[...logic.aggregated].sort((a, b) => a.originalIndex - b.originalIndex).map(slot => {
                      const tier = logic.getSlotTier(slot);
                      const cellClass = 
                        slot.is_confirmed ? 'bg-yellow-50 dark:bg-yellow-900/20' :
                        tier === 1 ? 'bg-green-50 dark:bg-green-900/20' :
                        tier === 2 ? 'bg-orange-50/50 dark:bg-yellow-900/20' : 'dark:bg-gray-800';
                        
                      return (
                        <td key={slot.id} className={`p-3 border-b dark:border-gray-700 text-center text-xl ${cellClass}`}>{getStatusIcon(row.answers[slot.id])}</td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}