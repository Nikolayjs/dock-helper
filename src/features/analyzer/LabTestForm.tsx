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
    <Grid>
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
