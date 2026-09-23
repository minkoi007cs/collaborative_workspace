export type Profile = {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
};

export type Workspace = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  _count: { members: number };
};

export type Member = {
  id: string;
  role: 'OWNER' | 'ADMIN' | 'EDITOR' | 'VIEWER';
  joinedAt: string;
  user: { id: string; displayName: string; email: string };
};

export type Invitation = {
  id: string;
  email: string;
  role: 'ADMIN' | 'EDITOR' | 'VIEWER';
  expiresAt: string;
  createdAt: string;
};
