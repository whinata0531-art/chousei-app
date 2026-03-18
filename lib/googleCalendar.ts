// lib/googleCalendar.ts

export async function fetchGoogleCalendarEvents(providerToken: string, timeMin: string, timeMax: string) {
  try {
    // 💡 GoogleのAPI（カレンダーのデータが入ってる金庫）にアクセス！
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime`,
      {
        headers: {
          Authorization: `Bearer ${providerToken}`, // 「Supabaseからもらった鍵」を見せる
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      console.error('カレンダーの取得に失敗したよ😢', await response.text());
      return [];
    }

    const data = await response.json();
    
    // 💡 取得した予定の中から「開始時間」と「終了時間」だけを綺麗に整理して返す
    return data.items.map((item: any) => ({
      title: item.summary || '予定あり',
      start: item.start.dateTime || item.start.date, // 終日の場合はdateになる
      end: item.end.dateTime || item.end.date,
      isAllDay: !item.start.dateTime // dateTimeが無い＝終日予定
    }));

  } catch (error) {
    console.error('Googleカレンダー通信エラー:', error);
    return [];
  }
}