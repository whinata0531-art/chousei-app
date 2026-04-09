'use client';

import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { fetchGoogleCalendarEvents } from '../../lib/googleCalendar';
import { getFixedDate, generateId } from '../../lib/utils';
import { Slot, Status, PastAvailability, AggregatedSlot, MatrixData, ConfirmedSchedule, RecentEvent, RoutineSlot, WeeklyRoutine } from '@/app/types';

export function useEventLogic(eventId: string) {
  const [activeTab, setActiveTab] = useState<'response' | 'result' | 'my-schedule'>('response');
  const [event, setEvent] = useState<any>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);

  const [serverError, setServerError] = useState<Error | null>(null);
  if (serverError) {
    throw serverError;
  }

  const [deviceGuestId, setDeviceGuestId] = useState('');
  const [guestName, setGuestName] = useState('');
  const [answers, setAnswers] = useState<Record<string, Status>>({});
  const [pastAvailabilities, setPastAvailabilities] = useState<Record<string, PastAvailability>>({});

  const [aggregated, setAggregated] = useState<AggregatedSlot[]>([]);
  const [matrix, setMatrix] = useState<MatrixData[]>([]);
  const [sortType, setSortType] = useState('time');
  const [hideBatsu, setHideBatsu] = useState(false);
  const [isSummaryOpen, setIsSummaryOpen] = useState(true); 

  const [mySchedules, setMySchedules] = useState<ConfirmedSchedule[]>([]);
  const [fetchingSchedules, setFetchingSchedules] = useState(false);
  const [recentEvents, setRecentEvents] = useState<RecentEvent[]>([]);

  const [showScrollTop, setShowScrollTop] = useState(false);
  const [isGoogleLoggedIn, setIsGoogleLoggedIn] = useState(false);

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitleStr, setEditTitleStr] = useState('');
  const [editDescStr, setEditDescStr] = useState('');

  // 💡 魔法の自動復活システム：使える鍵を必ず持ってくる関数！
  const getValidGoogleToken = async () => {
    // 1. ポケットから今の鍵（Access Token）とマスターキー（Refresh Token）を出す
    let accessToken = localStorage.getItem('google_provider_token');
    const refreshToken = localStorage.getItem('google_refresh_token');

    // もし鍵がどっちも無ければ、そもそもGoogleログインしてないってことだから諦める
    if (!accessToken || !refreshToken) return null;

    // 2. 今の鍵がまだ生きてるか、Googleに軽くジャブを打って確認する（カレンダー一覧をリクエストしてみる）
    const testRes = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    // 3. もし鍵が腐ってたら（401 Unauthorized エラーが返ってきたら）
    if (testRes.status === 401) {
      console.log('🔄 鍵が1時間で腐ってたから、秘密の小部屋（API）で新しいのをもらってくるぜ！');
      
      // さっき作った自分のバックエンドAPIをノックする！
      const refreshRes = await fetch('/api/refresh-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (refreshRes.ok) {
        const data = await refreshRes.json();
        accessToken = data.accessToken; // ピッカピカの新しい鍵をゲット！
        localStorage.setItem('google_provider_token', accessToken as string); // ポケットの古い鍵を捨てて、新しい鍵に入れ替える！
        console.log('✨ 新しい鍵の取得に成功！カレンダー操作を続行するよ！');
      } else {
        // マスターキーすら無効になってた場合（ユーザーがGoogleのパスワード変えた時とか）
        console.error('マスターキーも使えなくなってた💦 もう一度ログインが必要だよ！');
        return null; 
      }
    }

    // 4. 絶対に使える（生きている）鍵を返す！
    return accessToken;
  };

  // 💡 ① useEffectの外に、fetchAll関数を独立させて作る！（中身は今のままでOK）
  const fetchAll = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) setIsGoogleLoggedIn(true);

    let currentGuestId = localStorage.getItem('deviceGuestId');
    if (!currentGuestId) {
      currentGuestId = generateId(); // さっき直した自作IDツールね！
      localStorage.setItem('deviceGuestId', currentGuestId);
    }
    setDeviceGuestId(currentGuestId);

    fetchMySchedules(currentGuestId);
    fetchRecentEvents(currentGuestId);

    // 💡 修正後：エラー（error）も受け取って、エラーなら爆発させる！💥
    const { data: eData, error: eError } = await supabase.from('events').select('*').eq('id', eventId).single();
    
    if (eError) {
      setServerError(new Error('イベント情報の取得に失敗しました: ' + eError.message));
      return; // ここで処理ストップ！
    }

    const { data: sData, error: sError } = await supabase.from('slots').select('*').eq('event_id', eventId).order('start_at');
    
    if (sError) {
      setServerError(new Error('日程データの取得に失敗しました: ' + sError.message));
      return; // ここで処理ストップ！
    }
    
    if (eData) {
      setEvent(eData);
      await supabase.from('user_recent_events').upsert({ guest_id: currentGuestId, event_id: eventId, event_title: eData.title, accessed_at: Date.now() }, { onConflict: 'guest_id,event_id' });
    }
    
    if (sData) {
      setSlots(sData);
      const initialAnswers: Record<string, Status> = {};
      sData.forEach(s => initialAnswers[s.id] = 'maru'); 

      const { data: existingResponse } = await supabase.from('responses').select('id, guest_name').eq('event_id', eventId).eq('guest_id', currentGuestId).single();
      let loadedAnswers = { ...initialAnswers };

      if (existingResponse) {
        setGuestName(existingResponse.guest_name);
        const { data: aData } = await supabase.from('availabilities').select('slot_id, status').eq('response_id', existingResponse.id);
        if (aData) {
          aData.forEach(a => loadedAnswers[a.slot_id] = a.status as Status);
          setAnswers(loadedAnswers);
        }
      } else {
        const savedName = localStorage.getItem('lastGuestName');
        if (savedName) setGuestName(savedName);
        setAnswers(loadedAnswers);
      }

      const { data: copies } = await supabase.from('user_smart_copies').select('*').eq('guest_id', currentGuestId);
      if (copies) {
        const parsed: Record<string, PastAvailability> = {};
        copies.forEach((c: any) => parsed[c.time_key] = { status: c.status as Status, updated: c.updated_at });
        setPastAvailabilities(parsed);
      }
    }

    if (sData) await fetchStats(sData);
    setLoading(false);
  };

  // 💡 ② useEffectの中は、めちゃくちゃスッキリこれだけになる！
  useEffect(() => {
    // 💡 ログインした瞬間に、2種類の鍵を両方ともポケットに隠す！
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      // ① 1時間で消える普通の鍵（Access Token）
      if (session?.provider_token) {
        localStorage.setItem('google_provider_token', session.provider_token);
      }
      
      // ② 💡 これを追加！永遠に使えるマスターキー（Refresh Token）
      if (session?.provider_refresh_token) {
        localStorage.setItem('google_refresh_token', session.provider_refresh_token);
      }
    });

    fetchAll(); // 外に出した関数を呼ぶだけ！

    const handleScroll = () => setShowScrollTop(window.scrollY > 300);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [eventId]);

  const fetchRecentEvents = async (guestId: string) => {
    const { data } = await supabase.from('user_recent_events').select('*').eq('guest_id', guestId).order('accessed_at', { ascending: false }).limit(10);
    if (data) setRecentEvents(data.map((d: any) => ({ id: d.event_id, title: d.event_title, lastAccessed: d.accessed_at })));
  };

  const removeRecentEvent = async (e: React.MouseEvent, targetEventId: string) => {
    e.preventDefault();
    if (!confirm('このイベントを履歴から削除しますか？')) return;
    await supabase.from('user_recent_events').delete().eq('guest_id', deviceGuestId).eq('event_id', targetEventId);
    setRecentEvents(prev => prev.filter(re => re.id !== targetEventId));
  };

  const handleSaveEventInfo = async () => {
    if (!editTitleStr.trim()) return alert('タイトルを入力してください');
    setLoading(true);
    await supabase.from('events').update({ title: editTitleStr, description: editDescStr }).eq('id', eventId);
    setEvent({ ...event, title: editTitleStr, description: editDescStr });
    setIsEditingTitle(false);
    setLoading(false);
  };

  const fetchStats = async (currentSlots: Slot[]) => {
    // 1. まず「誰が回答したか（名前）」を取得
    const { data: responses, error: resError } = await supabase.from('responses').select('*').eq('event_id', eventId).order('created_at');
    
    if (resError) {
      console.error('❌ 回答者の取得エラー:', resError);
      return;
    }

    // まだ誰も回答していない場合の安全策（これがないとエラーになることがあります）
    if (!responses || responses.length === 0) {
      setAggregated(currentSlots.map((s, index) => ({ ...s, maru: 0, sankaku: 0, batsu: 0, total: 0, originalIndex: index })));
      setMatrix([]);
      return;
    }

    // 2. 「その人たちがつけた〇△×」を取得
    const resIds = responses.map(r => r.id);
    const { data: avails, error: availsError } = await supabase.from('availabilities').select('*').in('response_id', resIds);

    if (availsError) {
      console.error('❌ 〇△×データの取得エラー:', availsError);
    }

    // ★ 魔法のデバッグログ：何が読み込めているかブラウザの裏側に出力します
    console.log('👥 取得した回答者一覧:', responses);
    console.log('✅ 取得した〇△×データ:', avails);
    console.log('📅 現在の候補日程:', currentSlots);

    // 3. 〇△×の数を集計する
    let stats = currentSlots.map((slot, index) => {
      const slotAvails = avails?.filter(a => a.slot_id === slot.id) || [];
      return {
        ...slot,
        maru: slotAvails.filter(a => a.status === 'maru').length,
        sankaku: slotAvails.filter(a => a.status === 'sankaku').length,
        batsu: slotAvails.filter(a => a.status === 'batsu').length,
        total: slotAvails.length,
        originalIndex: index,
      };
    });
    setAggregated(stats);

    // 4. マトリックス（表）用のデータを作る
    const matrixData: MatrixData[] = responses.map(res => {
      const userAvails = avails?.filter(a => a.response_id === res.id) || [];
      const userAnswers: Record<string, string> = {};
      userAvails.forEach(a => {
        userAnswers[a.slot_id] = a.status; // ここで「日程ID」と「〇△×」を結びつけています
      });
      return { guestId: res.guest_id, guestName: res.guest_name, answers: userAnswers };
    });
    
    console.log('📊 完成したマトリックス:', matrixData);
    setMatrix(matrixData);
  };

  const fetchMySchedules = async (guestId: string) => {
    setFetchingSchedules(true);
    const { data: resData } = await supabase.from('responses').select('id, event_id').eq('guest_id', guestId);
    if (!resData || resData.length === 0) { setFetchingSchedules(false); return; }

    const resIds = resData.map(r => r.id);
    const { data: avails } = await supabase.from('availabilities').select('slot_id, status').in('response_id', resIds).in('status', ['maru', 'sankaku']);
    if (!avails || avails.length === 0) { setFetchingSchedules(false); return; }

    const slotIds = avails.map(a => a.slot_id);
    const { data: slotsData } = await supabase.from('slots').select('*').in('id', slotIds).eq('is_confirmed', true);
    if (!slotsData || slotsData.length === 0) { setFetchingSchedules(false); return; }

    const eventIds = [...new Set(slotsData.map(s => s.event_id))];
    const { data: eventsData } = await supabase.from('events').select('id, title').in('id', eventIds);

    const schedules = slotsData.map(slot => {
      const event = eventsData?.find(e => e.id === slot.event_id);
      return { ...slot, eventTitle: event?.title || '不明なイベント' };
    });

    schedules.sort((a, b) => getFixedDate(a.start_at).getTime() - getFixedDate(b.start_at).getTime());
    setMySchedules(schedules);
    setFetchingSchedules(false);
  };

 // 💡 修正ポイント：スマートでマイルドな確認メッセージ！
  const toggleConfirmSlot = async (slotId: string, currentIsConfirmed: boolean, startAt: string, endAt: string) => {
    const isConfirming = !currentIsConfirmed;
    
    // ログイン状態に合わせてメッセージを切り替える！
    let confirmMessage = '';
    if (isConfirming) {
      confirmMessage = isGoogleLoggedIn 
        ? 'この日程を仮確定にしますか？\n（カレンダーにも同期されます📅）' 
        : 'この日程を仮確定にしますか？';
    } else {
      confirmMessage = isGoogleLoggedIn 
        ? '仮確定を解除しますか？\n（カレンダーの同期も解除されます）' 
        : 'この日程の仮確定を解除しますか？';
    }
      
    if (!confirm(confirmMessage)) return;
    setLoading(true);

    // 💡 古い取り方を消して、魔法のツールを呼ぶだけにする！
    const providerToken = await getValidGoogleToken();

    if (providerToken) {
      const sTime = getFixedDate(startAt).toISOString();
      const eTime = getFixedDate(endAt).toISOString();
      const gEventTitle = `[最強調整] ${event.title}`;

      if (isConfirming) {
        const { data: responsesData } = await supabase
          .from('responses')
          .select('email')
          .eq('event_id', eventId)
          .not('email', 'is', null);
          
        const attendeesList = responsesData?.map(r => ({ email: r.email })) || [];

        const gEvent = {
          summary: gEventTitle,
          start: { dateTime: sTime },
          end: { dateTime: eTime },
          attendees: attendeesList,
        };

        await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all', {
          method: 'POST',
          headers: { Authorization: `Bearer ${providerToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(gEvent),
        });
      } else {
        try {
          const searchRes = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(sTime)}&timeMax=${encodeURIComponent(eTime)}`, {
            headers: { Authorization: `Bearer ${providerToken}` }
          });
          if (searchRes.ok) {
            const searchData = await searchRes.json();
            for (const item of searchData.items || []) {
              if (item.summary === gEventTitle) {
                await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${item.id}?sendUpdates=all`, {
                  method: 'DELETE',
                  headers: { Authorization: `Bearer ${providerToken}` }
                });
              }
            }
          }
        } catch (e) {
          console.error('カレンダーの削除に失敗:', e);
        }
      }
    }

    await supabase.from('slots').update({ is_confirmed: isConfirming }).eq('id', slotId);
    
    // ⭕ リロードの代わりに、最新データを引っ張ってくる関数を呼ぶ！
    // （※関数名は君の `useEventLogic.ts` でデータ取得に使っている名前にしてね！ `fetchEventData()` や `loadEvent()` など）
    await fetchAll(); 
    
    // 💡 最初に setLoading(true) にしていたので、最後に必ず false に戻してあげる！
    setLoading(false);
  };

  const applyWeeklyRoutine = () => {
    const savedRoutine = localStorage.getItem('weeklyRoutine');
    if (!savedRoutine) return alert('「⚙️設定」から固定シフトを登録してね！');
    const routine: WeeklyRoutine = JSON.parse(savedRoutine);
    const newAnswers = { ...answers };
    let appliedCount = 0;

    slots.forEach(slot => {
      const slotDate = getFixedDate(slot.start_at);
      const dow = slotDate.getDay();
      const rSlots = routine[dow] || [];
      if (rSlots.length === 0) return;

      const sStart = slotDate.getTime();
      const sEnd = getFixedDate(slot.end_at).getTime();
      const baseDateStr = slot.start_at.substring(0, 10); 

      const overlaps: { start: number; end: number; status: Status }[] = [];

      rSlots.forEach(rs => {
        const pStart = rs.isAllDay ? new Date(`${baseDateStr}T00:00:00`).getTime() : new Date(`${baseDateStr}T${rs.start}:00`).getTime();
        const pEnd = rs.isAllDay ? new Date(`${baseDateStr}T23:59:00`).getTime() : new Date(`${baseDateStr}T${rs.end}:00`).getTime();
        if (Math.max(sStart, pStart) < Math.min(sEnd, pEnd)) overlaps.push({ start: pStart, end: pEnd, status: rs.status });
      });

      if (overlaps.length > 0) {
        let hasBatsu = false; let hasSankaku = false; let allCovered = true; let anyCovered = false;
        for (let t = sStart; t < sEnd; t += 60000) {
          const coveringPast = overlaps.find(o => o.start <= t && t < o.end);
          if (coveringPast) {
            anyCovered = true;
            if (coveringPast.status === 'batsu') hasBatsu = true;
            if (coveringPast.status === 'sankaku') hasSankaku = true;
          } else { allCovered = false; }
        }
        if (anyCovered) {
          if (hasBatsu) { newAnswers[slot.id] = 'batsu'; appliedCount++; }
          else if (hasSankaku) { newAnswers[slot.id] = 'sankaku'; appliedCount++; }
          else if (allCovered) { newAnswers[slot.id] = 'maru'; appliedCount++; }
        }
      }
    });

    if (appliedCount === 0) alert('候補日程に合致するシフト設定がありませんでした。');
    else { setAnswers(newAnswers); alert(`設定したシフトを ${appliedCount} 件の日程に反映したよ！`); }
  };

  const applySmartCopy = () => {
    const newAnswers = { ...answers };
    let appliedCount = 0;

    slots.forEach(slot => {
      const sStart = getFixedDate(slot.start_at).getTime();
      const sEnd = getFixedDate(slot.end_at).getTime();

      const overlaps: { start: number; end: number; status: Status; updated: number }[] = [];
      Object.entries(pastAvailabilities).forEach(([key, past]) => {
        const [pStartStr, pEndStr] = key.split('_');
        const pStart = getFixedDate(pStartStr).getTime();
        const pEnd = getFixedDate(pEndStr).getTime();
        if (Math.max(sStart, pStart) < Math.min(sEnd, pEnd)) overlaps.push({ start: pStart, end: pEnd, status: past.status, updated: past.updated });
      });

      if (overlaps.length > 0) {
        overlaps.sort((a, b) => b.updated - a.updated);
        let hasBatsu = false; let hasSankaku = false; let allCovered = true; let anyCovered = false;
        for (let t = sStart; t < sEnd; t += 60000) {
          const coveringPast = overlaps.find(o => o.start <= t && t < o.end);
          if (coveringPast) {
            anyCovered = true;
            if (coveringPast.status === 'batsu') hasBatsu = true;
            if (coveringPast.status === 'sankaku') hasSankaku = true;
          } else { allCovered = false; }
        }
        if (anyCovered) {
          if (hasBatsu) { newAnswers[slot.id] = 'batsu'; appliedCount++; }
          else if (hasSankaku) { newAnswers[slot.id] = 'sankaku'; appliedCount++; }
          else if (allCovered) { newAnswers[slot.id] = 'maru'; appliedCount++; }
        }
      }
    });

    setAnswers(newAnswers);
    alert(`クラウドの予定を優先して ${appliedCount} 件の回答を推測したよ！\n※念のためズレがないか確認してね！`);
  };

  const applyGoogleCalendar = async () => {
    // 💡 ここも魔法のツールに差し替え！
    const providerToken = await getValidGoogleToken();

    if (!providerToken) return alert('Googleカレンダーと同期するには、「設定」からもう一度Googleでログイン（再認証）してね！');
    if (slots.length === 0) return;
    setLoading(true);

    try {
      const startDates = slots.map(s => getFixedDate(s.start_at).getTime());
      const endDates = slots.map(s => getFixedDate(s.end_at).getTime());
      const minDate = new Date(Math.min(...startDates)).toISOString();
      const maxDate = new Date(Math.max(...endDates)).toISOString();

      const gEvents = await fetchGoogleCalendarEvents(providerToken, minDate, maxDate);

      if (gEvents.length === 0) {
        setLoading(false);
        return alert('カレンダーの予定と被っている時間はありませんでした！✨');
      }

      let appliedCount = 0;
      const newAnswers = { ...answers };

      slots.forEach(slot => {
        const sStart = getFixedDate(slot.start_at).getTime();
        const sEnd = getFixedDate(slot.end_at).getTime();
        const hasConflict = gEvents.some((ge: any) => {
          const gStart = new Date(ge.start).getTime();
          const gEnd = new Date(ge.end).getTime();
          return Math.max(sStart, gStart) < Math.min(sEnd, gEnd);
        });

        if (hasConflict) { newAnswers[slot.id] = 'batsu'; appliedCount++; }
      });

      if (appliedCount > 0) {
        setAnswers(newAnswers);
        alert(`カレンダーと同期して、予定が被っている ${appliedCount} 枠を自動で「❌」にしたよ！📅`);
      } else {
        alert('候補日程とGoogleカレンダーの予定は被っていませんでした！✨');
      }
    } catch (error) { alert('カレンダーの同期中にエラーが起きちゃいました💦'); }
    setLoading(false);
  };

  const addSlotToGoogleCalendar = async (startAt: string, endAt: string, title: string) => {
    // 💡 ここも魔法のツールに差し替え！
    const providerToken = await getValidGoogleToken();
    if (!providerToken) return alert('Googleカレンダーに追加するには、「設定」からもう一度Googleでログインしてね！');

    setLoading(true);
    try {
      const gEvent = {
        summary: `[最強調整] ${title}`,
        start: { dateTime: getFixedDate(startAt).toISOString() },
        end: { dateTime: getFixedDate(endAt).toISOString() },
      };
      const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
        method: 'POST',
        headers: { Authorization: `Bearer ${providerToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(gEvent),
      });
      if (res.ok) alert('🎉 Googleカレンダーに予定をバッチリ追加したよ！');
      else alert('カレンダーへの追加に失敗しちゃいました💦');
    } catch (error) { alert('通信エラーが起きました💦'); }
    setLoading(false);
  };

  const handleSubmit = async () => {
    if (!guestName) return alert('名前を入力してね！');
    setLoading(true);

    const { data: { session } } = await supabase.auth.getSession();
    const userEmail = session?.user?.email || null;

    // 🚀 魔改造①：同じイベント内に「同じ名前」のデータが既にないか探す！
    // （※エラーにならないように .single() じゃなくて .maybeSingle() を使うのがプロの技！）
    const { data: existingUser } = await supabase
      .from('responses')
      .select('id, guest_id')
      .eq('event_id', eventId)
      .eq('guest_name', guestName)
      .maybeSingle(); 

    // 🚀 魔改造②：使うIDを決定！（見つかれば過去のID、なければ今のブラウザのID）
    const targetGuestId = existingUser ? existingUser.guest_id : deviceGuestId;

    // 🚀 魔改造③：決定したIDで上書き保存（upsert）する！
    const { data: resData, error } = await supabase
      .from('responses')
      .upsert({ 
        event_id: eventId, 
        guest_id: targetGuestId, // 👈 ここが最大のポイント！
        guest_name: guestName, 
        email: userEmail,
        updated_at: new Date().toISOString() 
      }, { onConflict: 'event_id,guest_id' })
      .select('id').single();

    if (error || !resData) {
      alert('保存に失敗しました💦');
      setLoading(false);
      return;
    }

    // 🚀 魔改造④：もし別ブラウザの過去データと合体した場合、今のブラウザのIDも過去のヤツに上書きしちゃう！
    // （これで以降のスマートコピーとかも全部一人の人間として繋がる！）
    if (existingUser && existingUser.guest_id !== deviceGuestId) {
      localStorage.setItem('deviceGuestId', existingUser.guest_id);
      setDeviceGuestId(existingUser.guest_id);
    }

    // --- ここから下は元の処理と同じ！（※一部 targetGuestId に変更） ---
    await supabase.from('availabilities').delete().eq('response_id', resData.id);
    const avails = Object.entries(answers).map(([slotId, status]) => ({ response_id: resData.id, slot_id: slotId, status }));
    await supabase.from('availabilities').insert(avails);

    const now = Date.now();
    const copyUpserts = slots.map(slot => ({ guest_id: targetGuestId, time_key: `${slot.start_at}_${slot.end_at}`, status: answers[slot.id], updated_at: now }));
    await supabase.from('user_smart_copies').upsert(copyUpserts, { onConflict: 'guest_id,time_key' });

    localStorage.setItem('lastGuestName', guestName);
    alert('回答を保存しました！🎉\nクラウドに同期されたよ！');
    await fetchStats(slots);
    await fetchMySchedules(targetGuestId); // 💡 ここも targetGuestId に変更！
    setActiveTab('result');
    setLoading(false);
  };

  const handleDeleteEvent = async () => {
    if (!confirm('【警告】\n本当にこのイベントを完全に削除しますか？\n全員の回答データも消滅し、二度と復元できません！！')) return;
    setLoading(true);
    await supabase.from('events').delete().eq('id', eventId);
    alert('イベントを完全に削除しました。');
    window.location.href = '/'; 
  };

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  const sortedAndFilteredSlots = useMemo(() => {
    let result = [...aggregated];
    if (hideBatsu) result = result.filter(s => s.batsu === 0);
    result.sort((a, b) => {
      if (a.is_confirmed && !b.is_confirmed) return -1;
      if (!a.is_confirmed && b.is_confirmed) return 1;

      if (sortType === 'time') return getFixedDate(a.start_at).getTime() - getFixedDate(b.start_at).getTime();
      else if (sortType === 'maru') {
        if (b.maru !== a.maru) return b.maru - a.maru;
        if (b.sankaku !== a.sankaku) return b.sankaku - a.sankaku;
        return getFixedDate(a.start_at).getTime() - getFixedDate(b.start_at).getTime();
      } else if (sortType === 'batsu') {
        if (a.batsu !== b.batsu) return a.batsu - b.batsu;
        if (b.maru !== a.maru) return b.maru - a.maru;
        return getFixedDate(a.start_at).getTime() - getFixedDate(b.start_at).getTime();
      }
      return 0;
    });
    return result;
  }, [aggregated, hideBatsu, sortType]);

  const validAggregated = aggregated.filter(s => s.total > 0);
  const maxMaru = validAggregated.length > 0 ? Math.max(...validAggregated.map(s => s.maru)) : 0;

  const getSlotTier = (slot: AggregatedSlot) => {
    if (slot.total === 0) return 0;
    if (slot.batsu === 0 && slot.maru > 0 && slot.maru === maxMaru) return 1; 
    if (slot.batsu === 0) return 2; 
    return 0;
  };

  const confirmedSlots = slots.filter(s => s.is_confirmed);
  const isEventConfirmed = confirmedSlots.length > 0;
  const isHost = event ? event.host_id === deviceGuestId : false;

  return {
    activeTab, setActiveTab, event, setEvent, slots, loading,
    deviceGuestId, guestName, setGuestName, answers, setAnswers,
    pastAvailabilities, aggregated, matrix, sortType, setSortType,
    hideBatsu, setHideBatsu, isSummaryOpen, setIsSummaryOpen,
    mySchedules, fetchingSchedules, recentEvents, setRecentEvents,
    showScrollTop, isGoogleLoggedIn, isEditingTitle, setIsEditingTitle,
    editTitleStr, setEditTitleStr, editDescStr, setEditDescStr,
    removeRecentEvent, handleSaveEventInfo, fetchStats, fetchMySchedules,
    toggleConfirmSlot, applyWeeklyRoutine, applySmartCopy, applyGoogleCalendar,
    addSlotToGoogleCalendar, handleSubmit, handleDeleteEvent, scrollToTop,
    sortedAndFilteredSlots, maxMaru, getSlotTier, confirmedSlots,
    isEventConfirmed, isHost
  };
}