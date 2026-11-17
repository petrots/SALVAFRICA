import React, { useEffect, useState } from 'react';
import { ArrowRight, Compass, KeyRound, LogOut, Sparkles, Users } from 'lucide-react';
import { User } from 'firebase/auth';
import { signInWithGoogle, signOutUser } from '../firebase';
import { createVaultAndInvite, joinVaultWithCode, lookupInvite } from '../services/vaultService';
import { APP_LIMITS, VaultInvite } from '../types';

interface WelcomeOnboardingProps {
  user: User | null;
  initialInviteCode: string;
  onVaultReady: (vaultId: string) => void;
}

export const WelcomeOnboarding: React.FC<WelcomeOnboardingProps> = ({
  user,
  initialInviteCode,
  onVaultReady,
}) => {
  const [mode, setMode] = useState<'create' | 'join'>(initialInviteCode ? 'join' : 'create');

  const [title, setTitle] = useState('Viaggio in Africa');
  const [destination, setDestination] = useState('Africa');
  const [targetAmount, setTargetAmount] = useState('2500');
  const [partnerAName, setPartnerAName] = useState(() => {
    const first = user?.displayName?.split(' ')[0];
    return first || 'Io';
  });
  const [partnerBName, setPartnerBName] = useState('Amore');

  const [inviteCode, setInviteCode] = useState(initialInviteCode);
  const [invitePreview, setInvitePreview] = useState<VaultInvite | null>(null);
  const [loading, setLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (user?.displayName && partnerAName === 'Io') {
      setPartnerAName(user.displayName.split(' ')[0].slice(0, APP_LIMITS.partnerNameMax));
    }
  }, [user?.displayName, partnerAName]);

  useEffect(() => {
    if (!user || !initialInviteCode) return;
    let active = true;
    lookupInvite(initialInviteCode)
      .then((inv) => {
        if (active && inv) {
          setInvitePreview(inv);
          setMode('join');
        }
      })
      .catch(() => {
        // Ignore preview error
      });
    return () => {
      active = false;
    };
  }, [user, initialInviteCode]);

  const handleGoogleSignIn = async () => {
    setErrorMsg('');
    setAuthLoading(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      if (!message.includes('popup-closed-by-user')) {
        setErrorMsg('Accesso non riuscito. Riprova tra un istante.');
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleCreateVault = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setErrorMsg('');

    const parsedTarget = Number(targetAmount.replace(',', '.'));
    if (!Number.isFinite(parsedTarget) || parsedTarget <= 0) {
      setErrorMsg('Inserisci un importo obiettivo maggiore di 0 €.');
      return;
    }

    setLoading(true);
    try {
      const vaultId = await createVaultAndInvite(user.uid, {
        title,
        destination,
        targetAmount: parsedTarget,
        partnerAName,
        partnerBName,
      });
      onVaultReady(vaultId);
    } catch {
      setErrorMsg('Impossibile creare il salvadanaio. Riprova.');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinVault = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setErrorMsg('');
    if (inviteCode.trim().length < 8) {
      setErrorMsg('Inserisci il codice invito ricevuto dal tuo partner.');
      return;
    }

    setLoading(true);
    try {
      const res = await joinVaultWithCode(user.uid, inviteCode);
      if (res.ok) {
        onVaultReady(res.vaultId);
      } else {
        setErrorMsg(res.reason);
      }
    } catch {
      setErrorMsg('Errore durante l’accesso al salvadanaio.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-[100dvh] w-full overflow-y-auto overscroll-none bg-[#FAF6F0] text-[#122638] flex flex-col justify-start lg:justify-center px-4 py-6 sm:px-6">
      <div className="mx-auto w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-stretch my-auto">
        {/* Left Atmospheric Deep-Ocean Sunset Showcase Card */}
        <div className="lg:col-span-6 relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#122638] via-[#17425D] to-[#1A6B8A] p-7 sm:p-10 text-[#FAF6F0] flex flex-col justify-between gap-8 shadow-lg shadow-[#122638]/10">
          {/* Atmospheric Sunset Coral & Gold Glow Orbs */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-20 -right-20 w-72 h-72 rounded-full bg-[#E86A52]/25 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-24 -left-16 w-72 h-72 rounded-full bg-[#E09F3E]/20 blur-3xl"
          />

          <div className="relative z-10 space-y-5">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-2 text-xs font-semibold tracking-wide text-[#F7C76E]">
                <Compass className="w-4 h-4" />
                Salvadanaio condiviso di coppia
              </span>
              <span className="text-xs text-[#FAF6F0]/60 font-medium">Africa</span>
            </div>

            <h1 className="font-display text-4xl sm:text-5xl font-semibold tracking-tight text-white">
              SALVAFRICA
            </h1>

            <p className="text-sm sm:text-base text-[#FAF6F0]/80 leading-relaxed max-w-md">
              Un unico conto viaggio per due, alimentato esclusivamente da entrate extra esterne:
              vendite dell’usato, lavoretti, cashback, monetine trovate e sfide di coppia. Zero
              stipendio, zero risparmi.
            </p>
          </div>

          {/* Sculpted Minimal Travel Pass Rule Card */}
          <div className="relative z-10 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 p-5 space-y-4">
            <div className="flex items-center justify-between text-xs text-[#FAF6F0]/75">
              <span className="font-semibold text-white">Regola del salvadanaio</span>
              <span className="text-[#F7C76E] font-medium">Obiettivo a completamento</span>
            </div>
            <p className="font-display text-lg font-medium text-white leading-snug">
              “Nessun euro può arrivare da stipendio o risparmi esistenti: conta solo ciò che
              conquistiamo fuori con creatività.”
            </p>
            <div className="grid grid-cols-3 gap-3 pt-3 border-t border-white/15 text-xs text-[#FAF6F0]/75">
              <div>
                <p className="font-semibold text-white">Solo voi due</p>
                <p className="mt-0.5">Sync in tempo reale</p>
              </div>
              <div>
                <p className="font-semibold text-white">Zero scadenze</p>
                <p className="mt-0.5">Si parte al 100%</p>
              </div>
              <div>
                <p className="font-semibold text-white">Solo extra</p>
                <p className="mt-0.5">Vendite e sfide</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Clean Fintech Auth / Setup Card */}
        <div className="lg:col-span-6 rounded-[28px] bg-white border border-[#E6DDD1] p-7 sm:p-9 shadow-xs flex flex-col justify-center">
          {!user ? (
            <div className="space-y-6">
              <div>
                <p className="text-xs font-semibold text-[#E86A52]">Primo accesso rapido</p>
                <h2 className="font-display text-2xl sm:text-3xl font-semibold text-[#122638] mt-1">
                  {initialInviteCode ? 'Sei stato invitato su SALVAFRICA' : 'Entrate con un tap'}
                </h2>
                <p className="mt-2 text-sm text-[#5B6B79] leading-relaxed">
                  Accedi una sola volta con Google per mantenere privato il salvadanaio e
                  sincronizzato su entrambi i telefoni. La sessione resta attiva automaticamente.
                </p>
              </div>

              {initialInviteCode && (
                <div className="rounded-2xl bg-[#F2ECE3] p-4 text-sm text-[#122638]">
                  <span className="font-semibold">Codice invito rilevato:</span>{' '}
                  <span className="font-mono tracking-wider">{initialInviteCode}</span>
                </div>
              )}

              {errorMsg && (
                <div className="rounded-xl bg-[#E86A52]/10 border border-[#E86A52]/30 px-4 py-3 text-sm text-[#D1533C]">
                  {errorMsg}
                </div>
              )}

              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={authLoading}
                className="w-full min-h-[50px] rounded-2xl bg-[#122638] px-5 py-3 text-sm font-semibold text-white hover:bg-[#1C3952] active:scale-[0.99] transition-all flex items-center justify-center gap-3 disabled:opacity-60 shadow-sm"
              >
                <Sparkles className="w-4 h-4 text-[#F7C76E]" />
                <span>{authLoading ? 'Accesso in corso...' : 'Continua con Google'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center justify-between gap-4 pb-4 border-b border-[#E6DDD1]">
                <div className="min-w-0">
                  <p className="text-xs text-[#5B6B79] truncate">Connesso come</p>
                  <p className="text-sm font-semibold text-[#122638] truncate">
                    {user.displayName || user.email}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => signOutUser()}
                  className="min-h-[44px] px-3 rounded-xl text-xs font-medium text-[#5B6B79] hover:text-[#122638] hover:bg-[#F2ECE3] transition-colors inline-flex items-center gap-1.5 shrink-0"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Cambia account
                </button>
              </div>

              <div className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-[#F2ECE3]">
                <button
                  type="button"
                  onClick={() => {
                    setMode('create');
                    setErrorMsg('');
                  }}
                  className={`min-h-[44px] rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                    mode === 'create'
                      ? 'bg-white text-[#122638] shadow-xs'
                      : 'text-[#5B6B79] hover:text-[#122638]'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  Avvia SALVAFRICA
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('join');
                    setErrorMsg('');
                  }}
                  className={`min-h-[44px] rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                    mode === 'join'
                      ? 'bg-white text-[#122638] shadow-xs'
                      : 'text-[#5B6B79] hover:text-[#122638]'
                  }`}
                >
                  <KeyRound className="w-4 h-4" />
                  Ho un invito
                </button>
              </div>

              {errorMsg && (
                <div className="rounded-xl bg-[#E86A52]/10 border border-[#E86A52]/30 px-4 py-3 text-sm text-[#D1533C]">
                  {errorMsg}
                </div>
              )}

              {mode === 'create' ? (
                <form onSubmit={handleCreateVault} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-[#5B6B79] mb-1.5">
                        Titolo salvadanaio
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={APP_LIMITS.titleMax}
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full min-h-[44px] rounded-xl border border-[#E6DDD1] bg-[#FAF6F0] px-3.5 text-sm text-[#122638] focus:outline-none focus:border-[#1A6B8A]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#5B6B79] mb-1.5">
                        Tappa / Paese in Africa
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={APP_LIMITS.destinationMax}
                        value={destination}
                        onChange={(e) => setDestination(e.target.value)}
                        placeholder="Es. Tanzania, Zanzibar, Marocco..."
                        className="w-full min-h-[44px] rounded-xl border border-[#E6DDD1] bg-[#FAF6F0] px-3.5 text-sm text-[#122638] focus:outline-none focus:border-[#1A6B8A]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#5B6B79] mb-1.5">
                      Obiettivo fisso a completamento (€)
                    </label>
                    <input
                      type="number"
                      required
                      min={1}
                      max={1000000}
                      step="1"
                      value={targetAmount}
                      onChange={(e) => setTargetAmount(e.target.value)}
                      className="w-full min-h-[44px] rounded-xl border border-[#E6DDD1] bg-[#FAF6F0] px-3.5 text-base font-semibold tabular-nums text-[#122638] focus:outline-none focus:border-[#1A6B8A]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-[#5B6B79] mb-1.5">
                        Nome Partner 1
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={APP_LIMITS.partnerNameMax}
                        value={partnerAName}
                        onChange={(e) => setPartnerAName(e.target.value)}
                        className="w-full min-h-[44px] rounded-xl border border-[#E6DDD1] bg-[#FAF6F0] px-3.5 text-sm text-[#122638] focus:outline-none focus:border-[#E86A52]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#5B6B79] mb-1.5">
                        Nome Partner 2
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={APP_LIMITS.partnerNameMax}
                        value={partnerBName}
                        onChange={(e) => setPartnerBName(e.target.value)}
                        className="w-full min-h-[44px] rounded-xl border border-[#E6DDD1] bg-[#FAF6F0] px-3.5 text-sm text-[#122638] focus:outline-none focus:border-[#1A6B8A]"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full min-h-[50px] rounded-2xl bg-[#E86A52] px-5 py-3 text-sm font-semibold text-white hover:bg-[#D1533C] active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-60 shadow-sm"
                  >
                    <span>{loading ? 'Creazione in corso...' : 'Crea il salvadanaio per l’Africa'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              ) : (
                <form onSubmit={handleJoinVault} className="space-y-4">
                  {invitePreview && (
                    <div className="rounded-2xl bg-[#F2ECE3] p-4 space-y-1">
                      <p className="text-xs font-semibold text-[#1A6B8A]">Invito trovato</p>
                      <p className="font-display text-lg font-semibold text-[#122638]">
                        {invitePreview.vaultTitle} · {invitePreview.destination}
                      </p>
                      <p className="text-xs text-[#5B6B79]">
                        Per {invitePreview.partnerAName} & {invitePreview.partnerBName}
                      </p>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-[#5B6B79] mb-1.5">
                      Codice invito di coppia
                    </label>
                    <input
                      type="text"
                      required
                      value={inviteCode}
                      onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                      placeholder="Es. MC7K9P2X8W4Q"
                      className="w-full min-h-[48px] rounded-xl border border-[#E6DDD1] bg-[#FAF6F0] px-4 font-mono text-base tracking-widest uppercase text-[#122638] focus:outline-none focus:border-[#1A6B8A]"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full min-h-[50px] rounded-2xl bg-[#1A6B8A] px-5 py-3 text-sm font-semibold text-white hover:bg-[#14556F] active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-60 shadow-sm"
                  >
                    <span>{loading ? 'Collegamento in corso...' : 'Unisciti al salvadanaio'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
