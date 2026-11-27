export type Role = 'manager' | 'dev';

export interface Account {
  id: number;
  email: string;
  name: string;
  role: Role;
}

export interface NewAccount {
  email: string;
  name: string;
  password: string;
}

export interface FieldError {
  error: string;
  field: string;
}

export type SetupResult =
  | { status: 'created'; account: Account; sessionToken: string }
  | { status: 'wrong-code' }
  | { status: 'already-set-up' }
  | ({ status: 'invalid' } & FieldError);
