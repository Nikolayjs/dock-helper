import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import {
  ActionIcon,
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  Container,
  Group,
  Image,
  Modal,
  Pagination,
  PasswordInput,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Title,
  UnstyledButton,
  useMantineColorScheme,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconArrowRight,
  IconArrowsSort,
  IconCamera,
  IconCheck,
  IconChecklist,
  IconDeviceDesktop,
  IconKey,
  IconLogout,
  IconMoonStars,
  IconNote,
  IconNotes,
  IconPrinter,
  IconSun,
  IconUpload,
  IconUserPlus,
  IconUsers,
  IconX,
} from '@tabler/icons-react';
import dayjs from 'dayjs';
import { Link, useNavigate } from 'react-router-dom';

import { WallpaperPicker } from '../features/appearance/WallpaperPicker';
import { useSidebarOrder } from '../components/layout/useSidebarOrder';
import { AuthApiError, changePassword, updateProfile } from '../features/auth/authApi';
import { useAuth, useLogout, useUpdateAuthUser } from '../features/auth/AuthContext';
import { getClinicSettings, setClinicSettings, type ClinicSettings } from '../features/patients/clinicSettings';
import { stripHtml } from '../features/notes/textPreview';
import { useNotes } from '../features/notes/useNotes';
import { getMembers, invite, type WorkspaceMember } from '../features/workspace/workspaceApi';
import { resizeImageToDataUrl } from '../lib/imageResize';

const AVATAR_MAX_DIMENSION = 256;
const SIGNATURE_MAX_DIMENSION = 480;

const NOTES_PAGE_SIZE = 10;

type SchemeOption = 'light' | 'dark' | 'auto';

const THEME_OPTIONS: { value: SchemeOption; label: string; description: string; icon: typeof IconSun }[] = [
  { value: 'light', label: 'Светлая', description: 'Всегда светлое оформление', icon: IconSun },
  { value: 'dark', label: 'Тёмная', description: 'Всегда тёмное оформление', icon: IconMoonStars },
  { value: 'auto', label: 'Как в системе', description: 'Подстраивается под настройки ОС', icon: IconDeviceDesktop },
];

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function getNoteExcerpt(note: { kind: string; content: string; items: { text: string }[] }) {
  if (note.kind === 'todo') {
    return note.items.map((item) => item.text).join(', ') || 'Пустой чек-лист';
  }
  return stripHtml(note.content) || 'Без текста';
}

export function DoctorPage() {
  const { notes } = useNotes();
  const user = useAuth();
  const updateAuthUser = useUpdateAuthUser();
  const logout = useLogout();
  const navigate = useNavigate();
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  const { hasCustomOrder, resetOrder } = useSidebarOrder();
  const [clinicSettings, setClinicSettingsState] = useState<ClinicSettings>(() => getClinicSettings());

  const [name, setName] = useState(user.name);
  const [role, setRole] = useState(user.role);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const signatureInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isUploadingSignature, setIsUploadingSignature] = useState(false);

  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [inviteUsername, setInviteUsername] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const showProfileError = (error: unknown, fallback: string) => {
    notifications.show({ message: error instanceof Error ? error.message : fallback, color: 'red' });
  };

  useEffect(() => {
    void getMembers()
      .then(setMembers)
      .catch((error: unknown) => showProfileError(error, 'Не удалось загрузить список команды'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleInvite = async () => {
    setInviteError(null);
    setIsInviting(true);
    try {
      await invite(inviteUsername.trim());
      setInviteUsername('');
      notifications.show({ message: 'Врач добавлен в вашу команду', color: 'teal' });
      setMembers(await getMembers());
    } catch (error) {
      setInviteError(error instanceof Error ? error.message : 'Не удалось добавить врача');
    } finally {
      setIsInviting(false);
    }
  };

  const closePasswordModal = () => {
    setPasswordModalOpen(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmNewPassword('');
    setPasswordError(null);
  };

  const handleChangePassword = async () => {
    setPasswordError(null);
    if (newPassword !== confirmNewPassword) {
      setPasswordError('Новые пароли не совпадают.');
      return;
    }
    setIsChangingPassword(true);
    try {
      await changePassword(currentPassword, newPassword);
      notifications.show({ message: 'Пароль изменён', color: 'teal' });
      closePasswordModal();
    } catch (error) {
      setPasswordError(error instanceof AuthApiError ? error.message : 'Не удалось сменить пароль');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleNameRoleBlur = () => {
    void updateProfile({ name, role }).then(updateAuthUser).catch((error: unknown) => showProfileError(error, 'Не удалось сохранить профиль'));
  };

  const handleAvatarChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setIsUploadingAvatar(true);
    try {
      const avatarDataUrl = await resizeImageToDataUrl(file, AVATAR_MAX_DIMENSION, 'image/jpeg');
      updateAuthUser(await updateProfile({ avatarDataUrl }));
    } catch (error) {
      showProfileError(error, 'Не удалось загрузить фото');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleSignatureChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setIsUploadingSignature(true);
    try {
      const signatureDataUrl = await resizeImageToDataUrl(file, SIGNATURE_MAX_DIMENSION, 'image/png');
      updateAuthUser(await updateProfile({ signatureDataUrl }));
    } catch (error) {
      showProfileError(error, 'Не удалось загрузить подпись');
    } finally {
      setIsUploadingSignature(false);
    }
  };

  const handleRemoveSignature = async () => {
    try {
      updateAuthUser(await updateProfile({ signatureDataUrl: null }));
    } catch (error) {
      showProfileError(error, 'Не удалось удалить подпись');
    }
  };

  const sortedNotes = useMemo(() => [...notes].sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [notes]);
  const totalPages = Math.max(1, Math.ceil(sortedNotes.length / NOTES_PAGE_SIZE));
  const [page, setPage] = useState(1);
  const activePage = Math.min(page, totalPages);
  const pageNotes = sortedNotes.slice((activePage - 1) * NOTES_PAGE_SIZE, activePage * NOTES_PAGE_SIZE);

  const handleResetOrder = () => {
    resetOrder();
    notifications.show({ message: 'Порядок разделов меню сброшен', color: 'gray' });
  };

  const handleClinicFieldChange = (field: keyof ClinicSettings, value: string) => {
    setClinicSettingsState((prev) => ({ ...prev, [field]: value }));
  };

  const handleClinicFieldBlur = () => {
    void setClinicSettings(clinicSettings);
  };

  return (
    <Container size="md" px={0}>
      <Stack gap="lg">
        <Card withBorder padding="lg">
          <Group align="flex-start" gap={20} wrap="wrap">
            <Stack align="center" gap={6}>
              <Box style={{ position: 'relative' }}>
                <Avatar src={user.avatarDataUrl ?? undefined} size={80} radius={999} color="brand" variant="filled">
                  {getInitials(name || user.name)}
                </Avatar>
                <ActionIcon
                  variant="filled"
                  color="brand"
                  size={26}
                  radius="xl"
                  style={{ position: 'absolute', bottom: -2, right: -2, border: '2px solid var(--mantine-color-body)' }}
                  onClick={() => avatarInputRef.current?.click()}
                  loading={isUploadingAvatar}
                  aria-label="Изменить фото"
                >
                  <IconCamera size={14} />
                </ActionIcon>
              </Box>
              <input ref={avatarInputRef} type="file" accept="image/*" hidden onChange={handleAvatarChange} />
            </Stack>

            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md" style={{ flex: 1, minWidth: 240 }}>
              <TextInput label="Имя" value={name} onChange={(e) => setName(e.currentTarget.value)} onBlur={handleNameRoleBlur} />
              <TextInput label="Должность" value={role} onChange={(e) => setRole(e.currentTarget.value)} onBlur={handleNameRoleBlur} />
            </SimpleGrid>
          </Group>
        </Card>

        <Card withBorder padding="lg">
          <Title order={4} mb={4}>
            Тема оформления
          </Title>
          <Text size="sm" c="dimmed" mb="lg">
            Выберите, как должен выглядеть интерфейс MedAssist.
          </Text>

          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
            {THEME_OPTIONS.map((option) => {
              const active = colorScheme === option.value;
              return (
                <UnstyledButton
                  key={option.value}
                  onClick={() => setColorScheme(option.value)}
                  p="md"
                  style={{
                    position: 'relative',
                    borderRadius: 14,
                    border: `1.5px solid ${active ? 'var(--mantine-color-brand-6)' : 'var(--mantine-color-default-border)'}`,
                    backgroundColor: active ? 'var(--mantine-color-brand-light)' : 'transparent',
                  }}
                >
                  {active && (
                    <ThemeIcon
                      size={20}
                      radius="xl"
                      color="brand"
                      style={{ position: 'absolute', top: 10, right: 10 }}
                    >
                      <IconCheck size={12} />
                    </ThemeIcon>
                  )}
                  <ThemeIcon size={40} radius="md" variant="light" color={active ? 'brand' : 'gray'} mb="sm">
                    <option.icon size={20} stroke={1.8} />
                  </ThemeIcon>
                  <Text fw={600} size="sm">
                    {option.label}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {option.description}
                  </Text>
                </UnstyledButton>
              );
            })}
          </SimpleGrid>
        </Card>

        <WallpaperPicker />

        <Card withBorder padding="lg">
          <Group gap={8} mb={4}>
            <ThemeIcon variant="light" color="brand" size={30} radius="md">
              <IconPrinter size={16} />
            </ThemeIcon>
            <Title order={4}>Реквизиты для документов</Title>
          </Group>
          <Text size="sm" c="dimmed" mb="lg">
            Эти данные подставляются в шапку и подпись печатных документов — справок и направлений.
          </Text>

          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <TextInput
              label="Специализация"
              placeholder="Терапевт"
              value={clinicSettings.specialty}
              onChange={(e) => handleClinicFieldChange('specialty', e.currentTarget.value)}
              onBlur={handleClinicFieldBlur}
            />
            <TextInput
              label="Номер лицензии"
              placeholder="ЛО-00-00-000000"
              value={clinicSettings.licenseNumber}
              onChange={(e) => handleClinicFieldChange('licenseNumber', e.currentTarget.value)}
              onBlur={handleClinicFieldBlur}
            />
            <TextInput
              label="Название клиники"
              placeholder="Клиника «АБИА»"
              value={clinicSettings.clinicName}
              onChange={(e) => handleClinicFieldChange('clinicName', e.currentTarget.value)}
              onBlur={handleClinicFieldBlur}
            />
            <TextInput
              label="Адрес клиники"
              placeholder="г. Москва, ул. Примерная, д. 1"
              value={clinicSettings.clinicAddress}
              onChange={(e) => handleClinicFieldChange('clinicAddress', e.currentTarget.value)}
              onBlur={handleClinicFieldBlur}
            />
          </SimpleGrid>

          <Stack gap={6} mt="md">
            <Text size="sm" fw={500}>
              Подпись
            </Text>
            <Group gap="sm" align="center">
              {user.signatureDataUrl ? (
                <>
                  <Image
                    src={user.signatureDataUrl}
                    h={50}
                    w="auto"
                    fit="contain"
                    alt=""
                    style={{ border: '1px solid var(--mantine-color-default-border)', borderRadius: 8, padding: 4 }}
                  />
                  <Button variant="light" color="gray" size="xs" onClick={() => signatureInputRef.current?.click()} loading={isUploadingSignature}>
                    Заменить
                  </Button>
                  <ActionIcon variant="subtle" color="red" onClick={handleRemoveSignature} aria-label="Удалить подпись">
                    <IconX size={16} />
                  </ActionIcon>
                </>
              ) : (
                <Button
                  variant="light"
                  size="xs"
                  leftSection={<IconUpload size={14} />}
                  onClick={() => signatureInputRef.current?.click()}
                  loading={isUploadingSignature}
                >
                  Загрузить изображение подписи
                </Button>
              )}
              <input ref={signatureInputRef} type="file" accept="image/*" hidden onChange={handleSignatureChange} />
            </Group>
            <Text size="xs" c="dimmed">
              Будет напечатана на документах вместо пустой строки для подписи.
            </Text>
          </Stack>
        </Card>

        <Card withBorder padding="lg">
          <Title order={4} mb={4}>
            Порядок меню
          </Title>
          <Text size="sm" c="dimmed" mb="lg">
            Разделы в боковом меню можно перетаскивать за ручку слева — порядок сохраняется в этом браузере.
          </Text>
          <Group justify="space-between" align="center">
            <Text size="sm" c="dimmed">
              {hasCustomOrder ? 'Порядок изменён вручную' : 'Используется порядок по умолчанию'}
            </Text>
            <Button variant="light" color="gray" leftSection={<IconArrowsSort size={16} />} onClick={handleResetOrder} disabled={!hasCustomOrder}>
              Сбросить порядок
            </Button>
          </Group>
        </Card>

        <Card withBorder padding="lg">
          <Title order={4} mb={4}>
            Аккаунт
          </Title>
          <Group justify="space-between" align="center">
            <Text size="sm" c="dimmed">
              {user.username}
            </Text>
            <Group gap={8}>
              <Button variant="light" color="gray" leftSection={<IconKey size={16} />} onClick={() => setPasswordModalOpen(true)}>
                Сменить пароль
              </Button>
              <Button variant="light" color="red" leftSection={<IconLogout size={16} />} onClick={logout}>
                Выйти
              </Button>
            </Group>
          </Group>
        </Card>

        <Card withBorder padding="lg">
          <Group gap={8} mb={4}>
            <ThemeIcon variant="light" color="brand" size={30} radius="md">
              <IconUserPlus size={16} />
            </ThemeIcon>
            <Title order={4}>Команда</Title>
          </Group>
          <Text size="sm" c="dimmed" mb="lg">
            Врачи в этом списке видят и редактируют общие данные — пациентов, заметки, планер и всё остальное.
          </Text>

          <Stack gap="xs" mb="lg">
            {members.map((member) => (
              <Group key={member.id} justify="space-between" wrap="nowrap">
                <Group gap={10} wrap="nowrap">
                  <Avatar src={member.avatarDataUrl ?? undefined} size={32} radius={999} color="brand" variant="filled">
                    {getInitials(member.name)}
                  </Avatar>
                  <Box>
                    <Text size="sm" fw={600}>
                      {member.name}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {member.username} · {member.role}
                    </Text>
                  </Box>
                </Group>
              </Group>
            ))}
          </Stack>

          <Group align="flex-end" gap="sm">
            <TextInput
              label="Добавить врача по нику"
              placeholder="username"
              value={inviteUsername}
              onChange={(e) => setInviteUsername(e.currentTarget.value)}
              error={inviteError}
              disabled={isInviting}
              style={{ flex: 1 }}
            />
            <Button onClick={handleInvite} loading={isInviting} disabled={!inviteUsername.trim()}>
              Добавить
            </Button>
          </Group>
          <Text size="xs" c="dimmed" mt={6}>
            Врач добавляется мгновенно, без подтверждения с его стороны.
          </Text>
        </Card>

        <Modal opened={passwordModalOpen} onClose={closePasswordModal} title="Сменить пароль" radius="lg" centered>
          <Stack gap="md">
            {passwordError && (
              <Text size="sm" c="red">
                {passwordError}
              </Text>
            )}
            <PasswordInput
              label="Текущий пароль"
              value={currentPassword}
              onChange={(e) => {
                const value = e.currentTarget.value;
                setCurrentPassword(value);
              }}
              disabled={isChangingPassword}
              required
            />
            <PasswordInput
              label="Новый пароль"
              value={newPassword}
              onChange={(e) => {
                const value = e.currentTarget.value;
                setNewPassword(value);
              }}
              disabled={isChangingPassword}
              required
            />
            <PasswordInput
              label="Повторите новый пароль"
              value={confirmNewPassword}
              onChange={(e) => {
                const value = e.currentTarget.value;
                setConfirmNewPassword(value);
              }}
              disabled={isChangingPassword}
              required
            />
            <Group justify="flex-end">
              <Button variant="default" onClick={closePasswordModal} disabled={isChangingPassword}>
                Отмена
              </Button>
              <Button
                onClick={handleChangePassword}
                loading={isChangingPassword}
                disabled={!currentPassword || !newPassword || !confirmNewPassword}
              >
                Сохранить
              </Button>
            </Group>
          </Stack>
        </Modal>

        <Card withBorder padding="lg">
          <Group justify="space-between" mb="md">
            <Group gap={8}>
              <ThemeIcon variant="light" color="brand" size={30} radius="md">
                <IconNotes size={16} />
              </ThemeIcon>
              <Title order={5}>Заметки</Title>
            </Group>
            <Button component={Link} to="/notes" variant="subtle" size="xs" rightSection={<IconArrowRight size={14} />}>
              Все заметки
            </Button>
          </Group>

          {sortedNotes.length === 0 ? (
            <Text size="sm" c="dimmed">
              Заметок пока нет
            </Text>
          ) : (
            <Stack gap="md">
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                {pageNotes.map((note) => (
                  <Card
                    key={note.id}
                    withBorder
                    padding="sm"
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/notes/${note.id}`, { state: { from: '/doctor' } })}
                  >
                    <Group gap={8} wrap="nowrap" mb={6}>
                      <ThemeIcon variant="light" color={note.color} size={24} radius="sm">
                        {note.kind === 'todo' ? <IconChecklist size={13} /> : <IconNote size={13} />}
                      </ThemeIcon>
                      <Text size="sm" fw={600} truncate style={{ flex: 1 }}>
                        {note.title || 'Без названия'}
                      </Text>
                    </Group>
                    <Text size="xs" c="dimmed" lineClamp={2} mb={6}>
                      {getNoteExcerpt(note)}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {dayjs(note.createdAt).format('D MMMM YYYY')}
                    </Text>
                  </Card>
                ))}
              </SimpleGrid>

              {totalPages > 1 && (
                <Group justify="center">
                  <Pagination total={totalPages} value={activePage} onChange={setPage} size="sm" />
                </Group>
              )}
            </Stack>
          )}
        </Card>

        <Card withBorder padding="lg">
          <Group gap={8} mb="xs">
            <ThemeIcon variant="light" color="gray" size={30} radius="md">
              <IconUsers size={16} />
            </ThemeIcon>
            <Title order={5}>Пациенты</Title>
            <Badge variant="light" color="gray" size="sm">
              скоро
            </Badge>
          </Group>
          <Text size="sm" c="dimmed">
            Модуль «Пациенты» ещё в разработке — здесь появится короткий список последних пациентов.
          </Text>
        </Card>
      </Stack>
    </Container>
  );
}
