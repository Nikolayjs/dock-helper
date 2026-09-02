import { useMemo } from 'react';
import { Combobox, Loader, Text, TextInput, useCombobox } from '@mantine/core';

import { getTopDiagnoses } from '../dashboard/practice';
import { useIcd10Search } from './useIcd10Search';
import { usePatients } from './usePatients';

interface DiagnosisPickerProps {
  label?: string;
  value: string;
  onChange: (value: string, code?: string) => void;
}

export function DiagnosisPicker({ label = 'Диагноз', value, onChange }: DiagnosisPickerProps) {
  const combobox = useCombobox({
    onDropdownClose: () => combobox.resetSelectedOption(),
  });
  const { results, isSearching } = useIcd10Search(value);
  const trimmedLength = value.trim().length;

  /**
   * Пока не набрано ни буквы — частые диагнозы этого врача, а не пустая подсказка.
   *
   * Поиск по МКБ-10 начинается с двух символов, и до них список был пуст: врач набирал один и тот
   * же диагноз руками изо дня в день, хотя приложение уже считает, какие у него ходовые (тот же
   * `getTopDiagnoses`, что кормит дашборд). Это подсказка, а не ограничение: набранное слово
   * по-прежнему ищется по классификации.
   */
  const { patients } = usePatients();
  const frequent = useMemo(() => getTopDiagnoses(patients, 8), [patients]);

  return (
    <Combobox
      store={combobox}
      onOptionSubmit={(optionValue) => {
        const picked = results.find((r) => r.code === optionValue);
        if (picked) {
          onChange(picked.name, picked.code);
        } else {
          const known = frequent.find((item) => (item.code ?? item.label) === optionValue);
          if (known) onChange(known.label, known.code);
        }
        combobox.closeDropdown();
      }}
    >
      <Combobox.Target>
        <TextInput
          label={label}
          placeholder="Начните вводить код или название по МКБ-10…"
          value={value}
          onChange={(e) => {
            onChange(e.currentTarget.value, undefined);
            combobox.openDropdown();
            combobox.updateSelectedOptionIndex();
          }}
          onFocus={() => {
            if (trimmedLength >= 2 || (trimmedLength === 0 && frequent.length > 0)) combobox.openDropdown();
          }}
          onBlur={() => combobox.closeDropdown()}
          rightSection={isSearching ? <Loader size={14} /> : null}
        />
      </Combobox.Target>

      <Combobox.Dropdown>
        <Combobox.Options mah={280} style={{ overflowY: 'auto' }}>
          {trimmedLength === 0 && frequent.length > 0 ? (
            <>
              <Combobox.Group label="Частые у вас">
                {frequent.map((item) => (
                  <Combobox.Option value={item.code ?? item.label} key={item.code ?? item.label}>
                    <Text size="sm">
                      {item.code && (
                        <Text span fw={600} mr={6}>
                          {item.code}
                        </Text>
                      )}
                      {item.label}
                    </Text>
                  </Combobox.Option>
                ))}
              </Combobox.Group>
            </>
          ) : trimmedLength < 2 ? (
            <Combobox.Empty>Введите минимум 2 символа для поиска по МКБ-10</Combobox.Empty>
          ) : results.length === 0 ? (
            <Combobox.Empty>Не найдено в МКБ-10 — можно ввести диагноз вручную</Combobox.Empty>
          ) : (
            results.map((entry) => (
              <Combobox.Option value={entry.code} key={entry.code}>
                <Text size="sm">
                  <Text span fw={600} mr={6}>
                    {entry.code}
                  </Text>
                  {entry.name}
                </Text>
              </Combobox.Option>
            ))
          )}
        </Combobox.Options>
      </Combobox.Dropdown>
    </Combobox>
  );
}
