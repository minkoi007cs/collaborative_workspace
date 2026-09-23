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

export type BoardColumn = {
  id: string;
  name: string;
  position: number;
  createdAt: string;
  updatedAt: string;
};

export type Board = {
  id: string;
  projectId: string;
  name: string;
  version: number;
  columns: BoardColumn[];
  createdAt: string;
  updatedAt: string;
};

export type Project = {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  status: 'ACTIVE' | 'ARCHIVED';
  boards: Board[];
  createdAt: string;
  updatedAt: string;
};
