import React from 'react';
import { RefreshCw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, errorMessage: error.message || 'Errore imprevisto' };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Errore applicazione SALVAFRICA:', error, info);
  }

  render() {
    if (this.state.hasError) {
      let friendlyMsg = 'Si è verificato un problema nel caricamento dei dati.';
      try {
        const parsed = JSON.parse(this.state.errorMessage);
        if (parsed?.error?.toLowerCase().includes('quota')) {
          friendlyMsg =
            'Limite giornaliero gratuito di Firestore raggiunto. Riprova domani oppure verifica la quota del progetto Firebase.';
        } else if (parsed?.error?.toLowerCase().includes('permission')) {
          friendlyMsg =
            'Accesso negato dal salvadanaio. Verifica di aver effettuato l’accesso con l’account autorizzato.';
        }
      } catch {
        // non-JSON error message
      }

      return (
        <div className="min-h-screen bg-[#FAF6F0] dark:bg-[#0E1F2E] text-[#122638] dark:text-[#FAF6F0] flex items-center justify-center p-6">
          <div className="w-full max-w-md rounded-3xl bg-[#F2ECE3] dark:bg-[#162D42] border border-[#E6DDD1] dark:border-[#264561] p-6 text-center">
            <h2 className="font-display text-2xl font-semibold text-[#122638] dark:text-[#FAF6F0]">
              Piccola onda imprevista
            </h2>
            <p className="mt-2 text-sm text-[#5B6B79] dark:text-[#9DB0C0] leading-relaxed">
              {friendlyMsg}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 ds-btn-primary px-5 text-sm"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Ricarica l’app</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
