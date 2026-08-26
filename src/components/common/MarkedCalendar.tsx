import { Box, Text } from '@mantine/core';
import { Calendar } from '@mantine/dates';
import dayjs from 'dayjs';

import classes from './MarkedCalendar.module.css';

/**
 * A month calendar with a dot under every day that has something on it.
 *
 * The notes tab and the reminders tab had the same calendar written out twice, differing only in
 * the colour of the dot — so the one bug in it, a grid too wide for a phone, had to be found twice
 * as well. See the stylesheet for what makes it fit.
 */

interface MarkedCalendarProps {
  /** `YYYY-MM-DD`. */
  selectedDate: string;
  onSelectDate: (date: string) => void;
  /** What sits on each day; a day missing from the map, or holding nothing, gets no dot. */
  entriesByDate: Map<string, readonly unknown[]>;
  /** Mantine colour for the dot — notes and reminders are told apart by it. */
  dotColor: string;
}

export function MarkedCalendar({ selectedDate, onSelectDate, entriesByDate, dotColor }: MarkedCalendarProps) {
  return (
    <div className={classes.fluid}>
      <Calendar
        className={classes.calendar}
        size="lg"
        highlightToday
        defaultDate={selectedDate}
        getDayProps={(date) => ({
          selected: date === selectedDate,
          onClick: () => onSelectDate(date),
        })}
        renderDay={(date) => {
          const count = entriesByDate.get(date)?.length ?? 0;
          return (
            <Box
              pos="relative"
              style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <Text size="sm">{dayjs(date).date()}</Text>
              <Box
                style={{
                  position: 'absolute',
                  bottom: 4,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: 5,
                  height: 5,
                  borderRadius: 999,
                  backgroundColor: count > 0 ? dotColor : 'transparent',
                }}
              />
            </Box>
          );
        }}
      />
    </div>
  );
}
