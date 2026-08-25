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
import { DocumentTemplatesPage } from './pages/DocumentTemplatesPage';
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
        <Route path="/patients" element={<PatientsPage />} />
        <Route path="/patients/new" element={<PatientEditorPage />} />
        <Route path="/patients/documents" element={<DocumentTemplatesPage />} />
        <Route path="/patients/documents/new" element={<DocumentTemplateEditorPage />} />
        <Route path="/patients/documents/scan" element={<ScanTemplatePage />} />
        <Route path="/patients/documents/:id/edit" element={<DocumentTemplateEditorPage />} />
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
