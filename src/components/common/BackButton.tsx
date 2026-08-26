import { Button } from '@mantine/core';
import { IconArrowLeft } from '@tabler/icons-react';
import { Link } from 'react-router-dom';

import { useBackTarget, type BackTarget } from '../../lib/backTarget';

/**
 * Кнопка «назад», которая ведёт туда, откуда пришли.
 *
 * `fallback` — куда возвращаться, если ссылка не сообщила происхождения: как правило, свой раздел.
 * Так страница, открытая по прямому адресу или из закладок, ведёт себя как раньше.
 */
export function BackButton({ fallback }: { fallback: BackTarget }) {
  const target = useBackTarget(fallback);

  return (
    <Button
      component={Link}
      to={target.to}
      variant="subtle"
      leftSection={<IconArrowLeft size={16} />}
      pl={8}
      style={{ alignSelf: 'flex-start' }}
    >
      {target.label}
    </Button>
  );
}
