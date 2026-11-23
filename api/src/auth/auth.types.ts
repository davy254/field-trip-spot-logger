import { Request } from 'express';
import { Role } from '../generated/prisma/client';

// What we put inside the token
export interface JwtPayload {
  sub: number;
  email: string;
  role: Role;
}

// What ends up on req.user after the token is verified
export interface AuthUser {
  id: number;
  email: string;
  role: Role;
}

export interface AuthenticatedRequest extends Request {
  user: AuthUser;
}