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
      {test.parameters.map((param) => (
        <Grid.Col key={param.key} span={{ base: 12, sm: 6 }}>
          <LabParameterInput
            param={param}
            sex={sex}
            age={age}
            value={param.inputType === 'derived' ? computedValues[param.key] : values[param.key]}
            status={statuses[param.key]}
            onChange={(value) => onChange(param.key, value)}
          />
        </Grid.Col>
      ))}
    </Grid>
  );
}
