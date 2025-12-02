/**
 * Visual Editor - WYSIWYG package editing for tenant dashboard
 *
 * Components:
 * - VisualEditorDashboard: Main dashboard component
 * - EditablePackageCard: Individual package card with inline editing
 * - EditableText: Click-to-edit text input
 * - EditablePrice: Click-to-edit price input
 * - PhotoDropZone: Drag & drop photo upload
 * - EditablePackageGrid: Responsive grid layout
 *
 * Hooks:
 * - useVisualEditor: Main state management hook
 */

export { VisualEditorDashboard } from "./VisualEditorDashboard";
export { EditablePackageCard } from "./components/EditablePackageCard";
export { EditablePackageGrid } from "./components/EditablePackageGrid";
export { EditableText } from "./components/EditableText";
export { EditablePrice } from "./components/EditablePrice";
export { PhotoDropZone } from "./components/PhotoDropZone";
export { useVisualEditor } from "./hooks/useVisualEditor";
export type { PackageWithDraft, PackagePhoto, DraftUpdate } from "./hooks/useVisualEditor";
