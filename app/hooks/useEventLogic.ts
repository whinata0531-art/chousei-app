'use client';

import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { fetchGoogleCalendarEvents } from '../../lib/googleCalendar';
import { getFixedDate } from '../../lib/utils';
import { Slot, Status, PastAvailability, AggregatedSlot, MatrixData, ConfirmedSchedule, RecentEvent, RoutineSlot, WeeklyRoutine } from '@/app/types';

export function useEventLogic(eventId: string) {
  const [activeTab, setActiveTab] = useState<'response' | 'result' | 'my-schedule'>('response');
  const [event, setEvent] = useState<any>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    const fetchAll = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) setIsGoogleLoggedIn(true);

      let currentGuestId = localStorage.getItem('deviceGuestId');
      if (!currentGuestId) {
        currentGuestId = crypto.randomUUID();
        localStorage.setItem('deviceGuestId', currentGuestId);
      }
      setDeviceGuestId(currentGuestId);

      fetchMySchedules(currentGuestId);
      fetchRecentEvents(currentGuestId);

      const { data: eData } = await supabase.from('events').select('*').eq('id', eventId).single();
      const { data: sData } = await supabase.from('slots').select('*').eq('event_id', eventId).order('start_at');
      
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
    fetchAll();

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
    const { data: responses } = await supabase.from('responses').select('*').eq('event_id', eventId).order('created_at');
    if (!responses) return;
    const resIds = responses.map(r => r.id);
    const { data: avails } = await supabase.from('availabilities').select('*').in('response_id', resIds);

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

    const matrixData: MatrixData[] = responses.map(res => {
      const userAvails = avails?.filter(a => a.response_id === res.id) || [];
      const userAnswers: Record<string, string> = {};
      userAvails.forEach(a => userAnswers[a.slot_id] = a.status);
      return { guestId: res.guest_id, guestName: res.guest_name, answers: userAnswers };
    });
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

  const toggleConfirmSlot = async (slotId: string, currentIsConfirmed: boolean, startAt: string, endAt: string) => {
    const isConfirming = !currentIsConfirmed;
    const confirmMessage = isConfirming 
      ? 'この日程を仮確定にしますか？\n（ログイン中の参加者全員のカレンダーに自動追加されます！）' 
      : 'この日程の仮確定を解除しますか？\n（参加者全員のカレンダーから自動で削除されます！）';
      
    if (!confirm(confirmMessage)) return;
    setLoading(true);

    const { data: { session } } = await supabase.auth.getSession();
    const providerToken = session?.provider_token;

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
    window.location.reload(); 
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
    const { data: { session } } = await supabase.auth.getSession();
    const providerToken = session?.provider_token;

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
    const { data: { session } } = await supabase.auth.getSession();
    const providerToken = session?.provider_token;
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

    const { data: resData } = await supabase
      .from('responses')
      .upsert({ 
        event_id: eventId, 
        guest_id: deviceGuestId, 
        guest_name: guestName, 
        email: userEmail,
        updated_at: new Date().toISOString() 
      }, { onConflict: 'event_id,guest_id' })
      .select('id').single();

    if (resData) {
      await supabase.from('availabilities').delete().eq('response_id', resData.id);
      const avails = Object.entries(answers).map(([slotId, status]) => ({ response_id: resData.id, slot_id: slotId, status }));
      await supabase.from('availabilities').insert(avails);

      const now = Date.now();
      const copyUpserts = slots.map(slot => ({ guest_id: deviceGuestId, time_key: `${slot.start_at}_${slot.end_at}`, status: answers[slot.id], updated_at: now }));
      await supabase.from('user_smart_copies').upsert(copyUpserts, { onConflict: 'guest_id,time_key' });

      localStorage.setItem('lastGuestName', guestName);
      alert('回答を保存しました！🎉\nクラウドに同期されたよ！');
      await fetchStats(slots);
      await fetchMySchedules(deviceGuestId);
      setActiveTab('result');
    }
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