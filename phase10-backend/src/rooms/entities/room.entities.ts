import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type RoomStatus = 'lobby' | 'playing' | 'round_end' | 'game_over';

@Entity('rooms')
export class Room {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true, length: 6 })
  code!: string;

  @Column({ type: 'varchar', nullable: true })
  passwordHash!: string | null;

  @Column()
  hostMemberId!: string;

  @Column({ default: 4 })
  maxPlayers!: number;

  @Column({ default: 'lobby' })
  status!: RoomStatus;

  @Column({ type: 'simple-json', default: '{}' })
  settings!: {
    gameMode: 'online';
    botDelay: number;
    drawTimeoutMs: number;
    discardTimeoutMs: number;
    customPhases: boolean;
    allowBots: boolean;
    cardGame?: 'phase10' | 'truco' | 'poker' | 'tower_master';
  };

  @Column({ type: 'text', nullable: true })
  gameStateJson!: string | null;

  @Column({ default: 1 })
  roundNumber!: number;

  @OneToMany(() => RoomMember, (member) => member.room)
  members!: RoomMember[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @Column({ type: 'datetime', nullable: true })
  lastActivityAt!: Date | null;
}

@Entity('room_members')
export class RoomMember {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  roomId!: string;

  @ManyToOne(() => Room, (room) => room.members, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'roomId' })
  room!: Room;

  @Column()
  name!: string;

  @Column()
  avatar!: string;

  @Column()
  color!: string;

  @Column({ default: false })
  isBot!: boolean;

  @Column({ unique: true })
  sessionToken!: string;

  @Column({ type: 'varchar', nullable: true })
  socketId!: string | null;

  @Column({ default: 0 })
  seatIndex!: number;

  @Column({ default: true })
  isConnected!: boolean;

  @Column({ default: false })
  waitingForNextRound!: boolean;

  @Column({ default: false })
  isReady!: boolean;

  @CreateDateColumn()
  createdAt!: Date;
}
