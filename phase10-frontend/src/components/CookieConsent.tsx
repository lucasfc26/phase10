import { useState } from 'react';
import { Cookie } from 'lucide-react';
import { useI18n } from '../lib/i18n';
import { getCookiesAccepted, setCookiesAccepted } from '../lib/settings';

type CookieConsentProps = {
  onLearnMore: () => void;
};

export function CookieConsent({ onLearnMore }: CookieConsentProps) {
  const { t } = useI18n();
  const [visible, setVisible] = useState(() => !getCookiesAccepted());

  if (!visible) return null;

  const accept = () => {
    setCookiesAccepted();
    setVisible(false);
  };

  return (
    <div className="fixed bottom-0 inset-x-0 z-40 p-4 pointer-events-none">
      <div className="max-w-3xl mx-auto pointer-events-auto bg-surface border border-default rounded-xl shadow-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <Cookie className="w-5 h-5 text-accent shrink-0 mt-0.5" />
          <p className="text-xs text-secondary leading-relaxed">{t.cookies.message}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
          <button
            type="button"
            onClick={onLearnMore}
            className="flex-1 sm:flex-initial px-3 py-2 text-xs font-medium text-muted hover:text-secondary border border-default rounded-lg hover:bg-surface-muted transition-colors"
          >
            {t.cookies.learnMore}
          </button>
          <button
            type="button"
            onClick={accept}
            className="flex-1 sm:flex-initial px-4 py-2 text-xs font-semibold btn-primary rounded-lg"
          >
            {t.cookies.accept}
          </button>
        </div>
      </div>
    </div>
  );
}
