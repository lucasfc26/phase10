import React, { useCallback, useEffect, useRef, useState } from "react";
import { LogOut, Swords } from "lucide-react";
import { PlayerAvatar } from "../../components/PlayerAvatar";
import { SuitCard } from "../shared/SuitCard";
import type { GameBoardProps } from "../types";
import type { RoomSession } from "../../services/onlineApi";
import {
  connectOnlineSocket,
  emitGameAction,
  getRoomDeletedMessage,
} from "../../services/onlineSocket";
import {
  acceptTrucoBid,
  botChooseTrucoCard,
  botShouldAcceptBid,
  botShouldCallTruco,
  callTruco,
  dismissTrucoRoundSummary,
  getHumanPlayerIndex,
  getTeam,
  playTrucoCard,
  refuseTrucoBid,
} from "./engine";
import { TRUCO_SUIT_SYMBOL, type TrucoRoom } from "./types";

type TrucoBoardProps = GameBoardProps<TrucoRoom> & {
  onlineSession?: RoomSession | null;
};

function getMyPlayerIndex(
  room: TrucoRoom,
  isOnline: boolean,
  memberId?: string,
  name?: string,
): number {
  if (isOnline && memberId) {
    const idx = room.players.findIndex((p) => p.id === memberId);
    return idx >= 0 ? idx : 0;
  }
  return getHumanPlayerIndex(room, name ?? "");
}

export const TrucoBoard: React.FC<TrucoBoardProps> = ({
  initialRoom,
  playerProfile,
  onlineSession,
  onExit,
}) => {
  const isOnline = !!onlineSession;
  const [room, setRoom] = useState<TrucoRoom>(initialRoom);
  const [isActionPending, setIsActionPending] = useState(false);
  const lastStateVersionRef = useRef(initialRoom.stateVersion ?? 0);
  const pendingActionRef = useRef(false);

  const humanIndex = getMyPlayerIndex(
    room,
    isOnline,
    onlineSession?.memberId,
    playerProfile.name,
  );
  const humanTeam = getTeam(humanIndex);
  const isMyTurn = room.currentTurnIndex === humanIndex;
  const mustRespondBid = room.awaitingResponseFromTeam === humanTeam;

  useEffect(() => {
    if (!isOnline || !onlineSession) return;
    connectOnlineSocket(onlineSession.sessionToken, {
      onGameState: (state) => {
        const next = state as TrucoRoom;
        const version = next.stateVersion ?? 0;
        if (version < lastStateVersionRef.current) return;
        lastStateVersionRef.current = version;
        setRoom(next);
      },
      onRoomDeleted: () => {
        alert(getRoomDeletedMessage("inactive"));
        onExit();
      },
    });
  }, [isOnline, onlineSession?.sessionToken, onExit]);

  const sendOnlineAction = (
    action: Record<string, unknown>,
    onSuccess?: () => void,
  ) => {
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
          const next = result.room as TrucoRoom;
          lastStateVersionRef.current = next.stateVersion ?? lastStateVersionRef.current;
          setRoom(next);
        }
        onSuccess?.();
      },
    );
  };

  const botLoop = useCallback(() => {
    if (isOnline) return;
    setRoom((current) => {
      let next = current;

      if (next.awaitingResponseFromTeam !== null) {
        const respondingTeam = next.awaitingResponseFromTeam;
        const hasHumanOnTeam = next.players.some(
          (p, i) => getTeam(i) === respondingTeam && !p.isBot,
        );
        if (!hasHumanOnTeam) {
          const accept = botShouldAcceptBid(next, respondingTeam);
          next = accept ? acceptTrucoBid(next) : refuseTrucoBid(next);
        }
        return next;
      }

      if (next.roundSummary) return next;

      const turnPlayer = next.players[next.currentTurnIndex];
      if (!turnPlayer?.isBot) return next;

      if (botShouldCallTruco(next, next.currentTurnIndex) && !next.pendingBid) {
        next = callTruco(next, next.currentTurnIndex);
        if (next.awaitingResponseFromTeam !== null) return next;
      }

      const cardId = botChooseTrucoCard(next, next.currentTurnIndex);
      if (cardId) {
        next = playTrucoCard(next, next.currentTurnIndex, cardId);
      }
      return next;
    });
  }, [isOnline]);

  useEffect(() => {
    if (isOnline) return;
    const timer = setTimeout(botLoop, room.settings.botDelay);
    return () => clearTimeout(timer);
  }, [room, botLoop, isOnline]);

  const handlePlay = (cardId: string) => {
    if (isOnline) {
      sendOnlineAction({ type: "play_card", cardId });
      return;
    }
    setRoom((r) => playTrucoCard(r, humanIndex, cardId));
  };

  const handleCallTruco = () => {
    if (isOnline) {
      sendOnlineAction({ type: "call_truco" });
      return;
    }
    setRoom((r) => callTruco(r, humanIndex));
  };

  const handleAccept = () => {
    if (isOnline) {
      sendOnlineAction({ type: "accept_truco" });
      return;
    }
    setRoom((r) => acceptTrucoBid(r));
  };

  const handleRefuse = () => {
    if (isOnline) {
      sendOnlineAction({ type: "refuse_truco" });
      return;
    }
    setRoom((r) => refuseTrucoBid(r));
  };

  const handleNextRound = () => {
    if (isOnline) {
      if (!onlineSession?.isHost) return;
      sendOnlineAction({ type: "next_round" });
      return;
    }
    setRoom((r) => dismissTrucoRoundSummary(r));
  };

  const human = room.players[humanIndex];

  return (
    <div className="max-w-5xl mx-auto px-4 pb-8">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Swords className="w-5 h-5 text-accent" />
          <h1 className="text-lg font-bold text-secondary">Truco</h1>
          <span className="text-xs text-muted">Sala {room.code}</span>
        </div>
        <button
          type="button"
          onClick={onExit}
          className="btn-secondary text-xs flex items-center gap-1 px-3 py-1.5"
        >
          <LogOut className="w-3.5 h-3.5" /> Sair
        </button>
      </div>

      {/* Scoreboard */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div
          className={`panel p-3 text-center ${humanTeam === 0 ? "ring-2 ring-accent" : ""}`}
        >
          <div className="text-[10px] uppercase font-bold text-muted">
            Time 1
          </div>
          <div className="text-3xl font-black text-primary">
            {room.teamScores[0]}
          </div>
          <div className="text-[10px] text-muted">meta: 12</div>
        </div>
        <div
          className={`panel p-3 text-center ${humanTeam === 1 ? "ring-2 ring-accent" : ""}`}
        >
          <div className="text-[10px] uppercase font-bold text-muted">
            Time 2
          </div>
          <div className="text-3xl font-black text-primary">
            {room.teamScores[1]}
          </div>
          <div className="text-[10px] text-muted">meta: 12</div>
        </div>
      </div>

      {/* Players */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
        {room.players.map((p, idx) => (
          <div
            key={p.id}
            className={`panel p-2 flex items-center gap-2 ${
              room.currentTurnIndex === idx ? "ring-2 ring-success" : ""
            }`}
            style={{ borderLeft: `3px solid ${p.color ?? "#60a5fa"}` }}
          >
            <PlayerAvatar
              avatar={p.avatar}
              color={p.color}
              size={32}
              isBot={p.isBot}
            />
            <div className="min-w-0">
              <div className="text-xs font-bold truncate">{p.name}</div>
              <div className="text-[9px] text-muted">
                Time {(idx % 2) + 1} · {p.cards.length} cartas
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="panel p-4 mb-4 min-h-[140px]">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-muted uppercase">
            Vaza {Math.min(room.trickNumber + 1, 3)}/3 · Vale{" "}
            {room.roundHandValue} ponto(s)
          </span>
          {room.vira && (
            <div className="flex items-center gap-2 text-xs text-muted">
              Vira:
              <SuitCard
                small
                rank={room.vira.rank}
                suit={TRUCO_SUIT_SYMBOL[room.vira.suit]}
                className="pointer-events-none"
              />
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-3 justify-center">
          {room.currentTrick.map((play) => (
            <div
              key={`${play.playerIndex}-${play.card.id}`}
              className="text-center"
            >
              <SuitCard
                small
                rank={play.card.rank}
                suit={TRUCO_SUIT_SYMBOL[play.card.suit]}
                className="pointer-events-none"
              />
              <div className="text-[9px] text-muted mt-1">
                {room.players[play.playerIndex].name}
              </div>
            </div>
          ))}
          {room.currentTrick.length === 0 && (
            <p className="text-sm text-muted">
              Mesa vazia — aguardando jogada.
            </p>
          )}
        </div>
      </div>

      {/* Bid response */}
      {mustRespondBid && room.pendingBid && (
        <div className="panel p-4 mb-4 border-accent bg-accent-soft/30">
          <p className="text-sm font-semibold mb-3">
            Oponente pediu{" "}
            {room.pendingBid === 3
              ? "Truco"
              : room.pendingBid === 6
                ? "Seis"
                : room.pendingBid === 9
                  ? "Nove"
                  : "Doze"}
            !
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn-primary flex-1"
              onClick={handleAccept}
            >
              Aceitar
            </button>
            <button
              type="button"
              className="btn-secondary flex-1"
              onClick={handleRefuse}
            >
              Correr
            </button>
          </div>
        </div>
      )}

      {/* Human hand */}
      <div className="panel p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold uppercase text-muted">
            Sua mão
          </span>
          {isMyTurn && !room.awaitingResponseFromTeam && !room.roundSummary && (
            <button
              type="button"
              className="btn-secondary text-xs px-3 py-1"
              onClick={handleCallTruco}
            >
              Pedir Truco
            </button>
          )}
        </div>
        <div className="flex gap-2 justify-center flex-wrap">
          {human?.cards.map((card) => (
            <SuitCard
              key={card.id}
              rank={card.rank}
              suit={TRUCO_SUIT_SYMBOL[card.suit]}
              disabled={
                !isMyTurn ||
                !!room.awaitingResponseFromTeam ||
                !!room.roundSummary ||
                isActionPending
              }
              onClick={() => handlePlay(card.id)}
            />
          ))}
        </div>
        {isMyTurn && !room.roundSummary && !room.awaitingResponseFromTeam && (
          <p className="text-center text-xs text-success mt-2 font-semibold">
            Sua vez de jogar!
          </p>
        )}
      </div>

      {/* Round / game over */}
      {room.roundSummary && (
        <div className="panel p-4 mb-4 text-center">
          <p className="text-sm font-semibold mb-3">{room.roundSummary}</p>
          {room.status !== "game_over" ? (
            <button
              type="button"
              className="btn-primary"
              onClick={handleNextRound}
              disabled={isOnline && !onlineSession?.isHost}
            >
              {isOnline && !onlineSession?.isHost
                ? "Aguardando host"
                : "Próxima mão"}
            </button>
          ) : (
            <button type="button" className="btn-primary" onClick={onExit}>
              Voltar ao menu
            </button>
          )}
        </div>
      )}

      {room.status === "game_over" && room.winnerTeam !== null && (
        <div className="panel p-6 text-center border-success">
          <h2 className="text-xl font-black text-success mb-1">
            Time {room.winnerTeam + 1} venceu!
          </h2>
          <p className="text-sm text-muted">
            Placar final: {room.teamScores[0]} × {room.teamScores[1]}
          </p>
        </div>
      )}

      {/* Log */}
      <div className="panel p-3 max-h-32 overflow-y-auto">
        {room.log.map((entry, i) => (
          <p
            key={i}
            className="text-[11px] text-muted border-b border-default/50 py-1 last:border-0"
          >
            {entry}
          </p>
        ))}
      </div>
    </div>
  );
};
