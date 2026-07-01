import React, { useCallback, useEffect, useRef, useState } from 'react';
import { LogOut, Spade } from 'lucide-react';
import { PlayerAvatar } from '../../components/PlayerAvatar';
import { SuitCard } from '../shared/SuitCard';
import type { GameBoardProps } from '../types';
import type { RoomSession } from '../../services/onlineApi';
import {
  connectOnlineSocket,
  emitGameAction,
  getRoomDeletedMessage,
} from '../../services/onlineSocket';
import {
  autoAdvanceStreet,
  botPokerAction,
  canAutoAdvanceStreet,
  dismissPokerRoundSummary,
  getHumanPlayerIndex,
  pokerAllIn,
  pokerCall,
  pokerCheck,
  pokerFold,
  pokerRaise,
  visibleCommunityCount,
} from './engine';
import { POKER_SUIT_SYMBOL, type PokerRoom } from './types';

type PokerBoardProps = GameBoardProps<PokerRoom> & {
  onlineSession?: RoomSession | null;
};

function getMyPlayerIndex(
  room: PokerRoom,
  isOnline: boolean,
  memberId?: string,
  name?: string,
): number {
  if (isOnline && memberId) {
    const idx = room.players.findIndex((p) => p.id === memberId);
    return idx >= 0 ? idx : 0;
  }
  return getHumanPlayerIndex(room, name ?? '');
}

export const PokerBoard: React.FC<PokerBoardProps> = ({
  initialRoom,
  playerProfile,
  onlineSession,
  onExit,
}) => {
  const isOnline = !!onlineSession;
  const [room, setRoom] = useState<PokerRoom>(initialRoom);
  const [isActionPending, setIsActionPending] = useState(false);
  const lastStateVersionRef = useRef(initialRoom.stateVersion ?? 0);
  const pendingActionRef = useRef(false);

  const humanIndex = getMyPlayerIndex(
    room,
    isOnline,
    onlineSession?.memberId,
    playerProfile.name,
  );
  const isMyTurn = room.currentPlayerIndex === humanIndex && !room.roundSummary;
  const human = room.players[humanIndex];
  const toCall = room.currentBet - (human?.currentBet ?? 0);

  useEffect(() => {
    if (!isOnline || !onlineSession) return;
    connectOnlineSocket(onlineSession.sessionToken, {
      onGameState: (state) => {
        const next = state as PokerRoom;
        const version = next.stateVersion ?? 0;
        if (version < lastStateVersionRef.current) return;
        lastStateVersionRef.current = version;
        setRoom(next);
      },
      onRoomDeleted: () => {
        alert(getRoomDeletedMessage('inactive'));
        onExit();
      },
    });
  }, [isOnline, onlineSession?.sessionToken, onExit]);

  const sendOnlineAction = (action: Record<string, unknown>) => {
    if (pendingActionRef.current) return;
    pendingActionRef.current = true;
    setIsActionPending(true);
    emitGameAction(
      { ...action, expectedStateVersion: lastStateVersionRef.current },
      (result) => {
        pendingActionRef.current = false;
        setIsActionPending(false);
        if (result?.error) {
          alert(result.error);
          return;
        }
        if (result?.room) {
          const next = result.room as PokerRoom;
          lastStateVersionRef.current = next.stateVersion ?? lastStateVersionRef.current;
          setRoom(next);
        }
      },
    );
  };

  const runBots = useCallback(() => {
    if (isOnline) return;
    setRoom((current) => {
      let next = current;
      if (next.roundSummary) return next;

      const turnPlayer = next.players[next.currentPlayerIndex];
      if (!turnPlayer?.isBot) return next;

      const action = botPokerAction(next, next.currentPlayerIndex);
      switch (action) {
        case 'fold':
          next = pokerFold(next, next.currentPlayerIndex);
          break;
        case 'check':
          next = pokerCheck(next, next.currentPlayerIndex);
          break;
        case 'call':
          next = pokerCall(next, next.currentPlayerIndex);
          break;
        case 'raise':
          next = pokerRaise(next, next.currentPlayerIndex, next.currentBet + next.minRaise);
          break;
        case 'all_in':
          next = pokerAllIn(next, next.currentPlayerIndex);
          break;
      }
      return next;
    });
  }, [isOnline]);

  useEffect(() => {
    if (isOnline) return;
    const timer = setTimeout(runBots, room.settings.botDelay);
    return () => clearTimeout(timer);
  }, [room, runBots, isOnline]);

  useEffect(() => {
    if (isOnline || !canAutoAdvanceStreet(room)) return;
    const timer = setTimeout(() => {
      setRoom((r) => autoAdvanceStreet(r));
    }, 900);
    return () => clearTimeout(timer);
  }, [room.street, room.communityCards.length, room.roundSummary, isOnline]);

  const communityVisible = room.communityCards.slice(
    0,
    visibleCommunityCount(room.street),
  );

  const streetLabel: Record<PokerRoom['street'], string> = {
    preflop: 'Pré-flop',
    flop: 'Flop',
    turn: 'Turn',
    river: 'River',
    showdown: 'Showdown',
  };

  const act = (type: string, extra?: Record<string, unknown>) => {
    if (isOnline) {
      sendOnlineAction({ type, ...extra });
      return;
    }
    setRoom((r) => {
      switch (type) {
        case 'fold':
          return pokerFold(r, humanIndex);
        case 'check':
          return pokerCheck(r, humanIndex);
        case 'call':
          return pokerCall(r, humanIndex);
        case 'raise':
          return pokerRaise(r, humanIndex, (extra?.raiseTotal as number) ?? r.currentBet + r.minRaise);
        case 'all_in':
          return pokerAllIn(r, humanIndex);
        default:
          return r;
      }
    });
  };

  const handleNextRound = () => {
    if (isOnline) {
      if (!onlineSession?.isHost) return;
      sendOnlineAction({ type: 'next_round' });
      return;
    }
    setRoom((r) => dismissPokerRoundSummary(r));
  };

  return (
    <div className="max-w-5xl mx-auto px-4 pb-8">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Spade className="w-5 h-5 text-accent" />
          <h1 className="text-lg font-bold text-secondary">Texas Hold'em</h1>
          <span className="text-xs text-muted">Sala {room.code}</span>
        </div>
        <button type="button" onClick={onExit} className="btn-secondary text-xs flex items-center gap-1 px-3 py-1.5">
          <LogOut className="w-3.5 h-3.5" /> Sair
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
        {room.players.map((p, idx) => (
          <div
            key={p.id}
            className={`panel p-2 ${room.currentPlayerIndex === idx ? 'ring-2 ring-success' : ''} ${
              p.folded ? 'opacity-50' : ''
            }`}
            style={{ borderLeft: `3px solid ${p.color ?? '#60a5fa'}` }}
          >
            <div className="flex items-center gap-2">
              <PlayerAvatar avatar={p.avatar} color={p.color} size={28} isBot={p.isBot} />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold truncate">{p.name}</div>
                <div className="text-[10px] text-muted">{p.chips} fichas</div>
              </div>
            </div>
            {p.currentBet > 0 && (
              <div className="text-[9px] text-accent mt-1">Aposta: {p.currentBet}</div>
            )}
          </div>
        ))}
      </div>

      <div className="panel p-4 mb-4 text-center">
        <div className="flex justify-center gap-4 mb-3 text-sm">
          <span className="font-bold text-accent">Pote: {room.pot}</span>
          <span className="text-muted">{streetLabel[room.street]}</span>
          <span className="text-muted">Aposta atual: {room.currentBet}</span>
        </div>
        <div className="flex justify-center gap-2 flex-wrap mb-2">
          {communityVisible.map((card) => (
            <SuitCard
              key={card.id}
              rank={card.rank}
              suit={POKER_SUIT_SYMBOL[card.suit]}
              className="pointer-events-none"
            />
          ))}
          {communityVisible.length === 0 && (
            <p className="text-sm text-muted">Cartas comunitárias ainda não reveladas.</p>
          )}
        </div>
      </div>

      {human && !human.folded && (
        <div className="panel p-4 mb-4">
          <div className="text-xs font-bold uppercase text-muted mb-3">Suas cartas</div>
          <div className="flex gap-2 justify-center">
            {human.holeCards.map((card) => (
              <SuitCard
                key={card.id}
                rank={card.rank}
                suit={POKER_SUIT_SYMBOL[card.suit]}
                className="pointer-events-none"
              />
            ))}
          </div>
          {isMyTurn && (
            <div className="flex flex-wrap gap-2 justify-center mt-4">
              <button
                type="button"
                className="btn-secondary text-xs px-3 py-2"
                disabled={isActionPending}
                onClick={() => act('fold')}
              >
                Desistir
              </button>
              {toCall === 0 ? (
                <button
                  type="button"
                  className="btn-primary text-xs px-3 py-2"
                  disabled={isActionPending}
                  onClick={() => act('check')}
                >
                  Passar
                </button>
              ) : (
                <button
                  type="button"
                  className="btn-primary text-xs px-3 py-2"
                  disabled={isActionPending}
                  onClick={() => act('call')}
                >
                  Pagar {toCall}
                </button>
              )}
              <button
                type="button"
                className="btn-secondary text-xs px-3 py-2"
                disabled={isActionPending}
                onClick={() =>
                  act('raise', { raiseTotal: room.currentBet + room.minRaise })
                }
              >
                Aumentar
              </button>
              <button
                type="button"
                className="btn-secondary text-xs px-3 py-2"
                disabled={isActionPending}
                onClick={() => act('all_in')}
              >
                All-in
              </button>
            </div>
          )}
        </div>
      )}

      {room.roundSummary && (
        <div className="panel p-4 mb-4 text-center">
          <p className="text-sm font-semibold mb-3">{room.roundSummary}</p>
          {room.showdown.length > 0 && (
            <div className="text-xs text-muted mb-3 space-y-1">
              {room.showdown.map((s) => (
                <p key={s.playerIndex}>
                  {room.players[s.playerIndex].name}: {s.handName}
                </p>
              ))}
            </div>
          )}
          {room.status !== 'game_over' ? (
            <button
              type="button"
              className="btn-primary"
              onClick={handleNextRound}
              disabled={isOnline && !onlineSession?.isHost}
            >
              {isOnline && !onlineSession?.isHost ? 'Aguardando host' : 'Próxima mão'}
            </button>
          ) : (
            <button type="button" className="btn-primary" onClick={onExit}>Voltar ao menu</button>
          )}
        </div>
      )}

      <div className="panel p-3 max-h-32 overflow-y-auto">
        {room.log.map((entry, i) => (
          <p key={i} className="text-[11px] text-muted border-b border-default/50 py-1 last:border-0">
            {entry}
          </p>
        ))}
      </div>
    </div>
  );
};
