import { Group, Stack, Text } from '@mantine/core';
import dayjs from 'dayjs';

import { useAuth } from '../../auth/AuthContext';
import { getClinicSettings } from '../clinicSettings';

/** Issue date, doctor identity and a blank signature line — shared footer for every printed document. */
export function DocumentSignature() {
  const user = useAuth();
  const { licenseNumber } = getClinicSettings();
  // Должность берётся у самого врача: общая специализация в реквизитах у второго врача была чужой.
  const specialty = user.role;

  return (
    <Stack gap="xs" mt={60}>
      <Text size="sm">Дата выдачи: {dayjs().format('D MMMM YYYY')}</Text>
      <Group justify="space-between" align="flex-end" wrap="nowrap" mt="md">
        <Stack gap={0}>
          <Text size="sm">
            Врач: {user.name}
            {specialty.trim() ? `, ${specialty.trim()}` : ''}
          </Text>
          {licenseNumber.trim() && (
            <Text size="xs" c="dimmed">
              № лицензии: {licenseNumber}
            </Text>
          )}
        </Stack>
        <Stack gap={2} align="center" style={{ minWidth: 200 }}>
          {user.signatureDataUrl && (
            <img src={user.signatureDataUrl} alt="" style={{ maxHeight: 56, maxWidth: 220, objectFit: 'contain' }} />
          )}
          <Text size="sm" style={{ borderBottom: '1px solid currentcolor', width: '100%', textAlign: 'center' }}>
            Подпись
          </Text>
        </Stack>
      </Group>
    </Stack>
  );
}
