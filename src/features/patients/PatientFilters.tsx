import { Button, Group, Select } from '@mantine/core';
import { IconFilterOff } from '@tabler/icons-react';

import {
  EMPTY_PATIENT_FILTERS,
  countActiveFilters,
  type PatientFilterState,
} from './patientFiltering';

/** The filter row itself; what the choices mean lives in `patientFiltering.ts`. */

interface PatientFiltersProps {
  value: PatientFilterState;
  onChange: (value: PatientFilterState) => void;
}

export function PatientFilters({ value, onChange }: PatientFiltersProps) {
  const set = <K extends keyof PatientFilterState>(key: K, next: string | null) => {
    if (next) onChange({ ...value, [key]: next as PatientFilterState[K] });
  };

  return (
    <Group gap="sm" wrap="wrap" align="flex-end">
      <Select
        label="Пол"
        w={130}
        allowDeselect={false}
        value={value.sex}
        onChange={(next) => set('sex', next)}
        data={[
          { value: 'all', label: 'Все' },
          { value: 'male', label: 'Мужской' },
          { value: 'female', label: 'Женский' },
        ]}
      />
      <Select
        label="Возраст"
        w={150}
        allowDeselect={false}
        value={value.age}
        onChange={(next) => set('age', next)}
        data={[
          { value: 'all', label: 'Любой' },
          { value: 'child', label: 'До 18 лет' },
          { value: 'adult', label: '18–59 лет' },
          { value: 'senior', label: '60 лет и старше' },
        ]}
      />
      <Select
        label="Визиты"
        w={160}
        allowDeselect={false}
        value={value.visits}
        onChange={(next) => set('visits', next)}
        data={[
          { value: 'all', label: 'Неважно' },
          { value: 'with', label: 'Есть визиты' },
          { value: 'without', label: 'Ни одного визита' },
        ]}
      />
      <Select
        label="Напоминание"
        w={160}
        allowDeselect={false}
        value={value.reminder}
        onChange={(next) => set('reminder', next)}
        data={[
          { value: 'all', label: 'Неважно' },
          { value: 'any', label: 'Назначено' },
          { value: 'overdue', label: 'Просрочено' },
        ]}
      />
      <Button
        variant="subtle"
        color="gray"
        leftSection={<IconFilterOff size={16} />}
        disabled={countActiveFilters(value) === 0}
        onClick={() => onChange(EMPTY_PATIENT_FILTERS)}
      >
        Сбросить
      </Button>
    </Group>
  );
}
