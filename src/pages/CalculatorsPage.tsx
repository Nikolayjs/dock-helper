import { useMemo, useState } from 'react';
import { Button, Card, Container, Group, SimpleGrid, Stack, Text, TextInput, ThemeIcon, Tabs } from '@mantine/core';
import { IconCalculatorOff, IconPlus, IconSearch } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';

import { CalculatorCard } from '../features/calculators/CalculatorCard';
import { CALCULATOR_CATEGORIES } from '../features/calculators/types';
import { useCalculators } from '../features/calculators/useCalculators';
import { QueryState } from '../components/common/QueryState';

export function CalculatorsPage() {
  const navigate = useNavigate();
  const { calculators, toggleFavourite, isLoading, error, refetch } = useCalculators();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('all');

  const filtered = useMemo(() => {
    return calculators.filter((calc) => {
      const matchesCategory = category === 'all' ? true : calc.category === category;
      const matchesSearch =
        !search.trim() ||
        calc.title.toLowerCase().includes(search.toLowerCase()) ||
        calc.description.toLowerCase().includes(search.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [calculators, search, category]);

  const usedCategories = useMemo(() => {
    const present = new Set(calculators.map((calc) => calc.category));
    const known = CALCULATOR_CATEGORIES.filter((c) => present.has(c));
    const custom = [...present]
      .filter((c) => !(CALCULATOR_CATEGORIES as readonly string[]).includes(c))
      .sort((a, b) => a.localeCompare(b, 'ru'));
    return [...known, ...custom];
  }, [calculators]);

  return (
    <Container size="xl" px={0}>
      <Group justify="space-between" align="flex-end" mb="lg" wrap="wrap">
        <div>
          <Text c="dimmed" size="sm">
            {calculators.length} калькуляторов доступно
          </Text>
        </div>
        <Button leftSection={<IconPlus size={18} />} onClick={() => navigate('/calculators/new')}>
          Создать калькулятор
        </Button>
      </Group>

      <Group justify="space-between" mb="lg" wrap="wrap" gap="md">
        <Tabs value={category} onChange={(v) => setCategory(v ?? 'all')} variant="pills">
          <Tabs.List>
            <Tabs.Tab value="all">Все</Tabs.Tab>
            {usedCategories.map((c) => (
              <Tabs.Tab key={c} value={c}>
                {c}
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs>
        <TextInput
          placeholder="Поиск калькулятора…"
          leftSection={<IconSearch size={16} />}
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          w={260}
        />
      </Group>

      <QueryState isLoading={isLoading} error={error} onRetry={refetch} what="калькуляторы">
        {filtered.length === 0 ? (
          <Card withBorder padding="xl">
            <Stack align="center" gap="sm" py="xl">
              <ThemeIcon size={48} radius="xl" variant="light" color="gray">
                <IconCalculatorOff size={24} />
              </ThemeIcon>
              <Text fw={600}>Ничего не найдено</Text>
              <Text size="sm" c="dimmed">
                Попробуйте изменить запрос или создайте свой калькулятор.
              </Text>
            </Stack>
          </Card>
        ) : (
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
            {filtered.map((calc) => (
              <CalculatorCard key={calc.id} definition={calc} onToggleFavourite={() => toggleFavourite(calc)} />
            ))}
          </SimpleGrid>
        )}
      </QueryState>
    </Container>
  );
}
