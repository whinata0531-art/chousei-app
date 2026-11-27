'use client';

import Link from 'next/link';
import { ArrowLeft, ShieldCheck, CalendarCheck, Lock, Database } from 'lucide-react';

export default function PrivacyPolicyPage() {
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
          href="/terms"
          className="text-xs font-bold text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        >
          利用規約を見る →
        </Link>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-md border-t-4 border-t-blue-500 p-6 sm:p-8 space-y-7">
        <div className="border-b dark:border-gray-800 pb-4">
          <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-1">
            <ShieldCheck size={22} />
            <span className="text-xs font-bold tracking-wider uppercase">Privacy Policy</span>
          </div>
          <h1 className="text-2xl font-extrabold text-gray-800 dark:text-gray-100">
            プライバシーポリシー
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            日程調整サービス「最強調整」（以下「本サービス」）におけるユーザーデータの取り扱いについて
          </p>
        </div>

        <section className="space-y-2.5 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
          <h2 className="text-base font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <Database size={17} className="text-blue-500 shrink-0" />
            1. 取得する情報と利用目的
          </h2>
          <p>本サービスでは、日程調整機能の提供および利便性向上のために、以下の情報を取り扱います。</p>
          <ul className="list-disc pl-5 space-y-1.5 text-gray-600 dark:text-gray-400">
            <li>
              <strong className="text-gray-800 dark:text-gray-200">イベント・回答情報：</strong>
              ユーザーが作成したイベント名、メモ、候補日時、入力した表示名、および各候補日時に対する参加可否（◯・△・✕）。同じイベントページを共有したメンバー間での集計表示に利用します。
            </li>
            <li>
              <strong className="text-gray-800 dark:text-gray-200">端末識別用ID・設定データ：</strong>
              ログインなしでも利用できるようブラウザ内に保存される識別子（deviceGuestId）、最近閲覧したイベント履歴、固定シフト設定、および過去の回答を他イベントに引き継ぐための日時別メモ。
            </li>
            <li>
              <strong className="text-gray-800 dark:text-gray-200">Googleアカウント情報（任意連携時のみ）：</strong>
              Googleログインを利用した場合に取得されるアカウント識別子およびメールアドレス。端末やブラウザ間でのデータ引き継ぎに利用します。
            </li>
          </ul>
        </section>

        <section className="space-y-2.5 text-sm text-gray-700 dark:text-gray-300 leading-relaxed bg-blue-50/70 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/40 rounded-xl p-4">
          <h2 className="text-base font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <CalendarCheck size={17} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
            2. Googleカレンダーデータの取り扱い（重要）
          </h2>
          <p>
            本サービスは、ユーザーが任意でGoogle連携および回答画面の「Googleカレンダーから自動反映」ボタンを押した場合にのみ、読み取り専用権限（
            <code className="text-xs bg-white dark:bg-gray-800 px-1.5 py-0.5 rounded border dark:border-gray-700">
              calendar.events.readonly
            </code>
            ）を通じて、Googleカレンダー上の予定の開始日時・終了日時を参照します。
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-gray-600 dark:text-gray-300">
            <li>
              取得したカレンダー情報は、<strong>ユーザーのブラウザ上でイベント候補日時と予定が重複しているか（自動で「✕」にするか）を判定する目的のみ</strong>に使用します。
            </li>
            <li>
              <strong>Googleカレンダー内の予定タイトル・内容・場所などの詳細を、本サービスのデータベースや外部サーバーに保存することは一切ありません。</strong>
            </li>
            <li>
              Google APIから取得したデータを第三者へ販売・共有すること、広告配信やAI・機械学習モデルの学習に利用することは一切ありません。
            </li>
          </ul>
          <p className="text-xs text-gray-600 dark:text-gray-400 pt-1">
            本サービスによるGoogle APIから受け取った情報の使用および他のアプリへの転送は、制限付き使用（Limited Use）の要件を含め、
            <a
              href="https://developers.google.com/terms/api-services-user-data-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 underline hover:opacity-80 mx-0.5"
            >
              Google API Services User Data Policy
            </a>
            に準拠します。
          </p>
        </section>

        <section className="space-y-2 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
          <h2 className="text-base font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <Lock size={17} className="text-blue-500 shrink-0" />
            3. データの保護・管理および連携解除
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            本サービスのデータベースは Row Level Security（行レベルセキュリティ）により、個人の閲覧履歴・固定シフト設定・回答の書き込み権限が端末またはGoogle認証ID単位で保護されています。Google連携は設定画面の「ログアウト」ボタン、またはGoogleアカウントのセキュリティ設定（サードパーティ製アプリへのアクセス管理）からいつでも解除できます。
          </p>
        </section>

        <section className="space-y-2 text-sm text-gray-700 dark:text-gray-300 leading-relaxed border-t dark:border-gray-800 pt-5">
          <h2 className="text-base font-bold text-gray-800 dark:text-gray-100">
            4. お問い合わせ・ポリシーの変更
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            本サービスのデータの取り扱いに関するお問い合わせ・削除のご要望は、開発者連絡先（
            <a
              href="mailto:w.hinata0531@gmail.com"
              className="text-blue-600 dark:text-blue-400 underline hover:opacity-80"
            >
              w.hinata0531@gmail.com
            </a>
            ）までご連絡ください。本ポリシーは必要に応じて改定することがあります。
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 pt-2">最終更新日：2026年11月26日</p>
        </section>
      </div>
    </div>
  );
}
