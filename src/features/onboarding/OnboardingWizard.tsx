import { useState } from 'react';
import { Button, Group, Modal, Progress, Select, Stack, Text, TextInput, Title } from '@mantine/core';
import { IconArrowRight, IconFileUpload, IconUserPlus } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';

import { useIsMobile } from '../../components/common/useIsMobile';
import { updateProfile } from '../auth/authApi';
import { useAuth, useUpdateAuthUser } from '../auth/AuthContext';
import { getClinicSettings, setClinicSettings } from '../patients/clinicSettings';
import { useSpecialties } from '../specialties/useSpecialtyFilter';
import { finishOnboarding } from './onboardingState';

/**
 * Первые пять минут нового врача.
 *
 * После регистрации не происходило ничего: спросили логин, имя и пароль — и высадили на пустой
 * дашборд с плашкой «Дашборд пуст». При этом без специальности не работает отбор в магазине и
 * справочниках, а без реквизитов печатный бланк выходит с пустой шапкой, — то есть врач узнавал об
 * этих настройках, наткнувшись на их отсутствие.
 *
 * Три шага, и у каждого — «Пропустить»: это знакомство, а не анкета на входе. Отметка о пройденном
 * ставится в любом случае, в том числе когда все три пропустили: спрашивать второй раз то, от чего
 * отказались, — навязчивость, а настройки лежат в профиле и никуда не денутся.
 *
 * Данные сохраняются **на каждом шаге**, а не в конце: закрытое на середине окно не должно уносить
 * с собой уже выбранное.
 */
export function OnboardingWizard({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const user = useAuth();
  const updateAuthUser = useUpdateAuthUser();
  const specialties = useSpecialties();

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [specialty, setSpecialty] = useState<string | null>(user.specialty ?? null);
  const [role, setRole] = useState(user.role ?? '');
  const [clinic, setClinic] = useState(getClinicSettings());

  const close = () => {
    finishOnboarding();
    onClose();
  };

  const saveStep = async () => {
    setSaving(true);
    try {
      if (step === 0 && (specialty !== (user.specialty ?? null) || role !== (user.role ?? ''))) {
        updateAuthUser(await updateProfile({ specialty, role: role.trim() }));
      }
      if (step === 1) await setClinicSettings(clinic);
      setStep((current) => current + 1);
    } catch {
      // Ошибку показывает общий обработчик; шаг остаётся открытым, чтобы попытку можно было повторить.
    } finally {
      setSaving(false);
    }
  };

  const steps = [
    {
      title: 'Ваша специальность',
      body: (
        <Stack gap="sm">
          <Text size="sm" c="dimmed">
            По ней магазин и справочники отбирают то, что относится к вашей работе: кардиологу не
            нужны сорок ЛОР-панелей, педиатру — шкала ХОБЛ. Отбор всегда можно снять одним нажатием.
          </Text>
          <Select
            label="Специальность"
            placeholder="Выберите из списка"
            data={specialties.map((item) => ({ value: item.id, label: item.name }))}
            value={specialty}
            onChange={setSpecialty}
            searchable
            allowDeselect={false}
          />
          <TextInput
            label="Должность"
            description="Она печатается под вашей подписью в документах"
            placeholder="Врач-терапевт"
            value={role}
            onChange={(event) => setRole(event.currentTarget.value)}
          />
        </Stack>
      ),
    },
    {
      title: 'Реквизиты для документов',
      body: (
        <Stack gap="sm">
          <Text size="sm" c="dimmed">
            Это шапка печатного бланка: справки, направления и согласия печатаются с ней. Без
            реквизитов бумага выйдет без названия клиники.
          </Text>
          <TextInput
            label="Название клиники"
            placeholder="ГБУЗ «Городская поликлиника № 1»"
            value={clinic.clinicName}
            onChange={(event) => setClinic({ ...clinic, clinicName: event.currentTarget.value })}
          />
          <TextInput
            label="Адрес"
            placeholder="Екатеринбург, ул. Ленина, 1"
            value={clinic.clinicAddress}
            onChange={(event) => setClinic({ ...clinic, clinicAddress: event.currentTarget.value })}
          />
          <TextInput
            label="Номер лицензии"
            value={clinic.licenseNumber}
            onChange={(event) => setClinic({ ...clinic, licenseNumber: event.currentTarget.value })}
          />
        </Stack>
      ),
    },
    {
      title: 'Первые пациенты',
      body: (
        <Stack gap="sm">
          <Text size="sm" c="dimmed">
            Картотеку можно завести с нуля или перенести из таблицы: приложение читает .xlsx и CSV и
            само разбирается, где какая колонка. Выгрузить её обратно можно там же.
          </Text>
          <Group gap="sm">
            <Button
              leftSection={<IconFileUpload size={16} />}
              onClick={() => {
                close();
                navigate('/patients?import=1');
              }}
            >
              Загрузить базу
            </Button>
            <Button
              variant="light"
              leftSection={<IconUserPlus size={16} />}
              onClick={() => {
                close();
                navigate('/patients/new');
              }}
            >
              Добавить первого пациента
            </Button>
          </Group>
        </Stack>
      ),
    },
  ];

  const current = steps[step];
  const isLast = step === steps.length - 1;

  return (
    <Modal opened onClose={close} title="Настроим за минуту" size="lg" radius="lg" centered fullScreen={isMobile}>
      <Stack gap="lg">
        <Progress value={((step + 1) / steps.length) * 100} size="sm" />
        <div>
          <Title order={4} mb={4}>
            {current.title}
          </Title>
          <Text size="xs" c="dimmed">
            Шаг {step + 1} из {steps.length}
          </Text>
        </div>

        {current.body}

        <Group justify="space-between">
          <Button variant="subtle" color="gray" onClick={isLast ? close : () => setStep((s) => s + 1)}>
            {isLast ? 'Закрыть' : 'Пропустить'}
          </Button>
          {!isLast && (
            <Button rightSection={<IconArrowRight size={16} />} onClick={saveStep} loading={saving}>
              Дальше
            </Button>
          )}
        </Group>
      </Stack>
    </Modal>
  );
}
