import * as React from 'react';
import { Link } from 'react-router-dom';

import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import {
  LEGAL_DOCS_EFFECTIVE_DATE,
  LEGAL_DOCS_VERSION,
  LEGAL_ROUTES,
  type FormLegalConsent,
} from '@/lib/legal';

type LegalConsentFieldsProps = {
  value: FormLegalConsent;
  onChange: (next: FormLegalConsent) => void;
  className?: string;
  showMarketing?: boolean;
  compact?: boolean;
};

export function LegalConsentFields({
  value,
  onChange,
  className,
  showMarketing = true,
  compact = false,
}: LegalConsentFieldsProps) {
  const uid = React.useId();

  const setConsent = (key: keyof FormLegalConsent, checked: boolean | 'indeterminate') => {
    onChange({ ...value, [key]: checked === true });
  };

  return (
    <div
      className={cn(
        'rounded-xl border border-zinc-200 bg-zinc-50/80 p-3 text-xs leading-relaxed text-zinc-700',
        compact ? 'space-y-2' : 'space-y-3',
        className,
      )}
    >
      <div className="flex items-start gap-2">
        <Checkbox
          id={`${uid}-terms`}
          checked={value.termsAccepted}
          onCheckedChange={(checked) => setConsent('termsAccepted', checked)}
          className="mt-0.5"
        />
        <Label htmlFor={`${uid}-terms`} className="font-normal leading-relaxed text-zinc-700">
          Я принимаю
          {' '}
          <Link to={LEGAL_ROUTES.terms} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
            условия оферты
          </Link>
          {' '}
          и
          {' '}
          <Link to={LEGAL_ROUTES.privacy} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
            политику конфиденциальности
          </Link>
          {' '}
          (акцепт оферты и заключение договора в электронной форме) и прошу начать оказание услуг после акцепта.
        </Label>
      </div>

      <div className="flex items-start gap-2">
        <Checkbox
          id={`${uid}-pd`}
          checked={value.personalDataAccepted}
          onCheckedChange={(checked) => setConsent('personalDataAccepted', checked)}
          className="mt-0.5"
        />
        <Label htmlFor={`${uid}-pd`} className="font-normal leading-relaxed text-zinc-700">
          Даю
          {' '}
          <Link to={LEGAL_ROUTES.consent} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
            согласие на обработку персональных данных
          </Link>
          {' '}
          в целях оформления заявки и исполнения договора.
        </Label>
      </div>

      {showMarketing ? (
        <div className="flex items-start gap-2">
          <Checkbox
            id={`${uid}-marketing`}
            checked={value.marketingAccepted}
            onCheckedChange={(checked) => setConsent('marketingAccepted', checked)}
            className="mt-0.5"
          />
          <Label htmlFor={`${uid}-marketing`} className="font-normal leading-relaxed text-zinc-700">
            Согласен получать маркетинговые сообщения (email, Telegram, мессенджеры). Необязательно.
          </Label>
        </div>
      ) : null}

      <div className="text-[11px] text-zinc-500">
        Версия документов: {LEGAL_DOCS_VERSION}. Действует с {LEGAL_DOCS_EFFECTIVE_DATE}.
      </div>
    </div>
  );
}
