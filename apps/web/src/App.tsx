import { Navigate, Route, Routes } from 'react-router-dom';

import { WorkspaceShell } from './components/WorkspaceShell';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<WorkspaceShell />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
