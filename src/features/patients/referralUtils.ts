import type { ReferralCategory } from './types';

export const REFERRAL_CATEGORY_LABELS: Record<ReferralCategory, string> = {
  hospitalization: 'Госпитализация',
  consultation: 'Консультация специалиста',
  additionalTests: 'Дополнительное обследование',
  sanatorium: 'Санаторно-курортное лечение',
  other: 'Другое',
};

export const REFERRAL_CATEGORY_COLORS: Record<ReferralCategory, string> = {
  hospitalization: 'red',
  consultation: 'grape',
  additionalTests: 'blue',
  sanatorium: 'mint',
  other: 'gray',
};

export const REFERRAL_CATEGORY_OPTIONS = (Object.keys(REFERRAL_CATEGORY_LABELS) as ReferralCategory[]).map((value) => ({
  value,
  label: REFERRAL_CATEGORY_LABELS[value],
}));
