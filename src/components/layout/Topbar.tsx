import { useLayoutEffect, useRef, useState } from 'react';
import {
  ActionIcon,
  Avatar,
  Box,
  Divider,
  Group,
  Text,
  ThemeIcon,
  Title,
  UnstyledButton,
} from '@mantine/core';
import { IconMenu2, IconStethoscope } from '@tabler/icons-react';
import { Link } from 'react-router-dom';

import { useAuth } from '../../features/auth/AuthContext';
import { getInitials } from '../../features/patients/utils';
import { HeaderNotifications } from './HeaderNotifications';
import { HeaderSearch } from './HeaderSearch';

/** Ниже этого заголовок уже не прочитать, и уравнивать стороны ради него незачем. */
const MIN_TITLE_WIDTH = 160;

interface TopbarProps {
  title: string;
  subtitle?: string;
  onBurgerClick?: () => void;
}

export function Topbar({ title, subtitle, onBurgerClick }: TopbarProps) {
  const user = useAuth();
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const [sideWidth, setSideWidth] = useState(0);

  /**
   * Стороны шапки уравниваются по более широкой из них.
   *
   * Одного `flex: 1 1 0` мало: справа поиск, колокольчик и карточка врача — вместе шире логотипа
   * слева, и когда правой стороне не хватает её доли, она забирает недостающее у левой. Заголовок
   * между ними съезжает — на измерении это было 20 px при ширине окна 1300 и 95 px при 1150.
   *
   * Меряется `scrollWidth`, а не занятая ширина: он не зависит от того, сжали сторону или нет, и
   * поэтому установка `min-width` не запускает новый круг измерений. Когда места перестаёт хватать
   * обеим сторонам сразу, укорачивается заголовок — он остаётся посередине, а не уезжает.
   */
  useLayoutEffect(() => {
    /**
     * Ширина **содержимого**, а не коробки.
     *
     * `scrollWidth` у растянутого flex-контейнера равен его собственной ширине, а не тому, сколько
     * места нужно содержимому. Меряя его, `min-width` защёлкивала бы уже растянутый размер, тот
     * становился бы новым минимумом — и заголовок между сторонами сжимался до многоточия. Отсюда
     * замер по крайним детям: он не зависит от того, растянули сторону или нет.
     */
    const contentWidth = (element: HTMLElement | null) => {
      if (!element) return 0;
      // Считается сумма видимых детей и промежутков между ними. Не по крайним элементам: скрытые
      // по ширине экрана (бургер, имя врача) остаются в разметке с нулевым прямоугольником в начале
      // координат, и размах от первого до последнего выходил отрицательным.
      const widths = Array.from(element.children)
        .map((child) => child.getBoundingClientRect().width)
        .filter((width) => width > 0);
      if (widths.length === 0) return 0;
      const gap = Number.parseFloat(getComputedStyle(element).columnGap) || 0;
      return Math.ceil(widths.reduce((total, width) => total + width, 0) + gap * (widths.length - 1));
    };

    const measure = () => {
      const left = contentWidth(leftRef.current);
      const right = contentWidth(rightRef.current);
      const container = rowRef.current?.clientWidth ?? 0;
      const widest = Math.max(left, right);
      // Уравнивать стороны можно только пока обе помещаются вместе с заголовком. Иначе жёсткая
      // `min-width` вытолкнула бы правую сторону за край окна, и вместо смещённого заголовка
      // получилась бы горизонтальная прокрутка всей шапки.
      const fits = container > 0 && widest * 2 + MIN_TITLE_WIDTH <= container;
      const next = fits ? widest : 0;
      setSideWidth((current) => (current === next ? current : next));
    };

    measure();
    const observer = new ResizeObserver(measure);
    if (leftRef.current) observer.observe(leftRef.current);
    if (rightRef.current) observer.observe(rightRef.current);
    if (rowRef.current) observer.observe(rowRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <Box h="100%" px="lg">
      <Group ref={rowRef} h="100%" justify="space-between" wrap="nowrap" gap="md">
        {/* Боковые группы делят свободное место поровну (flex-basis 0, одинаковый рост), поэтому
         * заголовок между ними стоит ровно посередине окна — а не посередине остатка, как было бы
         * при разной ширине сторон. Содержимое сторон при этом не сжимается ниже своего размера:
         * когда места перестаёт хватать, первым укорачивается заголовок. */}
        <Group ref={leftRef} gap="sm" wrap="nowrap" style={{ flex: '1 1 0', minWidth: sideWidth || undefined }}>
          <UnstyledButton component={Link} to="/dashboard">
            <Group gap={10} wrap="nowrap">
              <ThemeIcon
                size={38}
                radius="md"
                variant="gradient"
                gradient={{ from: 'brand.6', to: 'brand.8', deg: 135 }}
              >
                <IconStethoscope size={22} />
              </ThemeIcon>
              <Box visibleFrom="xs">
                <Text fw={700} size="md" lh={1.1}>
                  MedAssist
                </Text>
                <Text size="xs" c="dimmed" lh={1.1}>
                  Ассистент врача
                </Text>
              </Box>
            </Group>
          </UnstyledButton>

          <Divider orientation="vertical" visibleFrom="sm" />

          <ActionIcon
            variant="light"
            color="gray"
            size="lg"
            radius="md"
            hiddenFrom="sm"
            onClick={onBurgerClick}
          >
            <IconMenu2 size={18} />
          </ActionIcon>
        </Group>

        {/* Сжимающийся элемент, а не абсолютно позиционированная коробка: та не знала бы, сколько
         * места на самом деле нужно поиску, и длинный заголовок налезал бы на него на промежуточной
         * ширине окна (~1150px) вместо того, чтобы укоротиться. */}
        <Box visibleFrom="sm" style={{ flex: '0 1 auto', minWidth: 0, textAlign: 'center', overflow: 'hidden' }}>
          <Title order={3} fw={700} lh={1.2} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {title}
          </Title>
          {subtitle && (
            <Text size="xs" c="dimmed" truncate>
              {subtitle}
            </Text>
          )}
        </Box>

        <Group
          ref={rightRef}
          gap="sm"
          wrap="nowrap"
          justify="flex-end"
          style={{ flex: '1 1 0', minWidth: sideWidth || undefined }}
        >
          <HeaderSearch />
          <HeaderNotifications />
          <UnstyledButton component={Link} to="/doctor" visibleFrom="xs">
            <Group gap={8} wrap="nowrap">
              <Avatar src={user.avatarDataUrl ?? undefined} radius="md" color="brand" variant="filled">
                {getInitials(user.name)}
              </Avatar>
              {/* Имя и должность — с `md`, а не с `sm`: на промежуточной ширине они занимают те же
                  сто тридцать пикселей, из-за которых стороны перестают уравниваться и заголовок
                  съезжает. Кто вошёл, видно и по аватару. */}
              <Box visibleFrom="md">
                <Text fw={600} size="sm" lh={1.1}>
                  {user.name}
                </Text>
                <Text size="xs" c="dimmed" lh={1.1}>
                  {user.role}
                </Text>
              </Box>
            </Group>
          </UnstyledButton>
        </Group>
      </Group>
    </Box>
  );
}
