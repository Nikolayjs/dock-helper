import { Stack, Text } from '@mantine/core';

import { getClinicSettings } from '../clinicSettings';

/** Clinic name/address header for a printed document. Renders nothing if neither is set. */
export function DocumentLetterhead() {
  const { clinicName, clinicAddress } = getClinicSettings();
  if (!clinicName.trim() && !clinicAddress.trim()) return null;

  return (
    <Stack gap={0} align="center" mb="lg">
      {clinicName.trim() && (
        <Text fw={700} ta="center">
          {clinicName}
        </Text>
      )}
      {clinicAddress.trim() && (
        <Text size="sm" c="dimmed" ta="center">
          {clinicAddress}
        </Text>
      )}
    </Stack>
  );
}
