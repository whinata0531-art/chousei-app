// types/index.ts

// 💡 アプリ全体で使う「型」をここに全部まとめるよ！

export type Status = 'maru' | 'sankaku' | 'batsu';

export type Slot = { 
  id: string; 
  start_at: string; 
  end_at: string; 
  is_confirmed: boolean; 
};

export type PastAvailability = { 
  status: Status; 
  updated: number; 
};

export type AggregatedSlot = Slot & { 
  maru: number; 
  sankaku: number; 
  batsu: number; 
  total: number; 
  originalIndex: number; 
};

export type MatrixData = { 
  guestId: string; 
  guestName: string; 
  answers: Record<string, string>; 
};

export type ConfirmedSchedule = { 
  id: string; 
  event_id: string; 
  start_at: string; 
  end_at: string; 
  eventTitle: string; 
};

export type RecentEvent = { 
  id: string; 
  title: string; 
  lastAccessed: number; 
};

export type RoutineSlot = { 
  id: string; 
  isAllDay: boolean; 
  start: string; 
  end: string; 
  status: Status; 
};

export type WeeklyRoutine = Record<number, RoutineSlot[]>;