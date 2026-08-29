import { Container } from '@mantine/core';

import { Icd10Catalog } from '../features/icd10/Icd10Catalog';

/**
 * Собственного заголовка у страницы нет: раздел называет шапка приложения (`PAGE_META`), и второй
 * такой же заголовок под ней — повтор, съедающий первый экран. Так же устроен справочник препаратов.
 */
export function Icd10Page() {
  return (
    <Container size="xl" px={0}>
      <Icd10Catalog />
    </Container>
  );
}
