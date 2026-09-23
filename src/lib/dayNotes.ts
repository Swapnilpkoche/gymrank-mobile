import { supabase } from './supabase';
import type { DayNote } from '../types/database';

// month is 1-indexed (1 = January). note_date is a plain `date` column (no
// timezone component), so this compares date strings directly rather than
// going through the UTC-instant range dance fetchCheckInDatesForMonth needs.
export async function fetchDayNotesForMonth(
  userId: string,
  year: number,
  month: number
): Promise<DayNote[]> {
  const pad = (n: number) => String(n).padStart(2, '0');
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const startDate = `${year}-${pad(month)}-01`;
  const endDate = `${nextYear}-${pad(nextMonth)}-01`;

  const { data, error } = await supabase
    .from('gym_day_notes')
    .select('id, gym_id, note_date, note_text')
    .eq('user_id', userId)
    .gte('note_date', startDate)
    .lt('note_date', endDate);

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    gymId: row.gym_id,
    noteDate: row.note_date,
    noteText: row.note_text,
  }));
}

export async function saveDayNote(input: {
  userId: string;
  gymId: number;
  noteDate: string;
  noteText: string;
}): Promise<void> {
  const { error } = await supabase.from('gym_day_notes').upsert(
    {
      user_id: input.userId,
      gym_id: input.gymId,
      note_date: input.noteDate,
      note_text: input.noteText,
    },
    { onConflict: 'user_id,gym_id,note_date' }
  );

  if (error) throw error;
}

export async function deleteDayNote(id: number): Promise<void> {
  const { error } = await supabase.from('gym_day_notes').delete().eq('id', id);
  if (error) throw error;
}
