import { Grid } from '@mantine/core';

import { LabParameterInput } from './LabParameterInput';
import type { LabTestDefinition, ParamStatus, Sex } from './types';

interface LabTestFormProps {
  test: LabTestDefinition;
  sex: Sex;
  age: number | undefined;
  values: Record<string, number | undefined>;
  computedValues: Record<string, number>;
  statuses: Record<string, ParamStatus>;
  onChange: (key: string, value: number | undefined) => void;
}

export function LabTestForm({ test, sex, age, values, computedValues, statuses, onChange }: LabTestFormProps) {
  return (
    /*
     * Колонки выравниваются по нижнему краю, и это не косметика.
     *
     * У числового показателя под названием стоит норма («Норма: 0–0.14 г/л»), у выбора из списка её
     * нет — и в паре «Белок · Глюкоза» поля оказывались на разной высоте: одно ниже другого на
     * строку. Глаз идёт по бланку сверху вниз парами, и такая лесенка читается как сбитая вёрстка.
     *
     * Выравнивание по низу ставит сами поля в одну линию, а подпись остаётся там, где ей и место, —
     * прямо над своим полем. Пустая строка вместо нормы выровняла бы и подписи, но обещала бы, что
     * норма у показателя есть, просто не написана.
     */
    <Grid align="flex-end">
      {/*
        Колонка сетки — внутри мемоизированного поля, а не вокруг него.

        Снаружи она сводила мемоизацию на нет: сама колонка перерисовывалась на каждую набранную
        цифру, и тридцать колонок Mantine стоили столько же, сколько поля, которые они обёртывают.
      */}
      {test.parameters.map((param) => (
        <LabParameterInput
          key={param.key}
          param={param}
          sex={sex}
          age={age}
          value={param.inputType === 'derived' ? computedValues[param.key] : values[param.key]}
          status={statuses[param.key]}
          onChange={onChange}
        />
      ))}
    </Grid>
  );
}
