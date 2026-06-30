import { useI18n, type LegalPageType } from '../lib/i18n';

type AppFooterProps = {
  onOpenLegal: (page: LegalPageType) => void;
  className?: string;
};

export function AppFooter({ onOpenLegal, className = '' }: AppFooterProps) {
  const { t } = useI18n();

  const links: { page: LegalPageType; label: string }[] = [
    { page: 'terms', label: t.footer.terms },
    { page: 'privacy', label: t.footer.privacy },
    { page: 'support', label: t.footer.support },
  ];

  return (
    <footer className={`text-center space-y-3 ${className}`}>
      <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs">
        {links.map(({ page, label }) => (
          <button
            key={page}
            type="button"
            onClick={() => onOpenLegal(page)}
            className="text-muted hover:text-accent underline-offset-2 hover:underline transition-colors"
          >
            {label}
          </button>
        ))}
      </nav>
      <p className="text-[11px] text-muted">{t.footer.copyright}</p>
    </footer>
  );
}
