import { X, FileText } from 'lucide-react';
import { useI18n } from '../lib/i18n';
import type { LegalPageContent } from '../lib/i18n/types';

export type LegalPageType = 'terms' | 'privacy' | 'support';

type LegalPageModalProps = {
  page: LegalPageType | null;
  onClose: () => void;
};

export function LegalPageModal({ page, onClose }: LegalPageModalProps) {
  const { t } = useI18n();

  if (!page) {
    return null;
  }

  const content: LegalPageContent = t.legal[page];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay backdrop-blur-sm p-4">
      <div className="relative w-full max-w-2xl max-h-[85vh] bg-surface border border-default rounded-xl flex flex-col shadow-2xl text-primary overflow-hidden">
        <div className="p-5 border-b border-default flex justify-between items-center bg-app shrink-0">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-accent" />
            <h2 className="text-lg font-semibold text-primary">{content.title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 hover:bg-surface-raised rounded-lg text-muted hover:text-secondary"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-sm text-secondary leading-relaxed">
          {content.sections.map((section) => (
            <section key={section.title} className="space-y-2">
              <h3 className="text-base font-semibold text-accent">{section.title}</h3>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </section>
          ))}
        </div>

        <div className="p-4 border-t border-default bg-app flex justify-end shrink-0">
          <button type="button" onClick={onClose} className="px-5 py-2 btn-primary text-sm font-medium">
            {t.legal.close}
          </button>
        </div>
      </div>
    </div>
  );
}
