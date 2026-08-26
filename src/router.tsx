import { Navigate, Route, Routes } from 'react-router-dom';

import { AppLayout } from './layouts/AppLayout';
import { DashboardPage } from './pages/DashboardPage';
import { DoctorPage } from './pages/DoctorPage';
import { CalculatorsPage } from './pages/CalculatorsPage';
import { CalculatorRunPage } from './pages/CalculatorRunPage';
import { CalculatorBuilderPage } from './pages/CalculatorBuilderPage';
import { NotesPage } from './pages/NotesPage';
import { NoteViewPage } from './pages/NoteViewPage';
import { NoteEditorPage } from './pages/NoteEditorPage';
import { CalendarPage } from './pages/CalendarPage';
import { PatientsPage } from './pages/PatientsPage';
import { PatientViewPage } from './pages/PatientViewPage';
import { PatientEditorPage } from './pages/PatientEditorPage';
import { DispensaryViewPage } from './pages/DispensaryViewPage';
import { PrintableDocumentPage } from './pages/PrintableDocumentPage';
import { DocumentsPage } from './pages/DocumentsPage';
import { DocumentViewPage } from './pages/DocumentViewPage';
import { DocumentEditorPage } from './pages/DocumentEditorPage';
import { RedirectTo, withSearch } from './pages/RedirectTo';
import { DocumentTemplateEditorPage } from './pages/DocumentTemplateEditorPage';
import { ScanTemplatePage } from './pages/ScanTemplatePage';
import { DispensaryEditorPage } from './pages/DispensaryEditorPage';
import { DispensaryStatsPage } from './pages/DispensaryStatsPage';
import { GuidelinesPage } from './pages/GuidelinesPage';
import { KnowledgeGraphPage } from './pages/KnowledgeGraphPage';
import { KnowledgeTagPage } from './pages/KnowledgeTagPage';
import { GuidelineViewPage } from './pages/GuidelineViewPage';
import { GuidelineEditorPage } from './pages/GuidelineEditorPage';
import { QuestionnairesPage } from './pages/QuestionnairesPage';
import { QuestionnaireViewPage } from './pages/QuestionnaireViewPage';
import { QuestionnaireBuilderPage } from './pages/QuestionnaireBuilderPage';
import { ArticlesPage } from './pages/ArticlesPage';
import { ArticleViewPage } from './pages/ArticleViewPage';
import { ArticleEditorPage } from './pages/ArticleEditorPage';
import { AnalyzerPage } from './pages/AnalyzerPage';
import { AnalyzerBuilderPage } from './pages/AnalyzerBuilderPage';
import { InteractionsPage } from './pages/InteractionsPage';
import { DrugsPage } from './pages/DrugsPage';
import { DrugViewPage } from './pages/DrugViewPage';
import { DrugEditorPage } from './pages/DrugEditorPage';
import { PlannerPage } from './pages/PlannerPage';
import { LibraryPage } from './pages/LibraryPage';
import { BookViewPage } from './pages/BookViewPage';
import { BookReaderPage } from './pages/BookReaderPage';
import { ComingSoonPage } from './pages/ComingSoonPage';
import { NewsPage } from './pages/NewsPage';
import { NewsReaderPage } from './pages/NewsReaderPage';
import { NotFoundPage } from './pages/NotFoundPage';

export function AppRouter() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/analyzer" element={<AnalyzerPage />} />
        <Route path="/analyzer/new" element={<AnalyzerBuilderPage />} />
        <Route path="/analyzer/:id/edit" element={<AnalyzerBuilderPage />} />
        <Route path="/interactions" element={<InteractionsPage />} />
        <Route path="/drugs" element={<DrugsPage />} />
        <Route path="/drugs/new" element={<DrugEditorPage />} />
        <Route path="/drugs/:id" element={<DrugViewPage />} />
        <Route path="/drugs/:id/edit" element={<DrugEditorPage />} />
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
        <Route path="/knowledge/graph" element={<KnowledgeGraphPage />} />
        <Route path="/knowledge/tag/:tag" element={<KnowledgeTagPage />} />
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
        <Route path="/schedule" element={<ComingSoonPage title="Расписание" />} />
        <Route path="/messages" element={<ComingSoonPage title="Сообщения" />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
