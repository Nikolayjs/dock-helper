import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { Alert, Button, Card, Code, Group, Spoiler, Stack, Text, Title } from '@mantine/core';
import { IconAlertTriangle, IconRefresh } from '@tabler/icons-react';

interface Props {
  children: ReactNode;
  /**
   * Что именно сломалось: «Читалка», «Диаграмма». Задаётся у узких границ — они стоят вокруг
   * одного блока, и сообщение обязано называть его, иначе врач ищет поломку не там.
   */
  what?: string;
  /** Компактный вид: сломался кусок страницы, а не весь экран. */
  compact?: boolean;
}

interface State {
  error: Error | null;
}

/**
 * Последний рубеж: исключение при рендере не должно оставлять белый лист.
 *
 * До этого границ не было ни одной — любое исключение размонтировало всё дерево, и врач видел
 * пустую страницу без единого слова о том, что случилось и что делать. Кандидаты не гипотетические:
 * таблица документа, граф знаний на d3, читалки поверх вендорного `djvu.js` и шесть мест, куда
 * вставляется чужой HTML.
 *
 * Классовый компонент, потому что хуками это не пишется: `getDerivedStateFromError` есть только у
 * классов, и другого способа поймать ошибку рендера в React нет.
 *
 * **Узкие границы важнее общей.** Общая спасает от белого листа, но страница всё равно потеряна;
 * граница вокруг графа или читалки оставляет на месте всё остальное — заголовок, сайдбар, соседние
 * блоки, — и врач может уйти со страницы обычной ссылкой, а не кнопкой «перезагрузить».
 */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Консоль — единственное место, где остаётся стек: сборщика ошибок в проекте нет.
    console.error('Ошибка рендера', this.props.what ?? '', error, info.componentStack);
  }

  private reset = () => this.setState({ error: null });

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    const { what, compact } = this.props;
    const details = error.message || String(error);

    if (compact) {
      return (
        <Alert color="red" variant="light" icon={<IconAlertTriangle size={18} />} title={what ? `${what}: ошибка` : 'Ошибка'}>
          <Stack gap="xs" align="flex-start">
            <Text size="sm">Этот блок не отрисовался. Остальная страница работает.</Text>
            <Spoiler maxHeight={0} showLabel="Подробности" hideLabel="Скрыть">
              <Code block>{details}</Code>
            </Spoiler>
            <Button size="compact-sm" variant="light" leftSection={<IconRefresh size={14} />} onClick={this.reset}>
              Попробовать снова
            </Button>
          </Stack>
        </Alert>
      );
    }

    return (
      <Card withBorder padding="xl" radius="lg" maw={640} mx="auto" mt="xl">
        <Stack gap="md">
          <Title order={3}>Что-то сломалось</Title>
          <Text c="dimmed">
            {what ? `Раздел «${what}» не отрисовался. ` : ''}
            Данные не потеряны — они на сервере. Обновите страницу или вернитесь на главную.
          </Text>
          <Spoiler maxHeight={0} showLabel="Подробности ошибки" hideLabel="Скрыть подробности">
            <Code block>{details}</Code>
          </Spoiler>
          <Group>
            <Button leftSection={<IconRefresh size={16} />} onClick={() => window.location.reload()}>
              Перезагрузить страницу
            </Button>
            {/* Обычная ссылка, а не `navigate`: роутер мог упасть вместе со страницей. */}
            <Button variant="default" component="a" href="/">
              На главную
            </Button>
          </Group>
        </Stack>
      </Card>
    );
  }
}
