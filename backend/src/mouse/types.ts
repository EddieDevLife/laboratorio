export type MouseButton = 'left' | 'right' | 'middle';

export interface MoveCommand {
  type: 'move';
  x: number;
  y: number;
  durationMs?: number;
}

export interface ClickCommand {
  type: 'click' | 'doubleClick' | 'rightClick';
  x: number;
  y: number;
  button?: MouseButton;
}

export interface TypeCommand {
  type: 'type';
  text: string;
  delayMs?: number;   // delay between characters
}

export interface KeyCommand {
  type: 'key';
  key: string;        // e.g. 'Tab', 'Enter', 'Escape'
  modifiers?: Array<'ctrl' | 'shift' | 'alt' | 'meta'>;
}

export interface ScrollCommand {
  type: 'scroll';
  x: number;
  y: number;
  deltaX?: number;
  deltaY?: number;
}

export interface WaitCommand {
  type: 'wait';
  ms: number;
}

export type MouseCommand =
  | MoveCommand
  | ClickCommand
  | TypeCommand
  | KeyCommand
  | ScrollCommand
  | WaitCommand;

export interface QueuedCommand {
  id: string;
  sessionId: string;
  command: MouseCommand;
  queuedAt: string;
  status: 'pending' | 'sent' | 'done' | 'error';
  error?: string;
}

export interface CommandQueue {
  sessionId: string;
  commands: QueuedCommand[];
}
