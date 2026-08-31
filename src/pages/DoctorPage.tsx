import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import {
  ActionIcon,
  Avatar,
  Box,
  Button,
  Card,
  Container,
  Group,
  Image,
  Select,
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
  IconArrowsSort,
  IconCamera,
  IconCheck,
  IconDeviceDesktop,
  IconKey,
  IconLogout,
  IconMoonStars,
  IconPrinter,
  IconSun,
  IconUpload,
  IconUserPlus,
  IconX,
} from '@tabler/icons-react';

import { WallpaperPicker } from '../features/appearance/WallpaperPicker';
import { useSidebarOrder } from '../components/layout/useSidebarOrder';
import { updateProfile } from '../features/auth/authApi';
import { useSpecialties } from '../features/specialties/useSpecialtyFilter';
import { useAuth, useLogout, useUpdateAuthUser } from '../features/auth/AuthContext';
import { getClinicSettings, setClinicSettings, type ClinicSettings } from '../features/patients/clinicSettings';
import { getMembers, invite, type WorkspaceMember } from '../features/workspace/workspaceApi';
import { isDemoSession } from '../features/demo/demoSession';
import { ChangePasswordModal } from '../features/doctor/ChangePasswordModal';
import { DoctorNotesCard } from '../features/doctor/DoctorNotesCard';
import { resizeImageToDataUrl } from '../lib/imageResize';
import { InstallApp } from '../features/pwa/InstallApp';
import { PushSettings } from '../features/reminders/PushSettings';

const AVATAR_MAX_DIMENSION = 256;
const SIGNATURE_MAX_DIMENSION = 480;

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

export function DoctorPage() {
  // Гостевая сессия: часть настроек живёт на сервере, которого у демо нет.
  const demo = isDemoSession();
  const user = useAuth();
  const updateAuthUser = useUpdateAuthUser();
  const logout = useLogout();
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  const { hasCustomOrder, resetOrder } = useSidebarOrder();
  const [clinicSettings, setClinicSettingsState] = useState<ClinicSettings>(() => getClinicSettings());

  const [name, setName] = useState(user.name);
  const [role, setRole] = useState(user.role);
  const specialties = useSpecialties();
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const signatureInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isUploadingSignature, setIsUploadingSignature] = useState(false);

  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [inviteUsername, setInviteUsername] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const [passwordModalOpen, setPasswordModalOpen] = useState(false);

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

  const handleNameRoleBlur = () => {
    void updateProfile({ name, role }).then(updateAuthUser).catch((error: unknown) => showProfileError(error, 'Не удалось сохранить профиль'));
  };

  /**
   * Специальность сохраняется сразу при выборе, а не по уходу с поля.
   *
   * Это `Select`, а не текст: события `blur` у него нет в том смысле, в каком оно есть у поля
   * ввода, а выбор пункта — законченное действие. Снятие выбора уезжает как `null`.
   */
  const handleSpecialtyChange = (value: string | null) => {
    void updateProfile({ specialty: value })
      .then(updateAuthUser)
      .catch((error: unknown) => showProfileError(error, 'Не удалось сохранить специальность'));
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
              {/* Специальность — не то же, что должность. Должность врач пишет себе сам, и она
                  печатается в документах; специальность выбирается из списка, потому что по ней
                  отбираются справочники, а свободный текст отобрать нечем. */}
              <Select
                label="Специальность"
                placeholder="не выбрана"
                description="По ней справочники могут показывать только то, что относится к вашей работе"
                data={specialties.map((item) => ({ value: item.id, label: item.name }))}
                value={user.specialty}
                onChange={handleSpecialtyChange}
                disabled={specialties.length === 0}
                searchable
                clearable
                /* Повторное нажатие на свою же специальность её не снимает. У Mantine это
                   поведение по умолчанию, и здесь оно ловушка: врач, открывший список посмотреть,
                   что там есть, и нажавший на выбранное, молча остался бы без специальности —
                   а увидел бы это только по исчезнувшему тумблеру на другой странице. Снять
                   выбор можно крестиком, то есть намеренно. Поймано прогоном в браузере. */
                allowDeselect={false}
              />
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

        <InstallApp />

        <PushSettings />

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
              {/* Пароля у гостя нет — менять нечего. */}
              {!demo && (
                <Button variant="light" color="gray" leftSection={<IconKey size={16} />} onClick={() => setPasswordModalOpen(true)}>
                  Сменить пароль
                </Button>
              )}
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

          {demo ? (
            <Text size="sm" c="dimmed">
              В демо-режиме рабочее пространство одно и состоит из вас: приглашать некого, аккаунтов
              здесь нет.
            </Text>
          ) : (
            <>
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
            </>
          )}
        </Card>

        <ChangePasswordModal opened={passwordModalOpen} onClose={() => setPasswordModalOpen(false)} />

        <DoctorNotesCard />
      </Stack>
    </Container>
  );
}
