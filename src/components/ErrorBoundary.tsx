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
        <div className="min-h-screen bg-[#FAF8F5] text-[#132638] flex items-center justify-center p-6">
          <div className="w-full max-w-md rounded-3xl bg-white border border-[#E8E2D9] p-6 text-center shadow-sm">
            <h2 className="font-display text-2xl font-semibold text-[#132638]">
              Piccola onda imprevista
            </h2>
            <p className="mt-2 text-sm text-[#5C6B7A] leading-relaxed">{friendlyMsg}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-[#E86A52] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#D1533C] transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Ricarica l’app
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
