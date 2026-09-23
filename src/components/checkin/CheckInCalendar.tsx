import { Feather } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { DayNoteModal } from './DayNoteModal';
import { MonthYearPickerModal } from './MonthYearPickerModal';
import { fetchCheckInDatesForMonth } from '../../lib/checkin';
import { fetchDayNotesForMonth } from '../../lib/dayNotes';
import { APP_TIMEZONE, dateKeyInTimeZone } from '../../lib/time';
import { colors, fontSize, radius, spacing } from '../../theme';
import type { DayNote, MyGym } from '../../types/database';

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const CELL_WIDTH = `${100 / 7}%` as const;

type DayCell = { day: number; dateKey: string };

export function CheckInCalendar({
  userId,
  myGyms,
  refreshToken,
}: {
  userId: string;
  myGyms: MyGym[];
  refreshToken: number;
}) {
  const todayKey = dateKeyInTimeZone(new Date(), APP_TIMEZONE);
  const [todayYearStr, todayMonthStr] = todayKey.split('-');

  const [viewedYear, setViewedYear] = useState(Number(todayYearStr));
  const [viewedMonth, setViewedMonth] = useState(Number(todayMonthStr)); // 1-indexed
  const [markedDates, setMarkedDates] = useState<Set<string>>(new Set());
  const [notesByDate, setNotesByDate] = useState<Map<string, DayNote[]>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [activeDateKey, setActiveDateKey] = useState<string | null>(null);
  const [isPickerVisible, setIsPickerVisible] = useState(false);

  const loadMonth = useCallback(async () => {
    setIsLoading(true);
    try {
      const [checkedInTimestamps, notes] = await Promise.all([
        fetchCheckInDatesForMonth(userId, viewedYear, viewedMonth),
        fetchDayNotesForMonth(userId, viewedYear, viewedMonth),
      ]);

      setMarkedDates(
        new Set(checkedInTimestamps.map((iso) => dateKeyInTimeZone(new Date(iso), APP_TIMEZONE)))
      );

      const grouped = new Map<string, DayNote[]>();
      for (const note of notes) {
        const existing = grouped.get(note.noteDate) ?? [];
        existing.push(note);
        grouped.set(note.noteDate, existing);
      }
      setNotesByDate(grouped);
    } finally {
      setIsLoading(false);
    }
  }, [userId, viewedYear, viewedMonth]);

  useEffect(() => {
    loadMonth();
  }, [loadMonth, refreshToken]);

  function goToPreviousMonth() {
    if (viewedMonth === 1) {
      setViewedMonth(12);
      setViewedYear((year) => year - 1);
    } else {
      setViewedMonth((month) => month - 1);
    }
  }

  function goToNextMonth() {
    if (viewedMonth === 12) {
      setViewedMonth(1);
      setViewedYear((year) => year + 1);
    } else {
      setViewedMonth((month) => month + 1);
    }
  }

  function handlePickMonth(year: number, month: number) {
    setViewedYear(year);
    setViewedMonth(month);
    setIsPickerVisible(false);
  }

  const yearStr = String(viewedYear);
  const monthStr = String(viewedMonth).padStart(2, '0');
  const daysInMonth = new Date(viewedYear, viewedMonth, 0).getDate();
  const firstWeekday = new Date(viewedYear, viewedMonth - 1, 1).getDay();

  const cells: Array<DayCell | null> = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      return { day, dateKey: `${yearStr}-${monthStr}-${String(day).padStart(2, '0')}` };
    }),
  ];

  const activeDateNotes = activeDateKey ? notesByDate.get(activeDateKey) ?? [] : [];
  // YYYY-MM-DD keys compare correctly as strings. Future dates stay editable
  // (planning notes); only dates strictly before today lock.
  const isActiveDateReadOnly = activeDateKey !== null && activeDateKey < todayKey;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Pressable style={styles.navButton} onPress={goToPreviousMonth} hitSlop={8}>
          <Feather name="chevron-left" size={18} color={colors.textPrimary} />
        </Pressable>

        <Pressable
          style={styles.headerTitleRow}
          onPress={() => setIsPickerVisible(true)}
          hitSlop={8}
        >
          <Text style={styles.title}>
            {MONTH_NAMES[viewedMonth - 1]} {viewedYear}
          </Text>
          <Feather name="chevron-down" size={14} color={colors.textMuted} />
          {isLoading ? (
            <ActivityIndicator color={colors.emerald} size="small" style={styles.headerSpinner} />
          ) : null}
        </Pressable>

        <Pressable style={styles.navButton} onPress={goToNextMonth} hitSlop={8}>
          <Feather name="chevron-right" size={18} color={colors.textPrimary} />
        </Pressable>
      </View>

      <View style={styles.weekdayRow}>
        {WEEKDAY_LABELS.map((label, index) => (
          <Text key={index} style={styles.weekdayLabel}>
            {label}
          </Text>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((cell, index) => {
          if (!cell) return <View key={`blank-${index}`} style={styles.cell} />;

          const isChecked = markedDates.has(cell.dateKey);
          const isToday = cell.dateKey === todayKey;
          const hasNote = notesByDate.has(cell.dateKey);
          // Past day with no note: nothing to view and nothing editable.
          const isInert = cell.dateKey < todayKey && !hasNote;

          return (
            <Pressable
              key={cell.dateKey}
              style={styles.cell}
              disabled={isInert}
              onPress={() => setActiveDateKey(cell.dateKey)}
            >
              <View
                style={[
                  styles.dayCircle,
                  isChecked && styles.dayCircleChecked,
                  isToday && styles.dayCircleToday,
                ]}
              >
                <Text style={[styles.dayText, isChecked && styles.dayTextChecked]}>{cell.day}</Text>
              </View>
              {hasNote ? (
                <View style={styles.noteBadge}>
                  <Feather name="edit-3" size={8} color={colors.textOnAccent} />
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      <DayNoteModal
        visible={activeDateKey !== null}
        dateKey={activeDateKey}
        userId={userId}
        myGyms={myGyms}
        notesForDate={activeDateNotes}
        readOnly={isActiveDateReadOnly}
        onClose={() => setActiveDateKey(null)}
        onSaved={loadMonth}
      />

      <MonthYearPickerModal
        visible={isPickerVisible}
        year={viewedYear}
        month={viewedMonth}
        onSelect={handlePickMonth}
        onClose={() => setIsPickerVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerSpinner: {
    marginLeft: spacing.xs,
  },
  navButton: {
    width: 30,
    height: 30,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  weekdayRow: {
    flexDirection: 'row',
  },
  weekdayLabel: {
    width: CELL_WIDTH,
    textAlign: 'center',
    fontSize: fontSize.xs,
    fontWeight: '600',
    color: colors.textMuted,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: CELL_WIDTH,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  dayCircle: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircleChecked: {
    backgroundColor: colors.emerald,
  },
  dayCircleToday: {
    borderWidth: 1.5,
    borderColor: colors.emeraldLight,
  },
  dayText: {
    fontSize: fontSize.sm,
    color: colors.textPrimary,
  },
  dayTextChecked: {
    color: colors.white,
    fontWeight: '700',
  },
  noteBadge: {
    position: 'absolute',
    top: -2,
    right: 6,
    width: 13,
    height: 13,
    borderRadius: 6.5,
    backgroundColor: colors.emeraldLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
