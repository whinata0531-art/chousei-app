import { NextResponse } from 'next/server';

// 💡 POSTリクエスト（データの送信）を受け取る専用の関数
export async function POST(request: Request) {
  try {
    // 1. フロントエンドから送られてきた「マスターキー」を受け取る
    const { refreshToken } = await request.json();

    if (!refreshToken) {
      return NextResponse.json({ error: 'マスターキーがないよ！' }, { status: 400 });
    }

    // 2. `.env.local` に隠した極秘パスワードを取り出す
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    // 3. Googleの「トークン更新専用の裏口」にリクエストを送る！
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      // URLのパラメータ形式にして送るのがGoogleのルール
      body: new URLSearchParams({
        client_id: clientId!,
        client_secret: clientSecret!,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    const data = await response.json();

    // もしGoogleに怒られたらエラーを返す
    if (!response.ok) {
      console.error('Googleトークン更新エラー:', data);
      return NextResponse.json({ error: '鍵の交換に失敗したよ💦' }, { status: response.status });
    }

    // 4. 無事にゲットした「新しい1時間用の鍵」をフロントエンドに渡す！
    return NextResponse.json({
      accessToken: data.access_token,
      expiresIn: data.expires_in,
    });

  } catch (error) {
    console.error('API Route エラー:', error);
    return NextResponse.json({ error: 'サーバーでエラーが起きたよ' }, { status: 500 });
  }
}