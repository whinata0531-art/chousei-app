'use client'

import { supabase } from '../../lib/supabase' // もしエラーが出たら、正しいsupabaseのパスに合わせてね！

export default function GoogleLoginButton() {
  const loginWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        // 💡 ここが超重要！「カレンダーを読み取る許可」をもらうための呪文！
        scopes: 'https://www.googleapis.com/auth/calendar',
        // 💡 この3行を追加！！（有効期限を気にせずカレンダーを見れるようにする魔法）
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
        // ⭕ ボタンを押した時のURLにそのまま帰ってくる！
        redirectTo: window.location.href
      }
    })

    if (error) {
      console.error('ログインエラー:', error.message)
      alert('ログインに失敗しちゃいました💦')
    }
  }

  return (
    <button
      onClick={loginWithGoogle}
      className="flex items-center gap-2 bg-white border-2 border-gray-200 text-gray-800 font-bold py-3 px-6 rounded-full shadow-md hover:bg-gray-50 transition-all"
    >
      <span className="text-xl">📅</span>
      Googleでログインして予定を同期
    </button>
  )
}