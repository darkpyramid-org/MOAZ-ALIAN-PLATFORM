import type { NextFunction, Request, Response } from 'express';
import { randomInt } from 'node:crypto';

/**
 * Per-request trace identifier in the ASP.NET shape: "<connectionId>:<requestNumber>"
 * (e.g. "0HNQ1STE8KJRJ:0000002D"). Everything error-shaped embeds it, so the
 * frontend's support flow (match a log line to a response) survives the port.
 *
 * The connection half is minted once per TCP socket (WeakMap keyed by the raw
 * socket — it vanishes when the connection closes, so long-lived servers do not
 * accumulate per-connection state) and the request half is a monotonically
 * increasing 8-digit hex counter within that connection, exactly how Kestrel
 * correlates keep-alive requests on one connection.
 */

// Kestrel connection ids are 13 base-32 characters; current .NET emissions start
// with the "0H" prefix we mirror here.
const CONNECTION_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUV';
const CONNECTION_ID_LENGTH = 11; // after the "0H" prefix
const REQUEST_NUMBER_LENGTH = 8;

interface ConnectionInfo {
  id: string;
  requests: number;
}

const connections = new WeakMap<object, ConnectionInfo>();

function mintConnectionId(): string {
  let id = '0H';
  for (let i = 0; i < CONNECTION_ID_LENGTH; i += 1) {
    id += CONNECTION_ALPHABET[randomInt(0, CONNECTION_ALPHABET.length)];
  }
  return id;
}

declare module 'express-serve-static-core' {
  interface Request {
    traceId?: string;
  }
}

export function trace(req: Request, res: Response, next: NextFunction): void {
  const socket = req.socket as unknown as object;
  let info = connections.get(socket);
  if (info === undefined) {
    info = { id: mintConnectionId(), requests: 0 };
    connections.set(socket, info);
  }
  info.requests += 1;

  req.traceId = `${info.id}:${info.requests.toString(16).toUpperCase().padStart(REQUEST_NUMBER_LENGTH, '0')}`;
  next();
}
