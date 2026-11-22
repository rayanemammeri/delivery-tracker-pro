import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import { DataProvider } from './hooks/data';
import { ConfirmProvider, ToastProvider } from './components/ui';
import { requestPersistence } from './db/repo';
import './index.css';

registerSW({ immediate: true });
void requestPersistence();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <DataProvider>
      <ToastProvider>
        <ConfirmProvider>
          <App />
        </ConfirmProvider>
      </ToastProvider>
    </DataProvider>
  </React.StrictMode>,
);
