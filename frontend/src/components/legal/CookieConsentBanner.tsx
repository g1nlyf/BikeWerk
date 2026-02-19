import * as React from 'react';
import { Check } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import {
  LEGAL_ROUTES,
  acceptAllCookies,
  acceptOnlyNecessaryCookies,
  getCookieConsent,
  setCookieConsent,
  subscribeCookieConsent,
  subscribeCookieSettingsOpen,
} from '@/lib/legal';

export function CookieConsentBanner() {
  const [consent, setConsentState] = React.useState(() => getCookieConsent());
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [bannerVisible, setBannerVisible] = React.useState(false);
  const [analytics, setAnalytics] = React.useState<boolean>(Boolean(consent?.analytics));
  const [marketing, setMarketing] = React.useState<boolean>(Boolean(consent?.marketing));

  React.useEffect(() => {
    const unsubscribe = subscribeCookieConsent((next) => {
      setConsentState(next);
      setAnalytics(Boolean(next.analytics));
      setMarketing(Boolean(next.marketing));
    });

    const unsubscribeOpen = subscribeCookieSettingsOpen(() => {
      const current = getCookieConsent();
      setAnalytics(Boolean(current?.analytics));
      setMarketing(Boolean(current?.marketing));
      setDialogOpen(true);
    });

    return () => {
      unsubscribe();
      unsubscribeOpen();
    };
  }, []);

  const hasDecision = Boolean(consent);

  React.useEffect(() => {
    if (hasDecision) {
      setBannerVisible(false);
      return;
    }
    const frame = window.requestAnimationFrame(() => setBannerVisible(true));
    return () => window.cancelAnimationFrame(frame);
  }, [hasDecision]);

  const handleAcceptAll = () => {
    const next = acceptAllCookies();
    setConsentState(next);
  };

  const handleAcceptNecessaryOnly = () => {
    const next = acceptOnlyNecessaryCookies();
    setConsentState(next);
  };

  const handleSaveSettings = () => {
    const next = setCookieConsent({ analytics, marketing });
    setConsentState(next);
    setDialogOpen(false);
  };

  return (
    <>
      {!hasDecision ? (
        <div
          className={cn(
            'fixed inset-x-0 bottom-0 z-[90] transition-all duration-300 ease-out',
            bannerVisible ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'
          )}
        >
          <div className="w-full border-t border-zinc-200 bg-white/95 px-3 pb-[calc(env(safe-area-inset-bottom)+10px)] pt-3 shadow-[0_-10px_36px_rgba(0,0,0,0.14)] backdrop-blur md:mx-auto md:mb-4 md:max-w-6xl md:rounded-2xl md:border md:px-5 md:py-4 md:shadow-[0_24px_80px_rgba(0,0,0,0.18)]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-zinc-900">Cookie-файлы</div>
                <div className="mt-1 text-xs leading-relaxed text-zinc-600 md:text-sm md:text-zinc-700">
                  Используем cookie для работы сайта, аналитики и маркетинга.{' '}
                  <Link to={LEGAL_ROUTES.cookies} className="underline underline-offset-2">
                    Подробнее
                  </Link>
                  .
                </div>
              </div>
              <button
                type="button"
                className="hidden text-xs text-zinc-500 underline underline-offset-2 hover:text-zinc-700 md:inline-flex"
                onClick={() => setDialogOpen(true)}
              >
                Настроить
              </button>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <Button
                className="h-11 flex-1 rounded-full bg-zinc-900 px-4 text-sm font-semibold text-white shadow-sm hover:bg-black"
                onClick={handleAcceptAll}
              >
                <Check className="mr-1.5 h-4 w-4" />
                Принять все
              </Button>
              <Button
                variant="outline"
                className="h-11 rounded-full border-zinc-300 bg-zinc-100 px-3 text-xs font-medium text-zinc-600 hover:bg-zinc-200 hover:text-zinc-700 md:bg-white md:px-5 md:text-sm"
                onClick={handleAcceptNecessaryOnly}
              >
                Только необходимые
              </Button>
            </div>

            <div className="mt-2 md:hidden">
              <button
                type="button"
                className="text-xs text-zinc-500 underline underline-offset-2 hover:text-zinc-700"
                onClick={() => setDialogOpen(true)}
              >
                Настроить выбор
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle>Настройки cookie</DialogTitle>
            <DialogDescription>
              Управляйте категориями cookie. Необходимые cookie отключить нельзя.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 text-sm text-zinc-700">
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
              <div className="font-medium text-zinc-900">Необходимые</div>
              <div className="mt-1 text-xs text-zinc-600">Обеспечивают работу сайта, авторизацию и оформление заказов.</div>
            </div>

            <div className="rounded-xl border border-zinc-200 p-3">
              <label className="flex cursor-pointer items-start gap-3">
                <Checkbox checked={analytics} onCheckedChange={(value) => setAnalytics(value === true)} className="mt-0.5" />
                <span>
                  <span className="block font-medium text-zinc-900">Аналитика</span>
                  <span className="block text-xs text-zinc-600">Помогает измерять производительность и улучшать сервис.</span>
                </span>
              </label>
            </div>

            <div className="rounded-xl border border-zinc-200 p-3">
              <label className="flex cursor-pointer items-start gap-3">
                <Checkbox checked={marketing} onCheckedChange={(value) => setMarketing(value === true)} className="mt-0.5" />
                <span>
                  <span className="block font-medium text-zinc-900">Маркетинг</span>
                  <span className="block text-xs text-zinc-600">Позволяет показывать релевантные предложения и оценивать каналы привлечения.</span>
                </span>
              </label>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={handleAcceptNecessaryOnly}>Только необходимые</Button>
            <Button onClick={handleSaveSettings}>Сохранить выбор</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
