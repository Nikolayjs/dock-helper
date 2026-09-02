import { useState } from 'react';
import { Button, Group, Modal, Select, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import dayjs from 'dayjs';

import { useSaveAction } from '../../components/common/useSaveAction';
import type { Patient } from '../patients/types';
import { usePatients } from '../patients/usePatients';
import { sortedVisits } from '../patients/utils';
import { appendToNote } from './resultLine';

/** Значение выбора «завести новый визит», а не дописать в существующий. */
const NEW_VISIT = 'new';

interface SaveToVisitModalProps {
  patient: Patient;
  /** Строка о расчёте; `null` — окно закрыто. */
  line: string | null;
  onClose: () => void;
}

/**
 * Запись результата расчёта в визит.
 *
 * Отдельного места для расчётов в карте нет и заводить его незачем: врач и от руки пишет их в
 * приём. Поэтому строка **дописывается к заметке визита**, не затирая написанного, — а какой
 * визит, выбирает врач: расчёт по бланку недельной давности относится к тому приёму, а не к
 * сегодняшнему.
 *
 * Визитов может не быть вовсе, поэтому первым пунктом всегда стоит «Новый визит сегодня»: иначе
 * запись упиралась бы в пустой список, а завести визит пришлось бы на другой странице.
 */
export function SaveToVisitModal({ patient, line, onClose }: SaveToVisitModalProps) {
  const { addVisit, updateVisit, refetch } = usePatients();
  const visits = sortedVisits(patient.visits);
  const [target, setTarget] = useState<string>(visits[0]?.id ?? NEW_VISIT);

  const { saving, save } = useSaveAction(undefined, async () => {
    if (!line) return;
    if (target === NEW_VISIT) {
      await addVisit(patient.id, {
        date: dayjs().format('YYYY-MM-DD'),
        diagnosis: '',
        diagnosisCode: undefined,
        note: line,
        referralCategory: null,
        referralDestination: '',
      });
    } else {
      /**
       * Визит собирается из **свежего** списка, а не из того, что лежало в кэше при открытии окна.
       *
       * PATCH уходит со всеми полями визита, версии записи нет, а список пациентов смонтирован
       * всегда и сам не перезагружается (`refetchOnWindowFocus: false`) — то есть между открытием
       * калькулятора и нажатием «Записать» помещается чужая правка того же визита, и она была бы
       * затёрта нашей копией. Перечитывание сужает окно до одного запроса; закрыть его полностью
       * может только версия записи и 409 на сервере.
       */
      const fresh = await refetch();
      const current = fresh.find((item) => item.id === patient.id) ?? patient;
      const visit = current.visits.find((item) => item.id === target);
      if (!visit) return;
      await updateVisit(patient.id, visit.id, {
        date: visit.date,
        diagnosis: visit.diagnosis,
        diagnosisCode: visit.diagnosisCode,
        note: appendToNote(visit.note, line),
        referralCategory: visit.referralCategory,
        referralDestination: visit.referralDestination,
      });
    }
    notifications.show({ message: 'Расчёт записан в визит', color: 'teal' });
    onClose();
  });

  return (
    <Modal opened={line !== null} onClose={onClose} title="Записать расчёт в визит" radius="md" size="lg">
      <Stack gap="md">
        <Select
          label="Визит"
          description="Строка дописывается к заметке, ничего не затирая"
          data={[
            { value: NEW_VISIT, label: `Новый визит сегодня — ${dayjs().format('D MMMM YYYY')}` },
            ...visits.map((visit) => ({
              value: visit.id,
              label: `${dayjs(visit.date).format('D MMMM YYYY')}${visit.diagnosis ? ` — ${visit.diagnosis}` : ''}`,
            })),
          ]}
          value={target}
          onChange={(value) => setTarget(value ?? NEW_VISIT)}
          allowDeselect={false}
          comboboxProps={{ withinPortal: true }}
        />

        {/* Что именно запишется, видно до записи: строка уходит в карту пациента. */}
        <Stack gap={4}>
          <Text size="sm" c="dimmed">
            Будет записано
          </Text>
          <Text size="sm">{line}</Text>
        </Stack>

        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Отмена
          </Button>
          <Button onClick={() => void save()} loading={saving}>
            Записать
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
