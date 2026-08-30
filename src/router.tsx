import { lazy, Suspense } from 'react';
import type { ComponentType } from 'react';
import { Loader, Stack } from '@mantine/core';
import { createBrowserRouter, createRoutesFromElements, Navigate, Outlet, Route, RouterProvider } from 'react-router-dom';

import { APP_BASE } from './lib/appBase';
import { RequireAuth } from './routes/RequireAuth';
import { RouteErrorPage } from './pages/RouteErrorPage';
import { DeleteConfirmProvider } from './features/deletion/DeleteConfirmProvider';
import { AppLayout } from './layouts/AppLayout';

import { RedirectTo, withSearch } from './pages/RedirectTo';

/**
 * Every page behind its own dynamic import.
 *
 * Without this the application is one chunk: opening the dashboard downloaded the Word editor, the
 * PDF reader and the knowledge graph's force layout, none of which that screen uses. Pages export
 * a named component rather than a default one, so the module is unwrapped here instead of at each
 * of the sixty call sites.
 */
// Страницы принимают разные пропсы (у `ComingSoonPage` есть `title`), и общий тип здесь — вся
// суть помощника: он про то, как достать компонент из модуля, а не про то, что тот принимает.
// oxlint-disable-next-line typescript/no-explicit-any
type PageComponent = ComponentType<any>;

function lazyPage<M extends Record<string, PageComponent>, K extends keyof M>(load: () => Promise<M>, name: K) {
  return lazy(async () => ({ default: (await load())[name] }));
}

const DashboardPage = lazyPage(() => import('./pages/DashboardPage'), 'DashboardPage');
const DoctorPage = lazyPage(() => import('./pages/DoctorPage'), 'DoctorPage');
const CalculatorsPage = lazyPage(() => import('./pages/CalculatorsPage'), 'CalculatorsPage');
const CalculatorRunPage = lazyPage(() => import('./pages/CalculatorRunPage'), 'CalculatorRunPage');
const CalculatorBuilderPage = lazyPage(() => import('./pages/CalculatorBuilderPage'), 'CalculatorBuilderPage');
const NotesPage = lazyPage(() => import('./pages/NotesPage'), 'NotesPage');
const NoteViewPage = lazyPage(() => import('./pages/NoteViewPage'), 'NoteViewPage');
const NoteEditorPage = lazyPage(() => import('./pages/NoteEditorPage'), 'NoteEditorPage');
const CalendarPage = lazyPage(() => import('./pages/CalendarPage'), 'CalendarPage');
const PatientsPage = lazyPage(() => import('./pages/PatientsPage'), 'PatientsPage');
const PatientViewPage = lazyPage(() => import('./pages/PatientViewPage'), 'PatientViewPage');
const PatientEditorPage = lazyPage(() => import('./pages/PatientEditorPage'), 'PatientEditorPage');
const DispensaryViewPage = lazyPage(() => import('./pages/DispensaryViewPage'), 'DispensaryViewPage');
const PrintableDocumentPage = lazyPage(() => import('./pages/PrintableDocumentPage'), 'PrintableDocumentPage');
const DocumentsPage = lazyPage(() => import('./pages/DocumentsPage'), 'DocumentsPage');
const DocumentViewPage = lazyPage(() => import('./pages/DocumentViewPage'), 'DocumentViewPage');
const DocumentEditorPage = lazyPage(() => import('./pages/DocumentEditorPage'), 'DocumentEditorPage');
const DocumentTemplateEditorPage = lazyPage(() => import('./pages/DocumentTemplateEditorPage'), 'DocumentTemplateEditorPage');
const ScanTemplatePage = lazyPage(() => import('./pages/ScanTemplatePage'), 'ScanTemplatePage');
const LabResultViewPage = lazyPage(() => import('./features/labResults/LabResultViewPage'), 'LabResultViewPage');
const DispensaryEditorPage = lazyPage(() => import('./pages/DispensaryEditorPage'), 'DispensaryEditorPage');
const DispensaryStatsPage = lazyPage(() => import('./pages/DispensaryStatsPage'), 'DispensaryStatsPage');
const GuidelinesPage = lazyPage(() => import('./pages/GuidelinesPage'), 'GuidelinesPage');
const KnowledgeTagPage = lazyPage(() => import('./pages/KnowledgeTagPage'), 'KnowledgeTagPage');
const ReferencePage = lazyPage(() => import('./pages/ReferencePage'), 'ReferencePage');
const DiseaseViewPage = lazyPage(() => import('./features/diseases/DiseaseViewPage'), 'DiseaseViewPage');
const DiseaseEditorPage = lazyPage(() => import('./features/diseases/DiseaseEditorPage'), 'DiseaseEditorPage');
const GuidelineViewPage = lazyPage(() => import('./pages/GuidelineViewPage'), 'GuidelineViewPage');
const GuidelineEditorPage = lazyPage(() => import('./pages/GuidelineEditorPage'), 'GuidelineEditorPage');
const QuestionnairesPage = lazyPage(() => import('./pages/QuestionnairesPage'), 'QuestionnairesPage');
const QuestionnaireViewPage = lazyPage(() => import('./pages/QuestionnaireViewPage'), 'QuestionnaireViewPage');
const QuestionnaireBuilderPage = lazyPage(() => import('./pages/QuestionnaireBuilderPage'), 'QuestionnaireBuilderPage');
const ArticlesPage = lazyPage(() => import('./pages/ArticlesPage'), 'ArticlesPage');
const ArticleViewPage = lazyPage(() => import('./pages/ArticleViewPage'), 'ArticleViewPage');
const ArticleEditorPage = lazyPage(() => import('./pages/ArticleEditorPage'), 'ArticleEditorPage');
const AnalyzerPage = lazyPage(() => import('./pages/AnalyzerPage'), 'AnalyzerPage');
const AnalyzerBuilderPage = lazyPage(() => import('./pages/AnalyzerBuilderPage'), 'AnalyzerBuilderPage');
const DrugsPage = lazyPage(() => import('./pages/DrugsPage'), 'DrugsPage');
const Icd10ViewPage = lazyPage(() => import('./pages/Icd10ViewPage'), 'Icd10ViewPage');
const DrugViewPage = lazyPage(() => import('./pages/DrugViewPage'), 'DrugViewPage');
const DrugEditorPage = lazyPage(() => import('./pages/DrugEditorPage'), 'DrugEditorPage');
const PlannerPage = lazyPage(() => import('./pages/PlannerPage'), 'PlannerPage');
const LibraryPage = lazyPage(() => import('./pages/LibraryPage'), 'LibraryPage');
const BookViewPage = lazyPage(() => import('./pages/BookViewPage'), 'BookViewPage');
const BookReaderPage = lazyPage(() => import('./pages/BookReaderPage'), 'BookReaderPage');
const NewsPage = lazyPage(() => import('./pages/NewsPage'), 'NewsPage');
const NewsReaderPage = lazyPage(() => import('./pages/NewsReaderPage'), 'NewsReaderPage');
const NotFoundPage = lazyPage(() => import('./pages/NotFoundPage'), 'NotFoundPage');

/**
 * Общее для всех маршрутов, чему нужен сам роутер.
 *
 * Удаление, начатое на странице записи, переживает переход к списку — его окно отмены живёт здесь,
 * над всеми страницами.
 */
function RouterRoot() {
  return (
    <DeleteConfirmProvider>
      {/* Одна заглушка на все страницы: разделение по чанкам — свойство сборки, а не поведение
          экрана, и своё ожидание каждой странице придумывать незачем. */}
      <Suspense
        fallback={
          <Stack align="center" justify="center" mih="60vh">
            <Loader />
          </Stack>
        }
      >
        <Outlet />
      </Suspense>
    </DeleteConfirmProvider>
  );
}

/**
 * Маршруты объявлены через `createBrowserRouter`, а не `<BrowserRouter>` с `<Routes>`, ради одного:
 * `useBlocker` работает только в роутере с данными. Он нужен предупреждению о несохранённых
 * изменениях — иначе переход по ссылке в сайдбаре молча уносит из редактора всё, что в нём набрано,
 * и перехватывать его пришлось бы разбором нажатий по ссылкам, то есть враньём наполовину.
 *
 * **Приложение живёт под `/app`, и задаёт это `basename`, а не пути маршрутов.** Внутренних ссылок
 * в коде около полутора сотен в полусотне файлов; приписать префикс каждой значило бы завести
 * полтораста мест, где о нём можно забыть. С `basename` и маршруты, и `to="/patients"`, и
 * `navigate('/calendar')` остаются какими были, а префикс объявлен один раз — в `lib/appBase.ts`.
 * Цена решения: публичная часть сайта — **отдельный роутер** (`publicRouter.tsx`), потому что
 * адрес `/` этому роутеру недоступен вовсе, и переход между ними — полная загрузка страницы.
 */
export const router = createBrowserRouter(
  createRoutesFromElements(
    <Route element={<RouterRoot />}>
      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          {/* Безымянный маршрут ради `errorElement`: он **внутри** оболочки, поэтому упавшая
              страница заменяется сообщением, а шапка и сайдбар остаются. С `errorElement` уровнем
              выше одна ошибка уносила бы и навигацию, и уйти можно было бы только перезагрузкой. */}
          <Route errorElement={<RouteErrorPage />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/analyzer" element={<AnalyzerPage />} />
          <Route path="/analyzer/new" element={<AnalyzerBuilderPage />} />
          <Route path="/analyzer/:id/edit" element={<AnalyzerBuilderPage />} />
          {/* Раздел переехал во вкладку справочника. Строка запроса сохраняется: карточка препарата
              ведёт сюда с `?drugs=<МНН>`, и без него проверка открылась бы пустой. */}
          <Route
            path="/interactions"
            element={
              <RedirectTo
                build={(_params, search) => {
                  search.set('tab', 'interactions');
                  return withSearch('/drugs', search);
                }}
              />
            }
          />
          <Route path="/drugs" element={<DrugsPage />} />
          <Route path="/drugs/new" element={<DrugEditorPage />} />
          <Route path="/drugs/:id" element={<DrugViewPage />} />
          <Route path="/drugs/:id/edit" element={<DrugEditorPage />} />

          {/* Код в адресе содержит точку (`I21.0`), и это единственный сегмент приложения, где
              она встречается: роутер к ней безразличен, а вот `encodeURIComponent` обязателен. */}
          {/* Список МКБ-10 переехал во вкладку справочника; карточка кода осталась своей страницей. */}
          <Route path="/icd10/:code" element={<Icd10ViewPage />} />
          <Route path="/planner" element={<PlannerPage />} />
          <Route path="/doctor" element={<DoctorPage />} />
          <Route path="/calculators" element={<CalculatorsPage />} />
          <Route path="/calculators/new" element={<CalculatorBuilderPage />} />
          <Route path="/calculators/:id" element={<CalculatorRunPage />} />
          <Route path="/calculators/:id/edit" element={<CalculatorBuilderPage />} />
          <Route path="/notes" element={<NotesPage />} />
          <Route path="/notes/new" element={<NoteEditorPage />} />
          <Route path="/notes/:id" element={<NoteViewPage />} />
          <Route path="/notes/:id/edit" element={<NoteEditorPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/news" element={<NewsPage />} />
          <Route path="/news/read" element={<NewsReaderPage />} />
          <Route path="/knowledge/tag/:tag" element={<KnowledgeTagPage />} />
          <Route path="/reference" element={<ReferencePage />} />
          <Route path="/reference/diseases/new" element={<DiseaseEditorPage />} />
          <Route path="/reference/diseases/:id" element={<DiseaseViewPage />} />
          <Route path="/reference/diseases/:id/edit" element={<DiseaseEditorPage />} />
          {/* Прежние адреса разделов — вместе со строкой запроса: ссылка на код МКБ с параметрами
              не должна терять их по дороге. */}
          <Route
            path="/reference/abbreviations"
            element={
              <RedirectTo
                build={(_params, search) => {
                  search.set('tab', 'abbreviations');
                  return withSearch('/reference', search);
                }}
              />
            }
          />
          <Route
            path="/icd10"
            element={
              <RedirectTo
                build={(_params, search) => {
                  search.set('tab', 'icd10');
                  return withSearch('/reference', search);
                }}
              />
            }
          />
          <Route path="/guidelines" element={<GuidelinesPage />} />
          <Route path="/guidelines/new" element={<GuidelineEditorPage />} />
          <Route path="/guidelines/:id" element={<GuidelineViewPage />} />
          <Route path="/guidelines/:id/edit" element={<GuidelineEditorPage />} />
          <Route path="/diagnostics" element={<QuestionnairesPage />} />
          <Route path="/diagnostics/new" element={<QuestionnaireBuilderPage />} />
          <Route path="/diagnostics/:id" element={<QuestionnaireViewPage />} />
          <Route path="/diagnostics/:id/edit" element={<QuestionnaireBuilderPage />} />
          <Route path="/articles" element={<ArticlesPage />} />
          <Route path="/articles/new" element={<ArticleEditorPage />} />
          <Route path="/articles/:id" element={<ArticleViewPage />} />
          <Route path="/articles/:id/edit" element={<ArticleEditorPage />} />
          <Route path="/library" element={<LibraryPage />} />
          <Route path="/library/:id" element={<BookViewPage />} />
          <Route path="/library/:id/read" element={<BookReaderPage />} />
          <Route path="/documents" element={<DocumentsPage />} />
          <Route path="/documents/new" element={<DocumentEditorPage />} />
          <Route path="/documents/templates/new" element={<DocumentTemplateEditorPage />} />
          <Route path="/documents/templates/scan" element={<ScanTemplatePage />} />
          <Route path="/documents/templates/:id/edit" element={<DocumentTemplateEditorPage />} />
          <Route path="/documents/:id" element={<DocumentViewPage />} />
          <Route path="/documents/:id/edit" element={<DocumentEditorPage />} />
          <Route path="/patients" element={<PatientsPage />} />
          <Route path="/patients/new" element={<PatientEditorPage />} />
          {/* Раздел переехал из-под /patients: документ врача может не относиться ни к кому.
              Старые адреса ведут туда же — закладки и ссылка с дашборда обязаны работать. */}
          <Route
            path="/patients/documents"
            element={
              <RedirectTo
                build={(_params, search) => {
                  search.set('tab', 'templates');
                  return withSearch('/documents', search);
                }}
              />
            }
          />
          <Route path="/patients/documents/new" element={<RedirectTo build={(_p, q) => withSearch('/documents/templates/new', q)} />} />
          <Route path="/patients/documents/scan" element={<RedirectTo build={(_p, q) => withSearch('/documents/templates/scan', q)} />} />
          <Route
            path="/patients/documents/:id/edit"
            element={<RedirectTo build={(params, q) => withSearch(`/documents/templates/${params.id}/edit`, q)} />}
          />
          <Route path="/patients/dispensary/stats" element={<DispensaryStatsPage />} />
          <Route path="/patients/dispensary/new" element={<DispensaryEditorPage />} />
          <Route path="/patients/dispensary/:id" element={<DispensaryViewPage />} />
          <Route path="/patients/dispensary/:id/edit" element={<DispensaryEditorPage />} />
          <Route path="/patients/:id" element={<PatientViewPage />} />
          <Route path="/patients/:id/edit" element={<PatientEditorPage />} />
          <Route path="/patients/:id/documents/:visitId" element={<PrintableDocumentPage />} />
          <Route path="/patients/:patientId/analyses/:id" element={<LabResultViewPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Route>
      </Route>
    </Route>,
  ),
  { basename: APP_BASE },
);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
