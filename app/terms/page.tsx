'use client';

import Link from 'next/link';
import { ArrowLeft, FileText } from 'lucide-react';

export default function TermsPage() {
  return (
    <div className="max-w-2xl mx-auto p-4 mt-4 space-y-5 pb-20">
      <div className="flex items-center justify-between">
        <Link
          href="/settings"
          className="inline-flex items-center gap-1.5 text-sm bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 px-3.5 py-2 rounded-lg font-bold hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors shadow-sm"
        >
          <ArrowLeft size={16} /> 戻る
        </Link>
        <Link
          href="/privacy"
          className="text-xs font-bold text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        >
          プライバシーポリシーを見る →
        </Link>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-md border-t-4 border-t-blue-500 p-6 sm:p-8 space-y-6">
        <div className="border-b dark:border-gray-800 pb-4">
          <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-1">
            <FileText size={22} />
            <span className="text-xs font-bold tracking-wider uppercase">Terms of Service</span>
          </div>
          <h1 className="text-2xl font-extrabold text-gray-800 dark:text-gray-100">利用規約</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            日程調整サービス「最強調整」（以下「本サービス」）のご利用条件
          </p>
        </div>

        <section className="space-y-2 text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
          <h2 className="text-base font-bold text-gray-800 dark:text-gray-100">1. サービスの概要</h2>
          <p>
            本サービスは、ユーザー登録不要で手軽にグループの日程調整を行えるWebアプリケーションです。基本機能はどなたでも無料でご利用いただけます。
          </p>
        </section>

        <section className="space-y-2 text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
          <h2 className="text-base font-bold text-gray-800 dark:text-gray-100">2. 禁止事項</h2>
          <p>本サービスの利用にあたり、以下の行為を禁止します。</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>サーバーやネットワークへ過度な負荷をかける行為、不正アクセス・改ざん行為</li>
            <li>他者へのなりすましや、他のイベント・ユーザーの進行を不当に妨害する行為</li>
            <li>法令または公序良俗に反する目的での利用</li>
          </ul>
        </section>

        <section className="space-y-2 text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
          <h2 className="text-base font-bold text-gray-800 dark:text-gray-100">3. サービスの変更・免責事項</h2>
          <p>
            本サービスは個人開発により提供されており、予告なく機能の改善・変更・一時停止を行う場合があります。本サービスの利用または利用不能によって生じた損害について、運営者は故意または重過失がある場合を除き責任を負いません。
          </p>
        </section>

        <section className="space-y-2 text-sm text-gray-600 dark:text-gray-400 leading-relaxed border-t dark:border-gray-800 pt-5">
          <h2 className="text-base font-bold text-gray-800 dark:text-gray-100">4. プライバシーおよび規約の改定</h2>
          <p>
            個人情報の取り扱いは
            <Link href="/privacy" className="text-blue-600 dark:text-blue-400 underline mx-1">
              プライバシーポリシー
            </Link>
            に従います。本規約は必要に応じて改定されることがあり、掲載時点から効力を生じるものとします。
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 pt-2">最終更新日：2026年11月26日</p>
        </section>
      </div>
    </div>
  );
}
