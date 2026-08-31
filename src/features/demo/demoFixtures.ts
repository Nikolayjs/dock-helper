import dayjs from 'dayjs';

import { DEMO_DOCTOR } from './demoDoctor';

/**
 * Данные демо-режима. Все до единого вымышлены: имена, диагнозы, телефоны, адреса.
 *
 * Даты считаются от сегодняшнего дня, а не записаны строками: демо, где диспансерный контроль
 * просрочен на два года, а календарь пуст, показывает не продукт, а заброшенную базу.
 */
const today = dayjs();
const d = (offset: number) => today.add(offset, 'day').format('YYYY-MM-DD');
const t = (offset: number) => today.add(offset, 'day').toISOString();
const dt = (offset: number, time: string) => `${d(offset)}T${time}`;

const visit = (id: string, offset: number, diagnosis: string, code: string, note: string) => ({
  id,
  date: d(offset),
  diagnosis,
  diagnosisCode: code,
  note,
  referralCategory: null,
  referralDestination: '',
  createdAt: t(offset),
});

const patients = [
  {
    id: 'p1',
    fullName: 'Егорова Наталья Петровна',
    sex: 'female',
    birthDate: '1958-03-14',
    phone: '+7 900 000-11-01',
    reminderDate: d(2),
    reminderNote: 'Контроль АД и МНО',
    heightCm: 162,
    weightKg: 78.5,
    measuredAt: d(-12),
    allergies: 'Пенициллины — отёк Квинке',
    insurancePolicy: '7712 3456 7890 1234',
    district: '7',
    address: 'ул. Полевая, 14, кв. 23',
    visits: [
      visit('v1', -12, 'Гипертоническая болезнь II ст.', 'I11.9', 'АД 150/95. Скорректирована доза периндоприла.'),
      visit('v2', -75, 'Фибрилляция предсердий, постоянная форма', 'I48.2', 'МНО 2,4 — в целевом диапазоне.'),
    ],
    createdAt: t(-400),
    updatedAt: t(-12),
  },
  {
    id: 'p2',
    fullName: 'Крылов Дмитрий Сергеевич',
    sex: 'male',
    birthDate: '1971-11-02',
    phone: '+7 900 000-11-02',
    reminderDate: null,
    reminderNote: '',
    heightCm: 178,
    weightKg: 96,
    measuredAt: d(-5),
    allergies: '',
    insurancePolicy: '7712 3456 7890 5678',
    district: '7',
    address: 'пр. Мира, 3, кв. 108',
    visits: [visit('v3', -5, 'Сахарный диабет 2 типа', 'E11.9', 'HbA1c 7,8 %. Добавлен метформин 1000 мг вечером.')],
    createdAt: t(-300),
    updatedAt: t(-5),
  },
  {
    id: 'p3',
    fullName: 'Астафьева Вера Ильинична',
    sex: 'female',
    birthDate: '1949-07-23',
    phone: '+7 900 000-11-03',
    reminderDate: d(-3),
    reminderNote: 'Не пришла на контроль, позвонить',
    heightCm: 158,
    weightKg: 61,
    measuredAt: d(-30),
    allergies: 'Йодсодержащие контрасты — крапивница',
    insurancePolicy: '',
    district: '4',
    address: '',
    visits: [visit('v4', -40, 'ХСН, ФК II', 'I50.0', 'Отёков нет, дозу торасемида оставили прежней.')],
    createdAt: t(-520),
    updatedAt: t(-40),
  },
  {
    id: 'p4',
    fullName: 'Мельников Артём Игоревич',
    sex: 'male',
    birthDate: '1988-01-30',
    phone: '+7 900 000-11-04',
    reminderDate: null,
    reminderNote: '',
    heightCm: null,
    weightKg: null,
    measuredAt: null,
    allergies: '',
    insurancePolicy: '',
    district: '',
    address: '',
    visits: [visit('v5', -2, 'Острый бронхит', 'J20.9', 'Кашель четвёртые сутки, температура 37,4. Симптоматическая терапия.')],
    createdAt: t(-90),
    updatedAt: t(-2),
  },
  {
    id: 'p5',
    fullName: 'Зотова Людмила Аркадьевна',
    sex: 'female',
    birthDate: '1963-05-09',
    phone: '+7 900 000-11-05',
    reminderDate: d(9),
    reminderNote: 'Повторить липидограмму',
    heightCm: null,
    weightKg: null,
    measuredAt: null,
    allergies: '',
    insurancePolicy: '',
    district: '',
    address: '',
    visits: [visit('v6', -21, 'Дислипидемия', 'E78.5', 'ЛПНП 4,1 ммоль/л. Начат аторвастатин 20 мг.')],
    createdAt: t(-250),
    updatedAt: t(-21),
  },
  {
    id: 'p6',
    fullName: 'Пахомов Кирилл Владимирович',
    sex: 'male',
    birthDate: '1995-09-17',
    phone: '+7 900 000-11-06',
    reminderDate: null,
    reminderNote: '',
    heightCm: null,
    weightKg: null,
    measuredAt: null,
    allergies: '',
    insurancePolicy: '',
    district: '',
    address: '',
    visits: [visit('v7', -60, 'Аллергический ринит', 'J30.1', 'Сезонный, назначен интраназальный ГКС.')],
    createdAt: t(-120),
    updatedAt: t(-60),
  },
  {
    id: 'p7',
    fullName: 'Данилова Ольга Витальевна',
    sex: 'female',
    birthDate: '1980-12-05',
    phone: '+7 900 000-11-07',
    reminderDate: null,
    reminderNote: '',
    heightCm: null,
    weightKg: null,
    measuredAt: null,
    allergies: '',
    insurancePolicy: '',
    district: '',
    address: '',
    visits: [visit('v8', -8, 'Железодефицитная анемия', 'D50.9', 'Ферритин 9 нг/мл. Препараты железа внутрь.')],
    createdAt: t(-180),
    updatedAt: t(-8),
  },
  {
    id: 'p8',
    fullName: 'Терентьев Борис Львович',
    sex: 'male',
    birthDate: '1954-02-11',
    phone: '+7 900 000-11-08',
    reminderDate: d(-10),
    reminderNote: 'Просрочен диспансерный осмотр',
    heightCm: null,
    weightKg: null,
    measuredAt: null,
    allergies: '',
    insurancePolicy: '',
    district: '',
    address: '',
    visits: [visit('v9', -150, 'ИБС, стенокардия напряжения ФК II', 'I20.8', 'Приступы 1–2 раза в неделю при нагрузке.')],
    createdAt: t(-600),
    updatedAt: t(-150),
  },
  {
    id: 'p9',
    fullName: 'Савельева Марина Юрьевна',
    sex: 'female',
    birthDate: '1992-06-28',
    phone: '+7 900 000-11-09',
    reminderDate: null,
    reminderNote: '',
    heightCm: null,
    weightKg: null,
    measuredAt: null,
    allergies: '',
    insurancePolicy: '',
    district: '',
    address: '',
    visits: [visit('v10', -1, 'Гипотиреоз', 'E03.9', 'ТТГ 6,8 мМЕ/л. Доза левотироксина увеличена.')],
    createdAt: t(-45),
    updatedAt: t(-1),
  },
  {
    id: 'p10',
    fullName: 'Игнатов Пётр Афанасьевич',
    sex: 'male',
    birthDate: '1946-10-19',
    phone: '+7 900 000-11-10',
    reminderDate: d(5),
    reminderNote: 'Спирометрия',
    heightCm: null,
    weightKg: null,
    measuredAt: null,
    allergies: '',
    insurancePolicy: '',
    district: '',
    address: '',
    visits: [visit('v11', -30, 'ХОБЛ, среднетяжёлое течение', 'J44.8', 'Одышка при подъёме на второй этаж.')],
    createdAt: t(-700),
    updatedAt: t(-30),
  },
];

const observation = (id: string, offset: number, outcome: string, note: string) => ({
  id,
  date: d(offset),
  outcome,
  ovl: false,
  sanatorium: false,
  campRest: false,
  note,
  createdAt: t(offset),
});

const dispensary = [
  {
    id: 'dr1',
    patientId: 'p1',
    diagnosis: 'Гипертоническая болезнь II ст.',
    diagnosisCode: 'I11.9',
    registeredDate: d(-400),
    nextVisitDate: d(-6),
    status: 'active',
    removedDate: null,
    removedReason: null,
    observations: [observation('o1', -12, 'improved', 'АД стабилизировалось на фоне коррекции терапии.')],
    createdAt: t(-400),
    updatedAt: t(-12),
  },
  {
    id: 'dr2',
    patientId: 'p8',
    diagnosis: 'ИБС, стенокардия напряжения ФК II',
    diagnosisCode: 'I20.8',
    registeredDate: d(-600),
    nextVisitDate: d(-20),
    status: 'active',
    removedDate: null,
    removedReason: null,
    observations: [observation('o2', -150, 'unchanged', 'Частота приступов прежняя.')],
    createdAt: t(-600),
    updatedAt: t(-150),
  },
  {
    id: 'dr3',
    patientId: 'p2',
    diagnosis: 'Сахарный диабет 2 типа',
    diagnosisCode: 'E11.9',
    registeredDate: d(-300),
    nextVisitDate: d(14),
    status: 'active',
    removedDate: null,
    removedReason: null,
    observations: [observation('o3', -5, 'improved', 'HbA1c снизился с 8,6 до 7,8 %.')],
    createdAt: t(-300),
    updatedAt: t(-5),
  },
  {
    id: 'dr4',
    patientId: 'p6',
    diagnosis: 'Аллергический ринит',
    diagnosisCode: 'J30.1',
    registeredDate: d(-400),
    nextVisitDate: null,
    status: 'removed',
    removedDate: d(-60),
    removedReason: 'recovered',
    observations: [observation('o4', -60, 'recovered', 'Сезонные обострения прекратились.')],
    createdAt: t(-400),
    updatedAt: t(-60),
  },
];

const notes = [
  {
    id: 'n1',
    kind: 'note',
    title: 'Разбор случая: анемия неясного генеза',
    content:
      '<p>Пациентка 44 лет, ферритин 9 нг/мл при нормальном гемоглобине. Скрытая кровопотеря исключена.</p><p>Назначено: препараты железа внутрь, контроль через 6 недель.</p>',
    items: [],
    pinnedDate: null,
    color: 'brand',
    createdAt: t(-8),
    updatedAt: t(-8),
  },
  {
    id: 'n2',
    kind: 'todo',
    title: 'На неделю',
    content: '',
    items: [
      { id: 'i1', text: 'Обзвонить просроченный Д-контроль', done: false },
      { id: 'i2', text: 'Забрать бланки направлений', done: true },
      { id: 'i3', text: 'Подготовить отчёт по диспансеризации', done: false },
    ],
    pinnedDate: d(1),
    color: 'orange',
    createdAt: t(-3),
    updatedAt: t(-1),
  },
  {
    id: 'n3',
    kind: 'note',
    title: 'С конференции: целевые уровни ЛПНП',
    content: '<p>Очень высокий риск — ниже 1,4 ммоль/л и снижение не менее чем на 50 % от исходного.</p>',
    items: [],
    pinnedDate: null,
    color: 'teal',
    createdAt: t(-30),
    updatedAt: t(-30),
  },
];

const reminders = [
  {
    id: 'r1',
    title: 'Позвонить Астафьевой В. И.',
    message: 'Не пришла на диспансерный контроль',
    datetime: dt(0, '15:00'),
    notifiedAt: null,
    createdAt: t(-1),
    updatedAt: t(-1),
  },
  {
    id: 'r2',
    title: 'Отчёт по диспансеризации',
    message: 'Сдать в статотдел',
    datetime: dt(3, '10:00'),
    notifiedAt: null,
    createdAt: t(-2),
    updatedAt: t(-2),
  },
  {
    id: 'r3',
    title: 'Спирометрия — Игнатов П. А.',
    message: '',
    datetime: dt(5, '09:30'),
    notifiedAt: null,
    createdAt: t(-2),
    updatedAt: t(-2),
  },
];

const plannerBoards = [
  { id: 'b1', title: 'Текущие дела', description: 'Демонстрационная доска', position: 0, createdAt: t(-20), updatedAt: t(-2) },
];

const plannerColumns = [
  { id: 'c1', boardId: 'b1', title: 'Бэклог', position: 0, createdAt: t(-20), updatedAt: t(-20) },
  { id: 'c2', boardId: 'b1', title: 'В работе', position: 1, createdAt: t(-20), updatedAt: t(-20) },
  { id: 'c3', boardId: 'b1', title: 'Готово', position: 2, createdAt: t(-20), updatedAt: t(-20) },
];

const plannerCards = [
  {
    id: 'k1',
    columnId: 'c1',
    authorId: DEMO_DOCTOR.id,
    assigneeId: null,
    title: 'Обновить шаблон направления на МСЭ',
    description: '',
    color: 'blue',
    dueDate: d(7),
    position: 0,
    createdAt: t(-10),
    updatedAt: t(-10),
  },
  {
    id: 'k2',
    columnId: 'c2',
    authorId: DEMO_DOCTOR.id,
    assigneeId: DEMO_DOCTOR.id,
    title: 'Свести реестр диспансерных за квартал',
    description: 'Выгрузить в Excel',
    color: 'orange',
    dueDate: d(2),
    position: 0,
    createdAt: t(-6),
    updatedAt: t(-1),
  },
  {
    id: 'k3',
    columnId: 'c3',
    authorId: DEMO_DOCTOR.id,
    assigneeId: DEMO_DOCTOR.id,
    title: 'Заказать бланки',
    description: '',
    color: 'green',
    dueDate: null,
    position: 0,
    createdAt: t(-14),
    updatedAt: t(-9),
  },
];

const documentTemplates = [
  {
    id: 'dt1',
    title: 'Справка о посещении врача',
    kind: 'flow',
    // Подстановки — те самые, что понимает `templateTypes.ts`. Придуманные по-русски выглядели бы
    // разумно и печатались бы дословно: проверено — бланк выходил с «{{ФИО}}» вместо фамилии.
    bodyHtml:
      '<p>Дана {{patientName}}, {{patientBirthDate}} г. р., в том, что {{visitDate}} он(а) обращался(ась) на приём к врачу.</p><p>Диагноз: {{diagnosis}}.</p><p>Справка выдана по месту требования. Дата выдачи: {{issueDate}}.</p>',
    layout: null,
    createdAt: t(-60),
    updatedAt: t(-60),
  },
  {
    id: 'dt2',
    title: 'Направление на консультацию',
    kind: 'flow',
    bodyHtml:
      '<p>Направляется {{patientName}}, {{patientBirthDate}} г. р.</p><p>Диагноз: {{diagnosis}}.</p><p>Цель консультации: уточнение тактики ведения.</p><p>Врач: {{doctorName}}, {{specialty}}.</p>',
    layout: null,
    createdAt: t(-45),
    updatedAt: t(-45),
  },
];

const doctorDocuments = [
  {
    id: 'dd1',
    kind: 'text',
    title: 'Направление на медико-социальную экспертизу',
    summary: 'Черновик для пациентки с ХСН',
    patientId: 'p3',
    content:
      '<h3>Направление на МСЭ</h3><p>Пациентка состоит на диспансерном учёте, терапия подобрана, эффект неполный.</p>',
    sheet: null,
    tags: ['МСЭ', 'черновик'],
    createdAt: t(-15),
    updatedAt: t(-15),
  },
  {
    id: 'dd2',
    kind: 'sheet',
    title: 'Реестр диспансерных за квартал',
    summary: 'Демонстрационная таблица',
    patientId: null,
    content: '',
    sheet: {
      columns: ['ФИО', 'Диагноз', 'Дата взятия', 'Следующий контроль'],
      rows: [
        ['Егорова Н. П.', 'I11.9', d(-400), d(-6)],
        ['Терентьев Б. Л.', 'I20.8', d(-600), d(-20)],
        ['Крылов Д. С.', 'E11.9', d(-300), d(14)],
      ],
      totals: null,
      formats: null,
      widths: null,
    },
    tags: ['реестр'],
    createdAt: t(-4),
    updatedAt: t(-4),
  },
];

/**
 * Справочник сокращений в демо — короткая выборка, а не все 386.
 *
 * Демо показывает, как раздел устроен, а не сколько в нём строк. Но контракт повторяется точно, и
 * «ОА» стоит здесь двумя записями намеренно: многозначность — главное решение этого раздела, и
 * фикстура, в которой её не видно, показывала бы не тот продукт.
 */
const abbr = (id: string, short: string, full: string, category: string, origin = '', meaning = '') => ({
  id,
  short,
  full,
  meaning,
  origin,
  category,
  seedKey: id,
  createdAt: t(-30),
  updatedAt: t(-30),
});

const abbreviations = [
  abbr('ab1', 'АД', 'артериальное давление', 'Общеклинические', 'BP'),
  abbr('ab2', 'ЧСС', 'частота сердечных сокращений', 'Общеклинические', 'HR'),
  abbr('ab3', 'ОАК', 'общий анализ крови', 'Общеклинические', 'CBC'),
  abbr('ab4', 'ОА', 'остеоартроз', 'Общеклинические', '', 'В ревматологическом тексте — почти всегда он.'),
  abbr('ab5', 'ОА', 'общий анализ', 'Общеклинические', '', 'В направлении на исследование: «ОА крови», «ОА мочи».'),
  abbr('ab6', 'ИБС', 'ишемическая болезнь сердца', 'Кардиология', 'CAD'),
  abbr('ab7', 'ХСН', 'хроническая сердечная недостаточность', 'Кардиология', 'CHF'),
  abbr('ab8', 'ФП', 'фибрилляция предсердий', 'Кардиология', 'AF', 'Прежнее название — мерцательная аритмия.'),
  abbr('ab9', 'ФВ ЛЖ', 'фракция выброса левого желудочка', 'Кардиология', 'LVEF'),
  abbr('ab10', 'ХОБЛ', 'хроническая обструктивная болезнь лёгких', 'Пульмонология', 'COPD'),
  abbr('ab11', 'БА', 'бронхиальная астма', 'Пульмонология'),
  abbr('ab12', 'ОФВ₁', 'объём форсированного выдоха за первую секунду', 'Пульмонология', 'FEV1'),
  abbr('ab13', 'ОНМК', 'острое нарушение мозгового кровообращения', 'Неврология и психиатрия'),
  abbr('ab14', 'ТИА', 'транзиторная ишемическая атака', 'Неврология и психиатрия', 'TIA'),
  abbr('ab15', 'СД 2', 'сахарный диабет 2 типа', 'Эндокринология', 'T2DM'),
  abbr('ab16', 'HbA1c', 'гликированный гемоглобин', 'Лабораторная диагностика', '', 'Средний уровень глюкозы за 2–3 месяца.'),
  abbr('ab17', 'СКФ', 'скорость клубочковой фильтрации', 'Лабораторная диагностика', 'GFR'),
  abbr('ab18', 'СРБ', 'С-реактивный белок', 'Лабораторная диагностика', 'CRP'),
  abbr('ab19', 'МНО', 'международное нормализованное отношение', 'Лабораторная диагностика', 'INR'),
  abbr('ab20', 'ЭхоКГ', 'эхокардиография', 'Инструментальная диагностика', 'Echo'),
  abbr('ab21', 'МСКТ', 'мультиспиральная компьютерная томография', 'Инструментальная диагностика'),
  abbr('ab22', 'иАПФ', 'ингибиторы ангиотензинпревращающего фермента', 'Фармакология и назначения', 'ACEi'),
  abbr('ab23', 'НПВП', 'нестероидные противовоспалительные препараты', 'Фармакология и назначения', 'NSAID'),
  abbr('ab24', 'ВК', 'врачебная комиссия', 'Документы и организация', '', 'Продление больничного свыше 15 дней, назначение вне инструкции, направление на МСЭ.'),
  abbr('ab25', 'МСЭ', 'медико-социальная экспертиза', 'Документы и организация'),
];

/** Справочник заболеваний в демо — короткая выборка с теми же связями, что в настоящем. */
const dis = (
  id: string,
  name: string,
  category: string,
  icdCodes: string[],
  summary: string,
  synonyms: string[] = [],
  description = '',
) => ({
  id,
  name,
  synonyms,
  icdCodes,
  summary,
  description,
  category,
  guidelineKey: '',
  guidelineId: '',
  seedKey: id,
  // Признак из списка: сам текст в него не едет, а видеть, что уже описано, врачу нужно.
  hasDescription: description !== '',
  createdAt: t(-40),
  updatedAt: t(-40),
});

const diseases = [
  dis('ds1', 'Артериальная гипертензия', 'кардиология', ['I10', 'I11'], 'Стойкое повышение давления; целевые значения и терапия зависят от риска.', ['АГ', 'гипертония']),
  dis('ds2', 'Ишемическая болезнь сердца', 'кардиология', ['I20', 'I25'], 'Хроническая ишемия миокарда с загрудинной болью при нагрузке.', ['ИБС', 'стенокардия']),
  dis(
    'ds3',
    'Фибрилляция предсердий',
    'кардиология',
    ['I48'],
    'Нерегулярный ритм; решается вопрос об антикоагулянтной терапии.',
    ['ФП', 'мерцалка'],
    '<p>Чаще всего развивается на фоне [[Артериальная гипертензия|артериальной гипертензии]] и [[Ишемическая болезнь сердца|ИБС]]; из некардиальных причин обязательно исключается [[Гипотиреоз]] и тиреотоксикоз.</p><p>Кодируется как [[I48]]. Решение об антикоагулянтной терапии принимается по шкале риска, а не по форме аритмии.</p>',
  ),
  dis('ds4', 'Хроническая обструктивная болезнь лёгких', 'пульмонология', ['J44'], 'Необратимая бронхиальная обструкция у курильщика со стажем.', ['ХОБЛ']),
  dis('ds5', 'Бронхиальная астма', 'пульмонология', ['J45', 'J46'], 'Обратимая обструкция с приступами удушья и вариабельной ПСВ.', ['БА']),
  dis('ds6', 'Внебольничная пневмония', 'пульмонология', ['J13', 'J15', 'J18'], 'Лихорадка, кашель и инфильтрат на снимке вне стационара.', ['ВП', 'воспаление лёгких']),
  dis('ds7', 'Сахарный диабет 2 типа', 'эндокринология', ['E11'], 'Гипергликемия на фоне инсулинорезистентности; контроль по HbA1c.', ['СД 2']),
  dis(
    'ds8',
    'Гипотиреоз',
    'эндокринология',
    ['E03'],
    'Дефицит тиреоидных гормонов: слабость, отёки, брадикардия.',
    [],
    '<p>Проявления неспецифичны: слабость, отёки, брадикардия, сухость кожи. В общем анализе крови нередко [[Железодефицитная анемия|анемия]].</p><p>Код [[E03]]. При впервые выявленной [[Фибрилляция предсердий|фибрилляции предсердий]] щитовидную железу смотрят обязательно.</p>',
  ),
  dis('ds9', 'Хронический бронхит', 'пульмонология', ['J41', 'J42'], 'Кашель с мокротой три месяца в году два года подряд.', [], 'Отличать от ХОБЛ по спирометрии: без стойкой обструкции это именно бронхит.'),
  dis('ds10', 'Железодефицитная анемия', 'гематология', ['D50'], 'Микроцитарная анемия с низким ферритином; нужен поиск источника потери.', ['ЖДА']),
  dis('ds11', 'Гастроэзофагеальная рефлюксная болезнь', 'гастроэнтерология', ['K21'], 'Изжога и регургитация из-за заброса содержимого желудка.', ['ГЭРБ', 'рефлюкс']),
  dis('ds12', 'Остеоартрит', 'ревматология', ['M15', 'M17'], 'Дегенеративное поражение суставов с болью при нагрузке.', ['ОА', 'артроз']),
  dis('ds13', 'Мигрень', 'неврология', ['G43'], 'Приступы пульсирующей односторонней головной боли со свето- и звукобоязнью.', []),
  dis('ds14', 'Инфекция мочевыводящих путей', 'нефрология и урология', ['N30', 'N39.0'], 'Дизурия и учащённое мочеиспускание; у женщин чаще неосложнённый цистит.', ['ИМП', 'цистит']),
  dis('ds15', 'Атопический дерматит', 'дерматология', ['L20'], 'Хроническое зудящее воспаление кожи с сухостью и обострениями.', ['АтД']),
];

const drugCategories = [
  { id: 'dc1', name: 'Сердечно-сосудистые', position: 0, seedKey: 'cardio' },
  { id: 'dc2', name: 'Кровь и антикоагулянты', position: 1, seedKey: 'blood' },
  { id: 'dc3', name: 'Эндокринология', position: 2, seedKey: 'endocrine' },
  { id: 'dc4', name: 'Боль и воспаление', position: 3, seedKey: 'pain' },
  { id: 'dc5', name: 'Антибиотики и противомикробные', position: 4, seedKey: 'antimicrobial' },
];

const drug = (
  id: string,
  inn: string,
  brandNames: string[],
  category: string,
  pharmGroup: string,
  atcCode: string,
  forms: string[],
  indications: string,
  dosing: string,
) => ({
  id,
  inn,
  brandNames,
  category,
  pharmGroup,
  atcCode,
  forms,
  indications,
  dosing,
  contraindications: 'Демонстрационная карточка: полный перечень — в инструкции производителя.',
  sideEffects: 'Демонстрационная карточка: полный перечень — в инструкции производителя.',
  notes: '',
  createdAt: t(-200),
  updatedAt: t(-200),
});

const drugs = [
  drug('g1', 'Варфарин', ['Варфарин Никомед', 'Мареван'], 'Кровь и антикоагулянты', 'Антикоагулянт непрямого действия', 'B01AA03', ['Таблетки 2,5 мг'], 'Фибрилляция предсердий, механические клапаны, венозные тромбоэмболии.', 'Старт 2,5–5 мг/сут, далее по МНО (целевой диапазон 2,0–3,0).'),
  drug('g2', 'Ибупрофен', ['Нурофен', 'Миг'], 'Боль и воспаление', 'НПВС, производное пропионовой кислоты', 'M01AE01', ['Таблетки 200 мг', 'Таблетки 400 мг'], 'Боль, лихорадка, воспалительные заболевания суставов.', '200–400 мг 3 раза в сутки после еды.'),
  drug('g3', 'Периндоприл', ['Престариум', 'Перинева'], 'Сердечно-сосудистые', 'Ингибитор АПФ', 'C09AA04', ['Таблетки 4 мг', 'Таблетки 8 мг'], 'Артериальная гипертензия, ХСН, ИБС.', '4–8 мг однократно утром.'),
  drug('g4', 'Метформин', ['Глюкофаж', 'Сиофор'], 'Эндокринология', 'Бигуанид', 'A10BA02', ['Таблетки 500 мг', 'Таблетки 1000 мг'], 'Сахарный диабет 2 типа.', 'Старт 500 мг вечером, титрование до 2000 мг/сут.'),
  drug('g5', 'Аторвастатин', ['Липримар', 'Аторис'], 'Сердечно-сосудистые', 'Статин', 'C10AA05', ['Таблетки 10 мг', 'Таблетки 20 мг'], 'Дислипидемия, вторичная профилактика.', '10–80 мг однократно, независимо от приёма пищи.'),
  drug('g6', 'Кларитромицин', ['Клацид', 'Фромилид'], 'Антибиотики и противомикробные', 'Макролид', 'J01FA09', ['Таблетки 500 мг'], 'Инфекции дыхательных путей, эрадикация H. pylori.', '500 мг 2 раза в сутки 7–14 дней.'),
  drug('g7', 'Амоксициллин/клавуланат', ['Амоксиклав', 'Аугментин'], 'Антибиотики и противомикробные', 'Защищённый пенициллин', 'J01CR02', ['Таблетки 875+125 мг'], 'Внебольничная пневмония, синусит, средний отит.', '875+125 мг 2 раза в сутки.'),
  drug('g8', 'Ацетилсалициловая кислота', ['Кардиомагнил', 'ТромбоАСС'], 'Кровь и антикоагулянты', 'Антиагрегант', 'B01AC06', ['Таблетки 75 мг', 'Таблетки 100 мг'], 'Вторичная профилактика сердечно-сосудистых событий.', '75–100 мг однократно.'),
  drug('g9', 'Левотироксин натрия', ['Эутирокс', 'L-Тироксин'], 'Эндокринология', 'Гормон щитовидной железы', 'H03AA01', ['Таблетки 50 мкг', 'Таблетки 100 мкг'], 'Гипотиреоз.', 'Утром натощак, доза по массе тела и уровню ТТГ.'),
  drug('g10', 'Торасемид', ['Диувер', 'Тригрим'], 'Сердечно-сосудистые', 'Петлевой диуретик', 'C03CA04', ['Таблетки 5 мг', 'Таблетки 10 мг'], 'ХСН, отёчный синдром, артериальная гипертензия.', '5–10 мг однократно утром.'),
  drug('g11', 'Омепразол', ['Омез', 'Лосек'], 'Боль и воспаление', 'Ингибитор протонной помпы', 'A02BC01', ['Капсулы 20 мг'], 'Гастропротекция при приёме НПВС, ГЭРБ, язвенная болезнь.', '20 мг однократно утром.'),
  drug('g12', 'Амиодарон', ['Кордарон'], 'Сердечно-сосудистые', 'Антиаритмик III класса', 'C01BD01', ['Таблетки 200 мг'], 'Желудочковые и наджелудочковые аритмии.', 'Насыщение 600 мг/сут, поддержание 200 мг/сут.'),
];

const drugInteractions = [
  {
    id: 'x1',
    drugA: 'Варфарин',
    drugB: 'Ибупрофен',
    severity: 'major',
    mechanism: 'НПВС повреждают слизистую и подавляют агрегацию тромбоцитов, антикоагуляция при этом сохраняется.',
    recommendation: 'Избегать. При необходимости — минимальный курс, гастропротекция, контроль МНО через 3–5 дней.',
    createdAt: t(-200),
    updatedAt: t(-200),
  },
  {
    id: 'x2',
    drugA: 'Варфарин',
    drugB: 'Кларитромицин',
    severity: 'major',
    mechanism: 'Ингибирование CYP3A4 и CYP2C9 повышает концентрацию варфарина.',
    recommendation: 'Контроль МНО на третьи сутки, при необходимости снизить дозу варфарина.',
    createdAt: t(-200),
    updatedAt: t(-200),
  },
  {
    id: 'x3',
    drugA: 'Варфарин',
    drugB: 'Ацетилсалициловая кислота',
    severity: 'major',
    mechanism: 'Суммирование антитромботических эффектов.',
    recommendation: 'Только при чёткой показанности, с гастропротекцией.',
    createdAt: t(-200),
    updatedAt: t(-200),
  },
  {
    id: 'x4',
    drugA: 'Кларитромицин',
    drugB: 'Аторвастатин',
    severity: 'contraindicated',
    mechanism: 'Ингибирование CYP3A4 многократно повышает концентрацию статина — риск рабдомиолиза.',
    recommendation: 'Приостановить статин на время курса макролида.',
    createdAt: t(-200),
    updatedAt: t(-200),
  },
  {
    id: 'x5',
    drugA: 'Амиодарон',
    drugB: 'Варфарин',
    severity: 'major',
    mechanism: 'Подавление метаболизма варфарина, эффект нарастает неделями.',
    recommendation: 'Снизить дозу варфарина на треть, контроль МНО еженедельно первый месяц.',
    createdAt: t(-200),
    updatedAt: t(-200),
  },
  {
    id: 'x6',
    drugA: 'Амиодарон',
    drugB: 'Кларитромицин',
    severity: 'contraindicated',
    mechanism: 'Оба удлиняют интервал QT.',
    recommendation: 'Комбинации избегать; при необходимости — ЭКГ-контроль и коррекция электролитов.',
    createdAt: t(-200),
    updatedAt: t(-200),
  },
  {
    id: 'x7',
    drugA: 'Периндоприл',
    drugB: 'Ибупрофен',
    severity: 'moderate',
    mechanism: 'НПВС снижают гипотензивный эффект и ухудшают почечный кровоток.',
    recommendation: 'Контроль АД и креатинина, по возможности заменить НПВС.',
    createdAt: t(-200),
    updatedAt: t(-200),
  },
  {
    id: 'x8',
    drugA: 'Периндоприл',
    drugB: 'Торасемид',
    severity: 'moderate',
    mechanism: 'Риск гипотензии первой дозы и ухудшения функции почек.',
    recommendation: 'Начинать с малых доз, контроль калия и креатинина.',
    createdAt: t(-200),
    updatedAt: t(-200),
  },
  {
    id: 'x9',
    drugA: 'Метформин',
    drugB: 'Торасемид',
    severity: 'minor',
    mechanism: 'Диуретик может ухудшать функцию почек и повышать риск лактат-ацидоза.',
    recommendation: 'Контроль СКФ при титровании доз.',
    createdAt: t(-200),
    updatedAt: t(-200),
  },
  {
    id: 'x10',
    drugA: 'Левотироксин натрия',
    drugB: 'Омепразол',
    severity: 'moderate',
    mechanism: 'Снижение кислотности желудка ухудшает всасывание левотироксина.',
    recommendation: 'Разнести приём во времени, контроль ТТГ.',
    createdAt: t(-200),
    updatedAt: t(-200),
  },
];

const guideline = (id: string, title: string, summary: string, tags: string[], body: string) => ({
  id,
  kind: 'guideline',
  title,
  summary,
  tags,
  author: 'Клинические рекомендации',
  content: body,
  // Фикстура повторяет контракт целиком: карточка списка читает обложку, и поля, забытого в
  // фикстуре, хватило бы, чтобы страница упала на первом же `null`-е не там, где ждали.
  coverDataUrl: null,
  createdAt: t(-200),
  updatedAt: t(-200),
});

const knowledgeDocuments = [
  guideline(
    'kb1',
    'Артериальная гипертензия у взрослых',
    'Диагностика и подбор терапии при повышенном давлении.',
    ['Кардиология', 'Гипертензия'],
    '<p>Диагноз ставится при АД 140/90 мм рт. ст. и выше по данным повторных измерений.</p><h3>Ведение</h3><ul><li>Ограничение соли, снижение массы тела, физическая активность.</li><li>Стартовая терапия — комбинация иАПФ или БРА с диуретиком либо антагонистом кальция.</li></ul>',
  ),
  guideline(
    'kb2',
    'Сахарный диабет 2 типа',
    'Цели гликемического контроля и стартовая терапия.',
    ['Эндокринология', 'Диабет'],
    '<p>Индивидуальные цели HbA1c — от 6,5 до 8,0 % в зависимости от возраста и осложнений.</p><h3>Ведение</h3><ul><li>Метформин при отсутствии противопоказаний.</li><li>Оценка СКФ перед началом и далее ежегодно.</li></ul>',
  ),
  guideline(
    'kb3',
    'Хроническая сердечная недостаточность',
    'Четыре класса препаратов, влияющих на прогноз.',
    ['Кардиология', 'ХСН'],
    '<p>Диагноз подтверждается симптомами, объективными признаками и повышением натрийуретических пептидов.</p><h3>Ведение</h3><ul><li>иАПФ или АРНИ, бета-блокатор, антагонист минералокортикоидных рецепторов, ингибитор НГЛТ-2.</li><li>Диуретик — по объёмной перегрузке.</li></ul>',
  ),
  guideline(
    'kb4',
    'Внебольничная пневмония',
    'Оценка тяжести и выбор антибиотика.',
    ['Пульмонология', 'Инфекции'],
    '<p>Тяжесть оценивается по шкале CRB-65; решение о госпитализации — по сумме баллов и социальным факторам.</p><h3>Ведение</h3><ul><li>Амбулаторно — амоксициллин или защищённый пенициллин.</li><li>Оценка эффекта через 48–72 часа.</li></ul>',
  ),
  guideline(
    'kb5',
    'Железодефицитная анемия',
    'Подтверждение дефицита и длительность терапии.',
    ['Гематология'],
    '<p>Ферритин ниже 30 нг/мл подтверждает дефицит железа даже при нормальном гемоглобине.</p><h3>Ведение</h3><ul><li>Препараты железа внутрь, контроль через 4–6 недель.</li><li>Терапия продолжается три месяца после нормализации гемоглобина.</li></ul>',
  ),
  guideline(
    'kb6',
    'Хроническая обструктивная болезнь лёгких',
    'Оценка симптомов и ступенчатая ингаляционная терапия.',
    ['Пульмонология'],
    '<p>Диагноз требует спирометрии: ОФВ1/ФЖЕЛ менее 0,7 после бронхолитика.</p><h3>Ведение</h3><ul><li>Отказ от курения — единственное вмешательство, меняющее прогноз.</li><li>Длительно действующие бронхолитики по выраженности симптомов и частоте обострений.</li></ul>',
  ),
  guideline(
    'kb7',
    'Гипотиреоз',
    'Заместительная терапия и контроль ТТГ.',
    ['Эндокринология'],
    '<p>Манифестный гипотиреоз — повышение ТТГ при сниженном свободном Т4.</p><h3>Ведение</h3><ul><li>Левотироксин утром натощак.</li><li>Контроль ТТГ через 6–8 недель после изменения дозы.</li></ul>',
  ),
  guideline(
    'kb8',
    'Фибрилляция предсердий',
    'Оценка риска инсульта и антикоагуляция.',
    ['Кардиология', 'Аритмии'],
    '<p>Риск инсульта оценивается по CHA₂DS₂-VASc, риск кровотечения — по HAS-BLED.</p><h3>Ведение</h3><ul><li>Антикоагуляция при двух и более баллах у мужчин, трёх и более у женщин.</li><li>Контроль частоты или ритма — по симптомам.</li></ul>',
  ),
];

const calculatorCategories = [
  { id: 'cc1', name: 'Кардиология' },
  { id: 'cc2', name: 'Общее' },
];

const calculators = [
  {
    id: 'calc1',
    title: 'Индекс массы тела',
    description: 'Отношение массы тела к квадрату роста.',
    category: 'Общее',
    fields: [
      { key: 'weight', label: 'Масса тела', type: 'number', unit: 'кг', min: 20, max: 250, step: 0.1 },
      { key: 'height', label: 'Рост', type: 'number', unit: 'см', min: 100, max: 230, step: 1 },
    ],
    formula: 'weight / ((height / 100) * (height / 100))',
    resultLabel: 'ИМТ',
    resultUnit: 'кг/м²',
    decimals: 1,
    interpretation: [
      { id: 'i1', max: 18.5, label: 'Дефицит массы тела', color: 'blue' },
      { id: 'i2', min: 18.5, max: 25, label: 'Норма', color: 'green' },
      { id: 'i3', min: 25, max: 30, label: 'Избыточная масса тела', color: 'yellow' },
      { id: 'i4', min: 30, label: 'Ожирение', color: 'red' },
    ],
    favourite: true,
    createdAt: t(-200),
    updatedAt: t(-200),
  },
  {
    id: 'c-clearance',
    title: 'Клиренс креатинина',
    description: 'Формула Кокрофта — Голта: поля заполняются из карточки пациента и его бланков.',
    category: 'Нефрология',
    fields: [
      { key: 'age', label: 'Возраст', type: 'number', unit: 'лет', min: 1, max: 120, step: 1, defaultValue: 45 },
      { key: 'weight', label: 'Вес', type: 'number', unit: 'кг', min: 1, max: 300, step: 0.1, defaultValue: 70 },
      { key: 'creatinine', label: 'Креатинин крови', type: 'number', unit: 'мкмоль/л', min: 1, max: 2000, step: 1, defaultValue: 88 },
      {
        key: 'sexFactor',
        label: 'Пол',
        type: 'select',
        defaultValue: 1.23,
        options: [
          { label: 'Мужской', value: 1.23 },
          { label: 'Женский', value: 1.04 },
        ],
      },
    ],
    formula: '((140 - age) * weight * sexFactor) / creatinine',
    resultLabel: 'Клиренс креатинина',
    resultUnit: 'мл/мин',
    decimals: 0,
    interpretation: [
      { id: 'severe', max: 30, label: 'Тяжёлое снижение', color: 'red' },
      { id: 'moderate', min: 30, max: 60, label: 'Умеренное снижение', color: 'orange' },
      { id: 'mild', min: 60, max: 90, label: 'Незначительное снижение', color: 'yellow' },
      { id: 'normal', min: 90, label: 'Норма', color: 'teal' },
    ],
    favourite: false,
    createdAt: t(-200),
  },
  {
    id: 'calc2',
    title: 'Среднее артериальное давление',
    description: 'Диастолическое плюс треть пульсового давления.',
    category: 'Кардиология',
    fields: [
      { key: 'sbp', label: 'Систолическое АД', type: 'number', unit: 'мм рт. ст.', min: 50, max: 260, step: 1 },
      { key: 'dbp', label: 'Диастолическое АД', type: 'number', unit: 'мм рт. ст.', min: 30, max: 160, step: 1 },
    ],
    formula: 'dbp + (sbp - dbp) / 3',
    resultLabel: 'Среднее АД',
    resultUnit: 'мм рт. ст.',
    decimals: 0,
    interpretation: [
      { id: 'i5', max: 65, label: 'Ниже порога перфузии', color: 'red' },
      { id: 'i6', min: 65, label: 'Достаточное перфузионное давление', color: 'green' },
    ],
    favourite: true,
    createdAt: t(-200),
    updatedAt: t(-200),
  },
  {
    id: 'calc3',
    title: 'Пульсовое давление',
    description: 'Разница систолического и диастолического давления.',
    category: 'Кардиология',
    fields: [
      { key: 'sbp', label: 'Систолическое АД', type: 'number', unit: 'мм рт. ст.', min: 50, max: 260, step: 1 },
      { key: 'dbp', label: 'Диастолическое АД', type: 'number', unit: 'мм рт. ст.', min: 30, max: 160, step: 1 },
    ],
    formula: 'sbp - dbp',
    resultLabel: 'Пульсовое давление',
    resultUnit: 'мм рт. ст.',
    decimals: 0,
    interpretation: [
      { id: 'i7', max: 40, label: 'Сниженное', color: 'yellow' },
      { id: 'i8', min: 40, max: 60, label: 'Норма', color: 'green' },
      { id: 'i9', min: 60, label: 'Повышенное', color: 'orange' },
    ],
    favourite: false,
    createdAt: t(-200),
    updatedAt: t(-200),
  },
];

const labParam = (
  key: string,
  label: string,
  unit: string,
  decimals: number,
  min: number,
  max: number,
  lowCauses: string[] = [],
  highCauses: string[] = [],
) => ({
  key,
  label,
  unit,
  decimals,
  inputType: 'number' as const,
  range: { min, max },
  lowCauses,
  highCauses,
});

/**
 * Свои анализаторы. Форма — ровно та, что отдаёт бэкенд (`BackendLabTest`): и `shortTitle`, и
 * `patterns`, и обязательные списки причин у каждого показателя. Проверено прогоном: без `patterns`
 * страница анализов падала на `undefined.map` — фикстура обязана повторять контракт, а не
 * напоминать его.
 */
const customLabTests = [
  {
    id: 'lt1',
    title: 'Липидограмма (демо)',
    shortTitle: 'Липиды',
    description: 'Собственный анализатор: четыре показателя с референсами.',
    parameters: [
      labParam('chol', 'Общий холестерин', 'ммоль/л', 2, 3.2, 5.2, [], ['Дислипидемия', 'Гипотиреоз']),
      labParam('ldl', 'ЛПНП', 'ммоль/л', 2, 1.2, 3, [], ['Дислипидемия', 'Гипотиреоз', 'Нефротический синдром']),
      labParam('hdl', 'ЛПВП', 'ммоль/л', 2, 1, 2.2, ['Метаболический синдром', 'Курение'], []),
      labParam('tg', 'Триглицериды', 'ммоль/л', 2, 0.4, 1.7, [], ['Ожирение', 'Злоупотребление алкоголем', 'Сахарный диабет']),
    ],
    patterns: [
      {
        id: 'pt1',
        title: 'Атерогенный профиль',
        severity: 'warning',
        description: 'Повышены ЛПНП при сниженных ЛПВП.',
        causes: ['Дислипидемия', 'Метаболический синдром'],
        root: {
          type: 'group',
          operator: 'and',
          children: [
            { type: 'condition', paramKey: 'ldl', status: 'high' },
            { type: 'condition', paramKey: 'hdl', status: 'low' },
          ],
        },
      },
    ],
    createdAt: t(-100),
    updatedAt: t(-100),
  },
  {
    id: 'lt2',
    title: 'Контроль антикоагуляции (демо)',
    shortTitle: 'МНО',
    description: 'МНО и протромбиновое время.',
    parameters: [
      labParam('inr', 'МНО', '', 2, 2, 3, ['Недостаточная доза варфарина', 'Пропуск приёма'], ['Передозировка', 'Лекарственное взаимодействие']),
      labParam('pt', 'Протромбиновое время', 'с', 1, 11, 15, [], ['Дефицит витамина K', 'Болезнь печени']),
    ],
    patterns: [],
    createdAt: t(-100),
    updatedAt: t(-100),
  },
  {
    id: 'lt3',
    title: 'Биохимия: почки (демо)',
    shortTitle: 'Почки',
    description: 'Креатинин и мочевина — то, из чего считается клиренс.',
    parameters: [
      labParam('creatinine', 'Креатинин', 'мкмоль/л', 0, 62, 115, [], ['Почечная недостаточность', 'Обезвоживание']),
      labParam('urea', 'Мочевина', 'ммоль/л', 1, 2.8, 7.2, [], ['Почечная недостаточность', 'Высокобелковая диета']),
    ],
    patterns: [],
    createdAt: t(-100),
    updatedAt: t(-100),
  },
];

/**
 * Сохранённые в карты анализы.
 *
 * У Егоровой три бланка МНО подряд — иначе динамику показателя показать не на чем, а она здесь
 * главное: одно значение отвечает «нормально ли это», ряд — «становится лучше или хуже». Пол и
 * возраст лежат в самой записи, как и на бою: по ним брались нормы, и возраст считается от
 * сегодняшнего дня, а не записан числом.
 */
const age = (birthDate: string) => today.diff(dayjs(birthDate), 'year');

const labResults = [
  {
    id: 'lr1',
    patientId: 'p1',
    analyzerId: 'lt2',
    analyzerTitle: 'Контроль антикоагуляции (демо)',
    takenAt: d(-75),
    sex: 'female',
    ageYears: age('1958-03-14'),
    values: [
      { key: 'inr', label: 'МНО', unit: '', value: 2.4 },
      { key: 'pt', label: 'Протромбиновое время', unit: 'с', value: 14.2 },
    ],
    note: 'В целевом диапазоне.',
    createdAt: t(-75),
    updatedAt: t(-75),
  },
  {
    id: 'lr2',
    patientId: 'p1',
    analyzerId: 'lt2',
    analyzerTitle: 'Контроль антикоагуляции (демо)',
    takenAt: d(-40),
    sex: 'female',
    ageYears: age('1958-03-14'),
    values: [
      { key: 'inr', label: 'МНО', unit: '', value: 1.7 },
      { key: 'pt', label: 'Протромбиновое время', unit: 'с', value: 12.1 },
    ],
    note: 'Пропускала приём — доза не менялась.',
    createdAt: t(-40),
    updatedAt: t(-40),
  },
  {
    id: 'lr3',
    patientId: 'p1',
    analyzerId: 'lt2',
    analyzerTitle: 'Контроль антикоагуляции (демо)',
    takenAt: d(-12),
    sex: 'female',
    ageYears: age('1958-03-14'),
    values: [
      { key: 'inr', label: 'МНО', unit: '', value: 2.6 },
      { key: 'pt', label: 'Протромбиновое время', unit: 'с', value: 15.4 },
    ],
    note: '',
    createdAt: t(-12),
    updatedAt: t(-12),
  },
  {
    id: 'lr5',
    patientId: 'p2',
    analyzerId: 'lt3',
    analyzerTitle: 'Биохимия: почки (демо)',
    takenAt: d(-5),
    sex: 'male',
    ageYears: age('1971-11-02'),
    values: [
      { key: 'creatinine', label: 'Креатинин', unit: 'мкмоль/л', value: 118 },
      { key: 'urea', label: 'Мочевина', unit: 'ммоль/л', value: 7.8 },
    ],
    note: '',
    createdAt: t(-5),
    updatedAt: t(-5),
  },
  {
    id: 'lr4',
    patientId: 'p2',
    analyzerId: 'lt1',
    analyzerTitle: 'Липидограмма (демо)',
    takenAt: d(-5),
    sex: 'male',
    ageYears: age('1971-11-02'),
    values: [
      { key: 'chol', label: 'Общий холестерин', unit: 'ммоль/л', value: 6.1 },
      { key: 'ldl', label: 'ЛПНП', unit: 'ммоль/л', value: 4.2 },
      { key: 'hdl', label: 'ЛПВП', unit: 'ммоль/л', value: 0.9 },
      { key: 'tg', label: 'Триглицериды', unit: 'ммоль/л', value: 2.4 },
    ],
    note: 'Натощак.',
    createdAt: t(-5),
    updatedAt: t(-5),
  },
];

/**
 * Постоянная терапия. У Егоровой она подобрана так, чтобы проверка взаимодействий **что-то нашла**:
 * варфарин и «Кардиомагнил» — торговое название ацетилсалициловой кислоты, на которую в фикстуре
 * есть правило. Демо, где кнопка проверки открывает пустой результат, показывает не продукт.
 */
const patientMedications = [
  { id: 'pm1', patientId: 'p1', name: 'Варфарин', dose: '2,5 мг вечером', note: 'Целевое МНО 2,0–3,0', createdAt: t(-300), updatedAt: t(-300) },
  { id: 'pm2', patientId: 'p1', name: 'Кардиомагнил', dose: '75 мг утром', note: 'Назначен кардиологом', createdAt: t(-200), updatedAt: t(-200) },
  { id: 'pm3', patientId: 'p1', name: 'Периндоприл', dose: '4 мг утром', note: '', createdAt: t(-120), updatedAt: t(-120) },
  { id: 'pm4', patientId: 'p2', name: 'Метформин', dose: '1000 мг вечером', note: '', createdAt: t(-90), updatedAt: t(-90) },
  { id: 'pm5', patientId: 'p2', name: 'Аторвастатин', dose: '20 мг вечером', note: '', createdAt: t(-90), updatedAt: t(-90) },
];

/**
 * Собирается заново на каждый вход в демо: даты должны быть свежими.
 *
 * Копия через JSON — не перестраховка: хранилище демо правится на месте, и без копии правка
 * пациента в одной сессии осталась бы в модуле до перезагрузки страницы.
 */
export function createDemoData(): Record<string, Record<string, unknown>[]> {
  return JSON.parse(
    JSON.stringify({
      '/patients': patients,
      '/dispensary': dispensary,
      '/notes': notes,
      '/reminders': reminders,
      '/planner-boards': plannerBoards,
      '/planner-columns': plannerColumns,
      '/planner-cards': plannerCards,
      '/document-templates': documentTemplates,
      '/documents': doctorDocuments,
      '/drugs': drugs,
      '/abbreviations': abbreviations,
      '/diseases': diseases,
      '/drug-categories': drugCategories,
      '/drug-interactions': drugInteractions,
      '/knowledge-documents': knowledgeDocuments,
      '/calculators': calculators,
      '/calculator-categories': calculatorCategories,
      '/custom-lab-tests': customLabTests,
      '/lab-results': labResults,
      '/patient-medications': patientMedications,
      '/questionnaires': [],
      '/library': [],
      '/news-feed-sources': [],
    }),
  ) as Record<string, Record<string, unknown>[]>;
}
