import { Play, User, BookOpen, Settings } from 'lucide-react';
import { useI18n, type LegalPageType } from '../lib/i18n';
import { PlayerAvatar } from './PlayerAvatar';
import { AppFooter } from './AppFooter';
import type { SavedPlayerProfile } from '../lib/playerProfile';

type HomeScreenProps = {
  profile: SavedPlayerProfile;
  onStart: () => void;
  onCustomize: () => void;
  onRules: () => void;
  onSettings: () => void;
  onOpenLegal: (page: LegalPageType) => void;
};

export function HomeScreen({
  profile,
  onStart,
  onCustomize,
  onRules,
  onSettings,
  onOpenLegal,
}: HomeScreenProps) {
  const { t } = useI18n();

  const secondaryButtons = [
    { icon: User, label: t.home.customize, onClick: onCustomize },
    { icon: BookOpen, label: t.home.rules, onClick: onRules },
    { icon: Settings, label: t.home.settings, onClick: onSettings },
  ];

  return (
    <div className="home-screen flex-1 flex flex-col">
      <div className="home-screen__banner" aria-hidden />
      <div className="home-screen__overlay" aria-hidden />

      <div className="relative z-10 flex-1 flex flex-col items-center justify-end px-4 pt-[min(42vh,22rem)] pb-28">
        <div className="w-full max-w-md home-screen__panel p-6 space-y-5 text-center">
          <p className="text-sm text-secondary max-w-sm mx-auto leading-relaxed">
            {t.home.subtitle}
          </p>

          <div className="space-y-3">
            <div className="flex flex-col items-center gap-3 pb-1">
              <div
                className="rounded-full p-1 shadow-lg"
                style={{ backgroundColor: profile.color }}
              >
                <div className="rounded-full bg-surface p-0.5">
                  <PlayerAvatar
                    avatar={profile.avatar}
                    color={profile.color}
                    size={88}
                    className="border-2 border-default/30"
                  />
                </div>
              </div>
              <span className="text-sm font-semibold text-secondary truncate max-w-[220px]">
                {profile.name}
              </span>
              <button
                type="button"
                onClick={onStart}
                className="w-full py-3.5 px-6 rounded-xl text-sm font-semibold flex items-center justify-center gap-2.5 transition-all active:scale-[0.98] btn-primary shadow-lg"
              >
                <Play className="w-5 h-5 shrink-0" />
                <span>{t.home.start}</span>
              </button>
            </div>

            {secondaryButtons.map(({ icon: Icon, label, onClick }) => (
              <button
                key={label}
                type="button"
                onClick={onClick}
                className="w-full py-3.5 px-6 rounded-xl text-sm font-semibold flex items-center justify-center gap-2.5 transition-all active:scale-[0.98] bg-surface-muted border border-default text-secondary hover:bg-surface-raised hover:text-primary"
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>

        <AppFooter onOpenLegal={onOpenLegal} className="mt-8 px-2" />
      </div>
    </div>
  );
}
