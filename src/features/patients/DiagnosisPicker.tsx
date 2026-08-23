import { Combobox, Loader, Text, TextInput, useCombobox } from '@mantine/core';

import { useIcd10Search } from './useIcd10Search';

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

  return (
    <Combobox
      store={combobox}
      onOptionSubmit={(optionValue) => {
        const picked = results.find((r) => r.code === optionValue);
        if (picked) onChange(picked.name, picked.code);
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
            if (trimmedLength >= 2) combobox.openDropdown();
          }}
          onBlur={() => combobox.closeDropdown()}
          rightSection={isSearching ? <Loader size={14} /> : null}
        />
      </Combobox.Target>

      <Combobox.Dropdown>
        <Combobox.Options mah={280} style={{ overflowY: 'auto' }}>
          {trimmedLength < 2 ? (
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
